## WebUI Analysis

### Current Architecture

**3-column dashboard layout** (sidebar, preview iframe, editor+chat) built with vanilla HTML/CSS/JS:

| File | Purpose |
|------|---------|
| `index.html` | Entry point — fixed menu bar, 3-col layout, iframe preview, editor form, AI chat |
| `scripts/app.js` | Single `DashboardApp` class (484 lines) — all logic: fixture loading, iframe rendering, page nav, editor sync, mock check/screenshot, mock chat |
| `styles/main.css` | 654 lines — CSS custom properties, 3-col grid/flex layout, responsive breakpoints, chat bubbles, theme colors matching engine roles |
| `data/fixture-showcase.json` | 10-page mock book with full content for offline development |
| `PLAN.md` | 14-phase implementation plan with 4 key architectural decisions documented |
| `webui-engine-reference-plan.md` | How to serve from project root so iframe `../engine/...` paths resolve |

### Key Components

1. **Menu Bar** — fixed header with book title, page nav (prev/next), check status pill, action buttons (Run Check, Screenshot, Export PDF)
2. **Left Sidebar** — book list (currently only "showcase" fixture), "New Book" button
3. **Central Preview** — iframe rendering `books/<slug>/<slug>.html` with engine CSS (`../../engine/sheet.css`, `b5.css`, `studio.css`, `sheet-tools.js`)
4. **Right Column (Editor)** — form fields for title, subtitle, explain, action; Save button
5. **Right Column (Chat)** — message history, input, quick-action buttons (Run Check, Suggest Diagram, Rewrite, Image Prompt) — **implemented in `index.html:75-88` and `app.js:307-362, 451-461`**

### Data Flow (Current Mock)

```
fixture-showcase.json → DashboardApp.fixture
    → renderBookList() → sidebar
    → selectPage() → renderIframe() (builds srcdoc HTML) + populateEditor()
    → runCheck() / takeScreenshot() → mock results from fixture
    → chat → keyword-matched mock replies
```

### Critical Design Decisions (from PLAN.md)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| AI chat transport | **File bridge** (`chat-inbox.json`/`outbox.json`) | Local-first, agent already has file access, zero server |
| Preview render | **Iframe** | Preserves `../../engine/...` invariant; matches Playwright screenshot exactly |
| Chat persistence | **File-based** (unified with transport) | Portable, debuggable, survives everything |
| Dark mode | **Dashboard only**, light default | Preview must stay print-accurate (light) |

---

## Improvement Ideas (No Code)

### 1. **Architecture & Separation of Concerns**
- **Split `app.js` into modules** per `PLAN.md`: `nav.js`, `preview.js`, `editor.js`, `chat.js` — currently everything in one 484-line class
- **Introduce event bus** (`EventTarget` or tiny pub/sub) — decouples sidebar selection from preview/editor/chat updates
- **State management** — single source of truth for `currentBook`, `currentPage`, `editedContent` instead of scattered `this.` properties

### 2. **Iframe Communication Protocol**
- Define a **formal `postMessage` API** between dashboard ↔ iframe:
  ```js
  // Dashboard → iframe
  { type: 'get-content', selector: '.title' }
  { type: 'set-content', selector: '.title', html: 'New Title' }
  { type: 'run-check' }
  // Iframe → Dashboard
  { type: 'content', selector: '.title', html: '...' }
  { type: 'check-result', overflow: 0, details: [] }
  ```
- Load `sheet-tools.js` in iframe (already done) — it can emit check results via `postMessage`

### 3. **Real Engine Integration (Phase 3+)**
| Mock | Real Implementation |
|------|---------------------|
| `loadFixture()` | Scan `books/` → read each `book.json` + `<slug>.html` → build page list |
| `renderIframe()` | `iframe.src = \`books/${slug}/${slug}.html\`` (not `srcdoc`) |
| `runCheck()` | `fetch('/api/check', {method:'POST', body:JSON.stringify({slug})})` → Node `check.mjs` |
| `takeScreenshot()` | `fetch('/api/shot', ...)` → Node `shot.mjs` → return PNG data URL |
| `saveChanges()` | PATCH `.html` file via `/api/save` (preserve other sections) |
| Chat | File bridge: write `chat-inbox.json`, poll `chat-outbox.json` |

### 4. **Editor Enhancements**
- **Block-level editing** — each `<section class="sheet bb">` is a page; editor should show all pages in book, not just current
- **Diff preview** — show before/after before saving
- **Validation** — enforce B5 constraints (word count, no `@media print`, color roles)
- **Keyboard shortcuts** — `Cmd/Ctrl+S` save, `ArrowLeft/Right` page nav

### 5. **Chat Improvements**
- **Streaming responses** — even with file bridge, append chunks as agent writes them
- **Context injection** — auto-include current page content, book.json, engine rules in every prompt
- **Tool calls display** — show when agent runs `check.mjs`, `shot.mjs`, edits files
- **Conversation branching** — "fork" a chat to try different diagram ideas

### 6. **Sidebar / Book Management**
- **Status badges** — compute by running quick check on each book (background worker)
- **Drag-drop reorder** — pages within a book
- **New page wizard** — scaffold `<section class="sheet bb">` with type (photo/diagram), category, placeholder content
- **Search/filter** — by title, category, status

### 7. **Preview Polish**
- **Zoom controls** — fit width, 100%, 150% (for detail work)
- **Overflow overlay** — visual red highlight on iframe elements that overflow (from `sheet-tools.js`)
- **Side-by-side** — show rendered page next to raw HTML (split view)
- **Print preview** — `@media print` simulation toggle

### 8. **Performance & DX**
- **Virtual scrolling** for book list (if 50+ books)
- **Debounced save** — auto-save draft to `localStorage` / temp file
- **Hot reload** — watch `books/**/*.html` → auto-refresh iframe
- **TypeScript** — add types for fixture, page data, message protocol

### 9. **Accessibility**
- ARIA labels on all controls (mostly there)
- Focus trapping in modals
- Keyboard navigation for chat history
- Screen reader announcements for check results

### 10. **Testing Strategy**
- **Unit tests** for `editor.js` (syncEditorToDOM, saveChanges), `nav.js` (book list filtering)
- **Integration test** — Playwright: load dashboard → select book → run check → verify "0 mm" badge
- **Visual regression** — compare iframe screenshot to golden master

---

## Recommended Next Steps (Priority Order)

1. **Serve from project root** (per `webui-engine-reference-plan.md`) — fixes iframe CSS 404s
2. **Modularize `app.js`** into `nav.js`, `preview.js`, `editor.js`, `chat.js` with shared `state.js`
3. **Implement iframe `postMessage` protocol** for real content editing
4. **Add `/api` endpoints** (Node/Express or Bun) for `check`, `shot`, `save`, `list-books`
5. **Wire file-bridge chat** — `chat-inbox.json` / `chat-outbox.json` + polling
6. **Replace fixture with real book scanner** — read `books/` dynamically
7. **Add responsive polish** — sidebar collapse, mobile layout refinements