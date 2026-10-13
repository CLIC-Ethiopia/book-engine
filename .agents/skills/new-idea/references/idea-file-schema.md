# Idea File Schema (new-idea Skill)

The target output of the new-idea workflow is a validated JSON file matching this schema, saved to `ideas/<slug>.json` and ready for the `ideas-to-book` pipeline.

---

## Schema Overview

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `title` | ✅ | string | Book title (cover, spine, metadata) |
| `slug` | ✅ | string | Folder name: lowercase, hyphenated, no special chars |
| `subtitle` | ⚠️ | string | One-sentence cover subtitle |
| `editionLabel` | ⚠️ | string | Edition text (default: "First Edition") |
| `author` | ✅ | string | Author name (copyright, cover) |
| `series` | ✅ | string | Series label (eyebrow, running footer) |
| `audience` | ⚠️ | string | Target reader description |
| `primaryLocation` | ⚠️ | string | Geographic focus |
| `coverImage` | ⚠️ | string | Cover image filename (default: "cover.png") |
| `pages` | ✅ | array | Page objects (see below) |

---

## Page Object Schema

```json
{
  "no": 1,
  "section": "Science",
  "title": "Action-Oriented Concept Title",
  "subtitle": "1-sentence subtitle explaining core hook",
  "content": "Full page content in STEAM-IE voice (3-5 paragraphs). Use plain language, analogies, practical terminology.",
  "imagePrompt": "Explicit AI image prompt: 'Cross-section diagram of X showing Y. Include labels for A, B, C. Style: technical vector diagram with clean lines.'",
  "imageType": "diagram",
  "sectionColor": "#e61358",
  "actionCallout": {
    "label": "DO THIS TODAY / MEASURE IT / BUILD THIS ONCE / DO THE MATH",
    "content": "1-2 sentences specifying a concrete, immediate hands-on task"
  },
  "citations": [1, 2, 3]
}
```

### Page Field Details

| Field | Required | Values | Notes |
|-------|----------|--------|-------|
| `no` | ✅ | integer | Sequential 1..N |
| `section` | ✅ | string | One of 7 STEAM-IE sections |
| `title` | ✅ | string | Action-oriented, single concept |
| `subtitle` | ⚠️ | string | One sentence |
| `content` | ✅ | string | STEAM-IE voice, 3-5 short paragraphs |
| `imagePrompt` | ✅ | string | Detailed, explicit for AI generation |
| `imageType` | ✅ | "diagram" \| "photo" | Determines rendering |
| `sectionColor` | ✅ | string | Hex from section (see below) |
| `actionCallout` | ✅ | object | `label` + `content` |
| `citations` | ⚠️ | number[] | Reference numbers |

---

## STEAM-IE Sections & Colors

| Section | Eyebrow | Hex Color | Focus |
|---------|---------|-----------|-------|
| Science | S | `#e61358` | Core natural, chemical, biological, physical principles |
| Technology | T | `#ed7d1f` | Monitoring tools, hardware, software, sensors, meters |
| Engineering | E | `#a0c82f` | Physical assembly, structural framing, piping, spatial layout |
| Arts | A | `#32b5d3` | Visual layout, ergonomics, lighting, branding, packaging |
| Mathematics | M | `#b44b97` | Yield metrics, unit economics, cost per unit, break-even |
| Innovation | I | `#306a50` | Local material substitutions, hacks, hybrid systems |
| Entrepreneurship | IE | `#5441ff` | Target buyers, pricing, cash flow, startup capital, records |

---

## Validation Rules

### Hard Errors (workflow stops)
- Missing required fields: `title`, `slug`, `author`, `series`, `pages`
- `slug` not lowercase/hyphenated
- `pages` array empty
- Page `no` not sequential starting at 1
- Page `section` not one of 7 valid sections
- Page missing `title`, `imagePrompt`, or `actionCallout`
- `imageType` not "diagram" or "photo"

### Warnings (workflow continues)
- Missing `subtitle`, `editionLabel`, `audience`, `primaryLocation`, `coverImage`
- Page missing `subtitle` or `citations`
- `sectionColor` doesn't match declared section

---

## Complete Example (Minimal)

```json
{
  "title": "Solar Dryer for Fruit Processing",
  "slug": "solar-dryer-fruit-processing",
  "subtitle": "Preserving harvests with passive solar technology",
  "editionLabel": "First Edition",
  "author": "Prof. Frehun A. Demissie",
  "series": "STEAM-IE for Sustainable Agriculture",
  "audience": "Farmers and food processors",
  "primaryLocation": "Rural agricultural communities",
  "coverImage": "solar-dryer-cover.png",
  "pages": [
    {
      "no": 1,
      "section": "Science",
      "title": "Solar Energy Basics",
      "subtitle": "How sunlight becomes heat",
      "content": "Solar dryers capture sunlight and convert it to heat through the greenhouse effect. Transparent covers allow short-wave solar radiation to enter, where it's absorbed by dark surfaces and re-radiated as long-wave infrared that cannot easily escape. This trapped heat raises the internal temperature, creating the drying environment necessary for food preservation without spoilage or nutrient loss.",
      "imagePrompt": "Cross-section diagram of a solar dryer showing sunlight entering through transparent cover, being absorbed by dark interior surfaces, and heat being trapped inside. Include labels for transparent cover, absorber plate, drying chamber, and vents. Style: technical vector diagram with clean lines and professional engineering aesthetic.",
      "imageType": "diagram",
      "sectionColor": "#e61358",
      "actionCallout": {
        "label": "BUILD THIS WEEKEND",
        "content": "Construct a simple solar dryer using a cardboard box, black paint, clear plastic wrap, and wire mesh. Paint the box interior black, cover the top with clear plastic, and place mesh trays inside for drying fruit slices."
      },
      "citations": [1, 2, 3]
    }
  ]
}
```

---

## Page Count Guidelines

- **Total pages**: 30–50 typical
- **Per section**: 4–8 pages minimum 3
- **Free samples**: 2–4 pages (usually first Science + first Entrepreneurship)

---

## Image Prompt Guidelines

### Diagram Prompts
- "Cross-section diagram of X showing Y"
- "Flowchart of process Z with steps labeled"
- "Before/after comparison of A vs B"
- Always include: "Style: technical vector diagram with clean lines, professional engineering aesthetic"

### Photo Prompts
- "Photograph of [physical subject] in [context], [lighting], [background]"
- Always include: "No text in image, no logos, neutral background"

---

## Citations

- Array of reference numbers (integers)
- Correspond to sources referenced in content
- Can be placeholder [1], [2], [3] during generation
- Handled by ideas-to-book pipeline at Gate 3 (preserve/footnotes/references/remove)