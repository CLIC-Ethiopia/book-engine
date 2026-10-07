---
title: Ideas-to-Book Automation
date: 2026-09-13
status: proposal
purpose: >
  Reusable workflow for turning every markdown idea file in /ideas into a
  complete, reviewable, human-approved paper-engine book.
version: 2.1
changelog: >
  v2.1 — Fixed heading hierarchy, typos, citation-handling wording,
  added prerequisites, error handling, rollback, idea-file format spec,
  validation rules, and non-functional requirements.
---

# Ideas-to-Book Automation

## Goal

Make writing a new book a repeatable, automated process with human approval
at every critical stage.

- The input is a markdown file in:

```text
ideas/<book-idea>.md
```

- The input file contains the following details for each of the pages that we will include in the book

    - Section title (for example: "STEAM-IE · No. 01 Science")
    - Page title
    - Page subtitle
    - AI Image Prompt for the given page
    - Page content paragraph(s)
    - ACTION CALLOUT

- The output is a complete book in:

```text
books/<slug>/
```

The system should work for every future idea file, not just the Solar Dryer
book. That means the book title, the number of pages in a book, the content of pages in the book, the images in the book, ... will be based on the input markdown file in "/ideas" folder that the user will select when prompted in a dropdown menu in the CLI. If a book for the selected idea file exists, the system should prompt the user for confirmation or to select another idea file from "/ideas" folder.

---

## Prerequisites

Before running the automation, confirm:

- The paper engine is installed and `npm install` has been run.
- `npx playwright install chromium` has been completed.
- The user has signed into the preferred image provider (`agy` or `gemini`).
- The `.env` file is present if `gemini` is required.
- The `/ideas` folder exists and contains at least one `.md` file.
- The template book (default: `books/STEAM-IE-FOR-HYDROPONICS`) exists and is up to date.
- The user has reviewed and approved this automation plan.

---

## Current state

The existing engine already provides the core tools:

```text
engine/tools/build-book.mjs
engine/tools/check.mjs
engine/tools/shot.mjs
engine/tools/export.mjs
engine/tools/gen-image.mjs
```

The existing `block` skill already handles page-level writing and design rules.

What is missing is the automation layer that turns an idea file into a
complete, reviewable book project with explicit human approval gates.

---

## Multi-book support and idea selection

The system must support every future markdown file in `/ideas`, not only the
Solar Dryer book.

### Startup behavior

When the automation starts, it should:

1. Scan `/ideas/*.md`.
2. Show the available idea files in a CLI dropdown menu.
3. Let the user select one file.
4. Read all book metadata, page count, page content, titles, subtitles,
   action callouts, citations, and image prompts from the selected file.
5. Derive the book slug from the selected file or its front matter.

### Existing book handling

Before creating or modifying anything, check whether:

```text
books/<slug>/
```

already exists.

If it exists, prompt the user to choose one of the following **options**:

- Resume the existing book
- Update/replace the existing book after confirmation
- Select another idea file
- Cancel

Never overwrite an existing book folder automatically.

### CLI commands

- List available idea files
```text
node engine/tools/ideas-to-book.mjs --list-ideas
```

- Open the interactive dropdown
```text
node engine/tools/ideas-to-book.mjs --select
```

- Use a specific idea file
```text
node engine/tools/ideas-to-book.mjs \
  --idea "Solar-Dryer-Fabrication-Fruit-Processing.md" \
  --template "books/STEAM-IE-FOR-HYDROPONICS"
```

- Preview without writing files
```text
node engine/tools/ideas-to-book.mjs \
  --idea "Solar-Dryer-Fabrication-Fruit-Processing.md" \
  --template "books/STEAM-IE-FOR-HYDROPONICS" \
  --dry-run
```

- Resume an existing book
```text
node engine/tools/ideas-to-book.mjs \
  --idea "Solar-Dryer-Fabrication-Fruit-Processing.md" \
  --resume
```

- Additional metadata to store

The generated manifest should include:

```json
{
  "sourceFile": "ideas/Solar-Dryer-Fabrication-Fruit-Processing.md",
  "slug": "solar-dryer-fruit-processing",
  "template": "books/STEAM-IE-FOR-HYDROPONICS"
}
```

This keeps every future book fully traceable to its selected idea file.

This makes the automation file-selection driven, reusable for every idea file,
and safe against accidental overwrites.

---

# Recommended automation architecture

## 1. Keep the existing tools

Do not replace the existing engine tools.

Reuse:

```text
engine/tools/build-book.mjs
engine/tools/check.mjs
engine/tools/shot.mjs
engine/tools/export.mjs
engine/tools/gen-image.mjs
```

Also keep the existing:

```text
.claude/skills/block/
```

The new system should orchestrate those tools, not duplicate them.

---

## 2. Create one new skill

Create a new skill such as:

```text
.claude/skills/ideas-to-book/
├── SKILL.md
├── references/
│   ├── idea-file-format.md
│   ├── approval-gates.md
│   └── page-conversion-rules.md
```

Suggested name:

```text
ideas-to-book
```

This skill should own the complete workflow:

1. Read an idea file from `/ideas`.
2. Parse it.
3. Produce a book manifest.
4. Ask for human approval.
5. Scaffold the book folder.
6. Convert the idea pages into interior HTML.
7. Generate or classify images.
8. Build the book.
9. Run checks.
10. Generate screenshots.
11. Ask for visual approval.
12. Export the PDF.

The existing `block` skill should remain responsible for page-level writing
and design rules. The new skill should be the **orchestrator**.

---

## 3. Create new automation scripts

I recommend four new scripts in:

```text
engine/tools/
```

### 3.1 `idea-parser.mjs`

#### Responsibility

Read:

```text
ideas/<book-idea>.md
```

and produce a structured manifest.

For the current Solar Dryer file, it should detect:

- Front matter metadata
- 42 STEAM-IE page sections
- Page numbers
- Part names
- Page titles
- Subtitles
- Image prompts
- Main content
- Action callouts
- Citations
- Markdown formatting

The current file contains:

```text
42 STEAM-IE pages
42 ACTION CALLOUT sections
42 image prompts
143 citation markers
7 parts
```

The parser should stop immediately if:

- A page number is missing
- A page number is duplicated
- A page has no title
- A page has no action callout
- A page has no image prompt
- A page belongs to an unknown part
- The page order is invalid

#### Output

For example:

```text
books/<slug>/.work/idea-manifest.json
```

The manifest should contain the complete structured representation of the book.

---

### 3.2 `book-scaffold.mjs`

#### Responsibility

Create the new book folder from the template.

Input:

```text
ideas/Solar-Dryer-Fabrication-Fruit-Processing.md
```

Template:

```text
books/STEAM-IE-FOR-HYDROPONICS/
```

Output:

```text
books/solar-dryer-fruit-processing/
```

#### What it should copy

Copy:

```text
book.json
STEAM-IE-FOR-HYDROPONICS.html
blocks.md
VOICE.md
```

Rename the interior file to:

```text
solar-dryer-fruit-processing.html
```

#### What it should not copy

Do not copy generated artifacts from the template:

```text
book.html
page*.png
*.pdf
```

Those should be regenerated for the new book.

#### Safety rules

The scaffold script must:

- Refuse to overwrite an existing book folder unless explicitly authorized
- Create a dry-run report first
- Show exactly what will be created
- Preserve the original template
- Never edit `book.html` directly

---

### 3.3 `book-render.mjs`

#### Responsibility

Convert the parsed idea manifest into the interior HTML file.

Input:

```text
books/<slug>/.work/idea-manifest.json
```

Output:

```text
books/<slug>/<slug>.html
```

#### Page conversion

For each idea page:

| Idea file content | Generated HTML |
|---|---|
| `STEAM-IE · No. 01 Science` | Eyebrow and part pill |
| `## Page title` | `<h1 class="title">` |
| `#### Subtitle` | `<div class="sub">` |
| Main markdown paragraphs | `<div class="explain">` |
| `[ACTION CALLOUT: LABEL]` | `<div class="ask">` |
| Image prompt | Image or diagram placeholder |
| Page number | Preserved for review and numbering |

#### Important image decision

The current ideas file has an image prompt for every page, but the project
rules say:

- Physical subjects should use photographs.
- Mechanisms, processes, and diagrams should be inline SVG.
- Diagrams must not be generated as raster images.

Therefore, the renderer must not blindly generate 42 images.

It should first classify each page as:

```text
photo
```

or:

```text
diagram
```

For example:

- Solar collector cross-section → diagram
- Dryer cabinet → diagram or photograph
- Fruit slices → photograph
- Business model network → diagram
- Packaging design → photograph or diagram depending on intent

This classification should be a human approval gate.

---

### 3.4 `book-assets.mjs`

#### Responsibility

Manage all image-related work.

It should:

1. Read the image prompts from the manifest.
2. Add the standard no-text rule.
3. Add the book-wide style sentence.
4. Generate photographs using `gen-image.mjs`.
5. Save each image in:

```text
books/<slug>/images/
```

6. Save each prompt beside its image as:

```text
images/<name>.txt
```

7. Produce an asset report.

#### Example output

```text
books/solar-dryer-fruit-processing/images/
├── cover.png
├── 01-moisture-equilibrium.png
├── 01-moisture-equilibrium.txt
├── 02-solar-irradiance.png
├── 02-solar-irradiance.txt
└── ...
```

#### Asset validation

The script should check:

- Every expected image exists
- Every image opens
- No image is blank
- No image has broken dimensions
- Every prompt file exists
- No generated image contains unreadable text
- The book has a consistent visual style

---

## 4. Add a human approval system

### 4.1 Approval state file

Create an approval state file such as:

```text
books/<slug>/.work/approval.json
```

Example:

```json
{
  "slug": "solar-dryer-fruit-processing",
  "source": "ideas/Solar-Dryer-Fabrication-Fruit-Processing.md",
  "stages": {
    "parsed": "approved",
    "scaffolded": "approved",
    "pagesRendered": "approved",
    "assetsClassified": "approved",
    "assetsGenerated": "approved",
    "buildChecked": "approved",
    "screenshotsReviewed": "approved",
    "pdfExported": "approved"
  },
  "approvals": [
    {
      "stage": "parsed",
      "approvedBy": "human",
      "at": "2026-09-12"
    }
  ]
}
```

The automation should not proceed to the next stage until the current stage
is approved.

### 4.2 Recommended approval gates

#### Gate 1 — Idea parsing

The system shows:

```text
Book title: Solar Dryer for Fruit Processing
Pages detected: 42
Parts detected: 7
Action callouts detected: 42
Image prompts detected: 42
Citations detected: 143
```

The human approves:

```text
Yes, parse this idea into a book.
```

#### Gate 2 — Metadata and part mapping

The system shows the proposed:

- Title
- Subtitle
- Author
- Series
- Edition label
- Cover image path
- Footer values
- Part names
- Page titles in order

The human approves the book metadata.

#### Gate 3 — Page conversion plan

The system shows a table like:

```text
No. 01 Science       Moisture Equilibrium...
No. 02 Science       Solar Irradiance...
No. 03 Science       Natural Convection...
...
No. 42 Entrepreneurship Cooperative Outgrower Model...
```

The human confirms:

- Page order
- Page titles
- Part assignments
- Action callout labels
- Citation handling

#### Gate 4 — Image and diagram classification

The system shows:

```text
No. 01: diagram
No. 02: diagram
No. 03: diagram
No. 04: photograph
...
```

The human approves or changes each classification.

This is one of the most important gates because generated images are
inappropriate for many technical diagrams.

#### Gate 5 — Page HTML review

The system generates the interior HTML and presents a diff or page-by-page
preview.

The human checks:

- No content was lost
- No facts were invented
- No citations disappeared
- No action callout was omitted
- No page was merged or split incorrectly
- HTML escaping is correct
- Special characters are preserved

#### Gate 6 — Asset generation review

The system shows:

```text
Images generated: 31
Diagrams to author: 11
Missing images: 0
Broken images: 0
```

The human approves the assets before building.

#### Gate 7 — Build and check

The system runs:

```bash
node engine/tools/build-book.mjs books/<slug>
node engine/tools/check.mjs books/<slug>/book.html
```

The human proceeds only if:

```text
overflowing: none
broken images: none
```

#### Gate 8 — Screenshot review

The system runs:

```bash
node engine/tools/shot.mjs books/<slug>/book.html
```

The human reviews:

- Cover
- Inside cover
- Colophon
- Contents
- How to Read
- Every divider
- Every content page
- Index
- Back cover

The human must explicitly approve the screenshots before PDF export.

#### Gate 9 — PDF export

Only after screenshot approval should the system run:

```bash
node engine/tools/export.mjs \
  books/<slug>/book.html \
  books/<slug>/<slug>.pdf
```

---

## 5. Proposed command-line interface

A single orchestration command would be easiest to use.

### 5.1 Dry run

```bash
node engine/tools/ideas-to-book.mjs \
  ideas/Solar-Dryer-Fabrication-Fruit-Processing.md \
  --template books/STEAM-IE-FOR-HYDROPONICS \
  --slug solar-dryer-fruit-processing \
  --dry-run
```

This should show:

- What will be created
- How many pages will be generated
- What metadata will be used
- Which files will be copied
- Which files will be generated
- Whether any destination already exists

No files should be changed during a dry run.

### 5.2 Parse and create manifest

```bash
node engine/tools/ideas-to-book.mjs \
  ideas/Solar-Dryer-Fabrication-Fruit-Processing.md \
  --template books/STEAM-IE-FOR-HYDROPONICS \
  --slug solar-dryer-fruit-processing \
  --stage parse
```

### 5.3 Scaffold the book

```bash
node engine/tools/ideas-to-book.mjs \
  books/solar-dryer-fruit-processing \
  --stage scaffold
```

### 5.4 Render pages

```bash
node engine/tools/ideas-to-book.mjs \
  books/solar-dryer-fruit-processing \
  --stage render
```

### 5.5 Generate assets

```bash
node engine/tools/ideas-to-book.mjs \
  books/solar-dryer-fruit-processing \
  --stage assets
```

### 5.6 Build and check

```bash
node engine/tools/ideas-to-book.mjs \
  books/solar-dryer-fruit-processing \
  --stage build
```

This stage should automatically run:

```bash
build-book.mjs
check.mjs
```

### 5.7 Generate screenshots

```bash
node engine/tools/ideas-to-book.mjs \
  books/solar-dryer-fruit-processing \
  --stage shot
```

### 5.8 Export PDF

```bash
node engine/tools/ideas-to-book.mjs \
  books/solar-dryer-fruit-processing \
  --stage export
```

---

## 6. Approval flags

Each stage should require approval.

Example:

```bash
node engine/tools/ideas-to-book.mjs \
  books/solar-dryer-fruit-processing \
  --stage render \
  --approve-stage parse
```

Or use an interactive prompt:

```bash
node engine/tools/ideas-to-book.mjs \
  books/solar-dryer-fruit-processing \
  --stage render \
  --interactive
```

The interactive mode should ask:

```text
The idea file has been parsed.
42 pages detected.
7 parts detected.
42 action callouts detected.
42 image prompts detected.

Approve this manifest and continue?
[y/N]
```

---

## 7. Recommended state machine

```text
DRAFT
  ↓
PARSED
  ↓
METADATA_APPROVED
  ↓
PAGES_RENDERED
  ↓
ASSETS_CLASSIFIED
  ↓
ASSETS_GENERATED
  ↓
BUILD_PASSED
  ↓
SCREENSHOTS_APPROVED
  ↓
PDF_EXPORTED
```

The automation should refuse to skip backward or forward without an explicit
approval.

---

## 8. What the new workflow should automatically do

### Automatic

- Read the idea file
- Parse front matter
- Detect page sections
- Validate page numbering
- Validate part names
- Count action callouts
- Extract image prompts
- Create the book folder from the template
- Rename the interior HTML file
- Generate `book.json`
- Generate interior HTML
- Generate image prompt files
- Run image generation
- Run the build
- Run overflow checks
- Generate screenshots
- Export the PDF

### Human approval required

- Confirm the parsed book metadata
- Confirm page order
- Confirm image versus diagram classification
- Confirm any citation handling
- Review generated page HTML
- Review generated images
- Review screenshots
- Approve final PDF export

---

## 9. The AI Image Prompt

The `ideas/*.md` file contains the entire content of the book structured in 7 STEAM-IE sections and multiple pages in each of these 7 sections.

For each page we have AI image prompt written inside a bracket as `![AI Image Prompt: Photograph of ... ]`.

- These AI image prompts should not be included in the pages of the book.
- These AI image prompts are to be used to generate photo for physical subjects for each page matching the content of the page.

The automation should work as follows:

1. Parse the prompt from the selected idea file.
2. Confirm that the page requires a photograph, not a diagram.
3. Save the prompt as: `books/<slug>/images/<page-name>.txt`
4. Add the standard rules to the prompt:
   - No text in the image
   - No logos or brands
   - Consistent book style
   - Clear lighting and background
5. Run `gen-image.mjs` using `--prompt-file`.

Example:

```text
node engine/tools/gen-image.mjs \
  --prompt-file "books/solar-dryer-fruit-processing/images/01-solar-dryer.txt" \
  "books/solar-dryer-fruit-processing/images/01-solar-dryer.png"
```

6. Save the generated image in `books/<slug>/images/`

7. Insert only the image into the book page:

`<img src="images/01-solar-dryer.png" alt="Solar fruit dryer with drying trays">`

The prompt itself is not shown in the book.

**Important classification rule**

Before calling `gen-image.mjs`, classify each visual:

- Physical object, tool, fruit, finished product → photograph
- Process, airflow, heat transfer, equation, system → inline SVG diagram

Do not use `gen-image.mjs` for technical diagrams.

**Recommended automated image workflow**

1. Parse `/ideas/<book>.md`
2. Extract each AI Image Prompt
3. Classify each prompt as photo or diagram
4. Ask the user to approve classifications
5. Write prompt files into the book's `images/` folder
6. Run `gen-image.mjs` for approved photographs
7. Inspect every generated image
8. Insert only approved images into the interior HTML

If an image fails or looks incorrect, the page remains pending. Then give the user a CLI dropdown option to retry image generation, replace the image with a placeholder, or continue to the next page.

---

## 10. Important design decisions

### 10.1 Keep Markdown as the source of truth

The file in:

```text
ideas/
```

should remain the master source.

The generated book files should always be reproducible from it.

### 10.2 Never edit `book.html`

The automation must treat:

```text
book.html
```

as generated output only.

It should never modify that file directly.

### 10.3 Preserve the template structure

Every new book we create based on a specific idea from `/ideas` folder always uses `books/STEAM-IE-FOR-HYDROPONICS` book as a starter template.

This means that each new book will have the following pages inherited from `books/STEAM-IE-FOR-HYDROPONICS` book.

```text
6 generated pages from cover page to the last page of contents, all pages before the Science section divider
7 part dividers one for each of the 7 STEAM-IE sections
1 index page before back cover page
1 back cover page
────────────────────────
15 pages total
```

Then we collect every page and corresponding contents from the selected idea `/ideas/*.md`.

For example, for the Solar Dryer book idea from `ideas/Solar-Dryer-Fabrication-Fruit-Processing.md`, the expected book structure is:

```text
6 generated pages before Science
7 part dividers
42 STEAM-IE content pages
1 index page
1 back cover page
────────────────────────
57 pages total
```

### 10.4 Handle citations deliberately

The idea file `/ideas/*.md` might contain multiple citation markers (for example: there are 143 citation markers in `/ideas/Solar-Dryer-Fabrication-Fruit-Processing.md`).

**The automation should NOT delete citation markers on its own.** Instead it should:

1. Detect all citation markers in the idea file.
2. Count them per page and total.
3. Present them to the user before any rendering or page conversion begins.
4. Ask the user to choose one of the following options via a CLI dropdown menu:

   1. Do not include citations in the book.
   2. Convert them into footnotes.
   3. Create a references page.
   4. Preserve them as source markers during drafting and resolve them later.

This should be a human decision before final export. Prompt the user to choose one of the options with a dropdown menu in the CLI before any further step.

### 10.5 Do not generate diagrams as images

The automation must classify each visual.

Use:

```text
photo
```

for physical subjects.

Use:

```text
inline SVG
```

for:

- Processes
- Airflow
- Heat transfer
- Business models
- Equations
- System architecture
- Before/after comparisons

This rule must remain hard-coded in the workflow.

---

## 11. Validation rules

The automation should validate at every stage:

### Idea file validation

- File exists and is readable
- Valid front matter (title, slug, subtitle, author, series, editionLabel)
- At least one page section
- Page numbers are sequential starting from 01
- No duplicate page numbers
- Every page has a title, subtitle, image prompt, content, and action callout
- Part names match the 7 STEAM-IE sections
- Action callouts are non-empty
- Citations are syntactically valid

### Book structure validation

- Book folder does not already exist (unless resuming)
- Template folder exists and is valid
- Page count in idea file matches manifest
- Part and page titles are unique
- Page order in `book.json` matches the idea file

### Image validation

- Every page marked "photo" has a generated image
- Every image has a corresponding prompt file
- No broken or blank images
- No unreadable text in generated images

### Build validation

- `check.mjs` reports 0 mm overflow on every page
- No broken images
- All required assets are present

---

## 12. Error handling and recovery

### Failure behavior

If any stage fails, the automation should:

1. Stop the current stage immediately.
2. Log the error with context (stage, file, page, image).
3. Update the approval state to reflect the failure.
4. Present the user with recovery options.

### Recovery options

For each failure, present a CLI dropdown:

- Retry the current stage
- Skip this page/image and continue (if applicable)
- Replace with placeholder and continue (if applicable)
- Go back to the previous approval gate
- Cancel and preserve all progress so far

### Partial completion

The automation should support resuming from the last successful stage.

The approval state file tracks completed stages, so a crash mid-way does not
require starting from scratch.

### Rollback behavior

If the user chooses to cancel after scaffolding or rendering, the automation
should:

1. List all files that were created or modified.
2. Ask whether to delete the new book folder entirely or keep it as a draft.
3. Never delete files outside the new book folder.
4. Never modify the original idea file or the template book.

---

## 13. Non-functional requirements

- The automation should run offline where possible.
- The automation should not depend on external services except image generation.
- The automation should produce reproducible output from the same idea file.
- The automation should log every decision and action.
- The automation should never silently modify source files.
- The automation should preserve the original template book unchanged.
- The automation should be testable stage by stage.

---

## 14. Recommended implementation order

Build the automation in this order:

### Step 1 — Parser

Create and test:

```text
idea-parser.mjs
```

Use the Solar Dryer file as the first fixture.

Expected result:

```text
42 pages
7 parts
42 callouts
42 image prompts
143 citations
```

### Step 2 — Manifest and approval state

Create:

```text
approval.json
```

and the stage system.

### Step 3 — Scaffold

Create:

```text
book-scaffold.mjs
```

Test with a dry run first.

### Step 4 — Renderer

Create:

```text
book-render.mjs
```

Start with text-only pages before adding images.

### Step 5 — Asset classification

Add the photo/diagram decision gate.

### Step 6 — Asset generation

Integrate with:

```text
gen-image.mjs
```

### Step 7 — Build/check/shot/export orchestration

Connect the existing engine tools.

### Step 8 — End-to-end test

Run the entire workflow on:

```text
ideas/Solar-Dryer-Fabrication-Fruit-Processing.md
```

The final expected result is:

```text
books/solar-dryer-fruit-processing/
├── solar-dryer-fruit-processing.html
├── book.json
├── book.html
├── solar-dryer-fruit-processing.pdf
├── page1.png
├── ...
└── images/
```

With:

```text
57 pages
0 mm overflow
no broken images
approved screenshots
approved PDF export
```

---

## 15. Summary of what to create later

### New skill

```text
.claude/skills/ideas-to-book/SKILL.md
```

### New scripts

```text
engine/tools/idea-parser.mjs
engine/tools/book-scaffold.mjs
engine/tools/book-render.mjs
engine/tools/book-assets.mjs
engine/tools/ideas-to-book.mjs
```

Manifest and approval state needs persistent files so the workflow can resume safely.


```text
idea-manifest.json
approval.json
```

### New documentation

```text
IDEAS-TO-BOOK-AUTOMATION.md
```

### New runtime state

```text
books/<slug>/.work/idea-manifest.json
books/<slug>/.work/approval.json
```

---

## Final note

This gives a repeatable, safe, human-approved book factory while keeping the
existing paper-engine tools and design rules intact.

Here's the ordered list of files to create, from most foundational to most dependent:

1. package.json (modify) – Add js-yaml (or use minimal custom parser) and a Markdown parser (marked or markdown-it)
2. engine/tools/idea-parser.mjs – Parses front matter, pages, citations, image prompts from /ideas/*.md
3. engine/tools/book-scaffold.mjs – Copies template, renames interior file, validates no overwrite
4. engine/tools/book-render.mjs – Converts parsed idea into interior HTML with proper markup
5. engine/tools/book-assets.mjs – Manages image prompts, classification (photo vs diagram), generates prompt files
6. engine/tools/ideas-to-book.mjs – Main CLI orchestrator with dropdown selection, stage management, approval gates
7. .claude/skills/ideas-to-book/SKILL.md – Skill documentation for the block skill system
8. IDEES-TO-BOOK-AUTOMATION-IMPLEMENTATION.md (or similar) – Implementation guide with testing approach
