/*
  book-scaffold.mjs  -  scaffold a new book folder from a template using an idea manifest
  --------------------------------------------------------------------------
  CLI:
    node engine/tools/book-scaffold.mjs ideas/example.md
    node engine/tools/book-scaffold.mjs books/example.md --template books/starter
    node engine/tools/book-scaffold.mjs --list-templates
  Steps:
    1. Parse idea file → manifest.
    2. Determine target book folder: books/<slug>/
    3. If exists, prompt for action (update/reuse/select another).
    4. Copy template (excluding generated artifacts) to book folder.
    5. Rename interior file to slug.html.
    6. Update book.json with manifest metadata.
    7. Write manifest to book folder's .work/idea-manifest.json.
    8. Optionally run in dry‑run mode.
*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import prompts from 'prompts';
import { parseIdeaFile, writeManifest, selectIdeaFile } from './idea-parser.mjs';
import { fail, normalizeSlug, deriveSlugFromTitle } from './shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const TEMPLATES_ROOT = path.join(PROJECT_ROOT, 'books');
const DEFAULT_TEMPLATE = path.join(TEMPLATES_ROOT, 'STEAM-IE-FOR-HYDROPONICS');
const GENERATED_EXCLUDES = [
  'book.html',
  'book-*.html',
  'page*.png',
  '*.pdf',
  '.git',
  '.gitignore',
];

function listTemplates() {
  const dirs = fs.readdirSync(TEMPLATES_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  if (!dirs.length) {
    console.log('No template folders found in books/.');
    return;
  }
  console.log('Available template folders:');
  dirs.forEach((dir) => console.log(`  ${dir}`));
}

function validateTemplate(templatePath) {
  const requiredFiles = ['book.json', 'blocks.md', 'VOICE.md'];
  const missing = [];
  
  // Check for interior HTML file (any .html except book.html and book-*.html)
  const entries = fs.readdirSync(templatePath, { withFileTypes: true });
  const hasInteriorHtml = entries.some(e => e.isFile() && e.name.endsWith('.html') && 
    e.name !== 'book.html' && !e.name.startsWith('book-'));
  
  if (!hasInteriorHtml) {
    missing.push('interior HTML file (e.g., STEAM-IE-FOR-HYDROPONICS.html)');
  }
  
  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(templatePath, file))) {
      missing.push(file);
    }
  }
  
  if (missing.length > 0) {
    fail(`Template validation failed. Missing required files: ${missing.join(', ')}`);
  }
  
  return true;
}

async function promptAction(existingPath) {
  const answer = await prompts({
    type: 'select',
    name: 'action',
    message: `Book folder already exists:\n${existingPath}\nWhat would you like to do?`,
    choices: [
      { title: 'Update existing book (overwrite non‑generated files)', value: 'update' },
      { title: 'Re‑select a different idea file', value: 'reselect' },
      { title: 'Cancel and keep existing book', value: 'cancel' },
    ],
  });
  return answer.action;
}

function shouldExclude(filePath) {
  const name = path.basename(filePath);
  return GENERATED_EXCLUDES.some((pattern) => {
    if (pattern.includes('*')) {
      const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
      return regex.test(name);
    }
    return pattern === name;
  });
}

function copyDirectoryRecursive(src, dest, options = {}) {
  const { filter = () => true, dryRun = false } = options;
  if (!fs.existsSync(src)) {
    fail(`Source directory does not exist: ${src}`);
  }
  if (!dryRun) {
    fs.mkdirSync(dest, { recursive: true });
  } else {
    console.log(`[Dry run] MKDIR ${dest}`);
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (shouldExclude(srcPath) || !filter(srcPath, entry)) {
      continue;
    }
    if (entry.isDirectory()) {
      copyDirectoryRecursive(srcPath, destPath, options);
    } else {
      if (!dryRun) {
        fs.copyFileSync(srcPath, destPath);
      } else {
        console.log(`[Dry run] COPY ${srcPath} -> ${destPath}`);
      }
    }
  }
}

function renderBookJson(templateJson, manifest) {
  // Deep copy template to avoid mutation
  const result = JSON.parse(JSON.stringify(templateJson));
  // Update core metadata
  result.title = manifest.title || result.title;
  result.subtitle = manifest.subtitle || result.subtitle;
  result.author = manifest.author || result.author;
  result.series = manifest.series || result.series;
  result.editionLabel = manifest.editionLabel || result.editionLabel;
  // Update cover image if provided in manifest
  if (manifest.coverImage) {
    if (!result.cover) result.cover = {};
    result.cover.image = manifest.coverImage;
  }
  // Replace parts array with manifest-derived parts
  result.parts = manifest.parts.map((part) => ({
    name: part.name,
    eyebrow: part.eyebrow,
    blocks: part.blocks,
    why: '', // could be derived from idea file but not required for build
    listLabel: '',
  }));
  // Preserve template's footer configuration (brand/right) and generated‑page flags
  // Do not overwrite footer.brand/footer.right – they come from template.
  // Preserve contents, index, insideCover, howToRead, backCover flags.
  // If manifest specifies audience/primaryLocation, we could store them elsewhere,
  // but book.json doesn't have those fields; they can live in idea manifest.
  return result;
}

async function main(passedArgs) {
  const args = passedArgs || process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node engine/tools/book-scaffold.mjs [idea-file.md] [--template <folder>] [--slug <name>] [--dry-run] [--force] [--no-interactive] [--list-templates]');
    process.exit(0);
  }

  if (args.includes('--list-templates')) {
    return listTemplates();
  }

  let ideaPath = args[0];
  let templatePath = DEFAULT_TEMPLATE;
  let dryRun = false;
  let slugOverride = null;
  const force = args.includes('--force');
  const noInteractive = args.includes('--no-interactive');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--template') {
      templatePath = path.resolve(args[i + 1]);
      i++;
    } else if (args[i] === '--slug' && i + 1 < args.length) {
      slugOverride = args[i + 1];
      i++;
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    } else if (!args[i].startsWith('-') && !ideaPath) {
      ideaPath = args[i];
    }
  }

  if (!ideaPath) {
    ideaPath = await selectIdeaFile();
  }

  const manifest = parseIdeaFile(ideaPath);
  const slug = slugOverride || manifest.slug;
  const bookDir = path.join(TEMPLATES_ROOT, slug);

  // Determine if we need to act on an existing book
  const exists = fs.existsSync(bookDir);
  if (exists && !force) {
    if (noInteractive) {
      fail(`Book folder exists: ${bookDir}. Use --force to overwrite.`);
    }
    const action = await promptAction(bookDir);
    if (action === 'reselect') {
      // Recurse with a new idea selection
      ideaPath = await selectIdeaFile();
      return main(); // tail‑call equivalent
    } else if (action === 'cancel') {
      console.log('Operation cancelled. Existing book unchanged.');
      process.exit(0);
    }
    // 'update' proceeds; we will overwrite non‑generated files.
  } else if (exists && force) {
    console.log(`Book folder exists: ${bookDir}. Overwriting non-generated files (--force).`);
  }

  if (!fs.existsSync(templatePath)) {
    fail(`Template folder not found: ${templatePath}`);
  }

  // Validate template has required files
  validateTemplate(templatePath);

  console.log(`Template: ${path.relative(PROJECT_ROOT, templatePath)}`);
  console.log(`Target book: ${path.relative(PROJECT_ROOT, bookDir)}`);
  console.log(`Slug: ${slug}`);
  console.log(`Pages: ${manifest.totalPages}`);
  console.log(`Parts: ${manifest.parts.map((p) => `${p.name} (${p.blocks.length})`).join(', ')}`);

  if (dryRun) {
    console.log('\n[Dry run] Starting scaffold simulation...');
  }

  // 1. Ensure target directory is ready
  if (!exists && !dryRun) {
    fs.mkdirSync(bookDir, { recursive: true });
  } else if (!exists && dryRun) {
    console.log(`[Dry run] MKDIR ${bookDir}`);
  }

  // 2. Copy template (excluding generated artifacts)
  copyDirectoryRecursive(templatePath, bookDir, {
    filter: (srcPath) => !shouldExclude(srcPath),
    dryRun
  });

  // 3. Rename interior file in the NEW book folder (not template)
  const copiedInterior = path.join(bookDir, 'STEAM-IE-FOR-HYDROPONICS.html');
  const targetInterior = path.join(bookDir, `${slug}.html`);
  
  // Just simulate rename in dryRun
  if (dryRun) {
     console.log(`[Dry run] RENAME ${copiedInterior} -> ${targetInterior}`);
  } else {
    if (fs.existsSync(copiedInterior)) {
      if (fs.existsSync(targetInterior)) {
        fs.unlinkSync(targetInterior);
      }
      fs.renameSync(copiedInterior, targetInterior);
    } else {
      const htmlCandidates = fs.readdirSync(bookDir)
        .filter((f) => f.endsWith('.html') && f !== 'book.html' && !f.startsWith('book-'));
      if (htmlCandidates.length) {
        const old = path.join(bookDir, htmlCandidates[0]);
        fs.renameSync(old, targetInterior);
      } else {
        fail('Could not locate interior HTML file in new book folder to rename.');
      }
    }
  }

  // 4. Update book.json
  const templateJsonPath = path.join(templatePath, 'book.json');
  if (!fs.existsSync(templateJsonPath)) {
    fail('template book.json not found');
  }
  const templateJson = JSON.parse(fs.readFileSync(templateJsonPath, 'utf8'));
  const updatedJson = renderBookJson(templateJson, manifest);
  const bookJsonPath = path.join(bookDir, 'book.json');
  
  if (dryRun) {
     console.log(`[Dry run] WRITE ${bookJsonPath}`);
  } else {
     fs.writeFileSync(bookJsonPath, `${JSON.stringify(updatedJson, null, 2)}\n`);
  }

  // 5. Write manifest to book's .work folder
  manifest.template = path.relative(PROJECT_ROOT, templatePath).split(path.sep).join('/');
  if (dryRun) {
     console.log(`[Dry run] WRITE manifest to ${path.join(bookDir, '.work', 'idea-manifest.json')}`);
  } else {
     writeManifest(manifest, bookDir);
  }

  // 6. Ensure images folder exists
  const imagesDir = path.join(bookDir, 'images');
  if (dryRun) {
     console.log(`[Dry run] MKDIR ${imagesDir}`);
     console.log('\n✅ Dry run completed.');
     process.exit(0);
  } else {
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
  }

  console.log('\n✅ Book scaffolded successfully.');
  console.log(`   Next steps:`);
  console.log(`   1. Review and classify images (photo vs diagram) → run book-assets.mjs`);
  console.log(`   2. Render pages:      node engine/tools/book-render.mjs books/${slug}`);
  console.log(`   3. Build & check:     node engine/tools/build-book.mjs books/${slug}`);
  console.log(`   4. Screenshot:        node engine/tools/shot.mjs books/${slug}/book.html`);
  console.log(`   5. Export PDF:        node engine/tools/export.mjs books/${slug}/book.html`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => fail(error.message || String(error)));
}

export default main;