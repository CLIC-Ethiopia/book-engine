#!/usr/bin/env node
/*
  ideas-to-book.mjs  -  CLI orchestrator for the ideas-to-book automation
  --------------------------------------------------------------------------
  Usage:
    node engine/tools/ideas-to-book.mjs --list-ideas
    node engine/tools/ideas-to-book.mjs --select
    node engine/tools/ideas-to-book.mjs ideas/example.md
    node engine/tools/ideas-to-book.mjs ideas/example.md --skip-assets --dry-run

  Workflow:
    1. Parse idea file → manifest
    2. Scaffold book folder from template
    3. Render pages into interior HTML
    4. Generate images (photos only)
    5. Build → check → shot → export
    6. Visual approval gates between stages
*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prompts from 'prompts';
import { parseIdeaFile, writeManifest, selectIdeaFile } from './idea-parser.mjs';
import { classifyImage } from './book-render.mjs';
import { generateImage } from './book-assets.mjs';
import { prepPages } from './prep-pages.mjs';
import { execa } from 'execa';
import { fail, pad2, normalizeSlug, deriveSlugFromTitle, formatFileSize } from './shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const IDEAS_ROOT = path.join(PROJECT_ROOT, 'ideas');
const DEFAULT_TEMPLATE = 'books/STEAM-IE-FOR-HYDROPONICS';

const STAGES = [
  'list',
  'parse',
  'scaffold',
  'inherit',        // Gate 2.5: Inherited template pages editing (cover, toc, etc.)
  'plan',
  'prep',           // Gate 3.5: LLM-driven content preparation (opt-in with --prep-page)
  'classify',
  'render',
  'diagrams',       // Gate 6.5: Generate SVG diagrams via coding agent
  'generate',
  'build',
  'check',
  'screenshot',
  'approveScreenshots',
  'export',
];

const APPROVAL_STATE = {
  PARSED: 'parsed',
  SCAFFOLDED: 'scaffolded',
  INHERITED: 'inheritedEdited',
  PLANNED: 'planned',
  PREPARED: 'pagesPrepared',
  CLASSIFIED: 'assetsClassified',
  RENDERED: 'pagesRendered',
  DIAGRAMS: 'diagramsGenerated',
  GENERATED: 'assetsGenerated',
  BUILT: 'buildPassed',
  CHECKED: 'checksPassed',
  SCREENSHOTS_APPROVED: 'screenshotsApproved',
  EXPORTED: 'pdfExported',
};

function getApprovalPath(bookDir) {
  return path.join(bookDir, '.work', 'approval.json');
}

function loadApprovalState(bookDir) {
  const approvalPath = getApprovalPath(bookDir);
  if (!fs.existsSync(approvalPath)) {
    return { slug: path.basename(bookDir), stages: {}, approvals: [] };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(approvalPath, 'utf8'));
    return {
      ...parsed,
      slug: parsed.slug || path.basename(bookDir),
      stages: parsed.stages || {},
      approvals: parsed.approvals || [],
      citationStyle: parsed.citationStyle,
    };
  } catch {
    return { slug: path.basename(bookDir), stages: {}, approvals: [] };
  }
}

function saveApprovalState(bookDir, state) {
  const approvalPath = getApprovalPath(bookDir);
  const workDir = path.dirname(approvalPath);
  if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });
  fs.writeFileSync(approvalPath, `${JSON.stringify(state, null, 2)}\n`);
}

function markApproved(bookDir, stage) {
  const state = loadApprovalState(bookDir);
  const prev = state.stages[stage] || false;
  state.stages[stage] = true;
  state.approvals.push({
    stage,
    approvedBy: 'human',
    at: new Date().toISOString(),
  });
  saveApprovalState(bookDir, state);
  console.log(`✅ Stage "${stage}" approved.`);
}

function isApproved(bookDir, stage) {
  const state = loadApprovalState(bookDir);
  return state.stages[stage] === true;
}

export function firstUnapprovedStage(bookDir) {
  const state = loadApprovalState(bookDir);
  const STAGE_APPROVAL_MAP = {
    parse: APPROVAL_STATE.PARSED,
    scaffold: APPROVAL_STATE.SCAFFOLDED,
    inherit: APPROVAL_STATE.INHERITED,
    plan: APPROVAL_STATE.PLANNED,
    prep: APPROVAL_STATE.PREPARED,
    classify: APPROVAL_STATE.CLASSIFIED,
    render: APPROVAL_STATE.RENDERED,
    diagrams: APPROVAL_STATE.DIAGRAMS,
    generate: APPROVAL_STATE.GENERATED,
    build: APPROVAL_STATE.BUILT,
    check: APPROVAL_STATE.CHECKED,
    screenshot: APPROVAL_STATE.SCREENSHOTS_APPROVED,
    approveScreenshots: APPROVAL_STATE.SCREENSHOTS_APPROVED,
    export: APPROVAL_STATE.EXPORTED,
  };
  const allStages = STAGES.filter(s => s !== 'list');
  for (const stage of allStages) {
    const approvalKey = STAGE_APPROVAL_MAP[stage];
    if (!state.stages || !state.stages[approvalKey]) {
      return stage;
    }
  }
  return null;
}

function getBookFiles(bookDir) {
  const files = [];
  function walk(dir, relativeBase) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const relative = path.join(relativeBase, entry.name);
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), relative);
      } else {
        const fullPath = path.join(dir, entry.name);
        const stats = fs.statSync(fullPath);
        files.push({ relative, size: stats.size });
      }
    }
  }
  walk(bookDir, '');
  return files;
}

async function generateDiagramSVG(bookDir, title, prompt) {
  const { processDiagramStage } = await import('./diagram-generator.mjs');
  const manifestPath = path.join(bookDir, '.work', 'idea-manifest.json');
  let pageInfo = { title, imagePrompt: prompt };
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const found = manifest.pages?.find((p) => p.title === title);
    if (found) pageInfo = found;
  }
  const result = await processDiagramStage(bookDir, pageInfo, { prompt });
  return result.svgPath;
}

async function rollback(bookDir) {
  const files = getBookFiles(bookDir);
  if (!files.length) {
    console.log('No files to roll back.');
    return false;
  }

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  console.log(`\n=== Rollback ===`);
  console.log(`Files created or modified in ${path.relative(PROJECT_ROOT, bookDir)} (${files.length} files, ${formatFileSize(totalSize)}):`);
  files.forEach((f) => console.log(`  ${f.relative} (${formatFileSize(f.size)})`));

  const answer = await prompts({
    type: 'select',
    name: 'action',
    message: 'What would you like to do?',
    choices: [
      { title: 'Delete the new book folder entirely', value: 'delete' },
      { title: 'Keep it as a draft', value: 'keep' },
      { title: 'Cancel — list only, do nothing yet', value: 'list_only' },
    ],
  });

  if (answer.action === 'delete') {
    fs.rmSync(bookDir, { recursive: true, force: true });
    console.log(`Deleted ${path.relative(PROJECT_ROOT, bookDir)} (${files.length} files removed).`);
    return true;
  } else if (answer.action === 'keep') {
    console.log(`Kept ${path.relative(PROJECT_ROOT, bookDir)} as a draft.`);
    return false;
  } else {
    console.log('Listing only. Run again to decide.');
    return false;
  }
}

function listIdeas() {
  if (!fs.existsSync(IDEAS_ROOT)) {
    console.log(`\nIdeas folder: ${IDEAS_ROOT}`);
    console.log('No ideas folder found. Create it at the project root.');
    process.exit(1);
  }
  const mdFiles = fs.readdirSync(IDEAS_ROOT)
    .filter((f) => f.endsWith('.md'))
    .sort((a, b) => a.localeCompare(b));
  const jsonFiles = fs.readdirSync(IDEAS_ROOT)
    .filter((f) => f.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));
  const files = [...jsonFiles, ...mdFiles];
  if (!files.length) {
    console.log('No idea files found in ideas/');
    process.exit(0);
  }
  console.log(`\nIdea files (${files.length}):`);
  jsonFiles.forEach((f) => console.log(`  ${f} [JSON]`));
  mdFiles.forEach((f) => console.log(`  ${f} [MD]`));
  process.exit(0);
}

export function loadJsonManifest(jsonPath) {
  const raw = fs.readFileSync(jsonPath, 'utf8');
  const json = JSON.parse(raw);
  
  // Convert JSON to same manifest structure as parseIdeaFile produces
  const pages = json.pages || [];
  const SECTION_EYEBROWS = {
    Science: 'S',
    Technology: 'T',
    Engineering: 'E',
    Arts: 'A',
    Mathematics: 'M',
    Innovation: 'I',
    Entrepreneurship: 'IE',
  };
  
  function buildParts(pages) {
    const parts = [];
    for (const page of pages) {
      let part = parts.find((candidate) => candidate.name === page.section);
      if (!part) {
        part = {
          name: page.section,
          eyebrow: SECTION_EYEBROWS[page.section] || page.section.charAt(0).toUpperCase(),
          blocks: [],
        };
        parts.push(part);
      }
      part.blocks.push(page.title);
    }
    return parts;
  }
  
  const totalCitations = pages.reduce((total, page) => total + (page.citations?.length || 0), 0);
  
  const manifest = {
    sourceFile: path.relative(PROJECT_ROOT, jsonPath).split(path.sep).join('/'),
    slug: json.slug,
    title: json.title || '',
    subtitle: json.subtitle || '',
    author: json.author || '',
    series: json.series || '',
    editionLabel: json.editionLabel || 'Edition 1.0',
    audience: json.audience || '',
    primaryLocation: json.primaryLocation || '',
    coverImage: json.coverImage || 'images/cover.png',
    pages: pages.map(page => ({
      no: page.no,
      section: page.section,
      title: page.title,
      subtitle: page.subtitle || '',
      content: page.content || '',
      imagePrompt: page.imagePrompt || '',
      imageType: page.imageType || 'diagram',
      actionCallout: page.actionCallout || { label: 'TRY THIS', content: '' },
      citations: (page.citations || []).map(num => ({ marker: `[cite: ${num}]`, number: num }))
    })),
    parts: buildParts(pages),
    totalPages: pages.length,
    totalCitations,
  };
  
  return manifest;
}


async function handleStage(stage, args, manifest, bookDir, options) {
  const approvalPath = getApprovalPath(bookDir);
  switch (stage) {
    case 'parse': {
      console.log(`\n=== Parsing: ${manifest.title} ===`);
      console.log(`Pages: ${manifest.totalPages}`);
      console.log(`Parts: ${manifest.parts.map((p) => `${p.name} (${p.blocks.length})`).join(', ')}`);
      console.log(`Citations: ${manifest.totalCitations}`);
      if (options.dryRun) {
        console.log('[dry run] skipping write.');
        break;
      }
      writeManifest(manifest, bookDir);

      if (options.interactive) {
        const ans = await prompts({
          type: 'confirm',
          name: 'approved',
          message: 'Approve parsed manifest and continue?',
          initial: true,
        });
        if (!ans.approved) {
          fail('Parse rejected. Adjust idea file and re-run.');
        }
      }
      markApproved(bookDir, APPROVAL_STATE.PARSED);
      break;
    }
    case 'scaffold': {
      if (isApproved(bookDir, APPROVAL_STATE.SCAFFOLDED) && !options.force) {
        console.log('Scaffold already approved. Skipping.');
        break;
      }
      console.log(`\n=== Scaffolding book: ${manifest.slug} ===`);
      // Import scaffold dynamically to avoid circular deps
      const { default: runScaffold } = await import('./book-scaffold.mjs');
      const scaffoldArgs = [
        manifest.sourceFile,
        '--template', options.templatePath,
        '--slug', path.basename(bookDir),
        '--force',
        '--no-interactive',
      ];
      await runScaffold(scaffoldArgs);
      if (options.interactive) {
        const ans = await prompts({
          type: 'confirm',
          name: 'approved',
          message: 'Approve scaffold and continue?',
          initial: true,
        });
        if (!ans.approved) {
          const deleted = await rollback(bookDir);
          if (deleted) {
            process.exit(0);
          } else {
            // User chose to keep as draft or list only - exit anyway to allow manual cleanup/decision
            process.exit(0);
          }
        }
      }
      markApproved(bookDir, APPROVAL_STATE.SCAFFOLDED);
      break;
    }
    case 'inherit': {
      if (isApproved(bookDir, APPROVAL_STATE.INHERITED) && !options.force) {
        console.log('Inherited pages already edited. Skipping.');
        break;
      }
      console.log(`\n=== Inherited Pages Editing (Gate 2.5) ===`);
      if (!isApproved(bookDir, APPROVAL_STATE.SCAFFOLDED) && !options.dryRun) {
        fail('Previous stage (scaffold) not approved.');
      }
      
      const { editInheritedPages } = await import('./inherited-pages.mjs');
      await editInheritedPages(bookDir, manifest, { 
        auto: !options.interactive, 
        interactive: options.interactive 
      });
      
      if (options.dryRun) {
        console.log('[dry run] skipping approval.');
        break;
      }
      
      if (options.interactive) {
        const ans = await prompts({
          type: 'confirm',
          name: 'approved',
          message: 'Approve inherited pages edits and continue?',
          initial: true,
        });
        if (!ans.approved) {
          fail('Inherited pages edits rejected. Re-run inherit stage.');
        }
      }
      
      markApproved(bookDir, APPROVAL_STATE.INHERITED);
      break;
    }
    case 'plan': {
      console.log(`\n=== Page Conversion Plan (Gate 3) ===`);
      if (!isApproved(bookDir, APPROVAL_STATE.PARSED) && !options.dryRun) {
        fail('Previous stage (parse) not approved.');
      }

      // Show page plan
      console.log(`Book: ${manifest.title}`);
      console.log(`Pages: ${manifest.totalPages}`);
      console.log(`Parts: ${manifest.parts.map((p) => `${p.name} (${p.blocks.length} pages)`).join(', ')}`);
      console.log(`\nPage order:`);
      manifest.pages.forEach((page, i) => {
        console.log(`  ${pad2(i + 1)}. [${page.section}] ${page.title}`);
        if (page.subtitle) console.log(`       ${page.subtitle}`);
        console.log(`       Action: ${page.actionCallout?.label || 'N/A'}`);
      });

      if (manifest.totalCitations > 0) {
        console.log(`\nCitations: ${manifest.totalCitations} total`);
      }

      if (options.dryRun) {
        console.log('[dry run] skipping approval.');
        break;
      }

      if (options.interactive) {
        const ans = await prompts({
          type: 'confirm',
          name: 'approved',
          message: 'Approve this page plan and continue to image classification?',
          initial: true,
        });
        if (!ans.approved) {
          fail('Page plan rejected. Adjust idea file and re-run parse stage.');
        }
      }

      // Citation handling decision (Gate 2 per spec)
      let citationStyle = 'preserve';
      if (manifest.totalCitations > 0) {
        const state = loadApprovalState(bookDir);
        if (state.citationStyle) {
          citationStyle = state.citationStyle;
        } else if (options.interactive) {
          const citeAns = await prompts({
            type: 'select',
            name: 'style',
            message: `Found ${manifest.totalCitations} citations. How should they be handled?`,
            choices: [
              { title: 'Preserve them as source markers (default)', value: 'preserve' },
              { title: 'Convert them into footnotes', value: 'footnotes' },
              { title: 'Create a references page', value: 'references' },
              { title: 'Do not include citations in the book', value: 'remove' }
            ]
          });
          citationStyle = citeAns.style || 'preserve';
          state.citationStyle = citationStyle;
          saveApprovalState(bookDir, state);
        }
      }

      // Store citation style for render stage
      const state = loadApprovalState(bookDir);
      state.citationStyle = citationStyle;
      saveApprovalState(bookDir, state);

      markApproved(bookDir, APPROVAL_STATE.PLANNED);
      break;
    }
    case 'prep': {
      if (!options.prepPage) {
        console.log('\n=== Content Preparation (Gate 3.5) ===');
        console.log('Skipped (use --prep-page to enable LLM-driven preparation)');
        markApproved(bookDir, APPROVAL_STATE.PREPARED);
        break;
      }
      
      console.log(`\n=== Content Preparation (Gate 3.5) ===`);
      if (!isApproved(bookDir, APPROVAL_STATE.PLANNED) && !options.dryRun) {
        fail('Previous stage (plan) not approved.');
      }

      console.log('Running LLM-driven content preparation...');
      const { prepPages } = await import('./prep-pages.mjs');
      const { manifest: updatedManifest, diffs } = await prepPages(bookDir, { 
        auto: !options.interactive, 
        useLLM: options.useLLM,
        force: options.force
      });

      // Update manifest with prepared content
      Object.assign(manifest, updatedManifest);

      console.log(`\nPrepared ${diffs.length} pages.`);
      diffs.forEach((d) => {
        console.log(`  ${d.page}: ${d.originalWords} → ${d.preparedWords} words (${((1 - d.preparedWords/d.originalWords)*100).toFixed(0)}% reduction)`);
      });

      if (options.dryRun) {
        console.log('[dry run] skipping approval.');
        break;
      }

      if (options.interactive) {
        const ans = await prompts({
          type: 'confirm',
          name: 'approved',
          message: 'Approve prepared content for all pages?',
          initial: true,
        });
        if (!ans.approved) {
          fail('Content preparation rejected. Adjust and re-run.');
        }
      }

      markApproved(bookDir, APPROVAL_STATE.PREPARED);
      break;
    }
    case 'classify': {
      console.log(`\n=== Image Classification (Gate 4) ===`);
      if (!isApproved(bookDir, APPROVAL_STATE.PREPARED) && !options.dryRun) {
        fail('Previous stage (prep) not approved.');
      }
      const { classifyAll } = await import('./book-assets.mjs');

      // Interactive classification
      console.log('Classifying each page as Photo or Diagram...');
      const autoClassify = !options.interactive;
      const classifications = await classifyAll(manifest, path.join(bookDir, 'images'), autoClassify);
      console.log('\nClassifications:');
      classifications.forEach((c) => console.log(`  ${c.title}: ${c.type}`));

      if (options.dryRun) {
        console.log('[dry run] skipping approval.');
        break;
      }

      if (options.interactive) {
        const ans = await prompts({
          type: 'confirm',
          name: 'approved',
          message: 'Approve these classifications?',
          initial: true,
        });
        if (!ans.approved) {
          fail('Classification rejected. Re-run classify stage after adjusting prompts.');
        }
      }

      // Save classifications to approval state for next stages
      const state = loadApprovalState(bookDir);
      state.classifications = classifications;
      saveApprovalState(bookDir, state);

      markApproved(bookDir, APPROVAL_STATE.CLASSIFIED);
      break;
    }
    case 'render': {
      console.log(`\n=== HTML Generation & Review (Gate 5) ===`);
      if (!isApproved(bookDir, APPROVAL_STATE.CLASSIFIED) && !options.dryRun) {
        fail('Previous stage (classify) not approved.');
      }
      const { renderInterior } = await import('./book-render.mjs');

      const bookConfigPath = path.join(bookDir, 'book.json');
      const bookConfig = fs.existsSync(bookConfigPath) ? JSON.parse(fs.readFileSync(bookConfigPath, 'utf8')) : {};

      // Get citation style and classifications from approval state
      const state = loadApprovalState(bookDir);
      const citationStyle = state.citationStyle || 'preserve';
      const classifications = state.classifications || [];

      // Write prompt files
      const imagesDir = path.join(bookDir, 'images');
      if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
      manifest.pages.forEach((page) => {
        if (page.imagePrompt) {
          const promptFile = path.join(imagesDir, `${normalizeSlug(page.title)}.txt`);
          fs.writeFileSync(promptFile, `
${page.imagePrompt}

Style guidelines:
- No text in the image.
- No logos or brands.
- Soft daylight, front angle, plain neutral background.
- Consistent book style: clear, clean, professional, modern layout style.
`.trim(), 'utf8');
        }
      });

      // Generate interior HTML with classifications
      let renderOptions = {};
      if (citationStyle === 'footnotes' || citationStyle === 'references') {
        if (options.interactive && citationStyle === 'footnotes') {
          const ans = await prompts({
            type: 'confirm',
            name: 'includeFootnotes',
            message: 'Include footnotes page at end of book?',
            initial: true,
          });
          renderOptions.includeFootnotes = ans.includeFootnotes;
        }
        if (options.interactive && citationStyle === 'references') {
          const ans = await prompts({
            type: 'confirm',
            name: 'includeReferences',
            message: 'Include references page at end of book?',
            initial: true,
          });
          renderOptions.includeReferences = ans.includeReferences;
        }
      }
      const html = renderInterior(manifest, bookConfig, classifications, citationStyle, { ...renderOptions, bookDir });
      const slug = path.basename(bookDir);
      const outputPath = path.join(bookDir, `${slug}.html`);
      fs.writeFileSync(outputPath, html, 'utf8');
      console.log(`\n✅ Interior HTML generated: ${slug}.html`);

      if (options.dryRun) {
        console.log('[dry run] skipping approval.');
        break;
      }

      // Gate 5: Review HTML
      console.log('\n--- Page Preview (first 3 pages) ---');
      const preview = html.split('<section class="sheet bb">').slice(1, 4).map(s => '<section class="sheet bb">' + s).join('\n');
      console.log(preview.substring(0, 2000) + '...');

      if (options.interactive) {
        const ans = await prompts({
          type: 'confirm',
          name: 'approved',
          message: 'Approve generated HTML and continue to asset generation?',
          initial: true,
        });
        if (!ans.approved) {
          const deleted = await rollback(bookDir);
          if (deleted) {
            process.exit(0);
          } else {
            // User chose to keep as draft or list only - exit anyway to allow manual cleanup/decision
            process.exit(0);
          }
        }
      }

      markApproved(bookDir, APPROVAL_STATE.RENDERED);
      break;
    }
    case 'diagrams': {
      console.log(`\n=== Diagram Generation (Gate 6.5) ===`);
      if (!isApproved(bookDir, APPROVAL_STATE.RENDERED) && !options.dryRun) {
        fail('Previous stage (render) not approved.');
      }
      
      // Get classifications from approval state
      const state = loadApprovalState(bookDir);
      const classifications = state.classifications || [];
      
      if (options.dryRun) {
        console.log('[dry run] skipping diagram generation.');
        break;
      }
      
      // Handle --skip-assets: skip all asset generation
      if (options.skipAssets) {
        console.log('--skip-assets: Skipping diagram generation. Placeholders will be used.');
        markApproved(bookDir, APPROVAL_STATE.DIAGRAMS);
        break;
      }
      
      // Generate SVG diagrams for diagram-type pages
      const diagramPages = classifications.filter(c => c.type === 'diagram');
      console.log(`Generating SVG diagrams for ${diagramPages.length} pages...`);
      
      let generatedCount = 0;
      let failedCount = 0;
      
      for (const c of diagramPages) {
        try {
          const svgPath = await generateDiagramSVG(bookDir, c.title, c.prompt || '');
          console.log(`  ✓ ${c.title} -> ${path.basename(svgPath)}`);
          generatedCount++;
        } catch (e) {
          console.error(`  ✗ ${c.title}: ${e.message}`);
          failedCount++;
        }
      }
      
      console.log(`\n✅ Diagram generation complete: ${generatedCount} generated, ${failedCount} failed`);

      // Re-render the interior so the freshly written SVGs get inlined.
      // renderInterior() reads images/<slug>.svg per page and only falls back
      // to the dashed placeholder when that file is absent.
      {
        const { renderInterior } = await import('./book-render.mjs');
        const bookConfigPath = path.join(bookDir, 'book.json');
        const bookConfig = fs.existsSync(bookConfigPath)
          ? JSON.parse(fs.readFileSync(bookConfigPath, 'utf8'))
          : {};
        const rerendered = renderInterior(
          manifest,
          bookConfig,
          state.classifications || [],
          state.citationStyle || 'preserve',
          { bookDir }
        );
        const interiorPath = path.join(bookDir, `${path.basename(bookDir)}.html`);
        fs.writeFileSync(interiorPath, rerendered, 'utf8');
        // Count leftover dashed placeholders - each one is a page whose SVG was not injected.
        const leftovers = (rerendered.match(/TODO: AGY BLOCK SKILL/g) || []).length;
        console.log(`   Re-rendered interior: ${diagramPages.length - leftovers}/${diagramPages.length} diagrams inlined`);
      }

      if (options.interactive) {
        const ans = await prompts({
          type: 'confirm',
          name: 'approved',
          message: 'Approve generated diagrams and continue to photo generation?',
          initial: true,
        });
        if (!ans.approved) {
          fail('Diagrams rejected. Re-run diagrams stage.');
        }
      }
      
      markApproved(bookDir, APPROVAL_STATE.DIAGRAMS);
      break;
    }
    case 'generate': {
      console.log(`\n=== Asset Generation (Gate 6) ===`);
      if (!isApproved(bookDir, APPROVAL_STATE.DIAGRAMS) && !options.dryRun) {
        fail('Previous stage (diagrams) not approved.');
      }
      const { generateImage } = await import('./book-assets.mjs');

      // Get classifications from approval state
      const state = loadApprovalState(bookDir);
      const classifications = state.classifications || [];

      if (options.dryRun) {
        console.log('[dry run] skipping generation.');
        break;
      }

      // Handle --skip-assets: skip all asset generation (photos + diagrams)
      if (options.skipAssets) {
        console.log('--skip-assets: Skipping all asset generation. Placeholders will be used for both photos and diagrams.');
        const report = {
          slug: path.basename(bookDir),
          generatedAt: new Date().toISOString(),
          pages: manifest.totalPages,
          classifications,
          generated: [],
          failed: [],
          totalImages: 0,
          totalDiagrams: classifications.filter((c) => c.type === 'diagram').length,
          skipped: true
        };
        fs.writeFileSync(path.join(bookDir, '.work', 'asset-report.json'), `${JSON.stringify(report, null, 2)}\n`);
        console.log(`\n✅ Asset report (skipped):`);
        console.log(`   Photos generated: 0`);
        console.log(`   Diagrams (placeholder): ${report.totalDiagrams}`);
        console.log(`   Total pages: ${report.pages}`);
        
        if (options.interactive) {
          const ans = await prompts({
            type: 'confirm',
            name: 'approved',
            message: 'Continue with placeholders only?',
            initial: true,
          });
          if (!ans.approved) {
            fail('Assets rejected. Re-run without --skip-assets to generate.');
          }
        }
        markApproved(bookDir, APPROVAL_STATE.GENERATED);
        break;
      }

      const imagesDir = path.join(bookDir, 'images');
      const generated = [];
      const generatedDiagrams = [];
      const failed = [];

      // Default behavior: Generate SVG diagrams for diagram-type pages
      console.log('\nGenerating SVG diagrams...');
      for (const c of classifications) {
        if (c.type === 'diagram') {
          try {
            const svgPath = await generateDiagramSVG(bookDir, c.title, c.prompt || '');
            generatedDiagrams.push({ title: c.title, path: svgPath, type: 'diagram' });
            console.log(`  ✓ ${c.title} (SVG created)`);
          } catch (e) {
            console.error(`  ✗ ${c.title} diagram: ${e.message}`);
            failed.push({ title: c.title, error: `Diagram: ${e.message}` });
          }
        }
      }

      // Handle --generate-assets: also generate photos
      if (options.generateAssets) {
        console.log('\n--generate-assets: Generating photos...');
        for (const c of classifications) {
          if (c.type === 'photo') {
            const promptFile = path.join(imagesDir, `${normalizeSlug(c.title)}.txt`);
            try {
              const outPath = await generateImage(imagesDir, c.title, promptFile);
              generated.push({ title: c.title, path: outPath, type: 'photo' });
              console.log(`  ✓ ${c.title}`);
            } catch (e) {
              console.error(`  ✗ ${c.title}: ${e.message}`);
              failed.push({ title: c.title, error: e.message });
            }
          }
        }
      } else {
        // Default: photos get placeholder
        for (const c of classifications) {
          if (c.type === 'photo') {
            console.log(`  ↷ ${c.title}: photo (placeholder, use --generate-assets to create)`);
          }
        }
      }

      // Asset report
      const report = {
        slug: path.basename(bookDir),
        generatedAt: new Date().toISOString(),
        pages: manifest.totalPages,
        classifications,
        generated: [...generated, ...generatedDiagrams],
        failed,
        totalImages: generated.length,
        totalDiagrams: generatedDiagrams.length,
        placeholderDiagrams: classifications.filter((c) => c.type === 'diagram').length - generatedDiagrams.length,
      };
      fs.writeFileSync(path.join(bookDir, '.work', 'asset-report.json'), `${JSON.stringify(report, null, 2)}\n`);

      console.log(`\n✅ Asset report:`);
      console.log(`   Photos generated: ${report.totalImages}`);
      console.log(`   Diagrams generated: ${report.totalDiagrams}`);
      console.log(`   Diagrams (placeholder): ${report.placeholderDiagrams}`);
      console.log(`   Failed: ${failed.length}`);
      console.log(`   Total pages: ${report.pages}`);

      if (failed.length > 0) {
        console.log('\nFailed generations:');
        failed.forEach((f) => console.log(`  - ${f.title}: ${f.error}`));

        if (options.interactive) {
          const recoveryAns = await prompts({
            type: 'select',
            name: 'action',
            message: 'Some images failed. How to proceed?',
            choices: [
              { title: 'Retry all failed images', value: 'retry' },
              { title: 'Skip failed (use placeholder)', value: 'skip' },
              { title: 'Change failed to diagram type', value: 'diagram' },
              { title: 'Go back to classification gate', value: 'back' },
              { title: 'Cancel and preserve progress', value: 'cancel' },
            ],
          });

          if (recoveryAns.action === 'retry') {
            console.log('Re-run generate stage to retry.');
            process.exit(1);
          } else if (recoveryAns.action === 'skip') {
            console.log('Skipped failed images. Placeholders will be used.');
          } else if (recoveryAns.action === 'diagram') {
            failed.forEach(f => {
              const idx = classifications.findIndex(c => c.title === f.title);
              if (idx >= 0) classifications[idx].type = 'diagram';
            });
            state.classifications = classifications;
            saveApprovalState(bookDir, state);
            console.log('Changed failed images to diagram type. Re-run generate stage.');
            process.exit(1);
          } else if (recoveryAns.action === 'back') {
            console.log('Go back to classify stage: re-run with --stage classify');
            process.exit(1);
          } else if (recoveryAns.action === 'cancel') {
            console.log('Cancelled. Progress preserved in approval.json');
            process.exit(0);
          }
        } else {
          console.log('Non-interactive mode: skipping failed images.');
        }
      }

      if (options.dryRun) break;

      if (options.interactive) {
        const ans = await prompts({
          type: 'confirm',
          name: 'approved',
          message: 'Approve generated assets and continue to build?',
          initial: true,
        });
        if (!ans.approved) {
          fail('Assets rejected. Fix and re-run generate stage.');
        }
      }

      markApproved(bookDir, APPROVAL_STATE.GENERATED);
      break;
    }
    case 'build': {
      console.log(`\n=== Building book ===`);
      if (!isApproved(bookDir, APPROVAL_STATE.GENERATED)) {
        fail('Previous stage (generate) not approved. Run --stage generate first.');
      }
      try {
        await execa('node', ['engine/tools/build-book.mjs', `books/${path.basename(bookDir)}`], { cwd: PROJECT_ROOT, stdio: 'inherit' });
      } catch (e) {
        if (options.interactive) {
          const recoveryAns = await prompts({
            type: 'select',
            name: 'action',
            message: 'Build failed. How to proceed?',
            choices: [
              { title: 'Retry build', value: 'retry' },
              { title: 'Go back to generate stage', value: 'back' },
              { title: 'Cancel and preserve progress', value: 'cancel' },
            ],
          });
          if (recoveryAns.action === 'retry') {
            console.log('Re-run build stage to retry.');
            process.exit(1);
          } else if (recoveryAns.action === 'back') {
            console.log('Go back to generate stage: re-run with --stage generate');
            process.exit(1);
          } else {
            console.log('Cancelled. Progress preserved.');
            process.exit(0);
          }
        } else {
          throw e;
        }
      }
      if (options.interactive) {
        const ans = await prompts({
          type: 'confirm',
          name: 'approved',
          message: 'Build succeeded. Continue to checks?',
          initial: true,
        });
        if (!ans.approved) {
          fail('Build rejected.');
        }
      }
      markApproved(bookDir, APPROVAL_STATE.BUILT);
      break;
    }
    case 'check': {
      console.log(`\n=== Running checks ===`);
      try {
        await execa('node', ['engine/tools/check.mjs', `books/${path.basename(bookDir)}/book.html`], { cwd: PROJECT_ROOT, stdio: 'inherit' });
      } catch (e) {
        if (options.interactive) {
          const recoveryAns = await prompts({
            type: 'select',
            name: 'action',
            message: 'Check failed (overflow/broken images). How to proceed?',
            choices: [
              { title: 'Retry check', value: 'retry' },
              { title: 'Go back to build stage', value: 'back' },
              { title: 'Cancel and preserve progress', value: 'cancel' },
            ],
          });
          if (recoveryAns.action === 'retry') {
            console.log('Re-run check stage to retry.');
            process.exit(1);
          } else if (recoveryAns.action === 'back') {
            console.log('Go back to build stage: re-run with --stage build');
            process.exit(1);
          } else {
            console.log('Cancelled. Progress preserved.');
            process.exit(0);
          }
        } else {
          throw e;
        }
      }
      if (options.interactive) {
        const ans = await prompts({
          type: 'confirm',
          name: 'approved',
          message: 'Checks passed (0mm overflow). Continue to screenshots?',
          initial: true,
        });
        if (!ans.approved) {
          fail('Checks rejected.');
        }
      }
      markApproved(bookDir, APPROVAL_STATE.CHECKED);
      break;
    }
    case 'screenshot': {
      console.log(`\n=== Generating screenshots ===`);
      try {
        await execa('node', ['engine/tools/shot.mjs', `books/${path.basename(bookDir)}/book.html`], { cwd: PROJECT_ROOT, stdio: 'inherit' });
      } catch (e) {
        if (options.interactive) {
          const recoveryAns = await prompts({
            type: 'select',
            name: 'action',
            message: 'Screenshot generation failed. How to proceed?',
            choices: [
              { title: 'Retry screenshots', value: 'retry' },
              { title: 'Go back to check stage', value: 'back' },
              { title: 'Cancel and preserve progress', value: 'cancel' },
            ],
          });
          if (recoveryAns.action === 'retry') {
            console.log('Re-run screenshot stage to retry.');
            process.exit(1);
          } else if (recoveryAns.action === 'back') {
            console.log('Go back to check stage: re-run with --stage check');
            process.exit(1);
          } else {
            console.log('Cancelled. Progress preserved.');
            process.exit(0);
          }
        } else {
          throw e;
        }
      }
      console.log('Read screenshots in ' + path.join(bookDir, 'page1.png'));
      break;
    }
    case 'approveScreenshots': {
      console.log(`\n=== Screenshot approval (Gate 8) ===`);
      console.log('Open the screenshots and verify each page.');
      console.log('Check: text clipping, image crops, footer values, colors, numbering.');
      if (options.interactive) {
        const answer = await prompts({
          type: 'confirm',
          name: 'approved',
          message: 'Are all screenshots acceptable?',
          initial: false,
        });
        if (!answer.approved) {
          fail('Screenshot rejection. Review and fix issues, then re-run this stage.');
        }
      }
      markApproved(bookDir, APPROVAL_STATE.SCREENSHOTS_APPROVED);
      break;
    }
    case 'export': {
      console.log(`\n=== Exporting PDF (Gate 9) ===`);
      if (!isApproved(bookDir, APPROVAL_STATE.SCREENSHOTS_APPROVED)) {
        fail('Previous stage (approveScreenshots) not approved. Screenshots must be approved first.');
      }
      try {
        await execa('node', ['engine/tools/export.mjs', `books/${path.basename(bookDir)}/book.html`, `books/${path.basename(bookDir)}/${path.basename(bookDir)}.pdf`], { cwd: PROJECT_ROOT, stdio: 'inherit' });
      } catch (e) {
        if (options.interactive) {
          const recoveryAns = await prompts({
            type: 'select',
            name: 'action',
            message: 'PDF export failed. How to proceed?',
            choices: [
              { title: 'Retry export', value: 'retry' },
              { title: 'Go back to approveScreenshots stage', value: 'back' },
              { title: 'Cancel and preserve progress', value: 'cancel' },
            ],
          });
          if (recoveryAns.action === 'retry') {
            console.log('Re-run export stage to retry.');
            process.exit(1);
          } else if (recoveryAns.action === 'back') {
            console.log('Go back to approveScreenshots stage: re-run with --stage approveScreenshots');
            process.exit(1);
          } else {
            console.log('Cancelled. Progress preserved.');
            process.exit(0);
          }
        } else {
          throw e;
        }
      }
      if (options.interactive) {
        const ans = await prompts({
          type: 'confirm',
          name: 'approved',
          message: 'PDF exported successfully. Mark as complete?',
          initial: true,
        });
        if (!ans.approved) {
          fail('Export rejected.');
        }
      }
      markApproved(bookDir, APPROVAL_STATE.EXPORTED);
      console.log(`\n✅ PDF exported: books/${path.basename(bookDir)}/${path.basename(bookDir)}.pdf`);
      break;
    }
    default:
      console.log(`Unknown stage: ${stage}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`Usage: node engine/tools/ideas-to-book.mjs [options] [idea-file]

Options:
  --list-ideas           List available idea files
  --select               Interactive dropdown to select idea file
  --idea <file>          Use a specific idea file (.json or .md)
  --template <folder>    Template book folder (default: books/STEAM-IE-FOR-HYDROPONICS)
  --slug <name>          Override the book slug (default: from idea file front matter)
  --dry-run              Don't write any files, just preview
  --skip-assets          Skip all asset generation (no photos, no SVG diagrams - placeholders only)
  --generate-assets      Generate photos (SVG diagrams are generated by default)
  --force                Re-approve stages even if already done
  --resume               Continue from last approved stage
  --interactive          Prompt for approval at each gate (default: true)
  --no-interactive       Run non-interactively without CLI prompts
  --approve-stage <name> Mark a stage as approved without prompt
  --stage <name>         Run only specific stage(s):
                         parse, scaffold, inherit, plan, prep, classify, render, diagrams, generate,
                         build, check, screenshot, approveScreenshots, export
  --list-templates       Show available template folders
  --prep-page            Enable LLM-driven content preparation (opt-in)`);
    process.exit(0);
  }

  // List templates first
  if (args.includes('--list-templates')) {
    const templateDirs = fs.readdirSync(path.join(PROJECT_ROOT, 'books'), { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name);
    console.log('\nTemplate folders:');
    templateDirs.forEach((d) => console.log(`  books/${d}`));
    process.exit(0);
  }

  // List ideas
  if (args.includes('--list-ideas')) {
    return listIdeas();
  }

  // Parse CLI flags
  let ideaPath = args.find((a) => a.endsWith('.md') || a.endsWith('.json'));
  let select = args.includes('--select');
  let templateOverride = null;
  let slugOverride = null;
  let prepPage = args.includes('--prep-page');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--idea' && i + 1 < args.length) {
      ideaPath = args[i + 1];
      i++;
    } else if (args[i] === '--select') {
      select = true;
    } else if (args[i] === '--template' && i + 1 < args.length) {
      templateOverride = args[i + 1];
      i++;
    } else if (args[i] === '--slug' && i + 1 < args.length) {
      slugOverride = args[i + 1];
      i++;
    }
  }

  // If --select was used without --idea, prompt for one
  if (!ideaPath && select) {
    ideaPath = await selectIdeaFile();
  }

  // If no idea path found via extension or --idea, search for positional argument
  if (!ideaPath) {
    ideaPath = args.find((a, idx) => {
      if (a.startsWith('-')) return false;
      const prev = args[idx - 1];
      if (prev && ['--idea', '--template', '--slug', '--stage', '--approve-stage'].includes(prev)) return false;
      return true;
    });
  }

  if (!ideaPath) {
    fail('No idea file specified. Use --list-ideas, --select, --idea, or pass an idea file path.');
  }

  const resolvedIdeaPath = path.resolve(PROJECT_ROOT, ideaPath);
  if (!fs.existsSync(ideaPath) && !fs.existsSync(resolvedIdeaPath)) {
    fail(`Idea file or book directory not found: ${ideaPath}`);
  }
  const targetPath = fs.existsSync(ideaPath) ? ideaPath : resolvedIdeaPath;

  // Determine options early to check TTY requirements
  const hasInteractive = args.includes('--interactive');
  const hasNoInteractive = args.includes('--no-interactive');
  const isInteractive = hasInteractive || !hasNoInteractive;

  if (isInteractive && !process.stdin.isTTY) {
    fail('--interactive mode needs a terminal (TTY). Run with --no-interactive in automated environments or pipes.');
  }

  // Parse idea file or load existing book directory manifest
  let manifest;
  let bookDir;
  let slug;

  if (fs.existsSync(targetPath) && fs.statSync(targetPath).isDirectory()) {
    const workManifestPath = path.join(targetPath, '.work', 'idea-manifest.json');
    if (fs.existsSync(workManifestPath)) {
      manifest = JSON.parse(fs.readFileSync(workManifestPath, 'utf8'));
      bookDir = path.resolve(targetPath);
      slug = path.basename(bookDir);
      console.log(`\n=== Loaded manifest for existing book: ${slug} ===`);
    } else {
      fail(`Directory ${targetPath} does not contain .work/idea-manifest.json`);
    }
  } else {
    console.log(`\n=== Parsing: ${path.basename(targetPath)} ===`);
    if (targetPath.endsWith('.json')) {
      manifest = loadJsonManifest(targetPath);
      console.log('Loaded JSON manifest directly (skipping markdown parser)');
    } else {
      manifest = parseIdeaFile(targetPath);
    }
    slug = slugOverride || manifest.slug || deriveSlugFromTitle(manifest.title);
    bookDir = path.join(PROJECT_ROOT, 'books', slug);
  }

  // Determine template path
  let templatePath = path.join(PROJECT_ROOT, templateOverride || DEFAULT_TEMPLATE);

  // Determine options
  const options = {
    dryRun: args.includes('--dry-run'),
    generateAssets: args.includes('--generate-assets'),
    skipAssets: args.includes('--skip-assets'),
    force: args.includes('--force'),
    resume: args.includes('--resume'),
    interactive: !args.includes('--no-interactive'), // default true
    approveStage: null,
    templatePath,
    prepPage,
  };

  // Parse --approve-stage value
  const approveStageIdx = args.indexOf('--approve-stage');
  if (approveStageIdx !== -1 && approveStageIdx + 1 < args.length) {
    options.approveStage = args[approveStageIdx + 1];
  }

  // Parse --stage value(s)
  const stageIdx = args.indexOf('--stage');
  let stageOrder;
  if (stageIdx !== -1) {
    stageOrder = args.slice(stageIdx + 1).filter(a => !a.startsWith('--'));
    // Expand 'assets' alias to 'classify' and 'generate'
    stageOrder = stageOrder.flatMap(stage => stage === 'assets' ? ['classify', 'generate'] : stage);
    // Remove duplicates while preserving order
    stageOrder = stageOrder.filter((stage, index) => stageOrder.indexOf(stage) === index);
  } else if (options.resume) {
    // Resume from first unapproved stage
    const nextStage = firstUnapprovedStage(bookDir);
    const allStages = STAGES.filter(s => s !== 'list');
    const startIdx = nextStage ? allStages.indexOf(nextStage) : allStages.length;
    stageOrder = allStages.slice(startIdx);
    console.log(`\nResuming from stage: ${stageOrder[0] || 'complete'}`);
  } else {
    stageOrder = STAGES.filter((s) => s !== 'list');
  }

  // Check for existing book
  if (fs.existsSync(bookDir)) {
    if (options.force || options.resume) {
      // With --force without --stage, delete and start fresh; otherwise continue/re-run stage
      if (options.force && !options.resume && stageIdx === -1) {
        fs.rmSync(bookDir, { recursive: true, force: true });
        console.log(`\nBook folder exists. Deleted for fresh start (--force).`);
      } else {
        console.log(`\nBook folder exists. Processing stage(s): ${stageOrder.join(', ')}`);
      }
    } else if (options.noInteractive || !options.interactive) {
      fail(`Book folder exists: ${bookDir}. Use --force to overwrite or --resume to continue.`);
    } else {
      console.log(`\nBook folder already exists: ${bookDir}`);
      const state = loadApprovalState(bookDir);
      console.log(`Approved stages: ${Object.entries(state.stages).filter(([, v]) => v).map(([k]) => k).join(', ') || 'none'}`);

      const answer = await prompts({
        type: 'select',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { title: 'Resume from last approved stage', value: 'resume' },
          { title: 'Start fresh (re-run all stages)', value: 'fresh' },
          { title: 'Cancel', value: 'cancel' },
        ],
      });

      if (answer.action === 'cancel') {
        console.log('Cancelled.');
        // Ask whether to preserve progress or do rollback
        const rbAnswer = await prompts({
          type: 'select',
          name: 'action',
          message: 'Do you want to preserve your progress or do a rollback?',
          choices: [
            { title: 'Preserve all progress so far', value: 'preserve' },
            { title: 'Rollback and list created files', value: 'rollback' },
          ],
        });
        if (rbAnswer.action === 'rollback') {
          await rollback(bookDir);
        } else {
          console.log('Progress preserved. Use --resume to continue later.');
        }
        process.exit(0);
      }
      if (answer.action === 'fresh') {
        fs.rmSync(bookDir, { recursive: true, force: true });
        console.log('Deleted existing book folder.');
      }
    }
  }

  // Handle --approve-stage before running stages
  if (options.approveStage) {
    markApproved(bookDir, options.approveStage);
    console.log(`Manually approved stage: ${options.approveStage}`);
  }

  // Run the workflow
  let currentManifest = manifest;
  for (const stage of stageOrder) {
    if (stage) {
      await handleStage(stage, args, { ...currentManifest, slug }, bookDir, options);
      // Reload manifest after prep stage since it updates the file
      if (stage === 'prep') {
        const manifestPath = path.join(bookDir, '.work', 'idea-manifest.json');
        if (fs.existsSync(manifestPath)) {
          currentManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          console.log('Reloaded manifest with preparedContent');
        }
      }
    }
  }

  console.log('\n=== Automation complete ===');
}

// Auto-start if run as main
const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(error.message || String(error));
    process.exit(1);
  });
}