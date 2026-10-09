#!/usr/bin/env node
// list-books.mjs — Scan books/ folder and generate books-index.json for webui
// Usage: node engine/tools/list-books.mjs

import fs from 'fs';
import path from 'path';

const BOOKS_DIR = path.resolve('books');
const OUTPUT_FILE = path.resolve('webui/data/books-index.json');

function countBlocksFromMd(blocksMdPath) {
  if (!fs.existsSync(blocksMdPath)) return 0;
  const content = fs.readFileSync(blocksMdPath, 'utf-8');
  // Count lines starting with "#### " (each block header)
  return content.split('\n').filter(line => line.startsWith('#### ')).length;
}

function countBlocksFromJson(bookJson) {
  if (!bookJson.parts || !Array.isArray(bookJson.parts)) return 0;
  return bookJson.parts.reduce((sum, part) => {
    if (Array.isArray(part.blocks)) return sum + part.blocks.length;
    return sum;
  }, 0);
}

function getBookStatus(bookJson, blocksMdPath) {
  // Could run check.mjs here, but for now use a simple heuristic
  // If the book has blocks.md and interior file, assume "ready"
  if (fs.existsSync(blocksMdPath)) return 'ready';
  return 'incomplete';
}

function scanBooks() {
  if (!fs.existsSync(BOOKS_DIR)) {
    console.error(`Books directory not found: ${BOOKS_DIR}`);
    process.exit(1);
  }

  const entries = fs.readdirSync(BOOKS_DIR, { withFileTypes: true });
  const books = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const slug = entry.name;
    const bookDir = path.join(BOOKS_DIR, slug);
    const bookJsonPath = path.join(bookDir, 'book.json');
    const interiorPath = path.join(bookDir, `${slug}.html`);
    const blocksMdPath = path.join(bookDir, 'blocks.md');

    // Validate required files
    if (!fs.existsSync(bookJsonPath)) {
      console.warn(`Skipping ${slug}: no book.json`);
      continue;
    }
    if (!fs.existsSync(interiorPath)) {
      console.warn(`Skipping ${slug}: no ${slug}.html (interior file)`);
      continue;
    }

    let bookJson;
    try {
      bookJson = JSON.parse(fs.readFileSync(bookJsonPath, 'utf-8'));
    } catch (e) {
      console.warn(`Skipping ${slug}: invalid book.json`);
      continue;
    }

    // Validate required fields
    if (!bookJson.title || !bookJson.series) {
      console.warn(`Skipping ${slug}: missing title or series in book.json`);
      continue;
    }

    const pageCount = countBlocksFromMd(blocksMdPath) || countBlocksFromJson(bookJson);
    const status = getBookStatus(bookJson, blocksMdPath);

    // Get last modified time from interior file
    const stat = fs.statSync(interiorPath);

    books.push({
      slug,
      title: bookJson.title,
      subtitle: bookJson.subtitle || '',
      series: bookJson.series,
      brand: bookJson.brand || '',
      status,
      pageCount,
      lastModified: stat.mtime.toISOString(),
      // Optional: include parts for future use
      parts: bookJson.parts || [],
      editionLabel: bookJson.editionLabel || 'Edition 1.0',
    });
  }

  // Sort: ready first, then by title
  books.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'ready' ? -1 : 1;
    return a.title.localeCompare(b.title);
  });

  const output = {
    generatedAt: new Date().toISOString(),
    books,
  };

  // Ensure output directory exists
  const outDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
  console.log(`Generated ${OUTPUT_FILE} with ${books.length} books:`);
  books.forEach(b => console.log(`  - ${b.slug}: ${b.title} (${b.pageCount} pages, ${b.status})`));
}

scanBooks();