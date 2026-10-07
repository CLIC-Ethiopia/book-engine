/*
  book-assets.mjs  -  generate images for a book, manage prompts, and validate assets
  --------------------------------------------------------------------------
  CLI:
    node engine/tools/book-assets.mjs books/<slug> [--generate] [--check] [--report]

  Reads:
    books/<slug>/.work/idea-manifest.json
    books/<slug>/images/*.txt

  Writes:
    books/<slug>/images/<name>.png (if --generate)
    books/<slug>/images/<name>.txt (prompts)

  Reports:
    books/<slug>/.work/asset-report.json
*/

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import prompts from 'prompts';
import { fail, sanitizeFilename } from './shared.mjs';
import { classifyImage } from './image-classifier.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

function enhancePrompt(prompt, title) {
  return `
${prompt}

Style guidelines:
- No text in the image.
- No logos or brands.
- Soft daylight, front angle, plain neutral background.
- Consistent book style: clear, clean, professional, modern layout style.
- Subject: ${title}
`.trim();
}

function writePromptFile(imagesDir, title, prompt) {
  const promptFile = path.join(imagesDir, `${sanitizeFilename(title)}.txt`);
  fs.writeFileSync(promptFile, enhancePrompt(prompt, title), 'utf8');
  return promptFile;
}

function generateImage(imagesDir, title, promptFile, provider = 'agy', aspect = '3:2') {
  const outPath = path.join(imagesDir, `${sanitizeFilename(title)}.png`);
  const args = [
    path.join(PROJECT_ROOT, 'engine', 'tools', 'gen-image.mjs'),
    '--prompt-file', promptFile,
    outPath,
    '--aspect', aspect,
    '--provider', provider,
  ];
  const child = spawn('node', args, { cwd: PROJECT_ROOT, stdio: 'inherit' });
  return new Promise((resolve, reject) => {
    child.on('close', (code) => {
      if (code === 0) resolve(outPath);
      else reject(new Error(`gen-image exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

async function classifyAll(manifest, imagesDir, auto = false) {
  const classifications = [];
  for (const page of manifest.pages) {
    const currentType = classifyImage(page.imagePrompt);
    if (auto) {
      classifications.push({ title: page.title, type: currentType });
      continue;
    }
    const answer = await prompts({
      type: 'select',
      name: 'type',
      message: `Page ${page.no}: ${page.title}`,
      choices: [
        { title: `Photo (physical subject) — auto-detected: ${currentType}`, value: 'photo' },
        { title: 'Diagram (mechanism/process) — auto-detected: ' + currentType, value: 'diagram' },
      ],
      initial: currentType === 'photo' ? 0 : 1,
    });
    classifications.push({ title: page.title, type: answer.type || currentType });
  }
  return classifications;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node engine/tools/book-assets.mjs books/<slug> [--generate] [--check] [--report]');
    process.exit(0);
  }

  const bookPath = args[0];
  const generate = args.includes('--generate');
  const checkOnly = args.includes('--check');
  const reportOnly = args.includes('--report');

  if (!bookPath) fail('Missing book path. Usage: node engine/tools/book-assets.mjs books/<slug>');

  const slug = path.basename(path.resolve(bookPath));
  const manifestPath = path.join(bookPath, '.work', 'idea-manifest.json');
  const imagesDir = path.join(bookPath, 'images');
  const reportPath = path.join(bookPath, '.work', 'asset-report.json');

  if (!fs.existsSync(manifestPath)) {
    fail(`Manifest not found at ${manifestPath}. Run idea-parser first.`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

  if (checkOnly) {
    console.log(`\n=== Checking assets for ${slug} ===`);
    let errors = 0;
    const classifications = await classifyAll(manifest, imagesDir, true);
    for (const page of manifest.pages) {
      const classification = classifications.find(c => c.title === page.title);
      const isPhoto = classification && classification.type === 'photo';
      if (!isPhoto) continue; // Only check photos since diagrams are SVG inline

      const safeName = sanitizeFilename(page.title);
      const imgPath = path.join(imagesDir, `${safeName}.png`);
      const txtPath = path.join(imagesDir, `${safeName}.txt`);
      
      if (!fs.existsSync(txtPath)) {
        console.error(`  ✗ Missing prompt file: ${safeName}.txt`);
        errors++;
      }
      
      if (!fs.existsSync(imgPath)) {
        console.error(`  ✗ Missing image file: ${safeName}.png`);
        errors++;
      } else {
        const stats = fs.statSync(imgPath);
        if (stats.size === 0) {
          console.error(`  ✗ Blank image file: ${safeName}.png`);
          errors++;
        }
        // Basic check for valid png signature
        const fd = fs.openSync(imgPath, 'r');
        const buffer = Buffer.alloc(8);
        fs.readSync(fd, buffer, 0, 8, 0);
        fs.closeSync(fd);
        if (buffer.toString('hex') !== '89504e470d0a1a0a') {
          console.error(`  ✗ Invalid PNG signature: ${safeName}.png`);
          errors++;
        }
      }
    }
    if (errors > 0) {
      fail(`${errors} asset errors found.`);
    } else {
      console.log('✅ All assets are present and valid.');
      process.exit(0);
    }
  }

  // Write all prompt files first
  manifest.pages.forEach((page) => {
    if (page.imagePrompt) {
      writePromptFile(imagesDir, page.title, page.imagePrompt);
    }
  });

  // Classify images
  const classifications = await classifyAll(manifest, imagesDir);

  // Generate images if requested
  const generated = [];
  if (generate) {
    for (const page of manifest.pages) {
      const classification = classifications.find((c) => c.title === page.title);
      if (classification && classification.type === 'photo') {
        const promptFile = path.join(imagesDir, `${sanitizeFilename(page.title)}.txt`);
        try {
          const outPath = await generateImage(imagesDir, page.title, promptFile);
          generated.push({ title: page.title, path: outPath, type: 'photo' });
          console.log(`  ✓ ${page.title}`);
        } catch (error) {
          console.error(`  ✗ ${page.title}: ${error.message}`);
        }
      } else {
        console.log(`  - ${page.title}: diagram (skipped)`);
      }
    }
  }

  // Write asset report
  const report = {
    slug,
    generatedAt: new Date().toISOString(),
    pages: manifest.totalPages,
    classifications,
    generated: generated,
    totalImages: generated.length,
    totalDiagrams: classifications.filter((c) => c.type === 'diagram').length,
  };
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

  console.log(`\n✅ Asset report written to ${reportPath}`);
  console.log(`   Photos: ${report.totalImages}`);
  console.log(`   Diagrams: ${report.totalDiagrams}`);
  console.log(`   Total pages: ${report.pages}`);
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => fail(error.message || String(error)));
}

export { classifyImage, enhancePrompt, writePromptFile, generateImage, classifyAll };