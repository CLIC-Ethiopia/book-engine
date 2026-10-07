export function classifyImage(prompt) {
  if (!prompt) return 'diagram';
  const lower = prompt.toLowerCase();
  const photoKeywords = ['photograph', 'photo of', 'image of', 'picture of', 'shot', 'real', 'physical', 'actual'];
  const diagramKeywords = ['diagram', 'schematic', 'chart', 'graph', 'flow', 'process',
    'system', 'architecture', 'vector', 'blueprint', 'before', 'after', 'comparison',
    'diagrammatic', 'technical drawing', 'cross-section', 'business model', 'network'];
  const isPhoto = photoKeywords.some((kw) => lower.includes(kw));
  const isDiagram = diagramKeywords.some((kw) => lower.includes(kw));
  if (isPhoto) return 'photo';
  if (isDiagram) return 'diagram';
  const physicalIndicators = ['fruit', 'plant', 'vegetable', 'tool', 'equipment', 'building',
    'construction', 'cabinet', 'tray', 'panel', 'device'];
  const hasPhysical = physicalIndicators.some((kw) => lower.includes(kw));
  return hasPhysical ? 'photo' : 'diagram';
}