---
title: Web UI Dashboard Plan — Paper Engine Code Engine
description: A dashboard web interface for the paper-engine book builder, providing live preview, page editing, navigation, and AI chat integration.
---

# Web UI Dashboard Plan

Access the web UI using cmd/powershell

```
   cd /c/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine
   python -m http.server 3000 --bind 0.0.0.0

```

Then open http://localhost:3000/webui/index.html.


## 1. Overview

This plan defines a web-based dashboard interface for the **paper-engine** project — a system that generates B5-format books (one concept per page) from structured HTML + JSON. The dashboard serves as a user-friendly front-end where:

- Authors can **navigate** between books (created & in-progress)
- Preview pages **live** as they are being written
- **Edit** page content (title, subtitle, body, action items)
- Interact with an **AI chat window** connected to the coding agent for assistance
- View and manage the book-building pipeline

The dashboard does **not** replace the command-line build loop (`build-book.mjs` → `check.mjs` → `shot.mjs`). Instead, it sits **on top** of it, providing a visual canvas for authoring and review.

## 2. Directory Structure (proposed)

```
webui/
├── index.html            # Entry point — hero + layout shell
├── styles/
│   └── main.css          # Layout, responsive, dark-mode friendly
│   └── sidebar.css       # Collapsed/expanded states
│   └── chat.css          # Chat window styling
├── scripts/
│   ├── app.js            # Main application bootstrap
│   ├── nav.js            # Navigation / book list management
│   ├── preview.js        # Live page rendering (calls build-book.mjs)
│   ├── editor.js         # In-page content editor
│   └── chat.js           # AI chat window (WebSocket / fetch to agent)
├── data/
│   └── books.json        # Auto-derived from `books/` folder metadata
│   └── page-state.json   # Currently selected page / editing state
└── assets/
    └── favicon.ico
```

> **Note**: The `data/books.json` is generated on-page load by scanning the `books/` directory for valid book sub-folders (each containing a `.html` and `book.json`).

## 3. Page Layout

The dashboard is a **three-column layout** that responds to screen width:

| Area | Width | Description |
|------|-------|-------------|
| **Hero** | Full-width (top) | Site title, tagline, quick-status badge (e.g. "Last build: 2 min ago"), "New Book" CTA |
| **Left Sidebar** | 180px (collapsible to icon-only) | Vertical navigation listing all books found in `books/`. Each book shows:<br>• Series name / cover thumbnail (first page)<br>• Status: "Ready", "In Progress", "Overflow"<br>• Quick link to "Preview" or "Edit" |
| **Central Column** | Main area (fills remaining space) | **Live preview** of the page currently selected in the sidebar. Renders `books/<slug>/<slug>.html` inside an iframe or `<div>` with the engine's CSS (engine/sheet.css, sizes/b5.css, theme/). A "Run Check" button triggers `check.mjs` and displays the overflow result (0 mm = good). |
| **Right Column** | 320px | **Two stacked sub-areas**:<br>• **Top** (240px): **Editable page content** — shows the raw markup of the selected page (title, subtitle, body text, action item, colours). An "Edit" mode toggles inline editing; changes are saved back to the `.html` file (via a PATCH-like call).<br>• **Bottom** (remaining height): **AI chat window** — a scrollable chat area connected to the coding agent. Sends user messages to the agent (via the same MCP/permissions context this session uses) and returns the agent's response. Includes a "Quick actions" bar: "Run check.mjs", "Run shot.mjs", "Export PDF". |

**Responsive behavior**:
- **Wide screens** (≥1200px): Three-column layout as described.
- **Medium screens** (768–1199px): Sidebar collapses to a fold-out menu (hamburger). Central + right columns stack vertically (central on top, chat on bottom).
- **Narrow screens** (<768px): Single-column layout: hero → sidebar (full-width, collapsed) → central column → right column (chat).

## 4. Key Features

### 4.1 Live Preview
- The central column renders the **interior file** (`books/<slug>/<slug>.html`) using the engine's CSS.
- A **"Run Check"** button executes `node engine/tools/check.mjs books/<slug>/book.html` and displays the result:
  - ✅ "0 mm on every page" — pass
  - ⚠️ "X mm overflow on page Y" — fail, with link to the offending page
- A **"Take Screenshot"** button runs `node engine/tools/shot.mjs books/<slug>/book.html` and displays the resulting PNG below the preview.

### 4.2 In-Page Editor
- When "Edit" is toggled, the right-column top area becomes an inline form:
  - **Title**: `<h1 class="title">` → text input
  - **Subtitle**: `<div class="sub">` → text input
  - **Body/Explain**: All `<p>` elements inside `<div class="explain">` → editable
  - **Action item**: `<div class="ask">` → text input
  - **Colour highlights**: `.bad` (red), `.hl` (indigo), `.good` (teal) — each has its own input for the emphasized phrase
- Changes are **saved** by overwriting the `.html` file in the `books/<slug>/` folder (preserving the rest of the markup).
- A **"Re-build & Check"** button runs the full loop automatically.

### 4.3 AI Chat Window
- The bottom area of the right column is a ** chat interface** connected to the coding agent.
- **Pre-filled prompts** (quick actions):
  - "Check this page for overflow"
  - "Suggest a diagram for this concept"
  - "Rewrite the explainer in simpler words"
  - "Generate an image prompt for this page's photo band"
- The chat uses the **same agent context** as this session (MCP or `/loop`), so the AI has awareness of the project's rules (B5 canvas, colour roles, no `@media print`, etc.).
- The chat window **preserves session state** — if the user leaves and returns, the conversation history is retained (via local storage or session).

### 4.4 Book Navigation & Status
- The left sidebar lists all books found in `books/`. Each entry shows:
  - Book title (from `book.json.title`)
  - Series label (from `book.json.series`)
  - "Status badge": computed by running a quick check on the book's pages
  - "New page" CTA that adds a new `<section class="sheet bb">` to the book's interior file
- Clicking a book loads its first page in the central preview column.

### 4.5 Dashboard Header (Hero)
- Site name / tagline
- **Quick stats**: number of books, total pages, last build timestamp
- **"Create new book"** modal: asks for a slug, copies the `starter/` scaffold, and adds a new entry to the book list.

## 5. Technology Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **HTML** | Static `index.html` | No build step required for the dashboard itself |
| **CSS** | Vanilla CSS (Flexbox + Grid) + `@media (prefers-color-scheme)` | Light/dark support, no React/CSS-in-JS overhead |
| **JS** | Vanilla ES6+ (`scripts/app.js`, etc.) | Keeps dependencies minimal; the engine already runs via `node` commands |
| **Book scanning** | `fs` readdir on page load | Generates the book list dynamically from the `books/` folder |
| **Page rendering** | `<iframe>` pointing at `books/<slug>/<slug>.html` with engine CSS URLs (`../../engine/…`) | Isolated rendering; the iframe inherits the engine's stylesheet path |
| **AI chat** | `fetch()` to this session's agent endpoint (or WebSocket if available) | Reuses the existing coding-agent context; no separate LLM setup |
| **Command execution** | `child_process.execSync` (Node) for `check.mjs` / `shot.mjs` | Runs the existing engine tools synchronously from the browser context |
| **Storage** | `localStorage` for chat history & edit drafts; no server backend needed | Zero-deployment friendly; works entirely offline |

## 6. User Flow ( typical workflow )

1. **Landing**: User opens `webui/` → hero shows quick stats → sidebar lists available books.
2. **Select a book**: User clicks "FadLab Book" (or another) in the sidebar.
3. **Preview page**: Central column shows the first page. The check-badge says "0 mm" (or overflow).
4. **Edit content**: User clicks "Edit" → right-column top area becomes a form. User updates the title, subtitle, or body text. "Save" writes the changes back to the `.html` file.
5. **Run check**: User clicks "Run Check" → badge updates. If overflow, user cuts words.
6. **Screenshot**: User clicks "Take Screenshot" → PNG appears below the preview.
7. **AI assistance**: User types in the chat window or uses quick-action buttons. Example: "The diagram on this page shows progressive overload — can you make the bars clearer?" The agent responds with SVG markup or prompts.
8. **Export**: User clicks "Export PDF" → `node engine/tools/export.mjs books/<slug>/book.html` generates a PDF.

## 7. Implementation Phases (suggested order)

| Phase | Deliverable | Key Files |
|-------|-------------|-----------|
| **P0 — Skeleton** | `index.html`, `main.css`, basic 3-col layout | `webui/index.html`, `webui/styles/main.css` |
| **P1 — Book discovery** | Scan `books/` → populate sidebar | `scripts/nav.js`, `data/books.json` |
| **P2 — Live preview** | Iframe render of a page + "Run Check" button | `scripts/preview.js`, central column logic |
| **P3 — In-page editor** | Editable form in right-column top, save back to `.html` | `scripts/editor.js`, inline edit logic |
| **P4 — AI chat** | Chat window with quick-action buttons, agent connection | `scripts/chat.js`, WebSocket / fetch to agent |
| **P5 — Polish** | Responsive breakpoints, dark mode, stats badges, export PDF button | `styles/responsive.css`, updated `scripts/` |

## 8. Non-Goals (out of scope for this plan)

- ❌ Replacing the CLI build loop (`build-book.mjs` → `check.mjs` → `shot.mjs`)
- ❌ A full-blown rich-text WYSIWYG editor (the dashboard edits **markup**, not formatted text)
- ❌ User authentication / multi-user support (single-user dashboard)
- ❌ Hosting the generated PDFs or images (those remain in `books/` and are gitignored)
- ❌ A separate backend / database the `data/` folder is derived entirely from the `books/` directory

## 9. Open Questions / Decisions Needed

1. **AI chat connection method** — Should the chat fetch from this session's agent via an MCP endpoint, or via a WebSocket that the user starts? The plan assumes we use the session's existing agent context, but the exact transport needs to be decided.
2. **Iframe vs. direct DOM render** — Rendering the page inside an `<iframe>` is safer (isolated stylesheets) but complicates communication (sending edits back). Direct DOM render is simpler but risks stylesheet path breakage (`../../engine/…` must be correct). **Decision needed.**
3. **Chat history persistence** — `localStorage` or in-memory? If the user closes the tab and reopens, should the chat history survive? **Decision needed.**
4. **Dark-mode styling** — The engine's `themes/studio.css` is light-mode–centric. Should the dashboard have its own dark-mode colors, or should it inherit the engine's theme? **Decision needed.**

## 10. Success Criteria

- [ ] Dashboard loads without errors on `localhost:3000` (or via `open index.html`)
- [ ] Sidebar lists all books found in `books/` correctly
- [ ] Clicking a book loads its first page in the preview column
- [ ] "Run Check" reports "0 mm on every page" for books that pass, or shows overflow details for those that don't
- [ ] "Take Screenshot" produces a PNG that matches what the user sees (at least for pages without overflow)
- [ ] Edit form saves changes back to the `.html` file and the preview updates accordingly
- [ ] AI chat sends a message and receives a response (using the project's agent context)
- [ ] Layout responds to resize: wide → three columns, medium → folded sidebar, narrow → single column

## 11. Detailed Analysis of the Four Decisions

---

### Decision 1: AI Chat Connection Method

**Options:**

| Option | How it works | Pros | Cons |
|--------|--------------|------|------|
| **A. Fetch to an MCP endpoint** | The dashboard makes `fetch()` calls to a local HTTP endpoint exposed by the coding agent (e.g., `http://localhost:3456/chat`). The agent's MCP server handles the request and returns the response. | • Clean separation: dashboard is a client, agent is a server<br>• Works across browser tabs / restarts<br>• Standard REST-like pattern | • Requires the agent to expose an HTTP server (extra setup)<br>• CORS / auth needed if accessed from different origins<br>• Adds a moving part (the server must be running) |
| **B. WebSocket started by the user** | User runs a command (e.g., `npm run chat-server`) that starts a WebSocket server. Dashboard connects via `new WebSocket('ws://localhost:8080')`. Messages flow bidirectionally. | • Real-time, low-latency<br>• Natural fit for streaming responses<br>• Can push "agent is thinking" / "tool call started" events | • More complex: connection lifecycle, reconnection, heartbeats<br>• Still needs a separate process running<br>• Overkill for request/response chat |
| **C. File-based bridge (simplest for this project)** | Dashboard writes user messages to a JSON file (e.g., `webui/data/chat-inbox.json`). A background Node script (or the agent itself via a hook) polls that file, sends to the agent, writes responses to `chat-outbox.json`. Dashboard polls the outbox. | • **Zero network setup** — works with just the file system<br>• The agent already has file access (it's the same session)<br>• Trivial to debug: open the JSON file and see the conversation<br>• No CORS, no ports, no server process | • Polling adds latency (200–500ms typical)<br>• Not "real-time" streaming — responses appear atomically<br>• Slightly unusual pattern, but fits the "local-first" ethos of this project |

**Recommendation: Option C (File-based bridge)**

**Justification for this project:**
- The paper-engine is **explicitly local-first, zero-deployment, deterministic**. It runs via `node` commands on the file system. Adding an HTTP/WebSocket server contradicts that philosophy.
- The coding agent (this session) **already has full file-system access** to the project. It can read `chat-inbox.json` and write `chat-outbox.json` directly — no extra process needed.
- The dashboard is a **single-user, single-tab tool**. Polling latency is imperceptible for a chat where responses take seconds anyway.
- Debugging is trivial: you can `cat webui/data/chat-inbox.json` and see exactly what the user sent.
- If later you want a "real" server, the file bridge is a drop-in replacement — just swap the transport layer.

---

### Decision 2: Iframe vs. Direct DOM Render

**Options:**

| Option | How it works | Pros | Cons |
|--------|--------------|------|------|
| **A. Iframe** | `<iframe src="books/<slug>/<slug>.html" sandbox="allow-scripts">` — the iframe loads the page with its own stylesheet links (`../../engine/sheet.css`, etc.). | • **Complete isolation**: dashboard styles never leak into the page, page styles never leak out<br>• The page renders **exactly as it would in production** — same CSS paths, same relative URLs<br>• `check.mjs` / `shot.mjs` operate on the same `book.html` the iframe shows | • Editing requires `postMessage` or `contentWindow` access to read/write the iframe's DOM<br>• Slightly more code for "get title text", "replace paragraph", etc.<br>• If the iframe fails to load (bad path), the preview is blank with no error in the parent |
| **B. Direct DOM render** | Fetch `books/<slug>/<slug>.html` as text, parse with `DOMParser`, inject the `<section class="sheet bb">` nodes into a `<div id="preview">` in the dashboard. Rewrite stylesheet links to absolute paths (`/engine/sheet.css`). | • Simple DOM API: `document.querySelector('#preview .title')` just works<br>• No cross-origin / sandbox friction<br>• Easy to attach click handlers, inline editing overlays | • **Stylesheet path rewriting is fragile**: `../../engine/…` must become `/engine/…` (or the dashboard must be served from a path that mirrors the book depth)<br>• Dashboard CSS can leak into the preview (e.g., a global `p { margin: 0 }` in the dashboard breaks page spacing)<br>• The preview is **not a true representation** of what `build-book.mjs` produces — it's a simulation |

**Recommendation: Option A (Iframe)**

**Justification for this project:**
- The **engine's core invariant** is: *"Books live exactly 2 folders deep: `books/<slug>/`, because every page links `../../engine/…`."* An iframe **preserves this invariant automatically** — the page loads exactly as it would in Chrome opened directly.
- `shot.mjs` uses Playwright to open `book.html` and screenshot it. If the iframe matches what Playwright sees, **what you preview is what you export**. Direct DOM render cannot guarantee that.
- The editing complexity is manageable: the dashboard only needs to read/write a **few known selectors** (`.title`, `.sub`, `.explain p`, `.ask`). A small `postMessage` protocol (e.g., `{type: 'get-content', selector: '.title'}` / `{type: 'set-content', selector: '.title', html: '...'}`) handles it cleanly.
- The iframe can be **sandboxed** with `allow-scripts allow-same-origin` — safe, but still lets the page's `sheet-tools.js` run (overflow badge).

---

### Decision 3: Chat History Persistence

**Options:**

| Option | How it works | Pros | Cons |
|--------|--------------|------|------|
| **A. `localStorage`** | On each message send/receive, `localStorage.setItem('chat-history', JSON.stringify(messages))`. On load, `JSON.parse(localStorage.getItem('chat-history') || '[]')`. | • Survives browser close / reload / tab close<br>• Zero backend<br>• 5–10 MB quota — plenty for text chat | • Tied to browser/device (not portable)<br>• Can be cleared by user or browser "clear site data"<br>• No sync across devices |
| **B. In-memory only** | `let messages = []` in `chat.js`. Lost on reload. | • Simplest code<br>• No privacy concerns (nothing written to disk)<br>• Fast | • **Reload = history gone** — frustrating for a tool where you might refresh the dashboard |
| **C. File-based (`webui/data/chat-history.json`)** | Same as the file bridge: dashboard writes the full history to a JSON file on each turn. On load, `fetch('data/chat-history.json')`. | • **Portable** — the file lives in the project (or `.gitignore`d)<br>• Survives everything: browser close, machine reboot, even `git clone` elsewhere<br>• Debuggable: open the file, see the conversation<br>• Works with the file-bridge pattern (Decision 1, Option C) | • Requires a tiny write endpoint (or the file-bridge script writes it)<br>• Slightly more I/O |

**Recommendation: Option C (File-based) — paired with Decision 1 Option C**

**Justification for this project:**
- If you use the **file bridge for chat transport** (Decision 1, Option C), the chat history file **is the transport**. The inbox/outbox files *are* the history. No separate persistence layer needed.
- The project already treats the file system as the source of truth (`books/`, `book.json`, `blocks.md`). Chat history fits that model.
- `webui/data/chat-history.json` can be `.gitignore`d (ephemeral) or committed (for project memory). Your call.
- Zero browser-specific API dependencies — works even if you open the dashboard in a minimal webview or Electron shell later.

---

### Decision 4: Light/Dark Mode Switch (Light Default)

**Recommendation: Add a toggle in the dashboard header (hero area), defaulting to light mode.**

**Implementation approach (no code yet — just the plan):**
- **CSS**: Define all dashboard colors as CSS custom properties on `:root` (light) and override under `[data-theme="dark"]` (or `@media (prefers-color-scheme: dark)` for auto-detect, but the toggle takes precedence).
- **Toggle UI**: A small button in the hero: `Light / Dark` (or a switch). Clicking it sets `document.documentElement.dataset.theme = 'dark'` (or `'light'`) and persists the choice in `localStorage.setItem('theme', 'dark')`.
- **Default**: Light mode. The engine's `themes/studio.css` is light-only, so the preview iframe will always be light — the toggle only affects the **dashboard chrome** (sidebar, editor, chat), not the page preview.
- **Why not sync with the iframe**: The preview must stay true to the book's output (which is light-only for print). Forcing dark mode on the iframe would misrepresent the printed page.

---

## 12. Can We Code the UI Without Connecting to the Core?

**Yes — absolutely.** Use `books/showcase/` as a **static fixture**:

| What the dashboard needs | How to fake it with `showcase/` |
|--------------------------|----------------------------------|
| **Book list** | `showcase/` has `book.json` + `showcase.html` (10 pages). The sidebar can list just this one "book" with its real metadata. |
| **Page preview** | Point the iframe at `books/showcase/showcase.html` — it loads perfectly with `../../engine/…` stylesheets. |
| **Editor form** | Parse `showcase.html`, extract the first `<section class="sheet bb">` ("Resting meat"), populate the editor fields (title, subtitle, explain paragraphs, ask). "Save" writes to a **copy** (e.g., `webui/data/showcase-edited.html`) — not the real file. |
| **Run Check / Screenshot buttons** | Wire them to **mock functions** that return canned responses (`{overflow: 0, pages: 10}` / a placeholder PNG). Later, swap in real `child_process.execSync` calls. |
| **AI chat** | Wire the chat to a **mock responder** that returns canned replies based on keywords ("overflow" → "Page 3 is 2 mm over", "diagram" → "Try a timeline shape"). Later, swap in the file bridge. |
| **New Book modal** | Show the modal, but "Create" just adds a dummy entry to the sidebar (no file copy yet). |

### What this gives you
- A **fully interactive dashboard** you can click through, resize, toggle dark mode, type in the editor, send chat messages — all with zero coupling to the engine's build tools.
- The **entire UI layer** (layout, responsive breakpoints, iframe messaging, editor form, chat UI, theme toggle) built and tested.
- When you're ready to connect, you replace **~5 mock functions** with real calls. The UI code doesn't change.

### Suggested mock data file
`webui/data/fixture-showcase.json`:
```json
{
  "book": {
    "slug": "showcase",
    "title": "The Showcase",
    "series": "The showcase",
    "pages": [
      {"title": "Resting meat", "category": "Cooking", "type": "photo"},
      {"title": "The bloom", "category": "Coffee", "type": "photo"},
      ...
    ]
  },
  "mockCheckResult": {"overflow": 0, "details": []},
  "mockScreenshot": "data:image/png;base64,...",
  "mockChatReplies": {
    "overflow": "Page 3 (Companion planting) is 2 mm over. Cut the closer sentence.",
    "diagram": "For 'Companion planting', use a 'Protection' diagram: hit → buffer → outcome.",
    "default": "I'm a mock. Replace me with the file bridge when ready."
  }
}
```

---

## 13. Summary of Recommendations

| Decision | Recommendation | Why |
|----------|----------------|-----|
| 1. Chat transport | **File-based bridge** (`webui/data/chat-inbox.json` / `chat-outbox.json`) | Matches project's local-first, zero-server philosophy; agent already has file access |
| 2. Preview render | **Iframe** | Preserves the engine's 2-folder-depth invariant (`../../engine/…`); preview = what Playwright screenshots = what prints |
| 3. Chat persistence | **File-based** (`webui/data/chat-history.json`) — unified with Decision 1 | Portable, debuggable, survives everything; fits the project's file-as-truth model |
| 4. Dark mode | **Toggle in hero, light default, dashboard-only** | Preview iframe stays light (print-accurate); dashboard chrome adapts |

---

## 14. Next Step

Build **Phase 0 (skeleton)** + **Phase 1 (book discovery using `showcase/` as the only book)** + **Phase 2 (iframe preview + mock check/screenshot)** + the **theme toggle**. All with mock data — **no engine coupling** until Phase 3+.