---
title: Better WebUI → Engine Reference Plan
description: How the standalone webui should reference the single engine folder without duplication
---

## The Problem

The web server serves `webui/` as the root directory, so `http://localhost:3000/` resolves to `/paper-engine/webui/`. The dashboard's iframe needs `../../engine/...` (engine CSS/JS) which lives at `/paper-engine/engine/` — one level **above** the web root. A static server will not serve paths that escape the web root, so the iframe CSS fails (404).

My earlier mistake was copying the whole `engine/` folder into `webui/`. That violates "one copy only" and doubles maintenance.

## Better Solution Options

### Option A (Recommended): Serve from the project root

Run the static server on the **project root** (`/paper-engine/`) instead of inside `webui/`:

```bash
cd /c/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine
python -m http.server 3000 --bind 0.0.0.0
```

Then open **`http://localhost:3000/webui/index.html`**.

**Why this is clean:**
- The web server root is `paper-engine/`, so `/engine/...` is served directly from the **single** engine folder.
- The iframe's relative paths (`../engine/sheet.css`, `../engine/sizes/b5.css`, `../engine/themes/studio.css`, `../engine/sheet-tools.js`) resolve correctly from the dashboard page URL:
  - Dashboard URL: `http://localhost:3000/webui/index.html`
  - `../engine/sheet.css` → `http://localhost:3000/engine/sheet.css` ✓
- `webui/` stays **fully standalone** — it references the engine, never duplicates it.
- The dashboard is at a nice URL: `http://localhost:3000/webui/...` (e.g. later `http://localhost:3000/webui/dashboard/...`).

**Result:** No code changes needed to `index.html`, `app.js`, or `main.css`. The iframe already references `../engine/...`, which is correct for the project-root web root. Just move the server up one level.

### Option B: Custom two-virtual-path server (if you want `/webui/` at the root)

If you insist on the dashboard being at `http://localhost:3000/` (not `http://localhost:3000/webui/`), run a small custom server that exposes the engine under a separate virtual path:

- Serve `./engine` at URL path `/engine/`
- Serve `./webui` at URL path `/`

```js
// webui/server.js (tiny Node + http)
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  let baseDir, localPath;
  if (req.url.startsWith('/engine/')) {
    baseDir = path.join(__dirname, '..', 'engine');
    localPath = path.join(baseDir, req.url.slice('/engine/'.length));
  } else {
    baseDir = path.join(__dirname);
    localPath = path.join(baseDir, req.url === '/' ? 'index.html' : req.url);
  }
  // ...serve file + type/encoding
});
server.listen(3000);
```

**Then** in `index.html` and `app.js`, change iframe paths from `../engine/...` to `/engine/...` (absolute).

**Pros:** Dashboard lives at `http://localhost:3000/`.
**Cons:** Adds a `webui/server.js` file (extra code to maintain) and requires path rewriting. More moving parts than Option A.

## Recommendation

**Use Option A.** It needs zero code changes:

1. Move the web server to the project root (`cd paper-engine`).
2. Open `http://localhost:3000/webui/index.html`.
3. Everything works as-is.

It keeps `webui/` isolated, references the engine exactly once, and uses only the static Python/Node server already available.

## Cleanup needed (once Option A is approved)

- Delete the duplicated `webui/engine/` folder (the 404 workaround copy).
- Restart the server from `paper-engine/` instead of `webui/`.
- Verify the iframe CSS loads (`http://localhost:3000/engine/sheet.css` → 200).
