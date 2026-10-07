# Idea File Format (ideas-to-book v2.1)

## Overview

Every book begins as a single Markdown file in `ideas/<book-idea>.md`. This file is the **master source of truth** — the generated book is always reproducible from it. The file contains:

- **YAML front matter** — book-level metadata
- **Page sections** — one per concept, each with required fields

---

## Front Matter (Required)

```yaml
---
title: "Solar Dryer for Fruit Processing"
subtitle: "A STEAM-IE Field Manual"
author: "Frehun A. Demissie"
series: "STEAM-IE FOR HYDROPONICS"
slug: "solar-dryer-fruit-processing"
editionLabel: "Edition 1.0"
audience: "Small-scale farmers, ag-tech students, extension workers"
primaryLocation: "Addis Ababa, Ethiopia"
coverImage: "images/cover.png"
---
```

| Field | Required? | Description |
|-------|-----------|-------------|
| `title` | ✅ | Book title (used on cover, spine, metadata) |
| `author` | ✅ | Author name (copyright, cover) |
| `series` | ✅ | Series label (eyebrow, running footer) |
| `slug` | ⚠️ | Folder name; derived from `title` if omitted |
| `subtitle` | ❌ | Subtitle on cover |
| `editionLabel` | ❌ | Edition text (default: "Edition 1.0") |
| `audience` | ❌ | Target reader description |
| `primaryLocation` | ❌ | Geographic focus |
| `coverImage` | ❌ | Path to cover image (default: `images/cover.png`) |

**Validation:** Parser fails if `title`, `author`, `series`, or a valid `slug` are missing.

---

## Page Section Format

Pages are separated by **level-1 headings** with this exact format:

```markdown
# STEAM-IE · No. 01 Science
```

- `STEAM-IE` — literal prefix
- `No. DD` — two-digit page number (01, 02, …), **must be sequential starting at 01**
- Section name — one of the 7 STEAM-IE sections:
  - `Science`
  - `Technology`
  - `Engineering`
  - `Arts`
  - `Mathematics`
  - `Innovation`
  - `Entrepreneurship`

**Validation fails if:**
- Page number missing or not two digits
- Duplicate page numbers
- Non-sequential numbering
- Unknown section name

---

## Page Content (Required per page)

Every page section **must** contain:

```markdown
## Page Title
#### Subtitle

Main content paragraph 1.

Main content paragraph 2.

![AI Image Prompt: Photograph of a solar fruit dryer cabinet with trays loaded with mango slices, soft daylight, plain neutral background, no text, no logos]

[ACTION CALLOUT: BUILD THIS TODAY] Sketch your dryer cabinet on paper. Label the air inlet, trays, and exhaust.
```

| Element | Markdown | Required? | HTML Output |
|---------|----------|-----------|-------------|
| Title | `## Title` | ✅ | `<h1 class="title">` |
| Subtitle | `#### Subtitle` | ⚠️ | `<div class="sub">` |
| Body paragraphs | plain text / markdown | ✅ | `<div class="explain">` (last `<p>` gets `class="close"`) |
| AI Image Prompt | `![AI Image Prompt: ...]` | ✅ | Prompt file + classification (photo/diagram) |
| Action Callout | `[ACTION CALLOUT: LABEL] content` | ✅ | `<div class="ask"><span class="lbl">LABEL</span><p>content</p></div>` |
| Citations | `[cite: 1]` | ❌ | Configurable (preserve/footnotes/references/remove) |

**Validation fails if any page lacks:** title, image prompt, or action callout.

---

## Citation Markers

Citations appear as `[cite: N]` inline in body paragraphs. The parser:
- Counts all citations (total + per page)
- Does **not** auto-resolve them
- Presents total count at **Gate 1** (parse stage)
- User chooses handling at **Gate 2/3**: `preserve` | `footnotes` | `references` | `remove`

---

## Example: Complete Page

```markdown
# STEAM-IE · No. 01 Science

## Moisture Equilibrium
#### The physics of drying: water activity, equilibrium relative humidity, and why fruit stops losing water before it's "dry enough."

Drying is not about heat. It is about **vapor pressure difference**. The air around the fruit must be able to accept more water than the fruit holds. That gap is the driving force.

When the air's relative humidity matches the fruit's water activity, drying stops. This is **equilibrium**. For mango at 50 °C, the equilibrium RH is about 18 %. If your dryer air is at 30 % RH, the fruit will dry. If the air cools at night to 60 % RH, the fruit re-absorbs moisture — the cycle reverses.

![AI Image Prompt: Diagram showing water activity curve vs temperature, with equilibrium zones marked, technical illustration style, no text, clean lines]

[ACTION CALLOUT: MEASURE IT TODAY] Weigh 10 g of fresh mango slices every 30 minutes in your dryer. Plot the curve. Note when the weight stops dropping — that is equilibrium.
```

---

## Section Order

Pages must appear in the 7-part STEAM-IE order:
1. **Science** (S)
2. **Technology** (T)
3. **Engineering** (E)
4. **Arts** (A)
5. **Mathematics** (M)
6. **Innovation** (I)
7. **Entrepreneurship** (IE)

Within each part, pages follow sequential numbering. The parser builds `book.json` parts in this order automatically.

---

## Parsing Rules (from `idea-parser.mjs`)

- Comments (`<!-- -->`) are ignored
- Horizontal rules (`---`) between pages are stripped
- Excess blank lines collapsed to single blank line
- HTML special chars escaped in output
- Markdown in body rendered via `marked` (supports bold, italic, links)

---

## Validation Summary

| Check | Failure Action |
|-------|----------------|
| Missing front matter `---` | Hard error |
| Missing required front matter fields | Hard error |
| No page sections found | Hard error |
| Non-sequential page numbers | Hard error |
| Duplicate page numbers | Hard error |
| Unknown section name | Hard error |
| Page missing `## Title` | Hard error |
| Page missing `![AI Image Prompt]` | Hard error |
| Page missing `[ACTION CALLOUT]` | Hard error |

---

## Output: `idea-manifest.json`

Written to `books/<slug>/.work/idea-manifest.json`. Contains:

```json
{
  "sourceFile": "ideas/solar-dryer.md",
  "slug": "solar-dryer-fruit-processing",
  "title": "Solar Dryer for Fruit Processing",
  "subtitle": "A STEAM-IE Field Manual",
  "author": "Frehun A. Demissie",
  "series": "STEAM-IE FOR HYDROPONICS",
  "editionLabel": "Edition 1.0",
  "audience": "...",
  "primaryLocation": "...",
  "coverImage": "images/cover.png",
  "pages": [
    {
      "no": 1,
      "section": "Science",
      "title": "Moisture Equilibrium",
      "subtitle": "...",
      "imagePrompt": "Diagram showing water activity curve...",
      "actionCallout": { "label": "MEASURE IT TODAY", "content": "..." },
      "citations": [],
      "content": "Drying is not about heat..."
    }
  ],
  "parts": [
    { "name": "Science", "eyebrow": "S", "blocks": ["Moisture Equilibrium", "..."] }
  ],
  "totalPages": 42,
  "totalCitations": 143
}
```