import { describe, it, before } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { parseIdeaFile, writeManifest } from '../engine/tools/idea-parser.mjs';
import { normalizeSlug, deriveSlugFromTitle, pad2 } from '../engine/tools/shared.mjs';

describe('idea-parser.mjs', () => {
  const TEST_IDEA_PATH = path.join(process.cwd(), 'ideas', 'interlocking-compressed-stabilized-earth-blocks-icseb.json');
  
  let manifest;

  before(() => {
    manifest = parseIdeaFile(TEST_IDEA_PATH);
  });

  describe('parseIdeaFile (JSON)', () => {
    it('parses title', () => {
      assert.strictEqual(manifest.title, 'Interlocking Compressed Stabilized Earth Blocks (ICSEB)');
    });
    it('parses slug', () => {
      assert.strictEqual(manifest.slug, 'interlocking-compressed-stabilized-earth-blocks-icseb');
    });
    it('parses subtitle', () => {
      assert.ok(manifest.subtitle.length > 0);
    });
    it('parses author', () => {
      assert.ok(manifest.author.length > 0);
    });
    it('parses series', () => {
      assert.ok(manifest.series.length > 0);
    });
    it('parses pages array', () => {
      assert.ok(Array.isArray(manifest.pages));
      assert.strictEqual(manifest.pages.length, 48);
    });
    it('parses page fields correctly', () => {
      const page = manifest.pages[0];
      assert.strictEqual(page.no, 1);
      assert.strictEqual(page.section, 'Science');
      assert.strictEqual(page.title, 'Soil Composition Basics');
      assert.ok(page.subtitle.length > 0);
      assert.ok(page.content.length > 0);
      assert.ok(page.imagePrompt.length > 0);
      assert.strictEqual(page.imageType, 'diagram');
      assert.ok(page.actionCallout.label);
      assert.ok(page.actionCallout.content);
      assert.ok(Array.isArray(page.citations));
    });
    it('builds parts correctly', () => {
      assert.ok(Array.isArray(manifest.parts));
      assert.strictEqual(manifest.parts.length, 7); // Science, Technology, Engineering, Arts, Mathematics, Innovation, Entrepreneurship
      const sciencePart = manifest.parts.find(p => p.name === 'Science');
      assert.ok(sciencePart);
      assert.strictEqual(sciencePart.eyebrow, 'S');
      assert.strictEqual(sciencePart.blocks.length, 7);
    });
    it('counts total pages', () => {
      assert.strictEqual(manifest.totalPages, 48);
    });
    it('counts total citations', () => {
      assert.strictEqual(manifest.totalCitations, 0);
    });
  });

  describe('normalizeSlug', () => {
    it('normalizes title to slug', () => {
      assert.strictEqual(normalizeSlug('Test Title'), 'test-title');
    });
    it('handles special characters', () => {
      assert.strictEqual(normalizeSlug('Test@#$%^&*()Title'), 'test-title');
    });
  });

  describe('deriveSlugFromTitle', () => {
    it('delegates to normalizeSlug', () => {
      assert.strictEqual(deriveSlugFromTitle('Test Title'), 'test-title');
    });
  });

  describe('pad2', () => {
    it('pads single digit', () => {
      assert.strictEqual(pad2(1), '01');
      assert.strictEqual(pad2(9), '09');
    });
    it('keeps double digit', () => {
      assert.strictEqual(pad2(10), '10');
    });
  });

  describe('writeManifest', () => {
    it('writes manifest to .work folder', () => {
      const testDir = path.join(process.cwd(), 'test', 'temp-manifest');
      fs.mkdirSync(testDir, { recursive: true });
      
      const testManifest = {
        slug: 'test-book',
        title: 'Test Book',
        pages: [],
        parts: [],
        totalPages: 0,
        totalCitations: 0
      };
      
      const manifestPath = writeManifest(testManifest, testDir);
      assert.ok(fs.existsSync(manifestPath));
      
      const written = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      assert.strictEqual(written.slug, 'test-book');
      assert.strictEqual(written.title, 'Test Book');
      
      // Cleanup
      fs.rmSync(testDir, { recursive: true, force: true });
    });
  });
});