---
name: ideas-to-book
description: Orchestrates the end‑to‑end workflow that turns a markdown or JSON idea file into a complete, reviewable, human‑approved paper‑engine B5 book under an Agent-Native model. The skill owns the 14-stage state machine (parse, scaffold, inherit, plan, prep, classify, render, diagrams, generate, build, check, screenshot, approveScreenshots, export) and delegates execution to dedicated paper-engine automation scripts.
---
# ideas‑to‑book skill

This skill orchestrates the paper-engine multi-page book automation system under an **Agent-Native Execution Model** (where the active AI assistant serves as the LLM without requiring external API keys).

It connects to core engine tools:
- `engine/tools/idea-parser.mjs`   – parses `.md` or `.json` idea files into `.work/idea-manifest.json`.
- `engine/tools/book-scaffold.mjs` – scaffolds book folders, customizes `book.json`, and manages cover images via `chooseCoverImage()`.
- `engine/tools/inherited-pages.mjs` – customizes front/back matter (cover, colophon, TOC, index, back cover).
- `engine/tools/prep-pages.mjs`    – content prep & word count optimization (~65 words, max 85) using `block` skill rules (`.bad`, `.hl`, `.good`, voice rules, page splitting). Writes `.work/page-XXX-prompt.json`.
- `engine/tools/image-classifier.mjs` – classifies page visuals as `photo` (physical) vs `diagram` (mechanism).
- `engine/tools/book-render.mjs`   – generates interior HTML (`<slug>.html`) with DOMPurify sanitization and citation styles.
- `engine/tools/diagram-generator.mjs` – Agent-Native inline SVG diagram synthesis & validation (`diagram-system.md` shapes: attack, resilience, performance, correctness, auth, async, tooling, integration, process). Writes `.work/diagram-XXX-prompt.json`.
- `engine/tools/book-assets.mjs`   – generates photo assets via `gen-image.mjs` and creates `.work/asset-report.json`.
- `engine/tools/build-book.mjs`    – assembles interior pages into `book.html` with running headers, page numbers, part dividers, TOC, and index.
- `engine/tools/check.mjs`         – Playwright layout checker verifying 0 mm overflow across all pages.
- `engine/tools/shot.mjs`          – captures high-res Playwright PNG screenshots for visual inspection.
- `engine/tools/export.mjs`        – exports print-ready B5 PDF.
- `engine/tools/ideas-to-book.mjs` – CLI macro-orchestrator driving the 14-stage pipeline with `firstUnapprovedStage()` resumption.

---

## When to invoke

Use this skill whenever the user asks for any of the following:
- "turn my idea file into a book"
- "create a new book from an idea in /ideas"
- "run the ideas‑to‑book automation"
- "parse this idea and scaffold the book"
- "prep pages for my book"
- "generate diagrams for my book"
- "build, check, screenshot, and export a book"
- "resume my book from the last approved stage"

---

## Typical Usage

```bash
# List available idea files
node engine/tools/ideas-to-book.mjs --list-ideas

# Interactive selection and run full pipeline
node engine/tools/ideas-to-book.mjs --select

# Run a specific idea file with defaults
node engine/tools/ideas-to-book.mjs ideas/Solar-Dryer-Fabrication-Fruit-Processing.md

# Specify template, slug, and enable content prep
node engine/tools/ideas-to-book.mjs ideas/my-idea.md --template books/STEAM-IE-FOR-HYDROPONICS --slug my-book --prep-page

# Run a single stage (e.g. diagrams)
node engine/tools/ideas-to-book.mjs books/my-book --stage diagrams

# Resume interrupted run from last unapproved stage
node engine/tools/ideas-to-book.mjs ideas/my-idea.md --resume

# Force re-run from scratch
node engine/tools/ideas-to-book.mjs ideas/my-idea.md --force
```

---

## CLI Reference

| Flag | Purpose |
|------|---------|
| `--list-ideas` | Scan `/ideas/*.md` and `/ideas/*.json` and list available files |
| `--select` | Interactive dropdown to pick an idea file |
| `--dry-run` | Preview actions without modifying state |
| `--generate-assets` | Force photograph generation (override `--skip-assets`) |
| `--skip-assets` | Skip image generation (placeholders used) |
| `--prep-page` | Enable opt-in LLM content preparation stage |
| `--force` | Re-run stages even if already approved |
| `--resume` | Resume automatically from `firstUnapprovedStage()` |
| `--stage <name>` | Run specific stage: `parse`, `scaffold`, `inherit`, `plan`, `prep`, `classify`, `render`, `diagrams`, `generate`, `build`, `check`, `screenshot`, `approveScreenshots`, `export` |
| `--approve-stage <name>` | Mark stage as approved |
| `--template <path>` | Override template (default: `books/STEAM-IE-FOR-HYDROPONICS`) |
| `--list-templates` | Show available template folders in `books/` |
| `--no-interactive` | Non-interactive mode for agent or CI environments |

---

## The 14-Stage Pipeline

Progress is tracked in `books/<slug>/.work/approval.json`. `firstUnapprovedStage(bookDir)` resolves resumption seamlessly.

| # | Stage | Script | Output / Artifact |
|---|---|---|---|
| 1 | `parse` | `idea-parser.mjs` | `.work/idea-manifest.json` |
| 2 | `scaffold` | `book-scaffold.mjs` | `books/<slug>/` scaffolded folder |
| 3 | `inherit` | `inherited-pages.mjs` | Custom front/back matter |
| 4 | `plan` | `ideas-to-book.mjs` | Citation configuration (`preserve`, `footnotes`, `references`, `remove`) |
| 5 | `prep` | `prep-pages.mjs` | `page.preparedContent`, `.work/page-XXX-prompt.json`, `prepHistory` |
| 6 | `classify` | `image-classifier.mjs` | Classification array (`photo` vs `diagram`) |
| 7 | `render` | `book-render.mjs` | `books/<slug>/<slug>.html` interior HTML |
| 8 | `diagrams` | `diagram-generator.mjs` | `.work/diagram-XXX-prompt.json`, inline SVG diagrams (`images/*.svg`) |
| 9 | `generate` | `book-assets.mjs` | Photos via `gen-image.mjs`, `.work/asset-report.json` |
| 10 | `build` | `build-book.mjs` | `books/<slug>/book.html` complete assembly |
| 11 | `check` | `check.mjs` | Playwright 0 mm overflow verification report |
| 12 | `screenshot` | `shot.mjs` | High-res PNG screenshots (`books/<slug>/page*.png`) |
| 13 | `approveScreenshots` | `ideas-to-book.mjs` | Visual review gate entry in `approval.json` |
| 14 | `export` | `export.mjs` | `books/<slug>/<slug>.pdf` print PDF |

---

## Verification Workflow

After every page or book modification:

```bash
# 1. Assemble book chrome
node engine/tools/build-book.mjs books/<slug>

# 2. Verify 0 mm overflow on all pages
node engine/tools/check.mjs books/<slug>/book.html

# 3. Capture screenshots for visual inspection
node engine/tools/shot.mjs books/<slug>/book.html

# 4. Generate print PDF
node engine/tools/export.mjs books/<slug>/book.html
```

---

## Output Structure

For a book with slug `solar-dryer-fruit-processing`:

```text
books/solar-dryer-fruit-processing/
├── solar-dryer-fruit-processing.html  ← Interior source
├── book.json                          ← Book configuration
├── book.html                          ← Full assembled book
├── solar-dryer-fruit-processing.pdf   ← Print-ready B5 PDF
├── page1.png … pageN.png             ← High-res screenshots
├── images/                            ← SVG diagrams & photo assets
└── .work/                             ← Stage state, manifests & prompt files
    ├── idea-manifest.json
    ├── approval.json
    ├── page-*.json
    ├── diagram-*.json
    └── asset-report.json
```