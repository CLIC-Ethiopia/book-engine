/* ==========================================================================
   build-book.mjs  -  turn your pages into a book
   --------------------------------------------------------------------------
   You write pages. This wraps them in everything else a book needs: a cover, a
   copyright page, a contents with real page numbers, a divider in front of
   every part, an alphabetical index, and one page counter running through all
   of it.

   Usage:
       node engine/tools/build-book.mjs books/<slug>
       node engine/tools/build-book.mjs books/<slug> --edition free
       node engine/tools/build-book.mjs books/<slug> --out books/<slug>/other.html

   Reads:   books/<slug>/book.json     the running order and everything printed
            books/<slug>/<slug>.html   your pages (the interior)
   Writes:  books/<slug>/book.html     GENERATED. Never hand-edit it.

   The interior is a POOL of pages. book.json's parts decide which ones are in
   the book and in what order, matched by each page's title. So reordering a
   book, or cutting a free edition out of it, is a JSON edit and never HTML
   surgery.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';

/* ---------------------------------------------------------------- arguments */
const argv = process.argv.slice(2);
const bookDir = argv.find((a) => !a.startsWith('--'));
if (!bookDir) {
  console.error('Usage: node engine/tools/build-book.mjs books/<slug> [--edition <name>] [--out <file>]');
  process.exit(1);
}
const flag = (name) => {
  const i = argv.indexOf('--' + name);
  return i === -1 ? null : argv[i + 1];
};
const editionName = flag('edition');
const dir = path.resolve(bookDir);
const slug = path.basename(dir);

const die = (msg) => { console.error('\n' + msg + '\n'); process.exit(1); };

if (!fs.existsSync(dir)) die(`No such book folder: ${bookDir}`);
const jsonPath = path.join(dir, 'book.json');
if (!fs.existsSync(jsonPath)) die(`No book.json in ${bookDir}. Copy one from books/starter/.`);

let book;
try {
  book = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
} catch (e) {
  die(`book.json is not valid JSON:\n  ${e.message}`);
}

const interiorPath = path.join(dir, book.interior || `${slug}.html`);
if (!fs.existsSync(interiorPath))
  die(`No interior file at ${path.relative(process.cwd(), interiorPath)}.\n` +
      `That is the file holding your <section class="sheet bb"> pages.\n` +
      `Name it ${slug}.html, or set "interior" in book.json.`);

const outPath = path.resolve(flag('out') ||
  path.join(dir, editionName ? `book-${editionName}.html` : 'book.html'));

/* ------------------------------------------------------------------ helpers */
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const stripTags = (s) => String(s ?? '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const pad2 = (n) => String(n).padStart(2, '0');

/* -------------------------------------------- 1. split the interior into pages
   head = doctype .. <main class="deck">, then one chunk per page, then the tail. */
const html = fs.readFileSync(interiorPath, 'utf8');

/* Comments are blanked (same length, so every offset stays valid) before we look for
   pages: the file's own header comment shows the page markup as an example, and that
   must not be mistaken for a page. */
const scan = html.replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length));
const OPEN = /<section class="sheet bb[^"]*">/g;
const opens = [...scan.matchAll(OPEN)];
if (!opens.length)
  die(`No pages found in ${path.basename(interiorPath)}.\n` +
      `A page is: <section class="sheet bb"> ... </section>`);

const head = html.slice(0, opens[0].index);
const closeIdx = scan.lastIndexOf('</section>') + '</section>'.length;
const tail = html.slice(closeIdx);
const pageChunks = [];
for (let i = 0; i < opens.length; i++) {
  const start = opens[i].index;
  const end = i + 1 < opens.length ? opens[i + 1].index : closeIdx;
  pageChunks.push(html.slice(start, end).replace(/\s+$/, ''));
}

/* key every page by its title, so book.json can name them */
const pool = new Map();
for (const chunk of pageChunks) {
  const m = chunk.match(/<h1 class="title">([\s\S]*?)<\/h1>/);
  if (!m) die('A page has no <h1 class="title">. Every page needs one; it is how book.json finds it.');
  const key = stripTags(m[1]);
  if (pool.has(key)) die(`Two pages are both titled "${key}". Titles have to be unique.`);
  pool.set(key, chunk);
}

/* --------------------------------------------------- 2. resolve the running order */
if (!Array.isArray(book.parts) || !book.parts.length)
  die('book.json needs a "parts" array, even if it is one part holding every page.');

const edition = editionName ? (book.editions || {})[editionName] : null;
if (editionName && !edition)
  die(`book.json has no edition named "${editionName}".\n` +
      `Add one under "editions", listing the page titles it keeps.`);
const keep = edition ? new Set(edition) : null;

const missing = [];
const parts = [];
for (const p of book.parts) {
  const titles = (p.blocks || []).filter((t) => !keep || keep.has(t));
  for (const t of titles) if (!pool.has(t)) missing.push(t);
  if (titles.length) parts.push({ ...p, titles });
}
if (missing.length)
  die(`book.json lists pages that are not in ${path.basename(interiorPath)}:\n` +
      missing.map((t) => `  - ${t}`).join('\n') +
      `\n\nEither write them, or take them out of book.json.`);
if (!parts.length) die('Nothing to build: every part came out empty.');

if (keep) {
  const unknown = [...keep].filter((t) => !pool.has(t));
  if (unknown.length)
    die(`The "${editionName}" edition lists pages that do not exist:\n` +
        unknown.map((t) => `  - ${t}`).join('\n'));
}

const placed = new Set(parts.flatMap((p) => p.titles));
const orphans = [...pool.keys()].filter((t) => !placed.has(t));
if (orphans.length && !edition)
  console.log(`note: ${orphans.length} page(s) in the interior are not in any part, so they are not in the book: ` +
              orphans.join(', '));

const allTitles = parts.flatMap((p) => p.titles);

/* ------------------------------------------------------- 3. printed book data */
const B = {
  title: book.title || slug,
  subtitle: book.subtitle || '',
  author: book.author || '',
  series: book.series || book.title || slug,
  brand: book.brand || '',
  edition: book.editionLabel || 'Edition 1.0',
  numbered: book.numbered !== false,
  accent: book.accent || '#6366F1',
  accentStrong: book.accentStrong || '#4F46E5',
  wantContents: book.contents !== false,
  wantIndex: book.index !== false,
  unit: book.unit || 'blocks',            // what you call a page, in printed copy
  unitOne: book.unitSingular || (book.unit || 'blocks').replace(/s$/, ''),
};
const countWord = (n) => `${n} ${n === 1 ? B.unitOne : B.unit}`;
const coverCfg = book.cover || {};
const copyCfg = book.copyright || {};

/* ------------------------------------------------------ 4. page-number layout
   Count first, so the contents can print real numbers. Every sheet advances the
   counter; only the block pages print it. */
const TOC_MAX_ROWS = 25;              // rows that fit one contents sheet
const INDEX_MAX_PER_PAGE = 91;        // names that fit one index sheet (3 columns)

const partRows = (p) => p.titles.length + 1;   // a header row + one row per page
const tocBins = [];
if (B.wantContents) {
  let cur = [], rows = 0;
  for (const p of parts) {
    const r = partRows(p);
    if (cur.length && rows + r > TOC_MAX_ROWS) { tocBins.push(cur); cur = []; rows = 0; }
    cur.push(p); rows += r;
  }
  if (cur.length) tocBins.push(cur);
}
const contentsPages = tocBins.length;
const indexPages = B.wantIndex ? Math.max(1, Math.ceil(allTitles.length / INDEX_MAX_PER_PAGE)) : 0;

const wantInsideCover = book.insideCover === true;
const insideCoverPages = wantInsideCover ? 1 : 0;
const wantHowToRead = book.howToRead === true;
const howToReadPages = wantHowToRead ? 1 : 0;
const wantBackCover = book.backCover === true;
const backCoverPages = wantBackCover ? 1 : 0;
let pg = 2 + contentsPages + insideCoverPages + howToReadPages;           // cover + inside cover + copyright + contents + how to read
const pageOf = {}, partPageOf = new Map();
parts.forEach((p, i) => {
  pg += 1; partPageOf.set(i, pg);                       // the part divider
  for (const t of p.titles) { pg += 1; pageOf[t] = pg; }
});
const totalPages = pg + indexPages + backCoverPages;

/* --------------------------------------------------------- 5. generated pages */
const genFoot = (right) =>
  `<div class="gp-foot"><span>${esc(B.brand || B.series)}</span><span>${esc(right)}</span></div>`;

const coverSection = coverCfg.image ? `    <section class="sheet gp cover">
      <div class="in">
        <div class="cv-spectrum-bar" style="display:flex; gap:4px; height:6px; border-radius:99px; overflow:hidden; margin-bottom:12px;" aria-label="STEAM-IE 7-Letter Colour Spectrum">
          <div style="flex:1; background:#e61358;" title="Science"></div>
          <div style="flex:1; background:#ed7d1f;" title="Technology"></div>
          <div style="flex:1; background:#a0c82f;" title="Engineering"></div>
          <div style="flex:1; background:#32b5d3;" title="Arts"></div>
          <div style="flex:1; background:#b44b97;" title="Mathematics"></div>
          <div style="flex:1; background:#306a50;" title="Innovation"></div>
          <div style="flex:1; background:#5441ff;" title="Entrepreneurship"></div>
        </div>
        <div class="cv-kicker" style="color:#32b5d3; letter-spacing:0.22em; font-weight:600; text-transform:uppercase; font-size:12px;">${esc(coverCfg.kicker || 'STEAM-IE curriculum')}</div>
        <div class="cv-mid" style="justify-content:flex-start; margin-top:6px;">
          <figure class="cv-hero-img" style="margin:4px 0 14px 0; border-radius:14px; box-shadow:0 10px 30px rgba(26,26,46,0.08); overflow:hidden; border:1px solid #E7E9EF;">
            <img src="${esc(coverCfg.image)}" alt="${esc(B.title)} Cover Illustration" style="display:block; width:100%; max-height:350px; object-fit:cover;" />
          </figure>
          <h1 class="cv-title" style="margin:0; line-height:1.02;"><span style="color:#5441ff; font-weight:700;">STEAM-IE</span> <span style="color:#11291F; font-weight:700;">${esc(B.title.replace(/^STEAM-IE\s*/i, ''))}</span></h1>
          ${B.subtitle ? `<p class="cv-sub" style="color:#5B6472; font-size:19px; line-height:1.4; margin-top:10px;">${esc(B.subtitle)}</p>` : ''}
        </div>
        <div class="cv-bottom">
          <hr class="gp-rule" style="margin:12px 0;">
          <div class="cv-meta" style="display:flex; justify-content:space-between; align-items:flex-end;">
            <div>
              <div style="font-family:'Space Grotesk',sans-serif; font-size:16px; font-weight:700; color:#1A1A2E;">${esc(B.author)}</div>
              <div style="font-size:12.5px; color:#ed7d1f; font-weight:600; margin-top:2px;">Fad.Lab · ${esc(B.edition)}</div>
            </div>
            <span class="cv-count" style="color:#e61358; background:#FDF2F5; border:1px solid #FBCFE8; border-radius:99px; padding:6px 14px; font-size:13px; font-weight:600;">${esc(countWord(allTitles.length))}</span>
          </div>
          ${coverCfg.note ? `<p class="cv-note" style="color:#5B6472; font-size:12.5px; margin-top:8px;">${esc(coverCfg.note)}</p>` : ''}
        </div>
      </div>
    </section>` : `    <section class="sheet gp cover">
      <div class="in">
        <div class="gp-tab"></div>
        ${coverCfg.kicker ? `<div class="cv-kicker">${esc(coverCfg.kicker)}</div>` : ''}
        <div class="cv-mid">
          <h1 class="cv-title">${esc(B.title)}</h1>
          ${B.subtitle ? `<p class="cv-sub">${esc(B.subtitle)}</p>` : ''}
        </div>
        <div class="cv-bottom">
          <hr class="gp-rule">
          <div class="cv-meta">
            <span class="cv-author">${esc(B.author)}</span>
            <span class="cv-count">${esc(countWord(allTitles.length))}</span>
          </div>
          ${coverCfg.note ? `<p class="cv-note">${esc(coverCfg.note)}</p>` : ''}
        </div>
      </div>
    </section>`;

const copyrightLines = (copyCfg.lines || []).map((l) => `<p>${esc(l)}</p>`).join('\n          ');
const copyrightSection = `    <section class="sheet gp colophon">
      <div class="in">
        <div class="gp-tab"></div>
        <div class="cl-mid">
          <h2 class="cl-title">${esc(B.title)}</h2>
          ${B.subtitle ? `<p class="cl-sub">${esc(B.subtitle)}</p>` : ''}
          <hr class="gp-rule">
          <div class="cl-body">
            ${copyrightLines || ''}
            <p>${esc(copyCfg.rights || `© ${copyCfg.year || new Date().getFullYear()} ${B.author}. All rights reserved.`)}</p>
            <p>${esc(B.edition)}${B.brand ? ' · ' + esc(B.brand) : ''}</p>
          </div>
        </div>
        ${genFoot(B.edition)}
      </div>
    </section>`;

const sectionColors = ['#e61358', '#ed7d1f', '#a0c82f', '#32b5d3', '#b44b97', '#306a50', '#5441ff'];
const sectionBgColors = ['#FDF2F5', '#FFF7ED', '#F7FCE8', '#F0FBFD', '#FDF4FF', '#F0FDF4', '#F4F5FE'];

const dividerSection = (p, i) => {
  const col = sectionColors[i % sectionColors.length];
  const bgCol = sectionBgColors[i % sectionBgColors.length];
  const items = p.titles.map((t, n) =>
    `<li>${B.numbered ? `<span class="n">${pad2(n + 1)}</span>` : ''}<span class="nm">${esc(t)}</span></li>`).join('\n            ');
  return `    <section class="sheet gp divider">
      <div class="in">
        <div class="gp-top">
          <div class="gp-tab" style="background:${col};"></div>
          <span class="gp-pill" style="border:1.5px solid ${col}; color:${col}; background:${bgCol}; font-weight:700; padding:4px 14px; border-radius:99px;">Part ${i + 1} of ${parts.length}</span>
        </div>
        <div class="dv-mid">
          ${p.eyebrow ? `<div class="dv-eyebrow" style="color:${col}; font-weight:700; text-transform:uppercase; letter-spacing:0.15em; font-size:13px;">${esc(p.name)}</div>` : ''}
          <div class="dv-num" style="font-size:76px; font-weight:800; color:${col}; margin:6px 0; line-height:1; font-family:'Space Grotesk',sans-serif;">${esc(p.eyebrow || (i + 1))}</div>
          <h2 class="dv-name" style="color:${col}; font-family:'Space Grotesk',sans-serif; font-size:36px; font-weight:700; margin:0 0 10px 0;">${esc(p.name)}</h2>
          ${p.why ? `<p class="dv-why">${esc(p.why)}</p>` : ''}
          <hr class="gp-rule">
          <div class="dv-list-label">${esc(p.listLabel || 'In this part')}</div>
          <ol class="dv-list">
            ${items}
          </ol>
        </div>
        ${genFoot(B.edition)}
      </div>
    </section>`;
};

const tocPart = (p, i) => {
  const rows = p.titles.map((t) =>
    `<div class="toc-row"><span class="nm">${esc(t)}</span><span class="pg">${pageOf[t]}</span></div>`).join('\n            ');
  return `<div class="toc-part">
            <div class="toc-ph"><span class="pn">Part ${i + 1} · ${esc(p.name)}</span><span class="pg">${partPageOf.get(i)}</span></div>
            ${rows}
          </div>`;
};
const listPage = (cls, label, inner, withTitle) => `    <section class="sheet gp ${cls}">
      <div class="in">
        <div class="gp-top">
          <div class="gp-tab"></div>
          <span class="gp-pill">${esc(label)}</span>
        </div>
        ${withTitle
          ? `<h1 class="lp-title">${esc(label)}</h1>\n        <hr class="gp-rule">`
          : '<hr class="gp-rule" style="margin-top:15px">'}
        ${inner}
        ${genFoot(B.title)}
      </div>
    </section>`;

const contentsSections = tocBins.map((bin, i) =>
  listPage('toc', 'Contents',
    `<div class="toc-list">\n          ${bin.map((p) => tocPart(p, parts.indexOf(p))).join('\n          ')}\n        </div>`,
    i === 0));

const alpha = allTitles.slice().sort((a, b) =>
  a.toLowerCase() < b.toLowerCase() ? -1 : a.toLowerCase() > b.toLowerCase() ? 1 : 0);
const perIndexPage = indexPages ? Math.ceil(alpha.length / indexPages) : 0;
const indexSections = [];
for (let i = 0; i < indexPages; i++) {
  const rows = alpha.slice(i * perIndexPage, (i + 1) * perIndexPage)
    .map((t) => `<div class="idx-row"><span class="nm">${esc(t)}</span><span class="pg">${pageOf[t]}</span></div>`)
    .join('\n            ');
  indexSections.push(listPage('index', 'Index',
    `<div class="idx">\n            ${rows}\n          </div>`, i === 0));
}

/* ------------------------------------------------- 6. chrome on the book pages
   The interior stays neutral, so a page can move between parts (or books)
   without being rewritten. The eyebrow number and the running foot are stamped
   here, at assembly, from book.json. */
const stampPage = (section, partName, partEyebrow, nth) => {
  let s = section;
  const eyebrow = B.numbered
    ? `<b>${esc(B.series)}</b> · No. ${pad2(nth)}`
    : `<b>${esc(B.series)}</b>`;
  if (partEyebrow) {
    s = s.replace(/<section class="sheet bb([^"]*)"/, `<section class="sheet bb$1" data-section="${esc(partEyebrow)}"`);
  }
  s = s.replace(/(<div class="eyebrow">)[\s\S]*?(<\/div>)/, `$1${eyebrow}$2`);
  s = s.replace(/(<span class="brand">)[^<]*(<\/span>)/, `$1${esc(B.brand)}$2`);
  s = s.replace(/(<span class="series">)[^<]*(<\/span>)/, `$1${esc(partName)}$2`);
  return s;
};

/* ------------------------------------------------------------ 7. the stylesheet
   Injected inline so it wins over the linked theme (later in the cascade), and
   so a built book is one portable file. */
const genCss = `    /* ====================================================================
       GENERATED PAGES — cover, copyright, contents, part dividers, index.
       Written by engine/tools/build-book.mjs. Scoped .sheet.gp so it can never
       touch a book page (.sheet.bb).
       ==================================================================== */
    .sheet.gp{
      --ink:#1A1A2E; --muted:#5B6472; --line:#E7E9EF;
      --accent:${B.accent}; --accent-strong:${B.accentStrong};
      padding:0; background:#FAFAFC; color:var(--ink);
      font-family:"Inter",system-ui,sans-serif;
    }
    .gp .in{ position:absolute; inset:0; display:flex; flex-direction:column; padding:13mm 15mm; }
    .gp .in > *{ flex-shrink:0; }
    /* flex:none, not a basis: .in is a column and .gp-top is a row, and a basis
       would be read as height in one and width in the other. */
    .gp-tab{ width:56px; height:7px; flex:none; border-radius:99px; background:var(--accent); }
    .gp-top{ display:flex; justify-content:space-between; align-items:center; gap:14px; }
    .gp-pill{
      font-size:12px; font-weight:500; color:#4B5563; background:#F1F2F6;
      border:1px solid var(--line); padding:5px 13px; border-radius:99px; white-space:nowrap;
    }
    .gp-rule{ height:1px; flex:0 0 1px; background:var(--line); border:0; margin:15px 0; }
    .gp-foot{
      display:flex; justify-content:space-between; align-items:center;
      font-size:12.5px; color:var(--muted); margin-top:auto; padding-top:13px;
      border-top:1px solid var(--line);
    }

    /* ---- cover ---- */
    .gp.cover .cv-kicker{
      font-size:13px; font-weight:600; letter-spacing:.18em; text-transform:uppercase;
      color:var(--accent-strong); margin-top:20px;
    }
    .gp.cover .cv-mid{ flex:1; display:flex; flex-direction:column; justify-content:center; }
    .gp.cover .cv-title{
      font-family:"Space Grotesk",sans-serif; font-size:64px; font-weight:700;
      line-height:1.02; letter-spacing:-.03em; margin:0; color:var(--ink);
    }
    .gp.cover .cv-sub{ font-size:22px; line-height:1.4; color:var(--muted); margin:18px 0 0; max-width:22em; }
    .gp.cover .cv-meta{ display:flex; justify-content:space-between; align-items:baseline; }
    .gp.cover .cv-author{ font-family:"Space Grotesk",sans-serif; font-size:19px; font-weight:600; color:var(--ink); }
    .gp.cover .cv-count{ font-size:14px; color:var(--muted); font-variant-numeric:tabular-nums; }
    .gp.cover .cv-note{ font-size:13.5px; color:var(--muted); margin:12px 0 0; }

    /* ---- copyright ---- */
    .gp.colophon .cl-mid{ flex:1; display:flex; flex-direction:column; justify-content:flex-end; }
    .gp.colophon .cl-title{ font-family:"Space Grotesk",sans-serif; font-size:27px; font-weight:600; letter-spacing:-.02em; margin:0; }
    .gp.colophon .cl-sub{ font-size:16px; color:var(--muted); margin:5px 0 0; }
    .gp.colophon .cl-body p{ font-size:13.5px; line-height:1.6; color:var(--muted); margin:0 0 8px; }

    /* ---- part divider ---- */
    .gp.divider .dv-mid{ flex:1; display:flex; flex-direction:column; justify-content:center; }
    .gp.divider .dv-eyebrow{
      font-size:12.5px; font-weight:600; letter-spacing:.18em; text-transform:uppercase;
      color:var(--accent-strong); margin:0;
    }
    .gp.divider .dv-num{
      font-family:"Space Grotesk",sans-serif; font-weight:700; font-size:78px;
      line-height:.92; letter-spacing:-.03em; color:var(--ink); margin:4px 0 0;
    }
    .gp.divider .dv-name{
      font-family:"Space Grotesk",sans-serif; font-weight:700; font-size:40px;
      line-height:1.05; letter-spacing:-.02em; color:var(--ink); margin:12px 0 0;
    }
    .gp.divider .dv-why{ font-size:17px; line-height:1.5; color:var(--muted); margin:12px 0 0; max-width:30em; }
    .gp.divider .dv-list-label{
      font-size:11.5px; font-weight:600; letter-spacing:.16em; text-transform:uppercase;
      color:var(--muted); margin:0 0 12px;
    }
    .gp.divider .dv-list{
      list-style:none; margin:0; padding:0;
      display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:9px 30px;
    }
    .gp.divider .dv-list li{ display:flex; align-items:baseline; gap:10px; }
    .gp.divider .dv-list .n{
      font-family:"Space Grotesk",sans-serif; font-weight:600; font-size:13px;
      color:var(--accent); font-variant-numeric:tabular-nums; min-width:1.6em;
    }
    .gp.divider .dv-list .nm{ font-size:15px; color:var(--ink); }

    /* ---- contents + index ---- */
    .gp .lp-title{ font-family:"Space Grotesk",sans-serif; font-size:30px; font-weight:600; letter-spacing:-.02em; margin:11px 0 0; }
    .gp.toc .toc-part{ margin-top:14px; }
    .gp.toc .toc-part:first-child{ margin-top:2px; }
    .gp.toc .toc-ph{ display:flex; align-items:baseline; gap:10px; line-height:1.4; }
    .gp.toc .toc-ph .pn{ flex:1; font-family:"Space Grotesk",sans-serif; font-size:14.5px; font-weight:600; color:var(--ink); }
    .gp.toc .toc-row{ display:flex; align-items:baseline; gap:12px; margin-top:6px; padding-left:3px; line-height:1.4; }
    .gp.toc .toc-row .nm{ flex:1; font-size:13.5px; color:var(--ink); }
    .gp .pg{ font-variant-numeric:tabular-nums; font-size:13px; color:var(--muted); }
    .gp.index .idx{ margin-top:4px; column-count:3; column-gap:22px; }
    .gp.index .idx-row{
      display:flex; align-items:baseline; gap:10px; break-inside:avoid;
      padding:2px 1px; border-bottom:1px solid #EFF1F5;
    }
    .gp.index .idx-row .nm{ flex:1; font-size:12px; color:var(--ink); }
    .gp.index .idx-row .pg{ font-size:12px; }

    /* ====================================================================
       ONE PAGE COUNTER for the whole book. Every sheet advances it; only the
       book pages print it, so a printed number is the real page in the PDF.
       Overrides the theme's page-only counter (inline wins over linked).
       ==================================================================== */
    .deck{ counter-reset:pageno; }
    .sheet.gp, .sheet.bb{ counter-increment:pageno; }
    .bb .foot .pg::before{ content:counter(pageno); }`;

const backCoverSection = `    <section class="sheet gp back-cover">
      <div class="in" style="display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <div class="cv-spectrum-bar" style="display:flex; gap:4px; height:6px; border-radius:99px; overflow:hidden; margin-bottom:14px;" aria-label="STEAM-IE 7-Letter Colour Spectrum">
            <div style="flex:1; background:#e61358;" title="Science"></div>
            <div style="flex:1; background:#ed7d1f;" title="Technology"></div>
            <div style="flex:1; background:#a0c82f;" title="Engineering"></div>
            <div style="flex:1; background:#32b5d3;" title="Arts"></div>
            <div style="flex:1; background:#b44b97;" title="Mathematics"></div>
            <div style="flex:1; background:#306a50;" title="Innovation"></div>
            <div style="flex:1; background:#5441ff;" title="Entrepreneurship"></div>
          </div>
          
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <span style="font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:600; color:#5B6472; letter-spacing:0.18em; text-transform:uppercase;">AG-TECH · URBAN AGRICULTURE · STEAM-IE</span>
            <span style="background:#F4F5FE; border:1px solid #DDE0FB; color:#5441ff; font-family:'Space Grotesk',sans-serif; font-size:11px; font-weight:700; padding:3px 10px; border-radius:99px;">FIELD MANUAL</span>
          </div>

          <h2 style="font-family:'Space Grotesk',sans-serif; font-size:20px; font-weight:700; line-height:1.25; color:#1A1A2E; margin:0 0 10px 0;">
            <span style="color:#5441ff;">Build a High-Yield</span> Greenhouse in Addis Ababa — Without Guesswork or Wasted Capital.
          </h2>

          <p style="font-size:13.5px; line-height:1.55; color:#4A5568; margin:0 0 16px 0;">
            Grounded in the 7 letters of STEAM-IE, this field manual strips away theoretical fluff to give you ${allTitles.length} single-concept visual guides. From water chemistry to local Merkato sourcing, every page equips you with exact blueprints, calculations, and daily actions to grow fresh greens year-round.
          </p>

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:12px;">
            <div style="background:#FDF2F5; border:1px solid #FBCFE8; border-radius:8px; padding:8px 10px;">
              <div style="font-family:'Space Grotesk',sans-serif; font-size:11.5px; font-weight:700; color:#e61358; margin-bottom:2px;">🧪 Science of Growth</div>
              <div style="font-size:11px; line-height:1.35; color:#4A5568;">Master dissolved oxygen, pH buffers, and root nutrient uptake.</div>
            </div>
            <div style="background:#FFF7ED; border:1px solid #FFEDD5; border-radius:8px; padding:8px 10px;">
              <div style="font-family:'Space Grotesk',sans-serif; font-size:11.5px; font-weight:700; color:#ed7d1f; margin-bottom:2px;">⚙️ Merkato Sourcing</div>
              <div style="font-size:11px; line-height:1.35; color:#4A5568;">Source local pumps, PVC channels, and sensors in Addis Ababa.</div>
            </div>
            <div style="background:#FDF4FF; border:1px solid #F5D0FE; border-radius:8px; padding:8px 10px;">
              <div style="font-family:'Space Grotesk',sans-serif; font-size:11.5px; font-weight:700; color:#b44b97; margin-bottom:2px;">📊 Business Economics</div>
              <div style="font-size:11px; line-height:1.35; color:#4A5568;">Calculate exact cost per plant, yield density, and break-even.</div>
            </div>
            <div style="background:#F4F5FE; border:1px solid #DDE0FB; border-radius:8px; padding:8px 10px;">
              <div style="font-family:'Space Grotesk',sans-serif; font-size:11.5px; font-weight:700; color:#5441ff; margin-bottom:2px;">🚀 Market Execution</div>
              <div style="font-size:11px; line-height:1.35; color:#4A5568;">Package, price, and sell hydroponic produce to Addis buyers.</div>
            </div>
          </div>

          <!-- Two Side-by-Side Image Placeholders (Left & Right) -->
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:14px; margin-bottom:14px;">
            <figure style="margin:0; border-radius:10px; border:2px dashed #CBD5E1; background:#F8FAFC; height:270px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:10px; overflow:hidden;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:6px;">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <div style="font-family:'Space Grotesk',sans-serif; font-size:12px; font-weight:700; color:#475569;">Left Photo / Diagram</div>
              <div style="font-family:'JetBrains Mono',monospace; font-size:10px; color:#64748B; margin-top:4px;">270 × 270 px</div>
            </figure>

            <figure style="margin:0; border-radius:10px; border:2px dashed #CBD5E1; background:#F8FAFC; height:270px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:10px; overflow:hidden;">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:6px;">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <div style="font-family:'Space Grotesk',sans-serif; font-size:12px; font-weight:700; color:#475569;">Right Photo / Harvest</div>
              <div style="font-family:'JetBrains Mono',monospace; font-size:10px; color:#64748B; margin-top:4px;">270 × 270 px</div>
            </figure>
          </div>
        </div>

        <div>
          <hr class="gp-rule" style="margin:0 0 14px 0;">
          
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:14px; background:#F8FAFC; border:1px solid #E2E8F0; border-radius:10px; padding:10px 14px;">
            <div style="width:38px; height:38px; border-radius:50%; background:#5441ff; color:#FFF; display:flex; align-items:center; justify-content:center; font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:16px; flex-shrink:0;">
              FD
            </div>
            <div>
              <div style="font-family:'Space Grotesk',sans-serif; font-size:13.5px; font-weight:700; color:#1A1A2E;">${esc(B.author)}</div>
              <div style="font-size:11.5px; color:#5B6472; line-height:1.35;">Founder of Fad.Lab · Pioneering practical STEAM-IE education & urban ag-tech in Ethiopia.</div>
            </div>
          </div>

          <div style="display:flex; justify-content:space-between; align-items:flex-end;">
            <div>
              <div style="font-family:'Space Grotesk',sans-serif; font-size:14px; font-weight:700; color:#1A1A2E; letter-spacing:-0.01em;">FAD.LAB PUBLISHING</div>
              <div style="font-size:11.5px; color:#5B6472; margin-top:2px;">${esc(B.edition)} · Addis Ababa, Ethiopia</div>
              <div style="font-size:11px; color:#5441ff; font-weight:600; margin-top:3px;">github.com/hassancs91/paper-engine</div>
            </div>

            <div style="background:#FFF; border:1px solid #CBD5E1; border-radius:6px; padding:6px 10px; text-align:center;">
              <svg width="108" height="32" viewBox="0 0 108 32" xmlns="http://www.w3.org/2000/svg">
                <rect x="0" y="0" width="2" height="26" fill="#1A1A2E"/>
                <rect x="3" y="0" width="1" height="26" fill="#1A1A2E"/>
                <rect x="6" y="0" width="2" height="26" fill="#1A1A2E"/>
                <rect x="10" y="0" width="3" height="26" fill="#1A1A2E"/>
                <rect x="15" y="0" width="1" height="26" fill="#1A1A2E"/>
                <rect x="18" y="0" width="2" height="26" fill="#1A1A2E"/>
                <rect x="22" y="0" width="1" height="26" fill="#1A1A2E"/>
                <rect x="25" y="0" width="3" height="26" fill="#1A1A2E"/>
                <rect x="30" y="0" width="2" height="26" fill="#1A1A2E"/>
                <rect x="34" y="0" width="1" height="26" fill="#1A1A2E"/>
                <rect x="37" y="0" width="2" height="26" fill="#1A1A2E"/>
                <rect x="41" y="0" width="1" height="26" fill="#1A1A2E"/>
                <rect x="44" y="0" width="3" height="26" fill="#1A1A2E"/>
                <rect x="49" y="0" width="2" height="26" fill="#1A1A2E"/>
                <rect x="53" y="0" width="1" height="26" fill="#1A1A2E"/>
                <rect x="56" y="0" width="2" height="26" fill="#1A1A2E"/>
                <rect x="60" y="0" width="3" height="26" fill="#1A1A2E"/>
                <rect x="65" y="0" width="1" height="26" fill="#1A1A2E"/>
                <rect x="68" y="0" width="2" height="26" fill="#1A1A2E"/>
                <rect x="72" y="0" width="1" height="26" fill="#1A1A2E"/>
                <rect x="75" y="0" width="3" height="26" fill="#1A1A2E"/>
                <rect x="80" y="0" width="2" height="26" fill="#1A1A2E"/>
                <rect x="84" y="0" width="1" height="26" fill="#1A1A2E"/>
                <rect x="87" y="0" width="2" height="26" fill="#1A1A2E"/>
                <rect x="91" y="0" width="1" height="26" fill="#1A1A2E"/>
                <rect x="94" y="0" width="3" height="26" fill="#1A1A2E"/>
                <rect x="99" y="0" width="2" height="26" fill="#1A1A2E"/>
                <rect x="103" y="0" width="1" height="26" fill="#1A1A2E"/>
                <rect x="106" y="0" width="2" height="26" fill="#1A1A2E"/>
              </svg>
              <div style="font-family:'JetBrains Mono',monospace; font-size:8.5px; font-weight:600; color:#1A1A2E; margin-top:2px;">ISBN 978-99944-0-001-7</div>
            </div>
          </div>
        </div>
      </div>
    </section>`;

const insideCoverSection = backCoverSection.replace('sheet gp back-cover', 'sheet gp inside-cover');

const howToReadSection = `    <section class="sheet gp how-to-read">
      <div class="in" style="display:flex; flex-direction:column; justify-content:space-between;">
        <div>
          <div class="cv-spectrum-bar" style="display:flex; gap:4px; height:6px; border-radius:99px; overflow:hidden; margin-bottom:12px;" aria-label="STEAM-IE 7-Letter Colour Spectrum">
            <div style="flex:1; background:#e61358;" title="Science"></div>
            <div style="flex:1; background:#ed7d1f;" title="Technology"></div>
            <div style="flex:1; background:#a0c82f;" title="Engineering"></div>
            <div style="flex:1; background:#32b5d3;" title="Arts"></div>
            <div style="flex:1; background:#b44b97;" title="Mathematics"></div>
            <div style="flex:1; background:#306a50;" title="Innovation"></div>
            <div style="flex:1; background:#5441ff;" title="Entrepreneurship"></div>
          </div>
          
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-family:'JetBrains Mono',monospace; font-size:11px; font-weight:600; color:#5B6472; letter-spacing:0.18em; text-transform:uppercase;">ORIENTATION GUIDE · STEAM-IE METHODOLOGY</span>
            <span style="background:#F4F5FE; border:1px solid #DDE0FB; color:#5441ff; font-family:'Space Grotesk',sans-serif; font-size:11px; font-weight:700; padding:3px 10px; border-radius:99px;">READING GUIDE</span>
          </div>

          <h1 style="font-family:'Space Grotesk',sans-serif; font-size:26px; font-weight:700; line-height:1.15; color:#1A1A2E; margin:0 0 4px 0;">
            How to Read This Book
          </h1>
          <p style="font-size:13px; color:#5B6472; margin:0 0 10px 0;">
            Every page in this field manual is a single, actionable visual block.
          </p>

          <div style="background:#F8FAFC; border:1px solid #E2E8F0; border-radius:8px; padding:8px 12px; margin-bottom:10px;">
            <div style="font-size:12px; line-height:1.45; color:#475569;">
              <strong style="color:#1A1A2E;">1. Single-Concept Blocks:</strong> One idea per page with an inline diagram and a concrete daily action step.<br/>
              <strong style="color:#1A1A2E;">2. Sequential Build:</strong> Read in letter order. Science feeds the tech, which drives the engineering, math, and sales.
            </div>
          </div>

          <div style="font-family:'Space Grotesk',sans-serif; font-size:12.5px; font-weight:700; color:#1A1A2E; margin-bottom:8px; display:flex; align-items:center; gap:6px;">
            <span>🔄 The 7-Letter Learning Pathway</span>
          </div>

          <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin-bottom:10px;">
            <div style="background:#FDF2F5; border:1px solid #FBCFE8; border-radius:8px; padding:7px 9px;">
              <div style="font-family:'Space Grotesk',sans-serif; font-size:11.5px; font-weight:700; color:#e61358; margin-bottom:2px;">🧪 S · Science ➔</div>
              <div style="font-size:10px; line-height:1.25; color:#4A5568;">Natural principles: plant biology, nutrient chemistry & root oxygenation.</div>
            </div>
            <div style="background:#FFF7ED; border:1px solid #FFEDD5; border-radius:8px; padding:7px 9px;">
              <div style="font-family:'Space Grotesk',sans-serif; font-size:11.5px; font-weight:700; color:#ed7d1f; margin-bottom:2px;">⚙️ T · Tech ➔</div>
              <div style="font-size:10px; line-height:1.25; color:#4A5568;">Control tools: meters, pumps & sensors for monitoring growth environment.</div>
            </div>
            <div style="background:#F7FCE8; border:1px solid #E4F5B2; border-radius:8px; padding:7px 9px;">
              <div style="font-family:'Space Grotesk',sans-serif; font-size:11.5px; font-weight:700; color:#a0c82f; margin-bottom:2px;">📐 E · Engineering ➔</div>
              <div style="font-size:10px; line-height:1.25; color:#4A5568;">Structural design: frames, channel slopes & plumbing systems.</div>
            </div>
            <div style="background:#F0FBFD; border:1px solid #BAE6F7; border-radius:8px; padding:7px 9px;">
              <div style="font-family:'Space Grotesk',sans-serif; font-size:11.5px; font-weight:700; color:#32b5d3; margin-bottom:2px;">🎨 A · Arts ➔</div>
              <div style="font-size:10px; line-height:1.25; color:#4A5568;">Spatial & visual design: greenhouse flow, ergonomics & product branding.</div>
            </div>
            <div style="background:#FDF4FF; border:1px solid #F5D0FE; border-radius:8px; padding:7px 9px;">
              <div style="font-family:'Space Grotesk',sans-serif; font-size:11.5px; font-weight:700; color:#b44b97; margin-bottom:2px;">📊 M · Math ➔</div>
              <div style="font-size:10px; line-height:1.25; color:#4A5568;">Quantitative metrics: flow rates, PPM ratios, spacing & unit economics.</div>
            </div>
            <div style="background:#F0FDF4; border:1px solid #BBF7D0; border-radius:8px; padding:7px 9px;">
              <div style="font-family:'Space Grotesk',sans-serif; font-size:11.5px; font-weight:700; color:#306a50; margin-bottom:2px;">💡 I · Innovation ➔</div>
              <div style="font-size:10px; line-height:1.25; color:#4A5568;">Creative problem solving: local material swaps & sustainable hacks.</div>
            </div>
          </div>
          
          <div style="background:#F4F5FE; border:1px solid #DDE0FB; border-radius:8px; padding:7px 10px; margin-bottom:10px;">
            <div style="font-family:'Space Grotesk',sans-serif; font-size:11.5px; font-weight:700; color:#5441ff;">🚀 IE · Entrepreneurship: Enterprise & Market Viability</div>
            <div style="font-size:10px; line-height:1.25; color:#4A5568; margin-top:2px;">Turning harvests into sustainable value: market pricing, buyer contracts & cash flow.</div>
          </div>
        </div>

        <div>
          <hr class="gp-rule" style="margin:0 0 10px 0;">
          
          <div style="background:#FFF; border:1px solid #CBD5E1; border-radius:8px; padding:8px 12px;">
            <div style="font-family:'Space Grotesk',sans-serif; font-size:11.5px; font-weight:700; color:#1A1A2E; margin-bottom:4px; display:flex; justify-content:space-between;">
              <span>📖 Key Abbreviations & Acronyms</span>
              <span style="font-size:10px; font-weight:600; color:#5B6472;">QUICK REFERENCE</span>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px 12px; font-size:10.5px; line-height:1.35; color:#475569;">
              <div><strong style="color:#1A1A2E;">pH:</strong> Potential of Hydrogen (Target: 5.5 – 6.5)</div>
              <div><strong style="color:#1A1A2E;">NFT:</strong> Nutrient Film Technique (Shallow channel)</div>
              <div><strong style="color:#1A1A2E;">EC:</strong> Electrical Conductivity (Ion strength mS/cm)</div>
              <div><strong style="color:#1A1A2E;">LED:</strong> Light Emitting Diode (Grow light fixtures)</div>
              <div><strong style="color:#1A1A2E;">DO:</strong> Dissolved Oxygen (Root oxygen in PPM)</div>
              <div><strong style="color:#1A1A2E;">PVC:</strong> Polyvinyl Chloride (Rigid Merkato piping)</div>
              <div><strong style="color:#1A1A2E;">IBC:</strong> Intermediate Bulk Container (1,000 L tank)</div>
              <div><strong style="color:#1A1A2E;">PPM:</strong> Parts Per Million (Mineral ion density)</div>
            </div>
          </div>
          
          <div style="margin-top:8px;">
            ${genFoot(B.edition)}
          </div>
        </div>
      </div>
    </section>`;

/* ------------------------------------------------------------- 8. assemble */
const out = [coverSection];
if (wantInsideCover) {
  out.push(insideCoverSection);
}
out.push(copyrightSection, ...contentsSections);
if (wantHowToRead) {
  out.push(howToReadSection);
}
let nth = 0;   // the printed No. runs through the whole book, not per part
parts.forEach((p, i) => {
  out.push(dividerSection(p, i));
  p.titles.forEach((t) => out.push(stampPage(pool.get(t), p.name, p.eyebrow, ++nth)));
});
out.push(...indexSections);
if (wantBackCover) {
  out.push(backCoverSection);
}

if (out.length !== totalPages)
  die(`Internal error: assembled ${out.length} pages but computed ${totalPages}.\n` +
      `Page numbers in the contents would be wrong, so nothing was written.`);

const injectedHead = head.replace('</head>', `  <style>\n${genCss}\n  </style>\n</head>`);
const bookTitle = editionName ? `${B.title} — ${editionName} edition` : B.title;
const merged = (injectedHead + out.join('\n\n') + '\n' + tail)
  .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(bookTitle)}</title>`)
  .split('{{COUNT}}').join(String(allTitles.length));

fs.writeFileSync(outPath, merged);

const rel = path.relative(process.cwd(), outPath).replace(/\\/g, '/');
console.log(`wrote ${out.length} pages to ${rel}`);
console.log(`  ${countWord(allTitles.length)} in ${parts.length} part${parts.length > 1 ? 's' : ''}` +
            `, cover + copyright` +
            (contentsPages ? ` + contents×${contentsPages}` : '') +
            (indexPages ? ` + index×${indexPages}` : '') +
            (editionName ? `  [${editionName} edition]` : ''));
console.log(`\nNext: node engine/tools/check.mjs ${rel}`);
