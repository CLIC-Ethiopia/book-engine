#!/usr/bin/env node
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

class BridgeHandler {
  constructor() {
    this.adapters = new Map();
    this.loadAdapters();
  }

  loadAdapters() {
    for (const [name, config] of Object.entries(CONFIG.clients)) {
      this.adapters.set(name, new CLIAdapter(name, config));
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

    // Write prompt to temp file for agent (server already enriched with context)
    const promptFile = path.join(PROJECT_ROOT, `.prompt-${inbox.requestId}.md`);
    fs.writeFileSync(promptFile, inbox.payload.prompt);

    const adapter = this.getAdapter();
    
    try {
      console.log(`[bridge] Invoking ${adapter.name} for request ${inbox.requestId}`);
      
      const promptContent = fs.readFileSync(path.join(PROJECT_ROOT, `.prompt-${inbox.requestId}.md`), "utf-8");
      const promptFile = path.join(PROJECT_ROOT, `.prompt-${inbox.requestId}.md`);
      
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
      // Write without BOM - use UTF8 without BOM
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
    const adapter = this.getAdapter();
    
    // Use the CLI adapter to run the agent and get the response
    const result = await adapter.invoke(promptFile);
    
    return result;
  }

  async invokeWithAdapter(inbox, promptFile) {
    // This method is kept for compatibility but now delegates to invokeAgent
    return await this.invokeAgent(inbox, promptFile);
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