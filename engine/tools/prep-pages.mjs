import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import prompts from 'prompts';
import { applyFixesAutomatically, reviewOverflowFixes } from './cli-interactive.mjs';
import { buildPageContext } from './context-builder.mjs';
import { checkPageOverflows, validatePage, recommendFixes, countWords } from './page-validator.mjs';
import { renderInterior } from './book-render.mjs';
import { resolveProvider, providerName, providerTimeoutMs, providerArgv, providerSpawnSpec, killProcessTree } from './shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const TARGET_WORDS = 65;
const MAX_WORDS = 85;
const DIAGRAM_HEIGHT = 150;
const MAX_WAIT_SECONDS = 120;
const MAX_ATTEMPTS = 3;
const MAX_VALIDATION_ROUNDS = 5;

function writePromptFile(promptFile, promptData) {
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
 * Produce a proposal for one prompt file.
 *
 * With PREP_PROVIDER set, the agent is run and awaited to completion, so the
 * response is read straight after the process exits rather than polled for.
 * Without it we keep the original poll, which still lets an agent write the
 * response file on its own.
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
    // Hang guard only. Normal completion is signalled by the exit event.
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

function waitForResponse(responseFile, timeoutMs = MAX_WAIT_SECONDS * 1000, label = 'coding agent') {
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

function addPrepHistoryEntry(page, step, data) {
  page.prepHistory = page.prepHistory || [];
  page.prepHistory.push({
    step,
    timestamp: new Date().toISOString(),
    ...data
  });
}

export async function prepPages(bookDir, options = {}) {
  const { auto = false, force = false } = options;
  const manifestPath = path.join(bookDir, '.work', 'idea-manifest.json');
  
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Manifest not found: ${manifestPath}`);
  }
  
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  
  console.log(`\n=== Preparing Pages (Coding Agent) ===`);
  console.log(`Target: ~65 words/page, max 85 | Diagram: 150px`);
  
  // Initial render to get overflow data
  console.log(`\n[1/4] Initial render to measure overflow...`);
  const interiorHtml = renderInterior(manifest, {}, [], 'preserve');
  const interiorPath = path.join(bookDir, `${manifest.slug}.html`);
  fs.writeFileSync(interiorPath, interiorHtml);
  
  const overflowMap = await checkPageOverflows(interiorPath);
  
  // Determine pages to prepare
  const pagesToPrep = force 
    ? manifest.pages 
    : manifest.pages.filter(p => (overflowMap[p.title]?.overflow || 0) > 0);
  
  if (pagesToPrep.length === 0) {
    console.log('No pages with overflow. Skipping prep.');
    return { manifest, diffs: [] };
  }
  
  console.log(`\nPages with overflow: ${pagesToPrep.map(p => p.no).join(', ')}`);

  const provider = resolveProvider();
  if (provider) {
    console.log(`Writer: provider "${providerName(provider)}" (PREP_PROVIDER)`);
  } else if (options.interactive) {
    console.log('Writer: you (no PREP_PROVIDER set, pages will be authored in $EDITOR)');
  } else {
    // Fail fast rather than skipping every page in silence. An unattended run
    // has no author, so there is nothing useful it can do here.
    throw new Error(
      'Prep-pages needs a writer. Either set PREP_PROVIDER to a coding-agent command ' +
      '(e.g. PREP_PROVIDER="claude -p {promptFile}") or run interactively to author pages yourself. ' +
      'Omit --prep-page to skip this stage entirely.'
    );
  }

  // Phase 1: Prepare each overflowing page
  console.log(`\n[2/4] Coding Agent preparation with human-in-the-loop...`);
  
  for (const page of pagesToPrep) {
    const overflowData = overflowMap[page.title] || { overflow: 0, words: 0 };
    await prepareOnePage(page, manifest, bookDir, overflowData, options, provider);
  }
  
  // Phase 2: Validation loop - render, check, fix until 0mm
  console.log(`\n[3/4] Validation loop (render → check → fix)...`);
  await resolveOverflow(manifest, bookDir, provider);
  
  // Phase 3: Final render and save
  console.log(`\n[4/4] Final render and save...`);
  const finalHtml = renderInterior(manifest, {}, [], 'preserve');
  fs.writeFileSync(path.join(bookDir, `${manifest.slug}.html`), finalHtml);
  
  // Save manifest
  fs.writeFileSync(path.join(bookDir, '.work', 'idea-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  
  console.log('\n✅ Prep complete!');
  return { manifest, diffs: [] };
}

/**
 * Offer to author a page by hand when no writer produced a proposal.
 *
 * The editor is seeded with the page's current content, so the human starts
 * from the idea-file prose rather than an empty file. Returns a proposal
 * object shaped for validatePage/applyPreparedContent, or null to skip.
 */
async function authorPageInteractively(page, manifest, context, options, seed = null) {
  if (!options.interactive) return null;

  const existing = seed || {
    title: page.title,
    subtitle: page.subtitle || '',
    explainerHtml: context.cleanedContent || page.content || '',
    actionLabel: page.actionCallout?.label || 'TRY THIS',
    actionContent: page.actionCallout?.content || '',
    imageType: page.imageMeta?.type || 'diagram',
    imagePrompt: page.imagePrompt || '',
    wordCount: countWords(page.content || ''),
  };

  if (!seed) {
    const choice = await prompts({
      type: 'select',
      name: 'action',
      message: `No proposal for page ${page.no} (${page.title}). What now?`,
      choices: [
        { title: `Write it myself in $EDITOR`, value: 'author' },
        { title: 'Keep the raw content for this page', value: 'skip' },
        { title: 'Quit prep (raw content for all remaining pages)', value: 'quit' },
      ],
      initial: 0,
    });

    if (!choice.action || choice.action === 'skip') return null;
    if (choice.action === 'quit') return 'quit';
  }

  const edited = await editInEditor(existing);
  if (!edited || !edited.trim()) return null;

  return {
    ...existing,
    explainerHtml: edited.trim(),
    wordCount: countWords(edited),
  };
}

async function prepareOnePage(page, manifest, bookDir, overflowData, options, provider) {
  const context = await buildPageContext(page, bookDir, manifest, overflowData);
  
  let prepared = null;
  let attempts = 0;
  let authoredBy = null;
  
  while (attempts < MAX_ATTEMPTS && !prepared) {
    // Write prompt file for coding agent
    const promptFile = path.join(bookDir, '.work', `page-${String(page.no).padStart(3, '0')}-prompt.json`);
    const responseFile = path.join(bookDir, '.work', `page-${String(page.no).padStart(3, '0')}-response.json`);
    
    const promptData = buildPrepPrompt(page, manifest, context, overflowData);
    writePromptFile(promptFile, promptData);
    console.log(`\n📝 Wrote prompt: ${promptFile}`);
    if (provider) {
      console.log(`   Running provider: ${providerName(provider)}`);
    } else {
      console.log(`   Waiting for a response file at: ${responseFile}`);
    }
    
    // Get a proposal from the provider, or from whoever writes the file by hand.
    let proposal = await getProposal(provider, promptFile, responseFile, 'coding agent');
    
    if (!proposal) {
      // No writer produced anything. Interactive runs get the chance to
      // author the page themselves; unattended runs have already been
      // rejected in prepPages, so this is the skip path.
      const authored = await authorPageInteractively(page, manifest, context, options);
      if (authored === 'quit') return;
      if (!authored) {
        attempts++;
        continue;
      }
      proposal = authored;
      authoredBy = 'human';
    }
    
    if (!authoredBy) {
      console.log(`  ✅  Received response from coding agent`);
      authoredBy = provider ? `provider:${providerName(provider)}` : 'agent';
    }
    
    // Validate proposal
    const validation = validatePage(proposal);
    if (!validation.valid) {
      console.log(`❌ Invalid: ${validation.errors.join(', ')}`);
      if (authoredBy === 'human') {
        // A human edit that fails validation should be shown why and
        // re-opened, not silently re-prompted at an agent.
        console.log(`   Your text did not pass the page rules. Reopening the editor.`);
        const retry = await authorPageInteractively(page, manifest, context, options, proposal);
        if (!retry) {
          attempts++;
          continue;
        }
        proposal = retry;
      } else {
        attempts++;
        context.userInstruction = `Fix: ${validation.errors.join('; ')}`;
        continue;
      }
    }
    
    // Interactive review
    if (options.auto) {
      const wc = countWords(proposal.explainerHtml || '');
      console.log(`  [AUTO] Accepting proposal (${wc} words)`);
      prepared = proposal;
      break;
    }
    
    const action = await reviewPageCLI(page, proposal, overflowData);
    
    if (action === 'accept') {
      prepared = proposal;
      break;
    } else if (action === 'edit') {
      const edited = await editInEditor(proposal);
      const editValidation = validatePage(edited);
      if (editValidation.valid) {
        prepared = edited;
        break;
      }
      console.log(`❌ Edit invalid: ${editValidation.errors.join(', ')}`);
      attempts++;
    } else if (action === 'regenerate') {
      const { instruction } = await import('prompts').then(p => p({
        type: 'text',
        name: 'instruction',
        message: 'Regeneration instruction:'
      }));
      context.userInstruction = instruction;
      attempts++;
    } else if (action === 'skip') {
      prepared = null;
      break;
    } else if (action === 'quit') {
      console.log('Aborting prep, continuing with raw content...');
      return;
    }
    
    attempts++;
  }
  
  if (prepared) {
    applyPreparedContent(page, prepared);
    addPrepHistoryEntry(page, 'prepared', {
      authoredBy: authoredBy || 'unknown',
      wordCount: prepared.wordCount ?? countWords(prepared.explainerHtml || ''),
      overflowBefore: overflowData.overflow || 0
    });
    console.log(`✅ Page ${page.no} prepared (${prepared.wordCount || 0} words)`);
  }
}

function buildPrepPrompt(page, manifest, context, overflowData) {
  return {
    page: {
      no: page.no,
      title: page.title,
      section: page.section,
      originalSubtitle: page.subtitle,
      originalContent: page.content,
      actionCallout: page.actionCallout,
      imagePrompt: page.imagePrompt
    },
    context: {
      bookTitle: manifest.title,
      series: manifest.series,
      voiceMd: context.voiceMd,
      blocksMd: context.blocksMd,
      pageWidth: 176,
      pageHeight: 250,
      diagramHeight: 150,
      targetWords: 65,
      maxWords: 85,
      currentOverflow: overflowData.overflow,
      currentWordCount: overflowData.words,
      designRules: context.designRules,
      examples: context.examples
    },
    constraints: {
      targetWords: 65,
      maxWords: 85,
      diagramHeight: 150,
      maxTitleWords: 3,
      maxSubtitleWords: 10,
      maxActionWords: 20
    },
    instructions: `Rewrite this page to fit B5 page with 0mm overflow. Return JSON only with: title, subtitle, explainerHtml, actionLabel, actionContent, imageType, imagePrompt, wordCount, overflowPrediction.`
  };
}

function applyPreparedContent(page, prepared) {
  page.preparedContent = prepared.explainerHtml;
  page.preparedSubtitle = prepared.subtitle;
  page.preparedActionLabel = prepared.actionLabel;
  page.preparedActionContent = prepared.actionContent;
  page.imageMeta = { 
    type: prepared.imageType, 
    height: 150, 
    prompt: prepared.imagePrompt 
  };
}

async function resolveOverflow(manifest, bookDir, provider) {
  let validationPassed = false;
  let validationRounds = 0;
  
  while (!validationPassed && validationRounds < MAX_VALIDATION_ROUNDS) {
    validationRounds++;
    console.log(`\n--- Validation round ${validationRounds} ---`);
    
    // Render with prepped content
    const interiorHtml = renderInterior(manifest, {}, [], 'preserve');
    fs.writeFileSync(path.join(bookDir, `${manifest.slug}.html`), interiorHtml);
    
    // Check overflow
    const overflowMap = await checkPageOverflows(path.join(bookDir, `${manifest.slug}.html`));
    
    const overflowingPages = Object.entries(overflowMap)
      .filter(([_, data]) => data.overflow > 0)
      .map(([title, data]) => ({ title, ...data }));
    
    if (overflowingPages.length === 0) {
      console.log('✅ All pages 0mm overflow!');
      validationPassed = true;
      break;
    }
    
    console.log(`\n⚠️  ${overflowingPages.length} pages still overflow:`);
    overflowingPages.forEach(p => console.log(`  Page ${p.pageNumber}: ${p.title} (+${p.overflow}mm, ${p.words} words)`));
    
    // Fix each overflowing page
    for (const { title, overflow, words, diagramHeight } of overflowingPages) {
      const page = manifest.pages.find(p => p.title === title);
      if (!page || !page.preparedContent) continue;
      
      console.log(`\n--- Fixing: ${title} (+${overflow}mm, ${words} words) ---`);
      
      // Get coding agent fix recommendations
      const analysis = await recommendFixes(page.preparedContent, overflow, words, diagramHeight, bookDir, page.no);
      
      if (analysis.fixes.length === 0) {
        console.log('  No automatic fixes available');
        continue;
      }
      
      // Add overflow data to analysis for reviewOverflowFixes
      const overflowAnalysis = {
        ...analysis,
        overflowMm: overflow,
        wordCount: words,
        diagramHeight: diagramHeight
      };
      
      // Interactive review of overflow fixes
      const action = await reviewOverflowFixes(title, overflowAnalysis);
      
      let fixedHtml = null;
      let editedFields = null;
      
      if (action === 'auto-all') {
        // Apply all recommended fixes automatically
        fixedHtml = await applyFixesAutomatically({ ...page, preparedContent: page.preparedContent }, analysis.fixes, analysis.recommended);
      } else if (action === 'auto-step') {
        // Apply recommended fixes one by one with confirmation
        fixedHtml = page.preparedContent;
        for (const fixId of analysis.recommended) {
          const fix = analysis.fixes.find(f => f.id === fixId);
          if (!fix || !fix.autoApplicable) continue;
          const result = await applyFixesAutomatically({ ...page, preparedContent: fixedHtml }, analysis.fixes, [fixId]);
          fixedHtml = result.explainerHtml;
          console.log(`  ✅ Applied fix [${fixId}]: ${fix.description}`);
        }
      } else if (action === 'edit') {
        // Edit manually in editor. editInEditor returns the edited fields.
        const edited = await editInEditor({
          title: page.title,
          subtitle: page.subtitle,
          explainerHtml: page.preparedContent,
          actionLabel: page.preparedActionLabel || page.actionCallout?.label,
          actionContent: page.preparedActionContent || page.actionCallout?.content,
          imageType: page.imageMeta?.type || 'diagram',
          imagePrompt: page.imagePrompt,
        });
        fixedHtml = edited.explainerHtml;
        editedFields = edited;
      } else if (action === 'regenerate') {
        // Regenerate with instruction
        const { instruction } = await import('prompts').then(p => p({
          type: 'text',
          name: 'instruction',
          message: 'Regeneration instruction:'
        }));
        if (instruction) {
          // Write new prompt with instruction
          const fixPromptFile = path.join(bookDir, '.work', `page-${String(page.no).padStart(3, '0')}-fix-prompt.json`);
          const fixResponseFile = path.join(bookDir, '.work', `page-${String(page.no).padStart(3, '0')}-fix-response.json`);
          const fixPromptData = {
            page: { title, no: page.no, section: page.section },
            currentHtml: page.preparedContent,
            overflow: { mm: overflow, words, diagramHeight },
            analysis: { rootCauses: analysis.rootCauses, fixes: analysis.fixes, recommended: analysis.recommended },
            instructions: `Apply the recommended fixes to the HTML. User instruction: ${instruction}. Return JSON with: { "explainerHtml": "...", "wordCount": N }.`
          };
          writePromptFile(fixPromptFile, fixPromptData);
          const fixResponse = await getProposal(provider, fixPromptFile, fixResponseFile, 'coding agent fix');
          fixedHtml = fixResponse?.explainerHtml || null;
        }
      } else if (action === 'reduce-diagram') {
        // Reduce diagram height and re-check
        const newHeight = Math.max(100, diagramHeight - 30);
        console.log(`  Reducing diagram height from ${diagramHeight}px to ${newHeight}px`);
        page.imageMeta = { ...page.imageMeta, height: newHeight };
        // Re-render and check will happen in next validation round
        fixedHtml = page.preparedContent;
      } else if (action === 'split') {
        console.log('  Split page not yet implemented, skipping...');
        fixedHtml = page.preparedContent;
      } else if (action === 'accept') {
        console.log('  Accepting overflow for this page');
        fixedHtml = page.preparedContent;
      }
      
      // Validate fix. validatePage reads explainerHtml, so build a real proposal
      // shape here; passing { preparedContent } silently always failed.
      if (fixedHtml) {
        const candidate = editedFields || {
          title: page.title,
          subtitle: page.subtitle,
          explainerHtml: fixedHtml,
          actionLabel: page.preparedActionLabel || page.actionCallout?.label || 'TRY THIS',
          actionContent: page.preparedActionContent || page.actionCallout?.content || '',
          imageType: page.imageMeta?.type || 'diagram',
          imagePrompt: page.imagePrompt || '',
          wordCount: countWords(fixedHtml),
        };
        const validation = validatePage(candidate);
        if (validation.valid) {
          page.preparedContent = fixedHtml;
          if (editedFields) {
            if (editedFields.title) page.preparedTitle = editedFields.title;
            if (editedFields.subtitle) page.preparedSubtitle = editedFields.subtitle;
            if (editedFields.actionContent) page.preparedActionContent = editedFields.actionContent;
          }
          addPrepHistoryEntry(page, 'overflow-fix', {
            fixes: analysis.recommended,
            overflowBefore: overflow,
            overflowAfter: 0,
            action,
            authoredBy: editedFields ? 'human' : 'agent'
          });
          console.log(`  ✅ Fixed (${countWords(fixedHtml)} words)`);
        } else {
          console.log(`  ❌ Fix invalid: ${validation.errors.join(', ')}`);
        }
      }
    }
  }
  
  if (!validationPassed) {
    console.log('\n⚠️  Max validation rounds reached. Some pages may still overflow.');
  }
}

/**
 * Read back a page edited in $EDITOR.
 *
 * Split out from the editor round-trip so it can be tested without spawning a
 * real editor. Marker comments delimit each field. If the body is plain prose
 * with no tags it is wrapped in <p>, because validatePage requires paragraph
 * markup and typing prose into an editor should not be punished for that.
 */
export function parseEditedPage(text, seed = {}) {
  const field = (label) => {
    const m = text.match(new RegExp(`<!--\\s*${label}:\\s*([\\s\\S]*?)\\s*-->`));
    return m ? m[1].trim() : '';
  };

  const bodyMatch = text.match(/<!-- Subtitle:[\s\S]*?-->\n([\s\S]*?)\n<!-- Action:/);
  let body = bodyMatch ? bodyMatch[1].trim() : (seed.explainerHtml ?? seed.preparedContent ?? '');

  if (body && !/<[a-z]/i.test(body)) {
    const paragraphs = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
    body = paragraphs.map((p) => `<p>${p}</p>`).join('\n');
  }

  const result = {
    title: field('Title') || seed.title || '',
    subtitle: field('Subtitle') || seed.subtitle || '',
    explainerHtml: body,
    actionLabel: seed.actionLabel || '',
    actionContent: seed.actionContent || '',
    imageType: seed.imageType || 'diagram',
    imagePrompt: seed.imagePrompt || '',
  };

  // If the seed carried no action, recover it from the "Label - Content" marker.
  const actionRaw = field('Action');
  const dashAt = actionRaw.indexOf(' - ');
  if (dashAt !== -1 && !result.actionContent) {
    result.actionLabel = actionRaw.slice(0, dashAt).trim();
    result.actionContent = actionRaw.slice(dashAt + 3).trim();
  }

  result.wordCount = countWords(result.explainerHtml);
  return result;
}

/**
 * Open a page in $EDITOR and return the edited fields.
 *
 * Accepts either shape used by callers: { explainerHtml } or { preparedContent }.
 */
async function editInEditor(proposal) {
  const seedHtml = proposal.explainerHtml ?? proposal.preparedContent ?? '';
  const tempFile = path.join(os.tmpdir(), `page-proposal-${Date.now()}.html`);
  const editContent = `
<!-- Edit the explainer below. Keep valid HTML structure. -->
<!-- Three paragraphs read best: opener + pain, mechanism + outcome, then a one-line closer. -->
<!-- Colour roles are optional: class="bad" (threat), class="hl" (mechanism), class="good" (outcome). -->
<!-- Keep it under ${MAX_WORDS} words. Save and close when done. -->
<!-- Title: ${proposal.title || ''} -->
<!-- Subtitle: ${proposal.subtitle || ''} -->
${seedHtml}

<!-- Action: ${proposal.actionLabel || ''} - ${proposal.actionContent || ''} -->
<!-- Image: ${proposal.imageType || ''} - ${proposal.imagePrompt || ''} -->
`;
  fs.writeFileSync(tempFile, editContent);
  
  const editor = process.env.EDITOR || (process.platform === 'win32' ? 'notepad' : 'nano');
  const { spawn } = await import('node:child_process');
  
  await new Promise((resolve, reject) => {
    const child = spawn(editor, [tempFile], { stdio: 'inherit' });
    child.on('close', resolve);
    child.on('error', reject);
  });
  
  return parseEditedPage(fs.readFileSync(tempFile, 'utf8'), proposal);
}

export { prepareOnePage, resolveOverflow, editInEditor, getProposal };