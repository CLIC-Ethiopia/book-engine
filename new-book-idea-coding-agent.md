# New Book Modal — Plan for AI-Assisted Book Idea Creation

## Overview

When user clicks "New Book" in the left sidebar, a floating modal opens for creating a book idea file (JSON/Markdown) in `ideas/` folder. The modal guides an interactive human-AI session using the coding agent's LLM (no external API keys) following the STEAM-IE framework.

**Unified Goal:** The same 6-stage workflow works from two entry points:
1. **Web UI** — "New Book" button → floating modal
2. **Agent Session** — CLI command `/new-idea` or skill invocation → terminal/interactive

Both share the **same core logic** via a new `new-idea` skill (mirroring `ideas-to-book` pattern).

---

## Reference Files

| File | Purpose |
|------|---------|
| `gemini_gem_book_engine_instructions_v02.md` | 6-stage interactive workflow (Sector Intake → Sub-sectors → Outline → Customization → Generation → Export) |
| `STEAM-IE-BOOK-PROMPT.md` | Prompt template with placeholders for topic, audience, goals, STEAM-IE outline, constraints |
| `ideas/idea-file-format.json` | Target JSON schema: title, slug, subtitle, editionLabel, author, series, audience, primaryLocation, coverImage, pages[] with no, section, title, subtitle, content, imagePrompt, imageType, actionCallout, citations |

---

## New "new-idea" Skill (Unified Core)

### Skill Location (Dual-Copy Pattern)
```
.claude/skills/new-idea/           # For Claude/Opencode agents
  ├── SKILL.md                     # Skill manifest (this pattern)
  ├── prompts/
  │   ├── stage1-sector.md
  │   ├── stage2-subsector.md
  │   ├── stage3-outline.md
  │   ├── stage4-customize.md
  │   ├── stage5-generate.md
  │   └── stage6-export.md
  └── schemas/
      └── idea-file-format.json    # Copy of ideas/idea-file-format.json

.agents/skills/new-idea/           # For agent-native workflows
  ├── SKILL.md                     # Identical manifest
  ├── prompts/                     # Same prompts
  └── schemas/                     # Same schemas
```

### Skill Manifest (SKILL.md)
```yaml
---
name: new-idea
description: Guides interactive creation of a STEAM-IE book idea file through a 6-stage human-AI workflow. Works from Web UI modal or agent CLI. Outputs validated JSON to ideas/ folder ready for ideas-to-book pipeline.
---

# new-idea Skill

Creates book idea files via 6-stage STEAM-IE workflow:
1. **Sector Intake** — Choose industrial sector
2. **Sub-sector Selection** — 20 options grouped logically
3. **Outline Proposal** — Page-by-page across 7 STEAM-IE chapters
4. **Customization** — Location, capital, audience, image prefs
5. **Generation** — Page-by-page content with image prompts
6. **Export** — Validated JSON to ideas/<slug>.json

## When to Invoke
- User clicks "New Book" in Web UI
- User types `/new-idea` in agent session
- User says "create a new book idea" or "start a STEAM-IE book"

## Dual Entry Points

| Entry Point | Trigger | UI/UX |
|-------------|---------|-------|
| **Web UI** | "New Book" button click | Floating modal with stepper |
| **Agent CLI** | `/new-idea` or skill invocation | Interactive terminal prompts |

Both invoke the **same stage logic** via shared prompts in `prompts/stageN.md`.

## Stage-Gate System (Mirroring ideas-to-book)

Each stage requires human approval before proceeding. State persisted in:
- **Web UI**: `localStorage['new-book-draft']` + `ideas/inbox.json`
- **Agent**: `ideas/.work/new-idea-state.json` (approval timestamps)

### Stages (in order)
1. **`sector`** — User picks sector → agent proposes 20 sub-sectors
2. **`subsector`** — User picks one → agent proposes full outline
3. **`outline`** — User confirms/edits → agent asks customization Qs
4. **`customize`** — User answers → agent generates pages
5. **`generate`** — User reviews/edits pages → agent finalizes
6. **`export`** — User approves → write `ideas/<slug>.json`

## CLI Reference (Agent Session)
```bash
# Start new idea interactively
/new-idea

# Resume from last approved stage
/new-idea --resume

# Run specific stage only
/new-idea --stage outline

# List drafts in progress
/new-idea --list-drafts

# Force re-run stage
/new-idea --stage generate --force
```

## Shared Prompts (Source of Truth)
All prompts live in `.claude/skills/new-idea/prompts/` and `.agents/skills/new-idea/prompts/` (identical copies). The Web UI bridge handler and agent CLI both load these prompts to construct the LLM request.

---

## Unified Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     new-idea SKILL (Core Logic)                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Stage Orchestrator (6 stages, approval gates)              │   │
│  │  ├── Loads prompts from prompts/stageN.md                   │   │
│  │  ├── Validates output against schemas/idea-file-format.json │   │
│  │  └── Persists state: ideas/.work/new-idea-state.json        │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
          ▲                                              ▲
          │                                              │
          │ invokes                                      │ invokes
          │                                              │
┌─────────┴─────────────────────┐          ┌─────────────┴──────────────┐
│        WEB UI ENTRY           │          │      AGENT CLI ENTRY       │
│  ┌─────────────────────────┐  │          │  ┌──────────────────────┐  │
│  │ NewBookModal.js         │  │          │  │ new-idea CLI handler │  │
│  │ ├── Stepper UI (6 steps)│  │          │  │ ├── Interactive I/O  │  │
│  │ ├── idea-bridge.js      │  │          │  │ ├── State file I/O   │  │
│  │ └── File bridge client  │  │          │  │ └── Prompt loader    │  │
│  └─────────────────────────┘  │          │  └──────────────────────┘  │
│          │                    │          │              │              │
│          ▼                    │          │              ▼              │
│  ideas/inbox.json  ◄──────────┼──────────┼──►  ideas/outbox.json      │
│  (file bridge)                │          │     (same files!)          │
└───────────────────────────────┘          └────────────────────────────┘
```

### File Bridge (Shared Communication Layer)
```
Web UI / Agent CLI          ideas/inbox.json          Coding Agent          ideas/outbox.json
     │                          │                          │                      │
     ├─ stage: 1               │                          │                      │
     ├─ payload: {sector}      │                          │                      │
     │                    watches ──────────────────────►  reads + builds prompt │
     │                          │                          │                      │
     │                          │                    invokes LLM with prompt     │
     │                          │                          │                      │
     │                          │                    writes response ──────────► │
     │                          │                          │                      │
     │                    polls ◄───────────────────────  {stage: 2, payload}   │
     │                          │                          │                      │
```

---

## Modal UI Design (Web UI Entry Point)

### Layout (Responsive, centered overlay)

```
┌─────────────────────────────────────────────────────────────┐
│  Create New STEAM-IE Book                    [×]            │
├─────────────────────────────────────────────────────────────┤
│  Step Indicator: [1] Sector  [2] Sub-sector  [3] Outline   │
│                  [4] Customize  [5] Generate  [6] Export    │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Dynamic Stage Content - scrollable, max-height 70vh]     │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  [Back]                    [Next / Generate]  [Save Draft] │
└─────────────────────────────────────────────────────────────┘
```

### Stage Components

| Stage | UI Elements |
|-------|-------------|
| **1. Sector Intake** | Text input + 5 quick-pick chips (Smart Agriculture, Renewable Energy, Food Processing, Eco-Construction, Custom) |
| **2. Sub-sector** | 20 cards in grid (image + title + 1-line desc), searchable, "Custom" option |
| **3. Outline** | Accordion per STEAM-IE letter (S,T,E,A,M,I,IE) showing proposed pages, editable titles, drag-reorder |
| **4. Customize** | Form fields: Location, Capital Tier, Reader Level, Image Preferences, Free Samples |
| **5. Generate** | Live streaming output (page by page), "Regenerate page N" buttons, edit-in-place |
| **6. Export** | JSON preview (collapsible), Markdown preview, "Save to ideas/" button, "Copy JSON" |

### State Persistence
- Auto-save draft to `localStorage['new-book-draft']` on every stage change
- Resume from last stage on modal reopen
- Clear on successful export

---

## AI Integration (Coding Agent LLM via new-idea Skill)

### No External API — Uses Coding Agent Session via File Bridge

The `new-idea` skill orchestrates the 6-stage workflow. Both entry points (Web UI modal, Agent CLI) invoke the skill which communicates with the coding agent via the file bridge.

### File Bridge Protocol (Shared)

```
ideas/inbox.json (Web UI or Agent CLI → Skill → Agent)
{
  "requestId": "uuid",
  "stage": 1,
  "timestamp": "ISO8601",
  "skill": "new-idea",
  "payload": { "sector": "Smart Agriculture" },
  "history": [ ...previous stages... ]
}

ideas/outbox.json (Agent → Skill → Web UI / Agent CLI)
{
  "requestId": "uuid",
  "stage": 2,
  "timestamp": "ISO8601",
  "skill": "new-idea",
  "payload": { "subSectors": [ {...20 items...} ] },
  "approvalRequired": true
}
```

### Skill Orchestrator Role
The skill's orchestrator (in `engine/tools/new-idea-orchestrator.mjs`):
1. **Loads stage prompt** from `prompts/stageN.md`
2. **Injects history + user input** into prompt template
3. **Writes to `ideas/inbox.json`** for agent consumption
4. **Watches `ideas/outbox.json`** for response
5. **Validates response** against `schemas/idea-file-format.json`
6. **Persists state** to `ideas/.work/new-idea-state.json`
6. **Returns formatted payload** to caller (Web UI modal or Agent CLI)

### Stage Prompts (Source of Truth)
Each stage has a prompt file in `.claude/skills/new-idea/prompts/` and `.agents/skills/new-idea/prompts/`:

| Stage | Prompt File | Input | Output |
|-------|-------------|-------|--------|
| 1 | `stage1-sector.md` | User sector choice | 20 sub-sectors grouped |
| 2 | `stage2-subsector.md` | Chosen sub-sector | Full STEAM-IE outline (pages array) |
| 3 | `stage3-outline.md` | User outline edits | Customization questions |
| 4 | `stage4-customize.md` | User answers | Page generation plan |
| 5 | `stage5-generate.md` | Page-by-page review | Complete pages with content |
| 6 | `stage6-export.md` | Final approval | Validated JSON for ideas/<slug>.json |

---

## Implementation Files (New/Modified)

### New Files — Skill Core (Dual Copy)
```
.claude/skills/new-idea/
├── SKILL.md                      # Skill manifest
├── prompts/
│   ├── stage1-sector.md
│   ├── stage2-subsector.md
│   ├── stage3-outline.md
│   ├── stage4-customize.md
│   ├── stage5-generate.md
│   └── stage6-export.md
└── schemas/
    └── idea-file-format.json     # Validation schema

.agents/skills/new-idea/          # Identical copy for agent-native
├── SKILL.md
├── prompts/
└── schemas/
```

### New Files — Orchestrator & Bridge (engine/tools/)

These four files are the **execution layer** that makes the skill runnable. The skill definition (prompts, schemas, references) is passive — these files activate it.

| File | Responsibility | Key Functions |
|------|----------------|---------------|
| **new-idea-orchestrator.mjs** | **Core stage engine** — pure logic, no I/O side effects except state persistence | - `loadPrompt(stage)` — reads `prompts/stageN.md`<br>- `buildPrompt(stage, input, history)` — injects `{{sector}}`, `{{history}}`, etc.<br>- `validateOutput(stage, json)` — validates against `schemas/idea-file-format.json`<br>- `persistState(stage, data)` — writes `ideas/.work/new-idea-state.json`<br>- `runStage(stage, input)` — orchestrates: load → build → invoke agent → validate → persist |
| **new-idea-bridge-handler.mjs** | **File bridge daemon** — watches `ideas/inbox.json`, invokes orchestrator, writes `ideas/outbox.json` | - `watchInbox()` — `fs.watch('ideas/inbox.json')`<br>- `handleRequest(request)` → calls `orchestrator.runStage()`<br>- `writeOutbox(response)` — atomic write to `ideas/outbox.json`<br>- Runs as long-lived process: `node engine/tools/new-idea-bridge-handler.mjs` |
| **new-idea-cli.mjs** | **CLI entry point** — interactive terminal interface for agent sessions | - `parseArgs()` — handles `--resume`, `--stage`, `--force`, `--list-drafts`<br>- `promptUser(stage, questions)` — interactive `readline` prompts<br>- `loadDraft()` / `saveDraft()` — reads/writes `ideas/.work/new-idea-state.json`<br>- `runStageInteractive(stage)` — calls orchestrator, renders output, prompts for approval<br>- Entry: `node engine/tools/new-idea-cli.mjs [--resume] [--stage N]` |
| **new-idea-save.mjs** | **Save utility** — writes final validated JSON to `ideas/<slug>.json` | - `validateAndSave(bookJson)` — final schema validation<br>- `generateSlug(title)` — lowercase, hyphenated<br>- `writeIdeaFile(slug, json)` — atomic write to `ideas/<slug>.json`<br>- Called by orchestrator at Stage 6 export |

### Key Design Principles

1. **Orchestrator is pure** — no file watching, no CLI prompting, no bridge logic. Just: input → prompt → agent → validate → state.
2. **Bridge handler is the only file watcher** — single process owns `fs.watch`.
3. **CLI and Bridge share orchestrator** — same `runStage()` logic, different I/O adapters.
4. **State lives in `ideas/.work/new-idea-state.json`** — single source of truth for both entry points.
5. **Agent invocation** — orchestrator writes to `ideas/inbox.json`, bridge handler (or CLI) invokes the coding agent session, agent writes `ideas/outbox.json`.

### Agent Session Integration (`/new-idea` command)

**Why `/new-idea` is not available in this session yet:**
- The CLI entry point `new-idea-cli.mjs` **does not exist yet** (listed above as to-be-created)
- The orchestrator and bridge handler don't exist yet
- This session's coding agent can **simulate** the skill by manually following the prompts in `.claude/skills/new-idea/prompts/`, but the automated CLI command requires the `.mjs` files

**To enable `/new-idea` in future sessions:**
1. Create the 4 `.mjs` files above
2. Add to `package.json`: `"new-idea": "node engine/tools/new-idea-cli.mjs"`
3. The skill will then be invokable via `/new-idea` (if the agent runtime supports custom CLI commands) or `npm run new-idea`

### New Files — Web UI
```
webui/
├── components/
│   └── NewBookModal.js           # Modal component (ES6 module)
├── styles/
│   └── modal.css                 # Modal-specific styles
└── scripts/
    ├── idea-bridge.js            # File-bridge client for ideas/ (Web UI)
    └── stages/                   # Stage-specific UI logic
        ├── stage1-sector.js
        ├── stage2-subsector.js
        ├── stage3-outline.js
        ├── stage4-customize.js
        ├── stage5-generate.js
        └── stage6-export.js
```

### Modified Files
```
webui/
├── index.html                    # Add modal container div
├── scripts/app.js                # Initialize modal, wire "New Book" button
└── styles/main.css               # Import modal.css

package.json                      # Add scripts: "new-idea", "new-idea:bridge"
```

---

## Data Flow (Unified)

```
┌─────────────────┐     ┌──────────────────┐     ┌────────────────────┐
│  ENTRY POINT    │────►│  new-idea SKILL  │────►│  FILE BRIDGE       │
│                 │     │  (orchestrator)  │     │  (inbox/outbox)    │
│  • Web UI       │     │                  │     │                    │
│    "New Book"   │     │  1. Load prompt  │     │  ideas/inbox.json  │
│  • Agent CLI    │     │  2. Build prompt │     │  ideas/outbox.json │
│    /new-idea    │     │  3. Validate out │     │                    │
└─────────────────┘     │  4. Persist state│     └────────┬───────────┘
                        └────────┬─────────┘              │
                                 │                        │
                                 ▼                        ▼
                        ┌─────────────────┐     ┌─────────────────┐
                        │  STATE STORE    │     │  CODING AGENT   │
                        │                 │     │  (LLM Session)  │
                        │ ideas/.work/    │     │                 │
                        │ new-idea-state. │     │ Reads inbox     │
                        │ json            │     │ Builds response │
                        │                 │     │ Writes outbox   │
                        └─────────────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  OUTPUT         │
                        │ ideas/<slug>.json
                        │ (validated)
                        └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  PIPELINE       │
                        │ ideas-to-book   │
                        │ (next skill)    │
                        └─────────────────┘
```

---

## Running (Unified Commands)

Add to `package.json`:
```json
"scripts": {
  "new-idea": "node engine/tools/new-idea-cli.mjs",
  "new-idea:bridge": "node engine/tools/new-idea-bridge-handler.mjs",
  "new-idea:dev": "concurrently \"python -m http.server 3000\" \"npm run new-idea:bridge\""
}
```

### Important Notes

**`ideas/` folder:** Already exists at project root (`/c/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine/ideas/`). **Do not create another.** This is the only location for idea files — both input (existing `.md` files) and output (generated `.json` files).

**`/new-idea` CLI not available in this session:** The CLI entry point `engine/tools/new-idea-cli.mjs` (and its dependencies: orchestrator, bridge handler, save utility) **do not exist yet**. They are listed in the implementation files section above as to-be-created. This session can only **simulate** the skill by manually following the prompts in `.claude/skills/new-idea/prompts/`. To enable the actual `/new-idea` command, the 4 `.mjs` files in `engine/tools/` must be implemented first.

### Agent Session (CLI) — When Files Are Implemented
```bash
# Start new idea interactively
npm run new-idea

# Resume from last approved stage
npm run new-idea -- --resume

# Run specific stage
npm run new-idea -- --stage outline
```

> **Web UI development deferred** — not implementing modal/bridge components at this time.

---

## Error Handling

| Scenario | Handling |
|----------|----------|
| Agent timeout (30s) | Show "AI thinking..." spinner, retry button |
| Invalid JSON from agent | Fallback: show raw text, let user edit |
| File write failure | Toast notification, retry with different filename |
| User closes modal mid-flow | Draft auto-saved, resume on reopen |
| Skill validation fails | Show validation errors, allow manual fix |
| Agent session unavailable | Queue request, retry when agent available |

---

## Security / Permissions

- **No external API keys** — uses existing coding agent session
- **File system only** — `ideas/inbox.json`, `ideas/outbox.json`, `ideas/*.json`
- **Sandboxed** — bridge handler runs locally, no network exposure

---

## Future Enhancements

- **Voice input** for sector/sub-sector selection
- **Template gallery** — pre-built STEAM-IE books to fork
- **Collaborative editing** — multiple users in same modal via shared draft
- **Export to GitHub** — direct PR creation for book folder scaffold

---

## Success Criteria

- [ ] Modal opens/closes smoothly, centered, keyboard-accessible (Esc to close, Tab trap)
- [ ] All 6 stages flow correctly with AI responses
- [ ] Draft auto-saves and resumes
- [ ] Final JSON validates against `idea-file-format.json` schema
- [ ] Saved file appears in `ideas/` and can be used by `ideas-to-book` pipeline
- [ ] No external API calls; works offline with coding agent running