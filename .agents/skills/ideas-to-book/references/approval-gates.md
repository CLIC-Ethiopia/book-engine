# Approval Gates (ideas-to-book v2.1)

The workflow enforces **9 human approval gates**. The orchestrator (`ideas-to-book.mjs`) writes an approval state file at:

```
books/<slug>/.work/approval.json
```

Each gate requires explicit confirmation before the next stage runs. Stages can be re-run independently with `--force`.

---

## Gate 1 — Idea Parsing (`parse` stage)

**Trigger:** After `idea-parser.mjs` reads the idea file and writes `idea-manifest.json`.

**Presents:**
```
Book title: Solar Dryer for Fruit Processing
Pages detected: 42
Parts detected: 7
  Science (6), Technology (6), Engineering (6), Arts (6), Mathematics (6), Innovation (6), Entrepreneurship (6)
Action callouts detected: 42
Image prompts detected: 42
Citations detected: 143
```

**Prompt:**
```
Parse this idea into a book?
[y/N]
```

**On approval:** Writes `approval.json` with `parsed: true`.

**On rejection:** Stops. User must fix the idea file and re-run.

---

## Gate 2 — Metadata & Part Mapping (`scaffold` stage)

**Trigger:** After `book-scaffold.mjs` creates the book folder from template.

**Presents the proposed book metadata:**
- Title, subtitle, author, series, edition label
- Cover image path
- Footer brand / right text
- Part names and page counts
- Page titles in reading order

**Prompt:**
```
Approve book metadata and part mapping?
[y/N]
```

**On approval:** Writes `scaffolded: true` to approval state.

---

## Gate 3 — Page Conversion Plan (`plan` stage in orchestrator)

**Trigger:** Before HTML rendering. Shows the full page table.

**Presents:**
```
No. 01 Science       Moisture Equilibrium                 Action: MEASURE IT TODAY
No. 02 Science       Solar Irradiance                     Action: CALCULATE TODAY
No. 03 Science       Natural Convection                   Action: OBSERVE TODAY
...
No. 42 Entrepreneurship Cooperative Outgrower Model       Action: DESIGN THIS WEEK
```

**Prompts:**
1. `Approve page order, titles, parts, and action callouts? [y/N]`
2. **Citation handling** (if citations > 0):
   ```
   Found 143 citations. How should they be handled?
   1) Preserve as source markers (default)
   2) Convert to footnotes
   3) Create a references page
   4) Do not include citations
   ```

**On approval:** Stores `citationStyle` in approval state; writes `planned: true`.

---

## Gate 4 — Image & Diagram Classification (`assets` stage)

**Trigger:** Before HTML generation and image generation.

**Presents classification table:**
```
No. 01: diagram  (auto-detected: diagram) — "Diagram showing water activity curve..."
No. 02: photo    (auto-detected: photo)    — "Photograph of solar irradiance meter..."
No. 03: diagram  (auto-detected: diagram) — "Flowchart of natural convection..."
No. 04: photo    (auto-detected: photo)   — "Photograph of mango slices on trays..."
...
No. 42: diagram  (auto-detected: diagram) — "Business model network diagram..."
```

**Classification rules (hard-coded):**
- **Photo** — physical subjects: fruit, plant, tool, equipment, building, cabinet, tray, panel, device, finished product
- **Diagram** — mechanisms: process, airflow, heat transfer, equation, system, architecture, blueprint, cross-section, business model, network, before/after comparison

**Prompt:**
```
Approve classifications? (Press Enter to accept all, or type page numbers to change)
```

User can:
- Accept all
- Override individual pages (photo ↔ diagram)
- Reject and re-run after fixing prompts

**On approval:** Writes `assetsClassified: true`. Generates prompt files to `images/*.txt`.

---

## Gate 5 — Page HTML Review (`render` stage)

**Trigger:** After `book-render.mjs` produces `<slug>.html`.

**Presents:**
- Page count confirmation
- First 3 pages as preview (diff or rendered HTML)
- Citation handling applied
- Image placeholders vs `<figure class="photo">` tags

**Prompt:**
```
Review generated interior HTML. Continue to asset generation?
[y/N]
```

**On approval:** Writes `pagesRendered: true`.

**On rejection:** User can edit idea file and re-run `render`, or fix HTML directly and re-run `build`.

---

## Gate 6 — Asset Generation Review (`assets` stage — generation)

**Trigger:** After `book-assets.mjs --generate` runs.

**Presents asset report:**
```
Images generated: 31
Diagrams to author: 11
Missing images: 0
Broken images: 0
Blank images: 0
Invalid PNG signatures: 0
Prompt files written: 42
```

**Prompt:**
```
Approve generated assets before building?
[y/N]
```

**On rejection options:**
- Retry failed generations
- Replace specific images with placeholders
- Mark as diagram instead
- Continue with missing (placeholder SVG used)

**On approval:** Writes `assetsGenerated: true`.

---

## Gate 7 — Build & Check (`build` + `check` stages)

**Trigger:** After `build-book.mjs` and `check.mjs` complete.

**Runs:**
```bash
node engine/tools/build-book.mjs books/<slug>
node engine/tools/check.mjs books/<slug>/book.html
```

**Presents check results:**
```
Pages: 57
Overflowing: 0 mm (all pages)
Broken images: 0
Missing assets: 0
```

**Prompt:**
```
Build passed with 0 mm overflow. Continue to screenshots?
[y/N]
```

**On rejection:** User fixes overflow (cut words, adjust diagrams) and re-runs `build` + `check`.

**On approval:** Writes `buildPassed: true` and `checksPassed: true`.

---

## Gate 8 — Screenshot Review (`screenshot` + `approveScreenshots`)

**Trigger:** After `shot.mjs` generates PNGs.

**Runs:**
```bash
node engine/tools/shot.mjs books/<slug>/book.html
```

**User must visually inspect every page:**
- Cover
- Inside cover (if enabled)
- Colophon
- Contents (all parts)
- How to Read (if enabled)
- Every part divider (7)
- Every content page (42)
- Index
- Back cover

**Checks per page:**
- No text clipping
- No image cropping through subject
- Footer values correct (brand, edition, series)
- Colours match section
- Page numbers sequential
- Diagrams legible (no invisible text from inherited fill)
- Photos not distorted

**Prompt:**
```
Are all screenshots acceptable?
[y/N]
```

**On rejection:** User identifies issues, fixes source (HTML, CSS, images), re-runs `build` → `check` → `shot`.

**On approval:** Writes `screenshotsApproved: true`.

---

## Gate 9 — PDF Export (`export` stage)

**Trigger:** Only after Gate 8 approval.

**Runs:**
```bash
node engine/tools/export.mjs books/<slug>/book.html books/<slug>/<slug>.pdf
```

**Presents:**
```
✅ PDF exported: books/solar-dryer-fruit-processing/solar-dryer-fruit-processing.pdf
```

**Writes:** `pdfExported: true` to approval state.

---

## Approval State File

```json
{
  "slug": "solar-dryer-fruit-processing",
  "source": "ideas/Solar-Dryer-Fabrication-Fruit-Processing.md",
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
    { "stage": "parsed", "approvedBy": "human", "at": "2026-09-12T10:00:00Z" },
    { "stage": "scaffolded", "approvedBy": "human", "at": "2026-09-12T10:05:00Z" },
    ...
  ]
}
```

---

## Recovery at Any Gate

If a stage fails or is rejected, the orchestrator presents a **recovery menu**:

```
Stage 'assets' failed: gen-image exited with code 1 for "Solar Dryer Cabinet"

Options:
1) Retry this page
2) Skip this page (use placeholder)
3) Change classification to diagram
4) Go back to Gate 4 (re-classify)
5) Cancel — keep all progress so far
```

The approval state tracks completed stages, so a crash mid-way does not require starting from scratch. Use `--resume` to continue from the last approved stage.

---

## Rollback Behavior

If user cancels after scaffolding/rendering:
1. Lists all files created/modified
2. Asks: `Delete the new book folder entirely, or keep as draft?`
3. Never deletes files outside the new book folder
4. Never modifies the original idea file or template book