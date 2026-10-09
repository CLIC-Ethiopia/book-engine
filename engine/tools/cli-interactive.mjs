import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';
import prompts from 'prompts';
import { countWords } from './page-validator.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

function formatProposal(page, proposal, overflowMm) {
  const wordCount = countWords(proposal.explainerHtml);
  
  return `
═══════════════════════════════════════════
Page ${page.no}: ${page.title} (${page.section})
Current overflow: ${overflowMm}mm | Words: ${wordCount} | Target: 65
═══════════════════════════════════════════

LLM Proposal:
──────────────────
Title: ${proposal.title}
Subtitle: ${proposal.subtitle}

Explainer:
${proposal.explainerHtml.replace(/<p>/g, '').replace(/<\/p>/g, '\n').replace(/<span class="bad">/g, '[BAD]').replace(/<span class="hl">/g, '[HL]').replace(/<span class="good">/g, '[GOOD]').replace(/<span class="amber">/g, '[AMBER]').replace(/<\/span>/g, '[/]').replace(/<p class="close">/g, '[CLOSE]').replace(/<\/p>/g, '')}

Action: ${proposal.actionLabel} — ${proposal.actionContent}
Image: ${proposal.imageType} — ${proposal.imagePrompt}
──────────────────
`;
}

export async function reviewPageCLI(page, proposal, overflowData) {
  const overflowMm = overflowData?.overflow || 0;
  
  while (true) {
    console.log(formatProposal(page, proposal, overflowData?.overflow || 0));
    
    const action = await prompts({
      type: 'select',
      name: 'action',
      message: 'Choose action:',
      choices: [
        { title: 'Accept as-is', value: 'accept' },
        { title: 'Edit in $EDITOR', value: 'edit' },
        { title: 'Regenerate with instruction', value: 'regenerate' },
        { title: 'Skip this page (use raw content)', value: 'skip' },
        { title: 'Quit prep (use raw for all remaining)', value: 'quit' }
      ],
      initial: 0
    });
    
    if (!action.action) return 'quit';
    
    switch (action.action) {
      case 'accept':
        return 'accept';
        
      case 'edit': {
        // Write proposal to temp file, open editor, read back
        const tempFile = path.join(os.tmpdir(), `page-${page.no}-proposal.html`);
        const editContent = `
<!-- Edit the proposal below. Keep valid HTML structure. -->
<!-- Title: ${proposal.title} -->
<!-- Subtitle: ${proposal.subtitle} -->
${proposal.explainerHtml}

<!-- Action: ${proposal.actionLabel} - ${proposal.actionContent} -->
<!-- Image: ${proposal.imageType} - ${proposal.imagePrompt} -->
`;
        fs.writeFileSync(tempFile, editContent);
        
        const editor = process.env.EDITOR || (process.platform === 'win32' ? 'notepad' : 'nano');
        const { spawn } = await import('node:child_process');
        
        await new Promise((resolve, reject) => {
          const child = spawn(editor, [tempFile], { stdio: 'inherit' });
          child.on('close', resolve);
          child.on('error', reject);
        });
        
        const edited = fs.readFileSync(tempFile, 'utf8');
        // Extract explainerHtml from edited file (between first and last <!-- -->)
        const match = edited.match(/<!-- Title: .*? -->\n([\s\S]*?)\n<!-- Action:/);
        if (match) {
          const newHtml = match[1].trim();
          // Validate
          const validation = await import('./page-validator.mjs').then(m => m.validatePage({
            ...proposal,
            explainerHtml: newHtml
          }));
          if (validation.valid) {
            return { ...proposal, explainerHtml: newHtml };
          } else {
            console.log(`❌ Invalid edit: ${validation.errors.join(', ')}`);
            // Fall through to regenerate
          }
        }
        break;
      }
      
      case 'regenerate': {
        const instruction = await prompts({
          type: 'text',
          name: 'instruction',
          message: 'Regeneration instruction (e.g., "make opener about cement specifically"):'
        });
        if (!instruction.instruction) break;
        return { action: 'regenerate', instruction: instruction.instruction };
      }
      
      case 'skip':
        return 'skip';
        
      case 'quit':
        return 'quit';
    }
  }
}

export async function reviewOverflowFixes(pageTitle, overflowAnalysis) {
  const { rootCauses, fixes, recommended } = overflowAnalysis;
  
  console.log(`\n⚠️  Page overflow: ${overflowAnalysis.overflowMm}mm (target: 0mm)`);
  console.log(`Words: ${overflowAnalysis.wordCount} | Target: 65 | Diagram: ${overflowAnalysis.diagramHeight}px\n`);
  
  console.log('LLM Analysis:');
  console.log('──────────────────');
  console.log('Root causes: ' + rootCauses.join(', '));
  console.log('\nRecommended fixes:');
  
  for (const fix of fixes) {
    const isRec = overflowAnalysis.recommended?.includes(fix.id) ? ' ★' : '';
    console.log(`  [${fix.id}] ${fix.description} (${fix.autoApplicable ? 'auto' : 'manual'})${isRec}`);
    if (fix.wordSavings) console.log(`      → saves ~${fix.wordSavings} words`);
    if (fix.mmSavings) console.log(`      → saves ~${fix.mmSavings}mm`);
  }
  
  const action = await prompts({
    type: 'select',
    name: 'action',
    message: 'Choose action:',
    choices: [
      { title: 'Apply all recommended fixes automatically', value: 'auto-all' },
      { title: 'Apply recommended fixes one by one', value: 'auto-step' },
      { title: 'Edit manually in $EDITOR', value: 'edit' },
      { title: 'Regenerate with instruction', value: 'regenerate' },
      { title: 'Reduce diagram height and re-check', value: 'reduce-diagram' },
      { title: 'Split page into Part A / Part B', value: 'split' },
      { title: 'Accept overflow (not recommended)', value: 'accept' }
    ],
    initial: 0
  });
  
  return action.action;
}

export async function applyFixesAutomatically(proposal, fixes, recommended) {
  let html = proposal.explainerHtml;
  
  for (const fixId of recommended) {
    const fix = fixes.find(f => f.id === fixId);
    if (!fix || !fix.autoApplicable) continue;
    
    if (fix.description.includes('closer')) {
      // Shorten closer paragraph
      const closeMatch = html.match(/<p class="close">(.*?)<\/p>/);
      if (closeMatch) {
        const closer = closeMatch[1];
        const words = closer.split(/\s+/);
        if (words.length > 8) {
          const shortened = words.slice(0, 8).join(' ') + '...';
          html = html.replace(closer, shortened);
        }
      }
    } else if (fix.description.includes('nested spans')) {
      // Flatten nested spans
      html = html.replace(/<span class="([^"]*)"><span class="([^"]*)">(.*?)<\/span><\/span>/g, 
        (match, outer, inner, content) => `<span class="${outer} ${inner}">${content}</span>`);
      // Also handle reverse nesting
      html = html.replace(/<span class="([^"]*)">([^<]*<span class="[^"]*">[^<]*<\/span>[^<]*)<\/span>/g,
        (match, outer, inner) => inner);
    } else if (fix.description.includes('redundant words')) {
      // Simple redundancy removal
      html = html
        .replace(/\bvery\s+/gi, '')
        .replace(/\breally\s+/gi, '')
        .replace(/\bquite\s+/gi, '')
        .replace(/\bactually\s+/gi, '')
        .replace(/\s+/g, ' ');
    }
  }
  
  return { ...proposal, explainerHtml: html, wordCount: countWords(html) };
}

export const ReviewOutcome = {
  ACCEPT: 'ACCEPT',
  SKIP: 'SKIP',
  QUIT: 'QUIT',
  EDIT: 'EDIT',
  REGENERATE: 'REGENERATE',
};
export {};