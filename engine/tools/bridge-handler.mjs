// bridge-handler.mjs — Universal file bridge for any coding agent CLI

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");

// Load configuration
const CONFIG_PATH = path.resolve(PROJECT_ROOT, "engine/tools/bridge-config.json");
const CONFIG = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));

// LLM config path (created by webui-server)
const LLM_CONFIG_PATH = path.join(PROJECT_ROOT, "webui/data/llm-config.json");

const INBOX_FILE = path.join(PROJECT_ROOT, "chat-inbox.json");
const OUTBOX_FILE = path.join(PROJECT_ROOT, "chat-outbox.json");

class CLIAdapter {
  constructor(name, config) {
    this.name = name;
    this.config = config;
  }

  async invoke(promptFile, workDir) {
    const { command, args, env } = this.config;
    
    const resolvedArgs = args.map(arg => arg.replace("{promptFile}", promptFile));
    
    console.log(`[bridge] Spawning: ${command} ${resolvedArgs.join(" ")}`);
    
    return new Promise((resolve, reject) => {
      const child = spawn(command, resolvedArgs, {
        cwd: workDir || process.cwd(),
        env: { ...process.env, ...this.config.env },
        stdio: ["ignore", "pipe", "pipe"]
      });

      let stdout = "", stderr = "";
      child.stdout.on("data", d => stdout += d);
      child.stderr.on("data", d => stderr += d);

      child.on("error", (err) => {
        console.error(`[bridge] Spawn error: ${err.message}`);
        reject(err);
      });
      child.on("close", (code) => {
        console.log(`[bridge] Process exited with code ${code}`);
        if (code === 0) resolve(stdout.trim());
        else reject(new Error(`${this.name} exited with code ${code}: ${stderr}`));
      });
    });
  }
}

class APIAdapter {
  constructor(name, config) {
    this.name = name;
    this.config = config;
  }

  getDefaultBaseUrl(providerId) {
    const urls = {
      gemini: "https://generativelanguage.googleapis.com/v1beta/models",
      openai: "https://api.openai.com/v1/chat/completions",
      anthropic: "https://api.anthropic.com/v1/messages",
      openrouter: "https://openrouter.ai/api/v1/chat/completions",
      ollama: "http://localhost:11434/v1/chat/completions",
      lmstudio: "http://localhost:1234/v1/chat/completions"
    };
    return urls[providerId];
  }

  getAuthHeaders(providerId, key) {
    switch (providerId) {
      case "gemini":
        return { "x-goog-api-key": key };
      case "anthropic":
        return { "x-api-key": key, "anthropic-version": "2023-06-01" };
      default:
        return { "Authorization": `Bearer ${key}` };
    }
  }

  async invoke(promptFile, workDir, options = {}) {
    const { model, temperature = 0.7, streaming = true, apiKey, baseUrl } = this.config;
    
    const resolvedKey = apiKey?.startsWith("env:") 
      ? process.env[apiKey.slice(4)] 
      : apiKey;
    
    if (!resolvedKey) {
      throw new Error(`API key not found for ${this.name}`);
    }

    const payload = {
      model: options.model || this.config.model,
      messages: [{ role: "user", content: fs.readFileSync(promptFile, "utf-8") }],
      temperature: options.temperature ?? this.config.temperature ?? 0.7,
      stream: this.config.streaming ?? true
    };

    const url = this.config.baseUrl || this.getDefaultBaseUrl(this.name);
    const headers = {
      "Content-Type": "application/json",
      ...this.getAuthHeaders(this.name, resolvedKey)
    };

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} ${errorText}`);
    }

    if (this.config.streaming !== false) {
      return this.handleStream(response);
    }
    return response.json();
  }

  getDefaultBaseUrl(providerId) {
    const urls = {
      gemini: "https://generativelanguage.googleapis.com/v1beta/models",
      openai: "https://api.openai.com/v1/chat/completions",
      anthropic: "https://api.anthropic.com/v1/messages",
      openrouter: "https://openrouter.ai/api/v1/chat/completions",
      ollama: "http://localhost:11434/v1/chat/completions",
      lmstudio: "http://localhost:1234/v1/chat/completions"
    };
    return urls[providerId];
  }

  getAuthHeaders(providerId, key) {
    switch (providerId) {
      case "gemini":
        return { "x-goog-api-key": key };
      case "anthropic":
        return { "x-api-key": key, "anthropic-version": "2023-06-01" };
      default:
        return { "Authorization": `Bearer ${key}` };
    }
  }

  async handleStream(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      for (const line of chunk.split("\n")) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return fullText;
          try {
            const parsed = JSON.parse(data);
            const delta = this.extractDelta(parsed);
            if (delta) fullText += delta;
          } catch {}
        }
      }
    }
    return fullText;
  }

  extractDelta(parsed) {
    // OpenRouter / OpenAI format
    if (parsed.choices?.[0]?.delta?.content) {
      return parsed.choices[0].delta.content;
    }
    // Gemini format
    if (parsed.candidates?.[0]?.content?.parts?.[0]?.text) {
      return parsed.candidates[0].content.parts[0].text;
    }
    // Anthropic format
    if (parsed.delta?.text) {
      return parsed.delta.text;
    }
    return "";
  }
}

class BridgeHandler {
  constructor() {
    this.adapters = new Map();
    this.apiAdapters = new Map();
    this.llmConfig = null;
    this.loadAdapters();
    this.loadLLMConfig();
  }

  loadAdapters() {
    for (const [name, config] of Object.entries(CONFIG.clients)) {
      this.adapters.set(name, new CLIAdapter(name, config));
    }
  }

  loadLLMConfig() {
    try {
      if (fs.existsSync(LLM_CONFIG_PATH)) {
        const content = fs.readFileSync(LLM_CONFIG_PATH, "utf-8");
        this.llmConfig = JSON.parse(content);
        console.log("[bridge] Loaded LLM config");
      } else {
        console.log("[bridge] No LLM config found, using CLI only");
      }
    } catch (e) {
      console.error("[bridge] Failed to load LLM config:", e.message);
    }
  }

  getAdapter() {
    if (CONFIG.cli !== "auto") {
      const adapter = this.adapters.get(CONFIG.cli);
      if (!adapter) throw new Error(`Unknown CLI: ${CONFIG.cli}`);
      return adapter;
    }
    for (const name of ["opencode", "claude", "agy"]) {
      if (this.adapters.has(name)) {
        return this.adapters.get(name);
      }
    }
    throw new Error("No suitable CLI found. Install opencode, claude, or agy.");
  }

  getAPIAdapter(providerId) {
    if (!this.llmConfig?.apiProviders?.[providerId]?.enabled) {
      throw new Error(`Provider ${providerId} not enabled in config`);
    }
    
    if (!this.apiAdapters.has(providerId)) {
      const config = this.llmConfig.apiProviders[providerId];
      this.apiAdapters.set(providerId, new APIAdapter(providerId, {
        ...config,
        apiKey: config.apiKey,
        baseUrl: config.baseUrl,
        model: config.model,
        temperature: config.temperature,
        streaming: config.streaming
      }));
    }
    return this.apiAdapters.get(providerId);
  }

  getActiveProvider() {
    if (!this.llmConfig) return { type: "cli", id: "opencode" };
    
    const { activeProviderType, activeProviderId } = this.llmConfig;
    
    if (activeProviderType === "api" && this.llmConfig.apiProviders?.[activeProviderId]?.enabled) {
      return { type: "api", id: activeProviderId };
    }
    if (activeProviderType === "cli") {
      return { type: "cli", id: activeProviderId || "opencode" };
    }
    // Default fallback
    return { type: "cli", id: "opencode" };
  }

  async processInbox() {
    if (!fs.existsSync(INBOX_FILE)) return;

    const stats = fs.statSync(INBOX_FILE);
    if (stats.mtimeMs <= this.lastInboxMtime) return;
    this.lastInboxMtime = fs.statSync(INBOX_FILE).mtimeMs;

    // Read and strip BOM if present
    let inboxContent = fs.readFileSync(INBOX_FILE, "utf-8");
    if (inboxContent.startsWith("\uFEFF")) {
      inboxContent = inboxContent.slice(1);
    }
    
    // Skip empty or cleared inbox
    if (!inboxContent.trim() || inboxContent.trim() === "{}") {
      return;
    }

    let inbox;
    try {
      inbox = JSON.parse(inboxContent);
    } catch (e) {
      console.error("[bridge] Failed to parse inbox:", e.message);
      return;
    }

    if (!inbox.requestId || !inbox.payload || !inbox.payload.prompt) {
      return; // Silently skip cleared/invalid inbox
    }

    console.log(`[bridge] Processing request ${inbox.requestId}`);

    // Write prompt to temp file for agent
    const promptFile = path.join(PROJECT_ROOT, `.prompt-${inbox.requestId}.md`);
    fs.writeFileSync(promptFile, inbox.payload.prompt);

    try {
      console.log(`[bridge] Processing request ${inbox.requestId}`);
      
      const result = await this.invokeAgent(inbox, promptFile);
      
      // Clean up prompt file
      try { fs.unlinkSync(promptFile); } catch {}

      // Write outbox
      const outbox = {
        requestId: inbox.requestId,
        timestamp: new Date().toISOString(),
        skill: "chat",
        payload: { response: result },
        approvalRequired: false
      };

      const outboxJson = JSON.stringify(outbox, null, 2);
      fs.writeFileSync(OUTBOX_FILE, outboxJson, { encoding: 'utf8' });
      console.log(`[bridge] Wrote outbox.json for request ${inbox.requestId}`);

      // Clear inbox
      fs.writeFileSync(INBOX_FILE, JSON.stringify({}));
    } catch (e) {
      console.error(`[bridge] Error processing inbox: ${e.message}`);
      const errorOutbox = {
        requestId: "error",
        timestamp: new Date().toISOString(),
        skill: "chat",
        error: e.message
      };
      fs.writeFileSync(OUTBOX_FILE, JSON.stringify(errorOutbox, null, 2));
    }
  }

  async invokeAgent(inbox, promptFile) {
    const provider = this.getActiveProvider();
    
    if (provider.type === "api") {
      const adapter = this.getAPIAdapter(provider.id);
      return await adapter.invoke(promptFile);
    }
    
    // Default to CLI adapter
    const adapter = this.getAdapter();
    return await adapter.invoke(promptFile);
  }

  watch() {
    console.log("[bridge] Starting file bridge handler...");
    console.log(`[bridge] Watching: ${INBOX_FILE}`);
    console.log(`[bridge] Output: ${OUTBOX_FILE}`);

    if (!fs.existsSync(INBOX_FILE)) {
      fs.writeFileSync(INBOX_FILE, JSON.stringify({}));
    }

    this.lastInboxMtime = fs.existsSync(INBOX_FILE) ? fs.statSync(INBOX_FILE).mtimeMs : 0;

    setInterval(() => this.processInbox(), 1000);

    console.log("[bridge] Bridge handler running. Press Ctrl+C to stop.");
  }
}

function log(msg) {
  console.log(`[bridge:${new Date().toISOString()}] ${msg}`);
}

function ensureInboxExists() {
  if (!fs.existsSync(INBOX_FILE)) {
    fs.writeFileSync(INBOX_FILE, JSON.stringify({}));
  }
}

const handler = new BridgeHandler();
handler.watch();

export { BridgeHandler };