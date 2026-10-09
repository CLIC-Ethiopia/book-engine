import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

/**
 * Wrapper to call agy as a PREP_PROVIDER.
 *
 * Usage: node agy-prep-wrapper.mjs <promptFile>
 *
 * Reads the prompt file, constructs a prompt for agy, calls agy -p,
 * and writes the response to the response file.
 */

const promptFile = process.argv[2];
if (!promptFile) {
  console.error('Usage: node agy-prep-wrapper.mjs <promptFile>');
  process.exit(1);
}

const responseFile = promptFile.replace(/-prompt\.json$/, '-response.json');

try {
  const promptData = JSON.parse(fs.readFileSync(promptFile, 'utf8'));

  // Construct the prompt for agy
  const { page, context, constraints, instructions } = promptData;

  const systemPrompt = `You are an expert technical writer for the paper-engine book system.
Each page must fit a strict B5 page (176x250mm) with zero overflow.
Follow the STEAM-IE voice: concise, actionable, no fluff.

${context.designRules ? `Design rules: ${context.designRules}` : ''}
${context.examples ? `Examples: ${JSON.stringify(context.examples)}` : ''}

Constraints:
- Target: ${constraints.targetWords} words, max ${constraints.maxWords}
- Title: max ${constraints.maxTitleWords} words
- Subtitle: max ${constraints.maxSubtitleWords} words  
- Action: max ${constraints.maxActionWords} words
- Diagram height: ${constraints.diagramHeight}px
- Current overflow: ${promptData.context.currentOverflow || 'unknown'}mm
- Current word count: ${promptData.context.currentWordCount || 'unknown'}

Return ONLY valid JSON with these fields:
{
  "title": "string (max 3 words)",
  "subtitle": "string (max 10 words)",
  "explainerHtml": "string - 3 paragraphs with <p> tags, use <span class=\"bad|hl|good|amber\"> for color roles",
  "actionLabel": "string (max 20 words)",
  "actionContent": "string (max 20 words)",
  "imageType": "diagram|photo",
  "imagePrompt": "string",
  "wordCount": number,
  "overflowPrediction": number
}`;

  const userPrompt = `${instructions}

Page: ${page.title} (${page.section})
Original subtitle: ${page.originalSubtitle}
Original content: ${page.originalContent}
Action callout: ${page.actionCallout}
Image prompt: ${page.imagePrompt}

Context:
- Book: ${context.bookTitle}
- Series: ${context.series}
- Page dimensions: ${context.pageWidth}x${context.pageHeight}mm
- Target: ${constraints.targetWords} words (max ${constraints.maxWords})
- Diagram height: ${constraints.diagramHeight}px

Return JSON only.`;

  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

  // Call agy with the prompt
  const result = spawnSync('agy', ['-p', fullPrompt], {
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, AGY_SKIP_PERMISSIONS: '1' }
  });

  if (result.error) {
    console.error('agy spawn error:', result.error);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error('agy failed:', result.stderr);
    process.exit(1);
  }

  // Parse agy's output as JSON
  let response;
  try {
    // agy output might have extra text, try to extract JSON
    const output = result.stdout.trim();
    const jsonStart = output.indexOf('{');
    const jsonEnd = output.lastIndexOf('}');
    if (jsonStart >= 0 && jsonEnd >= jsonStart) {
      response = JSON.parse(output.slice(jsonStart, jsonEnd + 1));
    } else {
      response = JSON.parse(output);
    }
  } catch (e) {
    console.error('Failed to parse agy response as JSON:', e.message);
    console.error('Raw output:', result.stdout.slice(0, 500));
    process.exit(1);
  }

  // Validate required fields
  const required = ['title', 'subtitle', 'explainerHtml', 'actionLabel', 'actionContent', 'imageType', 'imagePrompt', 'wordCount'];
  for (const field of required) {
    if (!(field in response)) {
      console.error(`Missing required field: ${field}`);
      process.exit(1);
    }
  }

  // Write response file
  fs.writeFileSync(responseFile, JSON.stringify(response, null, 2));
  console.log(`Response written to ${responseFile}`);

} catch (e) {
  console.error('Wrapper error:', e.message);
  process.exit(1);
}