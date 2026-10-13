# AI Provider Configuration System - Documentation

**Location**: `webui/AI_CONFIG.md`  
**Last Updated**: 2024  
**Status**: Frontend Complete | Backend Planned

---

## Overview

This document describes the complete AI Provider Configuration System for the Paper Engine WebUI. It covers the implemented frontend modal, the planned backend API, and the bridge handler integration strategy.

---

## 1. Frontend Implementation (COMPLETE)

### 1.1 Modal Access
- **Trigger**: Gear icon (⚙️) in top menu bar, right of action buttons
- **Location**: `webui/index.html` → `#llm-config-modal`
- **Button ID**: `#llm-config-btn`
- **Classes**: `action-button secondary` with gear SVG icon

### 1.2 Modal Structure

```
┌─────────────────────────────────────────────┐
│  AI Provider Configuration              ✕  │
├─────────────────────────────────────────────┤
│  [CLI Agents] [API Providers] [MCP/Session] │
├─────────────────────────────────────────────┤
│  Tab Content Area                           │
├─────────────────────────────────────────────┤
│  [Cancel]              [Save & Close]       │
└─────────────────────────────────────────────┘
```

### 1.3 Tab Details

#### Tab 1: CLI Agents (`#tab-cli`)
- **Source**: `/engine/tools/bridge-config.json` (served statically)
- **Agents Shown**: opencode, claude, agy
- **Fields per Agent**: 
  - Name (capitalized ID)
  - Command + args (e.g., `cmd /c npx opencode run ...`)
  - Status badge: "available"
- **Empty State**: "No CLI agents configured"
- **Implementation**: `populateCLIAgentList()` in `app.js`

#### Tab 2: API Providers (`#tab-api`)
**Provider Selector** (7 options):
| Value | Label | Type | Models |
|-------|-------|------|--------|
| `gemini` | Google Gemini | Cloud | 1.5 Pro, 1.5 Flash, 1.0 Pro |
| `openai` | OpenAI | Cloud | GPT-4o, 4o-mini, 4-turbo, 3.5-turbo |
| `anthropic` | Anthropic (Claude) | Cloud | 3.5 Sonnet, 3.5 Haiku, 3 Opus |
| `openrouter` | OpenRouter (Free & Paid) | Gateway | Auto, Claude, GPT-4o, Gemini, Llama 405B, Mistral |
| `ollama` | Ollama (Local) | Local | Llama 3.1 8B/70B, Mistral, CodeLlama, Phi-3, Gemma 2 |
| `lmstudio` | LM Studio (Local) | Local | Auto (detects loaded model) |
| `custom` | Custom OpenAI-Compatible | Custom | User-defined |

**Form Fields**:
- Provider dropdown → triggers `updateAPIModels()`
- API Key (password with visibility toggle) → hint: "Stored in .env.local"
- Base URL (conditional: shows for ollama/lmstudio/custom)
- Model dropdown → populated by `updateAPIModels()`
- Temperature slider (0-2, step 0.1, live value display)
- Streaming checkbox (default: checked)
- **Actions**: Test Connection, Save Provider
- **Saved Providers List**: Shows configured providers with status

#### Tab 3: MCP / Session (`#tab-mcp`)
- MCP Server URL (default: `http://localhost:3456`)
- Skill (default: `chat`)
- Auto-connect checkbox (default: checked)
- Test Connection / Save Configuration buttons
- Status indicator (red=disconnected, green=connected)

### 1.4 Modal Behavior
- **Open**: Click gear icon → `openLLMConfigModal()` → adds `.visible` + `.opening` classes
- **Close**: X button, backdrop click, Cancel button, ESC key → `closeLLMConfigModal()` → adds `.closing`, removes `.visible`
- **Animations**: CSS `@keyframes modalSlideIn/Out` (0.2s)
- **Tab Switching**: `switchLLMConfigTab()` with ARIA attributes

### 1.5 CSS Classes (main.css)
| Class | Purpose |
|-------|---------|
| `.llm-config-modal` | Fixed overlay, hidden by default |
| `.llm-config-modal.visible` | Shows modal (opacity/visibility) |
| `.llm-config-modal.opening` | Entrance animation |
| `.llm-config-modal.closing` | Exit animation |
| `.llm-config-tabs` | Tab button container |
| `.llm-config-tab.active` | Active tab styling |
| `.llm-config-tab-panel.active` | Shows panel content |
| `.provider-controls` | Menu bar button container |
| `.llm-provider-item` | Provider list item |
| `.llm-provider-status.available` | Green badge |

### 1.6 JavaScript (app.js)
**Methods Added**:
- `initLLMConfigModal()` - Initialize modal elements, bind events
- `openLLMConfigModal()` / `closeLLMConfigModal()` - Visibility with animations
- `switchLLMConfigTab(tabName)` - Tab switching with ARIA
- `populateCLIAgentList()` - Fetches `/engine/tools/bridge-config.json`
- `updateAPIModels()` - Dynamic model dropdown per provider
- `openLLMConfigModal()` / `closeLLMConfigModal()` - Class-based visibility
- `saveLLMConfig()` - Placeholder for backend integration

---

## 2. Backend API Plan (NOT IMPLEMENTED)

### 2.1 New Endpoints (webui-server.mjs)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/llm/config` | GET | Load full config (CLI + API + MCP) |
| `/api/llm/config` | POST | Save full config |
| `/api/llm/config/cli` | GET | Get CLI agents from bridge-config.json |
| `/api/llm/config/api` | GET | List API providers |
| `/api/llm/config/api` | POST | Save API provider |
| `/api/llm/config/mcp` | GET | Get MCP config |
| `/api/llm/config/mcp` | POST | Save MCP config |
| `/api/llm/test` | POST | Test provider connection |
| `/api/llm/chat` | POST | Send chat message to active provider |

### 2.2 Config File Structure

**File**: `webui/data/llm-config.json` (gitignored)

```json
{
  "activeProvider": "opencode",
  "cliAgents": {
    "opencode": { "enabled": true, "config": {...} },
    "claude": { "enabled": false },
    "agy": { "enabled": false }
  },
  "apiProviders": {
    "gemini": { 
      "enabled": true, 
      "apiKey": "env:GEMINI_API_KEY", 
      "model": "gemini-1.5-pro", 
      "temperature": 0.7, 
      "streaming": true 
    },
    "openrouter": { 
      "enabled": true, 
      "apiKey": "env:OPENROUTER_API_KEY", 
      "model": "openrouter/auto", 
      "baseUrl": "https://openrouter.ai/api/v1" 
    },
    "ollama": { 
      "enabled": true, 
      "baseUrl": "http://localhost:11434/v1", 
      "model": "llama3.1:8b" 
    },
    "lmstudio": { 
      "enabled": true, 
      "baseUrl": "http://localhost:1234/v1", 
      "model": "lmstudio-auto" 
    }
  },
  "mcp": { 
    "enabled": true, 
    "serverUrl": "http://localhost:3456", 
    "skill": "chat", 
    "autoConnect": true 
  },
  "activeProviderType": "cli",
  "activeProviderId": "opencode"
}
```

### 2.3 Environment File Template
**File**: `.env.local.example` (in project root)

```bash
# CLI Agents (optional overrides)
# OPENCODE_COMMAND=opencode
# CLAUDE_COMMAND=claude
# AGY_COMMAND=agy

# API Providers
GEMINI_API_KEY=
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
OPENROUTER_API_KEY=
CUSTOM_API_BASE_URL=
CUSTOM_API_KEY=

# Local LLMs
# OLLAMA_BASE_URL=http://localhost:11434/v1
# LMSTUDIO_BASE_URL=http://localhost:1234/v1

# MCP / Session
MCP_SERVER_URL=http://localhost:3456
MCP_SKILL=chat

# Optional defaults
# DEFAULT_TEMPERATURE=0.7
# DEFAULT_STREAMING=true

# Model overrides
# GEMINI_MODEL=gemini-1.5-pro
# OPENAI_MODEL=gpt-4o
# ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

---

## 3. Bridge Handler Integration Plan (NOT IMPLEMENTED)

### 3.1 Current Limitation
Current `bridge-handler.mjs` only supports CLI agents via `spawn()`. Need to add:

### 3.2 New Invocation Methods

| Type | Implementation |
|------|----------------|
| **CLI** | Existing `spawn()` - keep as-is |
| **API** | HTTP POST to provider endpoint |
| **Local (Ollama/LM Studio)** | HTTP POST to local endpoint |
| **MCP** | Forward to MCP server via HTTP/WebSocket |

### 3.3 Bridge Config Loading
```javascript
// Load from webui/data/llm-config.json (created by webui-server)
const LLM_CONFIG_PATH = path.join(PROJECT_ROOT, "webui/data/llm-config.json");
```

### 3.4 New `invoke()` Methods

```javascript
// Bridge handler additions
async invokeAPI(provider, prompt, options) {
  // HTTP POST to provider API with auth headers
  // Handles: gemini, openai, anthropic, openrouter, custom
}

async invokeLocal(provider, prompt, options) {
  // POST to localhost:11434 (Ollama) or localhost:1234 (LM Studio)
  // OpenAI-compatible /v1/chat/completions endpoint
}

async invokeMCP(prompt, options) {
  // Forward to MCP server via HTTP/WebSocket
  // Uses skill from config (chat, new-idea, etc.)
}
```

### 3.5 Provider Endpoints

| Provider | Endpoint | Auth | Notes |
|----------|----------|------|-------|
| **Gemini** | `generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` | `x-goog-api-key` | Native API |
| **OpenAI** | `api.openai.com/v1/chat/completions` | `Bearer` | Standard |
| **OpenRouter** | `openrouter.ai/api/v1/chat/completions` | `Bearer` | Free tier available |
| **Anthropic** | `api.anthropic.com/v1/messages` | `x-api-key` | Messages API |
| **Custom** | `${baseUrl}/chat/completions` | `Bearer` | OpenAI-compatible |

### 3.6 Local Providers
| Provider | Default URL | Format |
|----------|-------------|--------|
| **Ollama** | `http://localhost:11434/v1/chat/completions` | OpenAI-compatible |
| **LM Studio** | `http://localhost:1234/v1/chat/completions` | OpenAI-compatible |

### 3.7 MCP Connection
- WebSocket or HTTP to `MCP_SERVER_URL`
- Uses `skill` from config (`chat`, `new-idea`, etc.)
- Reuses session's generous rate limits

---

## 4. Integration Flow

### 4.1 Chat Request Flow
```
WebUI (sendChatMessage)
    → POST /api/write-inbox (webui-server)
    → writes chat-inbox.json
    → Bridge Handler watches inbox
    → Bridge reads activeProvider from llm-config.json
    → Bridge invokes appropriate method (CLI/API/Local/MCP)
    → Bridge writes chat-outbox.json
    → WebUI polls /api/read-outbox
    → WebUI displays response
```

### 4.2 Config Hot-Reload
- Bridge watches `llm-config.json` for changes
- WebUI-server writes config on save
- No restart needed for config changes

---

## 5. Implementation Priority

| Order | Task | Effort | File |
|-------|------|--------|------|
| 1 | Add config endpoints to webui-server.mjs | Medium | `engine/tools/webui-server.mjs` |
| 2 | Add config file read/write utilities | Low | `engine/tools/webui-server.mjs` |
| 2 | Bridge: load llm-config.json | Low | `engine/tools/bridge-handler.mjs` |
| 3 | Bridge: implement API provider invocation | High | `engine/tools/bridge-handler.mjs` |
| 4 | Bridge: implement local LLM invocation | Medium | `engine/tools/bridge-handler.mjs` |
| 5 | Bridge: implement MCP forwarding | High | `engine/tools/bridge-handler.mjs` |
| 6 | WebUI: wire modal save/load to backend | Medium | `webui/scripts/app.js` |
| 7 | Test all providers end-to-end | Medium | - |

---

## 6. File Changes Summary

| File | Changes |
|------|---------|
| `engine/tools/webui-server.mjs` | Add 9 new endpoints |
| `engine/tools/bridge-handler.mjs` | Load llm-config, add API/Local/MCP invoke methods |
| `webui/scripts/app.js` | Wire modal save/load to backend |
| `webui/data/llm-config.json` | New config file (gitignored) |
| `.env.local` | API keys (not committed) |

---

## 7. Current Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| Frontend Modal HTML | ✅ Done | `webui/index.html` |
| Frontend Modal CSS | ✅ Done | `webui/styles/main.css` |
| Frontend Modal JS | ✅ Done | `webui/scripts/app.js` |
| CLI Agents List | ✅ Done | Auto-populated from bridge-config.json |
| API Providers Form | ✅ Done | 7 providers, dynamic models |
| MCP/Session Tab | ✅ Done | UI ready |
| Modal Animations | ✅ Done | CSS transitions |
| Config Persistence | ❌ Todo | Backend endpoints needed |
| Backend API | ❌ Todo | webui-server.mjs |
| Bridge Integration | ❌ Todo | bridge-handler.mjs |
| Provider Invocation | ❌ Todo | bridge-handler.mjs |
| MCP Connection | ❌ Todo | bridge-handler.mjs |

---

## 8. Testing Checklist

When backend is implemented:
- [ ] CLI Agents load from bridge-config.json
- [ ] API Provider form saves to llm-config.json
- [ ] Model dropdown updates per provider
- [ ] Base URL shows/hides for local/custom
- [ ] Test Connection works for each provider
- [ ] Chat works with CLI agent (opencode)
- [ ] Chat works with API provider (Gemini/OpenRouter)
- [ ] Chat works with local LLM (Ollama/LM Studio)
- [ ] Chat works via MCP
- [ ] Config hot-reload works (no restart)
- [ ] Config persists across restarts

---

## 9. File Locations Reference

```
paper-engine/
├── .env.local.example          # Environment template (root)
├── engine/
│   └── tools/
│       ├── webui-server.mjs    # Backend API (needs endpoints)
│       ├── bridge-handler.mjs  # Bridge handler (needs integration)
│       └── bridge-config.json  # CLI agent config (existing)
├── webui/
├── AI_CONFIG.md               # This file
├── index.html                 # Modal HTML (done)
├── scripts/
│   └── app.js                 # Modal JS (done)
├── styles/
│   └── main.css               # Modal CSS (done)
├── data/
│   ├── books-index.json       # Existing
│   ├── chat-history.json      # Existing
│   └── llm-config.json        # New (gitignored)
└── styles/main.css            # Modal styles (done)
```

---

## 10. Quick Start for Backend Implementation

1. **Add config endpoints** to `webui-server.mjs`
2. **Create `webui/data/llm-config.json`** on first save
3. **Update `bridge-handler.mjs`** to load `llm-config.json`
4. **Add `invokeAPI()`, `invokeLocal()`, `invokeMCP()`** to bridge
5. **Wire WebUI modal** `saveLLMConfig()` → POST `/api/llm/config`
6. **Wire WebUI modal** `openLLMConfigModal()` → GET `/api/llm/config`
7. **Test each provider** end-to-end

---

*This document serves as the single source of truth for the AI Provider Configuration System implementation.*