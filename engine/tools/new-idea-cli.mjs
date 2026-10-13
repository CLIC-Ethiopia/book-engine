#!/usr/bin/env node
// new-idea-cli.mjs — CLI entry point for new-idea skill
// Interactive terminal interface for agent sessions

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const SKILL_DIR = path.resolve(PROJECT_ROOT, '.claude', 'skills', 'new-idea');
const PROMPTS_DIR = path.join(SKILL_DIR, 'prompts');
const SCHEMAS_DIR = path.join(SKILL_DIR, 'schemas');
const IDEAS_DIR = path.join(PROJECT_ROOT, 'ideas');
const WORK_DIR = path.join(IDEAS_DIR, '.work');
const STATE_FILE = path.join(WORK_DIR, 'new-idea-state.json');

const STAGE_NAMES = ['sector', 'subsector', 'outline', 'customize', 'generate', 'export'];
const STAGE_NUMBERS = { sector: 1, subsector: 2, outline: 3, customize: 4, generate: 5, export: 6 };

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

function ensureWorkDir() {
  if (!fs.existsSync(WORK_DIR)) {
    fs.mkdirSync(WORK_DIR, { recursive: true });
  }
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

function loadPrompt(stage) {
  const promptFile = path.join(PROMPTS_DIR, `stage${STAGE_NUMBERS[stage]}-${stage}.md`);
  if (!fs.existsSync(promptFile)) {
    throw new Error(`Prompt file not found: ${promptFile}`);
  }
  return fs.readFileSync(promptFile, 'utf-8');
}

function buildHistory(state) {
  const history = [];
  for (const stageName of ['sector', 'subsector', 'outline', 'customize', 'generate', 'export']) {
    const stageData = state.stages[stageName];
    if (stageData && stageData.approved) {
      history.push({ role: 'user', content: stageData.data });
      history.push({ role: 'assistant', content: stageData.data });
    }
  }
  return history;
}

async function runStageInteractive(stage, state) {
  const stageNum = STAGE_NUMBERS[stage];
  console.log(`\n=== STAGE ${stageNum}: ${stage.toUpperCase()} ===`);

  const history = buildHistory(state);
  const input = getStageInput(stage, state);

  // Load and display the prompt for this stage
  const promptTemplate = fs.readFileSync(
    path.join(PROMPTS_DIR, `stage${stageNum}-${stage}.md`),
    'utf-8'
  );

  console.log('\n--- Agent Prompt Preview ---');
  console.log(promptTemplate
    .replace(/\{\{sector\}\}/g, input.sector || '')
    .replace(/\{\{subSector\}\}/g, input.subSector || '')
    .replace(/\{\{outline\}\}/g, JSON.stringify(input.outline || {}, null, 2))
    .replace(/\{\{answers\}\}/g, JSON.stringify(input.answers || {}, null, 2))
    .replace(/\{\{pages\}\}/g, JSON.stringify(input.pages || [], null, 2))
    .replace(/\{\{bookMetadata\}\}/g, JSON.stringify(input.bookMetadata || {}, null, 2))
    .replace(/\{\{feedback\}\}/g, JSON.stringify(input.feedback || {}, null, 2))
    .replace(/\{\{history\}\}/g, JSON.stringify(history, null, 2))
    .substring(0, 500) + '...');

  // Write inbox for agent
  const inboxFile = path.join(IDEAS_DIR, 'inbox.json');
  const outboxFile = path.join(IDEAS_DIR, 'outbox.json');

  const requestId = crypto.randomUUID();
  const inboxData = {
    requestId,
    stage: stageNum,
    timestamp: new Date().toISOString(),
    skill: 'new-idea',
    payload: input,
    history,
    prompt: promptTemplate
      .replace(/\{\{sector\}\}/g, input.sector || '')
      .replace(/\{\{subSector\}\}/g, input.subSector || '')
      .replace(/\{\{outline\}\}/g, JSON.stringify(input.outline || {}, null, 2))
      .replace(/\{\{answers\}\}/g, JSON.stringify(input.answers || {}, null, 2))
      .replace(/\{\{pages\}\}/g, JSON.stringify(input.pages || [], null, 2))
      .replace(/\{\{bookMetadata\}\}/g, JSON.stringify(input.bookMetadata || {}, null, 2))
      .replace(/\{\{feedback\}\}/g, JSON.stringify(input.feedback || {}, null, 2))
      .replace(/\{\{history\}\}/g, JSON.stringify(history, null, 2))
  };

  fs.writeFileSync(inboxFile, JSON.stringify(inboxData, null, 2));
  console.log(`\n[CLI] Wrote inbox.json. Waiting for agent response...`);
  console.log(`[CLI] Agent should read inbox.json and write outbox.json`);

  // Wait for outbox
  const response = await waitForOutbox(requestId, outboxFile);

  // Validate and persist
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

  console.log(`\n[CLI] Stage ${stage} completed!`);
  return response.payload;
}

function waitForOutbox(requestId, outboxFile) {
  return new Promise((resolve, reject) => {
    const timeout = 300000; // 5 minutes
    const startTime = Date.now();

    const checkInterval = setInterval(() => {
      if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        reject(new Error('Timeout waiting for agent response'));
        return;
      }

      if (!fs.existsSync(outboxFile)) return;

      try {
        const outbox = JSON.parse(fs.readFileSync(outboxFile, 'utf-8'));
        if (outbox.requestId === requestId) {
          clearInterval(checkInterval);
          resolve(outbox);
        }
      } catch {
        // ignore
      }
    }, 1000);
  });
}

function getStageInput(stage, state) {
  const prevStage = ['sector', 'subsector', 'outline', 'customize', 'generate'].find(s =>
    state.stages[s]?.approved
  );

  switch (stage) {
    case 'sector':
      return { sector: state.stages.sector?.data?.sector || 'Smart Agriculture' };
    case 'subsector':
      return { sector: state.stages.sector?.data?.sector, subSector: state.stages.subsector?.data?.subSector };
    case 'outline':
      return {
        sector: state.stages.sector?.data?.sector,
        subSector: state.stages.subsector?.data?.subSector,
        outline: state.stages.outline?.data?.proposedPages
      };
    case 'customize':
      return {
        sector: state.stages.sector?.data?.sector,
        subSector: state.stages.subsector?.data?.subSector,
        outline: state.stages.outline?.data?.proposedPages,
        answers: state.stages.customize?.data?.answers || {}
      };
    case 'generate':
      return {
        sector: state.stages.sector?.data?.sector,
        subSector: state.stages.subsector?.data?.subSector,
        outline: state.stages.outline?.data?.proposedPages,
        answers: state.stages.customize?.data?.answers,
        pages: state.stages.generate?.data?.pages || [],
        bookMetadata: state.stages.generate?.data?.bookMetadata
      };
    case 'export':
      return {
        pages: state.stages.generate?.data?.pages || [],
        bookMetadata: state.stages.generate?.data?.bookMetadata
      };
    default:
      return {};
  }
}

function getNextStage(stage) {
  const idx = ['sector', 'subsector', 'outline', 'customize', 'generate', 'export'].indexOf(stage);
  if (idx === -1 || idx === 5) return stage;
  return ['sector', 'subsector', 'outline', 'customize', 'generate', 'export'][idx + 1];
}

async function promptForSector() {
  const sectors = [
    'Smart Agriculture',
    'Renewable Energy',
    'Food Processing',
    'Eco-Construction',
    'Biotech',
    'Waste Management',
    'Water Management',
    'Custom'
  ];

  console.log('\nAvailable sectors:');
  sectors.forEach((s, i) => console.log(`  ${i + 1}. ${s}`));

  const answer = await question('\nSelect sector (1-8) or type custom: ');
  const num = parseInt(answer);
  if (num >= 1 && num <= sectors.length) {
    return sectors[num - 1];
  }
  return answer;
}

async function promptForSubsector(subSectors) {
  console.log('\nAvailable sub-sectors:');
  let idx = 1;
  for (const group of subSectors) {
    console.log(`\n${group.category}:`);
    for (const item of group.items) {
      console.log(`  ${idx++}. ${item.name} - ${item.description}`);
    }
  }

  const answer = await question('\nSelect sub-sector number: ');
  const num = parseInt(answer);
  // Flatten and find
  let flat = [];
  for (const group of subSectors) {
    for (const item of group.items) flat.push(item);
  }
  if (num >= 1 && num <= flat.length) {
    return flat[num - 1].name;
  }
  return answer;
}

async function runFullWorkflow(resume = false, specificStage = null) {
  const state = loadState();

  if (resume && state.currentStage) {
    console.log(`Resuming from stage: ${state.currentStage}`);
  } else {
    console.log('Starting new book idea workflow...');
    state.stages = {};
    state.currentStage = 'sector';
    state.approvals = [];
    saveState(state);
  }

  const stages = ['sector', 'subsector', 'outline', 'customize', 'generate', 'export'];
  const startIdx = specificStage ? stages.indexOf(specificStage) : (resume ? stages.indexOf(state.currentStage) : 0);

  if (startIdx === -1) {
    console.error('Invalid stage');
    return;
  }

  for (let i = startIdx; i < stages.length; i++) {
    const stage = stages[i];

    // Get user input for this stage
    let input = getStageInput(stage, state);

    if (stage === 'sector' && (!resume || i === startIdx)) {
      if (!input.sector || input.sector === 'Smart Agriculture') {
        input.sector = await promptForSector();
      }
    }

    if (stage === 'subsector') {
      if (!input.subSector && state.stages.subsector?.data?.subSector) {
        input.subSector = state.stages.subsector.data.subSector;
      } else if (!input.subSector && state.stages.subsector?.data?.subSectors) {
        input.subSector = await promptForSubsector(state.stages.subsector.data.subSectors);
      }
    }

    console.log(`\n>>> Ready for STAGE ${i + 1}: ${stage.toUpperCase()}`);
    console.log('Input:', JSON.stringify(input, null, 2));

    const proceed = await question('\nProceed with this stage? (y/N): ');
    if (proceed.toLowerCase() !== 'y') {
      console.log('Skipping stage...');
      continue;
    }

    try {
      await runStageInteractive(stage, state);
      console.log(`Stage ${stage} completed!`);

      // Ask to continue
      if (i < stages.length - 1) {
        const cont = await question('\nContinue to next stage? (Y/n): ');
        if (cont.toLowerCase() === 'n') {
          console.log('Paused. Run with --resume to continue.');
          break;
        }
      }
    } catch (e) {
      console.error(`Stage ${stage} failed: ${e.message}`);
      const retry = await question('Retry this stage? (y/N): ');
      if (retry.toLowerCase() === 'y') {
        i--; // retry
      } else {
        break;
      }
    }
  }

  console.log('\nWorkflow complete or paused.');
  rl.close();
}

function listDrafts() {
  const state = loadState();
  console.log('\nCurrent Draft State:');
  console.log(`Session: ${state.sessionId}`);
  console.log(`Created: ${state.createdAt}`);
  console.log(`Current Stage: ${state.currentStage}`);
  console.log('\nApproved Stages:');
  for (const [stage, data] of Object.entries(state.stages)) {
    console.log(`  ${data.approved ? '✅' : '⏳'} ${stage} ${data.approvedAt ? `(${data.approvedAt})` : ''}`);
  }
}

function main() {
  
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node new-idea-cli.mjs [options]

Options:
  --resume          Resume from last approved stage
  --stage <name>    Run specific stage only (sector|subsector|outline|customize|generate|export)
  --force           Force re-run stage even if approved
  --list-drafts     List current draft state
  --help            Show this help

Examples:
  node new-idea-cli.mjs                    # Start new workflow
  node new-idea-cli.mjs --resume           # Resume from last stage
  node new-idea-cli.mjs --stage outline    # Run only outline stage
  node new-idea-cli.mjs --list-drafts      # Show draft status
`);
    process.exit(0);
  }

  if (args.includes('--list-drafts')) {
    listDrafts();
    process.exit(0);
  }

  const resume = args.includes('--resume');
  const force = args.includes('--force');
  const stageArg = args.find(a => a.startsWith('--stage'));
  const specificStage = stageArg ? stageArg.split('=')[1] : null;

  if (force) {
    console.log('Force mode: will re-run approved stages');
  }

  runFullWorkflow(resume, specificStage).catch(e => {
    console.error('Error:', e.message);
    process.exit(1);
  });
}

//import { fileURLToPath } from 'url';
import { resolve } from 'path';

// ... existing imports ...

// Replace the entry point check:
if (resolve(fileURLToPath(import.meta.url)) === resolve(process.argv[1])) {
  main();
}

export { runFullWorkflow, runStageInteractive, loadState, saveState };