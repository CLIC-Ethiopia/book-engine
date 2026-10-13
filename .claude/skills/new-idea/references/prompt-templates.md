# Prompt Templates (new-idea Skill)

How each of the 6 stages constructs its LLM prompt from the shared prompt files in `prompts/stageN.md`.

---

## Prompt Architecture

```
Full Prompt = System Instructions + Stage Template + History Injection + Output Schema
```

### Components

| Component | Source | Purpose |
|-----------|--------|---------|
| **System Instructions** | `gemini_gem_book_engine_instructions_v02.md` | Core persona, writing laws, STEAM-IE framework |
| **Stage Template** | `prompts/stageN.md` | Stage-specific task, input/output format |
| **History Injection** | `ideas/.work/new-idea-state.json` | Previous stage outputs, user choices |
| **Output Schema** | `schemas/idea-file-format.json` | Validation target for agent response |

---

## Stage Prompt Construction

### Stage 1: Sector Intake → Sub-sectors
**Prompt File:** `prompts/stage1-sector.md`

```
[SYSTEM INSTRUCTIONS from gemini_gem_book_engine_instructions_v02.md]

[STAGE 1 TEMPLATE from prompts/stage1-sector.md]
- User's chosen sector: {{sector}}
- Conversation history: {{history}}

[OUTPUT SCHEMA]
{
  "stage": 2,
  "sector": "{{sector}}",
  "subSectors": [{ "category": "", "items": [{ "name": "", "description": "", "icon": "" }] }]
}
```

**Key Injection Points:**
- `{{sector}}` — User's sector choice
- `{{history}}` — Prior conversation (empty for Stage 1)

---

### Stage 2: Sub-sector → Full Outline
**Prompt File:** `prompts/stage2-subsector.md`

```
[SYSTEM INSTRUCTIONS]

[STAGE 2 TEMPLATE from prompts/stage2-subsector.md]
- User's chosen sector: {{sector}}
- User's chosen sub-sector: {{subSector}}
- Conversation history: {{history}}

[OUTPUT SCHEMA]
{
  "stage": 3,
  "sector": "{{sector}}",
  "subSector": "{{subSector}}",
  "proposedPages": [{ "no": 1, "section": "Science", "title": "", "subtitle": "", "imageType": "", "imagePrompt": "", "actionCalloutLabel": "", "actionCalloutContent": "" }],
  "totalPages": 35,
  "estimatedFreeSamples": 2
}
```

**Key Injection Points:**
- `{{sector}}`, `{{subSector}}` — User choices from Stages 1-2
- `{{history}}` — Full conversation including Stage 1 output

---

### Stage 3: Outline → Customization Questions
**Prompt File:** `prompts/stage3-outline.md`

```
[SYSTEM INSTRUCTIONS]

[STAGE 3 TEMPLATE from prompts/stage3-outline.md]
- User's chosen sector: {{sector}}
- User's chosen sub-sector: {{subSector}}
- Approved/edited outline: {{outline}}
- Conversation history: {{history}}

[OUTPUT SCHEMA]
{
  "stage": 4,
  "sector": "{{sector}}",
  "subSector": "{{subSector}}",
  "customizationQuestions": [
    { "id": "", "category": "", "question": "", "type": "text|select", "options": [], "required": true, "helpText": "" }
  ]
}
```

**Key Injection Points:**
- `{{outline}}` — Full approved outline from Stage 2 (user may have edited)
- `{{history}}` — All prior stages

---

### Stage 4: Customization → Page Generation Plan
**Prompt File:** `prompts/stage4-customize.md`

```
[SYSTEM INSTRUCTIONS]

[STAGE 4 TEMPLATE from prompts/stage4-customize.md]
- User's chosen sector: {{sector}}
- User's chosen sub-sector: {{subSector}}
- Approved outline: {{outline}}
- Customization answers: {{answers}}
- Conversation history: {{history}}

[OUTPUT SCHEMA]
{
  "stage": 5,
  "sector": "{{sector}}",
  "subSector": "{{subSector}}",
  "pages": [
    {
      "no": 1,
      "section": "Science",
      "title": "",
      "subtitle": "",
      "content": "",
      "imagePrompt": "",
      "imageType": "",
      "sectionColor": "",
      "actionCallout": { "label": "", "content": "" },
      "citations": []
    }
  ],
  "bookMetadata": { "title": "", "slug": "", "subtitle": "", "editionLabel": "", "author": "", "series": "", "audience": "", "primaryLocation": "", "coverImage": "" }
}
```

**Key Injection Points:**
- `{{answers}}` — User's responses to Stage 3 questions
- `{{outline}}` — Approved outline
- `{{history}}` — Full context

---

### Stage 5: Page Review → Finalization
**Prompt File:** `prompts/stage5-generate.md`

```
[SYSTEM INSTRUCTIONS]

[STAGE 5 TEMPLATE from prompts/stage5-generate.md]
- Generated pages from Stage 4: {{pages}}
- Book metadata: {{bookMetadata}}
- User's review feedback: {{feedback}}
- Conversation history: {{history}}

[OUTPUT SCHEMA]
{
  "stage": 6,
  "sector": "{{sector}}",
  "subSector": "{{subSector}}",
  "pages": [
    { "no": 1, "section": "", "title": "", "subtitle": "", "content": "", "imagePrompt": "", "imageType": "", "sectionColor": "", "actionCallout": { "label": "", "content": "" }, "citations": [], "status": "approved" }
  ],
  "bookMetadata": { ... },
  "allPagesApproved": true
}
```

**Key Injection Points:**
- `{{feedback}}` — User's edit/regeneration requests (empty on first pass)
- `{{pages}}` — Generated pages from Stage 4
- `{{bookMetadata}}` — Title, slug, author, etc.

---

### Stage 6: Final Export
**Prompt File:** `prompts/stage6-export.md`

```
[SYSTEM INSTRUCTIONS]

[STAGE 6 TEMPLATE from prompts/stage6-export.md]
- Finalized pages: {{pages}} (all status: "approved")
- Book metadata: {{bookMetadata}}
- Conversation history: {{history}}

[OUTPUT SCHEMA]
{
  "title": "", "slug": "", "subtitle": "", "editionLabel": "",
  "author": "", "series": "", "audience": "", "primaryLocation": "",
  "coverImage": "",
  "pages": [
    { "no": 1, "section": "", "title": "", "subtitle": "", "content": "", "imagePrompt": "", "imageType": "", "actionCallout": { "label": "", "content": "" }, "citations": [] }
  ]
}
```

**Key Injection Points:**
- `{{pages}}` — All pages with `status: "approved"`
- `{{bookMetadata}}` — Complete metadata
- `{{history}}` — Full context for consistency check

---

## History Injection Format

The `{{history}}` variable contains the complete conversation as a structured array:

```json
[
  { "stage": 1, "role": "user", "content": "Smart Agriculture" },
  { "stage": 1, "role": "assistant", "content": { "stage": 2, "sector": "Smart Agriculture", "subSectors": [...] } },
  { "stage": 2, "role": "user", "content": "Solar Dryer for Fruit Processing" },
  { "stage": 2, "role": "assistant", "content": { "stage": 3, "proposedPages": [...] } },
  { "stage": 3, "role": "user", "content": "Approved outline with edit: add page on X" },
  { "stage": 3, "role": "assistant", "content": { "stage": 4, "customizationQuestions": [...] } },
  { "stage": 4, "role": "user", "content": { "geo": "Ethiopian highlands", "capital": "pilot", "audience": "vocational" } },
  ...
]
```

---

## Validation Loop

After each agent response, the orchestrator:

1. **Parses JSON** from agent output (strips markdown if present)
2. **Validates** against `schemas/idea-file-format.json`
3. **On success**: Persists to state, returns to caller
4. **On failure**: Returns validation errors to agent with "fix and resend" instruction

### Common Validation Failures
| Failure | Recovery |
|---------|----------|
| Missing required fields | Re-prompt with specific missing fields |
| Invalid section name | Re-prompt with valid section list |
| Non-sequential page numbers | Re-prompt with correct sequence |
| Invalid imageType | Re-prompt with "diagram" or "photo" |
| Malformed JSON | Return raw output, ask agent to fix JSON only |

---

## Prompt Engineering Principles

1. **Single Responsibility** — Each stage prompt does ONE thing
2. **Explicit Output Schema** — Agent knows exact JSON structure
3. **History Context** — Full conversation prevents contradictions
4. **Validation Loop** — Invalid output triggers automatic retry
5. **No Hallucination** — Agent must use provided history, not invent