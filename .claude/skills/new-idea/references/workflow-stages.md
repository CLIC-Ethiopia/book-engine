# 6-Stage Workflow with Approval Gates (new-idea Skill)

The new-idea skill guides creation of a STEAM-IE book idea file through 6 gated stages. Each stage requires explicit human approval before proceeding.

---

## Stage-Gate System Overview

| Stage | Gate | Trigger | Approval Artifact | State Key |
|-------|------|---------|-------------------|-----------|
| 1. Sector Intake | Sector Chosen | User selects sector | 20 sub-sectors grouped | `sectorApproved` |
| 2. Sub-sector Selection | Sub-sector Chosen | User picks one | Full STEAM-IE outline | `subsectorApproved` |
| 3. Outline Review | Outline Approved | User confirms/edits | Customization questions | `outlineApproved` |
| 4. Customization | Answers Provided | User answers Qs | Page generation plan | `customizedApproved` |
| 5. Page Generation | Pages Approved | User reviews/edits | Finalized pages | `pagesApproved` |
| 6. Export | Final Approval | User approves all | Validated JSON file | `exportApproved` |

---

## State Persistence

### Web UI (Modal)
- `localStorage['new-book-draft']` — full draft state per stage
- `ideas/inbox.json` / `ideas/outbox.json` — file bridge to agent
- Resume: modal loads from localStorage on reopen

### Agent CLI
- `ideas/.work/new-idea-state.json` — approval timestamps, stage data
- Resume: `--resume` flag loads last approved stage

### State File Schema
```json
{
  "sessionId": "uuid",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601",
  "currentStage": 3,
  "stages": {
    "sector": { "approved": true, "approvedAt": "ISO8601", "data": {...} },
    "subsector": { "approved": true, "approvedAt": "ISO8601", "data": {...} },
    "outline": { "approved": true, "approvedAt": "ISO8601", "data": {...} },
    "customize": { "approved": false, "data": {...} },
    "generate": { "approved": false, "data": {...} },
    "export": { "approved": false }
  },
  "approvals": [
    { "stage": "sector", "approvedBy": "human", "at": "2026-10-10T..." },
    { "stage": "subsector", "approvedBy": "human", "at": "2026-10-10T..." }
  ]
}
```

---

## Stage Details

### Stage 1: Sector Intake
**Input:** User selects sector (text input or quick-pick chips)
**Agent Task:** Execute STAGE 2 of gemini_gem_book_engine_instructions_v02.md
**Output:** 20 sub-sectors grouped into 3-5 logical categories
**Approval:** User picks one sub-sector → advances to Stage 2

### Stage 2: Sub-sector Selection → Full Outline
**Input:** Chosen sub-sector
**Agent Task:** Execute STAGE 3 — propose page-by-page outline across 7 STEAM-IE chapters (30-50 pages)
**Output:** Complete outline with page titles, sections, image types, action callouts
**Approval:** User confirms/edits outline → advances to Stage 3

### Stage 3: Outline Review → Customization Questions
**Input:** Approved outline + user edits
**Agent Task:** Execute STAGE 4 — generate 3-5 clarifying questions
**Output:** Questions covering: geographic context, capital tier, audience level, image prefs, free samples
**Approval:** User answers questions → advances to Stage 4

### Stage 4: Customization → Page Generation Plan
**Input:** Customization answers
**Agent Task:** Execute STAGE 5 — generate page-by-page content with image prompts
**Output:** Detailed page specs matching idea-file-format.json schema
**Approval:** User reviews first batch → advances to Stage 5

### Stage 5: Page Generation → Review & Finalization
**Input:** Generated pages
**Agent Task:** Present pages for review, accept edits/regeneration requests
**Output:** Finalized pages with `status: "approved"`
**Approval:** User approves all pages (`allPagesApproved: true`) → advances to Stage 6

### Stage 6: Export → Validated JSON
**Input:** Finalized approved pages
**Agent Task:** Execute STAGE 6 — validate against schema, write to `ideas/<slug>.json`
**Output:** Complete validated JSON file ready for ideas-to-book pipeline
**Approval:** User confirms export → workflow complete

---

## Recovery & Rollback

### At Any Gate
- User can reject → returns to previous stage with data preserved
- User can cancel → draft saved, resume later
- `--resume` loads last approved stage

### State Recovery Menu
```
Stage 'generate' failed: agent timeout on page 12

Options:
1) Retry this page
2) Regenerate this page with different prompt
3) Skip this page (mark as placeholder)
4) Go back to Stage 4 (re-answer customization)
5) Cancel — keep all progress so far
```

### Approval State Tracking
- Each approval records: stage, approvedBy (human), timestamp
- Crash mid-workflow: `--resume` continues from last `approved: true` stage
- Never deletes files outside the working draft

---

## File Bridge Integration

Both entry points (Web UI modal, Agent CLI) use the same file bridge:

```
Entry Point          ideas/inbox.json           Coding Agent          ideas/outbox.json
────────────────────────────────────────────────────────────────────────────────────
Web UI / Agent CLI   {stage, payload,         Reads + builds        {stage+1, payload,
     │                history, skill}    ──────────────────►  prompt + invokes LLM    approvalRequired}
     │                                                                         │
     │                                                                         ▼
     │                                                      Writes response
     │                                                                         │
     ◄──────────────────────────────────────────────────────────────────────────┘
     polls
```

---

## CLI Commands
```bash
# Start new idea interactively
/new-idea

# Resume from last approved stage
/new-idea --resume

# Run specific stage only
/new-idea --stage outline

# List drafts in progress
/new-idea --list-drafts

# Force re-run stage
/new-idea --stage generate --force
```