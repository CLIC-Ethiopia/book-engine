import { describe, it } from 'node:test';
import assert from 'node:assert';
import { classifyImage } from '../engine/tools/image-classifier.mjs';

describe('image-classifier.mjs', () => {
  describe('classifyImage', () => {
    it('returns diagram for null/undefined/empty', () => {
      assert.strictEqual(classifyImage(null), 'diagram');
      assert.strictEqual(classifyImage(undefined), 'diagram');
      assert.strictEqual(classifyImage(''), 'diagram');
    });

    describe('photo keywords', () => {
      it('detects photograph', () => {
        assert.strictEqual(classifyImage('photograph of a tree'), 'photo');
      });
      it('detects photo of', () => {
        assert.strictEqual(classifyImage('photo of a building'), 'photo');
      });
      it('detects image of', () => {
        assert.strictEqual(classifyImage('image of a fruit'), 'photo');
      });
      it('detects picture of', () => {
        assert.strictEqual(classifyImage('picture of a landscape'), 'photo');
      });
      it('detects shot', () => {
        assert.strictEqual(classifyImage('close-up shot of a flower'), 'photo');
      });
      it('detects real', () => {
        assert.strictEqual(classifyImage('real photograph of a car'), 'photo');
      });
      it('detects physical', () => {
        assert.strictEqual(classifyImage('physical object on table'), 'photo');
      });
      it('detects actual', () => {
        assert.strictEqual(classifyImage('actual photo of device'), 'photo');
      });
    });

    describe('diagram keywords', () => {
      it('detects diagram', () => {
        assert.strictEqual(classifyImage('diagram of a process'), 'diagram');
      });
      it('detects schematic', () => {
        assert.strictEqual(classifyImage('schematic drawing'), 'diagram');
      });
      it('detects chart', () => {
        assert.strictEqual(classifyImage('chart showing data'), 'diagram');
      });
      it('detects graph', () => {
        assert.strictEqual(classifyImage('graph of function'), 'diagram');
      });
      it('detects flow', () => {
        assert.strictEqual(classifyImage('flow diagram'), 'diagram');
      });
      it('detects process', () => {
        assert.strictEqual(classifyImage('process flow'), 'diagram');
      });
      it('detects system', () => {
        assert.strictEqual(classifyImage('system architecture'), 'diagram');
      });
      it('detects architecture', () => {
        assert.strictEqual(classifyImage('system architecture diagram'), 'diagram');
      });
      it('detects vector', () => {
        assert.strictEqual(classifyImage('vector illustration'), 'diagram');
      });
      it('detects blueprint', () => {
        assert.strictEqual(classifyImage('blueprint of house'), 'diagram');
      });
      it('detects before/after', () => {
        assert.strictEqual(classifyImage('before and after comparison'), 'diagram');
      });
      it('detects technical drawing', () => {
        assert.strictEqual(classifyImage('technical drawing of engine'), 'diagram');
      });
      it('detects cross-section', () => {
        assert.strictEqual(classifyImage('cross-section view'), 'diagram');
      });
      it('detects business model', () => {
        assert.strictEqual(classifyImage('business model canvas'), 'diagram');
      });
      it('detects network', () => {
        assert.strictEqual(classifyImage('network diagram'), 'diagram');
      });
    });

    describe('physical indicators (fallback to photo)', () => {
      it('detects fruit', () => {
        assert.strictEqual(classifyImage('fresh fruit on table'), 'photo');
      });
      it('detects plant', () => {
        assert.strictEqual(classifyImage('green plant in pot'), 'photo');
      });
      it('detects vegetable', () => {
        assert.strictEqual(classifyImage('vegetable garden'), 'photo');
      });
      it('detects tool', () => {
        assert.strictEqual(classifyImage('tool on workbench'), 'photo');
      });
      it('detects equipment', () => {
        assert.strictEqual(classifyImage('industrial equipment'), 'photo');
      });
      it('detects building', () => {
        assert.strictEqual(classifyImage('building exterior'), 'photo');
      });
      it('detects construction', () => {
        assert.strictEqual(classifyImage('construction site'), 'photo');
      });
      it('detects cabinet', () => {
        assert.strictEqual(classifyImage('wooden cabinet'), 'photo');
      });
      it('detects tray', () => {
        assert.strictEqual(classifyImage('serving tray'), 'photo');
      });
      it('detects panel', () => {
        assert.strictEqual(classifyImage('control panel'), 'photo');
      });
      it('detects device', () => {
        assert.strictEqual(classifyImage('electronic device'), 'photo');
      });
    });

    describe('case insensitivity', () => {
      it('handles uppercase', () => {
        assert.strictEqual(classifyImage('PHOTOGRAPH OF TREE'), 'photo');
        assert.strictEqual(classifyImage('DIAGRAM OF SYSTEM'), 'diagram');
      });
      it('handles mixed case', () => {
        assert.strictEqual(classifyImage('PhOtOgRaPh'), 'photo');
      });
    });

    describe('keyword priority', () => {
      it('photo keywords take priority over diagram', () => {
        // "photo of a diagram" should be photo because "photo of" matches first
        assert.strictEqual(classifyImage('photo of a diagram'), 'photo');
      });
      it('diagram keywords take priority over physical', () => {
        // "diagram of a fruit" should be diagram because "diagram" matches first
        assert.strictEqual(classifyImage('diagram of a fruit'), 'diagram');
      });
    });

    describe('defaults to diagram', () => {
      it('unknown content defaults to diagram', () => {
        assert.strictEqual(classifyImage('some random text without keywords'), 'diagram');
      });
      it('abstract concept defaults to diagram', () => {
        assert.strictEqual(classifyImage('concept of time'), 'diagram');
      });
    });
  });
});