import { describe, it } from 'node:test';
import assert from 'node:assert';
import { parseEditedPage, buildPrepInstructions, splitPage } from '../engine/tools/prep-pages.mjs';
import { validatePage } from '../engine/tools/page-validator.mjs';
import { VOICE_RULES } from '../engine/tools/context-builder.mjs';

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

/* ──────────────────────────────────────────────────
 * Step 2: buildPrepInstructions alignment tests
 * ──────────────────────────────────────────────────*/

describe('buildPrepInstructions (block skill alignment)', () => {
  const page = { title: 'Test Page', no: 1 };
  const overflow = { overflow: 5, words: 110 };
  const context = {};

  it('mentions the 3-paragraph structure', () => {
    const text = buildPrepInstructions(page, overflow, context);
    assert.ok(text.includes('3 paragraphs'), 'should require 3 paragraphs');
    assert.ok(text.includes('Opener + pain'), 'should mention opener + pain');
    assert.ok(text.includes('Mechanism + outcome'), 'should mention mechanism + outcome');
    assert.ok(text.includes('class="close"'), 'should require closer paragraph');
  });

  it('specifies all three color role classes', () => {
    const text = buildPrepInstructions(page, overflow, context);
    assert.ok(text.includes('class="bad"'), 'should mention bad class');
    assert.ok(text.includes('class="hl"'), 'should mention hl class');
    assert.ok(text.includes('class="good"'), 'should mention good class');
  });

  it('enforces word limits', () => {
    const text = buildPrepInstructions(page, overflow, context);
    assert.ok(text.includes('target ~65 words'), 'should target 65 words');
    assert.ok(text.includes('max 85 words'), 'should cap at 85 words');
    assert.ok(text.includes('max 3 words'), 'title max');
    assert.ok(text.includes('max 10 words'), 'subtitle max');
    assert.ok(text.includes('max 20 words'), 'action max');
  });

  it('contains voice rules (no em dashes, contractions)', () => {
    const text = buildPrepInstructions(page, overflow, context);
    assert.ok(text.includes('No em dashes'), 'should ban em dashes');
    assert.ok(text.includes('Contractions everywhere'), 'should require contractions');
  });

  it('includes current overflow data', () => {
    const text = buildPrepInstructions(page, overflow, context);
    assert.ok(text.includes('Overflow: 5 mm'), 'should show overflow mm');
    assert.ok(text.includes('Current word count: 110'), 'should show word count');
  });

  it('includes an HTML format example', () => {
    const text = buildPrepInstructions(page, overflow, context);
    assert.ok(text.includes('<p>Let\'s say'), 'should include example opener');
    assert.ok(text.includes('<p class="close">'), 'should include example closer');
  });
});

/* ──────────────────────────────────────────────────
 * Step 2: splitPage tests
 * ──────────────────────────────────────────────────*/

describe('splitPage (overflow page splitting)', () => {
  function makePage(no, title, html) {
    return {
      no,
      title,
      subtitle: 'A subtitle',
      section: 'Science',
      content: html,
      preparedContent: html,
      actionCallout: { label: 'TRY THIS', content: 'Do it.' },
      imagePrompt: 'a diagram',
      imageMeta: { type: 'diagram', height: 150 },
    };
  }

  it('splits 3 paragraphs into Part 1 (2) and Part 2 (1)', () => {
    const html = '<p>First para.</p><p>Second para.</p><p class="close">Third.</p>';
    const page = makePage(2, 'Big Topic', html);
    const manifest = { pages: [
      makePage(1, 'Before', '<p>x</p>'),
      page,
      makePage(3, 'After', '<p>y</p>'),
    ]};

    const result = splitPage(page, manifest);

    assert.ok(result, 'should return a result');
    assert.strictEqual(result.part1.title, 'Big Topic Part 1');
    assert.strictEqual(result.part2.title, 'Big Topic Part 2');
    assert.strictEqual(manifest.pages.length, 4, 'manifest should now have 4 pages');
    assert.strictEqual(manifest.pages[1].title, 'Big Topic Part 1');
    assert.strictEqual(manifest.pages[2].title, 'Big Topic Part 2');
  });

  it('renumbers pages sequentially after split', () => {
    const html = '<p>A</p><p>B</p>';
    const page = makePage(2, 'Middle', html);
    const manifest = { pages: [
      makePage(1, 'First', '<p>x</p>'),
      page,
      makePage(3, 'Last', '<p>y</p>'),
    ]};

    splitPage(page, manifest);

    assert.deepStrictEqual(
      manifest.pages.map(p => p.no),
      [1, 2, 3, 4],
      'pages should be renumbered 1-4'
    );
  });

  it('returns null when there is only 1 paragraph', () => {
    const html = '<p>Only one paragraph.</p>';
    const page = makePage(1, 'Single', html);
    const manifest = { pages: [page] };

    const result = splitPage(page, manifest);
    assert.strictEqual(result, null, 'cannot split a single paragraph');
    assert.strictEqual(manifest.pages.length, 1, 'manifest unchanged');
  });

  it('returns null when there are no paragraphs', () => {
    const page = makePage(1, 'Empty', 'just text no p tags');
    const manifest = { pages: [page] };

    const result = splitPage(page, manifest);
    assert.strictEqual(result, null);
  });

  it('strips existing Part N suffix before re-splitting', () => {
    const html = '<p>A</p><p>B</p>';
    const page = makePage(1, 'Topic Part 1', html);
    const manifest = { pages: [page] };

    const result = splitPage(page, manifest);
    assert.ok(result);
    assert.strictEqual(result.part1.title, 'Topic Part 1');
    assert.strictEqual(result.part2.title, 'Topic Part 2');
  });

  it('adds prepHistory entries to both parts', () => {
    const html = '<p>A</p><p>B</p>';
    const page = makePage(1, 'Tracked', html);
    const manifest = { pages: [page] };

    const result = splitPage(page, manifest);
    assert.ok(result.part1.prepHistory.some(h => h.step === 'split-part1'));
    assert.ok(result.part2.prepHistory.some(h => h.step === 'split-part2'));
  });

  it('preserves action callout and image metadata on Part 2', () => {
    const html = '<p>A</p><p>B</p>';
    const page = makePage(1, 'Clone', html);
    const manifest = { pages: [page] };

    const result = splitPage(page, manifest);
    assert.strictEqual(result.part2.actionCallout.label, 'TRY THIS');
    assert.strictEqual(result.part2.imageMeta.type, 'diagram');
    assert.strictEqual(result.part2.section, 'Science');
  });
});