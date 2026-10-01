import type { 
  KnowledgeSource, 
  TextChunk, 
  ConceptCandidate, 
  ConceptCandidateType, 
  ConceptExtractionResult 
} from '../types/knowledgeGraph';
import { chunkText, normalizeText } from './textExtraction';

/**
 * =========================================================================
 * CONCEPT EXTRACTION SERVICE (Day 2, Step 4)
 * Pipeline: SOURCE → TEXT → CHUNKS → CONCEPTS
 * =========================================================================
 */

export interface ConceptExtractionOptions {
  provider?: string;
  apiKey?: string;
  endpoint?: string;
  modelName?: string;
  minOccurrences?: number;
}

export interface ConceptExtractionProvider {
  name: string;
  extractConcepts(chunk: TextChunk): Promise<ConceptCandidate[]>;
  extractBatch?(chunks: TextChunk[]): Promise<ConceptCandidate[]>;
}

// -------------------------------------------------------------------------
// 1. STRICT QUALITY FILTERING LISTS (Avoid Keyword Cloud / Filler Words)
// -------------------------------------------------------------------------

const ACADEMIC_AND_GENERIC_FILLER = new Set([
  'introduction', 'intro', 'conclusion', 'conclusions', 'abstract', 'summary',
  'overview', 'outline', 'figure', 'figures', 'fig', 'table', 'tables',
  'section', 'sections', 'sec', 'chapter', 'chapters', 'page', 'pages',
  'paper', 'papers', 'article', 'articles', 'author', 'authors',
  'result', 'results', 'discussion', 'discussions', 'methodology', 'methodologies',
  'experiment', 'experiments', 'experimental results', 'background',
  'future work', 'related work', 'previous work', 'prior work', 'recent work',
  'recent advances', 'state of the art', 'appendix', 'appendices',
  'reference', 'references', 'bibliography', 'acknowledgements', 'acknowledgments',
  'et al', 'university', 'department', 'institute', 'press', 'edition',
  'lecture', 'lecture notes', 'notes', 'course', 'courses', 'syllabus',
  'example', 'examples', 'exercise', 'exercises', 'problem', 'problems',
  'question', 'questions', 'solution', 'solutions', 'homework', 'assignment',
  'step', 'steps', 'part', 'parts', 'case study', 'case studies',
  'analysis', 'evaluation', 'implementation', 'performance', 'accuracy',
  'advantage', 'advantages', 'disadvantage', 'disadvantages', 'limitation', 'limitations',
  'motivation', 'contribution', 'contributions', 'setup', 'setting', 'settings',
  'comparison', 'perspective', 'viewpoint', 'aspect', 'aspects',
  'definition', 'definitions', 'theorem', 'proof', 'lemma', 'corollary',
  'unlike', 'during', 'since', 'after', 'before', 'while', 'both', 'each', 'every',
  'some', 'all', 'then', 'thus', 'hence', 'therefore', 'however', 'furthermore', 'moreover'
]);

const GENERIC_VERBS = new Set([
  'using', 'based', 'proposed', 'developed', 'implemented', 'performing',
  'demonstrating', 'evaluating', 'providing', 'allowing', 'showing',
  'investigating', 'testing', 'analyzing', 'comparing', 'discussing',
  'presenting', 'introducing', 'applying', 'computing', 'calculating',
  'running', 'working', 'finding', 'achieving', 'requiring', 'consisting',
  'unlike', 'during', 'since', 'after', 'before', 'while'
]);

const GENERIC_ADJECTIVES = new Set([
  'various', 'novel', 'recent', 'different', 'important', 'simple', 'complex',
  'main', 'key', 'good', 'bad', 'better', 'best', 'new', 'modern', 'current',
  'standard', 'typical', 'general', 'specific', 'such', 'many', 'several',
  'first', 'second', 'third', 'high', 'low', 'great', 'small', 'large',
  'efficient', 'effective', 'successful', 'popular', 'common', 'traditional'
]);

const GENERIC_STANDALONE_NOUNS = new Set([
  'network', 'networks', 'layer', 'layers', 'model', 'models', 'method', 'methods',
  'system', 'systems', 'data', 'datum', 'problem', 'problems', 'algorithm', 'algorithms',
  'function', 'functions', 'feature', 'features', 'value', 'values', 'parameter', 'parameters',
  'weight', 'weights', 'node', 'nodes', 'graph', 'graphs', 'type', 'types', 'case', 'cases',
  'technique', 'techniques', 'approach', 'approaches', 'process', 'processes',
  'training', 'optimization', 'testing', 'validation', 'learning', 'evaluation'
]);

const APPROVED_TECHNICAL_ACRONYMS = new Set([
  'cnn', 'rnn', 'gan', 'svm', 'lstm', 'gru', 'llm', 'nlp', 'mlp', 'gnn', 'vae', 'sgd', 'pca', 'bert', 'gpt'
]);

/**
 * Validates candidate concept names against strict domain criteria.
 * Filters out keywords, filler, generic verbs, adjectives, and sentence fragments.
 */
export function isValidConceptName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();

  // Length constraints: between 3 and 50 characters
  if (trimmed.length < 3 || trimmed.length > 50) return false;

  // Reject citations and section headers: e.g. "Figure 1", "Section 3.2"
  if (/^(?:figure|fig|table|eq|equation|section|sec|chapter|page)\s+[0-9a-z.]+/i.test(trimmed)) {
    return false;
  }

  // Reject purely numbers or punctuation
  if (/^[0-9\s.,;:–—/-]+$/.test(trimmed)) return false;

  // Reject if contains sentence-ending punctuation or quotes
  if (/[.!?";]/.test(trimmed)) return false;

  const lower = trimmed.toLowerCase();

  // Reject direct academic filler words
  if (ACADEMIC_AND_GENERIC_FILLER.has(lower)) return false;

  const words = lower.split(/[\s-]+/).filter(Boolean);
  if (words.length === 0 || words.length > 5) return false;

  // Reject if starts with a generic verb (e.g. "Using the data")
  if (GENERIC_VERBS.has(words[0])) return false;

  // Reject boundary prepositions / conjunctions / determiners
  const badBoundary = /^(?:and|or|in|on|at|for|with|by|from|to|of|the|a|an|that|which|as|into|through|over|under)\b|\b(?:and|or|in|on|at|for|with|by|from|to|of|the|a|an|that|which|as|into|through|over|under)$/i;
  if (badBoundary.test(trimmed)) return false;

  // Reject internal conjunctions or prepositions (e.g. "Optimization and Training", "Architectures and Attention")
  if (/\b(?:and|or|in|on|at|for|with|by|from|to|of)\b/i.test(trimmed)) {
    if (!/^(?:state[- ]of[- ]the[- ]art|bag[- ]of[- ]words|field[- ]of[- ]view|chain[- ]of[- ]thought)$/i.test(trimmed)) {
      return false;
    }
  }

  // Single word checks:
  if (words.length === 1) {
    if (GENERIC_STANDALONE_NOUNS.has(words[0])) return false;
    if (GENERIC_ADJECTIVES.has(words[0])) return false;
    if (GENERIC_VERBS.has(words[0])) return false;
    if (!APPROVED_TECHNICAL_ACRONYMS.has(words[0])) {
      // Must be at least 4 chars and start with uppercase in original
      if (words[0].length < 4 || !/^[A-Z]/.test(trimmed)) return false;
    }
  }

  // 2-word generic combination check: generic adjective + generic noun (e.g. "Various Methods", "Novel Approach")
  if (words.length === 2) {
    if (GENERIC_ADJECTIVES.has(words[0]) && GENERIC_STANDALONE_NOUNS.has(words[1])) {
      return false;
    }
  }

  return true;
}

// -------------------------------------------------------------------------
// 2. CONCEPT TYPE CLASSIFIER
// Canonical Types: concept, topic, method, algorithm, architecture, theory, application, dataset, technology
// -------------------------------------------------------------------------

export function classifyConceptType(name: string, context?: string): ConceptCandidateType {
  const nameLower = name.toLowerCase();
  const contextLower = (context || '').toLowerCase();

  // 1. Direct Name Classification (Highest Precision)
  if (/\b(?:dataset|benchmark|corpus|imagenet|mnist|cifar|squad|glue|superglue|wordnet|wikipedia)\b/i.test(nameLower)) {
    return 'dataset';
  }
  if (/\b(?:technology|framework|library|pytorch|tensorflow|cuda|gpu|tpu|jax|hugging\s*face|keras|software|tool|scikit-learn)\b/i.test(nameLower)) {
    return 'technology';
  }
  if (/\b(?:algorithms?|backpropagation|gradient descent|sorting|search|k-means|clustering|optimization|dijkstra|simplex|tree search|monte carlo|q-learning)\b/i.test(nameLower)) {
    return 'algorithm';
  }
  if (/\b(?:architectures?|transformers?|convolutional neural networks?|neural networks?|cnns?|rnns?|lstms?|resnets?|encoders?|decoders?|mlps?|autoencoders?|gans?|foundation models?|backbones?|multilayer perceptrons?)\b/i.test(nameLower)) {
    return 'architecture';
  }
  if (/\b(?:attention|self-attention|multi-head|regularization|dropout|normalization|pooling|sampling|augmentation|fine-tuning|pre-training|pruning|masking|quantization)\b/i.test(nameLower)) {
    return 'method';
  }

  // 2. Contextual Sentence Classification
  if (/\b(?:benchmark dataset|training dataset|evaluation dataset|corpus)\b/i.test(contextLower)) {
    return 'dataset';
  }
  if (/\b(?:machine learning framework|software library|computational framework)\b/i.test(contextLower)) {
    return 'technology';
  }
  if (/\b(?:algorithms?|computes the gradient|optimization algorithm)\b/i.test(contextLower)) {
    return 'algorithm';
  }
  if (/\b(?:architectures?|neural networks?|model architecture)\b/i.test(contextLower)) {
    return 'architecture';
  }
  if (/\b(?:mechanisms?|techniques?|regularization method|training method)\b/i.test(contextLower)) {
    return 'method';
  }
  if (/\b(?:theory|theorem|law|bound|convergence|lemma|principle|hypothesis|tradeoff|guarantee|axiom)\b/i.test(nameLower) || /\b(?:theory|theorem|law|bound|convergence)\b/i.test(contextLower)) {
    return 'theory';
  }
  if (/\b(?:translation|recognition|detection|synthesis|generation|classification|segmentation|vision|robotics|speech|nlp|retrieval)\b/i.test(nameLower) || /\b(?:application|applied to|task of)\b/i.test(contextLower)) {
    return 'application';
  }
  if (/\b(?:field|domain|discipline|topic|subfield|subject|paradigm|area)\b/i.test(nameLower)) {
    return 'topic';
  }

  // 3. Default: Concept
  return 'concept';
}

// -------------------------------------------------------------------------
// 3. CONCISE DESCRIPTION EXTRACTOR (1–2 Sentences Maximum)
// -------------------------------------------------------------------------

export function extractConceptDescription(
  name: string,
  type: ConceptCandidateType,
  chunkTextContent: string,
  heading?: string
): string {
  const sentences = chunkTextContent
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 15);

  const escapedName = name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const nameRegex = new RegExp(`\\b${escapedName}\\b`, 'i');

  // 1. Look for definitive sentences containing defining verbs
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    if (nameRegex.test(s)) {
      if (/\b(?:is an?|are|refers to|is defined as|enables|computes|provides|allows|was proposed|acts as|serves as)\b/i.test(s)) {
        let desc = s;
        // Optionally append second sentence if first is very brief (< 16 words)
        if (i + 1 < sentences.length && desc.split(/\s+/).length < 16) {
          const nextS = sentences[i + 1];
          if (!nameRegex.test(nextS) && nextS.length < 100) {
            desc += ` ${nextS}`;
          }
        }
        if (desc.length > 200) {
          desc = `${desc.substring(0, 197).replace(/\s+\S*$/, '')}...`;
        }
        return desc;
      }
    }
  }

  // 2. Look for any descriptive sentence mentioning the concept
  for (const s of sentences) {
    if (nameRegex.test(s)) {
      let desc = s;
      if (desc.length > 200) {
        desc = `${desc.substring(0, 197).replace(/\s+\S*$/, '')}...`;
      }
      return desc;
    }
  }

  // 3. Fallback: Concise, informative one-sentence descriptor
  const contextSubject = heading ? ` in ${heading}` : '';
  return `${name} is a key ${type} discussed${contextSubject}.`;
}

// -------------------------------------------------------------------------
// 4. DEDUPLICATION PREPARATION (Day 2 Step 5 Normalization Prep)
// -------------------------------------------------------------------------

function normalizeConceptKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(?:the|a|an)\s+/i, '')
    .replace(/[^a-z0-9]/g, '');
}

function hasBetterCasing(candidateName: string, existingName: string): boolean {
  // Title Case or standard hyphenated capitalization is better than lowercase
  const candidateUpperCount = (candidateName.match(/[A-Z]/g) || []).length;
  const existingUpperCount = (existingName.match(/[A-Z]/g) || []).length;
  return candidateUpperCount > existingUpperCount;
}

function isBetterDescription(candidateDesc: string, existingDesc: string): boolean {
  const candidateHasDefinition = /\b(?:is an?|are|refers to|computes|enables)\b/i.test(candidateDesc);
  const existingHasDefinition = /\b(?:is an?|are|refers to|computes|enables)\b/i.test(existingDesc);

  if (candidateHasDefinition && !existingHasDefinition) return true;
  if (!candidateHasDefinition && existingHasDefinition) return false;

  // Prefer non-fallback descriptions
  const candidateIsFallback = candidateDesc.includes('discussed in') || candidateDesc.includes('key concept');
  const existingIsFallback = existingDesc.includes('discussed in') || existingDesc.includes('key concept');
  if (!candidateIsFallback && existingIsFallback) return true;

  return candidateDesc.length > existingDesc.length;
}

export function deduplicateConceptCandidates(candidates: ConceptCandidate[]): ConceptCandidate[] {
  const map = new Map<string, ConceptCandidate>();

  for (const c of candidates) {
    const key = normalizeConceptKey(c.name);
    if (!key) continue;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        ...c,
        occurrences: 1,
        sourceChunkIds: [c.sourceChunkId],
        confidence: c.confidence || 0.90
      });
    } else {
      // Merge occurrences across multiple chunks
      existing.occurrences = (existing.occurrences || 1) + 1;
      if (!existing.sourceChunkIds) {
        existing.sourceChunkIds = [existing.sourceChunkId];
      }
      if (!existing.sourceChunkIds.includes(c.sourceChunkId)) {
        existing.sourceChunkIds.push(c.sourceChunkId);
      }

      // Preserve better capitalization (e.g. "Transformer" > "transformer")
      if (hasBetterCasing(c.name, existing.name)) {
        existing.name = c.name;
      }

      // Upgrade generic 'concept' type if a more specific type was identified
      if (existing.type === 'concept' && c.type !== 'concept') {
        existing.type = c.type;
      }

      // Upgrade to a more informative description
      if (isBetterDescription(c.description, existing.description)) {
        existing.description = c.description;
      }

      // Boost confidence on repeated mentions
      existing.confidence = Math.min(0.99, (existing.confidence || 0.90) + 0.03);
    }
  }

  return Array.from(map.values());
}

// -------------------------------------------------------------------------
// 5. BUILT-IN PROVIDERS: HEURISTIC & LLM
// -------------------------------------------------------------------------

/**
 * Built-in Heuristic Extractor
 * Fast, deterministic, offline, and zero-dependency concept identification.
 */
export class HeuristicConceptExtractor implements ConceptExtractionProvider {
  name = 'heuristic';

  async extractConcepts(chunk: TextChunk): Promise<ConceptCandidate[]> {
    const candidates: ConceptCandidate[] = [];
    const seenNames = new Set<string>();

    const text = chunk.text;
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // 1. Definition patterns: e.g. "Self-Attention is...", "Backpropagation computes..."
    for (const line of lines) {
      const strippedLine = line.replace(/^(?:The|A|An)\s+/i, '');
      const defMatch = /^([A-Z][a-zA-Z0-9\s-]+?)\s+(?:is an?|are|refers to|is defined as|was proposed as|enables|allows|computes|injects)\b/i.exec(strippedLine);

      if (defMatch) {
        const rawName = defMatch[1].trim();
        if (isValidConceptName(rawName)) {
          const key = rawName.toLowerCase();
          if (!seenNames.has(key)) {
            seenNames.add(key);
            const type = classifyConceptType(rawName, line);
            const description = extractConceptDescription(rawName, type, text, chunk.heading);
            candidates.push({
              name: rawName,
              type,
              description,
              sourceId: chunk.sourceId,
              sourceChunkId: chunk.chunkId,
              confidence: 0.95
            });
          }
        }
      }
    }

    // 2. Heading Extraction: Chunks often have dedicated technical headings
    if (chunk.heading) {
      const headingTerm = chunk.heading.replace(/^#+\s*/, '').replace(/^(?:Section|Chapter|\d+\.)\s*/i, '').trim();
      if (isValidConceptName(headingTerm)) {
        const key = headingTerm.toLowerCase();
        if (!seenNames.has(key)) {
          seenNames.add(key);
          const type = classifyConceptType(headingTerm, text);
          const description = extractConceptDescription(headingTerm, type, text, chunk.heading);
          candidates.push({
            name: headingTerm,
            type,
            description,
            sourceId: chunk.sourceId,
            sourceChunkId: chunk.chunkId,
            confidence: 0.92
          });
        }
      }
    }

    // 3. Technical compound nouns & capitalized terms: e.g. "Convolutional Neural Networks", "Gradient Descent", "Transformer"
    const titleCaseRegex = /\b([A-Z][a-zA-Z0-9]*(?:[- ][A-Z][a-zA-Z0-9]*){0,3}|[A-Z]{2,6})\b/g;
    let match: RegExpExecArray | null;

    while ((match = titleCaseRegex.exec(text)) !== null) {
      let term = match[1].trim();
      // Strip leading determiners
      term = term.replace(/^(?:The|A|An)\s+/i, '');

      if (isValidConceptName(term)) {
        const key = term.toLowerCase();
        if (!seenNames.has(key)) {
          seenNames.add(key);
          const type = classifyConceptType(term, text);
          const description = extractConceptDescription(term, type, text, chunk.heading);
          candidates.push({
            name: term,
            type,
            description,
            sourceId: chunk.sourceId,
            sourceChunkId: chunk.chunkId,
            confidence: 0.88
          });
        }
      }
    }

    return candidates;
  }
}

/**
 * Structured LLM Concept Extractor
 * Pluggable provider for OpenAI / Gemini / Ollama / Custom API endpoints.
 * Returns structured JSON conforming to the ConceptCandidate schema.
 */
export class LLMConceptExtractor implements ConceptExtractionProvider {
  name = 'llm';
  private fallbackProvider = new HeuristicConceptExtractor();
  private options: {
    apiKey?: string;
    endpoint?: string;
    modelName?: string;
  };

  constructor(
    options: {
      apiKey?: string;
      endpoint?: string;
      modelName?: string;
    } = {}
  ) {
    this.options = options;
  }

  async extractConcepts(chunk: TextChunk): Promise<ConceptCandidate[]> {
    const envObj = typeof globalThis !== 'undefined' && 'process' in globalThis
      ? (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env
      : undefined;
    const apiKey = this.options.apiKey || envObj?.VITE_GEMINI_API_KEY || envObj?.GEMINI_API_KEY;
    
    // If no API key or endpoint configured, gracefully fallback to the deterministic heuristic provider
    if (!apiKey && !this.options.endpoint) {
      return this.fallbackProvider.extractConcepts(chunk);
    }

    const systemPrompt = `You are a knowledge graph concept extractor.
Extract meaningful, core educational concepts from the following text chunk.
Return a structured JSON array of concept objects.
Do not extract generic keywords, filler words, verbs, adjectives, or sentence fragments.

Each concept must have:
- name: string (canonical noun phrase)
- type: 'concept' | 'topic' | 'method' | 'algorithm' | 'architecture' | 'theory' | 'application' | 'dataset' | 'technology'
- description: string (1-2 sentences maximum explaining the concept)
- sourceId: "${chunk.sourceId}"
- sourceChunkId: "${chunk.chunkId}"`;

    try {
      const endpoint = this.options.endpoint || `https://generativelanguage.googleapis.com/v1beta/models/${this.options.modelName || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${systemPrompt}\n\nTEXT CHUNK:\n${chunk.text}`
            }]
          }],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        })
      });

      if (!response.ok) {
        return this.fallbackProvider.extractConcepts(chunk);
      }

      const data = await response.json();
      const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawJson) {
        return this.fallbackProvider.extractConcepts(chunk);
      }

      const parsed = JSON.parse(rawJson);
      if (!Array.isArray(parsed)) {
        return this.fallbackProvider.extractConcepts(chunk);
      }

      // Validate and clean each candidate
      const validCandidates: ConceptCandidate[] = [];
      for (const item of parsed) {
        if (item.name && isValidConceptName(item.name)) {
          validCandidates.push({
            name: item.name.trim(),
            type: classifyConceptType(item.name, item.type || chunk.text),
            description: item.description?.trim() || extractConceptDescription(item.name, item.type, chunk.text, chunk.heading),
            sourceId: chunk.sourceId,
            sourceChunkId: chunk.chunkId,
            confidence: 0.95
          });
        }
      }

      return validCandidates.length > 0 ? validCandidates : this.fallbackProvider.extractConcepts(chunk);
    } catch {
      // Graceful fallback to heuristic extraction
      return this.fallbackProvider.extractConcepts(chunk);
    }
  }
}

// -------------------------------------------------------------------------
// 6. SERVICE REGISTRY & MASTER EXTRACTION ENTRY POINTS
// -------------------------------------------------------------------------

export class ConceptExtractionService {
  private providers = new Map<string, ConceptExtractionProvider>();
  private defaultProviderName = 'heuristic';

  constructor() {
    this.registerProvider(new HeuristicConceptExtractor());
    this.registerProvider(new LLMConceptExtractor());
  }

  registerProvider(provider: ConceptExtractionProvider) {
    this.providers.set(provider.name, provider);
  }

  setDefaultProvider(name: string) {
    if (this.providers.has(name)) {
      this.defaultProviderName = name;
    }
  }

  getProvider(name?: string): ConceptExtractionProvider {
    const targetName = name || this.defaultProviderName;
    return this.providers.get(targetName) || this.providers.get('heuristic')!;
  }

  async extractFromChunks(
    chunks: TextChunk[], 
    options: ConceptExtractionOptions = {}
  ): Promise<ConceptCandidate[]> {
    if (!chunks || chunks.length === 0) return [];

    const provider = this.getProvider(options.provider);
    const allCandidates: ConceptCandidate[] = [];

    for (const chunk of chunks) {
      try {
        const chunkCandidates = await provider.extractConcepts(chunk);
        allCandidates.push(...chunkCandidates);
      } catch {
        // Continue extracting from remaining chunks
      }
    }

    // Deduplicate and prepare for Prompt 17 Normalization
    return deduplicateConceptCandidates(allCandidates);
  }
}

// Global default service instance
export const conceptExtractionService = new ConceptExtractionService();

/**
 * Convenience function: extract concepts directly from a list of TextChunks.
 */
export async function extractConceptsFromChunks(
  chunks: TextChunk[],
  options: ConceptExtractionOptions = {}
): Promise<ConceptCandidate[]> {
  return conceptExtractionService.extractFromChunks(chunks, options);
}

/**
 * Master Pipeline Entry Point
 * SOURCE → TEXT → CHUNKS → CONCEPTS
 * 
 * Accepts a KnowledgeSource and optional raw text/chunks,
 * performs chunking if needed, extracts concepts, and prepares deduplicated candidates.
 */
export async function extractConcepts(
  source: KnowledgeSource,
  textOrChunks?: string | TextChunk[],
  options: ConceptExtractionOptions = {}
): Promise<ConceptExtractionResult> {
  if (!source) {
    return {
      success: false,
      sourceId: 'unknown',
      concepts: [],
      error: 'Invalid source provided.'
    };
  }

  try {
    let chunks: TextChunk[] = [];

    if (Array.isArray(textOrChunks)) {
      chunks = textOrChunks;
    } else {
      const textToChunk = typeof textOrChunks === 'string' && textOrChunks.trim()
        ? textOrChunks
        : (source.text || '');

      const cleanText = normalizeText(textToChunk);
      if (!cleanText) {
        return {
          success: false,
          sourceId: source.id,
          concepts: [],
          error: "Couldn't read this file."
        };
      }

      chunks = chunkText(source.id, cleanText);
    }

    if (chunks.length === 0) {
      return {
        success: false,
        sourceId: source.id,
        concepts: [],
        error: "Couldn't read this file."
      };
    }

    const concepts = await extractConceptsFromChunks(chunks, options);

    return {
      success: true,
      sourceId: source.id,
      concepts,
      chunkCount: chunks.length
    };
  } catch {
    return {
      success: false,
      sourceId: source.id,
      concepts: [],
      error: "Couldn't read this file."
    };
  }
}
