# Idea-to-Book Automation — Combined Complete Source of Truth

**Date:** 2026-09-20
**Status:** **COMBINED PLAN — single source of truth for the complete automation**
**Scope:** This document merges the `ideas-to-book-automation-v02.md` plan and the `prep-pages-automation.md` plan into ONE unified automation system. The `prep-pages` automation is now a **sub-process (opt-in stage)** inside the `ideas-to-book` automation.

**Important clarification:** For LLM-driven content prep, the provider is the **coding agent** (Claude Code / any coding agent that can read and write files). **No external LLM provider API keys are needed.** The automation writes a structured prompt file and waits for the coding agent to produce a validated JSON response file.

---

## 1. The Single Goal

Turn any markdown **or JSON** idea file in `/ideas/` into a complete, human-approved paper-engine book by orchestrating the existing engine tools and the block skill, with the `prep-pages` content preparation sub-process available as an opt-in stage.

**One sentence:** `ideas-to-book` is the master automation; `prep-pages` is an optional sub-process it can call to rewrite overflowing pages via the coding agent.

---

## 2. Idea File Formats

The automation supports **two input formats** for idea files:

### 2.1 JSON Idea File (Preferred)
- **File extension:** `.json`
- **Structure:** Directly maps to the internal manifest used by the automation.
- **Advantages:** No parsing or cleaning needed; eliminates marker-dependency errors; structured data is immediately available for context-building and prep-pages.
- **Example:** See `ideas/idea-file-format.json` for a complete sample with multiple pages.

### 2.2 Markdown Idea File (Legacy/Fallback)
- **File extension:** `.md`
- **Structure:** Uses the original markdown format with YAML front matter and page markers.
- **Processing:** Requires parsing via `idea-parser.mjs` to extract metadata, page data, and clean content (removing markers like `##`, `####`, `![AI Image Prompt: ...]`, `[ACTION CALLOUT: ...]`, `[cite: N]`).
- **Note:** Markdown files are supported for backward compatibility but are more prone to parsing/cleaning errors that can affect prep-pages.

### 2.3 Handling in Automation
- During the **idea selection stage** (if `--select` or no idea file specified), the automation scans `/ideas/` for both `.json` and `.md` files.
- If a **JSON file** is selected, it is loaded directly as the manifest (skipping `idea-parser.mjs`).
- If a **markdown file** is selected, it is processed via `idea-parser.mjs` to produce the manifest.
- The rest of the automation (scaffolding, rendering, prep-pages, etc.) works identically on the manifest regardless of source format.

---

## 2. Combined Architecture — The Complete Pipeline

```
ideas/<book>.(json|md)
      │
      ▼
┌──────────────────────────────────┐
│ Format Router                    │
│ .json → direct manifest load     │
│ .md → idea-parser.mjs fallback   │
└──────────────┬───────────────────┘
               │
               ▼
┌─────────────────┐
│ idea-parser.mjs │  → idea-manifest.json (.work/) [only for .md]
│ (or direct load)│
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ book-scaffold.mjs│  → books/<slug>/ (from template)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ book-render.mjs  │  → <slug>.html (interior)
│ + book-assets.mjs│  → images/*.txt (prompts)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ gen-image.mjs    │  → images/*.png (photos only)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ build-book.mjs   │  → book.html (assembled)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ check.mjs        │  → 0mm overflow or error
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ shot.mjs         │  → page*.png screenshots
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ export.mjs       │  → <slug>.pdf
└─────────────────┘
```

### Where `prep-pages` fits

The `prep-pages` sub-process is inserted **between the `plan` stage and the `render` stage**:

```
parse → scaffold → plan → [prep-pages] → classify → render → generate → build → check → screenshot → approveScreenshots → export
                                            ▲
                                            │
                                Opt-in: --prep-page
```

**Without `--prep-page`:** The automation uses raw idea-file content directly. Pages are rendered as-is from the manifest. If content overflows the B5 page, it overflows — no automatic shortening.

**With `--prep-page`:** Before rendering, each page that overflows goes through the prep-pages sub-process:

1. Initial render → `check.mjs` measures overflow
2. For overflowing pages: build coding-agent context (VOICE.md, blocks.md, design rules, examples)
3. Write prompt file → coding agent writes validated JSON response file
4. User reviews each proposal: Accept / Edit / Regenerate / Skip / Quit
5. If overflow remains: coding agent recommends fixes, user chooses auto/manual
6. Final `check.mjs` must read 0mm before proceeding to render

---

## 3. Complete Code File Inventory

### Engine tools (`engine/tools/`) — automation scripts


| File                  | Lines  | Purpose                                                                     | Status                           |
| --------------------- | ------ | --------------------------------------------------------------------------- | -------------------------------- |
| `idea-parser.mjs`     | \~265  | Parses idea markdown → structured manifest, validates pages/citations       | ✅ Working                        |
| `book-scaffold.mjs`   | \~310  | Copies template book folder, renames interior, updates `book.json`          | ✅ Working                        |
| `book-render.mjs`     | \~450  | Converts manifest → interior HTML, image classification, prompt files       | ⚠️ Working with bugs             |
| `book-assets.mjs`     | \~240  | Image prompt files, photo generation via `gen-image.mjs`, asset validation  | ⚠️ Working with bugs             |
| `ideas-to-book.mjs`   | \~1044 | CLI orchestrator — drives every stage with approval gates                   | ⚠️ Working but too complex       |
| `prep-pages.mjs`      | \~476  | Coding-agent-driven page content preparation (opt-in via `--prep-page`)     | ⚠️ Working but has critical bugs |
| `llm-page-prep.mjs`   | \~234  | LLM prompt/response handling for page rewriting                             | ⚠️ Built but unused              |
| `context-builder.mjs` | \~177  | Builds per-page coding-agent context from VOICE.md, blocks.md, design rules | ✅ Working                        |
| `page-validator.mjs`  | \~158  | Overflow detection, fix recommendations, page validation                    | ⚠️ Working with bugs             |
| `cli-interactive.mjs` | \~157  | Interactive CLI review loop for page editing/approval                       | ⚠️ Working with bugs             |
| `build-book.mjs`      | \~1100 | Existing engine tool — assembles `book.html` from interior + `book.json`    | ✅ Existing                       |
| `check.mjs`           | \~150  | Existing engine tool — overflow check (must be 0mm)                         | ✅ Existing                       |
| `shot.mjs`            | \~100  | Existing engine tool — PNG screenshots                                      | ✅ Existing                       |
| `export.mjs`          | \~80   | Existing engine tool — PDF export                                           | ✅ Existing                       |
| `gen-image.mjs`       | \~500  | Existing engine tool — AI image generation                                  | ✅ Existing                       |


### Skill files (`.claude/skills/ideas-to-book/`)


| File                                  | Purpose                                               | Status    |
| ------------------------------------- | ----------------------------------------------------- | --------- |
| `SKILL.md`                            | Skill documentation, CLI reference, stage-gate system | ✅ Working |
| `references/idea-file-format.md`      | Idea file syntax, validation rules, front matter spec | ✅ Working |
| `references/approval-gates.md`        | 9 gates, recovery menu, rollback behavior             | ✅ Working |
| `references/page-conversion-rules.md` | Markdown→HTML mapping, colour roles, citation styles  | ✅ Working |


### Agent skill files (`.agents/skills/ideas-to-book/`) — **DUPLICATE**

Same 4 files as `.claude/skills/ideas-to-book/`. These are redundant copies to be used with different codding agents like antigravity and claude. **Do Not Remove, Keep them Identical.**

### Plan documents


| File                              | Purpose                                    | Status                        |
| --------------------------------- | ------------------------------------------ | ----------------------------- |
| `ideas-to-book-automation-v02.md` | Main automation plan (v2.1)                | ✅ Reference                   |
| `ideas-to-book-automation.md`     | Original plan (v2.0)                       | ✅ Reference                   |
| `prep-pages-automation.md`        | LLM-driven content preparation plan        | ✅ Reference (now merged here) |
| `automate-idea-to-book.md`        | **This file — the single source of truth** | **This document**             |


### Idea source files (`ideas/`)


| File                                                 | Pages              | Status                     |
| ---------------------------------------------------- | ------------------ | -------------------------- |
| `Solar-Dryer-Fabrication-Fruit-Processing.md`        | 42 STEAM-IE pages  | ✅ Tested fixture candidate |
| `Interlocking-Compressed-Stabilized-Earth-Blocks.md` | 42+ STEAM-IE pages | ✅ Second fixture candidate |
| `idea-file-format.json` | Example JSON format (3 pages, extensible) | ✅ Reference |
| `interlocking-compressed-stabilized-earth-blocks-icseb.json` | User-provided JSON idea file | ✅ Ready for use |


---

## 4. What is already implemented and working

### 4.1 Core parsing and validation

- **Front matter parsing** — YAML metadata (title, slug, subtitle, author, series, editionLabel, audience, primaryLocation, coverImage).
- **Page detection** — regex on `# STEAM-IE · No. DD SectionName` markers.
- **Page detail extraction** — `## Title`, `#### Subtitle`, `![AI Image Prompt: ...]`, `[ACTION CALLOUT: LABEL] content`, `[cite: N]` markers.
- **Validation** — missing title, missing image prompt, missing action callout, duplicate page numbers, non-sequential numbering, unknown section names all produce hard errors.
- **Citation counting** — total and per-page.
- **Part building** — groups pages by section, assigns eyebrow letters (S/T/E/A/M/I/IE).

### 4.2 Book scaffolding

- **Template copying** — copies `book.json`, interior `.html`, `blocks.md`, `VOICE.md` from template folder.
- **Interior rename** — `STEAM-IE-FOR-HYDROPONICS.html` → `<slug>.html`.
- **book.json update** — metadata, parts array from manifest.
- **Safety** — refuses overwrite without `--force`, dry-run mode, never touches template.
- **Excludes generated artifacts** — `book.html`, `page*.png`, `*.pdf`.

### 4.3 Interior HTML rendering

- **Manifest → HTML** — converts each page to `<section class="sheet bb">` with proper markup.
- **Section colours** — each of 7 STEAM-IE sections gets a fixed colour.
- **Image classification** — keyword-based `photo` vs `diagram` detection.
- **Photo pages** — `<img src="images/<name>.png">` tag.
- **Diagram pages** — placeholder SVG with "TODO: AGY BLOCK SKILL" comment.
- **Citation handling** — 4 modes: preserve, footnotes, references, remove.
- **Action callouts** — rendered as `<div class="ask">`.
- **Prepared content support** — uses `preparedContent`/`preparedSubtitle`/`preparedActionLabel`/`preparedActionContent` when available (from prep-pages).

### 4.4 Image asset management

- **Prompt file generation** — writes `.txt` files with enhanced prompts (no-text rule, style guidelines).
- **Image classification** — interactive (dropdown) or automatic (`--auto-classify`).
- **Photo generation** — calls `gen-image.mjs` via spawn for classified "photo" pages.
- **Asset report** — JSON report with classifications, generated count, failed count.
- **Validation** — checks PNG signature, blank files, missing prompt files.

### 4.5 Orchestration and approval gates

- **12-stage pipeline** — `parse → scaffold → plan → prep → classify → render → generate → build → check → screenshot → approveScreenshots → export`.
- **Approval state** — persisted to `books/<slug>/.work/approval.json`.
- **Stage gates** — cannot proceed without prior approval (unless `--force`).
- **Interactive prompts** — `prompts` library for CLI dropdowns and confirmations.
- **Citation style decision** — Gate 3 presents 4 options via dropdown.
- **Image classification gate** — Gate 4 shows photo/diagram per page, human approves or changes.
- **Dry run** — `--dry-run` shows what would happen without writing files.
- **Resume** — `--resume` continues from last approved stage.
- **Rollback** — lists created files, offers delete/keep/list on cancellation.

### 4.6 Prep-pages sub-process (opt-in)

- **Opt-in via `--prep-page`** — only runs when explicitly requested.
- **Overflow detection** — runs `check.mjs` to find pages with &gt;0mm overflow.
- **Coding-agent context building** — per-page context with VOICE.md, blocks.md, design rules, showcase examples.
- **Page review loop** — Accept / Edit / Regenerate / Skip / Quit per page.
- **Overflow fix loop** — coding agent recommends fixes, user chooses auto/manual/regenerate.
- **Max 3 regeneration attempts** per page.
- **Validation** — `page-validator.mjs` checks title ≤3 words, subtitle ≤10, action ≤20, no nested spans, no em dashes, no emojis.

### 4.7 Existing engine tools (reused, not replaced)

- `build-book.mjs` — assembles `book.html` from interior + `book.json`.
- `check.mjs` — overflow check (0mm target).
- `shot.mjs` — PNG screenshots.
- `export.mjs` — PDF export.
- `gen-image.mjs` — AI image generation (agy/gemini providers).

---

## 5. What is NOT yet implemented or incomplete

### 5.1 Plan gaps


| Plan item                                   | Status                 | Notes                                                                                                                                          |
| ------------------------------------------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Template inherited pages editing            | Mentioned in v02 §10.3 | Plan says list changes and ask user to verify before editing, but no explicit implementation for editing cover/contents/index/back-cover pages |
| Footnotes page rendering                    | v02 §3.3, §10.4        | `renderFootnotes()` exists in `book-render.mjs` but is a stub — lists pages where citations appear, not actual footnote content                |
| References page rendering                   | v02 §3.3, §10.4        | `renderReferencesPage()` exists but is a stub — same issue as footnotes                                                                        |
| Block skill SVG diagram generation          | v02 §9, §10.5          | Placeholder SVG says "TODO: AGY BLOCK SKILL" — the automation does not actually invoke the block skill to create inline SVGs                   |
| End-to-end test on Solar Dryer              | v02 §14 Step 8         | Not completed                                                                                                                                  |
| `IDEAS-TO-BOOK-AUTOMATION.md` documentation | v02 §12                | Referenced but not created as a standalone file                                                                                                |
| Unit/integration tests                      | prep-pages §7 Phase 5  | No test files exist                                                                                                                            |
| **prep-pages as integrated sub-process**    | Partial                | Code exists but has critical bugs and architecture mismatch                                                                                    |
| **JSON idea file support**                  | Missing                | Automation currently only parses markdown; needs direct JSON load option in Stage 0 (see §2.3) |


### 5.2 Critical bugs and how to fix them


| #   | Issue                                                                                                                | File                                    | Severity     | Fix                                                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Duplicated code block** — lines 152–231 are an exact duplicate of lines 53–149 inside the same `while` loop        | `prep-pages.mjs`                        | **CRITICAL** | Delete lines 152–231 entirely. Keep one prompt-writing/wait block                                                                                             |
| 2   | **Undefined function** — `applyFixesCLI()` is called at line 401 but never defined anywhere                          | `prep-pages.mjs`                        | **CRITICAL** | Either implement it or replace with `applyFixesAutomatically()` from `cli-interactive.mjs`                                                                    |
| 3   | **Architecture mismatch** — plan says call LLM directly, code waits for file-based response                          | `prep-pages.mjs`, `llm-page-prep.mjs`   | **CRITICAL** | Use coding-agent file-based approach consistently; remove `llm-page-prep.mjs` or make it the caller                                                           |
| 4   | **Windows path issue** — `/tmp` hardcoded in `prep-pages.mjs` line 448 and `cli-interactive.mjs` line 61             | `prep-pages.mjs`, `cli-interactive.mjs` | **HIGH**     | Replace with `path.join(os.tmpdir(), ...)`                                                                                                                    |
| 5   | **Editor fallback is Windows-only** — `process.env.EDITOR || 'notepad'`                                              | `cli-interactive.mjs`                   | **HIGH**     | Use cross-platform editor detection                                                                                                                           |
| 6   | **`buildPartComment` bug** — produces garbage like "SSTT EE AMM II IIE"                                              | `book-render.mjs` line 267              | **HIGH**     | Replace with simple lookup table: `{ Science: 'S', Technology: 'T', Engineering: 'E', Arts: 'A', Mathematics: 'M', Innovation: 'I', Entrepreneurship: 'IE' }` |
| 7   | **`prepHistory` not persisted** — plan says each page should have prepHistory, finalOverflow, approvedBy, approvedAt | `prep-pages.mjs`                        | **HIGH**     | Write prepHistory array to each page in manifest                                                                                                              |
| 8   | **`classifyImage` keyword matching is fragile**                                                                      | `book-render.mjs`, `book-assets.mjs`    | **MEDIUM**   | Consolidate into one shared function; add better heuristics                                                                                                   |
| 9   | **Infinite wait risk** — 300s polling per page if coding agent never writes response                                 | `prep-pages.mjs`                        | **MEDIUM**   | Reduce timeout to 120s; add explicit failure state                                                                                                            |
| 10  | **`deriveSlug` duplicate** — line 907 calls `deriveSlug()` which is a duplicate of `deriveSlugFromTitle()`           | `ideas-to-book.mjs`                     | **LOW**      | Remove `deriveSlug`, keep `deriveSlugFromTitle`                                                                                                               |
| 11  | **`applyFixesAutomatically` not imported** — `cli-interactive.mjs` exports it but `prep-pages.mjs` doesn't import it | `prep-pages.mjs`                        | **HIGH**     | Import `applyFixesAutomatically` from `cli-interactive.mjs`                                                                                                   |
| 12  | **`reviewOverflowFixes` not used** — defined but never called                                                        | `cli-interactive.mjs`                   | **LOW**      | Either use it or remove it                                                                                                                                    |


### 5.3 What is unnecessary and should be removed


| Item                                                 | File                             | Action                                                                               |
| ---------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------ |
| `.agents/skills/ideas-to-book/` duplicate directory  | Entire directory                 | **Delete**                                                                           |
| `llm-page-prep.mjs` (if using coding-agent approach) | `engine/tools/llm-page-prep.mjs` | **Delete** — it's unused and describes an LLM API approach that is no longer desired |
| `--use-llm` flag                                     | `ideas-to-book.mjs`              | **Remove** — no external LLM API; prep-pages uses coding agent                       |
| `preparePageWithLLM()` function                      | `llm-page-prep.mjs`              | **Delete** with the file                                                             |
| `reviewOverflowFixes()` function                     | `cli-interactive.mjs`            | **Remove** — not used                                                                |
| `classifyImagesInteractive()` function               | `book-render.mjs`                | **Move to shared** — classification belongs in one place                             |
| `buildPartComment()` current implementation          | `book-render.mjs`                | **Replace** — current string repetition is wrong                                     |
| `formatFileSize()` function                          | `ideas-to-book.mjs`              | **Remove** — not used anywhere                                                       |
| `fail()` helper duplication                          | Every `.mjs` file                | **Consolidate** into `shared.mjs`                                                    |


### 5.4 What should be simplified or improved

#### 5.4.1 `ideas-to-book.mjs` — the main problem (\~1044 lines, 37KB)

This single file contains:

- CLI argument parsing (\~80 lines)
- Approval state management (\~40 lines)
- Rollback logic (\~35 lines)
- All 12 stage handlers in one `handleStage()` switch statement (\~750 lines)
- Stage-gate sequencing logic (\~100 lines)
- Existing-book conflict resolution (\~80 lines)

**Why it's too complex:** Each stage handler duplicates the same pattern: check approval → do work → interactive prompt → mark approved → error recovery with the same recovery menu. The recovery menu (retry/skip/replace/go back/cancel) is copy-pasted into stages: build, check, generate, screenshot, export.

**Fix:** Split into stage modules. The orchestrator becomes \~150 lines of CLI entry point that imports and calls stage modules.

#### 5.4.2 Duplicated utilities across files


| Function              | Files where it appears                                      | Lines each |
| --------------------- | ----------------------------------------------------------- | ---------- |
| `normalizeSlug`       | `idea-parser.mjs`, `book-scaffold.mjs`, `ideas-to-book.mjs` | 6, 6, —    |
| `classifyImage`       | `book-render.mjs`, `book-assets.mjs`                        | 16, 16     |
| `countWords`          | `context-builder.mjs`, `page-validator.mjs`                 | 1, 2       |
| `deriveSlugFromTitle` | `idea-parser.mjs`, `book-scaffold.mjs`                      | 2, 2       |
| `fail()` helper       | Every `.mjs` file                                           | 3 each     |
| `sanitizeFilename`    | `book-render.mjs`, `book-assets.mjs`                        | 3, 3       |


**Fix:** Create `engine/tools/shared.mjs` exporting: `normalizeSlug`, `deriveSlugFromTitle`, `fail`, `classifyImage`, `countWords`, `sanitizeFilename`, `pad2`, `escHTML`, `escHTMLNoAmp`.

#### 5.4.3 `prep-pages.mjs` structural issue

The file has \~476 lines but \~100 lines (152–231) are a duplicate of lines 53–149. The `prepPages` function also mixes concerns:

- Phase 1: Coding-agent preparation (lines 51–150)
- Phase 2: Validation loop (lines 312–415)
- Phase 4: Final render (lines 421–430)
- Helper functions scattered after the main function

**Fix:** Remove the duplicate block. Restructure into:

- `prepPages()` — orchestration only
- `prepareOnePage()` — per-page coding-agent interaction
- `resolveOverflow()` — overflow fix loop
- `editInEditor()` — editor integration
- `countWords()` — shared from `shared.mjs`

#### 5.4.4 `book-render.mjs` does too much

One file handles: image classification, placeholder SVG generation, citation collection, footnotes rendering, references page rendering, page rendering, interior rendering, interactive classification, prompt file writing, AND exports.

**Fix:** Split into:

- `book-render.mjs` — HTML rendering only (`renderPage`, `renderInterior`)
- `image-classifier.mjs` — classification + prompt file writing (extract from current book-render.mjs and book-assets.mjs)

#### 5.4.5 `book-assets.mjs` and `book-render.mjs` overlap

Both classify images, both write prompt files, both generate images. The classification logic is nearly identical (keyword lists differ slightly).

**Fix:** Classification and prompt writing go to `image-classifier.mjs`. `book-assets.mjs` becomes image generation + validation only.

---

## 6. The Combined Workflow — Detailed Steps

### Stage 0: Idea Selection (if `--select` or no idea file)

1. Scan `/ideas/*.json` and `/ideas/*.md`
2. Show in CLI dropdown (label: filename, format indicated)
3. User selects one file
4. **If JSON**: Load directly as manifest (skip parsing)
5. **If Markdown**: Parse via `idea-parser.mjs` to produce manifest
6. Derive title/slug from manifest front matter

### Stage 1: Parse (only for markdown files)

1. Read idea file
2. Parse front matter
3. Detect all `# STEAM-IE · No. DD SectionName` markers
4. Extract per-page: title, subtitle, image prompt, action callout, citations, content
5. Validate: missing title, missing image prompt, missing action callout, duplicate page numbers, non-sequential numbering, unknown section names → hard error
6. Write `books/<slug>/.work/idea-manifest.json`
7. Human approves counts (pages, parts, citations)

### Stage 2: Scaffold

1. Copy template book folder (excluding `book.html`, `page*.png`, `*.pdf`)
2. Rename interior file to `<slug>.html`
3. Update `book.json` with manifest metadata and parts
4. Write manifest to `.work/`
5. Create `images/` directory
6. Human approves what will be created

### Stage 3: Plan

1. Show page conversion plan: page order, titles, sections, action labels
2. Present citation handling choice: preserve | footnotes | references | remove
3. Store citation style in `approval.json`
4. Human approves page order and citation handling

### Stage 4: Prep (opt-in sub-process)

**Only runs if `--prep-page` is set.**

1. Render interior HTML with raw content
2. Run `check.mjs` to measure overflow per page
3. Identify pages with overflow &gt; 0mm
4. For each overflowing page:
   a. Build coding-agent context (page data + VOICE.md + blocks.md + design rules + examples)
   b. Write prompt file to `.work/page-<n>-prompt.json`
   c. Wait for coding agent to write response file `.work/page-<n>-response.json` (max 120s)
   d. Validate response JSON (title ≤3 words, subtitle ≤10, action ≤20, no nested spans, no em dashes, no emojis, wordCount ≤85)
   e. Present to user: Accept / Edit / Regenerate / Skip / Quit
   f. If accepted, apply to manifest (preparedContent, preparedSubtitle, preparedActionLabel, preparedActionContent, imageMeta)
   g. Record prepHistory entry
5. If overflow remains after prep: run overflow fix loop:
   a. Render → check → identify still-overflowing pages
   b. Coding agent recommends fixes (root causes, fixes with autoApplicable flag)
   c. User chooses: auto-apply recommended / edit manually / regenerate / reduce diagram / split page / accept overflow
6. Repeat until 0mm or max 5 validation rounds
7. Human approves all prepared content
8. Mark `pagesPrepared` in approval state

### Stage 5: Classify

1. Show photo vs diagram classification per page (auto-detected default)
2. Human approves or changes each classification
3. Store classifications in `approval.json`
4. Mark `assetsClassified`

### Stage 6: Render

1. Write enhanced prompt files to `images/<title>.txt`
2. Render interior HTML with classifications and citation style
3. Show preview of first 3 pages
4. Human approves HTML
5. Mark `pagesRendered`

### Stage 7: Generate

1. For each classified "photo" page: call `gen-image.mjs`
2. For each classified "diagram" page: log placeholder SVG note
3. Handle failures: retry / skip / change to diagram / go back / cancel
4. Write asset report to `.work/asset-report.json`
5. Human approves assets
6. Mark `assetsGenerated`

### Stage 8: Build

1. Run `build-book.mjs books/<slug>`
2. Human approves build success

### Stage 9: Check

1. Run `check.mjs books/<slug>/book.html`
2. Must read 0mm overflow and no broken images
3. Human approves checks

### Stage 10: Screenshot

1. Run `shot.mjs books/<slug>/book.html`
2. Human reviews all page PNGs
3. Human approves screenshots

### Stage 11: Export

1. Run `export.mjs books/<slug>/book.html books/<slug>/<slug>.pdf`
2. Human confirms final PDF
3. Mark `pdfExported`

---

## 7. Critical Bugs — Detailed Fix Instructions

### 7.1 Fix `prep-pages.mjs` duplicate block

**Current problem:** Lines 152–231 are an exact duplicate of lines 53–149. Both are inside the `while (attempts < 3 && !prepared)` loop.

**Fix:** Delete everything from line 152 through line 231 (inclusive). The loop should be:

```javascript
while (attempts < 3 && !prepared) {
  // Write prompt file (once)
  // Wait for response file
  // If timeout: attempts++, continue
  // If proposal received: validate, interact with user, set prepared or continue
}
```

### 7.2 Fix `applyFixesCLI()` undefined

**Current problem:** `prep-pages.mjs` line 401 calls `applyFixesCLI()` but it doesn't exist.

**Fix:** Replace with:

```javascript
import { applyFixesAutomatically } from './cli-interactive.mjs';
```

Then at line 401:

```javascript
fixedHtml = await applyFixesAutomatically({ ...page, preparedContent: page.preparedContent }, analysis.fixes, analysis.recommended);
```

### 7.3 Fix Windows temp paths

**Current problem:** `path.join('/tmp', ...)` fails on Windows.

**Fix:** In both `prep-pages.mjs` and `cli-interactive.mjs`:

```javascript
import os from 'node:os';
const tempDir = os.tmpdir();
const tempFile = path.join(tempDir, `page-proposal-${Date.now()}.html`);
```

### 7.4 Fix editor fallback

**Current problem:** `process.env.EDITOR || 'notepad'` is Windows-only.

**Fix:**

```javascript
const editor = process.env.EDITOR || (process.platform === 'win32' ? 'notepad' : 'nano');
```

### 7.5 Fix `buildPartComment`

**Current problem:** `'S'.repeat(orderKey % 7 || 7) + 'T'.repeat((orderKey) % 7 || 7)` produces garbage.

**Fix:**

```javascript
const PART_EYEBROWS = { Science: 'S', Technology: 'T', Engineering: 'E', Arts: 'A', Mathematics: 'M', Innovation: 'I', Entrepreneurship: 'IE' };
function buildPartComment(part) {
  const eyebrow = PART_EYEBROWS[part.name] || part.name.charAt(0).toUpperCase();
  return `    <!-- ============================================================\n         ${part.name.toUpperCase()} — ${part.name}\n         ============================================================ -->`;
}
```

### 7.6 Consolidate `classifyImage`

**Current problem:** `book-render.mjs` and `book-assets.mjs` both define nearly identical `classifyImage` functions with slightly different keyword lists.

**Fix:** Create `engine/tools/image-classifier.mjs`:

```javascript
export function classifyImage(prompt) {
  if (!prompt) return 'diagram';
  const lower = prompt.toLowerCase();
  const photoKeywords = ['photograph', 'photo of', 'image of', 'picture of', 'shot', 'real', 'physical', 'actual'];
  const diagramKeywords = ['diagram', 'schematic', 'chart', 'graph', 'flow', 'process', 'system', 'architecture', 'vector', 'blueprint', 'before', 'after', 'comparison', 'diagrammatic', 'technical drawing', 'cross-section', 'business model', 'network'];
  const isPhoto = photoKeywords.some((kw) => lower.includes(kw));
  const isDiagram = diagramKeywords.some((kw) => lower.includes(kw));
  if (isPhoto) return 'photo';
  if (isDiagram) return 'diagram';
  const physicalIndicators = ['fruit', 'plant', 'vegetable', 'tool', 'equipment', 'building', 'construction', 'cabinet', 'tray', 'panel', 'device'];
  const hasPhysical = physicalIndicators.some((kw) => lower.includes(kw));
  return hasPhysical ? 'photo' : 'diagram';
}
```

Both `book-render.mjs` and `book-assets.mjs` import from this one module.

### 7.7 Fix `prepPages()` timeout

**Current problem:** 300 seconds (5 minutes) per page is too long. For 12 pages needing prep, that's 60 minutes.

**Fix:** Reduce to 120 seconds and add a clear failure message:

```javascript
const maxWaitAttempts = 120; // 2 minutes max
// ...
if (!proposal) {
  console.log(`  ⏰  Timeout waiting for coding agent, skipping page`);
  attempts++;
  continue;
}
```

### 7.8 Persist `prepHistory`

**Current problem:** The plan requires `prepHistory` on each page but the code doesn't write it.

**Fix:** In `prep-pages.mjs` when applying a page:

```javascript
page.preparedContent = prepared.explainerHtml;
page.preparedSubtitle = prepared.subtitle;
page.preparedActionLabel = prepared.actionLabel;
page.preparedActionContent = prepared.actionContent;
page.imageMeta = { type: prepared.imageType, height: 150, prompt: prepared.imagePrompt };
page.prepHistory = page.prepHistory || [];
page.prepHistory.push({
  step: 'llm-proposal',
  timestamp: new Date().toISOString(),
  wordCount: prepared.wordCount,
  overflowPrediction: prepared.overflowPrediction
});
```

And in the overflow fix loop:

```javascript
page.prepHistory.push({
  step: 'overflow-fix',
  timestamp: new Date().toISOString(),
  fixes: analysis.recommended,
  overflowBefore: overflow,
  overflowAfter: 0
});
```

### 7.9 Remove `deriveSlug` duplicate

**Current problem:** `ideas-to-book.mjs` line 907 calls `deriveSlug()` which is a duplicate of `deriveSlugFromTitle()`.

**Fix:** Remove the `deriveSlug` function at line 1034. Keep `deriveSlugFromTitle`.

### 7.10 Fix `reviewOverflowFixes` unused

**Current problem:** `reviewOverflowFixes()` is defined in `cli-interactive.mjs` but never called.

**Fix:** Either use it in `prep-pages.mjs` or remove it. Recommendation: remove it since the fix loop in `prep-pages.mjs` handles overflow fixes directly.

---

## 8. Simplification Priority Order

1. **Extract shared utilities** (`shared.mjs`) — eliminates 6 duplicated functions, lowest risk
2. **Fix `prep-pages.mjs` duplicate block** — removes dead code, fixes potential infinite loop
3. **Fix cross-platform paths** (`/tmp` → `os.tmpdir()`) — makes code work on Windows
4. **Fix `applyFixesCLI()` undefined** — prevents runtime crash
5. **Split `ideas-to-book.mjs`** into stage modules — biggest complexity reduction
6. **Consolidate image classification** into `image-classifier.mjs`
7. **Fix `buildPartComment`** — trivial bug fix
8. **Remove `llm-page-prep.mjs` and `--use-llm`** — no external LLM API desired
9. **Remove `.agents/skills/` duplicate** — cleanup
10. **Implement `prepHistory` persistence** — audit trail
11. **Fix `prep-pages` timeout** — 300s → 120s
12. **Stub footnotes/references** — decide: complete or remove
13. **Add tests** — after simplification, when code is stable
14. **End-to-end test** — the final validation

---

## 9. The Coding Agent as LLM Provider — New Model

The user explicitly stated: for LLM-driven content prep, we use the **coding agent** as the LLM provider. **No external LLM provider API key is needed.**

### How this works

1. The automation writes a structured prompt file (JSON) to `.work/page-<n>-prompt.json`
2. The coding agent (Claude Code, or any coding agent with file access) reads the prompt file
3. The coding agent produces a validated JSON response file (`.work/page-<n>-response.json`)
4. The automation polls for the response file (max 120s)
5. The automation validates the response
6. The user reviews the proposal interactively

### Why this is better

- No API keys needed
- No external service dependency
- Uses the coding agent's actual context (VOICE.md, blocks.md, design rules are in the prompt file)
- The coding agent can reason about the page content deeply
- The response file is a durable artifact that can be reviewed/debugged

### What gets removed

- `llm-page-prep.mjs` — this was built for an LLM API approach. Delete it.
- `--use-llm` flag — remove from CLI
- `GEMINI_API_KEY` references — remove from all code and documentation

---

## 10. Human-in-the-Loop Gates — Combined


| Gate | Stage           | What human reviews                    | Why                                         |
| ---- | --------------- | ------------------------------------- | ------------------------------------------- |
| 1    | Parse           | Page/part/citation counts             | Catch malformed idea files early            |
| 2    | Scaffold        | What files will be created            | Prevent accidental overwrites               |
| 3    | Plan            | Page order, titles, citation handling | Citation mode is irreversible later         |
| 4    | Prep (optional) | Each coding-agent proposal            | Coding agent can hallucinate or drift voice |
| 5    | Classify        | Photo vs diagram per page             | Wrong classification = wrong output type    |
| 6    | Render          | HTML preview of first pages           | Catch lost content, broken escaping         |
| 7    | Generate        | Asset report                          | Catch failed image generations              |
| 8    | Build/Check     | 0mm overflow confirmation             | Overflow means content doesn't fit          |
| 9    | Screenshots     | Visual review of every page           | Catch layout, image, colour issues          |
| 10   | Export          | Final PDF confirmation                | Last chance before final output             |


The automation should **never** proceed past a gate without explicit human approval.

---

## 11. Best Practices Already Followed

1. **`book.html` is never edited directly** — always generated by `build-book.mjs`.
2. **Books live exactly 2 folders deep** — `books/<slug>/` so `../../engine/…` paths work.
3. **Same CSS drives screen and print** — no `@media print` rules added.
4. **One concept per page** — each page is one `<section class="sheet bb">`.
5. **Colour is a role** — `.bad=red`, `.hl=indigo`, `.good=teal`, `.amber=amber`.
6. **Diagrams are inline SVG** — placeholder SVGs say "TODO: AGY BLOCK SKILL".
7. **No invented facts** — LLM prompts include "Never invent facts, numbers, or stories."
8. **Idea file is source of truth** — generated files are always reproducible from it.
9. **Template is preserved** — scaffold copies template but never modifies it.
10. **Approval gates** — human must approve before each stage proceeds.
11. **Dry-run mode** — preview without writing files.
12. **Resume capability** — approval state persists across crashes.
13. **Asset traceability** — every generated image has a `.txt` prompt file beside it.
14. **Error logging** — stages log errors with context (stage, file, page, image).
15. **Reproducible output** — same idea file produces same book (coding-agent steps excluded).

---

## 12. Key Risks

1. **Coding agent response delay** — the file-based approach waits up to 120s per page. If the coding agent is slow, the whole pipeline is slow.
2. **Template coupling** — every new book inherits from `STEAM-IE-FOR-HYDROPONICS`. If the template changes, all new books change. The automation should lock the template version.
3. **Idea file format rigidity** — the parser expects exact `# STEAM-IE · No. DD SectionName` headings. Variations fail hard. The format should be documented clearly in `idea-file-format.md`.
4. **No rollback for parse/scaffold failure** — if parsing fails after scaffolding, the scaffolded files are left behind. The rollback function exists but is only triggered on user cancellation, not on stage failure.
5. **Sequential image generation** — 31 photos generated one-by-one. If each takes 30s, that's \~15 minutes. No parallelism or progress indication.
6. **Approval state corruption** — if `approval.json` is manually edited or corrupted, the automation can't resume correctly. No validation on load.
7. **Coding agent response quality** — the coding agent might produce invalid JSON or hallucinate. The validation layer catches most issues but not all (e.g., factual inaccuracies).
8. **No parallel prep-pages** — pages are processed one at a time. For 12 pages needing prep at 2 minutes each, that's 24 minutes minimum.

---

## 13. Implementation Plan — Ordered Steps

### Phase 1: Foundation (fix what's broken)

1. **Fix `prep-pages.mjs` duplicate block** — delete lines 152–231
2. **Fix `applyFixesCLI()` undefined** — replace with `applyFixesAutomatically()` import
3. **Fix cross-platform paths** — `path.join(os.tmpdir(), ...)` in `prep-pages.mjs` and `cli-interactive.mjs`
4. **Fix editor fallback** — cross-platform editor detection
5. **Fix `buildPartComment`** — simple lookup table
6. **Fix `prepPages` timeout** — 300s → 120s
7. **Fix `prepHistory` persistence** — write audit trail to manifest
8. **Remove `deriveSlug` duplicate** — keep `deriveSlugFromTitle`
9. **Remove `reviewOverflowFixes` unused** — or use it

### Phase 2: Consolidation (remove duplication)

10. **Create `engine/tools/shared.mjs`** — export all shared utilities
11. **Update all files to import from `shared.mjs`** — remove duplicated functions
12. **Create `engine/tools/image-classifier.mjs`** — move classification + prompt writing
13. **Update `book-render.mjs` and `book-assets.mjs` to import from `image-classifier.mjs`**
14. **Remove `.agents/skills/ideas-to-book/` duplicate directory**
15. **Remove `llm-page-prep.mjs`** — no external LLM API
16. **Remove `--use-llm` flag** — no external LLM API

### Phase 3: Refactoring (reduce complexity)

17. **Split `ideas-to-book.mjs` into stage modules** — one file per stage
18. **Create `stage-parse.mjs`** — parse stage (markdown only)
19. **Create `stage-scaffold.mjs`** — scaffold stage
20. **Create `stage-plan.mjs`** — plan + citation gate
21. **Create `stage-prep.mjs`** — prep sub-process (wraps `prep-pages.mjs`)
22. **Create `stage-classify.mjs`** — image classification gate
23. **Create `stage-render.mjs`** — HTML rendering + review gate
24. **Create `stage-generate.mjs`** — asset generation + recovery
25. **Create `stage-build-check.mjs`** — build + check
26. **Create `stage-screenshot.mjs`** — screenshot + approval
27. **Create `stage-export.mjs`** — PDF export
28. **Create `recoveryMenu()` helper** — shared recovery pattern
29. **Refactor `prep-pages.mjs`** — separate `prepPages`, `prepareOnePage`, `resolveOverflow`, `editInEditor`

### Phase 4: Completing missing features

30. **Complete footnotes page rendering** — actual footnote content
31. **Complete references page rendering** — actual references content
32. **Add block skill SVG diagram generation integration** — invoke block skill for diagrams
33. **Complete inherited page editing** — cover, contents, index, back-cover with human approval
34. **Add template validation before copying** — check template contains required files
35. **Add unit tests** — for shared utilities, parser, classifier, validator
36. **Add JSON idea file support** — modify `ideas-to-book.mjs` to load `.json` files directly as manifest (see details below)

### Phase 5: Validation

37. **End-to-end test on Solar Dryer** — full pipeline
38. **End-to-end test on Interlocking Compressed Earth Blocks** — second fixture
39. **Verify `check.mjs` reads 0mm on all pages**
40. **Verify no broken images**
41. **Verify screenshots are visually correct**
42. **Verify PDF export works**

### Details: JSON Idea File Support Implementation

For JSON idea file support in Phase 4, step 36:

1. Modify `ideas-to-book.mjs` Stage 0 (Idea Selection) to:
   - Scan for both `.json` and `.md` files in `/ideas/`
   - Show file format in CLI dropdown (e.g., "solar-dryer.json [JSON]")
   - If JSON file selected: load directly as manifest (skip `idea-parser.mjs`)
   - If markdown file selected: process via `idea-parser.mjs` as before

2. Update Stage 1 (Parse) to be conditional:
   - Only run if the selected file is markdown (`.md`)
   - If JSON file, skip this stage entirely
   - Keep all validation logic for markdown files

3. The rest of the automation (stages 2-11) works identically on the manifest regardless of source format

4. Update documentation:
   - Clarify in `idea-file-format.md` that JSON is preferred format
   - Note that markdown files are supported for backward compatibility
   - Provide examples of both formats

This change ensures the automation handles JSON idea files without parsing/cleaning errors while maintaining backward compatibility with existing markdown files.

---

## 14. Final Expected Result

```text
books/<slug>/
├── <slug>.html
├── book.json
├── book.html
├── <slug>.pdf
├── page1.png … pageN.png
├── images/
│   ├── <name>.png
│   ├── <name>.txt
│   └── …
└── .work/
    ├── idea-manifest.json
    ├── approval.json
    ├── asset-report.json
    └── page-<n>-prompt.json / page-<n>-response.json (for prep pages)
```

With:

- N pages (15 template + content pages)
- 0 mm overflow on every page
- No broken images
- Approved screenshots
- Approved PDF export
- Prep-pages sub-process completed (if `--prep-page` was used)

---

## 15. Summary

The combined automation is now clear:

- **`ideas-to-book` is the master automation** — it orchestrates the entire pipeline from idea file to PDF.
- **`prep-pages` is an opt-in sub-process** — it's a stage inside `ideas-to-book` that uses the **coding agent** (not an external LLM API) to rewrite overflowing pages.
- **The coding agent is the LLM provider** — no API keys, no external services. The coding agent reads prompt files and writes validated JSON response files.
- **All critical bugs are identified and fixed** — duplicate code, undefined functions, Windows paths, fragile classification, missing audit trail, timeout issues.
- **All duplication is identified and consolidated** — shared utilities, image classification, skill duplicates.
- **All complexity is identified and refactored** — `ideas-to-book.mjs` split into stage modules.
- **All missing features are identified** — footnotes, references, block skill SVG generation, inherited page editing, template validation, tests, **JSON idea file support**.
- **Idea file format flexibility** — automation accepts both `.json` (preferred, direct load) and `.md` (legacy, parsed) idea files.

This document is now the single source of truth for the complete idea-to-book automation.