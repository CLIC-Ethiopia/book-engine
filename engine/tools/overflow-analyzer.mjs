import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { countWords } from './shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const MAX_WAIT_SECONDS = 120;

export async function analyzeOverflow(pageHtml, overflowMm, wordCount, diagramHeight, bookDir, pageNo) {
  const promptFile = path.join(bookDir, '.work', `page-${String(pageNo).padStart(3, '0')}-overflow-prompt.json`);
  const responseFile = path.join(bookDir, '.work', `page-${String(pageNo).padStart(3, '0')}-overflow-response.json`);

  const workDir = path.dirname(promptFile);
  if (!fs.existsSync(workDir)) {
    fs.mkdirSync(workDir, { recursive: true });
  }

  const promptData = {
    page: { html: pageHtml },
    overflow: { mm: overflowMm, words: wordCount, diagramHeight },
    instructions: `Analyze this page HTML for B5 overflow. Return JSON only with rootCauses, fixes (id, description, wordSavings, mmSavings, autoApplicable), and recommended fix IDs.`
  };

  fs.writeFileSync(promptFile, JSON.stringify(promptData, null, 2));
  console.log(`  📝 Wrote overflow analysis prompt: ${promptFile}`);

  let analysis = null;
  let attempts = 0;

  while (!analysis && attempts < MAX_WAIT_SECONDS) {
    if (fs.existsSync(responseFile)) {
      try {
        const response = JSON.parse(fs.readFileSync(responseFile, 'utf8'));
        analysis = response;
        fs.unlinkSync(responseFile);
      } catch (e) {
        console.log(`  ⚠️  Invalid overflow response, waiting...`);
      }
    }
    if (!analysis) {
      await new Promise(r => setTimeout(r, 1000));
      attempts++;
      if (attempts % 10 === 0) {
        console.log(`  ⏳  Waiting for coding agent overflow analysis... (${attempts}s)`);
      }
    }
  }

  if (!analysis) {
    console.log(`  ⏰  Timeout waiting for overflow analysis, returning empty`);
    return { rootCauses: [], fixes: [], recommended: [] };
  }

  console.log(`  ✅  Received overflow analysis from coding agent`);
  return analysis;
}

export async function checkPageOverflows(interiorHtmlPath) {
  const { spawn } = await import('node:child_process');

  return new Promise((resolve, reject) => {
    // --json so we read structured output with untruncated titles. The old
    // table-regex path broke on titles containing an apostrophe.
    const child = spawn('node', ['engine/tools/check.mjs', interiorHtmlPath, '--json'], {
      cwd: PROJECT_ROOT,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => stdout += data.toString());
    child.stderr.on('data', (data) => stderr += data.toString());

    child.on('close', () => {
      // Exit code is 1 whenever anything fails, which is normal here, so the
      // result is read from stdout rather than inferred from the code.
      resolve(parseCheckJson(stdout));
    });

    child.on('error', reject);
  });
}

function parseCheckJson(stdout) {
  const overflowMap = {};
  const start = stdout.indexOf('{');
  if (start === -1) return overflowMap;

  let report;
  try {
    report = JSON.parse(stdout.slice(start));
  } catch {
    return overflowMap;
  }

  for (const row of report.pages || []) {
    const title = String(row.title ?? '').trim();
    if (!title) continue;
    overflowMap[title] = {
      overflow: Number(row.overMm) || 0,
      pageIndex: Number(row.page) - 1,
      pageNumber: Number(row.page),
    };
  }

  return overflowMap;
}

export { countWords } from './shared.mjs';