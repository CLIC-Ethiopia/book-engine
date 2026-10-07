import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPageOverflows, analyzeOverflow, countWords } from './overflow-analyzer.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

export { checkPageOverflows, countWords };

export async function validatePage(proposal) {
  const errors = [];

  if (!proposal.title || proposal.title.trim().split(/\s+/).length > 3) {
    return { valid: false, errors: ['Title must be ≤3 words'] };
  }
  if (!proposal.subtitle || proposal.subtitle.trim().split(/\s+/).length > 10) {
    return { valid: false, errors: ['Subtitle must be ≤10 words'] };
  }
  if (!proposal.explainerHtml || !proposal.explainerHtml.includes('<p>')) {
    return { valid: false, errors: ['explainerHtml must contain <p> paragraphs'] };
  }
  if (!proposal.actionLabel || !proposal.actionContent) {
    return { valid: false, errors: ['Action label and content required'] };
  }
  if (proposal.actionContent.trim().split(/\s+/).length > 20) {
    return { valid: false, errors: ['Action content must be ≤20 words'] };
  }
  if (!['diagram', 'photo'].includes(proposal.imageType)) {
    return { valid: false, errors: ['imageType must be "diagram" or "photo"'] };
  }
  if (typeof proposal.wordCount !== 'number' || proposal.wordCount > 85) {
    return { valid: false, errors: ['wordCount must be ≤85'] };
  }

  if (proposal.explainerHtml && proposal.explainerHtml.match(/<span class="[^"]*"><span class="/)) {
    return { valid: false, errors: ['Nested color spans detected - flatten them'] };
  }

  if (proposal.explainerHtml && proposal.explainerHtml.includes('—')) {
    return { valid: false, errors: ['Em dashes not allowed (use commas or periods)'] };
  }

  if (proposal.explainerHtml && /[\u{1F600}-\u{1F6FF}]/u.test(proposal.explainerHtml)) {
    return { valid: false, errors: ['Emojis not allowed'] };
  }

  // Check for dangerous HTML (XSS vectors)
  if (proposal.explainerHtml) {
    const dangerousPatterns = [
      { pattern: /<script\b/i, desc: 'script tag' },
      { pattern: /on\w+\s*=/i, desc: 'event handler (onload, onclick, etc.)' },
      { pattern: /javascript:/i, desc: 'javascript: URL' },
      { pattern: /data:/i, desc: 'data: URI' },
      { pattern: /<iframe\b/i, desc: 'iframe tag' },
      { pattern: /<object\b/i, desc: 'object tag' },
      { pattern: /<embed\b/i, desc: 'embed tag' },
      { pattern: /<form\b/i, desc: 'form tag' },
      { pattern: /<input\b/i, desc: 'input tag' },
      { pattern: /<textarea\b/i, desc: 'textarea tag' },
      { pattern: /<select\b/i, desc: 'select tag' },
      { pattern: /<button\b/i, desc: 'button tag' },
      { pattern: /<link\b/i, desc: 'link tag' },
      { pattern: /<meta\b/i, desc: 'meta tag' },
      { pattern: /<style\b/i, desc: 'style tag' },
      { pattern: /<base\b/i, desc: 'base tag' },
    ];
    for (const { pattern, desc } of dangerousPatterns) {
      if (pattern.test(proposal.explainerHtml)) {
        return { valid: false, errors: [`Dangerous HTML detected: ${desc}`] };
      }
    }
  }

  return { valid: true, errors: [] };
}

export async function recommendFixes(pageHtml, overflowMm, wordCount, diagramHeight, bookDir, pageNo) {
  return await analyzeOverflow(pageHtml, overflowMm, wordCount, diagramHeight, bookDir, pageNo);
}