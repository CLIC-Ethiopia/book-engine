#!/usr/bin/env node
// new-idea-save.mjs — Save utility for new-idea skill
// Writes final validated JSON to ideas/<slug>.json

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const SCHEMAS_DIR = path.join(PROJECT_ROOT, '.claude', 'skills', 'new-idea', 'schemas');
const IDEAS_DIR = path.join(PROJECT_ROOT, 'ideas');

function loadSchema() {
  const schemaFile = path.join(SCHEMAS_DIR, 'idea-file-format.json');
  if (!fs.existsSync(schemaFile)) {
    throw new Error(`Schema file not found: ${schemaFile}`);
  }
  return JSON.parse(fs.readFileSync(schemaFile, 'utf-8'));
}

function generateSlug(title) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function validateBookJson(bookJson) {
  const schema = loadSchema();

  // Required fields
  const required = ['title', 'slug', 'author', 'series', 'pages'];
  for (const field of required) {
    if (!bookJson[field]) {
      throw new Error(`Missing required field: ${field}`);
    }
  }

  // Slug format
  if (!/^[a-z0-9-]+$/.test(bookJson.slug)) {
    throw new Error('slug must be lowercase, hyphenated, no special chars');
  }

  // Pages array
  if (!Array.isArray(bookJson.pages) || bookJson.pages.length === 0) {
    throw new Error('pages must be non-empty array');
  }

  // Validate each page
  const validSections = ['Science', 'Technology', 'Engineering', 'Arts', 'Mathematics', 'Innovation', 'Entrepreneurship'];
  let pageNum = 1;

  for (const page of bookJson.pages) {
    if (page.no !== pageNum) {
      throw new Error(`Page numbers must be sequential: expected ${pageNum}, got ${page.no}`);
    }
    pageNum++;

    const pageRequired = ['no', 'section', 'title', 'subtitle', 'content', 'imagePrompt', 'imageType', 'actionCallout', 'citations'];
    for (const field of pageRequired) {
      if (page[field] === undefined || page[field] === null || page[field] === '') {
        throw new Error(`Page ${page.no} missing required field: ${field}`);
      }
    }

    if (!validSections.includes(page.section)) {
      throw new Error(`Page ${page.no}: invalid section "${page.section}"`);
    }

    if (!['diagram', 'photo'].includes(page.imageType)) {
      throw new Error(`Page ${page.no}: imageType must be "diagram" or "photo"`);
    }

    if (!page.actionCallout.label || !page.actionCallout.content) {
      throw new Error(`Page ${page.no}: actionCallout must have label and content`);
    }

    if (!Array.isArray(page.citations)) {
      throw new Error(`Page ${page.no}: citations must be array`);
    }
  }

  return true;
}

function writeIdeaFile(slug, bookJson) {
  if (!fs.existsSync(IDEAS_DIR)) {
    fs.mkdirSync(IDEAS_DIR, { recursive: true });
  }

  const outputPath = path.join(IDEAS_DIR, `${slug}.json`);

  // Atomic write: write to temp, then rename
  const tempPath = outputPath + '.tmp';
  fs.writeFileSync(tempPath, JSON.stringify(bookJson, null, 2));
  fs.renameSync(tempPath, outputPath);

  return outputPath;
}

async function validateAndSave(bookJson) {
  // Generate slug if not provided
  if (!bookJson.slug && bookJson.title) {
    bookJson.slug = generateSlug(bookJson.title);
  }

  // Validate
  validateBookJson(bookJson);

  // Write
  const outputPath = writeIdeaFile(bookJson.slug, bookJson);

  console.log(`Saved idea file: ${outputPath}`);
  console.log(`Title: ${bookJson.title}`);
  console.log(`Slug: ${bookJson.slug}`);
  console.log(`Pages: ${bookJson.pages.length}`);

  return outputPath;
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node new-idea-save.mjs <input.json> [--slug <slug>]

Validates and saves a book idea JSON to ideas/<slug>.json

Options:
  --slug <slug>    Override slug (default: generated from title)
  --help           Show this help

Example:
  node new-idea-save.mjs book-idea.json
  node new-idea-save.mjs book-idea.json --slug my-custom-slug
`);
    process.exit(0);
  }

  let inputFile = args[0];
  let overrideSlug = null;

  const slugArg = args.find(a => a === '--slug');
  if (slugArg) {
    const idx = args.indexOf('--slug');
    if (idx + 1 < args.length) {
      overrideSlug = args[idx + 1];
    }
  }

  if (!inputFile || inputFile.startsWith('--')) {
    console.error('Error: input.json required');
    process.exit(1);
  }

  try {
    let bookJson;
    if (inputFile === '-') {
      // Read from stdin
      const stdin = await new Promise(resolve => {
        let data = '';
        process.stdin.on('data', chunk => data += chunk);
        process.stdin.on('end', () => resolve(data));
      });
      bookJson = JSON.parse(stdin);
    } else {
      bookJson = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
    }

    if (overrideSlug) {
      bookJson.slug = overrideSlug;
    }

    await validateAndSave(bookJson);
    console.log('Save successful!');
  } catch (e) {
    console.error(`Save failed: ${e.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { validateAndSave, writeIdeaFile, generateSlug, validateBookJson };