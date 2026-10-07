import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseEditedPage } from '../engine/tools/prep-pages.mjs';
import { validatePage } from '../engine/tools/page-validator.mjs';

describe('parseEditedPage (editor round-trip parsing)', () => {
  const seed = {
    title: 'Old Title',
    subtitle: 'Old subtitle',
    explainerHtml: '<p>original body</p>',
    actionLabel: 'TRY THIS',
    actionContent: 'Do the thing.',
    imageType: 'diagram',
    imagePrompt: 'A diagram',
  };

  const wrap = (body, over = {}) => `
<!-- Title: ${over.title ?? seed.title} -->
<!-- Subtitle: ${over.subtitle ?? seed.subtitle} -->
${body}

<!-- Action: ${seed.actionLabel} - ${seed.actionContent} -->
<!-- Image: ${seed.imageType} - ${seed.imagePrompt} -->
`;

  it('returns the edited body unchanged when it is HTML', () => {
    const out = parseEditedPage(wrap('<p>brand new body</p>'), seed);
    assert.strictEqual(out.explainerHtml, '<p>brand new body</p>');
    assert.strictEqual(out.subtitle, 'Old subtitle');
    assert.ok(Number.isFinite(out.wordCount));
  });

  it('lets the human shorten an over-long title', async () => {
    // validatePage caps titles at 3 words, so a 4-word source title must be fixable.
    const out = parseEditedPage(wrap('<p>x</p>', { title: 'Structural Yield And Costing Rules' }), seed);
    assert.strictEqual(out.title, 'Structural Yield And Costing Rules');
    const result = await validatePage({ ...out, actionLabel: 'TRY THIS', actionContent: 'Do it.', imagePrompt: 'p' });
    assert.strictEqual(result.valid, false, 'a 5-word title must still be rejected');
  });

  it('accepts a shortened title that then validates', async () => {
    const out = parseEditedPage(wrap('<p>x</p>', { title: 'Structural Yield' }), seed);
    const result = await validatePage({ ...out, actionLabel: 'TRY THIS', actionContent: 'Do it.', imagePrompt: 'p' });
    assert.strictEqual(result.valid, true, result.errors.join(', '));
  });

  it('wraps plain prose into paragraphs', () => {
    const out = parseEditedPage(wrap('First paragraph here.\n\nSecond paragraph here.'), seed);
    assert.ok(out.explainerHtml.includes('<p>First paragraph here.</p>'));
    assert.ok(out.explainerHtml.includes('<p>Second paragraph here.</p>'));
  });

  it('falls back to the seed body when markers are absent', () => {
    const out = parseEditedPage('no markers at all', seed);
    assert.strictEqual(out.explainerHtml, '<p>original body</p>');
    assert.strictEqual(out.title, 'Old Title');
  });

  it('accepts a preparedContent seed', () => {
    // resolveOverflow historically passed { preparedContent } and got nothing.
    const out = parseEditedPage('', { title: 'T', preparedContent: '<p>seeded</p>' });
    assert.strictEqual(out.explainerHtml, '<p>seeded</p>');
  });

  it('recovers the action from the marker when the seed has none', () => {
    const text = `
<!-- Title: T -->
<!-- Subtitle: S -->
<p>body</p>

<!-- Action: MEASURE IT - Weigh five blocks -->
<!-- Image: diagram - x -->
`;
    const out = parseEditedPage(text, { title: 'T', subtitle: 'S', explainerHtml: '<p>body</p>' });
    assert.strictEqual(out.actionLabel, 'MEASURE IT');
    assert.strictEqual(out.actionContent, 'Weigh five blocks');
  });
});

describe('human-authored content passes validatePage', () => {
  it('accepts a realistic hand-written page', async () => {
    const proposal = {
      title: 'Soil Mechanics',
      subtitle: 'How soil holds together',
      explainerHtml:
        '<p>Let\'s say your block crumbles. <span class="bad">Cement is not the binder</span>.</p>' +
        '<p>Clay binds and sand forms the skeleton, so <span class="hl">grain distribution decides strength</span>. ' +
        '<span class="good">Test the profile first</span>.</p>' +
        '<p class="close">Read the soil before the bag.</p>',
      actionLabel: 'TRY THIS',
      actionContent: 'Run a jar test on three soil samples.',
      imageType: 'diagram',
      imagePrompt: 'Jar test layers',
      wordCount: 40,
    };
    const result = await validatePage(proposal);
    assert.strictEqual(result.valid, true, result.errors.join(', '));
  });

  it('still rejects dangerous HTML typed by a human', async () => {
    const result = await validatePage({
      title: 'Safe Title',
      subtitle: 'A subtitle here',
      explainerHtml: '<p>Fine</p><script>alert(1)</script>',
      actionLabel: 'TRY THIS',
      actionContent: 'Do it.',
      imageType: 'diagram',
      imagePrompt: 'p',
      wordCount: 3,
    });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => /dangerous/i.test(e)));
  });

  it('rejects a human draft over the word cap', async () => {
    const result = await validatePage({
      title: 'Long Draft',
      subtitle: 'Too many words',
      explainerHtml: `<p>${'word '.repeat(90)}</p>`,
      actionLabel: 'TRY THIS',
      actionContent: 'Do it.',
      imageType: 'diagram',
      imagePrompt: 'p',
      wordCount: 90,
    });
    assert.strictEqual(result.valid, false);
  });

  it('rejects a human draft over the action word cap', async () => {
    const result = await validatePage({
      title: 'Short Title',
      subtitle: 'Subtitle',
      explainerHtml: '<p>Short body.</p>',
      actionLabel: 'TRY THIS',
      actionContent: 'word '.repeat(25).trim(),
      imageType: 'diagram',
      imagePrompt: 'p',
      wordCount: 2,
    });
    assert.strictEqual(result.valid, false);
    assert.ok(result.errors.some((e) => /Action content/.test(e)));
  });
});