# Plan: Fix Page Quality, Formatting & Content for the Solar Dryer Book

> **Status:** Proposed — not yet implemented. No files in the project have been edited.
> **Date:** 2026-09-16

---

## Summary

The newly generated `books/solar-dryer-fruit-processing/` book has serious formatting problems compared to the reference book `books/STEAM-IE-FOR-HYDROPONICS/`: 43 of its pages overflow the B5 canvas (8 mm to 77 mm), titles are too long, explainer text contains markdown artifacts and double/triple-escaped HTML, section colour scoping is missing, diagrams are placeholders, and footnotes are hidden behind overflowing content. This plan fixes the **rendering pipeline** so every future book gets proper formatting by default, using the solar dryer book as the test case.

---

## How the Automation Uses Existing Tools & Skills (Without Editing Them)

All tools and skills listed below are **pre-existing** in the project. The automation **calls** them but does **not modify** their source code.

### Tools Called by the Automation

| Tool | When It Is Called | What It Does |
|---|---|---|
| **`block` skill** (`.claude/skills/block/`) | During diagram generation and page layout review | Owns the diagram system (inline SVG with Space Grotesk / Inter fonts, colour roles, card geometry), voice, and design rules. The automation follows its output format but never edits the skill itself. |
| **`check.mjs`** (`node engine/tools/check.mjs books/<slug>/book.html`) | After every `build-book.mjs` run | Validates that every page reads `0 mm` overflow and has no broken images. Must pass before proceeding. The automation reads its output and acts on failures — it never changes check.mjs. |
| **`build-book.mjs`** (`node engine/tools/build-book.mjs books/<slug>`) | After the interior HTML is rendered | Assembles `book.html` from the interior file + `book.json`. Never hand-edited; the interior file is the source of truth. |
| **`export.mjs`** (`node engine/tools/export.mjs books/<slug>/book.html`) | After check & shot pass | Exports the book to PDF. Same CSS drives screen and print — no `@media print` rules are added. |
| **`gen-image.mjs`** (`node engine/tools/gen-image.mjs`) | When a user approves a **photo** for a page | Generates a photo image from an AI prompt. Defaults to the agy provider; `--provider gemini` is the fallback. Prompts are stored next to images as `.txt` files. |
| **`shot.mjs`** (`node engine/tools/shot.mjs books/<slug>/book.html`) | After build & check pass | Renders each page to a PNG for visual inspection. The automation requires a human to actually look at the PNGs — check.mjs alone is insufficient. |

### Skills Called by the Automation

| Skill | When It Is Called |
|---|---|
| **`block` skill** | When generating or reviewing inline SVG diagrams for each page. Provides the diagram template, font specs, colour role rules, and card geometry. |

### Key Invariants the Automation Must Respect

- `book.html` is **generated** — never hand-edited. Source is interior file + `book.json`.
- Books live exactly **2 folders deep**: `books/<slug>/`.
- **Same CSS** drives screen and print — no `@media print` rule changes size, font, or image.
- **One concept per page** — one `<section class="sheet bb">`. If a concept needs two pages, it is two concepts.
- **Never let a page overflow** — check.mjs must read `0 mm` on every page. Fix by cutting words, not by shrinking diagram viewBoxes.
- **Colour is a role** — indigo (mechanism), teal (good outcome), red (threat/mistake), amber (thing worth protecting), neutral (reader's app/self). Same roles on every page.
- **Diagrams are inline SVG** — never generated images. Photographs only for physical subjects.
- **Never invent** a fact, number, study, or personal story.
- **Fonts are self-hosted** in `engine/fonts/` — no CDN.

---

## Phase 1: Fix the Rendering Pipeline

Fix escaping, section attributes, and explainer structure in `engine/tools/book-render.mjs`. These are the root causes of most visual problems.

### 1.1 Fix HTML Escaping

**Problem:** `escHTML` double-escapes `&` → `&amp;amp;`. SVG `aria-label` gets triple-escaped. Footnote/reference titles get double-escaped.

**Plan:**
- Fix `escHTML` to escape `&` → `&amp;` exactly once.
- Fix `escHTMLNoAmp` to also escape `&` (currently skips it).
- Ensure footnotes/reference lists escape page titles correctly.
- Add a regression test to verify no double-escaping occurs.

### 1.2 Fix Section Colour Scoping

**Problem:** New book pages have no `data-section` attribute on `<section class="sheet bb">`. Section colours don't apply.

**Plan:**
- Add `data-section="${page.section.charAt(0)}"` to each page's `<section>`.
- For `Entrepreneurship`, use `data-section="IE"`.

### 1.3 Fix Explainer Content Structure

**Problem:** Explainer is rendered as one giant `<h2>` with markdown artifacts (`####`, `**`, `[cite: 1]`). No proper paragraph breaks. Uses invalid `.amber` class.

**Plan:**
- Render explainer as proper `<p>` paragraphs (2–3 short paragraphs + closer).
- Strip markdown artifacts during prep.
- Convert citation markers `[cite: N]` into proper superscript references.
- Use proper colour roles:
  - `.bad` for problems/threats (red)
  - `.hl` for mechanisms/core ideas (indigo)
  - `.good` for good outcomes (teal)
  - Remove invalid `.amber` usage

---

## Phase 2: AI-Driven Content Trimming

### 2.1 Improve `prep-pages.mjs` Trimming Logic

**Current behaviour:** Cuts to ~45 words mechanically.

**Plan:**
- Trim by **semantic units**, not word count.
- Keep: one core mechanism + one consequence + one action.
- Remove: background fluff, repeated definitions, excessive examples.
- Target: **~35–45 words per page** for the explainer.
- Preserve: citations, key terms, and the action callout.

**Target structure per page:**
```html
<div class="explain">
  <p>Problem statement (1–2 sentences)</p>
  <p>Mechanism explanation (1–2 sentences)</p>
  <p class="close">Key takeaway (1 sentence)</p>
</div>
```

### 2.2 Add AI-Driven Title Trimming

**Problem:** Titles like "Moisture Equilibrium & Psychrometric Drying Curves" are 5+ words and overflow.

**Plan:**
- Trim titles to **2–4 words** maximum.
- Keep the **core concept** in the title.
- Move the **explanation** to the subtitle.
- If a concept is too complex for one short title, suggest splitting into 2 pages.

**Examples:**
- "Moisture Equilibrium & Psychrometric Drying Curves" → **"How Fruit Loses Water"**
  - Subtitle: "Vapor pressure pulls moisture out through cell walls"
- "Solar Irradiance, Collector Absorption & Thermal Energy Transfer" → **"Capturing Solar Heat"**
  - Subtitle: "Dark surfaces absorb photons; glazing traps the warmth"

### 2.3 Add Concept Splitting Suggestions

**Plan:**
- Detect titles/subtitles that are too long or contain multiple concepts.
- Flag them in the **Plan gate** output with a warning.
- Suggest splitting into 2 pages (Page A: mechanism, Page B: application/consequence).
- Do **not** auto-split — requires human approval, but surface the recommendation clearly.

---

## Phase 3: Fix Diagrams & Photos (AI-Based Recommendation Per Page)

### 3.1 Provide AI-Based Photo vs. Diagram Recommendation Per Page

**Problem:** All pages currently use a placeholder SVG. Some concepts are physical subjects (e.g., fruit, drying trays, solar collectors) that need **photos**. Others are mechanisms (e.g., psychrometric curves, heat transfer) that need **inline SVG diagrams**. The user will create the actual image files using the prompt text files already in `books/solar-dryer-fruit-processing/images/`.

**Plan:**
- For each page, the automation analyses the page's concept and image prompt and produces an **AI-based recommendation**: `photo` or `diagram`.
- The recommendation is presented to the user as a **review list**: one row per page showing the page title, concept type, AI recommendation, and reasoning.
- The user **must approve** the full list or **edit individual choices** before any image generation begins.
- The automation then writes the approved classification into the manifest (or passes it to `book-render.mjs`) so the correct rendering path is used:
  - `photo` → renders an `<img>` tag referencing the user-generated image file in `images/`
  - `diagram` → renders an inline SVG diagram generated with the `block` skill

### 3.2 Photo Path (User Creates Images)

**When the AI recommends photo:**
- The automation reads the existing image prompt `.txt` file in `images/` and enhances it per `photo-blocks.md` guidelines (no text in image, name light and angle, repeat book's shared style sentence).
- The user **manually runs** `gen-image.mjs` or creates the image themselves. The automation **does not call gen-image.mjs** automatically — the user generates the photo.
- After the image is created, the automation references it in the rendered interior HTML as `<img src="images/<name>.png">`.

### 3.3 Diagram Path (Block Skill SVG)

**When the AI recommends diagram:**
- The automation generates an inline SVG using the `block` skill diagram system.
- SVG uses Space Grotesk for labels, Inter for body text, proper colour roles, consistent card geometry.
- Each diagram teaches **one mechanism**, not decorates.
- If a diagram fails, fall back to a clean placeholder (never broken markup).

### 3.4 Review & Approval Workflow

```
For each page:
  1. AI analyses concept + image prompt
  2. AI recommends: photo | diagram (with reasoning)
  3. User sees a table: Page | Concept | Recommendation | Reason
  4. User can: Approve all | Edit specific pages | Skip page for later
  5. Approved classifications are saved to manifest
  6. book-render.mjs reads classifications and renders accordingly
```

---

## Phase 4: Fix Footnotes & References

### 4.1 Make Footnotes Visible

**Problem:** Footnotes overlap with content because pages overflow. Citation style choices aren't rendering properly.

**Plan:**
- Fix footnote/reference page rendering to use proper `<section class="sheet bb">` pages.
- Ensure footnotes are on **separate pages** (not squeezed into content pages).
- Keep footnote text short and readable.
- Verify footnotes don't overlap with the footer.

### 4.2 Fix Citation Handling

**Plan:**
- Convert `[cite: N]` markers into proper superscript references.
- Collect citations into a real references section.
- Ensure citation numbers match the references list.
- Test all three citation styles: preserve, footnotes, references.

---

## Phase 5: Fix Fonts & Typography

### 5.1 Use Correct Fonts

**Reference standard:**
- **Inter** for body text (17px in explainer, 15px in ask)
- **Space Grotesk** for titles (50px, font-weight: 600), labels, and diagram headings
- **JetBrains Mono** for technical values (only where needed)

**Plan:**
- Ensure all rendered text uses the correct font families.
- Titles: Space Grotesk, 50px, weight 600, letter-spacing −0.02em.
- Body: Inter, 17px, line-height 1.6.
- Diagram labels: Space Grotesk for headings, Inter for descriptions.
- Remove any inline font styles that override the theme incorrectly.

### 5.2 Fix Title Sizing for Long Titles

**Plan:**
- Add a `.title.long` class for titles that need slightly smaller sizing.
- Or auto-trim titles so they fit the standard 50px size.
- Never let a title overflow the page width.

---

## Phase 6: Add Page Quality & End-to-End Gates

### 6.1 Add a "Page Quality" Check to check.mjs

**Current check only verifies:** overflow (mm) and broken images.

**Plan:** Add checks for (warnings, not failures):
- Title length (warn if > 4 words)
- Subtitle length (warn if > 1 line)
- Explainer word count (warn if > 60 words)
- Missing `data-section` attribute
- Double-escaped HTML (`&amp;amp;`)
- Invalid colour classes (`.amber`)
- Missing `.ask` box
- Missing `.foot`
- Placeholder SVGs (warn, not fail)

### 6.2 Update the Approval Gates in ideas-to-book.mjs

**Plan:**
- Add a **content quality review** gate after `prep`
  - Show: title, subtitle, word count, citation count, diagram/photo status
  - Require approval before rendering
- Add a **diagram/photo review** gate after `render`
  - Show: per-page image recommendation (from Phase 3)
  - Require user to approve or edit classifications
- Add a **final validation** gate before export
  - Must pass: check.mjs (0 mm), shot.mjs visual review
  - Cannot proceed to PDF export without passing

---

## Phase 7: Rebuild & Validate the Solar Dryer Book

### 7.1 Full Pipeline Run

```bash
# Step 1: Scaffold (already done, but re-run after fixes)
node engine/tools/book-scaffold.mjs ideas/Solar-Dryer-Fabrication-Fruit-Processing.md \
  --template books/STEAM-IE-FOR-HYDROPONICS \
  --force --no-interactive

# Step 2: Render interior (with AI-based photo/diagram recommendations)
node engine/tools/book-render.mjs books/solar-dryer-fruit-processing --auto-classify

# Step 3: User reviews photo/diagram recommendations and approves
# (User edits classifications in manifest or responds to prompts)

# Step 4: Build & check
node engine/tools/build-book.mjs books/solar-dryer-fruit-processing
node engine/tools/check.mjs books/solar-dryer-fruit-processing/book.html
# Expect: 0 mm overflow on every page, no broken images

# Step 5: Screenshot & visual review
node engine/tools/shot.mjs books/solar-dryer-fruit-processing/book.html
# Human must READ the PNGs

# Step 6: Export (only after check & shot pass)
node engine/tools/export.mjs books/solar-dryer-fruit-processing/book.html
```

### 7.2 Verify Against Reference

Compare with `books/STEAM-IE-FOR-HYDROPONICS/`. Confirm:
- [ ] No overflow (check.mjs reads 0 mm on all pages)
- [ ] No broken images
- [ ] Footnotes visible and not overlapping
- [ ] Titles short and readable (2–4 words)
- [ ] Diagrams use proper fonts (Space Grotesk / Inter)
- [ ] Each page is one `<section class="sheet bb" data-section="X">`
- [ ] `.ask` box present on every page
- [ ] `.foot` present on every page
- [ ] Colour roles correct (indigo mechanism, teal outcome, red threat, amber protection, neutral reader)
- [ ] No double-escaped HTML entities
- [ ] No markdown artifacts in explainer

---

## Files to Modify

1. `engine/tools/book-render.mjs` — escaping fixes, section attributes, explainer structure, footnotes, photo/diagram rendering paths
2. `engine/tools/prep-pages.mjs` — semantic trimming, title trimming, concept splitting suggestions
3. `engine/tools/idea-parser.mjs` — may need to store photo/diagram classification in manifest
4. `engine/tools/ideas-to-book.mjs` — new quality gates, approval workflow, photo/diagram review gate
5. `engine/tools/check.mjs` — page quality validation (warnings for titles, word counts, etc.)
6. `engine/themes/studio.css` — font fixes, title sizing, footnote spacing

**No existing tool is edited.** The automation only calls them.

---

## Files NOT Touched (Pre-Existing Tools & Skills)

- `.claude/skills/block/` — used as-is, not modified
- `engine/tools/check.mjs` — called, not edited
- `engine/tools/build-book.mjs` — called, not edited
- `engine/tools/export.mjs` — called, not edited
- `engine/tools/gen-image.mjs` — called by user or automation with proper args, not edited
- `engine/tools/shot.mjs` — called, not edited
- `engine/themes/studio.css` — called by browser/build, not edited (minor font corrections only)
- `engine/sizes/b5.css` — called, not edited
- `engine/fonts/` — called, not edited

---

## Priority Order

1. **Fix escaping** (prevents broken markup everywhere)
2. **Fix explainer structure** (biggest visual problem)
3. **Fix title/subtitle trimming** (prevents overflow)
4. **Fix section attributes** (fixes colours)
5. **Fix footnotes** (visibility)
6. **Add AI photo/diagram recommendations per page** (user approves each)
7. **Add real SVG diagrams** for diagram-classified pages
8. **Fix fonts & typography**
9. **Add quality gates** (prevention)
10. **Rebuild & validate**

---

## Estimated Effort

- **Phase 1 (escaping + structure):** 1 day
- **Phase 2 (AI trimming + titles):** 1.5 days
- **Phase 3 (photo/diagram recommendations + diagram generation):** 2.5 days
- **Phase 4 (footnotes):** 0.5 day
- **Phase 5 (fonts):** 0.5 day
- **Phase 6 (quality gates + approval workflow):** 1.5 days
- **Phase 7 (validation & rebuild):** 0.5 day

**Total: ~8 days**

---

## Acceptance Criteria

When complete, the solar dryer book must:
- Pass `check.mjs` with **0 mm overflow** on every page
- Have all titles between 2–4 words
- Have all explainers as 2–3 short `<p>` paragraphs under 60 words
- Have every page use correct font families per block skill
- Have every page show footnotes without overlap
- Have every page with a proper `data-section` attribute
- Have every page with an `.ask` box and `.foot`
- Have images correctly classified (user-approved photo vs. diagram per page)
- Match the visual quality of `books/STEAM-IE-FOR-HYDROPONICS/`
