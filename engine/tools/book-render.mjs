/*
  book-render.mjs  -  convert parsed idea manifest into interior HTML
  --------------------------------------------------------------------------
  Reads:
    books/<slug>/.work/idea-manifest.json
    books/<slug>/book.json
    books/<slug>/blocks.md
    books/<slug>/VOICE.md (optional)
    books/<slug>/images/<slug>-*.png (optional, pre-generated)

  Writes:
    books/<slug>/<slug>.html

  The output is a complete interior file ready for build-book.mjs.
*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import prompts from 'prompts';
import { fail, pad2, escHTML, escHTMLNoAmp, sanitizeFilename } from './shared.mjs';
import { classifyImage } from './image-classifier.mjs';
import { JSDOM } from 'jsdom';
import DOMPurify from 'dompurify';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const SECTION_COLORS = {
  Science: '#e61358',
  Technology: '#ed7d1f',
  Engineering: '#a0c82f',
  Arts: '#32b5d3',
  Mathematics: '#b44b97',
  Innovation: '#306a50',
  Entrepreneurship: '#5441ff',
};

// DOMPurify setup with JSDOM
const window = new JSDOM('').window;
const purify = DOMPurify(window);

const ALLOWED_TAGS = ['p', 'span', 'strong', 'em', 'b', 'i', 'a', 'sup'];
const ALLOWED_ATTR = ['class', 'href'];

function sanitizeHTML(html) {
  return purify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button', 'link', 'meta', 'style', 'base'],
    FORBID_ATTR: ['on*', 'style', 'onclick', 'onload', 'onerror', 'onmouseover'],
  });
}

function stripAttr(str) {
  return str.replace(/<[^>]*>/g, '');
}

/**
 * Generate a placeholder SVG for a missing/undecided image.
 */
function placeholderSVG(title, width = 592, height = 200, color = '#e61358') {
  const safeTitle = escHTML(title || 'Placeholder').substring(0, 60);
  return `<!-- TODO: AGY BLOCK SKILL - REPLACE THIS SVG WITH INLINE DIAGRAM -->
<svg width="100%" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escHTML(safeTitle)}">
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="6" fill="#F1F2F6" stroke="#CBD2DC" stroke-width="1" stroke-dasharray="5 5"/>
  <text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="central" style="font-family:'Inter',sans-serif;font-size:14px;fill:#5B6472">Diagram: ${safeTitle}</text>
</svg>`;
}

/**
 * Read a generated diagram SVG from images/<slug>.svg and inline it.
 * Returns null when the file does not exist, so the caller can fall back
 * to the placeholder. The generated SVG is made responsive (width 100%,
 * viewBox keeps the aspect ratio) to match how the engine lays out .diagram.
 */
function readDiagramSVG(bookDir, pageTitle) {
  if (!bookDir) return null;
  const svgFile = path.join(bookDir, 'images', `${sanitizeFilename(pageTitle)}.svg`);
  if (!fs.existsSync(svgFile)) return null;

  let svg = fs.readFileSync(svgFile, 'utf8').trim();

  // Strip any XML prolog / doctype - inline SVG must not carry them.
  svg = svg.replace(/<\?xml[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[\s\S]*?>/g, '').trim();

  // Make the root responsive: drop fixed width/height, force width="100%".
  svg = svg.replace(/<svg\b([^>]*)>/, (match, attrs) => {
    const cleaned = attrs
      .replace(/\s+width="[^"]*"/g, '')
      .replace(/\s+height="[^"]*"/g, '');
    return `<svg${cleaned} width="100%">`;
  });

  return svg || null;
}

/**
 * Collect all unique citations from all pages
 */
function collectCitations(pages) {
  const citationMap = new Map();
  pages.forEach((page) => {
    (page.citations || []).forEach((cite) => {
      if (!citationMap.has(cite.number)) {
        citationMap.set(cite.number, {
          number: cite.number,
          marker: cite.marker,
          pages: []
        });
      }
      citationMap.get(cite.number).pages.push(page.title);
    });
  });
  return Array.from(citationMap.values()).sort((a, b) => a.number - b.number);
}

/**
 * Generate footnotes section HTML for footnotes style
 * Each footnote shows only the citation marker [N], no page references
 */
function renderFootnotes(citations) {
  if (!citations.length) return '';
  return `
    <section class="sheet bb footnotes">
      <h2 class="sr">Footnotes</h2>
      <div class="tab" style="background:#6366F1"></div>
      <div class="top">
        <div class="eyebrow"><b>STEAM-IE</b> · Footnotes</div>
        <span class="pill">References</span>
      </div>
      <h1 class="title">Footnotes</h1>
      <hr class="rule">
      <div class="explain">
        <ol class="footnotes-list">
${citations.map(c => `          <li id="fn-${c.number}" value="${c.number}">[${c.number}]</li>`).join('\n')}
        </ol>
      </div>
      <div class="foot"><span class="brand">yoursite.com</span><span class="pg"></span><span class="series">STEAM-IE</span></div>
    </section>`;
}

/**
 * Generate references page HTML for references style
 * Each reference shows only the citation marker [N], no page references
 */
function renderReferencesPage(citations, series, footerBrand, footerRight) {
  if (!citations.length) return '';
  return `
    <section class="sheet bb references">
      <h2 class="sr">References</h2>
      <div class="tab" style="background:#6366F1"></div>
      <div class="top">
        <div class="eyebrow"><b>${escHTML(series)}</b> · References</div>
        <span class="pill">References</span>
      </div>
      <h1 class="title">References</h1>
      <hr class="rule">
      <div class="explain">
        <ol class="references-list">
${citations.map(c => `          <li id="ref-${c.number}" value="${c.number}">[${c.number}]</li>`).join('\n')}
        </ol>
      </div>
      <div class="foot"><span class="brand">${escHTML(footerBrand)}</span><span class="pg"></span><span class="series">${escHTML(footerRight)}</span></div>
    </section>`;
}

/**
 * Render a single page section from manifest data.
 */
function renderPage(page, index, totalPages, series, footerBrand, footerRight, imageFolder, citationStyle, bookDir, classification) {
  const sectionColor = SECTION_COLORS[page.section] || '#6366F1';
  const eyebrow = page.section === 'Entrepreneurship' ? 'IE' : page.section.charAt(0).toUpperCase();
  const pageNo = pad2(index + 1);

  // Use preparedContent if available (from prep-pages), otherwise fall back to raw content
  let rawContent = page.preparedContent || page.content || '';
  
  // Handle citations in markdown content (only for raw content, prepared already has citations handled)
  if (!page.preparedContent) {
    if (citationStyle === 'remove') {
      rawContent = rawContent.replace(/\[cite:\s*\d+\]/g, '');
    } else if (citationStyle === 'footnotes' || citationStyle === 'references') {
      rawContent = rawContent.replace(/\[cite:\s*(\d+)\]/g, '<sup class="cite">[$1]</sup>');
    }
  }

  // Use prepared content if available (already HTML with color roles), otherwise parse markdown
  let explain;
  if (page.preparedContent) {
    explain = formatExplainerParagraphs(sanitizeHTML(page.preparedContent));
  } else {
    // Strip markdown title/subtitle headers that are already rendered in page chrome
    let contentForMarked = rawContent
      .replace(/^##\s+.+$/m, '')
      .replace(/^####\s+.+$/m, '')
      .trim();
    
    // Render content using marked and format into 3 paragraphs with color roles
    const parsedHtml = marked.parse(contentForMarked);
    explain = formatExplainerParagraphs(parsedHtml);
  }

  // Determine image type from imageMeta (set by prep stage) or classification or classify
  const imageType = page.imageMeta?.type || classification || classifyImage(page.imagePrompt);
  const diagramHeight = page.imageMeta?.height || 200;
  const imageSrc = `${imageFolder}/${sanitizeFilename(page.title)}.png`;

  // Build band content
  let band;
  if (imageType === 'photo') {
    band = `<div class="diagram">
  <figure class="photo">
    <img src="${imageSrc}" alt="${escHTML(page.title)}" width="800" height="600">
  </figure>
</div>`;
  } else {
    const generatedSVG = readDiagramSVG(bookDir, page.title);
    band = `<div class="diagram">
  ${generatedSVG || placeholderSVG(page.title, 592, diagramHeight, sectionColor)}
</div>`;
  }

  // Use prepared subtitle/action if available
  const subtitle = page.preparedSubtitle || page.subtitle || '';
  const actionLabel = page.preparedActionLabel || page.actionCallout?.label || '';
  const actionContent = page.preparedActionContent || page.actionCallout?.content || '';

  // Build action callout
  const action = actionLabel
    ? `<div class="ask">
  <span class="lbl">${escHTML(actionLabel)}</span>
  <p>${escHTML(actionContent || '')}</p>
</div>`
    : '';

  // Build footer
  const foot = `<div class="foot"><span class="brand">${escHTML(footerBrand)}</span><span class="pg"></span><span class="series">${escHTML(series)}</span></div>`;

  // Build screen-reader heading
  const displayTitle = page.displayTitle || page.preparedTitle || page.title;
  const srTitle = displayTitle + (page.subtitle ? ': ' + page.subtitle : '');

  return `    <section class="sheet bb">
      <h2 class="sr">${escHTML(srTitle)}</h2>
      <div class="tab" style="background:${sectionColor}"></div>
      <div class="top">
        <div class="eyebrow"><b>${escHTML(series)}</b> · No. ${pageNo}</div>
        <span class="pill">${escHTML(page.section)}</span>
      </div>
      <h1 class="title">${escHTMLNoAmp(displayTitle)}</h1>
      <div class="sub">${escHTML(subtitle)}</div>
      <hr class="rule">
      ${band}
      <hr class="rule">
      <div class="explain">
        ${explain}
      </div>
      ${action}
      ${foot}
    </section>`;
}

function buildPartComment(part) {
  const upperOrder = ['Science', 'Technology', 'Engineering', 'Arts', 'Mathematics', 'Innovation', 'Entrepreneurship'];
  const orderKey = upperOrder.indexOf(part.name) + 1;
  return `    <!-- ============================================================\n         ${part.name.toUpperCase()} — ${part.name}\n         ============================================================ -->`;
}

function renderInterior(manifest, bookConfig, pageClassifications, citationStyle = 'preserve', options = {}) {
  const { includeFootnotes = true, includeReferences = true, bookDir = null } = options;
  const series = manifest.series;
  const footerBrand = manifest.slug ? `${manifest.slug}.github.io` : 'yoursite.com';
  const footerRight = series;
  const imageFolder = 'images';

  // Collect citations for footnotes/references
  const allCitations = collectCitations(manifest.pages || []);

  // Build the pages grouped by part
  const parts = manifest.parts || [];
  const pages = manifest.pages || [];

  // Create a map from page title to classification
  const classificationMap = new Map();
  pageClassifications.forEach((c) => {
    classificationMap.set(c.title, c.type);
    if (c.preparedTitle) classificationMap.set(c.preparedTitle, c.type);
  });

  // Build sections
  const sections = [];
  let globalIndex = 0;

  // Group pages by part
  const pagesByPart = new Map();
  pages.forEach((page) => {
    const partName = page.section;
    if (!pagesByPart.has(partName)) pagesByPart.set(partName, []);
    pagesByPart.get(partName).push(page);
  });

  // Output in part order
  parts.forEach((part) => {
    sections.push(buildPartComment(part));
    const partPages = pagesByPart.get(part.name) || [];
    partPages.forEach((page, localIdx) => {
      const classification = (page.preparedTitle && classificationMap.get(page.preparedTitle)) || classificationMap.get(page.title) || classifyImage(page.imagePrompt);
      sections.push(renderPage(page, globalIndex, manifest.totalPages, series, footerBrand, footerRight, imageFolder, citationStyle, bookDir, classification));
      globalIndex++;
    });
  });

  // Add footnotes section if needed
  if (citationStyle === 'footnotes' && allCitations.length > 0 && includeFootnotes) {
    sections.push(renderFootnotes(allCitations));
  }

  // Add references page if needed
  if (citationStyle === 'references' && allCitations.length > 0 && includeReferences) {
    sections.push(renderReferencesPage(allCitations, series, footerBrand, footerRight));
  }

  // Generate complete HTML file
  const html = `<!doctype html>
<!--
  THE INTERIOR — ${escHTML(manifest.title)}. Auto-generated from idea manifest.
  One <section class="sheet bb"> per concept, in reading order. The look comes from
  ../../engine/themes/studio.css, never an inline <style>.
-->
<html lang="en" data-size="b5">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'none'; object-src 'none'; base-uri 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:;">
  <title>${escHTML(manifest.title)}</title>
  <link rel="stylesheet" href="../../engine/sheet.css">
  <link rel="stylesheet" href="../../engine/sizes/b5.css">
  <link rel="stylesheet" href="../../engine/themes/studio.css">
  <!-- STEAM-IE TAB COLOUR RULE
       The <div class="tab"> for each page uses that page's section colour.
       S: #e61358  T: #ed7d1f  E: #a0c82f  A: #32b5d3  M: #b44b97  I: #306a50  IE: #5441ff -->
</head>
<body>
  <main class="deck">

${sections.join('\n')}

  </main>
  <script src="../../engine/sheet-tools.js"></script>
</body>
</html>`;

  return html;
}

async function classifyImagesInteractive(manifest) {
  const classifications = [];
  const { select } = prompts;

  for (const page of manifest.pages) {
    const currentType = classifyImage(page.imagePrompt);
    const answer = await select({
      name: 'type',
      message: `Page ${page.no}: ${page.title}\nPrompt: ${page.imagePrompt?.substring(0, 80) || 'N/A'}...`,
      choices: [
        { title: `Photo (for physical subjects) — default/auto-detect: ${currentType}`, value: 'photo' },
        { title: 'Diagram (inline SVG for mechanisms/processes)', value: 'diagram' },
      ],
      initial: currentType === 'photo' ? 0 : 1,
    });
    classifications.push({ title: page.title, type: answer || currentType });
  }
  return classifications;
}

function classifyImagesInline(manifest) {
  // Automatic classification based on prompt content
  return manifest.pages.map((page) => ({
    title: page.title,
    type: classifyImage(page.imagePrompt),
  }));
}

function writeImagePrompts(manifest, imagesDir) {
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
  manifest.pages.forEach((page) => {
    if (page.imagePrompt) {
      const promptFile = path.join(imagesDir, `${sanitizeFilename(page.title)}.txt`);
      const enhancedPrompt = `
${page.imagePrompt}

Style guidelines:
- No text in the image.
- No logos or brands.
- Soft daylight, front angle, plain neutral background.
- Consistent book style: clear, clean, professional, modern layout style.
`.trim();
      fs.writeFileSync(promptFile, enhancedPrompt, 'utf8');
    }
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node engine/tools/book-render.mjs books/<slug> [--auto-classify]');
    console.log('  --auto-classify   Use automatic classification without prompts.');
    process.exit(0);
  }

  const bookPath = args[0];
  const autoClassify = args.includes('--auto-classify');
  const slug = path.basename(path.resolve(bookPath));
  const manifestPath = path.join(bookPath, '.work', 'idea-manifest.json');
  const bookJsonPath = path.join(bookPath, 'book.json');
  const outputHtmlPath = path.join(bookPath, `${slug}.html`);
  const imagesDir = path.join(bookPath, 'images');

  if (!fs.existsSync(manifestPath)) {
    fail(`Manifest not found at ${manifestPath}. Run idea-parser first.`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const bookConfig = fs.existsSync(bookJsonPath) ? JSON.parse(fs.readFileSync(bookJsonPath, 'utf8')) : {};

  // Determine image classifications
  const classifications = autoClassify
    ? classifyImagesInline(manifest)
    : await classifyImagesInteractive(manifest);

  // Write image prompt files
  writeImagePrompts(manifest, imagesDir);

  // Report classifications
  console.log(`Image classifications (${classifications.length} pages):`);
  classifications.forEach((c) => console.log(`  ${c.title}: ${c.type}`));

  // Render interior HTML
  const html = renderInterior(manifest, bookConfig, classifications);
  fs.writeFileSync(outputHtmlPath, html, 'utf8');

  console.log(`\n✅ Interior rendered: ${path.relative(PROJECT_ROOT, outputHtmlPath)}`);
  console.log(`   Pages: ${manifest.totalPages}`);
  console.log(`   Total citations: ${manifest.totalCitations}`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => fail(error.message || String(error)));
}

export function applyColorRoles(html) {
  if (/<span class="(bad|hl|good)">/.test(html)) {
    return html; // Already contains explicit color spans
  }

  let text = html;

  const badPatterns = [
    /\b(swelling and severe shrinkage cracking|shrinkage cracking|crumbly block|mix failures|air pockets|premature drying|spalling|chalking|failure|cracking|crumbly|damage|leak|leaks|attack|vulnerability|clash|excessive)\b/gi,
  ];

  const hlPatterns = [
    /\b(chemical hydration|calcium silicate hydrate|particle distribution|mechanical stabilization|Optimum Moisture Content|relative humidity|hydration|compaction|C-S-H gels|Jar Test|Drop Test|natural binder|celery|queue|webhook|HMAC|OAuth)\b/gi,
  ];

  const goodPatterns = [
    /\b(weather-resistant masonry|structural skeleton|initial structural integrity|full design strength|weather-resistant|durable block|structural integrity|optimal soil|healthy path)\b/gi,
  ];

  for (const pat of badPatterns) {
    text = text.replace(pat, (m) => `<span class="bad">${m}</span>`);
  }
  for (const pat of hlPatterns) {
    text = text.replace(pat, (m) => `<span class="hl">${m}</span>`);
  }
  for (const pat of goodPatterns) {
    text = text.replace(pat, (m) => `<span class="good">${m}</span>`);
  }

  return text;
}

export function formatExplainerParagraphs(content) {
  if (!content || typeof content !== 'string') return '';

  let html = content.trim();

  // Count existing <p> tags
  const pCount = (html.match(/<p\b[^>]*>/gi) || []).length;

  if (pCount >= 2) {
    // Already structured into multiple <p> tags
    if (!/<p\s+class="close">/i.test(html)) {
      html = html.replace(/<p>(.*?)<\/p>\s*$/i, '<p class="close">$1</p>');
    }
    return applyColorRoles(html);
  }

  // Strip existing single <p> or <p class="..."> wrapper if present
  let plain = html.replace(/^<p\b[^>]*>/i, '').replace(/<\/p>$/i, '').trim();

  // Split plain text into sentences
  const sentenceRegex = /[^.!?]+[.!?]+(\s+|$)/g;
  const sentences = plain.match(sentenceRegex) || [plain];

  let p1 = '', p2 = '', p3 = '';

  if (sentences.length >= 4) {
    p1 = sentences.slice(0, 2).join('').trim();
    p2 = sentences.slice(2, sentences.length - 1).join('').trim();
    p3 = sentences[sentences.length - 1].trim();
  } else if (sentences.length === 3) {
    p1 = sentences[0].trim();
    p2 = sentences[1].trim();
    p3 = sentences[2].trim();
  } else if (sentences.length === 2) {
    p1 = sentences[0].trim();
    p2 = sentences[1].trim();
  } else {
    p1 = plain;
  }

  const p1Html = p1 ? `<p>${applyColorRoles(p1)}</p>` : '';
  const p2Html = p2 ? `<p>${applyColorRoles(p2)}</p>` : '';
  const p3Html = p3 ? `<p class="close">${applyColorRoles(p3)}</p>` : '';

  return [p1Html, p2Html, p3Html].filter(Boolean).join('\n        ');
}

export { classifyImage, placeholderSVG, renderPage, renderInterior, collectCitations, renderFootnotes, renderReferencesPage };