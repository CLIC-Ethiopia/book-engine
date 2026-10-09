import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  selectDiagramShape,
  buildDiagramPrompt,
  validateDiagramSVG,
  generateSVGFromShape,
  processDiagramStage,
} from '../engine/tools/diagram-generator.mjs';

describe('Agent-Native SVG Diagram Synthesis (diagram-generator.mjs)', () => {
  describe('selectDiagramShape', () => {
    it('returns attack shape for attack/security keywords', () => {
      const shape = selectDiagramShape('SSRF Protection', 'Threat leak across trust boundary', 'Technology');
      assert.equal(shape.type, 'attack');
      assert.equal(shape.height, 232);
    });

    it('returns resilience shape for rate limiting keywords', () => {
      const shape = selectDiagramShape('Rate Limiting', 'Fallback shed when load spikes', 'Engineering');
      assert.equal(shape.type, 'resilience');
      assert.equal(shape.height, 200);
    });

    it('returns performance shape for latency/scale keywords', () => {
      const shape = selectDiagramShape('Debouncing', 'Performance scale timeline benchmark', 'Engineering');
      assert.equal(shape.type, 'performance');
      assert.equal(shape.height, 176);
    });

    it('returns correctness shape for HMAC/validation keywords', () => {
      const shape = selectDiagramShape('HMAC Verification', 'Correctness hash check match', 'Mathematics');
      assert.equal(shape.type, 'correctness');
      assert.equal(shape.height, 200);
    });

    it('returns auth shape for login/oauth keywords', () => {
      const shape = selectDiagramShape('OAuth Token Flow', 'Login session identity credential', 'Technology');
      assert.equal(shape.type, 'auth');
      assert.equal(shape.height, 210);
    });

    it('returns async shape for queue/worker keywords', () => {
      const shape = selectDiagramShape('Celery Worker Queue', 'Async job background queue producer', 'Engineering');
      assert.equal(shape.type, 'async');
      assert.equal(shape.height, 190);
    });

    it('returns tooling shape for docker/venv keywords', () => {
      const shape = selectDiagramShape('Isolated Venv', 'Virtual environment container sandbox', 'Technology');
      assert.equal(shape.type, 'tooling');
      assert.equal(shape.height, 180);
    });

    it('returns integration shape for webhook keywords', () => {
      const shape = selectDiagramShape('Webhook Postback', 'Integration inbound POST endpoint callback', 'Technology');
      assert.equal(shape.type, 'integration');
      assert.equal(shape.height, 190);
    });

    it('returns process default shape for general concepts', () => {
      const shape = selectDiagramShape('Solar Dryer Operation', 'Step by step thermal flow', 'Science');
      assert.equal(shape.type, 'process');
      assert.equal(shape.height, 190);
    });
  });

  describe('buildDiagramPrompt', () => {
    it('builds structured prompt with color roles and design rules', () => {
      const promptData = buildDiagramPrompt({
        title: 'HMAC Verification',
        prompt: 'Verify signature using secret key',
        section: 'Science',
      });

      assert.equal(promptData.title, 'HMAC Verification');
      assert.equal(promptData.accentColor, '#e61358');
      assert.equal(promptData.viewBox, '0 0 592 200');
      assert.equal(promptData.shape.type, 'correctness');
      assert.ok(promptData.colorRoles.neutral);
      assert.ok(promptData.designRules.length > 0);
    });
  });

  describe('validateDiagramSVG', () => {
    it('passes clean generated SVG diagrams', () => {
      const svg = generateSVGFromShape({ title: 'Test Flow', prompt: 'Sample mechanism' });
      const val = validateDiagramSVG(svg);
      assert.equal(val.valid, true);
      assert.equal(val.errors.length, 0);
    });

    it('catches missing <svg> element', () => {
      const val = validateDiagramSVG('<div>Not SVG</div>');
      assert.equal(val.valid, false);
      assert.ok(val.errors.some((e) => e.includes('Missing <svg> root element')));
    });

    it('catches non-592 viewBox width', () => {
      const svg = '<svg viewBox="0 0 800 200"><defs><marker id="ar"/><filter id="cs"/></defs><text style="fill:#000">Label</text></svg>';
      const val = validateDiagramSVG(svg);
      assert.equal(val.valid, false);
      assert.ok(val.errors.some((e) => e.includes('viewBox width must be 592')));
    });

    it('catches height exceeding budget', () => {
      const svg = '<svg viewBox="0 0 592 300"><defs><marker id="ar"/><filter id="cs"/></defs><text style="fill:#000">Label</text></svg>';
      const val = validateDiagramSVG(svg);
      assert.equal(val.valid, false);
      assert.ok(val.errors.some((e) => e.includes('exceeds budget')));
    });

    it('catches <text> tags without explicit fill', () => {
      const svg = '<svg viewBox="0 0 592 200"><defs><marker id="ar"/><filter id="cs"/></defs><text>No fill label</text></svg>';
      const val = validateDiagramSVG(svg);
      assert.equal(val.valid, false);
      assert.ok(val.errors.some((e) => e.includes('lacks explicit fill property')));
    });
  });

  describe('generateSVGFromShape', () => {
    it('generates valid SVG for attack shape', () => {
      const svg = generateSVGFromShape({
        title: 'SSRF Attack',
        prompt: 'Attacker bypasses boundary',
        section: 'Technology',
      });
      const val = validateDiagramSVG(svg);
      assert.equal(val.valid, true);
      assert.ok(svg.includes('Attacker'));
      assert.ok(svg.includes('fill="#DC2626"'));
    });

    it('generates valid SVG for resilience shape', () => {
      const svg = generateSVGFromShape({
        title: 'Rate Limit',
        prompt: 'Shed excess traffic',
        section: 'Engineering',
      });
      const val = validateDiagramSVG(svg);
      assert.equal(val.valid, true);
      assert.ok(svg.includes('Resilience Check'));
    });

    it('generates valid SVG for correctness shape', () => {
      const svg = generateSVGFromShape({
        title: 'HMAC Match',
        prompt: 'Funnel inputs into comparison',
        section: 'Mathematics',
      });
      const val = validateDiagramSVG(svg);
      assert.equal(val.valid, true);
      assert.ok(svg.includes('Verification Core'));
    });
  });

  describe('processDiagramStage', () => {
    it('creates prompt file and synthesizes valid SVG', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diagram-test-'));
      try {
        const pageInfo = {
          title: 'Circuit Breaker',
          imagePrompt: 'Resilience fallback on fault',
          section: 'Engineering',
        };

        const result = await processDiagramStage(tmpDir, pageInfo);
        assert.equal(result.status, 'synthesized');
        assert.ok(fs.existsSync(result.promptPath));
        assert.ok(fs.existsSync(result.svgPath));

        const promptContent = JSON.parse(fs.readFileSync(result.promptPath, 'utf8'));
        assert.equal(promptContent.title, 'Circuit Breaker');

        const svgContent = fs.readFileSync(result.svgPath, 'utf8');
        const val = validateDiagramSVG(svgContent);
        assert.equal(val.valid, true);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('retains an existing valid SVG file', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diagram-test-2-'));
      try {
        const imagesDir = path.join(tmpDir, 'images');
        fs.mkdirSync(imagesDir, { recursive: true });

        const customSVG = generateSVGFromShape({ title: 'Custom Diagram', prompt: 'Custom' });
        const svgPath = path.join(imagesDir, 'custom-diagram.svg');
        fs.writeFileSync(svgPath, customSVG, 'utf8');

        const result = await processDiagramStage(tmpDir, { title: 'Custom Diagram' });
        assert.equal(result.status, 'existing_valid');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
