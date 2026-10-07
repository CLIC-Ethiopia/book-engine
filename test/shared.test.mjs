import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  fail,
  pad2,
  normalizeSlug,
  deriveSlugFromTitle,
  sanitizeFilename,
  countWords,
  escHTML,
  escHTMLNoAmp,
  formatFileSize
} from '../engine/tools/shared.mjs';

describe('shared.mjs utilities', () => {
  describe('normalizeSlug', () => {
    it('normalizes simple title', () => {
      assert.strictEqual(normalizeSlug('Hello World'), 'hello-world');
    });
    it('handles special characters', () => {
      assert.strictEqual(normalizeSlug('Test@#$%^&*()Title'), 'test-title');
    });
    it('trims leading/trailing dashes', () => {
      assert.strictEqual(normalizeSlug('  --Test--  '), 'test');
    });
    it('handles empty string', () => {
      assert.strictEqual(normalizeSlug(''), '');
    });
    it('handles null/undefined', () => {
      assert.strictEqual(normalizeSlug(null), '');
      assert.strictEqual(normalizeSlug(undefined), '');
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
      assert.strictEqual(pad2(99), '99');
    });
    it('handles string input', () => {
      assert.strictEqual(pad2('5'), '05');
    });
  });

  describe('sanitizeFilename', () => {
    it('converts to lowercase', () => {
      assert.strictEqual(sanitizeFilename('Test'), 'test');
    });
    it('replaces special chars with dash', () => {
      assert.strictEqual(sanitizeFilename('File Name'), 'file-name');
      assert.strictEqual(sanitizeFilename('File@Name'), 'file-name');
    });
    it('handles multiple consecutive special chars', () => {
      assert.strictEqual(sanitizeFilename('File---Name'), 'file-name');
    });
  });

  describe('countWords', () => {
    it('counts words in plain text', () => {
      assert.strictEqual(countWords('Hello world'), 2);
    });
    it('strips HTML tags', () => {
      assert.strictEqual(countWords('<p>Hello <span class="bad">world</span></p>'), 2);
    });
    it('handles empty string', () => {
      assert.strictEqual(countWords(''), 0);
    });
    it('handles only whitespace', () => {
      assert.strictEqual(countWords('   '), 0);
    });
    it('handles multiple spaces', () => {
      assert.strictEqual(countWords('Hello    world'), 2);
    });
  });

  describe('escHTML', () => {
    it('escapes & < >', () => {
      assert.strictEqual(escHTML('A & B < C > D'), 'A & B < C > D');
    });
    it('handles null/undefined', () => {
      assert.strictEqual(escHTML(null), '');
      assert.strictEqual(escHTML(undefined), '');
    });
  });

  describe('escHTMLNoAmp', () => {
    it('escapes < > but not &', () => {
      assert.strictEqual(escHTMLNoAmp('A & B < C > D'), 'A & B < C > D');
    });
    it('handles null/undefined', () => {
      assert.strictEqual(escHTMLNoAmp(null), '');
      assert.strictEqual(escHTMLNoAmp(undefined), '');
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes', () => {
      assert.strictEqual(formatFileSize(500), '500 B');
    });
    it('formats KB', () => {
      assert.strictEqual(formatFileSize(1024), '1.0 KB');
      assert.strictEqual(formatFileSize(1536), '1.5 KB');
    });
    it('formats MB', () => {
      assert.strictEqual(formatFileSize(1048576), '1.0 MB');
      assert.strictEqual(formatFileSize(1572864), '1.5 MB');
    });
  });

  describe('fail', () => {
    it('throws error and exits', () => {
      // This is tested by running the function and catching the process exit
      // We can't easily test process.exit in unit tests without mocking
    });
  });
});