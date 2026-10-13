---
name: new-idea
description: Guides interactive creation of a STEAM-IE book idea file through a 6-stage human-AI workflow. Works from Web UI modal or agent CLI. Outputs validated JSON to ideas/ folder ready for ideas-to-book pipeline.
---

# new-idea Skill

Creates book idea files via 6-stage STEAM-IE workflow:
1. **Sector Intake** — Choose industrial sector
2. **Sub-sector Selection** — 20 options grouped logically
3. **Outline Proposal** — Page-by-page across 7 STEAM-IE chapters
4. **Customization** — Location, capital, audience, image prefs
5. **Generation** — Page-by-page content with image prompts
6. **Export** — Validated JSON to ideas/<slug>.json

## When to Invoke

- User clicks "New Book" in Web UI
- User types `/new-idea` in agent session
- User says "create a new book idea" or "start a STEAM-IE book"

## Dual Entry Points

| Entry Point | Trigger | UI/UX |
|-------------|---------|-------|
| **Web UI** | "New Book" button click | Floating modal with stepper |
| **Agent CLI** | `/new-idea` or skill invocation | Interactive terminal prompts |

Both invoke the **same stage logic** via shared prompts in `prompts/stageN.md`.

## Stage-Gate System (Mirroring ideas-to-book)

Each stage requires human approval before proceeding. State persisted in:
- **Web UI**: `localStorage['new-book-draft']` + `ideas/inbox.json`
- **Agent**: `ideas/.work/new-idea-state.json` (approval timestamps)

### Stages (in order)
1. **`sector`** — User picks sector → agent proposes 20 sub-sectors
2. **`subsector`** — User picks one → agent proposes full outline
3. **`outline`** — User confirms/edits → agent asks customization Qs
4. **`customize`** — User answers → agent generates pages
5. **`generate`** — User reviews/edits pages → agent finalizes
6. **`export`** — User approves → write `ideas/<slug>.json`

## CLI Reference (Agent Session)
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

## Shared Prompts (Source of Truth)
All prompts live in `.claude/skills/new-idea/prompts/` and `.agents/skills/new-idea/prompts/` (identical copies). The Web UI bridge handler and agent CLI both load these prompts to construct the LLM request.