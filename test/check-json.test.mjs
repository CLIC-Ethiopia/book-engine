import { describe, it } from 'node:test';
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPageOverflows } from '../engine/tools/overflow-analyzer.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SLUG = 'interlocking-compressed-stabilized-earth-blocks-icseb';
const BOOK = path.join(ROOT, 'books', SLUG, 'book.html');

describe('check.mjs --json', () => {
  it('emits a single parseable JSON object', () => {
    const r = spawnSync('node', ['engine/tools/check.mjs', `books/${SLUG}/book.html`, '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1 << 26,
    });
    const start = r.stdout.indexOf('{');
    assert.notStrictEqual(start, -1, 'no JSON found on stdout');
    const report = JSON.parse(r.stdout.slice(start));
    assert.strictEqual(typeof report.pageCount, 'number');
    assert.ok(Array.isArray(report.pages));
    assert.ok(Array.isArray(report.overflowing));
    assert.ok(Array.isArray(report.brokenImages));
    assert.strictEqual(typeof report.unstyled, 'boolean');
    assert.strictEqual(typeof report.ok, 'boolean');
  });

  it('agrees with itself on the overflow count', () => {
    const r = spawnSync('node', ['engine/tools/check.mjs', `books/${SLUG}/book.html`, '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1 << 26,
    });
    const report = JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
    assert.strictEqual(report.overflowing.length, report.pages.filter((p) => p.overMm > 0).length);
    assert.strictEqual(report.ok, report.overflowing.length === 0 && report.brokenImages.length === 0 && !report.unstyled);
  });

  it('reports untruncated titles', () => {
    // A regression guard: the table truncates at 34 chars, so callers that
    // parsed it could never match a long manifest title.
    const r = spawnSync('node', ['engine/tools/check.mjs', 'books/solar-dryer-fruit-processing/book.html', '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1 << 26,
    });
    const report = JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
    const long = report.pages.filter((p) => p.title.length > 34);
    assert.ok(long.length > 0, 'expected at least one title longer than 34 chars');
    assert.ok(long.every((p) => !p.title.endsWith('…')));
  });

  it('handles a title containing an apostrophe', () => {
    // The old regex used '([^']+)' and would mis-split these.
    const r = spawnSync('node', ['engine/tools/check.mjs', `books/${SLUG}/book.html`, '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1 << 26,
    });
    const report = JSON.parse(r.stdout.slice(r.stdout.indexOf('{')));
    const dirty = report.pages.filter((p) => p.title.includes("'"));
    for (const p of dirty) {
      assert.ok(p.title.length > 0);
      assert.ok(Number.isFinite(p.overMm));
    }
  });

  it('exits 1 when the book is not ready, 0 when it is', () => {
    const bad = spawnSync('node', ['engine/tools/check.mjs', `books/${SLUG}/book.html`, '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 1 << 26,
    });
    assert.strictEqual(bad.status, 1, 'this book has a broken image, so exit must be 1');

    const missing = spawnSync('node', ['engine/tools/check.mjs', 'books/does-not-exist/book.html', '--json'], {
      cwd: ROOT,
      encoding: 'utf8',
    });
    assert.notStrictEqual(missing.status, 0);
  });
});

describe('checkPageOverflows (JSON-backed)', () => {
  it('returns the documented map shape', async () => {
    const map = await checkPageOverflows(BOOK);
    assert.ok(Object.keys(map).length > 0);
    for (const [title, entry] of Object.entries(map)) {
      assert.strictEqual(typeof title, 'string');
      assert.strictEqual(typeof entry.overflow, 'number');
      assert.strictEqual(typeof entry.pageIndex, 'number');
      assert.strictEqual(typeof entry.pageNumber, 'number');
      assert.strictEqual(entry.pageIndex, entry.pageNumber - 1);
    }
  });

  it('keys pages by their full title so manifest lookups hit', async () => {
    const map = await checkPageOverflows(path.join(ROOT, 'books', 'solar-dryer-fruit-processing', 'book.html'));
    const long = Object.keys(map).filter((k) => k.length > 34);
    assert.ok(long.length > 0, 'long titles must survive as keys');
  });

  it('returns an empty map for a missing book instead of throwing', async () => {
    const map = await checkPageOverflows(path.join(ROOT, 'books', 'nope', 'book.html'));
    assert.deepStrictEqual(map, {});
  });
});