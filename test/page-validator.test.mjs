import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  checkPageOverflows,
  validatePage,
  recommendFixes
} from '../engine/tools/page-validator.mjs';
import { countWords } from '../engine/tools/shared.mjs';

describe('page-validator.mjs', () => {
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
  });

  describe('validatePage', () => {
    const validProposal = {
      title: 'Soil Mechanics',
      subtitle: 'The principle behind soil composition',
      explainerHtml: '<p>Let\'s say soil is important.</p><p>Mechanism with <span class="hl">indigo</span> and <span class="good">outcome</span>.</p><p class="close">Soil matters.</p>',
      actionLabel: 'TRY THIS TODAY',
      actionContent: 'Collect three soil samples at 50cm depth and run a 24-hour jar test.',
      imageType: 'diagram',
      imagePrompt: 'Technical diagram of soil composition',
      wordCount: 68
    };

    it('accepts valid proposal', async () => {
      const result = await validatePage(validProposal);
      assert.strictEqual(result.valid, true);
      assert.deepStrictEqual(result.errors, []);
    });

    it('rejects title > 3 words', async () => {
      const proposal = { ...validProposal, title: 'This Title Has Too Many Words' };
      const result = await validatePage(proposal);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Title')));
    });

    it('rejects subtitle > 10 words', async () => {
      const proposal = { ...validProposal, subtitle: 'This subtitle has way too many words for the limit and more' };
      const result = await validatePage(proposal);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Subtitle')));
    });

    it('rejects missing explainerHtml', async () => {
      const proposal = { ...validProposal, explainerHtml: '' };
      const result = await validatePage(proposal);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('explainerHtml')));
    });

    it('rejects explainerHtml without <p>', async () => {
      const proposal = { ...validProposal, explainerHtml: 'Just text without tags' };
      const result = await validatePage(proposal);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('explainerHtml')));
    });

    it('rejects missing actionLabel', async () => {
      const proposal = { ...validProposal, actionLabel: '' };
      const result = await validatePage(proposal);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Action')));
    });

    it('rejects actionContent > 20 words', async () => {
      const proposal = { ...validProposal, actionContent: 'This action content has way too many words and exceeds the twenty word limit and more words here to ensure we go over the limit' };
      const result = await validatePage(proposal);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Action content')));
    });

    it('rejects invalid imageType', async () => {
      const proposal = { ...validProposal, imageType: 'invalid' };
      const result = await validatePage(proposal);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('imageType')));
    });

    it('rejects wordCount > 85', async () => {
      const proposal = { ...validProposal, wordCount: 90 };
      const result = await validatePage(proposal);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('wordCount')));
    });

    it('rejects nested color spans', async () => {
      const proposal = {
        ...validProposal,
        explainerHtml: '<p>Text with <span class="bad"><span class="hl">nested</span></span> spans</p>'
      };
      const result = await validatePage(proposal);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Nested')));
    });

    it('rejects em dashes', async () => {
      const proposal = {
        ...validProposal,
        explainerHtml: '<p>Text with — em dash</p>'
      };
      const result = await validatePage(proposal);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Em dashes')));
    });

    it('rejects emojis', async () => {
      const proposal = {
        ...validProposal,
        explainerHtml: '<p>Text with 😀 emoji</p>'
      };
      const result = await validatePage(proposal);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.some(e => e.includes('Emojis')));
    });

    it('accepts photo imageType', async () => {
      const proposal = { ...validProposal, imageType: 'photo' };
      const result = await validatePage(proposal);
      assert.strictEqual(result.valid, true);
    });

    it('accepts wordCount exactly 85', async () => {
      const proposal = { ...validProposal, wordCount: 85 };
      const result = await validatePage(proposal);
      assert.strictEqual(result.valid, true);
});
});

describe('checkPageOverflows', () => {
    it('returns empty map for non-existent file', async () => {
      const map = await checkPageOverflows('/non/existent/path.html');
      assert.ok(typeof map === 'object');
      assert.strictEqual(Object.keys(map).length, 0);
    });
  });
});