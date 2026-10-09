/*
  diagram-generator.mjs  -  Agent-Native SVG Diagram Synthesis & Validation
  --------------------------------------------------------------------------
  Synthesizes inline SVG diagrams following the paper-engine diagram system
  (.agents/skills/block/references/diagram-system.md).

  Features:
  - Concept shape selection based on idea title/prompt/section
  - Prompt file generator (.work/diagram-<slug>-prompt.json)
  - Validation engine (viewBox 592, max height 250px, explicit text fill)
  - High-quality SVG synthesizer fallback for all 8 shape types
  - Stage processor for orchestrator integration
*/

import fs from 'node:fs';
import path from 'node:path';
import { sanitizeFilename, escHTML } from './shared.mjs';

const SECTION_COLORS = {
  Science: '#e61358',
  Technology: '#ed7d1f',
  Engineering: '#a0c82f',
  Arts: '#32b5d3',
  Mathematics: '#b44b97',
  Innovation: '#306a50',
  Entrepreneurship: '#5441ff',
};

const COLOR_ROLES = {
  neutral: { fill: '#FFFFFF', stroke: '#E7E9EF', titleFill: '#1A1A2E', subFill: '#5B6472' },
  mechanism: { fill: '#EEF0FE', stroke: '#D5D8FA', titleFill: '#4F46E5', subFill: '#6366F1' },
  good: { fill: '#ECFBF7', stroke: '#CDEFE8', titleFill: '#0D9488', subFill: '#5B6472' },
  threat: { fill: '#FEF1F1', stroke: '#F8D6D6', titleFill: '#DC2626', subFill: '#5B6472' },
  sensitive: { fill: '#FDF6E8', stroke: '#E7E9EF', titleFill: '#1A1A2E', subFill: '#B45309' },
  arrowSlate: '#94A3B8',
  arrowRed: '#DC2626',
};

/**
  Categorize concept into one of the canonical shape types from diagram-system.md
 */
export function selectDiagramShape(title = '', prompt = '', section = '') {
  const text = `${title} ${prompt} ${section}`.toLowerCase();

  if (/\b(attack|threat|leak|exploit|bypass|vulnerability|injection|ssrf|cors|xss|csrf)\b/.test(text)) {
    return {
      type: 'attack',
      name: 'Attack / Boundary Crossing',
      description: 'There-and-back flow across a dashed trust boundary with a red return leak arrow',
      height: 232,
    };
  }

  if (/\b(resilience|fallback|rate limit|retry|circuit breaker|failover|redundancy|fault|load|drop)\b/.test(text)) {
    return {
      type: 'resilience',
      name: 'Resilience / Fallback Drop',
      description: 'Horizontal happy path plus vertical drop from mechanism to a fallback/rejected state',
      height: 200,
    };
  }

  if (/\b(performance|scale|latency|cache|debounce|throughput|slow|fast|timeline|benchmark|time)\b/.test(text)) {
    return {
      type: 'performance',
      name: 'Performance / Timeline comparison',
      description: 'Horizontal time axis comparing before/after or event sequence against a baseline',
      height: 176,
    };
  }

  if (/\b(correctness|validation|verification|hmac|hash|checksum|compare|audit|match|filter|verify)\b/.test(text)) {
    return {
      type: 'correctness',
      name: 'Correctness / Comparison Funnel',
      description: 'Two or more inputs funneling into mechanism, branching into good and bad outcomes',
      height: 200,
    };
  }

  if (/\b(auth|oauth|token|login|session|identity|jwt|credential|permission|handshake)\b/.test(text)) {
    return {
      type: 'auth',
      name: 'Auth / Token Flow Handshake',
      description: 'User, client app, and auth provider redirect/token round-trip flow',
      height: 210,
    };
  }

  if (/\b(async|queue|worker|job|background|event|pubsub|celery|message|broker)\b/.test(text)) {
    return {
      type: 'async',
      name: 'Async Jobs / Queue & Worker',
      description: 'Producer request dropping job to queue, returning fast, worker processing off-side',
      height: 190,
    };
  }

  if (/\b(tool|env|container|venv|isolation|docker|sandbox|config|setup|environment)\b/.test(text)) {
    return {
      type: 'tooling',
      name: 'Tooling / Isolation Box',
      description: 'Isolated environment boundary holding dependencies separate from system',
      height: 180,
    };
  }

  if (/\b(integration|webhook|api|call|callback|mcp|service|endpoint|request|response)\b/.test(text)) {
    return {
      type: 'integration',
      name: 'Integration / Call & Response',
      description: 'Inbound POST/request from external system to mechanism with verified action response',
      height: 190,
    };
  }

  return {
    type: 'process',
    name: 'Process / Step-by-Step Flow',
    description: 'Sequential multi-card process flow from input through mechanism to outcome',
    height: 190,
  };
}

/**
  Build structured prompt object for .work/diagram-<slug>-prompt.json
 */
export function buildDiagramPrompt({ title, prompt, section, sectionColor, shape }) {
  const accentColor = sectionColor || SECTION_COLORS[section] || '#4F46E5';
  const shapeInfo = shape || selectDiagramShape(title, prompt, section);

  return {
    title,
    prompt: prompt || title,
    section: section || 'General',
    accentColor,
    shape: shapeInfo,
    viewBox: `0 0 592 ${shapeInfo.height}`,
    colorRoles: COLOR_ROLES,
    designRules: [
      'viewBox width MUST be exactly 592',
      'Height between 150 and 250px',
      'Every <text> tag MUST have explicit fill attribute or style="...fill:..."',
      'Use Space Grotesk for card titles, Inter for body/subtitles, JetBrains Mono for code/addresses',
      'Include defs with arrow marker #ar and filter shadow #cs',
      'Center key line at x=296 near bottom',
      'No text font size under 11px',
    ],
  };
}

/**
  Validate SVG string against paper engine diagram laws
 */
export function validateDiagramSVG(svgContent) {
  const errors = [];
  const warnings = [];

  if (typeof svgContent !== 'string' || !svgContent.trim()) {
    return { valid: false, errors: ['SVG content is empty or not a string'], warnings: [] };
  }

  if (!/<svg\b[^>]*>/i.test(svgContent)) {
    errors.push('Missing <svg> root element');
  }

  // Check viewBox
  const viewBoxMatch = svgContent.match(/viewBox\s*=\s*"([^"]+)"/i);
  if (!viewBoxMatch) {
    errors.push('Missing viewBox attribute on <svg>');
  } else {
    const parts = viewBoxMatch[1].trim().split(/[\s,]+/);
    if (parts.length === 4) {
      const w = parseFloat(parts[2]);
      const h = parseFloat(parts[3]);
      if (w !== 592) {
        errors.push(`viewBox width must be 592, found ${w}`);
      }
      if (h > 250) {
        errors.push(`viewBox height ${h} exceeds budget (max 250px)`);
      }
    } else {
      errors.push(`Malformed viewBox attribute: "${viewBoxMatch[1]}"`);
    }
  }

  // Check text fill explicit assignment
  const textMatches = svgContent.match(/<text\b[^>]*>/gi) || [];
  for (let i = 0; i < textMatches.length; i++) {
    const tag = textMatches[i];
    const hasFillAttr = /\bfill\s*=/i.test(tag);
    const hasStyleFill = /style\s*=\s*"[^"]*fill\s*:/i.test(tag);
    if (!hasFillAttr && !hasStyleFill) {
      errors.push(`Text element #${i + 1} lacks explicit fill property: ${tag}`);
    }
  }

  // Check defs elements
  if (!/<defs>/i.test(svgContent)) {
    warnings.push('Missing <defs> block');
  } else {
    if (!/id="ar"/i.test(svgContent)) {
      warnings.push('Missing arrow marker id="ar" in defs');
    }
    if (!/id="cs"/i.test(svgContent)) {
      warnings.push('Missing shadow filter id="cs" in defs');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
  Deterministic SVG diagram synthesizer fallback for all shape types
 */
export function generateSVGFromShape({ title, prompt = '', section = '', sectionColor, shape }) {
  const shapeInfo = shape || selectDiagramShape(title, prompt, section);
  const color = sectionColor || SECTION_COLORS[section] || '#4F46E5';
  const width = 592;
  const H = shapeInfo.height || 200;
  const safeTitle = escHTML(title || 'Diagram');
  const safePrompt = escHTML((prompt || title).substring(0, 70));

  const commonDefs = `
  <defs>
    <marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
      <path d="M2 1L8 5L2 9" fill="none" stroke="context-stroke" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
    <filter id="cs" x="-20%" y="-25%" width="140%" height="160%">
      <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#1A1A2E" flood-opacity="0.07"/>
    </filter>
  </defs>`;

  const keyLineY = H - 16;

  if (shapeInfo.type === 'attack') {
    return `<svg width="100%" viewBox="0 0 ${width} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${safeTitle}">
${commonDefs}
  <!-- Trust boundary -->
  <rect x="150" y="20" width="410" height="150" rx="14" fill="none" stroke="#CBD2DC" stroke-width="1" stroke-dasharray="5 5"/>
  <text x="170" y="38" style="font-family:'Inter',sans-serif;font-size:11px;fill:#5B6472">Protected Boundary</text>
  
  <!-- Attacker (Red) -->
  <rect x="25" y="60" width="105" height="55" rx="12" fill="#FEF1F1" stroke="#F8D6D6" stroke-width="1" filter="url(#cs)"/>
  <text x="77" y="85" text-anchor="middle" style="font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:600;fill:#DC2626">Attacker</text>
  <text x="77" y="102" text-anchor="middle" style="font-family:'Inter',sans-serif;font-size:10px;fill:#5B6472">Untrusted</text>
  
  <!-- App / Mechanism (Indigo) -->
  <rect x="190" y="60" width="130" height="55" rx="12" fill="#EEF0FE" stroke="#D5D8FA" stroke-width="1" filter="url(#cs)"/>
  <text x="255" y="85" text-anchor="middle" style="font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:600;fill:#4F46E5">${safeTitle.substring(0, 16)}</text>
  <text x="255" y="102" text-anchor="middle" style="font-family:'Inter',sans-serif;font-size:10px;fill:#6366F1">Mechanism</text>
  
  <!-- Sensitive Resource -->
  <rect x="390" y="60" width="140" height="55" rx="12" fill="#FDF6E8" stroke="#E7E9EF" stroke-width="1" filter="url(#cs)"/>
  <text x="460" y="85" text-anchor="middle" style="font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:600;fill:#1A1A2E">Protected Data</text>
  <text x="460" y="102" text-anchor="middle" style="font-family:'JetBrains Mono',monospace;font-size:10px;fill:#B45309">secrets / state</text>
  
  <!-- Arrows -->
  <line x1="130" y1="87" x2="188" y2="87" stroke="#94A3B8" stroke-width="1.5" marker-end="url(#ar)"/>
  <line x1="320" y1="87" x2="388" y2="87" stroke="#94A3B8" stroke-width="1.5" marker-end="url(#ar)"/>
  <path d="M 460 115 L 460 160 L 77 160 L 77 117" fill="none" stroke="#DC2626" stroke-width="1.5" stroke-dasharray="4 3" marker-end="url(#ar)"/>
  
  <!-- Badges -->
  <circle cx="158" cy="77" r="10" fill="#6366F1"/>
  <text x="158" y="77" text-anchor="middle" dominant-baseline="central" style="font-family:'Inter',sans-serif;font-size:11px;font-weight:600;fill:#FFFFFF">1</text>
  <circle cx="355" cy="77" r="10" fill="#6366F1"/>
  <text x="355" y="77" text-anchor="middle" dominant-baseline="central" style="font-family:'Inter',sans-serif;font-size:11px;font-weight:600;fill:#FFFFFF">2</text>
  <circle cx="268" cy="160" r="10" fill="#DC2626"/>
  <text x="268" y="160" text-anchor="middle" dominant-baseline="central" style="font-family:'Inter',sans-serif;font-size:11px;font-weight:600;fill:#FFFFFF">3</text>
  
  <!-- Key line -->
  <text x="296" y="${keyLineY}" text-anchor="middle" style="font-family:'Inter',sans-serif;font-size:12px;fill:#5B6472">1 untrusted request · 2 mechanism routes to target · 3 data leaks back</text>
</svg>`;
  }

  if (shapeInfo.type === 'resilience') {
    return `<svg width="100%" viewBox="0 0 ${width} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${safeTitle}">
${commonDefs}
  <!-- Source Card -->
  <rect x="25" y="45" width="130" height="55" rx="12" fill="#FFFFFF" stroke="#E7E9EF" stroke-width="1" filter="url(#cs)"/>
  <text x="90" y="70" text-anchor="middle" style="font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:600;fill:#1A1A2E">Incoming Load</text>
  <text x="90" y="87" text-anchor="middle" style="font-family:'Inter',sans-serif;font-size:10px;fill:#5B6472">Requests</text>

  <!-- Mechanism Card -->
  <rect x="220" y="45" width="150" height="55" rx="12" fill="#EEF0FE" stroke="#D5D8FA" stroke-width="1" filter="url(#cs)"/>
  <text x="295" y="70" text-anchor="middle" style="font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:600;fill:#4F46E5">${safeTitle.substring(0, 18)}</text>
  <text x="295" y="87" text-anchor="middle" style="font-family:'Inter',sans-serif;font-size:10px;fill:#6366F1">Resilience Check</text>

  <!-- Good Card -->
  <rect x="435" y="45" width="130" height="55" rx="12" fill="#ECFBF7" stroke="#CDEFE8" stroke-width="1" filter="url(#cs)"/>
  <text x="500" y="70" text-anchor="middle" style="font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:600;fill:#0D9488">Healthy Path</text>
  <text x="500" y="87" text-anchor="middle" style="font-family:'Inter',sans-serif;font-size:10px;fill:#5B6472">200 OK</text>

  <!-- Fallback / Rejected Card -->
  <rect x="230" y="130" width="130" height="40" rx="10" fill="#FEF1F1" stroke="#F8D6D6" stroke-width="1" filter="url(#cs)"/>
  <text x="295" y="154" text-anchor="middle" style="font-family:'Space Grotesk',sans-serif;font-size:11px;font-weight:600;fill:#DC2626">Fallback / Shed</text>

  <!-- Arrows -->
  <line x1="155" y1="72" x2="218" y2="72" stroke="#94A3B8" stroke-width="1.5" marker-end="url(#ar)"/>
  <line x1="370" y1="72" x2="433" y2="72" stroke="#94A3B8" stroke-width="1.5" marker-end="url(#ar)"/>
  <line x1="295" y1="100" x2="295" y2="128" stroke="#DC2626" stroke-width="1.5" marker-end="url(#ar)"/>

  <!-- Badges -->
  <circle cx="186" cy="62" r="10" fill="#6366F1"/>
  <text x="186" y="62" text-anchor="middle" dominant-baseline="central" style="font-family:'Inter',sans-serif;font-size:11px;font-weight:600;fill:#FFFFFF">1</text>
  <circle cx="401" cy="62" r="10" fill="#6366F1"/>
  <text x="401" y="62" text-anchor="middle" dominant-baseline="central" style="font-family:'Inter',sans-serif;font-size:11px;font-weight:600;fill:#FFFFFF">2</text>
  <circle cx="310" cy="114" r="10" fill="#DC2626"/>
  <text x="310" y="114" text-anchor="middle" dominant-baseline="central" style="font-family:'Inter',sans-serif;font-size:11px;font-weight:600;fill:#FFFFFF">3</text>

  <!-- Key line -->
  <text x="296" y="${keyLineY}" text-anchor="middle" style="font-family:'Inter',sans-serif;font-size:12px;fill:#5B6472">1 request evaluated · 2 pass to healthy service · 3 excess dropped to fallback</text>
</svg>`;
  }

  if (shapeInfo.type === 'correctness') {
    return `<svg width="100%" viewBox="0 0 ${width} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${safeTitle}">
${commonDefs}
  <!-- Input A -->
  <rect x="25" y="35" width="120" height="45" rx="10" fill="#FFFFFF" stroke="#E7E9EF" stroke-width="1" filter="url(#cs)"/>
  <text x="85" y="62" text-anchor="middle" style="font-family:'Space Grotesk',sans-serif;font-size:12px;font-weight:600;fill:#1A1A2E">Input Payload</text>

  <!-- Input B -->
  <rect x="25" y="100" width="120" height="45" rx="10" fill="#FDF6E8" stroke="#E7E9EF" stroke-width="1" filter="url(#cs)"/>
  <text x="85" y="127" text-anchor="middle" style="font-family:'JetBrains Mono',monospace;font-size:11px;fill:#B45309">Secret Key</text>

  <!-- Mechanism Funnel -->
  <rect x="210" y="60" width="160" height="60" rx="12" fill="#EEF0FE" stroke="#D5D8FA" stroke-width="1" filter="url(#cs)"/>
  <text x="290" y="85" text-anchor="middle" style="font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:600;fill:#4F46E5">${safeTitle.substring(0, 18)}</text>
  <text x="290" y="103" text-anchor="middle" style="font-family:'Inter',sans-serif;font-size:10px;fill:#6366F1">Verification Core</text>

  <!-- Good Match -->
  <rect x="435" y="40" width="130" height="45" rx="10" fill="#ECFBF7" stroke="#CDEFE8" stroke-width="1" filter="url(#cs)"/>
  <text x="500" y="67" text-anchor="middle" style="font-family:'Space Grotesk',sans-serif;font-size:12px;font-weight:600;fill:#0D9488">Match Valid</text>

  <!-- Mismatch -->
  <rect x="435" y="105" width="130" height="45" rx="10" fill="#FEF1F1" stroke="#F8D6D6" stroke-width="1" filter="url(#cs)"/>
  <text x="500" y="132" text-anchor="middle" style="font-family:'Space Grotesk',sans-serif;font-size:12px;font-weight:600;fill:#DC2626">Mismatch Reject</text>

  <!-- Lines -->
  <line x1="145" y1="57" x2="208" y2="78" stroke="#94A3B8" stroke-width="1.5" marker-end="url(#ar)"/>
  <line x1="145" y1="122" x2="208" y2="100" stroke="#94A3B8" stroke-width="1.5" marker-end="url(#ar)"/>
  <line x1="370" y1="78" x2="433" y2="62" stroke="#94A3B8" stroke-width="1.5" marker-end="url(#ar)"/>
  <line x1="370" y1="102" x2="433" y2="122" stroke="#DC2626" stroke-width="1.5" marker-end="url(#ar)"/>

  <!-- Key line -->
  <text x="296" y="${keyLineY}" text-anchor="middle" style="font-family:'Inter',sans-serif;font-size:12px;fill:#5B6472">1 combine input &amp; key · 2 compute verification · 3 compare against target</text>
</svg>`;
  }

  // General/Process shape default (covers process, performance, auth, async, tooling, integration)
  return `<svg width="100%" viewBox="0 0 ${width} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${safeTitle}">
${commonDefs}
  <!-- Step 1: Input -->
  <rect x="25" y="55" width="140" height="60" rx="12" fill="#FFFFFF" stroke="#E7E9EF" stroke-width="1" filter="url(#cs)"/>
  <text x="95" y="82" text-anchor="middle" style="font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:600;fill:#1A1A2E">Input State</text>
  <text x="95" y="100" text-anchor="middle" style="font-family:'Inter',sans-serif;font-size:10px;fill:#5B6472">Raw Data / Event</text>

  <!-- Step 2: Mechanism -->
  <rect x="225" y="55" width="150" height="60" rx="12" fill="#EEF0FE" stroke="#D5D8FA" stroke-width="1" filter="url(#cs)"/>
  <text x="300" y="82" text-anchor="middle" style="font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:600;fill:#4F46E5">${safeTitle.substring(0, 18)}</text>
  <text x="300" y="100" text-anchor="middle" style="font-family:'Inter',sans-serif;font-size:10px;fill:#6366F1">Core Engine</text>

  <!-- Step 3: Outcome -->
  <rect x="435" y="55" width="135" height="60" rx="12" fill="#ECFBF7" stroke="#CDEFE8" stroke-width="1" filter="url(#cs)"/>
  <text x="502" y="82" text-anchor="middle" style="font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:600;fill:#0D9488">Verified Goal</text>
  <text x="502" y="100" text-anchor="middle" style="font-family:'Inter',sans-serif;font-size:10px;fill:#5B6472">Desired Result</text>

  <!-- Connectors -->
  <line x1="165" y1="85" x2="223" y2="85" stroke="#94A3B8" stroke-width="1.5" marker-end="url(#ar)"/>
  <line x1="375" y1="85" x2="433" y2="85" stroke="#94A3B8" stroke-width="1.5" marker-end="url(#ar)"/>

  <!-- Step Badges -->
  <circle cx="194" cy="73" r="10" fill="#6366F1"/>
  <text x="194" y="73" text-anchor="middle" dominant-baseline="central" style="font-family:'Inter',sans-serif;font-size:11px;font-weight:600;fill:#FFFFFF">1</text>
  <circle cx="404" cy="73" r="10" fill="#6366F1"/>
  <text x="404" y="73" text-anchor="middle" dominant-baseline="central" style="font-family:'Inter',sans-serif;font-size:11px;font-weight:600;fill:#FFFFFF">2</text>

  <!-- Key Line -->
  <text x="296" y="${keyLineY}" text-anchor="middle" style="font-family:'Inter',sans-serif;font-size:12px;fill:#5B6472">1 trigger input · 2 process through ${safeTitle.substring(0, 14)} · 3 achieve outcome</text>
</svg>`;
}

/**
  High-level worker for orchestrator diagram stage execution
 */
export async function processDiagramStage(bookDir, pageInfo, classification = {}) {
  const imagesDir = path.join(bookDir, 'images');
  const workDir = path.join(bookDir, '.work');

  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
  if (!fs.existsSync(workDir)) fs.mkdirSync(workDir, { recursive: true });

  const title = pageInfo.title || 'Untitled';
  const prompt = pageInfo.imagePrompt || classification.prompt || title;
  const section = pageInfo.section || 'General';

  const slug = sanitizeFilename(title);
  const svgPath = path.join(imagesDir, `${slug}.svg`);
  const promptPath = path.join(workDir, `diagram-${slug}-prompt.json`);

  const shape = selectDiagramShape(title, prompt, section);
  const promptData = buildDiagramPrompt({ title, prompt, section, shape });

  // 1. Save diagram prompt file for agent synthesis
  fs.writeFileSync(promptPath, JSON.stringify(promptData, null, 2), 'utf8');

  // 2. Check if a custom valid SVG already exists
  let svgContent = '';
  if (fs.existsSync(svgPath)) {
    const existing = fs.readFileSync(svgPath, 'utf8');
    const val = validateDiagramSVG(existing);
    if (val.valid) {
      return { svgPath, promptPath, status: 'existing_valid', shape };
    }
  }

  // 3. Synthesize SVG using shape synthesizer
  svgContent = generateSVGFromShape({ title, prompt, section, shape });
  fs.writeFileSync(svgPath, svgContent, 'utf8');

  // 4. Validate output
  const validation = validateDiagramSVG(svgContent);

  return {
    svgPath,
    promptPath,
    status: validation.valid ? 'synthesized' : 'invalid',
    validation,
    shape,
  };
}
