import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

export function pad2(value) {
  return String(value).padStart(2, '0');
}

export function normalizeSlug(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function deriveSlugFromTitle(title) {
  return normalizeSlug(title);
}

export function sanitizeFilename(name) {
  return String(name || '')
    .replace(/[^a-z0-9]+/gi, '-')
    .toLowerCase();
}

export function countWords(text) {
  return text.replace(/<[^>]+>/g, '').trim().split(/\s+/).filter(Boolean).length;
}

export function escHTML(str) {
  return String(str || '')
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>');
}

export function escHTMLNoAmp(str) {
  return String(str || '')
    .replace(/</g, '<')
    .replace(/>/g, '>');
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

/**
 * The coding-agent command that writes response files for prep-pages.
 *
 * Configured by environment only - the toolchain does not presume which agent
 * is installed. Use the token {promptFile} where the prompt path belongs, e.g.
 *   PREP_PROVIDER="claude -p {promptFile}"
 * Runs from the project root so relative paths in the prompt resolve.
 */
export function resolveProvider() {
  const raw = process.env.PREP_PROVIDER;
  return raw && raw.trim() ? raw.trim() : null;
}

export function providerName(provider) {
  if (!provider) return null;
  return provider.trim().split(/\s+/)[0];
}

/** Hang-guard for a provider run. Not the primary completion signal. */
export function providerTimeoutMs() {
  const raw = Number(process.env.PREP_TIMEOUT);
  return Number.isFinite(raw) && raw > 0 ? raw : 300000;
}

/**
 * Split a provider command into argv, substituting the prompt path.
 *
 * The command is tokenised first and the path substituted afterwards, so a
 * prompt path containing spaces stays one argument instead of being re-split.
 * Quoted segments in the command are honoured too.
 */
export function providerArgv(provider, promptFile) {
  const argv = [];
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let m;
  while ((m = pattern.exec(provider)) !== null) {
    argv.push(m[1] ?? m[2] ?? m[3]);
  }
  return argv.map((a) => a.replace(/\{promptFile\}/g, promptFile));
}

/**
 * Windows resolves bare commands like `claude` through .cmd shims, which
 * node's spawn cannot exec directly without a shell. Shell mode is avoided
 * because it mangles quoting and triggers DEP0190, so the shim is invoked
 * through COMSPEC explicitly instead.
 */
const TOOL_ROOT = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(TOOL_ROOT, '..', '..');

export function providerSpawnSpec(argv) {
  const [cmd, ...rest] = argv;
  const isWindows = process.platform === 'win32';
  const needsShim = isWindows && (!/\.[a-z]+$/i.test(cmd) || /\.(cmd|bat)$/i.test(cmd));

  if (needsShim) {
    const line = [cmd, ...rest].map((a) => (/[\s"]/.test(a) ? `"${a.replace(/"/g, '\\"')}"` : a)).join(' ');
    return {
      file: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', line],
      // A separate process group lets us take the whole tree down on timeout.
      options: { stdio: 'inherit', cwd: PROJECT_ROOT, windowsHide: true, shell: false },
    };
  }

  return {
    file: cmd,
    args: rest,
    options: { stdio: 'inherit', cwd: PROJECT_ROOT, detached: !isWindows },
  };
}

/**
 * Kill a provider and everything it started.
 *
 * A plain child.kill() only reaps the immediate child. On Windows a provider
 * launched through COMSPEC would leave its real process running, still holding
 * the inherited stdio open, which stalls the whole run.
 */
export function killProcessTree(child) {
  if (!child || !child.pid) return;
  const pid = child.pid;

  if (process.platform === 'win32') {
    try {
      spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    } catch {
      try { child.kill(); } catch { /* already gone */ }
    }
    return;
  }

  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    try { child.kill('SIGKILL'); } catch { /* already gone */ }
  }
}