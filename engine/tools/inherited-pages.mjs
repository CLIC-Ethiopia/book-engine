import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import prompts from 'prompts';
import { resolveProvider, providerName, providerTimeoutMs, providerArgv, providerSpawnSpec, killProcessTree } from './shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const MAX_WAIT_SECONDS = 120;

const INHERITED_PAGES = [
  { key: 'cover', label: 'Cover Page', file: 'cover.html' },
  { key: 'inside-cover', label: 'Inside Cover', file: 'inside-cover.html' },
  { key: 'colophon', label: 'Colophon', file: 'colophon.html' },
  { key: 'toc', label: 'Table of Contents', file: 'toc.html' },
  { key: 'how-to-read', label: 'How to Read', file: 'how-to-read.html' },
  { key: 'index', label: 'Index', file: 'index.html' },
  { key: 'back-cover', label: 'Back Cover', file: 'back-cover.html' },
];

function getInheritedPagePath(bookDir, pageKey) {
  // These are template pages that get copied
  const templatePageMap = {
    'cover': 'gp cover',
    'inside-cover': 'gp inside-cover',
    'colophon': 'gp colophon',
    'toc': 'gp toc',
    'how-to-read': 'gp how-to-read',
    'index': 'gp index',
    'back-cover': 'gp back-cover',
  };
  return path.join(bookDir, `${templatePageMap[pageKey]}.html`);
}

function readInheritedPageContent(bookDir, pageKey) {
  const pagePath = getInheritedPagePath(bookDir, pageKey);
  if (fs.existsSync(pagePath)) {
    return fs.readFileSync(pagePath, 'utf8');
  }
  return '';
}

async function writePromptFile(promptFile, promptData) {
  const workDir = path.dirname(promptFile);
  if (!fs.existsSync(workDir)) {
    fs.mkdirSync(workDir, { recursive: true });
  }
  fs.writeFileSync(promptFile, JSON.stringify(promptData, null, 2));
}

function readResponseFile(responseFile) {
  try {
    const response = JSON.parse(fs.readFileSync(responseFile, 'utf8'));
    fs.unlinkSync(responseFile);
    return response;
  } catch {
    return null;
  }
}

/**
 * Produce a proposal for one inherited-page prompt.
 *
 * With PREP_PROVIDER set the agent is run and awaited, so the response is read
 * straight after the process exits. Without it we keep the original poll, which
 * still lets an agent write the response file on its own.
 */
async function getProposal(provider, promptFile, responseFile, label) {
  if (!provider) {
    return waitForResponse(responseFile, MAX_WAIT_SECONDS * 1000, label);
  }

  const existing = readResponseFile(responseFile);
  if (existing) return existing;

  const { spawn } = await import('node:child_process');
  const spec = providerSpawnSpec(providerArgv(provider, promptFile));

  await new Promise((resolve) => {
    let child;
    try {
      child = spawn(spec.file, spec.args, spec.options);
    } catch {
      resolve();
      return;
    }
    const kill = setTimeout(() => {
      console.log(`  ⏰  Provider exceeded ${Math.round(providerTimeoutMs() / 1000)}s, stopping it`);
      killProcessTree(child);
    }, providerTimeoutMs());

    child.on('error', (e) => {
      clearTimeout(kill);
      console.log(`  ⚠️  Provider failed to start: ${e.message}`);
      resolve();
    });
    child.on('close', () => {
      clearTimeout(kill);
      resolve();
    });
  });

  return readResponseFile(responseFile);
}

/**
 * Offer to edit an inherited page by hand when no writer produced a proposal.
 * Returns { content }, null to skip, or 'quit'.
 */
async function authorInheritedInteractively(page, currentContent, options, seed = null) {
  if (!options.interactive) return null;

  if (!seed) {
    const choice = await prompts({
      type: 'select',
      name: 'action',
      message: `No proposal for the ${page.label}. What now?`,
      choices: [
        { title: `Edit it myself in $EDITOR`, value: 'author' },
        { title: 'Keep the inherited page as-is', value: 'skip' },
        { title: 'Quit inherited pages editing', value: 'quit' },
      ],
      initial: 0,
    });

    if (!choice.action || choice.action === 'skip') return null;
    if (choice.action === 'quit') return 'quit';
  }

  const edited = await editInEditor(seed || currentContent);
  if (!edited || !edited.trim()) return null;
  return { content: edited.trim() };
}

async function waitForResponse(responseFile, timeoutMs = MAX_WAIT_SECONDS * 1000, label = 'coding agent') {
  return new Promise((resolve) => {
    let attempts = 0;
    const checkInterval = setInterval(async () => {
      if (fs.existsSync(responseFile)) {
        const parsed = readResponseFile(responseFile);
        if (parsed) {
          clearInterval(checkInterval);
          resolve(parsed);
          return;
        }
        console.log(`  ⚠️  Invalid ${label} response, waiting...`);
      }
      attempts++;
      if (attempts % 10 === 0) {
        console.log(`  ⏳  Still waiting for ${label}... (${attempts}s)`);
      }
      if (attempts * 1000 >= timeoutMs) {
        clearInterval(checkInterval);
        console.log(`  ⏰  Timeout waiting for ${label}`);
        resolve(null);
      }
    }, 1000);
  });
}

async function editInEditor(content) {
  const tempFile = path.join(os.tmpdir(), `inherited-edit-${Date.now()}.html`);
  const editContent = `<!-- Edit the HTML below. Keep valid structure. -->
${content}
`;
  fs.writeFileSync(tempFile, editContent);
  
  const editor = process.env.EDITOR || (process.platform === 'win32' ? 'notepad' : 'nano');
  const { spawn } = await import('node:child_process');
  
  await new Promise((resolve, reject) => {
    const child = spawn(editor, [tempFile], { stdio: 'inherit' });
    child.on('close', resolve);
    child.on('error', reject);
  });
  
  const edited = fs.readFileSync(tempFile, 'utf8');
  // Remove the comment wrapper
  const match = edited.match(/<!-- Edit the HTML below\. Keep valid structure\. -->\n([\s\S]*)/);
  if (match) {
    return match[1].trim();
  }
  return content;
}

function buildInheritedPagePrompt(page, bookDir, manifest, currentContent) {
  return {
    page: {
      key: page.key,
      label: page.label,
      currentContent: currentContent
    },
    context: {
      bookTitle: manifest.title,
      series: manifest.series,
      author: manifest.author,
      subtitle: manifest.subtitle,
      editionLabel: manifest.editionLabel,
      audience: manifest.audience,
      primaryLocation: manifest.primaryLocation,
      coverImage: manifest.coverImage,
      slug: manifest.slug,
    },
    instructions: `Review and edit this inherited template page. Return JSON only with: { "content": "updated HTML content" }. 
For cover page: update cover image, title, author, series, edition.
For inside-cover: update copyright, ISBN, publisher info.
For colophon: update production notes, fonts, credits.
For TOC: usually auto-generated, but you can add custom entries.
For how-to-read: update reading instructions.
For index: usually auto-generated.
For back-cover: update blurb, author bio, barcode placeholder.`
  };
}

function validateInheritedContent(content) {
  if (!content || content.trim().length === 0) {
    return { valid: false, errors: ['Content cannot be empty'] };
  }
  // Basic HTML validation - should have some structure
  return { valid: true, errors: [] };
}

async function editInheritedPage(page, bookDir, manifest, options = {}, provider) {
  const currentContent = readInheritedPageContent(bookDir, page.key);
  
  if (!currentContent) {
    console.log(`  ⚠️  No template content found for ${page.label}, skipping...`);
    return false;
  }

  console.log(`\n--- Editing: ${page.label} ---`);
  
  let prepared = null;
  let attempts = 0;
  let authoredBy = null;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts && !prepared) {
    const promptFile = path.join(bookDir, '.work', `inherited-${page.key}-prompt.json`);
    const responseFile = path.join(bookDir, '.work', `inherited-${page.key}-response.json`);
    
    const promptData = buildInheritedPagePrompt(page, bookDir, manifest, currentContent);
    await writePromptFile(promptFile, promptData);
    console.log(`  📝 Wrote prompt for ${page.label}`);
    if (provider) {
      console.log(`  Running provider: ${providerName(provider)}`);
    } else {
      console.log(`  Waiting for a response file at: ${responseFile}`);
    }
    
    let proposal = await getProposal(provider, promptFile, responseFile, 'coding agent');
    
    if (!proposal) {
      // No writer produced anything - offer to edit the inherited page by
      // hand rather than skipping it silently.
      const handEdited = await authorInheritedInteractively(page, currentContent, options);
      if (handEdited === 'quit') return false;
      if (!handEdited) {
        attempts++;
        continue;
      }
      proposal = handEdited;
      authoredBy = 'human';
    }
    
    if (!authoredBy) {
      console.log(`  ✅  Received response for ${page.label}`);
      authoredBy = provider ? `provider:${providerName(provider)}` : 'agent';
    }
    
    // Validate
    const validation = validateInheritedContent(proposal.content);
    if (!validation.valid) {
      console.log(`  ❌ Invalid: ${validation.errors.join(', ')}`);
      attempts++;
      continue;
    }
    
    if (options.auto) {
      console.log(`  [AUTO] Accepting proposal for ${page.label}`);
      prepared = proposal;
      break;
    }
    
    // Show preview
    console.log(`\n  Proposed content preview (first 500 chars):`);
    console.log(`  ${proposal.content.substring(0, 500)}...`);
    
    const action = await prompts({
      type: 'select',
      name: 'action',
      message: `Action for ${page.label}:`,
      choices: [
        { title: 'Accept as-is', value: 'accept' },
        { title: 'Edit in $EDITOR', value: 'edit' },
        { title: 'Regenerate with instruction', value: 'regenerate' },
        { title: 'Skip this page', value: 'skip' },
      ],
      initial: 0
    });
    
    if (!action.action) return false;
    
    if (action.action === 'accept') {
      prepared = proposal;
      break;
    } else if (action.action === 'edit') {
      const edited = await editInEditor(proposal.content);
      const editValidation = validateInheritedContent(edited);
      if (editValidation.valid) {
        prepared = { content: edited };
        break;
      }
      console.log(`  ❌ Edit invalid, trying again...`);
    } else if (action.action === 'regenerate') {
      const { instruction } = await prompts({
        type: 'text',
        name: 'instruction',
        message: 'Regeneration instruction:'
      });
      if (instruction) {
        // Add instruction to context for next round
        currentContent = instruction; // This will be used in prompt building
        attempts++;
      }
    } else if (action.action === 'skip') {
      console.log(`  ⏭️  Skipping ${page.label}`);
      return false;
    }
    
    attempts++;
  }
  
  if (prepared) {
    const pagePath = getInheritedPagePath(bookDir, page.key);
    fs.writeFileSync(pagePath, prepared.content, 'utf8');
    console.log(`  ✅ ${page.label} updated (${authoredBy || 'unknown'})`);
    return true;
  }
  
  return false;
}

async function editInheritedPages(bookDir, manifest, options = {}) {
  console.log(`\n=== Inherited Pages Editing (Coding Agent) ===`);
  
  // Find which inherited pages exist in the template
  const availablePages = INHERITED_PAGES.filter(page => {
    const pagePath = getInheritedPagePath(bookDir, page.key);
    return fs.existsSync(pagePath);
  });
  
  if (availablePages.length === 0) {
    console.log('No inherited template pages found to edit.');
    return { edited: 0 };
  }
  
  console.log(`Found ${availablePages.length} inherited pages:`);
  availablePages.forEach(p => console.log(`  - ${p.label} (${p.key})`));
  
  if (!options.auto && options.interactive) {
    const ans = await prompts({
      type: 'confirm',
      name: 'proceed',
      message: 'Edit these inherited template pages with coding agent?',
      initial: true,
    });
    if (!ans.proceed) {
      console.log('Skipping inherited pages editing.');
      return { edited: 0 };
    }
  }
  
  let editedCount = 0;
  const provider = resolveProvider();
  for (const page of availablePages) {
    const success = await editInheritedPage(page, bookDir, manifest, options, provider);
    if (success) editedCount++;
  }
  
  console.log(`\n✅ Inherited pages editing complete. ${editedCount}/${availablePages.length} pages updated.`);
  return { edited: editedCount };
}

export { editInheritedPages, INHERITED_PAGES };