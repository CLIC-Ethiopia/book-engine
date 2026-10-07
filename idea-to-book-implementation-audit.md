# Ideas-to-Book Automation: Implementation Audit

## Summary

The **core structure is implemented** — all 5 new scripts, the skill folder, the SKILL.md, the reference files, the package.json dependencies, and the implementation doc all exist and load cleanly. However, there are **17 spec gaps** ranging from minor to significant. Nothing is fundamentally broken, but ~40% of the spec's requirements are either missing or only partially covered.

---

## ✅ What IS implemented

| Spec requirement | File | Status |
|---|---|---|
| `idea-parser.mjs` — parse front matter, pages, citations, image prompts | [idea-parser.mjs](file:///C:/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine/engine/tools/idea-parser.mjs) | ✅ Complete |
| `book-scaffold.mjs` — copy template, rename interior, update book.json | [book-scaffold.mjs](file:///C:/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine/engine/tools/book-scaffold.mjs) | ✅ Complete |
| `book-render.mjs` — convert manifest to interior HTML | [book-render.mjs](file:///C:/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine/engine/tools/book-render.mjs) | ✅ Core done |
| `book-assets.mjs` — prompt files, image generation, asset report | [book-assets.mjs](file:///C:/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine/engine/tools/book-assets.mjs) | ✅ Core done |
| `ideas-to-book.mjs` — CLI orchestrator with stages | [ideas-to-book.mjs](file:///C:/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine/engine/tools/ideas-to-book.mjs) | ✅ Core done |
| Skill folder + SKILL.md | [SKILL.md](file:///C:/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine/.agents/skills/ideas-to-book/SKILL.md) | ✅ Complete |
| Reference files (approval-gates, idea-file-format, page-conversion-rules) | `.agents/skills/ideas-to-book/references/` | ✅ Present |
| package.json — `js-yaml`, `marked`, `prompts`, `execa` dependencies | [package.json](file:///C:/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine/package.json) | ✅ Installed |
| `npm run ideas` shortcut | [package.json](file:///C:/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine/package.json#L13) | ✅ Present |
| Approval state file (`approval.json`) read/write | [ideas-to-book.mjs](file:///C:/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine/engine/tools/ideas-to-book.mjs#L76-L115) | ✅ Working |
| Image classification (photo vs diagram) with keyword heuristic | [book-render.mjs](file:///C:/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine/engine/tools/book-render.mjs#L63-L78) | ✅ Working |
| Citation handling (4 options: remove, footnotes, references, preserve) | [ideas-to-book.mjs](file:///C:/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine/engine/tools/ideas-to-book.mjs#L200-L228) | ✅ Working |
| Placeholder SVG for diagram pages | [book-render.mjs](file:///C:/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine/engine/tools/book-render.mjs#L83-L90) | ✅ Working |
| `--dry-run`, `--skip-assets`, `--generate-assets`, `--force`, `--list-templates` flags | [ideas-to-book.mjs](file:///C:/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine/engine/tools/ideas-to-book.mjs#L350-L361) | ✅ Working |
| Implementation doc | [IDEAS-TO-BOOK-AUTOMATION-IMPLEMENTATION.md](file:///C:/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine/IDEAS-TO-BOOK-AUTOMATION-IMPLEMENTATION.md) | ✅ Present |

---

## ❌ Gaps — items that need coding

### Gap 1 — Missing `--stage <name>` single-stage execution (spec §5.2–5.8)

**Spec says:** `--stage parse`, `--stage scaffold`, `--stage render`, etc. should run only that one stage.

**Actual:** The `--stage` flag exists at [line 440](file:///C:/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine/engine/tools/ideas-to-book.mjs#L440-L442), but it reads all args after `--stage` as a list of stages. The stage names in the spec (`render`) don't match the implemented stage names (`plan`, `assets`). The spec's stage `render` maps to the code's combined `assets` stage, which does both classification AND HTML render. There is no separate `render` stage.

**Impact:** Medium. Users can't run the spec's documented CLI commands.

---

### Gap 2 — Missing `--resume` flag (spec §multi-book, line 143–148)

**Spec says:** `--resume` should resume from the last completed stage.

**Actual:** Resume logic exists (the "Resume from last approved stage" prompt at [line 423](file:///C:/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine/engine/tools/ideas-to-book.mjs#L423)), but only as an interactive prompt when an existing book is detected. There is no `--resume` CLI flag.

**Impact:** Low. Workaround exists (interactive prompt).

---

### Gap 3 — Missing `--idea` and `--template` named flags in orchestrator (spec §multi-book, line 130–133)

**Spec says:**
```
node engine/tools/ideas-to-book.mjs \
  --idea "Solar-Dryer-Fabrication-Fruit-Processing.md" \
  --template "books/STEAM-IE-FOR-HYDROPONICS"
```

**Actual:** The orchestrator accepts a positional idea file argument and has no `--idea` or `--template` named flag. The scaffold script does have `--template`.

**Impact:** Low. Positional arg works, but doesn't match documented CLI.

---

### Gap 4 — Missing `--slug` flag (spec §5.1)

**Spec says:** `--slug solar-dryer-fruit-processing` to override the derived slug.

**Actual:** Slug is always derived from the front matter. No override flag exists.

**Impact:** Low.

---

### Gap 5 — Orchestrator skips the `scaffold` stage dependency check (spec §7 state machine)

**Spec says:** The state machine enforces: PARSED → METADATA_APPROVED → PAGES_RENDERED → …

**Actual:** The `scaffold` stage at [line 152–163](file:///C:/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine/engine/tools/ideas-to-book.mjs#L152-L163) checks if scaffold was already approved but does NOT check if `parsed` was approved first. Only `plan` and `assets` check their predecessor.

**Impact:** Medium. Running stages out of order won't be caught.

---

### Gap 6 — Missing Gate 2 (Metadata approval) as a distinct stage (spec §4.2, Gate 2)

**Spec says:** After parsing, show proposed metadata (title, subtitle, author, series, edition label, cover, footer, part names) and get explicit approval before scaffolding.

**Actual:** The `parse` stage auto-approves after printing page counts. There is no metadata review gate between parse and scaffold.

**Impact:** Medium. Users can't review/edit metadata before the scaffold step commits it.

---

### Gap 7 — Missing Gate 5 (Page HTML review) as a distinct stage (spec §4.2, Gate 5)

**Spec says:** After rendering interior HTML, show a diff or page-by-page preview. The human verifies no content was lost, no facts invented, no citations disappeared, etc.

**Actual:** The `assets` stage generates the HTML and immediately marks it approved. There is no interactive review of the generated HTML before proceeding.

**Impact:** High. This is one of the spec's most important quality gates.

---

### Gap 8 — Missing Gate 6 (Asset generation review) as a distinct stage (spec §4.2, Gate 6)

**Spec says:** After generating images, show a summary ("Images generated: 31, Diagrams to author: 11, Missing: 0, Broken: 0") and get approval.

**Actual:** The `assets` stage marks both `assetsClassified` and `assetsGenerated` approved at [line 295–296](file:///C:/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine/engine/tools/ideas-to-book.mjs#L295-L296) without any interactive review prompt for the generated images.

**Impact:** Medium. Images are approved without review.

---

### Gap 9 — No error recovery with CLI dropdown (spec §12)

**Spec says:** On failure, present a CLI dropdown: retry / skip / placeholder / go back / cancel.

**Actual:** Errors are caught and logged, but the process either continues or exits. There is no recovery menu. Image generation failures at [line 286–287](file:///C:/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine/engine/tools/ideas-to-book.mjs#L286-L287) just print and move on.

**Impact:** Medium. Users must manually re-run on failure.

---

### Gap 10 — No rollback behavior (spec §12, "Rollback behavior")

**Spec says:** If the user cancels after scaffolding, list all created/modified files and ask whether to delete or keep as draft. Never delete outside the book folder.

**Actual:** The "Start fresh" option at [line 434](file:///C:/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine/engine/tools/ideas-to-book.mjs#L434) does `fs.rmSync(bookDir, { recursive: true })` — a full delete without listing files or asking "delete vs keep as draft". No rollback UI exists during mid-workflow cancellation.

**Impact:** Medium. Data loss risk on accidental "Start fresh".

---

### Gap 11 — `book-scaffold.mjs` renames from wrong path (bug)

**Actual:** At [line 228–239](file:///C:/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine/engine/tools/book-scaffold.mjs#L228-L239), it tries to rename `templateInterior` (the source template's file) rather than the copy inside `bookDir`. After `copyDirectoryRecursive`, the interior file is in `bookDir/STEAM-IE-FOR-HYDROPONICS.html`. The rename should target `bookDir/STEAM-IE-FOR-HYDROPONICS.html`, not `templatePath/STEAM-IE-FOR-HYDROPONICS.html`.

**Impact:** 🔴 **High (bug)**. This would rename the template's own HTML file, violating rule §10.3 "Preserve the template structure".

---

### Gap 12 — Missing `sourceFile`, `slug`, `template` in manifest metadata (spec §multi-book, line 152–160)

**Spec says:** The generated manifest should include `sourceFile`, `slug`, `template`.

**Actual:** `sourceFile` and `slug` are in the manifest. `template` is added by `book-scaffold.mjs` at [line 268](file:///C:/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine/engine/tools/book-scaffold.mjs#L268) but only after scaffolding, not by the parser itself. The orchestrator doesn't record template in the approval state's top-level metadata.

**Impact:** Low. Mostly cosmetic.

---

### Gap 13 — `approval.json` schema doesn't match spec (spec §4.1)

**Spec says:** `stages` values should be `"approved"` (string). `approvals` entries should include `"approvedBy": "human"`, `"at": "2026-09-12"`.

**Actual:** `stages` values are `true` (boolean). Timestamps are ISO 8601 with time (correct), but the key names differ from spec (e.g., `"buildPassed"` vs spec's `"buildChecked"`).

**Impact:** Low. Functionally equivalent but doesn't match spec's documented format.

---

### Gap 14 — No logging of every decision and action (spec §13, NFR)

**Spec says:** "The automation should log every decision and action."

**Actual:** Console output only. No persistent log file is written.

**Impact:** Low-Medium. Debugging workflow issues requires re-running.

---

### Gap 15 — `book-render.mjs` doesn't use the `classifyImage` export correctly from `book-assets.mjs`

**Actual:** Both `book-render.mjs` and `book-assets.mjs` have their own independent copy of `classifyImage`. The orchestrator at [line 25](file:///C:/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine/engine/tools/ideas-to-book.mjs#L25) imports `classifyImage` from `book-render.mjs` but never uses it directly — the assets stage reimports from `book-assets.mjs`. If classification rules are updated in one file but not the other, results will diverge.

**Impact:** Medium. Maintenance risk — two copies of the same function.

---

### Gap 16 — Part divider pages not generated (spec §10.3)

**Spec says:** Each new book inherits 15 template pages (6 front-matter pages + 7 part dividers + 1 index + 1 back cover) from the template.

**Actual:** `book-render.mjs` generates only content `<section>` pages. It outputs part comments (HTML comments) but not actual divider page `<section>` elements. The template's front-matter and divider pages would need to be preserved from the copied interior HTML. But the `assets` stage at [line 274](file:///C:/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine/engine/tools/ideas-to-book.mjs#L274) **overwrites** the copied interior file entirely with the rendered output, destroying the template's front-matter/divider/index/back-cover pages.

**Impact:** 🔴 **High (bug)**. The rendered book would have only content pages, missing the 15 inherited template pages (cover, colophon, contents, how-to-read, part dividers, index, back cover).

---

### Gap 17 — No `--approve-stage` flag (spec §6)

**Spec says:** `--approve-stage parse` to approve a stage from the command line.

**Actual:** Not implemented. Approval only happens via interactive prompts or auto-approval within each stage handler.

**Impact:** Low. Interactive prompts cover the use case.

---

## Priority-ordered coding plan

### Phase 1 — Fix bugs (must-do before any real use)

| # | Gap | What to do | Effort |
|---|---|---|---|
| 1 | **Gap 11** — scaffold renames template file | Change [line 228](file:///C:/Users/Frehun/Documents/Fad.Lab/ai/Fad-wiki-os/paper-engine/engine/tools/book-scaffold.mjs#L228) from `path.join(templatePath, ...)` to `path.join(bookDir, 'STEAM-IE-FOR-HYDROPONICS.html')`. Then rename that to `${slug}.html`. | 15 min |
| 2 | **Gap 16** — rendered HTML overwrites template pages | Refactor `book-render.mjs` to **merge** content pages into the copied template interior file instead of replacing it. Strategy: (a) Read the copied `<slug>.html` from the scaffolded book. (b) Find each part-divider `<section>` by its data attribute or comment. (c) Insert the rendered content pages after each divider. (d) Preserve the 6 front-matter sections and the index/back-cover. | 2–3 hours |

### Phase 2 — Add missing approval gates (core spec compliance)

| # | Gap | What to do | Effort |
|---|---|---|---|
| 3 | **Gap 6** — Gate 2 metadata approval | Add a `metadata` stage between `parse` and `scaffold`. Display all book metadata. Prompt for confirm. Store approval. | 45 min |
| 4 | **Gap 7** — Gate 5 HTML review | Split the `assets` stage: first render HTML (new `render` stage), then show a summary/diff of the output, prompt for approval. Only then proceed to `assets` (classification + generation). | 1 hour |
| 5 | **Gap 8** — Gate 6 asset review | After image generation in the `assets` stage, show summary (generated count, diagram count, missing, broken). Prompt for confirm before marking approved. | 30 min |
| 6 | **Gap 5** — Predecessor checks | Add `isApproved(bookDir, APPROVAL_STATE.PARSED)` check in `scaffold`. Add predecessor checks for `build`, `check`, `screenshot`, `export`. | 30 min |

### Phase 3 — CLI flag parity with spec

| # | Gap | What to do | Effort |
|---|---|---|---|
| 7 | **Gap 1** — `--stage` single-stage + rename stages | Align stage names with the spec (`parse`, `metadata`, `scaffold`, `render`, `assets`, `build`, `check`, `screenshot`, `approveScreenshots`, `export`). Make `--stage X` run exactly that one stage. | 45 min |
| 8 | **Gap 2** — `--resume` flag | Add `--resume` flag that reads `approval.json`, finds the first unapproved stage, and runs from there. | 30 min |
| 9 | **Gap 3** — `--idea` and `--template` named flags | Add argument parsing for `--idea <file>` and `--template <folder>` in the orchestrator. | 20 min |
| 10 | **Gap 4** — `--slug` override | Accept `--slug <value>` and use it instead of the derived slug. | 10 min |
| 11 | **Gap 17** — `--approve-stage` flag | Add `--approve-stage <name>` that marks a stage approved and exits. | 15 min |

### Phase 4 — Error recovery & safety

| # | Gap | What to do | Effort |
|---|---|---|---|
| 12 | **Gap 9** — Error recovery menu | Wrap each stage handler in a try/catch. On failure, present a `prompts.select` with: Retry / Skip / Placeholder / Go back / Cancel. | 1 hour |
| 13 | **Gap 10** — Rollback on cancel | On cancel, list all files created in `bookDir` since scaffold, prompt "Delete entire book folder / Keep as draft / Cancel". | 45 min |

### Phase 5 — Polish

| # | Gap | What to do | Effort |
|---|---|---|---|
| 14 | **Gap 15** — Deduplicate `classifyImage` | Move `classifyImage` to a shared util (e.g., `engine/tools/lib/classify.mjs`). Import from both render and assets scripts. | 20 min |
| 15 | **Gap 13** — Approval state schema alignment | Change `stages` values to `"approved"` strings. Align key names (`buildChecked` → `buildPassed`, etc.). | 15 min |
| 16 | **Gap 14** — Persistent log file | Add a write-append logger to `.work/automation.log` that records every action with timestamp. | 30 min |
| 17 | **Gap 12** — Template in manifest | Write `template` into the manifest at parse time (from CLI arg), not only after scaffolding. | 10 min |

---

## Estimated total effort

| Phase | Hours |
|---|---|
| Phase 1 — Bug fixes | ~3h |
| Phase 2 — Approval gates | ~2.5h |
| Phase 3 — CLI flags | ~2h |
| Phase 4 — Error recovery | ~1.75h |
| Phase 5 — Polish | ~1.25h |
| **Total** | **~10.5 hours** |

> [!IMPORTANT]
> **Phase 1 (Gaps 11 & 16) must be done first.** The scaffold rename bug would corrupt the template book, and the missing template-page merge means the rendered book would be incomplete (content pages only, no cover/dividers/index).
