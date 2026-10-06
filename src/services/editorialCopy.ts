import type { KnowledgeGraph, KnowledgeNode } from '../types/knowledgeGraph';

export interface GenerateGraphDescriptionOptions {
  isProcessing?: boolean;
}

// Noise / overly generic words to filter out from editorial concept selection
const GENERIC_CONCEPT_WORDS = new Set([
  'data',
  'information',
  'system',
  'systems',
  'overview',
  'introduction',
  'summary',
  'chapter',
  'concept',
  'concepts',
  'topic',
  'topics',
  'item',
  'items',
  'thing',
  'things',
  'object',
  'objects',
  'content',
  'study',
  'definition',
  'property',
  'method',
  'methods',
  'use',
  'uses',
  'view',
  'state',
  'length',
  'general summary'
]);

// Well-known uppercase acronyms that must retain uppercase styling
const ACRONYMS = new Set([
  'CPU',
  'RAM',
  'GPU',
  'OS',
  'API',
  'NLP',
  'CNN',
  'RNN',
  'LSTM',
  'LLM',
  'DNS',
  'TCP',
  'IP',
  'HTTP',
  'HTTPS',
  'SQL',
  'ACID',
  'REST',
  'DOM',
  'CSS',
  'HTML',
  'UI',
  'UX',
  'AI',
  'ML',
  'SVM',
  'BERT',
  'GPT',
  'CUDA',
  'FPGA',
  'ASIC',
  'BIOS',
  'PCI',
  'UUID',
  'FIFO',
  'LIFO',
  'LRU'
]);

// Conversational plural form mapping for standard singular concepts
const NATURAL_PLURAL_MAP: Record<string, string> = {
  process: 'processes',
  model: 'models',
  network: 'networks',
  thread: 'threads',
  algorithm: 'algorithms',
  representation: 'representations',
  mechanism: 'mechanisms',
  structure: 'structures',
  variable: 'variables',
  function: 'functions',
  component: 'components',
  layer: 'layers',
  architecture: 'architectures',
  technique: 'techniques',
  paradigm: 'paradigms',
  protocol: 'protocols',
  signal: 'signals'
};

/**
 * Format a concept name naturally for sentence composition.
 * Preserves recognized acronyms (e.g. CPU, RAM, GPU) while converting
 * standard capitalized nouns to smooth conversational lowercase.
 */
export function formatConceptForSpeech(name: string): string {
  const trimmed = (name || '').trim();
  if (!trimmed) return '';

  // If entire word is a known acronym, preserve uppercase
  if (ACRONYMS.has(trimmed.toUpperCase())) {
    return trimmed.toUpperCase();
  }

  // Split into words
  const words = trimmed.split(/\s+/);
  if (words.length === 1) {
    const single = words[0];
    const lower = single.toLowerCase();

    // Natural plural mapping if applicable
    if (NATURAL_PLURAL_MAP[lower]) {
      return NATURAL_PLURAL_MAP[lower];
    }

    if (ACRONYMS.has(single.toUpperCase())) {
      return single.toUpperCase();
    }

    return single.charAt(0).toLowerCase() + single.slice(1);
  }

  // Multi-word phrase: e.g. "CPU Scheduling" -> "CPU scheduling", "Neural Networks" -> "neural networks"
  return words
    .map((w, idx) => {
      if (ACRONYMS.has(w.toUpperCase())) {
        return w.toUpperCase();
      }
      if (idx === 0) {
        return w.charAt(0).toLowerCase() + w.slice(1);
      }
      return w.toLowerCase();
    })
    .join(' ');
}

function normalize(str: string): string {
  return (str || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isDuplicateOfGraphTitle(conceptName: string, graphTitle?: string): boolean {
  if (!graphTitle) return false;
  const normConcept = normalize(conceptName);
  const normTitle = normalize(graphTitle);
  if (!normConcept || !normTitle) return false;

  const singularConcept = normConcept.replace(/s$/, '');
  const singularTitle = normTitle.replace(/s$/, '');

  return normConcept === normTitle || singularConcept === singularTitle || normConcept === singularTitle || singularConcept === normTitle;
}

/**
 * Deterministic string hash to consistently pick a template for a given graph
 */
function hashSeed(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Rank concepts from actual graph data using degree centrality,
 * concept type significance, occurrence weight, and relevance.
 */
export function rankGraphConcepts(graph: KnowledgeGraph): KnowledgeNode[] {
  if (!graph || !graph.nodes || !Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    return [];
  }

  // Compute relationship participation (degree)
  const degreeMap = new Map<string, number>();
  if (graph.relationships && Array.isArray(graph.relationships)) {
    for (const rel of graph.relationships) {
      if (rel.source) degreeMap.set(rel.source, (degreeMap.get(rel.source) || 0) + 1);
      if (rel.target) degreeMap.set(rel.target, (degreeMap.get(rel.target) || 0) + 1);
    }
  }

  const seenNames = new Set<string>();
  const scoredNodes: { node: KnowledgeNode; score: number }[] = [];

  for (const node of graph.nodes) {
    const rawName = (node.name || '').trim();
    if (!rawName || rawName.length <= 1) continue;

    // Filter short noisy strings unless recognized acronym
    if (rawName.length <= 2 && !ACRONYMS.has(rawName.toUpperCase())) {
      continue;
    }

    // Filter duplicates of the graph title
    if (isDuplicateOfGraphTitle(rawName, graph.name)) {
      continue;
    }

    // Filter generic/implementation noise
    const lowerName = rawName.toLowerCase();
    if (GENERIC_CONCEPT_WORDS.has(lowerName) || GENERIC_CONCEPT_WORDS.has(lowerName.replace(/s$/, ''))) {
      continue;
    }

    // Avoid duplicate concepts with identical lowercased name
    const normKey = normalize(rawName);
    if (seenNames.has(normKey)) {
      continue;
    }
    seenNames.add(normKey);

    // Compute relevance score
    const degree = degreeMap.get(node.id) || 0;
    let score = degree * 3.5;

    // Core concept priority
    if (node.isCoreConcept || node.importance === 'core' || (typeof node.importance === 'number' && node.importance >= 0.7)) {
      score += 5;
    }

    // Concept type priority
    const type = (node.type || '').toLowerCase();
    if (type === 'foundation' || type === 'architecture' || type === 'paradigm' || type === 'process' || type === 'method') {
      score += 2.5;
    } else if (type === 'component' || type === 'property') {
      score += 1.5;
    }

    // Occurrences & evidence weight
    if (node.occurrences && node.occurrences > 1) {
      score += Math.min(3, node.occurrences * 0.5);
    }
    if (node.sourceIds && node.sourceIds.length > 1) {
      score += 1.5;
    }

    // Slight substance boost for multi-word technical concepts
    if (rawName.includes(' ')) {
      score += 1;
    }

    // Penalize isolated concepts if graph has active connections
    if (degree === 0 && degreeMap.size > 0) {
      score -= 5;
    }

    scoredNodes.push({ node, score });
  }

  // Sort descending by score -> degree -> name
  scoredNodes.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const degA = degreeMap.get(a.node.id) || 0;
    const degB = degreeMap.get(b.node.id) || 0;
    if (degB !== degA) return degB - degA;
    return a.node.name.localeCompare(b.node.name);
  });

  return scoredNodes.map(item => item.node);
}

/**
 * Deterministically generate dynamic editorial copy for the hero section
 * based on actual graph data.
 */
export function generateGraphDescription(
  graph?: KnowledgeGraph | null,
  options?: GenerateGraphDescriptionOptions
): string {
  // 1. Processing state
  if (options?.isProcessing) {
    return 'Your material is being mapped into connected ideas.';
  }

  // 2. Empty state (no graph or no nodes)
  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    return "Upload your material and we'll map the ideas inside it.";
  }

  // 3. Rank concepts from actual graph data
  const ranked = rankGraphConcepts(graph);

  // 4. Fallback if fewer than 3 meaningful concepts
  if (ranked.length === 0) {
    return "Upload your material and we'll map the ideas inside it.";
  }
  if (ranked.length < 3) {
    return 'Your material is beginning to take shape.';
  }

  // 5. Format top concepts for natural speech
  const c1 = formatConceptForSpeech(ranked[0].name);
  const c2 = formatConceptForSpeech(ranked[1].name);
  const c3 = formatConceptForSpeech(ranked[2].name);
  const c4 = ranked[3] ? formatConceptForSpeech(ranked[3].name) : undefined;

  // 6. Restrained, human, editorial templates
  const threeConceptTemplates = [
    `A map of ${c1}, ${c2}, and ${c3}, and how they connect.`,
    `A map of ${c1}, ${c2}, ${c3}, and the ideas connecting them.`,
    `${c1.charAt(0).toUpperCase() + c1.slice(1)}, ${c2}, and ${c3} connected through the ideas that bring them together.`,
    `A map of ${c1}, ${c2}, and ${c3}, and the systems that connect them.`,
    `From ${c1} to ${c2} and ${c3}: the concepts and relationships shaping this subject.`
  ];

  const fourConceptTemplates = c4 ? [
    `A map of ${c1}, ${c2}, ${c3}, and ${c4}, and how they connect.`,
    `A map of ${c1}, ${c2}, ${c3}, ${c4}, and the ideas connecting them.`,
    `Explore the relationships between ${c1}, ${c2}, ${c3}, and ${c4}.`,
    `A map of ${c1}, ${c2}, and ${c3}, and how they connect.`
  ] : threeConceptTemplates;

  // 7. Deterministically select template using graph metadata and concepts
  const seedString = `${graph.id || graph.name || 'default'}-${ranked.slice(0, 4).map(n => n.id).join('-')}`;
  const seed = hashSeed(seedString);

  if (c4 && ranked.length >= 4) {
    const idx = seed % fourConceptTemplates.length;
    return fourConceptTemplates[idx];
  }

  const idx = seed % threeConceptTemplates.length;
  return threeConceptTemplates[idx];
}
