 this is good. we have 7 phases and 10 Important Rules in "[Solar-Dryer-Fabrication-Fruit-Processing.md](http://Solar-Dryer-Fabrication-Fruit-Processing.md)" file. i like to make every step of writting a new book based on ideas in folder "/ideas" as automated standared with human approval in the loop, what new skills do i need to create or any other automation scipts? give me how to do it, if necessary create a new markdown file that i could edit. do not edit any file in the project just give me plan

  Thought for 3m 15s, searched for 3 patterns, read 3 files

Yes. The best approach is to keep the existing paper-engine tools and add a book-factory workflow around them.

The existing tools already handle:

- build-book.mjs

- check.mjs

- shot.mjs

- export.mjs

- gen-image.mjs

- the existing block skill

What is missing is the automation layer that turns:

ideas/&lt;book-idea&gt;.md

into a complete, reviewable book project with explicit human approval gates.

No files were edited.

---

Recommended automation architecture

1. Keep the existing tools

Do not replace the existing engine tools.

Reuse:

engine/tools/build-book.mjs

engine/tools/check.mjs

engine/tools/shot.mjs

engine/tools/export.mjs

engine/tools/gen-image.mjs

Also keep the existing:

.claude/skills/block/

The new system should orchestrate those tools, not duplicate them.

---

2. Create one new skill

Create a new skill such as:

.claude/skills/ideas-to-book/

├── [SKILL.md](http://SKILL.md)

├── references/

│   ├── [idea-file-format.md](http://idea-file-format.md)

│   ├── [approval-gates.md](http://approval-gates.md)

│   └── [page-conversion-rules.md](http://page-conversion-rules.md)

Suggested name:

ideas-to-book

This skill should own the complete workflow:

1. Read an idea file from /ideas.

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

The existing block skill should remain responsible for page-level writing and design rules. The new skill should be the orchestrator.

---

3. Create new automation scripts

I recommend four new scripts in:

engine/tools/

3.1 idea-parser.mjs

Responsibility

Read:

ideas/&lt;book-idea&gt;.md

and produce a structured manifest.

For your current file, it should detect:

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

Your current file contains:

42 STEAM-IE pages

42 ACTION CALLOUT sections

42 image prompts

143 citation markers

7 parts

The parser should stop immediately if:

- A page number is missing

- A page number is duplicated

- A page has no title

- A page has no action callout

- A page has no image prompt

- A page belongs to an unknown part

- The page order is invalid

Output

For example:

books/&lt;slug&gt;/.work/idea-manifest.json

The manifest should contain the complete structured representation of the book.

---

3.2 book-scaffold.mjs

Responsibility

Create the new book folder from the template.

Input:

ideas/[Solar-Dryer-Fabrication-Fruit-Processing.md](http://Solar-Dryer-Fabrication-Fruit-Processing.md)

Template:

books/STEAM-IE-FOR-HYDROPONICS/

Output:

books/solar-dryer-fruit-processing/

What it should copy

Copy:

book.json

STEAM-IE-FOR-HYDROPONICS.html

[blocks.md](http://blocks.md)

[VOICE.md](http://VOICE.md)

Rename the interior file to:

solar-dryer-fruit-processing.html

What it should not copy

Do not copy generated artifacts from the template:

book.html

page*.png

*.pdf

Those should be regenerated for the new book.

Safety rules

The scaffold script must:

- Refuse to overwrite an existing book folder unless explicitly authorized

- Create a dry-run report first

- Show exactly what will be created

- Preserve the original template

- Never edit book.html directly

---

3.3 book-render.mjs

Responsibility

Convert the parsed idea manifest into the interior HTML file.

Input:

books/&lt;slug&gt;/.work/idea-manifest.json

Output:

books/&lt;slug&gt;/&lt;slug&gt;.html

Page conversion

For each idea page:

┌───────────────────────────┬────────────────────────────────────┐

│     Idea file content     │           Generated HTML           │

├───────────────────────────┼────────────────────────────────────┤

│ STEAM-IE · No. 01 Science │ Eyebrow and part pill              │

├───────────────────────────┼────────────────────────────────────┤

│ ## Page title             │ &lt;h1 class="title"&gt;                 │

├───────────────────────────┼────────────────────────────────────┤

│ #### Subtitle             │ &lt;div class="sub"&gt;                  │

├───────────────────────────┼────────────────────────────────────┤

│ Main markdown paragraphs  │ &lt;div class="explain"&gt;              │

├───────────────────────────┼────────────────────────────────────┤

│ [ACTION CALLOUT: LABEL]   │ &lt;div class="ask"&gt;                  │

├───────────────────────────┼────────────────────────────────────┤

│ Image prompt              │ Image or diagram placeholder       │

├───────────────────────────┼────────────────────────────────────┤

│ Page number               │ Preserved for review and numbering │

└───────────────────────────┴────────────────────────────────────┘

Important image decision

Your current ideas file has an image prompt for every page, but the project rules say:

- Physical subjects should use photographs.

- Mechanisms, processes, and diagrams should be inline SVG.

- Diagrams must not be generated as raster images.

Therefore, the renderer must not blindly generate 42 images.

It should first classify each page as:

photo

or:

diagram

For example:

- Solar collector cross-section → diagram

- Dryer cabinet → diagram or photograph

- Fruit slices → photograph

- Business model network → diagram

- Packaging design → photograph or diagram depending on intent

This classification should be a human approval gate.

---

3.4 book-assets.mjs

Responsibility

Manage all image-related work.

It should:

1. Read the image prompts from the manifest.

2. Add the standard no-text rule.

3. Add the book-wide style sentence.

4. Generate photographs using gen-image.mjs.

5. Save each image in:

books/&lt;slug&gt;/images/

6. Save each prompt beside its image as:

images/&lt;name&gt;.txt

7. Produce an asset report.

Example output

books/solar-dryer-fruit-processing/images/

├── cover.png

├── 01-moisture-equilibrium.png

├── 01-moisture-equilibrium.txt

├── 02-solar-irradiance.png

├── 02-solar-irradiance.txt

└── ...

Asset validation

The script should check:

- Every expected image exists

- Every image opens

- No image is blank

- No image has broken dimensions

- Every prompt file exists

- No generated image contains unreadable text

- The book has a consistent visual style

---

4. Add a human approval system

4.1 Approval state file

Create an approval state file such as:

books/&lt;slug&gt;/.work/approval.json

Example:

{

  "slug": "solar-dryer-fruit-processing",

  "source": "ideas/[Solar-Dryer-Fabrication-Fruit-Processing.md](http://Solar-Dryer-Fabrication-Fruit-Processing.md)",

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

The automation should not proceed to the next stage until the current stage is approved.

---

4.2 Recommended approval gates

Gate 1 — Idea parsing

The system shows:

Book title: Solar Dryer for Fruit Processing

Pages detected: 42

Parts detected: 7

Action callouts detected: 42

Image prompts detected: 42

Citations detected: 143

The human approves:

Yes, parse this idea into a book.

---

Gate 2 — Metadata and part mapping

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

---

Gate 3 — Page conversion plan

The system shows a table like:

No. 01 Science       Moisture Equilibrium...

No. 02 Science       Solar Irradiance...

No. 03 Science       Natural Convection...

...

No. 42 Entrepreneurship Cooperative Outgrower Model...

The human confirms:

- Page order

- Page titles

- Part assignments

- Action callout labels

- Citation handling

---

Gate 4 — Image and diagram classification

The system shows:

No. 01: diagram

No. 02: diagram

No. 03: diagram

No. 04: photograph

...

The human approves or changes each classification.

This is one of the most important gates because generated images are inappropriate for many technical diagrams.

---

Gate 5 — Page HTML review

The system generates the interior HTML and presents a diff or page-by-page preview.

The human checks:

- No content was lost

- No facts were invented

- No citations disappeared

- No action callout was omitted

- No page was merged or split incorrectly

- HTML escaping is correct

- Special characters are preserved

---

Gate 6 — Asset generation review

The system shows:

Images generated: 31

Diagrams to author: 11

Missing images: 0

Broken images: 0

The human approves the assets before building.

---

Gate 7 — Build and check

The system runs:

node engine/tools/build-book.mjs books/&lt;slug&gt;

node engine/tools/check.mjs books/&lt;slug&gt;/book.html

The human proceeds only if:

overflowing: none

broken images: none

---

Gate 8 — Screenshot review

The system runs:

node engine/tools/shot.mjs books/&lt;slug&gt;/book.html

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

---

Gate 9 — PDF export

Only after screenshot approval should the system run:

node engine/tools/export.mjs \

  books/&lt;slug&gt;/book.html \

  books/&lt;slug&gt;/&lt;slug&gt;.pdf

---

5. Proposed command-line interface

A single orchestration command would be easiest to use.

5.1 Dry run

node engine/tools/ideas-to-book.mjs \

  ideas/[Solar-Dryer-Fabrication-Fruit-Processing.md](http://Solar-Dryer-Fabrication-Fruit-Processing.md) \

  --template books/STEAM-IE-FOR-HYDROPONICS \

  --slug solar-dryer-fruit-processing \

  --dry-run

This should show:

- What will be created

- How many pages will be generated

- What metadata will be used

- Which files will be copied

- Which files will be generated

- Whether any destination already exists

No files should be changed during a dry run.

---

5.2 Parse and create manifest

node engine/tools/ideas-to-book.mjs \

  ideas/[Solar-Dryer-Fabrication-Fruit-Processing.md](http://Solar-Dryer-Fabrication-Fruit-Processing.md) \

  --template books/STEAM-IE-FOR-HYDROPONICS \

  --slug solar-dryer-fruit-processing \

  --stage parse

---

5.3 Scaffold the book

node engine/tools/ideas-to-book.mjs \

  books/solar-dryer-fruit-processing \

  --stage scaffold

---

5.4 Render pages

node engine/tools/ideas-to-book.mjs \

  books/solar-dryer-fruit-processing \

  --stage render

---

5.5 Generate assets

node engine/tools/ideas-to-book.mjs \

  books/solar-dryer-fruit-processing \

  --stage assets

---

5.6 Build and check

node engine/tools/ideas-to-book.mjs \

  books/solar-dryer-fruit-processing \

  --stage build

This stage should automatically run:

build-book.mjs

check.mjs

---

5.7 Generate screenshots

node engine/tools/ideas-to-book.mjs \

  books/solar-dryer-fruit-processing \

  --stage shot

---

5.8 Export PDF

node engine/tools/ideas-to-book.mjs \

  books/solar-dryer-fruit-processing \

  --stage export

---

6. Approval flags

Each stage should require approval.

Example:

node engine/tools/ideas-to-book.mjs \

  books/solar-dryer-fruit-processing \

  --stage render \

  --approve-stage parse

Or use an interactive prompt:

node engine/tools/ideas-to-book.mjs \

  books/solar-dryer-fruit-processing \

  --stage render \

  --interactive

The interactive mode should ask:

The idea file has been parsed.

42 pages detected.

7 parts detected.

42 action callouts detected.

42 image prompts detected.

Approve this manifest and continue?

[y/N]

---

7. Recommended state machine

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

The automation should refuse to skip backward or forward without an explicit approval.

---

8. What the new workflow should automatically do

Automatic

- Read the idea file

- Parse front matter

- Detect page sections

- Validate page numbering

- Validate part names

- Count action callouts

- Extract image prompts

- Create the book folder from the template

- Rename the interior HTML file

- Generate book.json

- Generate interior HTML

- Generate image prompt files

- Run image generation

- Run the build

- Run overflow checks

- Generate screenshots

- Export the PDF

Human approval required

- Confirm the parsed book metadata

- Confirm page order

- Confirm image versus diagram classification

- Confirm any citation handling

- Review generated page HTML

- Review generated images

- Review screenshots

- Approve final PDF export

---

9. Recommended new markdown file

Once you approve the automation design, create a file such as:

[IDEAS-TO-BOOK-AUTOMATION.md](http://IDEAS-TO-BOOK-AUTOMATION.md)

or:

[BOOK-FACTORY-WORKFLOW.md](http://BOOK-FACTORY-WORKFLOW.md)

It should document:

# Ideas-to-Book Automation

## Purpose

## Source file format

## Required front matter

## Page marker format

## Action callout format

## Image prompt format

## Automation stages

## Approval gates

## CLI commands

## Output folder structure

## Safety rules

## Validation rules

## Recovery and resume behavior

## Example: Solar Dryer for Fruit Processing

This file should become the operating manual for every future book.

---

10. Important design decisions

10.1 Keep Markdown as the source of truth

The file in:

ideas/

should remain the master source.

The generated book files should always be reproducible from it.

---

10.2 Never edit book.html

The automation must treat:

book.html

as generated output only.

It should never modify that file directly.

---

10.3 Preserve the template structure

For the Solar Dryer book, the expected structure is:

6 generated pages before Science

7 part dividers

42 STEAM-IE content pages

1 index page

1 back cover page

────────────────────────

57 pages total

If you want exactly 50 pages instead, the seven part dividers would need to be removed explicitly. Since you asked to use the hydroponics book as the template, the plan above preserves the dividers.

---

10.4 Handle citations deliberately

Your idea file contains 143 citation markers.

The automation should not silently delete them.

Recommended options:

1. Preserve them in the page text.

2. Convert them into footnotes.

3. Create a references page.

4. Preserve them as source markers during drafting and resolve them later.

This should be a human decision before final export.

---

10.5 Do not generate diagrams as images

The automation must classify each visual.

Use:

photo

for physical subjects.

Use:

inline SVG

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

11. Recommended implementation order

Build the automation in this order:

Step 1 — Parser

Create and test:

idea-parser.mjs

Use your Solar Dryer file as the first fixture.

Expected result:

42 pages

7 parts

42 callouts

42 image prompts

143 citations

Step 2 — Manifest and approval state

Create:

approval.json

and the stage system.

Step 3 — Scaffold

Create:

book-scaffold.mjs

Test with a dry run first.

Step 4 — Renderer

Create:

book-render.mjs

Start with text-only pages before adding images.

Step 5 — Asset classification

Add the photo/diagram decision gate.

Step 6 — Asset generation

Integrate with:

gen-image.mjs

Step 7 — Build/check/shot/export orchestration

Connect the existing engine tools.

Step 8 — End-to-end test

Run the entire workflow on:

ideas/[Solar-Dryer-Fabrication-Fruit-Processing.md](http://Solar-Dryer-Fabrication-Fruit-Processing.md)

The final expected result is:

books/solar-dryer-fruit-processing/

├── solar-dryer-fruit-processing.html

├── book.json

├── book.html

├── solar-dryer-fruit-processing.pdf

├── page1.png

├── ...

└── images/

With:

57 pages

0 mm overflow

no broken images

approved screenshots

approved PDF export

---

12. Summary of what to create later

New skill

.claude/skills/ideas-to-book/[SKILL.md](http://SKILL.md)

New scripts

engine/tools/idea-parser.mjs

engine/tools/book-scaffold.mjs

engine/tools/book-render.mjs

engine/tools/book-assets.mjs

engine/tools/ideas-to-book.mjs

New documentation

[IDEAS-TO-BOOK-AUTOMATION.md](http://IDEAS-TO-BOOK-AUTOMATION.md)

New runtime state

books/&lt;slug&gt;/.work/idea-manifest.json

books/&lt;slug&gt;/.work/approval.json

This gives you a repeatable, safe, human-approved book factory while keeping the existing paper-engine tools and design rules intact.