# Prep-Pages Automation — Detailed Analysis

**Date:** 2026-09-20
**Based on:** `prep-pages-automation.md` plan
**Status:** Code exists and is partially functional; analysis only, no edits.

---

## 1. What the plan intends

The `prep-pages` automation is an **optional, opt-in pipeline** that runs only when `--prep-page` is passed. It takes raw idea-file pages and rewrites them to fit a strict B5 canvas (176 × 250 mm) using an LLM, with human review at every step.

Core flow per page:

1. Initial render → `check.mjs` measures overflow.
2. For overflowing pages: build LLM context → get LLM proposal → user reviews (Accept/Edit/Regenerate/Skip/Quit).
3. If still overflowing: LLM recommends fixes → user applies or adjusts.
4. Final `check.mjs` must read 0mm.
5. Page is "locked" in the manifest with a `prepHistory` audit trail.

Without `--prep-page`, the automation uses raw idea-file content directly — no change in behaviour.

---

## 2. What is already implemented in code vs the plan

| Plan feature (prep-pages-automation.md) | Implemented? | Where | Notes |
|------------------------------------------|--------------|-------|-------|
| `--prep-page` flag in `ideas-to-book.mjs` | ✅ | `ideas-to-book.mjs` lines 345–392, 866 | Skips if flag absent; runs `prepPages()` if set |
| `--prep-page --force` flag | ✅ | `ideas-to-book.mjs` | `force` passed through options |
| LLM context package per page | ✅ | `context-builder.mjs` `buildPageContext()` | Includes VOICE.md, blocks.md, design rules, examples |
| Strict JSON output schema from LLM | ✅ | `llm-page-prep.mjs` `validateProposal()` | 12+ validation rules (title ≤3 words, subtitle ≤10, action ≤20, no nested spans, no em dashes, no emojis) |
| Per-page interactive CLI (Accept/Edit/Regenerate/Skip/Quit) | ✅ | `cli-interactive.mjs` `reviewPageCLI()` | Uses `prompts` library dropdown |
| Edit in `$EDITOR` flow | ✅ | `cli-interactive.mjs` lines 59–99, `prep-pages.mjs` `editInEditor()` | Opens temp file, reads back, validates |
| Regenerate with natural language instruction | ✅ | `cli-interactive.mjs` lines 102–110, `prep-pages.mjs` lines 277–285 | Passes instruction to `context.userInstruction` |
| Skip (use raw content for this page) | ✅ | `cli-interactive.mjs` `reviewPageCLI()` line 113 | Sets `prepared = null` |
| Quit (use raw for all remaining) | ✅ | `cli-interactive.mjs` `reviewPageCLI()` line 115 | Returns 'quit', `prepPages()` returns early |
| Overflow detection via `check.mjs` | ✅ | `page-validator.mjs` `checkPageOverflows()` | Spawns check.mjs, parses Unicode box output |
| LLM overflow analysis prompt | ✅ | `page-validator.mjs` `analyzeOverflow()` | Prompts for root causes, fixes, recommended |
| Fix recommendation with auto/manual classification | ✅ | `page-validator.mjs` | Each fix has `autoApplicable: true/false` |
| Auto-apply fixes (shorten closer, flatten spans, remove redundant) | ✅ | `cli-interactive.mjs` `applyFixesAutomatically()` | 3 fix types auto-applied |
| Manual fix for diagram height, page split, rewrite opener | ✅ (in plan) | User must choose in interactive menu | Auto-applied in code but flagged as manual in plan |
| `prepHistory` audit trail per page | ⚠️ Partial | `prep-pages.mjs` logs prep steps | Defined in plan but `prepHistory` array is not written to manifest in current code |
| Final `check.mjs` = 0mm guarantee | ✅ | `prep-pages.mjs` Phase 2 validation loop | Max 5 rounds of render→check→fix |
| Max 3 regenerations per page | ⚠️ Partial | `prep-pages.mjs` `maxAttempts = 3` | But loop continues until `prepared` is truthy, not just 3 times |
| Graceful fallback when LLM unavailable | ✅ | `llm-page-prep.mjs` line 15 | Returns `null` if no API key, logs message |
| Risk mitigation table | ✅ (plan only) | `prep-pages-automation.md` §10 | Implemented partially in code |

---

## 3. Bugs and issues in the implemented code

### 3.1 Critical: Duplicated code block in `prep-pages.mjs`

**Location:** Lines 152–231 are an exact duplicate of lines 53–149.

Both blocks are inside the `while (attempts < 3 && !prepared)` loop. On the first iteration, the code executes lines 53–149. On the second iteration (after a regeneration), it executes lines 53–149 AGAIN and then also the duplicate at lines 152–231. This means:

- Prompt files are written twice per iteration
- The wait loop runs twice
- User interaction happens twice per regeneration
- Variables like `prepared` can be set in the first block but then the code continues into the duplicate

**Fix:** Delete lines 152–231 entirely.

### 3.2 Critical: Broken while loop structure

The outer `while (attempts < 3 && !prepared)` at line 64 wraps everything from line 65 to line ~295. Inside it:

- Line 143–146: If no proposal received, `attempts++` then `continue` — correct.
- Line 226–229: If timeout, `attempts++` then `continue` — correct.
- Line 262–264: If accept, `prepared = proposal; break;` — correct.
- Line 286–288: If skip, `prepared = null; break;` — this BREAKS the while loop but doesn't increment attempts. This is fine since `prepared` is falsy and we exit.
- Line 289–291: If quit, returns early — fine.

But the structural issue is that lines 53–149 and lines 152–231 are BOTH inside the while loop body. The second block (152–231) is dead code in the sense that it would only run if the first block doesn't set `prepared` or exit the loop — but the first block always either sets `prepared` (accept), returns (quit), breaks with prepared (accept), or continues (regenerate). On a regenerate, it would run the first block again. The second block is never the first thing to execute.

The real problem is that on a regeneration, `attempts++` happens at line 285, then the while loop checks `attempts < 3`, and if still true, the entire body (both blocks) runs again. The duplicate block is just wasteful code that writes the same prompt file and waits for the same response again.

### 3.3 Critical: Windows path issue

**Location:** `prep-pages.mjs` line 448 (`path.join('/tmp', ...)`), `cli-interactive.mjs` line 61.

On Windows, `/tmp` doesn't exist. Should use `os.tmpdir()`.

### 3.4 Major: Editor fallback is Windows-only

**Location:** `cli-interactive.mjs` line 73: `process.env.EDITOR || 'notepad'`

Should use cross-platform editors or at minimum check the OS.

### 3.5 Major: `prepHistory` not persisted

The plan says each page should have:

```json
"prepHistory": [
  {"step": "llm-proposal", "timestamp": "...", "wordCount": 68},
  {"step": "user-edit", "timestamp": "...", "wordCount": 65},
  {"step": "overflow-fix", "timestamp": "...", "fixes": [1,2], "overflowBefore": 12, "overflowAfter": 0}
],
"finalOverflow": 0,
"approvedBy": "human",
"approvedAt": "2026-09-19T10:05:30Z"
```

The code does NOT write this structure to the manifest. The `prepPages` function at line 427 writes the manifest but without `prepHistory` on individual pages.

### 3.6 Major: "Coding agent" vs LLM confusion

The plan (`prep-pages-automation.md` §4) says this is an **LLM-driven** pipeline. The code at `prep-pages.mjs` lines 68–71 calls it a "Coding Agent":

```javascript
console.log(`\n[2/4] Coding Agent preparation with human-in-the-loop...`);
```

And the prompt file says `// Waiting for coding agent response at: ${responseFile}` (line 117).

The actual implementation waits for a JSON file to appear (lines 119–141) — this means the code is NOT calling an LLM directly but rather waiting for an external agent (another Claude Code session) to write the response. This is a different architecture than what the plan describes.

The LLM integration (`llm-page-prep.mjs`) is a separate module that COULD be used but is NOT called from `prep-pages.mjs`. The plan says the LLM is called inline; the code says it waits for a file.

**Two different approaches:**
- Plan: call LLM → get response → validate → present to user
- Code: write prompt file → wait for response file → validate → present to user

Both are valid but they are different. The code should be consistent with the plan or the plan should be updated.

### 3.7 Minor: Timeout value is too long

**Location:** `prep-pages.mjs` lines 121–141: `maxWaitAttempts = 300` with 1-second sleep = 300 seconds = 5 minutes per page.

For 42 pages with 12 needing prep, this could mean 60 minutes just waiting for LLM responses.

### 3.8 Minor: No progress indication during file polling

The wait loop at lines 124–141 only prints a message every 10 seconds. For a 5-minute timeout, the user sees:
- "Still waiting for coding agent... (10s)" at 10 seconds
- "Still waiting for coding agent... (20s)" at 20 seconds
- Nothing in between
- Then "Still waiting for coding agent... (300s)" at the end

### 3.9 Design: Validation loop is too rigid

**Location:** `prep-pages.mjs` Phase 2, lines 312–415.

The plan says:
- LLM recommends fixes
- User chooses auto-apply / manual / regenerate
- Classify fixes as auto vs manual

But the code at lines 350–414:
1. Calls `recommendFixes()` (LLM analysis)
2. Writes fix prompt file
3. Waits for "coding agent" response (not LLM directly)
4. If no response, tries `applyFixesCLI()` (which doesn't exist in the code — it's called but never defined!)

**Critical:** `applyFixesCLI()` at line 401 is called but never defined anywhere in the codebase. This will throw a runtime error if a fix response is not received and the timeout triggers.

### 3.10 Design: `$EDITOR` approach

The plan (§3.2 Edit Flow) says:
1. User chooses Edit → opens `$EDITOR` with proposal
2. User edits → re-validates

The code does this in `editInEditor()` and `reviewPageCLI()` but it has the `/tmp` path issue (§3.3) and reads back the entire file then uses regex to extract the HTML between HTML comments:

```javascript
const match = edited.match(/<!-- Title: .*? -->\n([\s\S]*?)\n<!-- Action:/);
```

This is fragile — if the user accidentally edits or removes the comments, the extraction fails silently and falls through to regenerate.

---

## 4. Plan vs code: detailed comparison

### 4.1 CLI integration

**Plan says:** `node engine/tools/ideas-to-book.mjs ideas/my-idea.md --prep-page`

**Code says:** ✅ Matches. `--prep-page` flag exists in `ideas-to-book.mjs`.

### 4.2 Stage gate placement

**Plan says:** Insert `prep` stage after `plan`, before `render`.

**Code says:** ✅ Matches. `STAGES` array at `ideas-to-book.mjs` line 37 has `'prep'` between `'plan'` and `'classify'`.

### 4.3 LLM context package

**Plan says:** Structured context with page identity, book-wide context, layout constraints, overflow data, design rules, examples.

**Code says:** ✅ `context-builder.mjs` `buildPageContext()` produces this structure. The keys match (pageNumber, title, section, originalSubtitle, originalContent, actionCallout, imagePrompt, bookTitle, series, voiceMd, blocksMd, pageWidth, pageHeight, diagramHeight, targetWords, maxWords, currentOverflow, currentWordCount, designRules, examples).

### 4.4 LLM output schema

**Plan says:** Strict JSON with title, subtitle, explainerHtml, actionLabel, actionContent, imageType, imagePrompt, keptConcepts, removedConcepts, wordCount, overflowPrediction.

**Code says:** ✅ `llm-page-prep.mjs` `validateProposal()` validates all these fields. `keptConcepts` and `removedConcepts` are in the prompt but NOT validated. This is a gap — the LLM could return them and they wouldn't cause validation failure.

### 4.5 Interactive CLI options

**Plan says:** Accept, Edit in $EDITOR, Regenerate, Skip, Quit.

**Code says:** ✅ `cli-interactive.mjs` `reviewPageCLI()` has exactly these 5 options.

### 4.6 Validation layer

**Plan says:** After prep → render → check. If overflow > 0mm, LLM analyzes and recommends fixes. Auto-applicable vs manual classification.

**Code says:** ⚠️ Partial. The structure exists in `prep-pages.mjs` Phase 2, but:
- `applyFixesCLI()` is called but not defined (§3.9)
- The fix application is delegated to a "coding agent" file-based approach, not direct LLM call
- Auto-applicable vs manual classification is not implemented in the interactive menu

### 4.7 Human-in-the-loop guarantee

**Plan says:** No text/image change reaches the book without explicit user approval.

**Code says:** ✅ `prepPages()` only sets `page.preparedContent` when the user accepts (line 262–264) or auto-accepts with `--auto` flag (line 249–257). With `--auto` flag, no human review happens per page — the plan doesn't explicitly address `--auto` but it's a reasonable shortcut for batch processing.

### 4.8 Audit trail

**Plan says:** Each page in manifest gets `prepHistory`, `finalOverflow`, `approvedBy`, `approvedAt`.

**Code says:** ❌ Not implemented. The code updates `page.preparedContent`, `page.preparedSubtitle`, etc. but does NOT write `prepHistory` per page. The manifest IS saved at line 427 but without prep history.

### 4.9 Examples from showcase

**Plan says:** Include examples (resting meat, the bloom, companion planting, packing cubes, golden hour).

**Code says:** ✅ `context-builder.mjs` `SHOWCASE_EXAMPLES` has exactly these 5 examples.

### 4.10 Design rules

**Plan says:** No em dashes, colour roles, SVG text fill, never shrink viewBox, opener starter phrase, 3-paragraph structure, action ≤20 words, subtitle ≤10 words, title ≤3 words.

**Code says:** ✅ `context-builder.mjs` `DESIGN_RULES` has exactly these 11 rules.

---

## 5. Architecture assessment

### 5.1 What the code actually does vs what the plan describes

The plan describes a **direct LLM call** architecture:
1. Build context → call LLM → get JSON → validate → present to user.

The code implements a **file-based agent** architecture:
1. Build context → write prompt file → wait for another agent/process to write response file → validate → present to user.

These are fundamentally different. The file-based approach has advantages (asynchronous, can use a separate coding agent session) but disadvantages (slow, fragile polling, no timeout control, hard to debug). The direct LLM approach is simpler and faster for short pages.

### 5.2 Module dependency chain

```
prep-pages.mjs
  ├── context-builder.mjs (buildPageContext)
  ├── page-validator.mjs (checkPageOverflows, validatePage, recommendFixes)
  ├── book-render.mjs (renderInterior)
  ├── llm-page-prep.mjs (NOT called — dead import path)
  └── cli-interactive.mjs (reviewPageCLI, reviewOverflowFixes, applyFixesAutomatically)
```

Note: `llm-page-prep.mjs` is NOT imported or called by `prep-pages.mjs`. It provides:
- `callLLM()` — generic LLM call
- `buildPrompt()` — builds the LLM prompt from context
- `validateProposal()` — validates LLM response
- `preparePageWithLLM()` — full LLM pipeline (not used)

This means the LLM integration module is fully built but completely unused by the prep pipeline. Either the plan should be updated to use it, or the module should be removed.

### 5.3 Separation of concerns

The modules are reasonably well separated:
- `context-builder.mjs` — context construction ONLY
- `llm-page-prep.mjs` — LLM interaction ONLY
- `page-validator.mjs` — overflow checking and validation ONLY
- `cli-interactive.mjs` — CLI interaction ONLY
- `prep-pages.mjs` — orchestration and file I/O

This is good. The issue is that `prep-pages.mjs` uses file-based polling instead of calling `llm-page-prep.mjs` directly.

---

## 6. Risks specific to the prep-pages plan

### 6.1 File-based polling is fragile

If the coding agent crashes, the response file is never written. The 300-second timeout fires, the page is skipped, and the user has no idea the agent failed.

### 6.2 No concurrent page preparation

Pages are processed one at a time. For 12 pages needing prep at 5 minutes each, that's 60 minutes minimum.

### 6.3 LLM API key not required

The `--prep-page` flag doesn't require an LLM API key. Without one, `preparePageWithLLM()` returns `null` and the page is skipped. But the code doesn't use `preparePageWithLLM()` at all — it uses the file-based approach. So the LLM integration is completely disconnected from the pipeline.

### 6.4 Overflow measurement depends on check.mjs output format

`page-validator.mjs` `parseCheckOutput()` parses Unicode box drawing characters (`│`) from check.mjs output. If check.mjs changes its output format (e.g., for wider screens, or different Unicode characters), the parser breaks silently and returns an empty map — meaning no pages are identified for prep.

### 6.5 Auto-accept bypasses human review

The `--auto` flag in `prepPages()` (line 249–257) auto-accepts ALL proposals without showing them to the user. The plan says human approval is mandatory. The `--auto` flag was probably added for batch processing but it violates the plan's golden rule: "No text/image change reaches the book without explicit user approval."

### 6.6 `--force` on prep-pages

The plan says overflow pages are processed when `check.mjs` reports overflow > 0mm, OR user forces with `--prep-page --force`. But `--force` in the orchestrator (`ideas-to-book.mjs`) means "re-approve stages even if already approved." It doesn't change prep-pages behaviour specifically. A page that previously had 0mm overflow won't be re-preped even with `--force`.

---

## 7. Comparison: Plan vs Implementation at a glance

| Aspect | Plan | Implementation | Match? |
|--------|------|---------------|--------|
| Trigger | `--prep-page` | `--prep-page` | ✅ |
| Default behaviour | Skip prep | Skip prep | ✅ |
| Overflow detection | `check.mjs` | `check.mjs` via `page-validator.mjs` | ✅ |
| LLM integration | Direct call | File-based polling | ⚠️ Different |
| Context source | VOICE.md, blocks.md, design rules, examples | Same | ✅ |
| Output validation | Strict JSON schema | Same | ✅ |
| Interactive review | Accept/Edit/Regenerate/Skip/Quit | Same | ✅ |
| Edit flow | $EDITOR temp file | Same (but /tmp path bug) | ⚠️ Bug |
| Overflow fixes | LLM recommends, user chooses | Same structure but `applyFixesCLI()` undefined | ❌ Bug |
| Audit trail | `prepHistory` per page | Not implemented | ❌ Missing |
| Human approval | Mandatory per page | Mandatory (unless `--auto`) | ⚠️ Flag bypasses |
| Final check | 0mm all pages | 0mm all pages (max 5 rounds) | ✅ |
| Timeout | Not specified | 300s per page (arbitrary) | ⚠️ No plan basis |

---

## 8. Summary

The `prep-pages-automation.md` plan is **mostly implemented** but has three critical issues:

1. **Duplicated code** in `prep-pages.mjs` (lines 152–231 duplicate 53–149)
2. **Undefined function** `applyFixesCLI()` called at line 401 but never defined
3. **Architecture mismatch** — the plan describes direct LLM calls but the code uses file-based polling, and the LLM module (`llm-page-prep.mjs`) is built but never called

Additionally, the `prepHistory` audit trail is not persisted, and the `/tmp` path will fail on Windows.

The plan and code diverge most significantly in **how the LLM is called**: the plan says "call the LLM and get a JSON response"; the code says "write a prompt file and wait for another agent to write a response file." Both work but the file-based approach is 5–10× slower and harder to debug.

The simplest path forward is to either:
- **A)** Replace the file-based polling with direct calls to `llm-page-prep.mjs` `preparePageWithLLM()`, OR
- **B)** Update the plan to document the file-based agent approach, remove references to "LLM" and use "coding agent" consistently.
