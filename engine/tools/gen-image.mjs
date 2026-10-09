/* ==========================================================================
   gen-image.mjs  -  Universal Agent-Native Image Generation Engine
   --------------------------------------------------------------------------
   Multi-provider photorealistic image synthesizer with automatic tier fallback:
     Tier 1: Free Gemini API (GEMINI_API_KEY from .env) until quota limit
     Tier 2: Pollinations.ai (With optional POLLINATIONS_API_KEY or keyless)
     Tier 3: B5 SVG Photo Placeholder Fallback (Zero overflow, studio theme)

   Usage:
     node engine/tools/gen-image.mjs "<prompt>" out.png [--height 180] [--aspect 3.3:1]
     node engine/tools/gen-image.mjs --check
   ========================================================================== */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '../..');

/* ------------------------------------------------------------- .env Loader */
export function loadEnv(envPath) {
  const target = envPath || path.join(PROJECT_ROOT, '.env');
  try {
    if (!fs.existsSync(target)) return;
    const content = fs.readFileSync(target, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!match || process.env[match[1]]) continue;
      let val = match[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[match[1]] = val;
    }
  } catch {
    /* ignore missing env */
  }
}
loadEnv();

/* -------------------------------------------------------- Tier 1: Gemini API */
export async function generateGemini(prompt, outPath, options = {}) {
  const apiKey = options.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) return false;

  const model = options.model || 'gemini-2.5-flash-image';
  const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
  const aspect = options.aspect || '16:9';

  try {
    const res = await fetch(`${BASE}/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ['TEXT', 'IMAGE'],
          imageConfig: { aspectRatio: aspect },
        },
      }),
    });

    if (res.status === 429) {
      console.log('  [Gemini API] Quota exhausted / 429 rate limit. Falling back to Pollinations.ai...');
      return false;
    }

    if (!res.ok) {
      const errText = await res.text();
      console.log(`  [Gemini API] Request failed (${res.status}): ${errText.substring(0, 150)}`);
      return false;
    }

    const json = await res.json();
    const b64 = (json?.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data)?.inlineData?.data;

    if (!b64) {
      console.log('  [Gemini API] No image data returned. Falling back...');
      return false;
    }

    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    fs.writeFileSync(outPath, Buffer.from(b64, 'base64'));
    return true;
  } catch (err) {
    console.log(`  [Gemini API] Error: ${err.message}`);
    return false;
  }
}

/* -------------------------------------------------- Tier 2: Pollinations.ai */
export async function generatePollinations(prompt, outPath, options = {}) {
  const apiKey = options.apiKey || process.env.POLLINATIONS_API_KEY;
  const width = options.width || 800;
  const height = options.height || 240;
  const seed = Math.floor(Math.random() * 100000);

  const cleanPrompt = encodeURIComponent(prompt.trim());
  let url = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=${width}&height=${height}&nologo=true&seed=${seed}&model=flux`;

  if (apiKey) {
    url += `&token=${encodeURIComponent(apiKey)}`;
  }

  try {
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      console.log(`  [Pollinations] Request failed (${res.status}). Falling back to B5 SVG placeholder...`);
      return false;
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length < 100) {
      console.log('  [Pollinations] Returned image buffer is corrupt/empty. Falling back...');
      return false;
    }

    fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
    fs.writeFileSync(outPath, buffer);
    return true;
  } catch (err) {
    console.log(`  [Pollinations] Error: ${err.message}`);
    return false;
  }
}

/* ------------------------------------------- Tier 3: B5 Photo SVG Fallback */
export function generatePhotoFallbackSVG(prompt, outPath, options = {}) {
  const width = options.width || 592;
  const height = options.height || 180;
  const title = options.title || 'Physical Subject Photo';
  const cleanPrompt = (prompt || title).replace(/</g, '&lt;').replace(/>/g, '&gt;').substring(0, 80);

  const svgContent = `<svg width="100%" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${cleanPrompt}">
  <defs>
    <linearGradient id="photoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#F8FAFC;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#E2E8F0;stop-opacity:1" />
    </linearGradient>
    <filter id="photoShadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#1A1A2E" flood-opacity="0.08"/>
    </filter>
  </defs>
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="8" fill="url(#photoGrad)" stroke="#CBD2DC" stroke-width="1.5" filter="url(#photoShadow)"/>
  <circle cx="${width / 2}" cy="${height / 2 - 18}" r="22" fill="#EEF0FE" stroke="#6366F1" stroke-width="1.5"/>
  <path d="M ${width / 2 - 10} ${height / 2 - 14} L ${width / 2 + 10} ${height / 2 - 14} L ${width / 2 + 7} ${height / 2 - 24} L ${width / 2 - 7} ${height / 2 - 24} Z" fill="#6366F1"/>
  <circle cx="${width / 2}" cy="${height / 2 - 14}" r="5" fill="#FFFFFF"/>
  <text x="${width / 2}" y="${height / 2 + 18}" text-anchor="middle" style="font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:600;fill:#1A1A2E">PHYSICAL SUBJECT PHOTOGRAPH</text>
  <text x="${width / 2}" y="${height / 2 + 36}" text-anchor="middle" style="font-family:'Inter',sans-serif;font-size:11px;fill:#5B6472">${cleanPrompt}</text>
</svg>`;

  fs.mkdirSync(path.dirname(path.resolve(outPath)), { recursive: true });
  fs.writeFileSync(outPath, svgContent, 'utf8');
  return true;
}

/* ------------------------------------------------ Universal Orchestrator Dispatch */
export async function generatePhoto(prompt, outPath, options = {}) {
  console.log(`Generating image for prompt: "${prompt.substring(0, 60)}..."`);

  // Tier 1: Try Gemini API if key exists
  if (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY) {
    console.log('  [Tier 1] Trying free Gemini API...');
    const ok = await generateGemini(prompt, outPath, options);
    if (ok) {
      console.log(`  ✓ Successfully generated via Gemini API -> ${path.basename(outPath)}`);
      return { status: 'success', provider: 'gemini', path: outPath };
    }
  }

  // Tier 2: Try Pollinations.ai (With optional API Key or keyless)
  console.log('  [Tier 2] Trying Pollinations.ai (Keyless / Priority API)...');
  const okPollinations = await generatePollinations(prompt, outPath, options);
  if (okPollinations) {
    console.log(`  ✓ Successfully generated via Pollinations.ai -> ${path.basename(outPath)}`);
    return { status: 'success', provider: 'pollinations', path: outPath };
  }

  // Tier 3: B5 SVG Photo Card Fallback
  console.log('  [Tier 3] Generating B5 SVG Photo Card Fallback...');
  generatePhotoFallbackSVG(prompt, outPath, options);
  console.log(`  ✓ B5 SVG photo card written -> ${path.basename(outPath)}`);
  return { status: 'fallback', provider: 'svg_card', path: outPath };
}

/* ------------------------------------------------ CLI Runner */
const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isCli) {
  const argv = process.argv.slice(2);

  if (argv.includes('--check')) {
    console.log('\n--- Image Generation Environment Check ---');
    console.log(`Gemini API Key: ${process.env.GEMINI_API_KEY ? 'Present ✓' : 'Not set (Tier 1 skipped)'}`);
    console.log(`Pollinations API Key: ${process.env.POLLINATIONS_API_KEY ? 'Present ✓' : 'Not set (Keyless mode enabled)'}`);
    console.log('Tier 3 Fallback: B5 SVG Photo Card (Always ready ✓)\n');
    process.exit(0);
  }

  const prompt = argv[0];
  const outPath = argv[1];

  if (!prompt || !outPath) {
    console.log('Usage: node engine/tools/gen-image.mjs "<prompt>" <outPath.png> [--height 180]');
    console.log('       node engine/tools/gen-image.mjs --check');
    process.exit(1);
  }

  let height = 180;
  const heightIdx = argv.indexOf('--height');
  if (heightIdx !== -1 && heightIdx + 1 < argv.length) {
    height = parseInt(argv[heightIdx + 1], 10) || 180;
  }

  generatePhoto(prompt, outPath, { height }).then((result) => {
    const stats = fs.statSync(outPath);
    console.log(`Wrote image file: ${outPath} (${Math.round(stats.size / 1024)} KB) [Provider: ${result.provider}]`);
  });
}
