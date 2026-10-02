/**
 * =========================================================================
 * CONCEPT QUALITY & RELEVANCE CONFIGURATION
 * Centralized settings, weights, thresholds, and linguistic dictionaries.
 * =========================================================================
 */

export interface ConceptScoreWeights {
  frequency: number;
  dispersion: number;
  heading: number;
  specificity: number;
  relationshipOrDefinition: number;
  contextQuality: number;
}

export interface ConceptPenalties {
  genericStandalonePenalty: number;
  sentenceInitialOnlyPenalty: number;
  singleMentionNoContextPenalty: number;
  shortWordPenalty: number;
}

export interface AdaptiveConceptLimits {
  smallDocument: {
    maxChunks: number;
    maxWords: number;
    maxConcepts: number;
  };
  mediumDocument: {
    maxChunks: number;
    maxWords: number;
    maxConcepts: number;
  };
  largeDocument: {
    maxConcepts: number;
  };
}

export interface ConceptQualityConfig {
  /**
   * Minimum composite relevance score (0.0 to 1.0) required to become a knowledge graph node.
   */
  minRelevanceScore: number;

  /**
   * Score component weights.
   */
  weights: ConceptScoreWeights;

  /**
   * Score penalties.
   */
  penalties: ConceptPenalties;

  /**
   * Dynamic concept limits based on document size.
   */
  adaptiveLimits: AdaptiveConceptLimits;

  /**
   * Hard cap override for maximum concepts in the primary graph view (optional).
   */
  maxConceptsOverride?: number;
}

export const DEFAULT_CONCEPT_QUALITY_CONFIG: ConceptQualityConfig = {
  minRelevanceScore: 0.45,
  weights: {
    frequency: 0.15,
    dispersion: 0.20,
    heading: 0.25,
    specificity: 0.20,
    relationshipOrDefinition: 0.15,
    contextQuality: 0.05
  },
  penalties: {
    genericStandalonePenalty: -0.55,
    sentenceInitialOnlyPenalty: -0.25,
    singleMentionNoContextPenalty: -0.30,
    shortWordPenalty: -0.35
  },
  adaptiveLimits: {
    smallDocument: {
      maxChunks: 3,
      maxWords: 1500,
      maxConcepts: 14
    },
    mediumDocument: {
      maxChunks: 12,
      maxWords: 8000,
      maxConcepts: 24
    },
    largeDocument: {
      maxConcepts: 38
    }
  }
};

// -------------------------------------------------------------------------
// LINGUISTIC & LEXICAL CLASSIFICATIONS
// -------------------------------------------------------------------------

/**
 * Broad generic nouns that are uninformative when appearing as standalone nodes.
 * Must generally be qualified by a domain modifier to be meaningful (e.g. "Operating System", not "System").
 */
export const GENERIC_BROAD_ROOTS = new Set([
  'system', 'systems',
  'data', 'datum',
  'method', 'methods',
  'process', 'processes',
  'use', 'uses', 'usage',
  'information', 'info',
  'example', 'examples',
  'result', 'results',
  'analysis', 'analyses',
  'case', 'cases',
  'problem', 'problems',
  'solution', 'solutions',
  'function', 'functions',
  'item', 'items',
  'thing', 'things',
  'way', 'ways',
  'step', 'steps',
  'part', 'parts',
  'level', 'levels',
  'stage', 'stages',
  'factor', 'factors',
  'detail', 'details',
  'aspect', 'aspects',
  'element', 'elements',
  'approach', 'approaches',
  'technique', 'techniques',
  'mechanism', 'mechanisms',
  'procedure', 'procedures',
  'practice', 'practices',
  'activity', 'activities',
  'work', 'works',
  'study', 'studies',
  'content', 'contents',
  'structure', 'structures',
  'model', 'models',
  'type', 'types',
  'kind', 'kinds',
  'form', 'forms',
  'mode', 'modes',
  'basis', 'bases',
  'view', 'views',
  'point', 'points',
  'area', 'areas',
  'field', 'fields',
  'role', 'roles',
  'pattern', 'patterns',
  'feature', 'features',
  'parameter', 'parameters',
  'variable', 'variables',
  'value', 'values',
  'metric', 'metrics',
  'score', 'scores',
  'input', 'inputs',
  'output', 'outputs',
  'state', 'states',
  'time', 'times',
  'concept', 'concepts',
  'topic', 'topics',
  'idea', 'ideas',
  'issue', 'issues',
  'task', 'tasks',
  'action', 'actions',
  'purpose', 'purposes',
  'application', 'applications',
  'development', 'developments',
  'difference', 'differences',
  'similarity', 'similarities'
]);

/**
 * Common adjectives and adverbs that should never stand alone as knowledge nodes.
 */
export const GENERIC_ADJECTIVES_AND_ADVERBS = new Set([
  'important', 'useful', 'different', 'various', 'general', 'specific',
  'good', 'bad', 'better', 'best', 'high', 'low', 'higher', 'lower',
  'simple', 'complex', 'new', 'old', 'modern', 'traditional', 'classical',
  'main', 'key', 'primary', 'secondary', 'major', 'minor',
  'central', 'crucial', 'essential', 'fundamental', 'critical', 'significant',
  'current', 'recent', 'standard', 'typical', 'common', 'popular',
  'effective', 'efficient', 'successful', 'accurate', 'relevant',
  'easy', 'hard', 'difficult', 'clear', 'broad', 'narrow',
  'large', 'small', 'great', 'huge', 'tiny', 'overall',
  'multiple', 'single', 'double', 'several', 'many', 'few',
  'early', 'late', 'fast', 'slow', 'direct', 'indirect',
  'basic', 'advanced', 'total', 'complete', 'partial',
  'possible', 'likely', 'certain', 'actual', 'real',
  'first', 'second', 'third', 'initial', 'final'
]);

/**
 * Common verbs that should never be treated as candidate concepts.
 */
export const GENERIC_VERB_ROOTS = new Set([
  'use', 'used', 'using',
  'make', 'makes', 'making', 'made',
  'take', 'takes', 'taking', 'took',
  'need', 'needs', 'needing', 'needed',
  'give', 'gives', 'giving', 'gave',
  'show', 'shows', 'showing', 'showed',
  'find', 'finds', 'finding', 'found',
  'get', 'gets', 'getting', 'got',
  'put', 'puts', 'putting',
  'see', 'sees', 'seeing', 'saw',
  'say', 'says', 'saying', 'said',
  'know', 'knows', 'knowing', 'knew',
  'run', 'runs', 'running', 'ran',
  'work', 'works', 'working', 'worked',
  'come', 'comes', 'coming', 'came',
  'become', 'becomes', 'becoming', 'became',
  'provide', 'provides', 'providing', 'provided',
  'allow', 'allows', 'allowing', 'allowed',
  'include', 'includes', 'including', 'included',
  'consider', 'considers', 'considering', 'considered',
  'apply', 'applies', 'applying', 'applied',
  'help', 'helps', 'helping', 'helped',
  'start', 'starts', 'starting', 'started',
  'keep', 'keeps', 'keeping', 'kept'
]);

/**
 * Academic publishing meta-terms and formatting artifacts.
 */
export const ACADEMIC_META_WORDS = new Set([
  'introduction', 'intro', 'conclusion', 'conclusions', 'abstract', 'summary',
  'overview', 'outline', 'figure', 'figures', 'fig', 'table', 'tables',
  'section', 'sections', 'sec', 'chapter', 'chapters', 'page', 'pages',
  'paper', 'papers', 'article', 'articles', 'author', 'authors',
  'result', 'results', 'discussion', 'discussions', 'methodology', 'methodologies',
  'experiment', 'experiments', 'background', 'future work', 'related work',
  'previous work', 'prior work', 'state of the art', 'appendix', 'appendices',
  'reference', 'references', 'bibliography', 'acknowledgements', 'acknowledgments',
  'lecture', 'lecture notes', 'notes', 'course', 'courses', 'syllabus',
  'consideration', 'considerations', 'remark', 'remarks',
  'example', 'examples', 'exercise', 'exercises', 'problem', 'problems',
  'question', 'questions', 'solution', 'solutions', 'homework', 'assignment',
  'case study', 'case studies', 'definition', 'definitions', 'theorem', 'proof',
  'et al', 'university', 'department', 'institute', 'press', 'edition'
]);

/**
 * Recognized high-value technical acronyms that should be protected as genuine concepts.
 */
export const TECHNICAL_DOMAIN_ACRONYMS = new Set([
  // Computer Systems & Architecture
  'cpu', 'gpu', 'tpu', 'ram', 'rom', 'mmu', 'ipc', 'os', 'io', 'dma', 'alu', 'cache',
  'fifo', 'lru', 'pcb', 'tlb', 'smp', 'numa', 'raid', 'bios', 'uefi',
  // Machine Learning & AI
  'cnn', 'rnn', 'lstm', 'gru', 'gan', 'svm', 'mlp', 'gnn', 'vae', 'llm', 'nlp',
  'sgd', 'pca', 'bert', 'gpt', 'rl', 'ann', 'dnn', 'knn', 'nlp', 'ocr', 'ner',
  // Networking & Web
  'http', 'https', 'tcp', 'udp', 'ip', 'dns', 'api', 'rest', 'json', 'xml',
  'sql', 'nosql', 'dom', 'css', 'html', 'jwt', 'tls', 'ssl', 'ssh', 'ftp',
  // Algorithms & Data Structures
  'ast', 'dag', 'dfs', 'bfs', 'mst', 'dp', 'sat'
]);
