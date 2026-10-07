---
name: ideas-to-book
description: Orchestrates the end‑to‑end workflow that turns a markdown idea file into a complete, reviewable, human‑approved paper‑engine book. The skill owns the stage‑gate system (parse, scaffold, plan, assets, build, check, screenshot, export) and delegates the heavy lifting to the dedicated automation scripts.
---
# ideas‑to‑book skill

This skill glues together the automation scripts:

- `engine/tools/idea-parser.mjs`   – extracts metadata, pages, citations, and image prompts from an idea markdown file.
- `engine/tools/book-scaffold.mjs` – copies a template book folder, renames the interior file, updates `book.json`.
- `engine/tools/book-render.mjs`   – builds the interior `<section class="sheet bb">` pages from the manifest, handling image classification (photo vs diagram).
- `engine/tools/book-assets.mjs`   – writes prompt files, generates photographs via `gen-image.mjs`, and produces an asset report.
- `engine/tools/ideas-to-book.mjs` – the CLI orchestrator that drives the workflow with human approval gates at each stage.

## When to invoke

Use this skill whenever the user asks for any of the following:

- "turn my idea file into a book"
- "create a new book from an idea in /ideas"
- "run the ideas‑to‑book automation"
- "parse this idea and scaffold the book"
- "generate images for my book"
- "render the interior pages"
- "build, check, screenshot, and export a book"
- "resume my book from the last approved stage"

## Typical usage

```bash
# List available idea files
node engine/tools/ideas-to-book.mjs --list-ideas

# Interactive selection then run the full pipeline
node engine/tools/ideas-to-book.mjs --select

# Run a specific stage (e.g., only parsing)
node engine/tools/ideas-to-book.mjs ideas/Solar-Dryer-Fabrication-Fruit-Processing.md --stage parse

# Dry run to preview what would happen
node engine/tools/ideas-to-book.mjs ideas/example.md --dry-run

# Force image generation even if previously skipped
node engine/tools/ideas-to-book.mjs ideas/example.md --generate-assets

# Resume from last approved stage
node engine/tools/ideas-to-book.mjs ideas/example.md --resume

# Run only specific stages
node engine/tools/ideas-to-book.mjs books/my-book --stage build check screenshot

# Approve a previous stage explicitly (for CI)
node engine/tools/ideas-to-book.mjs books/my-book --stage render --approve-stage plan
```

## CLI Reference

| Flag | Purpose |
|------|---------|
| `--list-ideas` | Scan `/ideas/*.md` and list available files |
| `--select` | Interactive dropdown to pick an idea file |
| `--dry-run` | Preview all actions without writing files |
| `--generate-assets` | Force photograph generation (override `--skip-assets`) |
| `--skip-assets` | Skip image generation entirely |
| `--force` | Re-run stages even if already approved |
| `--resume` | Continue from last approved stage in `approval.json` |
| `--stage <name>` | Run only specific stage(s): `parse`, `scaffold`, `plan`, `assets`, `build`, `check`, `screenshot`, `approveScreenshots`, `export` |
| `--approve-stage <name>` | Mark a previous stage as approved without prompt |
| `--template <path>` | Override default template (default: `books/STEAM-IE-FOR-HYDROPONICS`) |
| `--list-templates` | Show available template folders in `books/` |

## Stage‑gate system

The orchestrator writes an approval state file at:

```
books/<slug>/.work/approval.json
```

Each stage records a timestamp and who approved it. The orchestrator refuses to run a stage unless its predecessor is approved (unless `--force` is used).

### Stages (in order)

1. **`parse`** – reads the idea file and writes `idea-manifest.json`.
2. **`scaffold`** – copies the template folder, renames the interior file, updates `book.json`.
3. **`plan`** – shows page conversion plan; prompts for citation handling (`preserve|footnotes|references|remove`).
4. **`assets`** – writes prompt files, classifies each image as photo/diagram (Gate 4), generates photographs if approved, renders interior HTML (Gate 5).
5. **`build`** – runs `build-book.mjs` to produce `book.html`.
6. **`check`** – runs `check.mjs` to verify 0 mm overflow and no broken images (Gate 7).
7. **`screenshot`** – runs `shot.mjs` to capture PNGs of every page.
8. **`approveScreenshots`** – interactive prompt to confirm visual correctness (Gate 8).
9. **`export`** – runs `export.mjs` to create the final PDF (Gate 9).

### Approval State Keys

```json
{
  "stages": {
    "parsed": true,
    "scaffolded": true,
    "planned": true,
    "assetsClassified": true,
    "assetsGenerated": true,
    "buildPassed": true,
    "checksPassed": true,
    "screenshotsApproved": true,
    "pdfExported": true
  },
  "citationStyle": "preserve",
  "approvals": [
    { "stage": "parsed", "approvedBy": "human", "at": "2026-09-12T10:00:00Z" }
  ]
}
```

## Human approval gates (9 gates)

| Gate | Stage | What the human reviews |
|------|-------|------------------------|
| 1 | `parse` | Page/part/citation counts, validation summary |
| 2 | `scaffold` | Book metadata, part mapping, page titles in order |
| 3 | `plan` | Full page table, citation handling choice |
| 4 | `assets` (classify) | Photo vs diagram classification table |
| 5 | `assets` (render) | Generated interior HTML preview/diff |
| 6 | `assets` (generate) | Asset report: generated/missing/broken images |
| 7 | `build` + `check` | 0 mm overflow, no broken images |
| 8 | `screenshot` + `approveScreenshots` | Visual review of every page PNG |
| 9 | `export` | Final PDF confirmation |

If a stage is rejected, the orchestrator stops and invites the user to fix the issue before re‑running that stage.

### Recovery options (on failure or rejection)

```
1) Retry the current stage
2) Skip this page/image and continue
3) Replace with placeholder and continue
4) Go back to the previous approval gate
5) Cancel and preserve all progress so far
```

### Rollback behavior

If user cancels after scaffolding/rendering:
1. Lists all files created/modified
2. Asks: delete the new book folder entirely, or keep as draft?
3. Never deletes files outside the new book folder
4. Never modifies the original idea file or the template book

## Citation handling

The idea file may contain `[cite: N]` markers. At **Gate 3 (plan)** the user chooses:

1. **Preserve** — keep as literal `[cite: N]` (default)
2. **Footnotes** — convert to `<sup class="cite">[N]</sup>`; footnotes section TBD
3. **References page** — convert to `<sup class="cite">[N]</sup>`; references page TBD
4. **Remove** — strip all citations

Choice is stored in `approval.json` → `citationStyle` and passed to `book-render.mjs`.

## Image classification rules (hard-coded)

| Type | Keywords | Use For |
|------|----------|---------|
| **photo** | photograph, photo of, image of, picture of, shot, real, physical, actual | fruit, plant, tool, equipment, building, cabinet, tray, panel, device, finished product |
| **diagram** | diagram, schematic, chart, graph, flow, process, system, architecture, vector, blueprint, before, after, comparison, cross-section, business model, network | mechanisms, airflow, heat transfer, equations, system architecture, before/after |

**Never** generate diagrams as raster images. Use inline SVG only.

## Output locations

Given an idea file `ideas/my-idea.md` with front‑matter `slug: my-idea`:

```
books/
└── my-idea/
    ├── my-idea.html          ← interior source (rendered)
    ├── book.json             ← updated manifest
    ├── book.html             ← generated by build-book.mjs
    ├── my-idea.pdf           ← final export
    ├── page1.png … pageN.png ← screenshots
    ├── images/
    │   ├── my-idea-01.png
    │   ├── my-idea-01.txt
    │   └── …
    └── .work/
        ├── idea-manifest.json
        ├── approval.json
        └── asset-report.json
```

## Reference documents

- `references/idea-file-format.md` — front matter, page section syntax, validation rules
- `references/approval-gates.md` — 9 gates, recovery menu, rollback behavior
- `references/page-conversion-rules.md` — markdown→HTML mapping, colour roles, citation styles

## Extending the skill

- To change the default template, edit `DEFAULT_TEMPLATE` in `ideas-to-book.mjs`.
- To add new image‑classification rules, modify `classifyImage` in `book-render.mjs` and `book-assets.mjs`.
- To adjust the approval‑state keys, edit `APPROVAL_STATE` in `ideas-to-book.mjs`.
- To add a new stage, append to `STAGES` array and add a case in `handleStage()`.

## Implementation order (from spec)

1. `idea-parser.mjs` ✅
2. `approval.json` + stage system ✅
3. `book-scaffold.mjs` ✅
4. `book-render.mjs` ✅
5. Asset classification gate ✅
6. `book-assets.mjs` + `gen-image.mjs` integration ✅
7. Build/check/shot/export orchestration ✅
8. **End-to-end test on Solar Dryer idea** (pending)

## Final expected result (Solar Dryer)

```
books/solar-dryer-fruit-processing/
├── solar-dryer-fruit-processing.html
├── book.json
├── book.html
├── solar-dryer-fruit-processing.pdf
├── page1.png … page57.png
└── images/
```

With:
- 57 pages (15 template + 42 content)
- 0 mm overflow on every page
- No broken images
- Approved screenshots
- Approved PDF export