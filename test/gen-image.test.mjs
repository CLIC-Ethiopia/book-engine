import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  loadEnv,
  generatePhotoFallbackSVG,
  generatePollinations,
  generatePhoto,
} from '../engine/tools/gen-image.mjs';

describe('Universal Image Generation Engine (gen-image.mjs)', () => {
  describe('loadEnv', () => {
    it('loads environment variables without throwing', () => {
      assert.doesNotThrow(() => loadEnv());
    });
  });

  describe('generatePhotoFallbackSVG', () => {
    it('generates valid B5 SVG photo card file', () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-img-test-'));
      try {
        const outPath = path.join(tmpDir, 'photo-fallback.svg');
        const ok = generatePhotoFallbackSVG('A test photo prompt', outPath, { title: 'Test Photo', height: 180 });
        assert.equal(ok, true);
        assert.ok(fs.existsSync(outPath));

        const content = fs.readFileSync(outPath, 'utf8');
        assert.ok(content.includes('viewBox="0 0 592 180"'));
        assert.ok(content.includes('PHYSICAL SUBJECT PHOTOGRAPH'));
        assert.ok(content.includes('A test photo prompt'));
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('generatePhoto Orchestrator', () => {
    it('successfully generates output using available provider or fallback', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gen-img-test-2-'));
      try {
        const outPath = path.join(tmpDir, 'sample-output.png');
        const result = await generatePhoto('A simple test photo of a potted plant', outPath, { height: 180 });
        assert.ok(['success', 'fallback'].includes(result.status));
        assert.ok(fs.existsSync(outPath));
        assert.ok(fs.statSync(outPath).size > 0);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
