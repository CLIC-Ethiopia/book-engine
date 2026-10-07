# Ideas‑to‑Book Automation — Implementation Guide

## Overview

This guide documents the automation workflow that turns a markdown idea file in `/ideas` into a complete, reviewable, human‑approved paper‑engine book.

## Files Created

| # | File | Purpose |
|---|------|---------|
| 1 | `package.json` (modified) | Added `js-yaml`, `marked`, `prompts` dependencies and the `ideas` npm script. |
| 2 | `engine/tools/idea-parser.mjs` | Parses YAML front matter and extracts page data from idea markdown files. |
| 3 | `engine/tools/book-scaffold.mjs` | Copies a template book folder, renames the interior file, updates `book.json`. |
| 4 | `engine/tools/book-render.mjs` | Builds the interior `<section class="sheet bb">` HTML from the manifest, handling image classification. |
| 5 | `engine/tools/book-assets.mjs` | Writes prompt files, generates photographs via `gen-image.mjs`, and produces an asset report. |
| 6 | `engine/tools/ideas-to-book.mjs` | The CLI orchestrator that drives the workflow with human approval gates. |
| 7 | `.claude/skills/ideas-to-book/SKILL.md` | Claude skill documentation for the orchestration workflow. |
| 8 | `IDEAS-TO-BOOK-AUTOMATION-IMPLEMENTATION.md` | This guide. |

## Installation

```bash
cd paper-engine
npm install
```

This installs the three new dependencies:

- `js-yaml` — YAML front‑matter parsing.
- `marked` — Markdown to HTML rendering.
- `prompts` — Interactive CLI prompts and dropdowns.

## Quick Start

```bash
# List available idea files
node engine/tools/ideas-to-book.mjs --list-ideas

# Run the full pipeline interactively
node engine/tools/ideas-to-book.mjs --select
```

## Workflow

1. **Parse** — Read the idea file, extract front matter and page data, validate page numbers and required fields.
2. **Scaffold** — Copy the template folder, rename the interior file to match the slug, update `book.json`.
3. **Render** — Convert each parsed page into an interior `<section class="sheet bb">` element with the correct tab color, eyebrow, title, subtitle, image band, explainer, action callout, and footer.
4. **Assets** — Classify each image as photo or diagram, write prompt files, generate photographs for photo pages.
5. **Build** — Run `build-book.mjs` to assemble `book.html` from the interior file and `book.json`.
6. **Check** — Run `check.mjs` to verify 0 mm overflow and no broken images.
7. **Screenshot** — Run `shot.mjs` to capture PNGs of every page.
8. **Approve Screenshots** — Interactive prompt to confirm visual correctness.
9. **Export** — Run `export.mjs` to create the final PDF.

## Manual Usage (without the orchestrator)

Each script can be run independently:

```bash
# Parse an idea file
node engine/tools/idea-parser.mjs ideas/Solar-Dryer-Fabrication-Fruit-Processing.md

# Scaffold a new book from the template
node engine/tools/book-scaffold.mjs ideas/Solar-Dryer-Fabrication-Fruit-Processing.md

# Render the interior HTML
node engine/tools/book-render.mjs books/solar-dryer-fruit-processing

# Generate images
node engine/tools/book-assets.mjs books/solar-dryer-fruit-processing --generate

# Build the book
node engine/tools/build-book.mjs books/solar-dryer-fruit-processing

# Check for overflow
node engine/tools/check.mjs books/solar-dryer-fruit-processing/book.html

# Screenshot pages
node engine/tools/shot.mjs books/solar-dryer-fruit-processing/book.html

# Export PDF
node engine/tools/export.mjs books/solar-dryer-fruit-processing/book.html books/solar-dryer-fruit-processing/solar-dryer-fruit-processing.pdf
```

## Approval State

The orchestrator tracks progress in:

```
books/<slug>/.work/approval.json
```

This allows resuming a workflow that was interrupted mid‑way.

## Idea File Format

```markdown
---
title: Book Title
slug: my-book
subtitle: A subtitle
author: Author Name
series: STEAM-IE
editionLabel: Edition 1.0
coverImage: images/cover.png
---

# STEAM-IE · No. 01 Science

## Page Title

#### Page Subtitle

![AI Image Prompt: ...]

Main content...

[ACTION CALLOUT: LABEL] Action content...
```

## Image Classification

Each page's image is classified as `photo` or `diagram`:

- **Photo** — physical subjects that need a photograph (fruits, tools, buildings, equipment).
- **Diagram** — mechanisms, processes, systems, charts, and graphs (rendered as inline SVG).

The classification is prompted interactively by default, or automatic via `--auto-classify`.

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `Manifest not found` | Run `idea-parser.mjs` first to create the manifest. |
| `Template folder not found` | Ensure `books/STEAM-IE-FOR-HYDROPONICS` exists. |
| `No pages found in interior file` | Ensure the interior file contains `<section class="sheet bb">` elements. |
| `Idea validation failed` | Check that all required front‑matter fields are present and page numbers are sequential. |
| `AGY CLI not found` | Install the Antigravity CLI or use `--provider gemini` with a GEMINI_API_KEY. |




