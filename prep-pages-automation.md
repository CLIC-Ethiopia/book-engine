# Prep-Pages Automation Plan

## Overview

`prep-pages.mjs` becomes an **optional, LLM-driven, human-in-the-loop content preparation pipeline** that runs only when explicitly requested via `--prep-page` flag. It transforms raw idea-file pages into B5-compliant pages using an LLM agent with full context, interactive user approval, and overflow resolution loop.

---

## 1. CLI Integration

### New Flag in `ideas-to-book.mjs`

```bash
node engine/tools/ideas-to-book.mjs ideas/my-idea.md --prep-page
# Without flag: uses raw idea-file content directly (current behavior)
```

### Automation Workflow Changes


| Stage                   | Without `--prep-page`    | With `--prep-page`               |
| ----------------------- | ------------------------ | -------------------------------- |
| Parse                   | Raw idea file → manifest | Raw idea file → manifest         |
| Prep                    | **Skip**                 | Run `prep-pages.mjs` pipeline    |
| Render                  | Manifest → interior HTML | Prepped manifest → interior HTML |
| Build/Check/Shot/Export | Standard                 | Standard                         |


### Stage Gate Addition

Add new stage `prep` in `STAGES` array (after `plan`, before `render`):

```javascript
const STAGES = [
  'list',
  'parse',
  'scaffold',
  'plan',
  'prep',           // NEW: only if --prep-page
  'render',
  'classify',
  'generate',
  'build',
  'check',
  'screenshot',
  'approveScreenshots',
  'export',
];
```

---

## 2. LLM-Driven Page Preparation (Opt-In Only)

### Trigger Condition

Only runs for pages where `check.mjs` reports **overflow &gt; 0mm** after initial render, OR user forces with `--prep-page --force`.

### LLM Context Package (Per Page)

The LLM receives a structured context object:

```javascript
{
  // Page identity
  pageNumber: 01,
  title: "Soil Mechanics Composition",
  section: "Science",
  originalSubtitle: "Test local soil fractions...",
  originalContent: "## Soil Mechanics Composition\n#### ...",
  actionCallout: { label: "DO THIS TODAY", content: "Collect three..." },
  imagePrompt: "Clean technical vector diagram...",
  
  // Book-wide context
  bookTitle: "Interlocking Compressed Earth Blocks",
  series: "STEAM-IE",
  voiceMd: "<contents of VOICE.md>",
  blocksMd: "<relevant sections from blocks.md>",
  
  // Layout constraints
  pageWidth: 176,  // mm
  pageHeight: 250, // mm
  diagramHeight: 150, // px placeholder
  targetWords: 65,   // explainer budget
  maxWords: 85,      // absolute max with color roles
  
  // Current overflow data (from check.mjs)
  currentOverflow: 28, // mm
  currentWordCount: 72,
  
  // Design rules (from block skill references)
  designRules: [
    "No em dashes. Use commas or full stops only.",
    "Color is a role: .bad=red, .hl=indigo, .good=teal, .amber=amber",
    "Every SVG <text> needs explicit fill",
    "Never shrink viewBox to fit—cut words instead",
    "Opener must start with 'Let's say...' or similar starter phrase matching he context of the title",
    "3 paragraphs: opener+pain, mechanism+outcome, closer",
    "Action: imperative, ≤20 words, one complete sentence, two short sentences that must fit in two     lines",
    "Subtitle: ≤10 words, plain descriptor",
    "Title: ≤3 words, concept name only"
  ],
  
  // Examples from showcase book
  examples: [
    { title: "Resting meat", 
      Subtitle: "Why you wait before you cut", 
      explainer: "Let's say you pull a steak off the pan and cut it right away.
                  The juice runs out over the board, and what's left on your
                  plate is dry.
                  Heat pushes the juice toward the middle of the meat. Give it a
                  few minutes off the heat and it settles back through the whole
                  piece . Same steak, nothing lost to the board.
                  The waiting is part of the cooking.", 
      action: "Take it off the heat, put it on a warm plate, cover it loosely. Five minutes
               for a steak, fifteen for a roast. Then cut."
    },
    { title: "The bloom", 
      Subtitle: "The first pour, and why it is small", 
      explainer: "Let's say your coffee keeps coming out thin and sour, and
                  you've already tried grinding finer. Fresh grounds are full of
                  gas , and gas pushes water away, so most of your pour runs
                  past the coffee.
                  Wet them with a splash first, twice the weight of the coffee,
                  and wait. The bed puffs into a dome and the bubbles stop. Now the water can get in.
                  Thirty seconds, and the rest of the pour finally works.", 
      action: "Pour twice the coffee's weight in water, just enough to wet everything.
               Wait thirty seconds. Then pour the rest."
    },
  ]
}
```

### LLM Output Schema (Strict JSON)

```json
{
  "title": "Soil Mechanics",           // ≤3 words, unchanged unless user requests
  "subtitle": "The principle behind soil composition & compaction",      // ≤10 words, plain descriptor
  "explainerHtml": "<p>Let's say...</p>\n<p>...<span class=\"hl\">mechanism</span>...<span class=\"good\">outcome</span>...</p>\n<p class=\"close\">The waiting is part of the process.</p>",
  "actionLabel": "DO THIS TODAY",
  "actionContent": "Collect three soil samples at 50cm depth and run a 24-hour jar test.",
  "imageType": "diagram",
  "imagePrompt": "Clean technical vector diagram...",
  "keptConcepts": ["moisture equilibrium", "jar test", "vapor pressure"],
  "removedConcepts": ["psychrometric curves", "capillary action details"],
  "wordCount": 68,
  "overflowPrediction": 0
}
```

---

## 3. Interactive CLI Per Page

### Page Review Loop (for each page with overflow &gt; 0)

```
═══════════════════════════════════════════
Page 1: Soil Mechanics Composition (Science)
Current overflow: 28mm | Words: 72 | Target: 65
══════════════════════════════════════════

LLM Proposal:
──────────────────
Title: Soil Mechanics 
Subtitle: The principle behind soil composition & compaction

Explainer:
Let's say you're mixing soil for blocks and the mix turns to soup.
<span class="bad">Too much clay</span> acts like a sponge, <span class="hl">holding water</span> that should escape.
<span class="good">Balanced sand/silt/clay</span> lets water drain while holding shape.

Closer: The right ratio does the work for you.

Action: DO THIS TODAY — Collect three soil samples at 50cm depth and run a 24-hour jar test.
Image: diagram — Clean technical vector diagram showing jar sediment test...
──────────────────

Options:
  [A] Accept as-is
  [E] Edit in $EDITOR (opens temp file with proposal)
  [R] Regenerate with instruction: "make opener more specific to soil testing"
  [S] Skip this page (use raw content for this page only and go to next page prep)
  [Q] Quit prep, continue with raw content for all remaining pages
> 
```

### Edit Flow

1. **Accept** → Save to manifest, continue to next page
2. **Edit** → Opens `$EDITOR` with proposal markdown; user edits; re-validates
3. **Regenerate** → User provides natural language instruction; LLM re-proposes
4. **Skip** → Uses raw idea-file content for current page only (no prep) and loads next page that needs prep
5. **Quit** → Aborts prep, continues pipeline with raw content for all remaining pages

---

## 4. Validation Layer with Overflow Resolution

### After Prep → Render → Check

```bash
node engine/tools/check.mjs books/<slug>/book.html
```

### If Overflow &gt; 0mm

```
⚠️  Page 1 overflow: 12mm (target: 0mm)
Words: 48 | Target: 65 | Diagram: 150px

LLM Analysis:
──────────────────
Root cause: Closer sentence too long (+8 words), paragraph 2 has nested color spans (+4 words)

Recommended fixes:
1. Shorten closer to "The right ratio does the work." (-6 words)
2. Flatten nested spans in paragraph 2 (-4 words)
3. Reduce diagram height to 120px (-3mm equivalent)

Options:
  [A] Apply fix #1 automatically
  [B] Apply fix #1 + #2 automatically  
  [C] Apply all three fixes automatically 
  [D] Edit manually in $EDITOR
  [E] Regenerate with instruction: "cut 10 words from closer, flatten spans"
  [F] Reduce diagram to 120px and re-check
  [G] Accept overflow (not recommended)
  [H] Split page into Part A / Part B
> 
```

### LLM Recommendation Agent

A lightweight prompt that analyzes overflow and proposes specific fixes:

```javascript
const overflowAnalysisPrompt = `
Page content: ${html}
Overflow: ${overflow}mm
Word count: ${words} (target: 65)
Diagram height: ${diagramHeight}px

Analyze and return JSON:
{
  "rootCauses": ["closer too long", "nested spans"],
  "fixes": [
    {"id": 1, "description": "Shorten closer to 8 words", "wordSavings": 6, "autoApplicable": true},
    {"id": 2, "description": "Flatten nested spans", "wordSavings": 4, "autoApplicable": true},
    {"id": 3, "description": "Reduce diagram to 120px", "mmSavings": 3, "autoApplicable": false}
  ],
  "recommended": [1, 2]
}
`;
```

### Auto-Apply vs Manual


| Fix Type                   | Auto-Applicable | Requires User     |
| -------------------------- | --------------- | ----------------- |
| Shorten closer sentence    | ✅               | ❌                 |
| Flatten nested color spans | ✅               | ❌                 |
| Remove redundant words     | ✅               | ❌                 |
| Reduce diagram height      | ❌               | ✅ (visual impact) |
| Split page (Part A/B)      | ❌               | ✅                 |
| Rewrite opener             | ❌               | ✅ (voice change)  |


---

## 5. Human-in-the-Loop Guarantee

### Golden Rule

**No text/image change reaches the book without explicit user approval.**

### Approval Gates

1. **LLM Proposal** → User sees full proposal
2. **User Action** → Accept / Edit / Regenerate / Skip / Quit
3. **Validation** → If overflow, LLM recommends fixes
4. **Fix Approval** → User chooses auto-apply / manual / regenerate
5. **Final Check** → `check.mjs` confirms 0mm overflow
6. **Page Locked** → Added to manifest, immutable

### Audit Trail

Each page in manifest gets:

```json
{
  "title": "Soil Mechanics Composition",
  "preparedContent": "...",
  "prepHistory": [
    {"step": "llm-proposal", "timestamp": "2026-09-19T10:00:00Z", "wordCount": 68},
    {"step": "user-edit", "timestamp": "2026-09-19T10:02:00Z", "wordCount": 65},
    {"step": "overflow-fix", "timestamp": "2026-09-19T10:05:00Z", "fixes": [1,2], "overflowBefore": 12, "overflowAfter": 0}
  ],
  "finalOverflow": 0,
  "approvedBy": "human",
  "approvedAt": "2026-09-19T10:05:30Z"
}
```

---

## 6. File Structure

```
engine/tools/
├── prep-pages.mjs           # Main orchestrator (NEW)
├── llm-page-prep.mjs        # LLM prompt/response handling
├── page-validator.mjs       # Overflow analysis + fix recommendations
├── cli-interactive.mjs      # Interactive page review CLI
├── context-builder.mjs      # Builds LLM context per page
└── text-utils.mjs           # countWords, extractSentences, stripMarkdown (shared)
```

---

## 7. Implementation Phases

### Phase 1: Core Orchestrator

- [ ] Add `--prep-page` flag to `ideas-to-book.mjs`
- [ ] Create `prep-pages.mjs` skeleton with stage gate
- [ ] Integrate `--prep-page` into automation workflow

### Phase 2: LLM Pipeline

- [ ] `context-builder.mjs` — builds LLM context per page
- [ ] `llm-page-prep.mjs` — sends prompt, parses/validates JSON
- [ ] `context-builder` loads VOICE.md, blocks.md, design rules
- [ ] JSON schema validation (Zod or manual)

### Phase 3: Interactive CLI

- [ ] `cli-interactive.mjs` — page review loop with prompts
- [ ] Editor integration (`$EDITOR` temp file)
- [ ] Regeneration with user instructions
- [ ] Skip/Quit handling

### Phase 4: Validation &amp; Overflow Resolution

- [ ] `page-validator.mjs` — runs check.mjs, analyzes overflow
- [ ] LLM overflow analysis prompt + parser
- [ ] Fix recommendation engine (auto vs manual classification)
- [ ] Fix application (auto for text, manual for diagram)

### Phase 5: Audit &amp; Integration

- [ ] `prepHistory` tracking in manifest
- [ ] End-to-end test with `--prep-page --force`
- [ ] Regression test: without flag = current behavior
- [ ] Documentation in AGENTS.md

---

## 7. Key Design Decisions


| Decision                             | Rationale                                                         |
| ------------------------------------ | ----------------------------------------------------------------- |
| Opt-in only (`--prep-page`)          | Preserves current workflow; no breaking changes                   |
| LLM-only (no deterministic fallback) | Deterministic code caused repetition/errors; LLM handles nuance   |
| Per-page interactive                 | Overflow is per-page; batch approval misses nuance                |
| Human approval mandatory             | Quality guarantee; prevents silent degradation                    |
| LLM recommends, human decides        | LLM hallucinates; human catches voice/accuracy issues             |
| Overflow fixes classified            | Auto-apply safe fixes; human decides on visual/structural changes |
| Full audit trail                     | Debugging, reproducibility, accountability                        |


---

## 8. Example Session

```bash
$ node engine/tools/ideas-to-book.mjs ideas/soil-blocks.md --prep-page

=== Preparing Pages (LLM) ===
Pages with overflow: 1, 3, 7, 12, 15, 23, 28, 31, 34, 38, 41, 45

═══ Page 1: Soil Mechanics Composition ═══
Overflow: 28mm | Words: 72 | Target: 65

LLM Proposal:
Title: Soil Mechanics Composition
Subtitle: The principle behind it
Explainer: <p>Let's say...</p>...
Action: DO THIS TODAY — Collect three soil samples...

[E]dit / [A]ccept / [R]egenerate / [S]kip / [Q]uit > A

✅ Page 1 accepted (38 words)

═══ Page 3: Cement Lime Hydration ═══
Overflow: 15mm | Words: 78 | Target: 65

LLM Proposal: ...

> R
Regeneration instruction: > make opener about cement specifically, not generic testing

LLM Re-proposal: ...

> A

...

=== Validation ===
Running check.mjs...
Page 1: 0mm ✓
Page 3: 0mm ✓
...
All pages 0mm. Prep complete.

=== Continuing to Render ===
```

---

## 9. Acceptance Criteria

- [ ] `--prep-page` flag added, off by default
- [ ] Without flag: identical to current behavior
- [ ] With flag: only overflow pages processed
- [ ] LLM context includes VOICE.md, blocks.md, design rules
- [ ] LLM returns strict JSON schema
- [ ] Interactive CLI with Accept/Edit/Regenerate/Skip/Quit
- [ ] Regeneration accepts natural language instructions
- [ ] Overflow detection runs check.mjs automatically
- [ ] LLM recommends specific fixes (auto vs manual)
- [ ] User chooses fix strategy per page
- [ ] All changes require explicit user acceptance
- [ ] `prepHistory` recorded in manifest
- [ ] Final `check.mjs` = 0mm all pages
- [ ] Without `--prep-page`: zero behavior change
- [ ] Unit tests for context builder, JSON parser, CLI flow
- [ ] Integration test: full pipeline with `--prep-page --force`

---

## 10. Risk Mitigation


| Risk                     | Mitigation                                             |
| ------------------------ | ------------------------------------------------------ |
| LLM hallucination        | Strict JSON schema; human approval gate                |
| Infinite regen loop      | Max 3 regenerations per page                           |
| LLM API failure          | Graceful fallback: "LLM unavailable, use raw content"  |
| User quits mid-prep      | Save progress; resume with `--resume`                  |
| Voice drift across pages | VOICE.md in every prompt; examples from showcase       |
| Color role nesting       | LLM outputs pre-validated HTML; post-validate flattens |
| Diagram overflow         | Separate fix path (reduce height / split page)         |


---

*End of Plan* — Ready for implementation when approved.