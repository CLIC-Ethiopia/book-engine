import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { countWords } from './shared.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

const SHOWCASE_EXAMPLES = [
  {
    title: "Resting meat",
    subtitle: "Why you wait before you cut",
    explainer: `Let's say you pull a steak off the pan and cut it right away.
The juice runs out over the board, and <span class="bad">what's left on your plate is dry</span>.
Heat pushes the juice toward the middle of the meat. Give it a few minutes off the heat and <span class="hl">it settles back through the whole piece</span>. Same steak, <span class="good">nothing lost to the board</span>.
The waiting is part of the cooking.`,
    actionLabel: "TRY THIS TONIGHT",
    actionContent: "Take it off the heat, put it on a warm plate, cover it loosely. Five minutes for a steak, fifteen for a roast. Then cut.",
    imageType: "photo",
    imagePrompt: "A cooked steak resting on a wooden board, juices gathering underneath, a knife beside it. Soft daylight from left, plain neutral background, professional food photography."
  },
  {
    title: "The bloom",
    subtitle: "The first pour, and why it is small",
    explainer: `Let's say your coffee keeps coming out thin and sour, and you've already tried grinding finer. Fresh grounds are <span class="hl">full of gas</span>, and gas pushes water away, so most of your pour runs past the coffee.
Wet them with a splash first, twice the weight of the coffee, and wait. The bed puffs into a dome and the bubbles stop. Now <span class="good">the water can get in</span>.
Thirty seconds, and the rest of the pour finally works.`,
    actionLabel: "TRY THIS TOMORROW",
    actionContent: "Pour twice the coffee's weight in water, just enough to wet everything. Wait thirty seconds. Then pour the rest.",
    imageType: "photo",
    imagePrompt: "Hot water poured over fresh coffee grounds in a plain white dripper, the grounds swelling into a domed crust of fine bubbles. Soft daylight, top-down view, clean minimal composition."
  },
  {
    title: "Companion planting",
    subtitle: "Who you put next to what",
    explainer: `Let's say something keeps eating your tomatoes and you'd rather not spray. <span class="bad">A bed with one crop in it is an easy meal</span>.
Put basil around the base and marigolds at the end of the row. <span class="hl">The smell confuses what's hunting</span>, and the marigolds pull pests toward the flowers. <span class="good">You keep the tomatoes</span>.`,
    actionLabel: "THIS WEEKEND",
    actionContent: "Plant basil at the base of each tomato and marigolds at both ends of the bed. Keep the basil close, about a hand's width out.",
    imageType: "photo",
    imagePrompt: "A young tomato plant with basil growing close around its base and marigolds nearby in dark garden soil. Natural daylight, garden setting."
  },
  {
    title: "Packing cubes",
    subtitle: "Sort once, at home",
    explainer: `Let's say you're moving hotels every second night. By day three the case is a pile, and finding one clean shirt means <span class="bad">taking everything out and putting it back</span>.
Cubes fix the sorting, not the space. One for shirts, one for layers, one for socks, one for the dirty stuff. <span class="hl">You decide where things live once, at home</span>.
<p class="close">You stop unpacking. You just lift out a cube.</p>`,
    actionLabel: "NEXT TRIP",
    actionContent: "One cube per kind of thing, not per outfit. Keep one empty at the start and let it become the laundry cube.",
    imageType: "photo",
    imagePrompt: "An open carry-on suitcase seen from above, filled with four neat fabric packing cubes in muted colours. Soft daylight, clean composition."
  },
  {
    title: "Golden hour",
    subtitle: "The hour that does the work for you",
    explainer: `Let's say your photos look flat and you've blamed the camera. <span class="bad">Midday sun comes straight down</span>, so it fills every shadow, and shadows are what make things look solid.
Late light comes in low and sideways. It <span class="hl">rakes across whatever you point at</span>, so you get long shadows and texture. <span class="good">Depth you didn't have to add</span>.
<p class="close">Same phone, same spot. Different hour.</p>`,
    actionLabel: "TRY THIS WEEK",
    actionContent: "Shoot the hour after sunrise or the hour before sunset, and put the sun to one side of your subject rather than behind you.",
    imageType: "photo",
    imagePrompt: "A single tree on rolling grassland in low late sunlight, long shadows stretching across the field. Warm golden light, atmospheric."
  }
];

const DESIGN_RULES = [
  "No em dashes. Use commas or full stops only.",
  "Color is a role: .bad=red (threat/mistake), .hl=indigo (mechanism), .good=teal (good outcome), .amber=amber (protected asset)",
  "Every SVG <text> needs explicit fill",
  "Never shrink viewBox to fit—cut words instead",
  "Opener must start with 'Let's say...' or similar starter phrase matching the context",
  "3 paragraphs: opener+pain (bad), mechanism+outcome (hl+good), closer (p class=\"close\")",
  "Action: imperative, ≤20 words, one complete sentence, two short sentences that must fit in two lines",
  "Subtitle: ≤10 words, plain descriptor",
  "Title: ≤3 words, concept name only",
  "Never invent facts, numbers, or stories. Never fabricate.",
  "Contractions everywhere (it's, you're, can't). Simple words only."
];

const VOICE_RULES = [
  "No em dashes. Ever. Use commas or periods.",
  "Contractions everywhere: it's, you're, can't, they'll, isn't.",
  "Simple words only. If a beginner or non-native reader would trip on a word, swap it.",
  "Uneven rhythm. Mix a very short line with longer ones. Don't stack three even-length sentences.",
  "Dry, builder to builder. No marketing voice, no hype.",
  "Concrete beats abstract. One real artifact or example per page.",
  "Open with 'Let's say...' then a situation the reader is actually in.",
  "Name the real cost when describing the pain: wasted time, things that break, things that are wrong.",
  "End on a short closer line that sticks. One sentence, its own beat.",
  "Keep the author's grammar. Fix only genuine typos, never upgrade their phrasing.",
  "4-6 short sentences plus the closer. Long enough to land the idea, short enough to read in under a minute."
];

function extractRelevantBlocks(blocksMd, pageTitle, section) {
  // Find the relevant section in blocks.md and return relevant lines
  const lines = blocksMd.split('\n');
  const sectionHeader = `## Part`;
  const targetSection = `## Part`;
  
  // Simple extraction: find section header for this section
  const sectionNames = {
    'Science': 'Science',
    'Technology': 'Technology', 
    'Engineering': 'Engineering',
    'Arts': 'Arts',
    'Mathematics': 'Mathematics',
    'Innovation': 'Innovation',
    'Entrepreneurship': 'Entrepreneurship'
  };
  
  const targetName = sectionNames[section] || section;
  let inTargetSection = false;
  const relevant = [];
  
  for (const line of lines) {
    if (line.startsWith('## Part')) {
      inTargetSection = line.includes(targetName);
      continue;
    }
    if (inTargetSection && line.trim()) {
      relevant.push(line);
    }
  }
  
  // Return first 50 lines or all if shorter
  return relevant.slice(0, 50).join('\n');
}

function cleanPageContent(content) {
  if (!content) return '';
  return content
    // Remove ## Title line
    .replace(/^##\s+.+$/gm, '')
    // Remove #### Subtitle line
    .replace(/^####\s+.+$/gm, '')
    // Remove ![AI Image Prompt: ...] markdown image syntax
    .replace(/!\[AI Image Prompt:\s*[\s\S]*?\]/g, '')
    // Remove [ACTION CALLOUT: ...] and its content
    .replace(/\[ACTION CALLOUT:\s*[^\]]+\]\s*[\s\S]*?(?=\n---|\n#|$)/g, '')
    // Remove --- separators
    .replace(/\n\s*---\s*\n/g, '\n')
    // Remove multiple blank lines
    .replace(/\n{3,}/g, '\n\n')
    // Trim
    .trim();
}

export async function buildPageContext(page, bookDir, manifest, overflowData = {}) {
  const voicePath = path.join(bookDir, 'VOICE.md');
  const blocksPath = path.join(bookDir, 'blocks.md');
  
  const voiceMd = fs.existsSync(voicePath) ? fs.readFileSync(voicePath, 'utf8') : '';
  const blocksMd = fs.existsSync(blocksPath) ? fs.readFileSync(blocksPath, 'utf8') : '';
  
  const blocksContext = extractRelevantBlocks(blocksMd, page.title, page.section);
  
  // Clean the original content for LLM
  const cleanedContent = cleanPageContent(page.content || '');
  
  return {
    pageNumber: page.no,
    title: page.title,
    section: page.section,
    originalSubtitle: page.subtitle || '',
    originalContent: page.content || '',
    cleanedContent: cleanPageContent(page.content || ''),
    actionCallout: page.actionCallout || { label: 'TRY THIS', content: '' },
    imagePrompt: page.imagePrompt || '',
    
    bookTitle: manifest.title || '',
    series: manifest.series || '',
    voiceMd,
    blocksMd: extractRelevantBlocks(blocksMd, page.title, page.section),
    
    pageWidth: 176,
    pageHeight: 250,
    diagramHeight: 150,
    targetWords: 65,
    maxWords: 85,
    
    currentOverflow: overflowData?.overflow || 0,
    currentWordCount: overflowData?.words || 0,
    
    designRules: DESIGN_RULES,
    voiceRules: VOICE_RULES,
    examples: SHOWCASE_EXAMPLES
  };
}

export { SHOWCASE_EXAMPLES, DESIGN_RULES, VOICE_RULES };