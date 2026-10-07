/*
  idea-parser.mjs  -  parse idea markdown files into structured manifests
  --------------------------------------------------------------------------
  CLI:
    node engine/tools/idea-parser.mjs ideas/example.md
    node engine/tools/idea-parser.mjs example.md
    node engine/tools/idea-parser.mjs

  The file is also importable by the other automation scripts.
*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'js-yaml';
import prompts from 'prompts';
import { fail, pad2, normalizeSlug, deriveSlugFromTitle } from './shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const IDEAS_ROOT = path.join(PROJECT_ROOT, 'ideas');
const PAGE_MARKER = /^(#+)\s+STEAM-IE\s+·\s+No\.\s+(\d+)\s+(.+)$/gm;
const SECTION_EYEBROWS = {
  Science: 'S',
  Technology: 'T',
  Engineering: 'E',
  Arts: 'A',
  Mathematics: 'M',
  Innovation: 'I',
  Entrepreneurship: 'IE',
};

function parseFrontMatter(raw) {
  if (!raw.startsWith('---')) {
    fail('Idea file must start with YAML front matter (---).');
  }

  const lines = raw.split(/\r?\n/);
  const closing = lines.findIndex((line, index) => index > 0 && line.trim() === '---');
  if (closing === -1) {
    fail('Malformed front matter: missing closing ---.');
  }

  const text = lines.slice(1, closing).join('\n');
  const parsed = yaml.load(text) || {};
  if (typeof parsed !== 'object' || Array.isArray(parsed)) {
    fail('Front matter must be a YAML object.');
  }
  return parsed;
}

function extractPageBody(raw, markerIndex, markerLength, nextMarkerIndex) {
  const start = markerIndex + markerLength;
  const end = nextMarkerIndex === -1 ? raw.length : nextMarkerIndex;
  return raw.slice(start, end).trim();
}

function extractPageDetails(body) {
  const titleMatch = body.match(/^##\s+(.+)$/m);
  const subtitleMatch = body.match(/^####\s+(.+)$/m);
  const imagePromptMatch = body.match(/!\[AI Image Prompt:\s*([\s\S]*?)\]/);
  const actionMatch = body.match(/\[ACTION CALLOUT:\s*([^\]]+)\]\s*([\s\S]*)$/);
  const citationMatches = [...body.matchAll(/\[cite:\s*(\d+)\]/g)];

  const citations = citationMatches.map((match) => ({
    marker: `[cite: ${match[1]}]`,
    number: Number(match[1]),
  }));

  let content = body;
  if (imagePromptMatch) content = content.replace(imagePromptMatch[0], '');
  if (actionMatch) content = content.replace(actionMatch[0], '');
  
  // Remove ## Title and #### Subtitle lines from content
  content = content
    .replace(/^##\s+.+$/m, '')
    .replace(/^####\s+.+$/m, '')
    .replace(/\n\s*---\s*\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    title: titleMatch ? titleMatch[1].trim() : '',
    subtitle: subtitleMatch ? subtitleMatch[1].trim() : '',
    imagePrompt: imagePromptMatch ? imagePromptMatch[1].trim() : '',
    actionCallout: actionMatch ? {
      label: actionMatch[1].trim(),
      content: actionMatch[2].trim(),
    } : null,
    citations,
    content,
  };
}

function validateManifest(manifest) {
  const errors = [];
  const seen = new Set();

  if (!manifest.title) errors.push('front matter is missing "title".');
  if (!manifest.author) errors.push('front matter is missing "author".');
  if (!manifest.series) errors.push('front matter is missing "series".');
  if (!manifest.slug) errors.push('could not derive a valid slug.');
  if (!manifest.pages.length) errors.push('no STEAM-IE pages were found.');

  manifest.pages.forEach((page) => {
    if (!page.title) errors.push(`page ${pad2(page.no)} has no ## title.`);
    if (!page.imagePrompt) errors.push(`page ${pad2(page.no)} has no AI Image Prompt.`);
    if (!page.actionCallout) errors.push(`page ${pad2(page.no)} has no ACTION CALLOUT.`);
    if (seen.has(page.no)) errors.push(`duplicate page number ${pad2(page.no)}.`);
    seen.add(page.no);
  });

  const numbers = manifest.pages.map((page) => page.no).sort((a, b) => a - b);
  numbers.forEach((number, index) => {
    if (number !== index + 1) {
      errors.push('page numbers must be sequential starting at 1.');
    }
  });

  if (errors.length) {
    fail(`Idea validation failed:\n  - ${errors.join('\n  - ')}`);
  }
}

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

export function parseIdeaFile(inputPath) {
  const filePath = path.resolve(inputPath);
  if (!fs.existsSync(filePath)) {
    fail(`Idea file not found: ${inputPath}`);
  }

  // Handle JSON files directly
  if (inputPath.endsWith('.json')) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(raw);
    
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
      sourceFile: path.relative(PROJECT_ROOT, filePath).split(path.sep).join('/'),
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

  const raw = fs.readFileSync(filePath, 'utf8');
  const frontMatter = parseFrontMatter(raw);
  const markers = [...raw.matchAll(PAGE_MARKER)];
  const pages = [];

  markers.forEach((marker, index) => {
    const next = markers[index + 1];
    const body = extractPageBody(raw, marker.index, marker[0].length, next ? next.index : -1);
    const details = extractPageDetails(body);
    pages.push({
      no: Number(marker[2]),
      section: marker[3].trim(),
      ...details,
    });
  });

  pages.sort((a, b) => a.no - b.no);

  const slug = normalizeSlug(frontMatter.slug) || deriveSlugFromTitle(frontMatter.title);
  const manifest = {
    sourceFile: path.relative(PROJECT_ROOT, filePath).split(path.sep).join('/'),
    slug,
    title: frontMatter.title || '',
    subtitle: frontMatter.subtitle || '',
    author: frontMatter.author || '',
    series: frontMatter.series || '',
    editionLabel: frontMatter.editionLabel || 'Edition 1.0',
    audience: frontMatter.audience || '',
    primaryLocation: frontMatter.primaryLocation || '',
    coverImage: frontMatter.coverImage || 'images/cover.png',
    pages,
    parts: buildParts(pages),
    totalPages: pages.length,
    totalCitations: pages.reduce((total, page) => total + page.citations.length, 0),
  };

  validateManifest(manifest);
  return manifest;
}

export function writeManifest(manifest, bookDir) {
  const workDir = path.join(bookDir, '.work');
  fs.mkdirSync(workDir, { recursive: true });
  const manifestPath = path.join(workDir, 'idea-manifest.json');
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifestPath;
}

export async function selectIdeaFile() {
  if (!fs.existsSync(IDEAS_ROOT)) {
    fail(`Ideas folder not found: ${IDEAS_ROOT}`);
  }
  const mdFiles = fs.readdirSync(IDEAS_ROOT)
    .filter((file) => file.endsWith('.md'))
    .sort((a, b) => a.localeCompare(b));
  const jsonFiles = fs.readdirSync(IDEAS_ROOT)
    .filter((file) => file.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));
  
  const allFiles = [...jsonFiles, ...mdFiles];
  if (!allFiles.length) {
    fail(`No .json or .md files found in ${IDEAS_ROOT}`);
  }

  const answer = await prompts({
    type: 'select',
    name: 'ideaFile',
    message: 'Select an idea file',
    choices: allFiles.map((file) => ({
      title: `${file} ${file.endsWith('.json') ? '[JSON]' : '[MD]'}`,
      value: path.join(IDEAS_ROOT, file),
    })),
  });
  return answer.ideaFile;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node engine/tools/idea-parser.mjs [ideas/example.md] [--out books/example/.work]');
    process.exit(0);
  }

  const inputPath = args[0] || await selectIdeaFile();
  const outFlag = args.indexOf('--out');
  const outValue = outFlag !== -1 ? args[outFlag + 1] : null;
  const manifest = parseIdeaFile(inputPath);

  const bookDir = outValue
    ? path.resolve(outValue, '..')
    : path.join(PROJECT_ROOT, 'books', manifest.slug);
  const manifestPath = writeManifest(manifest, bookDir);

  console.log(`Parsed ${manifest.totalPages} pages from ${manifest.sourceFile}`);
  console.log(`Parts: ${manifest.parts.map((part) => `${part.name} (${part.blocks.length})`).join(', ')}`);
  console.log(`Citations: ${manifest.totalCitations}`);
  console.log(`Manifest: ${manifestPath.split(path.sep).join('/')}`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => fail(error.message || String(error)));
}
