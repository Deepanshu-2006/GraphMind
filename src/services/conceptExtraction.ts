import type { 
  KnowledgeSource, 
  TextChunk, 
  ConceptCandidate, 
  ConceptCandidateType, 
  ConceptExtractionResult,
  DocumentProfile
} from '../types/knowledgeGraph';
import { chunkText, normalizeText } from './textExtraction';
import { buildDocumentProfile } from './documentUnderstanding';
import { 
  TECHNICAL_DOMAIN_ACRONYMS,
  GENERIC_BROAD_ROOTS,
  DEFAULT_CONCEPT_QUALITY_CONFIG,
  type ConceptQualityConfig 
} from '../config/conceptQuality';
import { evaluateAndFilterCandidates, isGenericConceptPhrase } from './conceptRelevance';

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
  qualityConfig?: Partial<ConceptQualityConfig>;
  documentProfile?: DocumentProfile;
}

export interface ConceptExtractionProvider {
  name: string;
  extractConcepts(chunk: TextChunk, documentProfile?: DocumentProfile): Promise<ConceptCandidate[]>;
  extractBatch?(chunks: TextChunk[], documentProfile?: DocumentProfile): Promise<ConceptCandidate[]>;
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
  'some', 'all', 'then', 'thus', 'hence', 'therefore', 'however', 'furthermore', 'moreover',
  // Educational meta and abstract empty words
  'concept', 'concepts', 'topic', 'topics', 'idea', 'ideas', 'detail', 'details',
  'element', 'elements', 'factor', 'factors', 'item', 'items', 'thing', 'things',
  'level', 'levels', 'stage', 'stages', 'way', 'ways', 'field', 'fields',
  'area', 'areas', 'domain', 'domains', 'basics', 'fundamentals', 'principles',
  'difference', 'differences', 'similarity', 'similarities', 'role', 'roles',
  'purpose', 'purposes', 'scope', 'scopes', 'feature', 'features', 'key', 'keys',
  'type', 'types', 'kind', 'kinds', 'form', 'forms', 'mode', 'modes',
  'foundation', 'foundations'
]);

const GENERIC_VERBS = new Set([
  'using', 'based', 'proposed', 'developed', 'implemented', 'performing',
  'demonstrating', 'evaluating', 'providing', 'allowing', 'showing',
  'investigating', 'testing', 'analyzing', 'comparing', 'discussing',
  'presenting', 'introducing', 'applying', 'computing', 'calculating',
  'running', 'working', 'finding', 'achieving', 'requiring', 'consisting',
  'learning', 'understanding', 'exploring', 'building', 'designing',
  'improving', 'modifying', 'adapting', 'operating', 'producing',
  'unlike', 'during', 'since', 'after', 'before', 'while'
]);

const GENERIC_ADJECTIVES = new Set([
  'various', 'novel', 'recent', 'different', 'important', 'simple', 'complex',
  'main', 'key', 'good', 'bad', 'better', 'best', 'new', 'modern', 'current',
  'standard', 'typical', 'general', 'specific', 'such', 'many', 'several',
  'first', 'second', 'third', 'high', 'low', 'great', 'small', 'large',
  'efficient', 'effective', 'successful', 'popular', 'common', 'traditional',
  'deep', 'neural', 'artificial', 'supervised', 'unsupervised', 'convolutional', 'recurrent',
  'primary', 'secondary', 'major', 'minor', 'fundamental', 'crucial', 'central',
  'stochastic', 'specialized', 'advanced', 'classical', 'probabilistic', 'statistical',
  'computational', 'empirical', 'theoretical', 'mathematical'
]);

const GENERIC_STANDALONE_NOUNS = new Set([
  'network', 'networks', 'layer', 'layers', 'model', 'models', 'method', 'methods',
  'system', 'systems', 'data', 'datum', 'problem', 'problems', 'algorithm', 'algorithms',
  'function', 'functions', 'feature', 'features', 'value', 'values', 'parameter', 'parameters',
  'weight', 'weights', 'node', 'nodes', 'graph', 'graphs', 'type', 'types', 'case', 'cases',
  'technique', 'techniques', 'approach', 'approaches', 'process', 'processes',
  'training', 'optimization', 'testing', 'validation', 'learning', 'evaluation',
  'concept', 'concepts', 'topic', 'topics', 'idea', 'ideas', 'aspect', 'aspects',
  'element', 'elements', 'factor', 'factors', 'component', 'components',
  'information', 'knowledge', 'content', 'mechanism', 'mechanisms', 'procedure', 'procedures',
  'structure', 'structures', 'pattern', 'patterns', 'metric', 'metrics', 'score', 'scores',
  'input', 'inputs', 'output', 'outputs', 'loss', 'losses', 'error', 'errors',
  'foundation', 'foundations', 'architecture', 'architectures',
  ...GENERIC_BROAD_ROOTS
]);

const CONVERSATIONAL_FRAGMENTS = new Set([
  'also known as', 'on the other hand', 'in contrast', 'first of all', 'in particular',
  'for instance', 'such as', 'key differences', 'main advantages', 'core concepts',
  'key takeaways', 'important note', 'next steps', 'quick summary', 'in addition',
  'according to', 'we observe that', 'it is known that', 'as well as', 'more specifically'
]);

const APPROVED_TECHNICAL_ACRONYMS = new Set([
  'cnn', 'rnn', 'gan', 'svm', 'lstm', 'gru', 'llm', 'nlp', 'mlp', 'gnn', 'vae', 'sgd', 'pca', 'bert', 'gpt', 'rl',
  ...TECHNICAL_DOMAIN_ACRONYMS
]);

const TECHNICAL_COMPOUND_EXCEPTIONS = new Set([
  'deep learning', 'neural network', 'neural networks', 'machine learning',
  'convolutional network', 'convolutional networks',
  'convolutional neural network', 'convolutional neural networks',
  'recurrent network', 'recurrent networks',
  'recurrent neural network', 'recurrent neural networks',
  'linear regression', 'logistic regression', 'random forest', 'decision tree',
  'support vector', 'support vector machine', 'support vector machines',
  'artificial intelligence', 'computer vision', 'reinforcement learning',
  'supervised learning', 'unsupervised learning', 'gradient descent', 'generative model', 'generative models',
  'large language model', 'large language models', 'graph neural network', 'graph neural networks',
  'stochastic gradient descent', 'natural language processing', 'self-attention',
  'operating system', 'operating systems', 'virtual memory', 'process scheduling',
  'memory management', 'memory management unit', 'central processing unit',
  'inter-process communication', 'process control block', 'translation lookaside buffer',
  'page fault', 'file system', 'file systems', 'distributed system', 'distributed systems',
  'relational database', 'data structure', 'data structures', 'round robin',
  'shortest job first', 'priority scheduling', 'learning rate', 'loss function', 'activation function',
  // Educational & Science Domain Compounds (Physics, Optics, Math)
  'spherical mirror', 'spherical mirrors', 'concave mirror', 'concave mirrors',
  'convex mirror', 'convex mirrors', 'mirror formula', 'magnification',
  'principal axis', 'focal length', 'center of curvature', 'radius of curvature',
  'total internal reflection', 'refraction of light', 'reflection of light',
  'artificial neural network', 'backpropagation algorithm', 'object oriented programming'
]);

/**
 * Strips educational meta-prefixes and book/section titles to expose the substantive concept.
 * e.g. "Introduction to Deep Learning" -> "Deep Learning"
 * e.g. "Understanding Transformers" -> "Transformers"
 * e.g. "Foundations of Deep Learning" -> "Deep Learning"
 */
export function cleanConceptCandidateName(rawName: string): string {
  if (!rawName || typeof rawName !== 'string') return '';
  let clean = rawName.trim();

  // Strip leading list bullet or numbering e.g. "1. ", "A. "
  clean = clean.replace(/^(?:[\d]+[.)]|[A-Z]\.)\s*/, '');

  // Strip leading educational chapter/section meta-prefixes
  clean = clean.replace(
    /^(?:an?\s+)?(?:introduction to|overview of|basics of|the basics of|fundamentals of|the fundamentals of|principles of|the principles of|foundations? of|the foundations? of|understanding|exploring|implementing|the role of|a guide to|concepts of|applications of|key concepts of|summary of|a primer on)\s+/i,
    ''
  );

  // Strip leading determiners and demonstratives
  clean = clean.replace(/^(?:the|a|an|these|those|this|their|its|our|some|many|such)\s+/i, '');

  // Strip trailing punctuation, colons, or dashes
  clean = clean.replace(/[:;,\-—–.]*$/, '').trim();

  return clean;
}

const PRONOUNS_AND_DETERMINERS = new Set([
  'the', 'a', 'an', 'this', 'that', 'these', 'those', 'there', 'here',
  'it', 'its', 'they', 'them', 'their', 'we', 'us', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her',
  'user', 'users', 'someone', 'everyone', 'anyone', 'some', 'many', 'such', 'each', 'every', 'all', 'both', 'few', 'other', 'another', 'more', 'most'
]);

export function isStructurallyValidCandidateName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const cleaned = cleanConceptCandidateName(name);

  // Length constraints: between 2 and 50 characters
  if (cleaned.length < 2 || cleaned.length > 50) return false;

  const lower = cleaned.toLowerCase();

  // Reject pronouns and determiners
  if (PRONOUNS_AND_DETERMINERS.has(lower)) return false;

  // Reject citations and section headers: e.g. "Figure 1", "Section 3.2"
  if (/^(?:figure|fig|table|eq|equation|section|sec|chapter|page)\s+[0-9a-z.]+/i.test(cleaned)) {
    return false;
  }

  // Reject purely numbers or punctuation
  if (/^[0-9\s.,;:–—/-]+$/.test(cleaned)) return false;

  // Reject math symbols, brackets, or slashes inside names (e.g. "W KHUH/v")
  if (/[/\\<>=+_{}[\]|~^]/.test(cleaned)) return false;

  // Reject if contains sentence-ending punctuation or quotes
  if (/[.!?";]/.test(cleaned)) return false;

  // Reject conversational sentence fragments
  if (CONVERSATIONAL_FRAGMENTS.has(lower)) return false;

  // Reject phrases starting with verbs, interrogatives, conjunctions, or prepositions (e.g. "is different in...")
  if (/^(?:what|how|why|when|where|which|who|whom|whose|that|whether|is|are|was|were|be|been|being|have|has|had|do|does|did|can|could|will|would|should|may|might|must|and|or|if|because|since|although|while|so|but|yet)\b/i.test(cleaned)) {
    return false;
  }

  // Reject phrases ending with verbs, auxiliary verbs, conjunctions, determiners, or prepositions (e.g. "Power Of A")
  if (/\b(?:is|are|was|were|be|been|being|have|has|had|do|does|did|can|could|will|would|should|may|might|must|and|or|in|on|at|for|with|by|from|to|of|as|than|into|through|over|under|a|an|the|that|which|whose|to)$/i.test(cleaned)) {
    return false;
  }

  // Reject heading boilerplate phrases like "Some Terms Related To...", "Terms Related To...", "Important Terms..."
  if (/^(?:some|key|general|important|various|basic|different|common)?\s*terms?\s+(?:related|pertaining)\s+to\b/i.test(cleaned)) {
    return false;
  }

  // Reject direct academic filler words
  if (ACADEMIC_AND_GENERIC_FILLER.has(lower)) return false;

  const words = lower.split(/[\s-]+/).filter(Boolean);
  if (words.length === 0 || words.length > 5) return false;

  // Reject OCR fragments: words with no standard vowels (e.g. "Chr Om", "Refl")
  for (const w of words) {
    if (w.length >= 3 && !/[aeiouy]/i.test(w) && !TECHNICAL_DOMAIN_ACRONYMS.has(w)) {
      return false;
    }
  }

  return true;
}

/**
 * Validates candidate concept names against strict domain criteria.
 * Filters out keywords, filler, generic verbs, adjectives, and sentence fragments.
 * Accepts specialized terms if recognized within the document's domain profile.
 */
export function isValidConceptName(name: string, documentProfile?: DocumentProfile): boolean {
  if (!name || typeof name !== 'string') return false;
  const cleaned = cleanConceptCandidateName(name);

  // Length constraints: between 3 and 50 characters
  if (cleaned.length < 3 || cleaned.length > 50) return false;

  const lower = cleaned.toLowerCase();
  if (PRONOUNS_AND_DETERMINERS.has(lower)) return false;

  // Reject citations and section headers: e.g. "Figure 1", "Section 3.2"
  if (/^(?:figure|fig|table|eq|equation|section|sec|chapter|page)\s+[0-9a-z.]+/i.test(cleaned)) {
    return false;
  }

  // Reject purely numbers or punctuation
  if (/^[0-9\s.,;:–—/-]+$/.test(cleaned)) return false;

  // Reject if contains sentence-ending punctuation or quotes
  if (/[.!?";]/.test(cleaned)) return false;

  // Reject conversational sentence fragments
  if (CONVERSATIONAL_FRAGMENTS.has(lower)) return false;

  // Reject phrases starting with interrogatives or relative pronouns
  if (/^(?:what|how|why|when|where|which|who|whom|whose|that|whether)\b/i.test(cleaned)) {
    return false;
  }

  // Reject phrases ending with verbs, auxiliary verbs, conjunctions, or prepositions
  if (/\b(?:is|are|was|were|be|been|being|have|has|had|do|does|did|can|could|will|would|should|may|might|must|and|or|in|on|at|for|with|by|from|to|of|as|than|into|through|over|under)$/i.test(cleaned)) {
    return false;
  }

  // Reject direct academic filler words
  if (ACADEMIC_AND_GENERIC_FILLER.has(lower)) return false;

  const words = lower.split(/[\s-]+/).filter(Boolean);
  if (words.length === 0 || words.length > 5) return false;

  // Check if this term is recognized as specialized in the document's domain context
  const isDocumentDomainTerm = Boolean(
    documentProfile && (
      documentProfile.domainKeywords.some(dk => dk.toLowerCase() === lower) ||
      documentProfile.majorTopics.some(mt => {
        const mtLower = mt.toLowerCase();
        return mtLower === lower || (mtLower.split(/\s+/).includes(lower) && !GENERIC_STANDALONE_NOUNS.has(lower));
      }) ||
      documentProfile.definitionsFound.some(df => df.term.toLowerCase() === lower)
    )
  );

  // Reject if starts with a generic verb (e.g. "Using the data"), unless recognized technical compound
  if (GENERIC_VERBS.has(words[0])) {
    const isApprovedVerbCompound = TECHNICAL_COMPOUND_EXCEPTIONS.has(lower) ||
      isDocumentDomainTerm ||
      (words[0] === 'operating' && words[1] === 'system') ||
      (words[0] === 'learning' && (words[1] === 'rate' || words[1] === 'algorithm' || words[1] === 'curve')) ||
      (words[0] === 'training' && (words[1] === 'set' || words[1] === 'data' || words[1] === 'loss' || words[1] === 'step')) ||
      (words[0] === 'routing' && (words[1] === 'protocol' || words[1] === 'table' || words[1] === 'algorithm'));

    if (!isApprovedVerbCompound) return false;
  }

  // Reject boundary prepositions / conjunctions / determiners
  const badBoundary = /^(?:and|or|in|on|at|for|with|by|from|to|of|the|a|an|that|which|as|into|through|over|under)\b|\b(?:and|or|in|on|at|for|with|by|from|to|of|the|a|an|that|which|as|into|through|over|under)$/i;
  if (badBoundary.test(cleaned)) return false;

  // Reject internal conjunctions or prepositions (e.g. "Optimization and Training", "Architectures and Attention")
  if (/\b(?:and|or|in|on|at|for|with|by|from|to|of)\b/i.test(cleaned)) {
    if (!/^(?:state[- ]of[- ]the[- ]art|bag[- ]of[- ]words|field[- ]of[- ]view|chain[- ]of[- ]thought|center[- ]of[- ]curvature|radius[- ]of[- ]curvature|refraction[- ]of[- ]light|reflection[- ]of[- ]light)$/i.test(cleaned)) {
      return false;
    }
  }

  // Single word checks:
  if (words.length === 1) {
    if (GENERIC_STANDALONE_NOUNS.has(words[0])) return false;
    if (GENERIC_ADJECTIVES.has(words[0])) return false;
    if (GENERIC_VERBS.has(words[0])) return false;
    if (!isDocumentDomainTerm && !APPROVED_TECHNICAL_ACRONYMS.has(words[0])) {
      // Must be at least 4 chars and start with uppercase in original
      if (words[0].length < 4 || !/^[A-Z]/.test(cleaned)) return false;
    }
  }

  // Reject multi-word phrases where every single word is a generic filler, adjective, or noun
  // e.g. "Specialized Model Architecture", "Various Methods", "Modern Neural Architecture"
  if (words.length >= 2 && !TECHNICAL_COMPOUND_EXCEPTIONS.has(lower) && !isDocumentDomainTerm) {
    const allGeneric = words.every(
      w => GENERIC_ADJECTIVES.has(w) || GENERIC_STANDALONE_NOUNS.has(w) || ACADEMIC_AND_GENERIC_FILLER.has(w)
    );
    if (allGeneric) return false;
  }

  if (isGenericConceptPhrase(cleaned, documentProfile).isGeneric) {
    return false;
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

  // 1. Formula & Equation
  if (/\b(?:formula|formulas?|equation|equations?|ratio|snell's law)\b/i.test(nameLower) || /\b(?:formula|equation)\b/i.test(contextLower)) {
    return 'Formula';
  }
  // 2. Principle, Law & Theorem
  if (/\b(?:principle|principles?|theorem|theorems?|rule|rules?|postulate|axiom|hypothesis|guarantee)\b/i.test(nameLower) || /\b(?:principle|theorem|law|axiom)\b/i.test(contextLower)) {
    return 'Principle';
  }
  // 3. Algorithm & Computational procedure
  if (/\b(?:algorithms?|backpropagation|gradient descent|sorting|search|k-means|clustering|optimization|dijkstra|simplex|monte carlo|q-learning|round robin|shortest job first)\b/i.test(nameLower) || /\b(?:algorithm|computational procedure)\b/i.test(contextLower)) {
    return 'Algorithm';
  }
  // 4. Process & Workflow
  if (/\b(?:process|processes?|scheduling|execution|routine|lifecycle|pipeline|workflow|procedure|reflection|refraction|propagation)\b/i.test(nameLower) || /\b(?:sequence of steps|process of|step-by-step)\b/i.test(contextLower)) {
    return 'Process';
  }
  // 5. Method & Technique
  if (/\b(?:methods?|techniques?|regularization|dropout|normalization|pooling|sampling|augmentation|fine-tuning|pre-training|pruning|quantization)\b/i.test(nameLower) || /\b(?:technique|methodology)\b/i.test(contextLower)) {
    return 'Method';
  }
  // 6. Theory & Framework
  if (/\b(?:theory|theories?|framework|paradigm|formalism|tradeoff|bound|convergence)\b/i.test(nameLower) || /\b(?:theoretical|theory)\b/i.test(contextLower)) {
    return 'Theory';
  }
  // 7. Component & Subsystem
  if (/\b(?:components?|layer|layers?|unit|units?|subsystem|hardware|cpu|mmu|gpu|tpu|cache|register|core|memory|transistor)\b/i.test(nameLower) || /\b(?:hardware component|architectural unit)\b/i.test(contextLower)) {
    return 'Component';
  }
  // 8. Object & Physical Instrument
  if (/\b(?:mirrors?|spherical mirror|concave mirror|convex mirror|lens|lenses?|prism|device|sensor|instrument|medium)\b/i.test(nameLower)) {
    return 'Object';
  }
  // 9. Property & Metric
  if (/\b(?:curvature|focal length|magnification|refractive index|aperture|radius|frequency|wavelength|bandwidth|latency|dimension|accuracy|loss)\b/i.test(nameLower)) {
    return 'Property';
  }
  // 10. Application
  if (/\b(?:dataset|benchmark|imagenet|mnist|cifar|squad|glue)\b/i.test(nameLower)) {
    return 'Application';
  }
  if (/\b(?:translation|recognition|detection|synthesis|generation|classification|segmentation|vision|robotics|speech|nlp|retrieval)\b/i.test(nameLower) || /\b(?:application|applied to)\b/i.test(contextLower)) {
    return 'Application';
  }
  // 11. Topic
  if (/\b(?:field|domain|discipline|topic|subfield|subject|chapter|section)\b/i.test(nameLower)) {
    return 'Topic';
  }

  // 12. Default: Concept
  return 'Concept';
}

// -------------------------------------------------------------------------
// 3. CONCISE EDUCATIONAL DESCRIPTION EXTRACTOR (1–2 Sentences Maximum)
// -------------------------------------------------------------------------

/**
 * Cleans extracted sentences: strips citations, footnote numbers, paper boilerplate, and hype.
 */
function cleanEducationalSentence(text: string): string {
  let s = text.trim();
  // Strip leading list bullet or numbering e.g. "1. ", "- ", "• "
  s = s.replace(/^(?:[\d]+[.)]|\*|-|•)\s*/, '');
  // Strip citations like "[1]", "[12, 14]", "(Vaswani et al., 2017)", "(Smith, 2020)"
  s = s.replace(/\[\d+(?:[,\s–-]+\d+)*\]/g, '');
  s = s.replace(/\([A-Z][A-Za-z\s.,]+(?:et\s+al\.)?,\s*\d{4}[a-z]?\)/g, '');
  // Strip meta phrases and paper boilerplate
  s = s.replace(/\b(?:in this (?:paper|section|chapter|work|study|article)|we (?:propose|demonstrate|show|introduce|present|find)|our (?:results|experiments|work|method|architecture)|as shown in (?:figure|table)\s*[\d.]*)\b,?\s*/gi, '');
  // Strip marketing hype
  s = s.replace(/\b(?:state[- ]of[- ]the[- ]art|revolutionar(?:y|izing)|game[- ]changing|groundbreaking|unprecedented|dramatically|drastically)\b\s*/gi, '');
  // Consolidate whitespace
  s = s.replace(/\s+/g, ' ').trim();
  // Ensure first character capitalized
  if (s.length > 0) {
    s = s.charAt(0).toUpperCase() + s.slice(1);
  }
  // Ensure ends with a period
  if (s.length > 0 && !/[.!?]$/.test(s)) {
    s += '.';
  }
  return s;
}

/**
 * Provides a clean, educational, factual fallback descriptor free of AI/meta jargon.
 */
function getEducationalFallbackDescription(name: string, type: ConceptCandidateType): string {
  const norm = (type || 'concept').toLowerCase();
  switch (norm) {
    case 'formula':
      return `${name} is a mathematical formulation expressing the relationship between key physical or operational variables.`;
    case 'principle':
      return `${name} is a foundational principle or physical law governing system behavior and interactions.`;
    case 'process':
      return `${name} is a systematic sequence of operations or state transitions that transforms input or system state.`;
    case 'algorithm':
      return `${name} is an algorithmic procedure used for optimization, search, or decision-making.`;
    case 'architecture':
    case 'component':
      return `${name} is an essential structural unit or component specifying organization and operational flow.`;
    case 'object':
      return `${name} is a physical or conceptual entity with specific operational and reflective properties.`;
    case 'property':
      return `${name} is a quantitative or qualitative attribute characterizing the subject.`;
    case 'method':
      return `${name} is a systematic methodology applied to process, transform, or regularize representations.`;
    case 'theory':
      return `${name} is a theoretical principle providing foundational mathematical or conceptual guarantees.`;
    case 'application':
      return `${name} is an applied domain where computational or physical models are deployed.`;
    case 'dataset':
      return `${name} is a curated benchmark dataset used to train, evaluate, and compare models.`;
    case 'technology':
      return `${name} is a software framework or system tool supporting computational workflows.`;
    case 'topic':
      return `${name} is a foundational subject area explored throughout the learning material.`;
    case 'concept':
    default:
      return `${name} is a core foundational concept representing key knowledge in this subject.`;
  }
}

export function extractConceptDescription(
  name: string,
  type: ConceptCandidateType,
  chunkTextContent: string,
  _heading?: string
): string {
  const sentences = chunkTextContent
    .split(/(?<=[.!?])\s+|\n+/)
    .map(s => s.trim())
    .filter(s => s.length > 15 && !s.startsWith('#') && !/^[\d.]+\s+[A-Z]/.test(s));

  const escapedName = name.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const nameRegex = new RegExp(`\\b${escapedName}\\b`, 'i');

  // 1. Look for definitive sentences containing defining verbs
  for (let i = 0; i < sentences.length; i++) {
    const s = sentences[i];
    if (nameRegex.test(s)) {
      if (/\b(?:is an?|are|refers to|is defined as|enables|computes|provides|allows|was proposed|acts as|serves as)\b/i.test(s)) {
        let desc = cleanEducationalSentence(s);
        // Optionally append second sentence if first is very brief (< 12 words)
        if (i + 1 < sentences.length && desc.split(/\s+/).length < 12) {
          const nextS = cleanEducationalSentence(sentences[i + 1]);
          if (!nameRegex.test(nextS) && nextS.length < 90) {
            desc = `${desc} ${nextS}`;
          }
        }
        if (desc.length > 185) {
          desc = `${desc.substring(0, 182).replace(/\s+\S*$/, '')}...`;
        }
        if (desc.length >= 25) {
          return desc;
        }
      }
    }
  }

  // 2. Look for any descriptive sentence mentioning the concept
  for (const s of sentences) {
    if (nameRegex.test(s)) {
      let desc = cleanEducationalSentence(s);
      if (desc.length > 185) {
        desc = `${desc.substring(0, 182).replace(/\s+\S*$/, '')}...`;
      }
      if (desc.length >= 25) {
        return desc;
      }
    }
  }

  // 3. Fallback: Concise, informative educational descriptor
  return getEducationalFallbackDescription(name, type);
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
        sourceChunkIds: c.sourceChunkIds?.length ? [...c.sourceChunkIds] : [c.sourceChunkId],
        confidence: c.confidence || 0.90
      });
    } else {
      // Merge occurrences across multiple chunks
      existing.occurrences = (existing.occurrences || 1) + 1;
      if (!existing.sourceChunkIds) {
        existing.sourceChunkIds = [existing.sourceChunkId];
      }
      const idsToAdd = c.sourceChunkIds?.length ? c.sourceChunkIds : [c.sourceChunkId];
      for (const id of idsToAdd) {
        if (!existing.sourceChunkIds.includes(id)) {
          existing.sourceChunkIds.push(id);
        }
      }

      // Preserve better capitalization (e.g. "Transformer" > "transformer")
      if (hasBetterCasing(c.name, existing.name)) {
        existing.name = c.name;
      }

      // Upgrade generic 'concept' type if a more specific type was identified
      if ((existing.type === 'concept' || existing.type === 'Concept') && c.type !== 'concept' && c.type !== 'Concept') {
        existing.type = c.type;
      }

      // Upgrade to a more informative description
      if (isBetterDescription(c.description, existing.description)) {
        existing.description = c.description;
      }

      // Preserve highest importance
      if (typeof c.importance === 'number') {
        existing.importance = Math.max(existing.importance || 0, c.importance);
      }
      if (c.isCoreConcept) {
        existing.isCoreConcept = true;
      }
      if (c.evidence && !existing.evidence) {
        existing.evidence = c.evidence;
      }
      if (c.teachesOrExplains) {
        existing.teachesOrExplains = true;
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
 * Uses DocumentProfile structure (headings, definitions, formulas, domain terms)
 * to accurately extract educational concepts and ignore generic noise.
 */
export class HeuristicConceptExtractor implements ConceptExtractionProvider {
  name = 'heuristic';

  async extractConcepts(chunk: TextChunk, documentProfile?: DocumentProfile): Promise<ConceptCandidate[]> {
    const candidates: ConceptCandidate[] = [];
    const seenNames = new Set<string>();

    const text = chunk.text || '';
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    const addCandidate = (cand: {
      name: string;
      type: ConceptCandidateType;
      description: string;
      confidence: number;
      importance?: number;
      isCoreConcept?: boolean;
      evidence?: string;
    }) => {
      const cleanName = cleanConceptCandidateName(cand.name);
      if (!isStructurallyValidCandidateName(cleanName)) return;
      const key = cleanName.toLowerCase();
      if (seenNames.has(key)) return;
      seenNames.add(key);

      const isSubstantive = isValidConceptName(cleanName, documentProfile);
      const importance = isSubstantive
        ? (cand.importance ?? 0.80)
        : Math.min(cand.importance ?? 0.30, 0.30);

      candidates.push({
        name: cleanName,
        type: cand.type,
        description: cand.description,
        sourceId: chunk.sourceId,
        sourceChunkId: chunk.chunkId,
        sourceChunkIds: [chunk.chunkId],
        confidence: isSubstantive ? cand.confidence : 0.65,
        importance,
        isCoreConcept: isSubstantive ? (cand.isCoreConcept ?? false) : false,
        evidence: cand.evidence,
        teachesOrExplains: isSubstantive
      });
    };

    // 1. Injected DocumentProfile Definitions matching this chunk
    if (documentProfile?.definitionsFound) {
      for (const def of documentProfile.definitionsFound) {
        const escaped = def.term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        if (new RegExp(`\\b${escaped}\\b`, 'i').test(text)) {
          const type = classifyConceptType(def.term, def.definition);
          addCandidate({
            name: def.term,
            type,
            description: def.definition,
            confidence: 0.98,
            importance: 0.95,
            isCoreConcept: true,
            evidence: def.definition
          });
        }
      }
    }

    // 2. Injected DocumentProfile Formulas matching this chunk
    if (documentProfile?.formulasFound) {
      for (const f of documentProfile.formulasFound) {
        const termEscaped = f.term ? f.term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') : '';
        if (text.includes(f.formula) || (termEscaped && new RegExp(`\\b${termEscaped}\\b`, 'i').test(text))) {
          const formulaName = f.term || (chunk.heading ? `${chunk.heading} Formula` : 'Formula');
          addCandidate({
            name: formulaName,
            type: 'Formula',
            description: `${formulaName}: ${f.formula}`,
            confidence: 0.95,
            importance: 0.90,
            isCoreConcept: true,
            evidence: f.formula
          });
        }
      }
    }

    // 3. Definition patterns in text lines:
    // e.g. "Self-Attention is...", "A spherical mirror whose reflecting surface is curved inwards... is called a concave mirror"
    for (const line of lines) {
      const strippedLine = line.replace(/^(?:The|A|An)\s+/i, '');
      const cleanDefLine = strippedLine.replace(/^([A-Z][a-zA-Z0-9\s-]+?)\s*\([A-Z0-9]{2,6}\)\s+/, '$1 ');

      // Pattern A: "X is a/an Y that Z" or "X is defined as Y"
      const defMatch = /^([A-Za-z][a-zA-Z0-9\s-]+?)\s+(?:is an?|is the\b|is\b|are\b|refers to|is defined as|was proposed as|enables|computes)\b/i.exec(cleanDefLine);
      if (defMatch) {
        let rawName = defMatch[1].trim();
        rawName = rawName.replace(/\s+(?:that|which|who|whose|where|when|as|how)$/i, '').trim();
        if (/\s+is\s+/i.test(rawName)) {
          rawName = rawName.split(/\s+is\s+/i)[0].trim();
        }
        if (/\s+(?:whose|which|that|who)\s+/i.test(rawName)) {
          rawName = rawName.split(/\s+(?:whose|which|that|who)\s+/i)[0].trim();
        }
        rawName = rawName.replace(/\s+(?:state|states|show|shows|mean|means|indicate|indicates|imply|implies|prove|proves)$/i, '').trim();
        
        // Strict guard: definition concept names must be concise (at most 4 words) and structurally valid
        const words = rawName.split(/\s+/);
        if (words.length <= 4 && isStructurallyValidCandidateName(rawName)) {
          const type = classifyConceptType(rawName, line);
          const description = extractConceptDescription(rawName, type, text, chunk.heading);
          addCandidate({
            name: rawName,
            type,
            description,
            confidence: 0.95,
            importance: 0.95,
            isCoreConcept: true,
            evidence: line
          });
        }
      }

      // Pattern B: "... is called / is known as X"
      const calledMatch = line.match(/(?:(?:is|are)\s+(?:called|termed|known as|defined as))\s+(?:a|an|the\s+)?([A-Za-z][a-zA-Z\s-]{2,40})/i);
      if (calledMatch) {
        let term = calledMatch[1].replace(/[.,;:].*$/, '').trim();
        term = term.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        if (term.split(/\s+/).length <= 4 && isStructurallyValidCandidateName(term)) {
          const type = classifyConceptType(term, line);
          const description = extractConceptDescription(term, type, text, chunk.heading);
          addCandidate({
            name: term,
            type,
            description,
            confidence: 0.95,
            importance: 0.95,
            isCoreConcept: true,
            evidence: line
          });
        }
      }
    }

    // 4. Chunk Heading Extraction: headings represent major topics taught
    if (chunk.heading) {
      const headingTerm = chunk.heading.replace(/^#+\s*/, '').replace(/^(?:Section|Chapter|\d+\.)\s*/i, '').trim();
      const isHeadingGeneric = isGenericConceptPhrase(headingTerm, documentProfile).isGeneric;
      const type = classifyConceptType(headingTerm, text);
      const description = extractConceptDescription(headingTerm, type, text, chunk.heading);
      addCandidate({
        name: headingTerm,
        type: type === 'Concept' ? 'Topic' : type,
        description,
        confidence: isHeadingGeneric ? 0.60 : 0.92,
        importance: isHeadingGeneric ? 0.25 : 0.90,
        isCoreConcept: !isHeadingGeneric,
        evidence: undefined
      });
    }

    // 5. Technical compound exceptions & domain terms
    for (const compound of TECHNICAL_COMPOUND_EXCEPTIONS) {
      const escaped = compound.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      const compRegex = new RegExp(`\\b${escaped}(?:s)?\\b`, 'i');
      if (compRegex.test(text)) {
        const titleCaseName = compound.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
        const type = classifyConceptType(titleCaseName, text);
        const description = extractConceptDescription(titleCaseName, type, text, chunk.heading);
        const sent = text.split(/(?<=[.!?])\s+/).find(s => compRegex.test(s));
        addCandidate({
          name: titleCaseName,
          type,
          description,
          confidence: 0.94,
          importance: 0.88,
          isCoreConcept: true,
          evidence: sent?.trim()
        });
      }
    }

    // 6. Specialized domain keywords from DocumentProfile (e.g. "mirror", "lens" in Optics, "process" in OS)
    if (documentProfile?.domainKeywords) {
      for (const kw of documentProfile.domainKeywords) {
        const kwEscaped = kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
        const kwRegex = new RegExp(`\\b${kwEscaped}(?:s)?\\b`, 'i');
        if (kwRegex.test(text)) {
          const titleCaseKw = kw.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
          const type = classifyConceptType(titleCaseKw, text);
          const description = extractConceptDescription(titleCaseKw, type, text, chunk.heading);
          const sent = text.split(/(?<=[.!?])\s+/).find(s => kwRegex.test(s));
          addCandidate({
            name: titleCaseKw,
            type,
            description,
            confidence: 0.92,
            importance: 0.85,
            isCoreConcept: false,
            evidence: sent?.trim()
          });
        }
      }
    }

    // 7. Title Case technical compounds and capitalized terms
    const titleCaseRegex = /\b([A-Z][a-zA-Z0-9]*(?:[- ](?:[A-Z][a-zA-Z0-9]*|learning|networks?|models?|architectures?|algorithms?|vision|attention|mirror|mirrors?|formula|axis|length|reflection|curvature)){0,3}|[A-Z]{2,6})\b/g;
    let match: RegExpExecArray | null;

    while ((match = titleCaseRegex.exec(text)) !== null) {
      const rawTerm = match[1].trim();
      const type = classifyConceptType(rawTerm, text);
      const description = extractConceptDescription(rawTerm, type, text, chunk.heading);
      addCandidate({
        name: rawTerm,
        type,
        description,
        confidence: 0.88,
        importance: 0.80,
        evidence: undefined
      });
    }

    // 8. Capture standalone candidate keywords so the semantic evaluation layer can judge & record them
    for (const kw of ['system', 'data', 'method', 'process', 'example', 'information']) {
      const kwRegex = new RegExp(`\\b${kw}\\b`, 'i');
      if (kwRegex.test(text)) {
        const titleCase = kw.charAt(0).toUpperCase() + kw.slice(1);
        addCandidate({
          name: titleCase,
          type: 'Concept',
          description: extractConceptDescription(titleCase, 'Concept', text, chunk.heading),
          confidence: 0.70,
          importance: 0.30,
          isCoreConcept: false,
          evidence: undefined
        });
      }
    }

    return candidates;
  }
}

export function getGeminiApiKey(): string | undefined {
  if (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: Record<string, string | undefined> }).env) {
    const viteEnv = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
    if (viteEnv.VITE_GEMINI_API_KEY) return viteEnv.VITE_GEMINI_API_KEY.trim();
    if (viteEnv.GEMINI_API_KEY) return viteEnv.GEMINI_API_KEY.trim();
  }
  const envObj = typeof globalThis !== 'undefined' && 'process' in globalThis
    ? (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env
    : undefined;
  return envObj?.VITE_GEMINI_API_KEY?.trim() || envObj?.GEMINI_API_KEY?.trim();
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

  async extractConcepts(chunk: TextChunk, documentProfile?: DocumentProfile): Promise<ConceptCandidate[]> {
    const apiKey = this.options.apiKey || getGeminiApiKey();
    
    // If no API key or endpoint configured, gracefully fallback to the deterministic heuristic provider
    if (!apiKey && !this.options.endpoint) {
      return this.fallbackProvider.extractConcepts(chunk, documentProfile);
    }

    const docContext = documentProfile ? `
DOCUMENT PROFILE & CONTEXT:
- Document Title: ${documentProfile.title}
- Inferred Subject: ${documentProfile.inferredSubject || documentProfile.inferredDomain || 'Educational Material'}
- Major Topics: ${documentProfile.majorTopics.join(', ') || 'N/A'}
- Known Definitions in Material: ${documentProfile.definitionsFound.slice(0, 8).map(d => `${d.term}: ${d.definition.slice(0, 90)}...`).join(' | ') || 'None'}
- Section Context: ${chunk.heading || 'General Section'}
` : '';

    const systemPrompt = `You are GraphMind's AI semantic concept extractor.
Your task is to read the text chunk and identify the MAIN KNOWLEDGE CONCEPTS that the document ACTUALLY TEACHES, EXPLAINS, DEFINES, COMPARES, or DERIVES.

${docContext}

WHAT COUNTS AS A CONCEPT:
- A concept represents a meaningful piece of knowledge that a student could reasonably learn, understand, define, explain, compare, apply, or derive.
- Before accepting a candidate, ask: "Is this actually something the document teaches or explains?" If the answer is no, REJECT it.
- A concept must be domain-specific, semantically meaningful, and independently understandable.
- MULTI-WORD CONCEPTS MUST REMAIN COMPLETE (e.g. "Spherical Mirror", "Concave Mirror", "Convex Mirror", "Mirror Formula", "Principal Axis", "Artificial Neural Network", "Backpropagation Algorithm", "Supervised Learning", "Total Internal Reflection", "Object Oriented Programming").
- REJECT generic words (e.g., "object", "important", "method", "system", "example", "property", "use", "process", "information", "approach", "problem", "data") UNLESS the document explicitly defines them as a specialized technical concept in this subject.
- REJECT verbs, adjectives, filler words, document boilerplate, navigation words, and conversational fragments.

For each accepted concept, evaluate:
- name: string (canonical complete terminology)
- type: 'Topic' | 'Concept' | 'Method' | 'Theory' | 'Algorithm' | 'Process' | 'Formula' | 'Principle' | 'Object' | 'Component' | 'Application' | 'Property'
- description: string (1-2 clear, educational sentences explaining what it means in this document)
- importance: number (0.0 to 1.0 reflecting educational importance to the subject)
- isCoreConcept: boolean (true if fundamental to understanding the material)
- teachesOrExplains: boolean (true if the document actually teaches/explains it; false if just passing mention)
- evidence: string (verbatim excerpt from the text proving why this is a taught concept)

Return ONLY a valid JSON array of concept objects.`;

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
        return this.fallbackProvider.extractConcepts(chunk, documentProfile);
      }

      const data = await response.json();
      const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawJson) {
        return this.fallbackProvider.extractConcepts(chunk, documentProfile);
      }

      const parsed = JSON.parse(rawJson);
      if (!Array.isArray(parsed)) {
        return this.fallbackProvider.extractConcepts(chunk, documentProfile);
      }

      // Validate and clean each candidate
      const validCandidates: ConceptCandidate[] = [];
      for (const item of parsed) {
        if (!item.name || typeof item.name !== 'string') continue;
        const cleanName = cleanConceptCandidateName(item.name);
        if (isValidConceptName(cleanName, documentProfile)) {
          // Reject if AI evaluated that it's not actually taught or has very low importance
          if (item.teachesOrExplains === false) continue;
          const importance = typeof item.importance === 'number' ? Math.max(0, Math.min(1, item.importance)) : 0.8;
          if (importance < 0.35) continue;

          validCandidates.push({
            name: cleanName,
            type: (item.type as ConceptCandidateType) || classifyConceptType(cleanName, item.description || chunk.text),
            description: item.description?.trim() || extractConceptDescription(cleanName, item.type, chunk.text, chunk.heading),
            sourceId: chunk.sourceId,
            sourceChunkId: chunk.chunkId,
            sourceChunkIds: [chunk.chunkId],
            confidence: 0.96,
            importance,
            isCoreConcept: Boolean(item.isCoreConcept ?? (importance >= 0.8)),
            evidence: item.evidence?.trim() || undefined,
            teachesOrExplains: true
          });
        }
      }

      return validCandidates.length > 0 ? validCandidates : this.fallbackProvider.extractConcepts(chunk, documentProfile);
    } catch {
      // Graceful fallback to heuristic extraction
      return this.fallbackProvider.extractConcepts(chunk, documentProfile);
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
    const key = getGeminiApiKey();
    const targetName = name || (key ? 'llm' : this.defaultProviderName);
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
        const chunkCandidates = await provider.extractConcepts(chunk, options.documentProfile);
        allCandidates.push(...chunkCandidates);
      } catch {
        // Continue extracting from remaining chunks
      }
    }

    // Deduplicate and prepare for Normalization
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

    const docProfile = options.documentProfile || buildDocumentProfile(chunks, source);
    const rawCandidates = await extractConceptsFromChunks(chunks, {
      ...options,
      documentProfile: docProfile
    });
    const qualityConfig: ConceptQualityConfig = {
      ...DEFAULT_CONCEPT_QUALITY_CONFIG,
      ...(options.qualityConfig || {})
    };
    const { acceptedCandidates, report } = evaluateAndFilterCandidates(rawCandidates, chunks, qualityConfig, docProfile);

    return {
      success: true,
      sourceId: source.id,
      concepts: acceptedCandidates,
      chunkCount: chunks.length,
      relevanceReport: report
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
