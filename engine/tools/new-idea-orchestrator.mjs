#!/usr/bin/env node
// new-idea-orchestrator.mjs — Core stage engine for new-idea skill
// Pure logic: input → prompt → agent → validate → persist state

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const SKILL_DIR = path.resolve(PROJECT_ROOT, '.claude', 'skills', 'new-idea');
const PROMPTS_DIR = path.join(SKILL_DIR, 'prompts');
const SCHEMAS_DIR = path.join(SKILL_DIR, 'schemas');
const IDEAS_DIR = path.join(PROJECT_ROOT, 'ideas');
const WORK_DIR = path.join(IDEAS_DIR, '.work');
const STATE_FILE = path.join(WORK_DIR, 'new-idea-state.json');
const INBOX_FILE = path.join(IDEAS_DIR, 'inbox.json');
const OUTBOX_FILE = path.join(IDEAS_DIR, 'outbox.json');

const STAGE_NAMES = ['sector', 'subsector', 'outline', 'customize', 'generate', 'export'];
const STAGE_NUMBERS = { sector: 1, subsector: 2, outline: 3, customize: 4, generate: 5, export: 6 };

function ensureWorkDir() {
  if (!fs.existsSync(WORK_DIR)) {
    fs.mkdirSync(WORK_DIR, { recursive: true });
  }
}

function loadPrompt(stage) {
  const promptFile = path.join(PROMPTS_DIR, `stage${STAGE_NUMBERS[stage]}-${stage}.md`);
  if (!fs.existsSync(promptFile)) {
    throw new Error(`Prompt file not found: ${promptFile}`);
  }
  return fs.readFileSync(promptFile, 'utf-8');
}

function loadSchema() {
  const schemaFile = path.join(SCHEMAS_DIR, 'idea-file-format.json');
  if (!fs.existsSync(schemaFile)) {
    throw new Error(`Schema file not found: ${schemaFile}`);
  }
  return JSON.parse(fs.readFileSync(schemaFile, 'utf-8'));
}

function loadState() {
  ensureWorkDir();
  if (!fs.existsSync(STATE_FILE)) {
    return {
      sessionId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      currentStage: 'sector',
      stages: {},
      approvals: []
    };
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
}

function saveState(state) {
  ensureWorkDir();
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function buildPrompt(stage, input, history) {
  const promptTemplate = loadPrompt(stage);
  const now = new Date().toISOString();

  let prompt = promptTemplate
    .replace(/\{\{sector\}\}/g, input.sector || '')
    .replace(/\{\{subSector\}\}/g, input.subSector || '')
    .replace(/\{\{outline\}\}/g, JSON.stringify(input.outline || {}, null, 2))
    .replace(/\{\{answers\}\}/g, JSON.stringify(input.answers || {}, null, 2))
    .replace(/\{\{pages\}\}/g, JSON.stringify(input.pages || [], null, 2))
    .replace(/\{\{bookMetadata\}\}/g, JSON.stringify(input.bookMetadata || {}, null, 2))
    .replace(/\{\{feedback\}\}/g, JSON.stringify(input.feedback || {}, null, 2))
    .replace(/\{\{history\}\}/g, JSON.stringify(history || [], null, 2));

  // Inject system instructions from gemini_gem_book_engine_instructions_v02.md
  const systemInstructionsPath = path.join(PROJECT_ROOT, 'gemini_gem_book_engine_instructions_v02.md');
  let systemInstructions = '';
  if (fs.existsSync(systemInstructionsPath)) {
    systemInstructions = fs.readFileSync(systemInstructionsPath, 'utf-8');
  }

  return `${systemInstructions}\n\n---\n\n${prompt}`;
}

function validateOutput(stage, json) {
  const schema = loadSchema();

  // Stage-specific validation
  switch (stage) {
    case 'sector':
      if (!json.stage || json.stage !== 2) throw new Error('Expected stage: 2');
      if (!json.sector) throw new Error('Missing sector');
      if (!Array.isArray(json.subSectors) || json.subSectors.length === 0) {
        throw new Error('subSectors must be non-empty array');
      }
      for (const group of json.subSectors) {
        if (!group.category || !Array.isArray(group.items)) {
          throw new Error('Each subSector group must have category and items[]');
        }
        for (const item of group.items) {
          if (!item.name || !item.description) {
            throw new Error('Each subSector item must have name and description');
          }
        }
      }
      break;

    case 'subsector':
      if (!json.stage || json.stage !== 3) throw new Error('Expected stage: 3');
      if (!json.sector || !json.subSector) throw new Error('Missing sector or subSector');
      if (!Array.isArray(json.proposedPages) || json.proposedPages.length < 30) {
        throw new Error('proposedPages must have at least 30 pages');
      }
      for (const page of json.proposedPages) {
        if (!page.no || !page.section || !page.title || !page.imageType) {
          throw new Error('Each page must have no, section, title, imageType');
        }
        if (!['diagram', 'photo'].includes(page.imageType)) {
          throw new Error('imageType must be "diagram" or "photo"');
        }
        if (!['Science', 'Technology', 'Engineering', 'Arts', 'Mathematics', 'Innovation', 'Entrepreneurship'].includes(page.section)) {
          throw new Error(`Invalid section: ${page.section}`);
        }
      }
      break;

    case 'outline':
      if (!json.stage || json.stage !== 4) throw new Error('Expected stage: 4');
      if (!Array.isArray(json.customizationQuestions) || json.customizationQuestions.length < 3) {
        throw new Error('customizationQuestions must have at least 3 questions');
      }
      for (const q of json.customizationQuestions) {
        if (!q.id || !q.category || !q.question || !q.type) {
          throw new Error('Each question must have id, category, question, type');
        }
      }
      break;

    case 'customize':
      if (!json.stage || json.stage !== 5) throw new Error('Expected stage: 5');
      if (!Array.isArray(json.pages) || json.pages.length === 0) {
        throw new Error('pages array required');
      }
      for (const page of json.pages) {
        if (!page.no || !page.section || !page.title || !page.content || !page.imagePrompt || !page.imageType || !page.actionCallout) {
          throw new Error('Each page must have all required fields');
        }
        if (!page.actionCallout.label || !page.actionCallout.content) {
          throw new Error('actionCallout must have label and content');
        }
        if (!['diagram', 'photo'].includes(page.imageType)) {
          throw new Error('imageType must be "diagram" or "photo"');
        }
      }
      if (!json.bookMetadata || !json.bookMetadata.title || !json.bookMetadata.slug) {
        throw new Error('bookMetadata with title and slug required');
      }
      break;

    case 'generate':
      if (!json.stage || json.stage !== 6) throw new Error('Expected stage: 6');
      if (!Array.isArray(json.pages)) throw new Error('pages array required');
      for (const page of json.pages) {
        if (page.status !== 'approved') {
          throw new Error(`Page ${page.no} not approved: ${page.status}`);
        }
      }
      if (!json.allPagesApproved) throw new Error('allPagesApproved must be true');
      break;

    case 'export':
      // Final export validation against full schema
      if (!json.title || !json.slug || !json.author || !json.series || !Array.isArray(json.pages)) {
        throw new Error('Missing required fields in export');
      }
      if (!/^[a-z0-9-]+$/.test(json.slug)) {
        throw new Error('slug must be lowercase, hyphenated, no special chars');
      }
      for (const page of json.pages) {
        if (!page.no || !page.section || !page.title || !page.content || !page.imagePrompt || !page.imageType || !page.actionCallout) {
          throw new Error('Each page missing required fields');
        }
      }
      break;
  }

  return true;
}

async function runStage(stage, input) {
  const state = loadState();
  const history = buildHistory(state);

  // Build prompt
  const prompt = buildPrompt(stage, input, history);

  // Write to inbox
  const requestId = crypto.randomUUID();
  const inboxData = {
    requestId,
    stage: STAGE_NUMBERS[stage],
    timestamp: new Date().toISOString(),
    skill: 'new-idea',
    payload: input,
    history,
    prompt // full constructed prompt for agent
  };

  ensureWorkDir();
  fs.writeFileSync(INBOX_FILE, JSON.stringify(inboxData, null, 2));

  console.log(`[orchestrator] Stage ${stage}: wrote inbox.json (requestId: ${requestId})`);
  console.log(`[orchestrator] Waiting for agent response in outbox.json...`);

  // Wait for outbox response
  const response = await waitForOutbox(requestId);

  // Validate response
  try {
    validateOutput(stage, response.payload);
  } catch (e) {
    console.error(`[orchestrator] Validation failed: ${e.message}`);
    throw new Error(`Agent response validation failed: ${e.message}`);
  }

  // Persist state
  state.stages[stage] = {
    approved: true,
    approvedAt: new Date().toISOString(),
    data: response.payload
  };
  state.currentStage = getNextStage(stage);
  state.approvals.push({
    stage,
    approvedBy: 'human',
    at: new Date().toISOString()
  });
  saveState(state);

  console.log(`[orchestrator] Stage ${stage} completed and approved`);
  return response.payload;
}

function waitForOutbox(requestId) {
  return new Promise((resolve, reject) => {
    const timeout = 300000; // 5 minutes
    const startTime = Date.now();

    const checkInterval = setInterval(() => {
      if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error('Timeout waiting for agent response'));
        return;
      }

      if (!fs.existsSync(OUTBOX_FILE)) return;

      try {
        const outbox = JSON.parse(fs.readFileSync(OUTBOX_FILE, 'utf-8'));
        if (outbox.requestId === requestId) {
          clearInterval(checkInterval);
          resolve(outbox);
        }
      } catch {
        // ignore parse errors, keep waiting
      }
    }, 1000);
  });
}

function buildHistory(state) {
  const history = [];
  for (const stageName of STAGE_NAMES) {
    const stageData = state.stages[stageName];
    if (stageData && stageData.approved) {
      history.push({
        stage: STAGE_NUMBERS[stageName],
        role: 'user',
        content: stageData.data
      });
      history.push({
        stage: STAGE_NUMBERS[stageName],
        role: 'assistant',
        content: stageData.data
      });
    }
  }
  return history;
}

function getNextStage(stage) {
  const idx = STAGE_NAMES.indexOf(stage);
  if (idx === -1 || idx === STAGE_NAMES.length - 1) return stage;
  return STAGE_NAMES[idx + 1];
}

// CLI interface for direct invocation
async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage: node new-idea-orchestrator.mjs <stage> [input.json]');
    console.log('Stages:', STAGE_NAMES.join(', '));
    process.exit(1);
  }

  const stage = args[0];
  if (!STAGE_NAMES.includes(stage)) {
    console.error(`Invalid stage: ${stage}`);
    process.exit(1);
  }

  let input = {};
  if (args[1]) {
    try {
      input = JSON.parse(fs.readFileSync(args[1], 'utf-8'));
    } catch {
      input = JSON.parse(args[1]);
    }
  }

  try {
    const result = await runStage(stage, input);
    console.log(JSON.stringify(result, null, 2));
  } catch (e) {
    console.error(`Error: ${e.message}`);
    process.exit(1);
  }
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  main();
}

export { runStage, loadState, saveState, validateOutput, buildPrompt, STAGE_NAMES };