#!/usr/bin/env node
// new-idea-bridge-handler.mjs — File bridge daemon for new-idea skill
// Watches ideas/inbox.json, invokes orchestrator, writes ideas/outbox.json

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const IDEAS_DIR = path.join(PROJECT_ROOT, 'ideas');
const INBOX_FILE = path.join(IDEAS_DIR, 'inbox.json');
const OUTBOX_FILE = path.join(IDEAS_DIR, 'outbox.json');
const ORCHESTRATOR = path.join(__dirname, 'new-idea-orchestrator.mjs');

let isProcessing = false;
let lastInboxMtime = 0;

function log(msg) {
  console.log(`[bridge:${new Date().toISOString()}] ${msg}`);
}

function ensureInboxExists() {
  if (!fs.existsSync(INBOX_FILE)) {
    fs.writeFileSync(INBOX_FILE, JSON.stringify({}));
  }
}

async function processInbox() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    if (!fs.existsSync(INBOX_FILE)) return;

    const stats = fs.statSync(INBOX_FILE);
    if (stats.mtimeMs <= lastInboxMtime) return;
    lastInboxMtime = stats.mtimeMs;

    const inbox = JSON.parse(fs.readFileSync(INBOX_FILE, 'utf-8'));
    if (!inbox.requestId || !inbox.stage || !inbox.prompt) {
      log('Invalid inbox format, skipping');
      return;
    }

    log(`Processing request ${inbox.requestId} stage ${inbox.stage}`);

    // Write prompt to temp file for agent
    const promptFile = path.join(IDEAS_DIR, `.prompt-${inbox.requestId}.md`);
    fs.writeFileSync(promptFile, inbox.prompt);

    // Invoke coding agent via orchestrator (which uses the same session)
    // The orchestrator will be called as a subprocess
    const result = await invokeAgent(inbox, promptFile);

    // Clean up prompt file
    try { fs.unlinkSync(promptFile); } catch {}

    // Write outbox
    const outbox = {
      requestId: inbox.requestId,
      stage: inbox.stage + 1,
      timestamp: new Date().toISOString(),
      skill: 'new-idea',
      payload: result,
      approvalRequired: inbox.stage < 6
    };

    fs.writeFileSync(OUTBOX_FILE, JSON.stringify(outbox, null, 2));
    log(`Wrote outbox.json for request ${inbox.requestId}`);

    // Clear inbox
    fs.writeFileSync(INBOX_FILE, JSON.stringify({}));

  } catch (e) {
    log(`Error processing inbox: ${e.message}`);
    const errorOutbox = {
      requestId: 'error',
      stage: 0,
      timestamp: new Date().toISOString(),
      skill: 'new-idea',
      error: e.message
    };
    fs.writeFileSync(OUTBOX_FILE, JSON.stringify(errorOutbox, null, 2));
  } finally {
    isProcessing = false;
  }
}

async function invokeAgent(inbox, promptFile) {
  // Read the prompt file and construct the agent invocation
  // The agent will read the prompt and produce a response
  // For now, we'll use the orchestrator to simulate the agent response
  // In practice, this would invoke the actual coding agent

  log(`Invoking agent for stage ${inbox.stage}...`);

  // The actual agent invocation happens through the orchestrator
  // which writes to inbox and waits for outbox
  // Here we just wait for the agent to process (simulated)

  // In a real implementation, this would:
  // 1. The coding agent (this session) reads the prompt from inbox.json
  // 2. Agent processes and writes response to outbox.json
  // 3. Bridge handler picks up outbox and continues

  // For now, we'll simulate by running the orchestrator which will
  // handle the agent interaction via the file bridge pattern

  // Actually, the bridge handler should NOT invoke the agent directly.
  // The agent (this session) is the one that reads inbox and writes outbox.
  // The bridge handler just watches for changes and facilitates.

  // Let's re-read the pattern: orchestrator writes inbox, AGENT reads inbox and writes outbox, bridge handler watches
  // But we ARE the bridge handler. The agent is the coding agent running in another process/terminal.

  // Actually, the pattern is:
  // 1. Web UI / CLI writes inbox.json
  // 2. Bridge handler (this) watches inbox.json
  // 3. Bridge handler invokes the coding agent (via some mechanism)
  // 4. Coding agent reads inbox.json, processes, writes outbox.json
  // 5. Bridge handler detects outbox.json and notifies caller

  // Since we can't easily invoke the coding agent from Node,
  // the bridge handler's job is just to watch files and facilitate.
  // The actual agent invocation is manual or via a separate process.

  // For this implementation, we'll just log and wait for outbox to appear
  // (written by the agent manually or via another process)

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
        if (outbox.requestId === inbox.requestId) {
          clearInterval(checkInterval);
          resolve(outbox.payload);
        }
      } catch {
        // ignore
      }
    }, 1000);
  });
}

function watch() {
  log('Starting file bridge handler...');
  log(`Watching: ${INBOX_FILE}`);
  log(`Output: ${OUTBOX_FILE}`);

  ensureInboxExists();

  // Initial check
  if (fs.existsSync(INBOX_FILE)) {
    lastInboxMtime = fs.statSync(INBOX_FILE).mtimeMs;
  }

  // Poll for changes (fs.watch can be unreliable on some systems)
  setInterval(processInbox, 1000);

  log('Bridge handler running. Press Ctrl+C to stop.');
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  log('Shutting down...');
  process.exit(0);
});

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  watch();
}

export { processInbox, watch };