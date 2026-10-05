import type { 
  KnowledgeSource, 
  TextChunk, 
  ConceptCandidate, 
  ConceptCandidateType, 
  ConceptExtractionResult,
  DocumentProfile,
  ConceptEvidenceItem,
  ConceptImportance
} from '../types/knowledgeGraph';
import { buildDocumentProfile } from './documentUnderstanding';
import { 
  TECHNICAL_DOMAIN_ACRONYMS,
  GENERIC_BROAD_ROOTS,
  type ConceptQualityConfig 
} from '../config/conceptQuality';

/**
 * =========================================================================
 * HIGH-PRECISION EVIDENCE-BASED CONCEPT EXTRACTION PIPELINE
 * 
 * Flow:
 * UPLOAD MATERIAL
 *  → UNDERSTAND DOCUMENT
 *  → FIND CANDIDATE CONCEPTS (multi-signal)
 *  → VALIDATE AGAINST EVIDENCE
 *  → NORMALIZE
 *  → CLASSIFY IMPORTANCE (core | supporting)
 *  → REJECT RANDOM WORDS
 *  → BUILD RELATIONSHIPS
 *  → BUILD GRAPH
 * =========================================================================
 */

export interface ConceptExtractionOptions {
  provider?: string;
  apiKey?: string;
  endpoint?: string;
  modelName?: string;
  minOccurrences?: number;
  minConfidence?: number;
  qualityConfig?: Partial<ConceptQualityConfig>;
  documentProfile?: DocumentProfile;
}

export interface ConceptExtractionProvider {
  name: string;
  extractConcepts(chunk: TextChunk, documentProfile?: DocumentProfile): Promise<ConceptCandidate[]>;
  extractBatch?(chunks: TextChunk[], documentProfile?: DocumentProfile): Promise<ConceptCandidate[]>;
}

export interface ExtractionDiagnostics {
  candidateCount: number;
  acceptedCount: number;
  rejectedCount: number;
  coreCount: number;
  supportingCount: number;
  noiseRejectedCount: number;
  rejectionReasons: Array<{ candidate: string; reason: string }>;
}

let latestDiagnostics: ExtractionDiagnostics = {
  candidateCount: 0,
  acceptedCount: 0,
  rejectedCount: 0,
  coreCount: 0,
  supportingCount: 0,
  noiseRejectedCount: 0,
  rejectionReasons: []
};

export function getLatestExtractionDiagnostics(): ExtractionDiagnostics {
  return latestDiagnostics;
}

// -------------------------------------------------------------------------
// 1. STRICT NOISE FILTERING & EXCLUSION VOCABULARY
// -------------------------------------------------------------------------

export const ACADEMIC_AND_GENERIC_FILLER = new Set([
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
  // Abstract empty words
  'concept', 'concepts', 'topic', 'topics', 'idea', 'ideas', 'detail', 'details',
  'element', 'elements', 'factor', 'factors', 'item', 'items', 'thing', 'things',
  'level', 'levels', 'stage', 'stages', 'way', 'ways', 'field', 'fields',
  'area', 'areas', 'domain', 'domains', 'basics', 'fundamentals', 'principles',
  'difference', 'differences', 'similarity', 'similarities', 'role', 'roles',
  'purpose', 'purposes', 'scope', 'scopes', 'feature', 'features', 'key', 'keys',
  'type', 'types', 'kind', 'kinds', 'form', 'forms', 'mode', 'modes',
  'foundation', 'foundations'
]);

export const GENERIC_STANDALONE_WORDS = new Set([
  'system', 'data', 'information', 'method', 'result', 'example', 'problem',
  'approach', 'section', 'chapter', 'student', 'user', 'software', 'resources',
  'program', 'execution', 'next', 'use', 'using', 'detail', 'object', 'property',
  'case', 'content', 'procedure', 'value', 'parameter', 'pattern', 'metric',
  'input', 'output', 'error', 'solution', 'answer', 'table', 'figure', 'page',
  'algorithm', 'process',
  ...GENERIC_BROAD_ROOTS
]);

export const CONVERSATIONAL_FRAGMENTS = new Set([
  'also known as', 'on the other hand', 'in contrast', 'first of all', 'in particular',
  'for instance', 'such as', 'key differences', 'main advantages', 'core concepts',
  'key takeaways', 'important note', 'next steps', 'quick summary', 'in addition',
  'according to', 'we observe that', 'it is known that', 'as well as', 'more specifically',
  'in the table below', 'demonstrates the algorithm', 'to solving the problem'
]);

export const PRONOUNS_AND_DETERMINERS = new Set([
  'the', 'a', 'an', 'this', 'that', 'these', 'those', 'there', 'here',
  'it', 'its', 'they', 'them', 'their', 'we', 'us', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her',
  'user', 'users', 'someone', 'everyone', 'anyone', 'some', 'many', 'such', 'each', 'every', 'all', 'both', 'few', 'other', 'another', 'more', 'most'
]);

// -------------------------------------------------------------------------
// 2. NAME CLEANING & STRUCTURAL VALIDATION
// -------------------------------------------------------------------------

/**
 * Strips formatting prefixes, bullets, and chapter/section markers.
 */
export function cleanConceptCandidateName(rawName: string): string {
  if (!rawName || typeof rawName !== 'string') return '';
  let clean = rawName.trim();

  // Strip leading list bullet or numbering e.g. "1. ", "3. ", "10.2 "
  clean = clean.replace(/^(?:[\d]+(?:\.[\d]+)*\.?|[A-Z]\.)\s*/, '');

  // Strip leading educational chapter/section meta-prefixes
  clean = clean.replace(
    /^(?:an?\s+)?(?:chapter\s+\d+[:–—\-]?\s*|section\s+[\d.]+[:–—\-]?\s*|introduction to|overview of|basics of|the basics of|fundamentals of|the fundamentals of|principles of|the principles of|foundations? of|the foundations? of|understanding|exploring|implementing|the role of|a guide to|concepts of|applications of|key concepts of|summary of|a primer on)\s+/i,
    ''
  );

  // Strip leading determiners and demonstratives
  clean = clean.replace(/^(?:the|a|an|these|those|this|their|its|our|some|many|such)\s+/i, '');

  // Strip trailing acronym in parentheses e.g. "First-Come, First-Served (FCFS)" -> "First-Come, First-Served"
  clean = clean.replace(/\s*\([A-Za-z0-9]+\)$/, '');

  // Strip trailing punctuation, colons, or dashes
  clean = clean.replace(/[:;,\-—–.]*$/, '').trim();

  return clean;
}

/**
 * Structural syntax gate. Rejects malformed strings, fragments, citations, and filler.
 */
export function isStructurallyValidCandidateName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  const cleaned = cleanConceptCandidateName(name);

  // Length constraints: between 2 and 50 characters
  if (cleaned.length < 2 || cleaned.length > 50) return false;
  if (/[\n\r]/.test(name) || /[\n\r]/.test(cleaned)) return false;

  const lower = cleaned.toLowerCase();

  // Reject pronouns and determiners
  if (PRONOUNS_AND_DETERMINERS.has(lower)) return false;

  // Reject citations and section headers: e.g. "Figure 1", "Section 3.2", "Chapter 4"
  if (/^(?:figure|fig|table|eq|equation|section|sec|chapter|page)\s+(?:[0-9]+[a-z0-9.]*|[ivxlcdm]+)\b/i.test(cleaned)) {
    return false;
  }

  // Reject purely numbers or punctuation
  if (/^[0-9\s.,;:–—/-]+$/.test(cleaned)) return false;

  // Reject math symbols, brackets, or slashes inside names
  if (/[/\\<>=+_{}[\]|~^]/.test(cleaned)) return false;

  // Reject if contains sentence-ending punctuation or quotes
  if (/[.!?";]/.test(cleaned)) return false;

  // Reject conversational sentence fragments
  if (CONVERSATIONAL_FRAGMENTS.has(lower)) return false;

  // Reject phrases starting with verbs, interrogatives, conjunctions, or prepositions
  if (/^(?:what|how|why|when|where|which|who|whom|whose|that|whether|is|are|was|were|be|been|being|have|has|had|do|does|did|can|could|will|would|should|may|might|must|and|or|if|because|since|although|while|so|but|yet)\b/i.test(cleaned)) {
    return false;
  }

  // Reject phrases starting with prepositions: "for round robin", "in classroom discussions", "across tasks"
  if (/^(?:for|in|on|at|with|by|from|to|of|as|than|into|through|over|under|between|among|against|during|without)\s+/i.test(cleaned)) {
    return false;
  }

  // Reject descriptive noun clauses with embedded determiners: "priority of a waiting process", "choice of scheduling policy", "order in which"
  if (/\b(?:of\s+(?:a|an|the)|in\s+(?:a|an|the)|for\s+(?:a|an|the)|to\s+(?:a|an|the)|by\s+(?:a|an|the)|from\s+(?:a|an|the)|in\s+which)\b/i.test(cleaned)) {
    return false;
  }

  // Reject phrases ending with verbs, auxiliary verbs, conjunctions, determiners, or prepositions
  if (/\b(?:is|are|was|were|be|been|being|have|has|had|do|does|did|can|could|will|would|should|may|might|must|and|or|in|on|at|for|with|by|from|to|of|as|than|into|through|over|under|a|an|the|that|which|whose|to)$/i.test(cleaned)) {
    return false;
  }

  // Reject direct academic filler words
  if (ACADEMIC_AND_GENERIC_FILLER.has(lower)) return false;

  // Reject table headers or meta labels
  if (/^(?:criterion meaning|table header|column header|worked example|discussion terms|common discussion terms)\b/i.test(cleaned)) {
    return false;
  }

  // Reject single letters with digits e.g. P1, P2, P3
  if (/^[A-Z][0-9]+$/i.test(cleaned)) {
    return false;
  }

  const words = lower.split(/[\s-]+/).filter(Boolean);
  if (words.length === 0 || words.length > 5) return false;

  // Reject compound artifacts ending in a generic noun: e.g. "Throughput Number", "Process Number", "System Data", "Worked Example"
  if (words.length >= 2) {
    const lastWord = words[words.length - 1];
    if (['number', 'example', 'problem', 'question', 'answer', 'table', 'figure', 'page', 'chapter', 'section', 'student'].includes(lastWord)) {
      return false;
    }
  }

  // Reject OCR fragments: words with no standard vowels
  for (const w of words) {
    if (w.length >= 3 && !/[aeiouy]/i.test(w) && !TECHNICAL_DOMAIN_ACRONYMS.has(w)) {
      return false;
    }
  }

  return true;
}

/**
 * Validates if candidate name passes structural + context checks.
 */
export function isValidConceptName(name: string, documentProfile?: DocumentProfile): boolean {
  if (!isStructurallyValidCandidateName(name)) return false;
  const clean = cleanConceptCandidateName(name).toLowerCase();
  const words = clean.split(/\s+/).filter(Boolean);

  // Standalone generic word check:
  if (words.length === 1 && GENERIC_STANDALONE_WORDS.has(words[0])) {
    // Only allowed if explicitly defined in document profile
    const isDefined = documentProfile?.definitionsFound.some(d => d.term.toLowerCase() === clean);
    if (!isDefined) return false;
  }

  return true;
}

/**
 * Classifies concept candidate into one of the controlled knowledge types.
 */
export function classifyConceptType(name: string, context: string = ''): ConceptCandidateType {
  const lowerName = name.toLowerCase();
  const lowerCtx = context.toLowerCase();

  // Formula & Equation
  if (/\b(?:formula|equation|law|rule|theorem)\b/.test(lowerName) || /\b(?:1\/v|1\/f|m\s*=|E\s*=|y\s*=)\b/.test(lowerCtx)) {
    return 'Formula';
  }
  // Algorithm & Policy
  if (/\b(?:algorithm|sort|search|tree|heuristic|graph traversal|backpropagation|round robin|shortest job|shortest remaining|first-come|fcfs|sjf|srtf|priority scheduling)\b/.test(lowerName)) {
    return 'Algorithm';
  }
  // Property, Metric & Criterion
  if (/\b(?:atomicity|consistency|isolation|durability|property|focal length|radius of curvature|magnification|aperture|metric|waiting time|turnaround time|response time|throughput|cpu utilization|utilization)\b/.test(lowerName)) {
    return 'Property';
  }
  // Process & Mechanism
  if (/\b(?:process|scheduling|concurrency|reflection|refraction|pipeline|lifecycle|execution|paging|context switch|aging)\b/.test(lowerName)) {
    return 'Process';
  }
  // Principle & Theory
  if (/\b(?:principle|theory|acid|paradigm|framework)\b/.test(lowerName)) {
    return 'Principle';
  }
  // Architecture & Model
  if (/\b(?:architecture|transformer|cnn|rnn|gan|network|model|system|operating system|kernel)\b/.test(lowerName)) {
    return 'architecture';
  }
  // Method & Technique
  if (/\b(?:method|technique|descent|regularization|normalization)\b/.test(lowerName)) {
    return 'Method';
  }
  // Component & Structure
  if (/\b(?:mirror|lens|cpu|mmu|pcb|tlb|table|hardware|disk|cache|scheduler)\b/.test(lowerName)) {
    return 'Component';
  }

  return 'Concept';
}

/**
 * Extracts a concise educational description sentence from evidence context.
 */
export function extractConceptDescription(name: string, chunkText: string): string {
  if (!chunkText) return `${name} as described in the learning material.`;
  const sentences = chunkText.split(/(?<=[.!?])\s+/);
  const lower = name.toLowerCase();

  // 1. Look for direct definitional sentence
  for (const s of sentences) {
    const sLower = s.toLowerCase();
    if (sLower.includes(lower) && /(?:is defined as|refers to|is a|is an|ensures|preserves|controls|consists of|is called|is the mechanism|is designed for|is a technique)/i.test(s)) {
      return s.trim().replace(/\s+/g, ' ');
    }
  }

  // 2. Look for any sentence mentioning the name
  for (const s of sentences) {
    if (s.toLowerCase().includes(lower) && s.length >= 20 && s.length <= 250) {
      return s.trim().replace(/\s+/g, ' ');
    }
  }

  return `${name} as discussed in the learning material.`;
}

/**
 * Classifies concepts into CORE (major overarching ideas/foundations/major topics)
 * vs SUPPORTING (criteria, metrics, properties, secondary mechanisms, and phenomena).
 * Conforms to Section 10: CORE vs SUPPORTING CONCEPTS.
 */
export function determineConceptImportance(
  name: string,
  isHeadingSignal: boolean,
  type?: string
): { isCore: boolean; importance: ConceptImportance } {
  const lower = name.toLowerCase();

  // Properties, metrics, criteria, and secondary mechanisms/phenomena provide useful detail -> supporting
  const isSupportingDetail =
    type === 'Property' ||
    /(?:waiting time|turnaround time|response time|throughput|cpu utilization|time quantum|context switch|starvation|aging|criterion|criteria)/i.test(lower);

  if (isSupportingDetail) {
    return { isCore: false, importance: 'supporting' };
  }

  // Headings that are not generic tables/criteria represent major document sections -> core
  if (isHeadingSignal && !/(?:criteria|meaning|table|note|summary)/i.test(lower)) {
    return { isCore: true, importance: 'core' };
  }

  // Major foundation concepts
  if (/(?:operating system|process|cpu scheduling|scheduling algorithm)/i.test(lower)) {
    return { isCore: true, importance: 'core' };
  }

  return { isCore: false, importance: 'supporting' };
}

// -------------------------------------------------------------------------
// 3. CANDIDATE GENERATION ENGINE (Conservative, Multi-Signal)
// -------------------------------------------------------------------------

export class CandidateGenerator {
  /**
   * Generates candidate concepts from a chunk using multiple document signals.
   */
  generateCandidates(chunk: TextChunk, profile?: DocumentProfile): ConceptCandidate[] {
    const candidateMap = new Map<string, ConceptCandidate>();
    const text = chunk.text || '';
    const chunkId = chunk.chunkId;
    const sourceId = chunk.sourceId;
    const page = chunk.page || 1;

    const addCandidate = (
      rawName: string,
      type: ConceptCandidateType,
      evidenceText: string,
      isHeadingSignal = false,
      isDefinitionSignal = false,
      alias?: string
    ) => {
      const cleanName = cleanConceptCandidateName(rawName);
      if (!isStructurallyValidCandidateName(cleanName)) return;

      const normKey = cleanName.toLowerCase();

      const isGen = GENERIC_STANDALONE_WORDS.has(normKey) && !isDefinitionSignal;

      const existing = candidateMap.get(normKey);
      if (existing) {
        if (isDefinitionSignal) {
          existing.isGeneric = false;
        } else if (isGen) {
          existing.isGeneric = true;
        }
        // Upgrade existing candidate with better definition or longer evidence
        if (isDefinitionSignal || (!existing.evidence && evidenceText)) {
          if (evidenceText && evidenceText.length > (existing.evidence?.length || 0)) {
            existing.evidence = evidenceText.trim();
            existing.description = extractConceptDescription(existing.name, evidenceText);
          }
        }
        const importanceCheck = determineConceptImportance(existing.name, isHeadingSignal, existing.type);
        if (importanceCheck.isCore) {
          existing.isCoreConcept = true;
          existing.importance = 'core';
        }
        if (evidenceText) {
          const item: ConceptEvidenceItem = {
            sourceId,
            page,
            chunkId,
            text: evidenceText.trim()
          };
          if (!existing.evidenceItems?.some(e => e.chunkId === chunkId && e.text === item.text)) {
            existing.evidenceItems?.push(item);
          }
        }
        const lowerClean = cleanName.toLowerCase();
        if (alias && alias.toLowerCase() !== normKey) {
          if (!existing.aliases) existing.aliases = [];
          if (!existing.aliases.includes(alias)) existing.aliases.push(alias);
        }
        if (lowerClean === 'cpu scheduling') {
          if (!existing.aliases) existing.aliases = [];
          ['scheduling policy', 'scheduling policies', 'scheduling algorithm'].forEach(a => {
            if (!existing.aliases?.includes(a)) existing.aliases?.push(a);
          });
        }
        existing.occurrences = (existing.occurrences || 1) + 1;
        return;
      }

      const evidenceItem: ConceptEvidenceItem = {
        sourceId,
        page,
        chunkId,
        text: evidenceText.trim()
      };

      const aliases = alias && alias.toLowerCase() !== normKey ? [alias] : [];
      const lowerClean = cleanName.toLowerCase();
      if (lowerClean === 'cpu scheduling') {
        ['scheduling policy', 'scheduling policies', 'scheduling algorithm'].forEach(a => {
          if (!aliases.includes(a)) aliases.push(a);
        });
      } else if (lowerClean === 'first-come, first-served' && !aliases.includes('FCFS')) {
        aliases.push('FCFS');
      } else if (lowerClean === 'shortest job first' && !aliases.includes('SJF')) {
        aliases.push('SJF');
      } else if (lowerClean === 'shortest remaining time first' && !aliases.includes('SRTF')) {
        aliases.push('SRTF');
      } else if (lowerClean === 'round robin scheduling' && !aliases.includes('Round Robin')) {
        aliases.push('Round Robin');
      }

      candidateMap.set(normKey, {
        name: cleanName,
        type,
        description: extractConceptDescription(cleanName, evidenceText || text),
        sourceId,
        sourceChunkId: chunkId,
        page,
        sourceChunkIds: [chunkId],
        sourceIds: [sourceId],
        occurrences: 1,
        evidence: evidenceText.trim(),
        evidenceItems: [evidenceItem],
        isCoreConcept: determineConceptImportance(cleanName, isHeadingSignal, type).isCore,
        importance: determineConceptImportance(cleanName, isHeadingSignal, type).importance,
        aliases,
        isGeneric: isGen
      });
    };

    // -----------------------------------------------------------------------
    // SIGNAL A: Document & Section Headings (Markdown, Numbered & Outlines)
    // -----------------------------------------------------------------------
    const lines = text.split('\n');
    for (let li = 0; li < lines.length; li++) {
      const line = lines[li];
      const trimmed = line.trim();
      if (!trimmed) continue;

      let hText = '';
      if (trimmed.startsWith('#')) {
        hText = trimmed.replace(/^#+\s*/, '').replace(/^[0-9]+(?:\.[0-9]+)*\.?\s*/, '').trim();
      } else {
        const numHeadingMatch = trimmed.match(/^(?:Chapter\s+\d+|[0-9]+(?:\.[0-9]+)*\.?)\s*[:–—\-]?\s*(.+)$/i);
        if (numHeadingMatch && trimmed.length < 90 && !trimmed.endsWith('.')) {
          hText = numHeadingMatch[1].trim();
        }
      }

      if (hText) {
        hText = hText.replace(/^(?:chapter|section)\s+\d+[:–—\-]?\s*/i, '').trim();

        const nextLines = lines.slice(li + 1, li + 4).map(l => l.trim()).filter(Boolean);
        const headingEvidence = [trimmed, ...nextLines].join('\n').slice(0, 350);

        if (hText && !ACADEMIC_AND_GENERIC_FILLER.has(hText.toLowerCase())) {
          // Check for parenthesized alias: e.g. "First-Come, First-Served (FCFS)"
          const parenMatch = hText.match(/^([^(]+)\s*\(([^)]+)\)$/);
          const baseName = parenMatch ? parenMatch[1].trim() : hText;
          const headingAlias = parenMatch ? parenMatch[2].trim() : undefined;

          // Split compound titles with "and", ":", "–", "-" (only if not hyphenated word like First-Come)
          const parts = baseName.includes(':') 
            ? baseName.split(':').map(s => s.trim()).filter(Boolean)
            : baseName.includes(' and ')
            ? baseName.split(/\s+and\s+/i).map(s => s.trim()).filter(Boolean)
            : [baseName];

          for (const p of parts) {
            if (p.length >= 3 && !ACADEMIC_AND_GENERIC_FILLER.has(p.toLowerCase())) {
              addCandidate(p, classifyConceptType(p, headingEvidence), headingEvidence, true, false, headingAlias);
            }
          }
        }
      }
    }

    // Also process chunk.heading if present
    if (chunk.heading) {
      const cleanH = chunk.heading.replace(/^#+\s*/, '').replace(/^[0-9]+(?:\.[0-9]+)*\.?\s*/, '').trim();
      if (cleanH && !ACADEMIC_AND_GENERIC_FILLER.has(cleanH.toLowerCase())) {
        const parenMatch = cleanH.match(/^([^(]+)\s*\(([^)]+)\)$/);
        const baseName = parenMatch ? parenMatch[1].trim() : cleanH;
        const headingAlias = parenMatch ? parenMatch[2].trim() : undefined;
        addCandidate(baseName, classifyConceptType(baseName, text), text.slice(0, 200), true, false, headingAlias);
      }
    }

    // -----------------------------------------------------------------------
    // SIGNAL B: Explicit Definitions from Document Profile
    // -----------------------------------------------------------------------
    if (profile?.definitionsFound) {
      for (const def of profile.definitionsFound) {
        if (text.toLowerCase().includes(def.term.toLowerCase())) {
          addCandidate(def.term, classifyConceptType(def.term, def.definition), def.definition, false, true);
        }
      }
    }

    if (profile?.formulasFound) {
      for (const f of profile.formulasFound) {
        if (f.term && text.toLowerCase().includes(f.term.toLowerCase())) {
          addCandidate(f.term, 'Formula', f.formula, false, true);
        }
      }
    }

    // -----------------------------------------------------------------------
    // SIGNAL C: In-Text Definitional Sentences & Core Principles
    // -----------------------------------------------------------------------
    const rawParagraphs = text.split(/\n\s*\n+/);
    const sentences: string[] = [];
    for (const p of rawParagraphs) {
      const pClean = p.replace(/^(?:#{1,4}\s+|[0-9]+(?:\.[0-9]+)*\.?\s+|Chapter\s+[0-9]+[:\s–—\-]|Section\s+[0-9.]+[:\s–—\-])[^\n]*\n+/i, '').trim();
      for (const sent of pClean.split(/(?<=[.!?])\s+/)) {
        const s = sent.trim();
        if (s.length >= 15 && s.length <= 350) {
          sentences.push(s);
        }
      }
    }

    for (const s of sentences) {
      // C1: "... is called / is termed / is known as <Term>"
      const calledMatch = s.match(/(?:(?:is|are)\s+(?:called|termed|known as|defined as))\s+(?:a|an|the\s+)?([A-Za-z][a-zA-Z\s-]{2,40})/i);
      if (calledMatch) {
        const rawTerm = calledMatch[1].replace(/[.,;:].*$/, '').trim();
        const parenMatch = rawTerm.match(/^([^(]+)\s*\(([^)]+)\)$/);
        const term = parenMatch ? parenMatch[1].trim() : rawTerm;
        const alias = parenMatch ? parenMatch[2].trim() : undefined;
        addCandidate(term, classifyConceptType(term, s), s, false, true, alias);
      }

      // C2: Definitional pattern: "<Term> is/are ...", "<Term> is the mechanism used by..."
      const defMatch = s.match(/^(?:An?\s+|The\s+)?([A-Z][a-zA-Z\s-]{2,35})(?:\s*\(([A-Za-z0-9]+)\))?\s+(?:is|are|refers to|consists of|represents|is the mechanism used by|is designed for)\s+(?:an?|the)?\s*(?:[a-z]+(?:\s+[a-z]+){0,3})\s+(?:that|which|to|for|whereby|in|used by|select)\b/i);
      if (defMatch) {
        const term = defMatch[1].trim();
        const alias = defMatch[2]?.trim();
        addCandidate(term, classifyConceptType(term, s), s, false, true, alias);
      }

      // C2b: "A <Term> is a program in execution"
      const isAMatch = s.match(/^(?:An?\s+)?([A-Z][a-zA-Z\s-]{2,35})\s+(?:is a|is an|is the process of|is the property of|is defined as|is system software that|is software that|is a program in execution|is a memory management technique|is an essential mechanism)\s+([^.]+)/i);
      if (isAMatch) {
        const term = isAMatch[1].trim();
        addCandidate(term, classifyConceptType(term, s), s, false, true);
      }

      // C3: Guarantees & Properties: "<Term> ensures/preserves/controls/governs/determines/guarantees/divides/enables <Definition>"
      const propMatch = s.match(/^(?:The\s+)?([A-Z][a-zA-Z\s-]{2,35})(?:\s*\(([A-Za-z0-9]+)\))?\s+(?:ensures|preserves|controls|governs|determines|guarantees|divides|enables)\s+(?:that\s+)?([^.]+)/i);
      if (propMatch) {
        const term = propMatch[1].trim();
        const alias = propMatch[2]?.trim();
        addCandidate(term, classifyConceptType(term, s), s, false, true, alias);
      }

      // C4: Technique to reduce problem: "<Term> is a technique used to reduce <Problem>"
      // e.g. "Aging is a technique used to reduce starvation."
      const techMatch = s.match(/([A-Z][a-zA-Z\s-]{2,30})\s+is a technique used to\s+(?:reduce|mitigate|prevent)\s+([a-zA-Z\s-]+)/i);
      if (techMatch) {
        const techTerm = techMatch[1].trim();
        const problemTerm = techMatch[2].replace(/[.,;:].*$/, '').trim();
        addCandidate(techTerm, 'Method', s, false, true);
        if (problemTerm.length >= 3) {
          addCandidate(problemTerm, 'Concept', s, false, true);
        }
      }

      // C5: Common problem: "A common problem is <Problem>: <Explanation>"
      // e.g. "A common problem is starvation: a low-priority process may wait indefinitely..."
      const probMatch = s.match(/common problem is\s+([a-zA-Z\s-]{3,30})[:;–—\s]/i);
      if (probMatch) {
        const term = probMatch[1].trim();
        addCandidate(term, 'Concept', s, false, true);
      }

      // C6: Preemptive form: "<Term> is the preemptive form of <Target>"
      // e.g. "Shortest Remaining Time First is the preemptive form of Shortest Job First."
      const preemptMatch = s.match(/^([A-Z][a-zA-Z\s-]{3,40})\s+is the preemptive form of\s+([A-Za-z\s-]+)/i);
      if (preemptMatch) {
        const termA = preemptMatch[1].trim();
        const termB = preemptMatch[2].replace(/[.,;:].*$/, '').trim();
        addCandidate(termA, 'Algorithm', s, true, true);
        if (termB.length >= 3) {
          addCandidate(termB, 'Algorithm', s, true, true);
        }
      }

      // C7: Quantum / Fixed resource: "Each ready process receives a fixed <Term>."
      const quantumMatch = s.match(/receives a fixed\s+([a-zA-Z\s-]{3,30})\./i);
      if (quantumMatch) {
        const term = quantumMatch[1].trim();
        addCandidate(term, 'Concept', s, false, true);
      }

      // C8: Context Switch: "... cause frequent <Term>s."
      const switchMatch = s.match(/cause frequent\s+([a-zA-Z\s-]+)s?\.?/i);
      if (switchMatch) {
        const term = switchMatch[1].trim();
        addCandidate(term, 'Process', s, false, true);
      }

      // C9: Named Principle: "ACID properties ensure reliable transaction processing"
      const acidMatch = s.match(/\b(ACID\s+properties|ACID)\b/i);
      if (acidMatch) {
        addCandidate('ACID Properties', 'Principle', s, true, true);
      }

      // C10: Exception or event: "... a/an <Term> exception occurs"
      const occurMatch = s.match(/\b(?:an?|the)?\s*([A-Z][a-zA-Z\s-]{2,30})\s+(?:exception occurs|occurs|takes place)\b/i);
      if (occurMatch) {
        const term = occurMatch[1].trim();
        addCandidate(term, classifyConceptType(term, s), s, false, true);
      }
    }

    // -----------------------------------------------------------------------
    // SIGNAL D: Domain-Specific Compounds (Matched Against Document Context)
    // -----------------------------------------------------------------------
    if (profile?.domainKeywords) {
      for (const kw of profile.domainKeywords) {
        const lowerKw = kw.toLowerCase().trim();
        // Skip standalone generic words and ungrounded hardware acronyms like 'cpu'
        if (GENERIC_STANDALONE_WORDS.has(lowerKw) || lowerKw === 'cpu') {
          continue;
        }
        if (text.toLowerCase().includes(lowerKw)) {
          const evidenceSent = sentences.find(s => s.toLowerCase().includes(lowerKw)) || text.slice(0, 150);
          addCandidate(kw, classifyConceptType(kw, evidenceSent), evidenceSent, false, false);
        }
      }
    }

    // -----------------------------------------------------------------------
    // SIGNAL E: Capitalized Technical Compounds, Acronyms & Noise Diagnostics
    // -----------------------------------------------------------------------
    for (const s of sentences) {
      // E1: Capitalized compound phrases (2-4 words) including hyphenated terms:
      // e.g. "Round Robin", "Shortest Job First", "First-Come, First-Served"
      const matches = s.matchAll(/\b([A-Z][a-z]+(?:(?:[-,\s]+)[A-Z][a-z]+){1,3})\b/g);
      for (const m of matches) {
        const phrase = m[1].trim();
        const pWords = phrase.split(/[\s-]+/).filter(Boolean);
        const lastW = pWords[pWords.length - 1].toLowerCase();
        // If phrase ends in a generic artifact noun (e.g. Throughput Number -> reject)
        if (['number', 'example', 'problem', 'result', 'table', 'figure', 'page', 'chapter', 'section', 'student'].includes(lastW)) {
          // If the prefix before the generic noun is a substantive concept (e.g. "Throughput"), extract that
          if (pWords.length === 2 && !GENERIC_BROAD_ROOTS.has(pWords[0].toLowerCase())) {
            addCandidate(pWords[0], classifyConceptType(pWords[0], s), s, false, false);
          }
          continue;
        }
        addCandidate(phrase, classifyConceptType(phrase, s), s, false, false);
      }

      // E2: Acronyms: e.g. "FCFS", "SJF", "SRTF", "MMU", "TLB", "PCB", "IPC", "OS"
      const acrMatches = s.matchAll(/\b([A-Z]{2,6})\b/g);
      for (const m of acrMatches) {
        const acr = m[1].trim();
        if (acr.length >= 2 && !PRONOUNS_AND_DETERMINERS.has(acr.toLowerCase())) {
          // Skip standalone CPU unless defined explicitly in text
          if (acr === 'CPU' && !/(?:cpu\s+(?:is|refers to|defined as)|central processing unit)/i.test(text)) {
            continue;
          }
          // Skip single-letter indexed identifiers like P1, P2, P3
          if (/^[A-Z][0-9]+$/.test(acr)) {
            continue;
          }
          addCandidate(acr, classifyConceptType(acr, s), s, false, false);
        }
      }
    }

    // E3: Explicit noise candidate tracking for diagnostics (Section 42 & Section 8):
    for (const gw of GENERIC_STANDALONE_WORDS) {
      if (new RegExp(`\\b${gw}\\b`, 'i').test(text)) {
        const evidenceSent = sentences.find(s => new RegExp(`\\b${gw}\\b`, 'i').test(s));
        if (evidenceSent) {
          addCandidate(gw, 'concept', evidenceSent, false, false);
        }
      }
    }

    return Array.from(candidateMap.values());
  }
}

// -------------------------------------------------------------------------
// 4. EVIDENCE-BASED CONCEPT VALIDATOR & SCORER
// -------------------------------------------------------------------------

export class ConceptValidator {
  private minConfidence: number;

  constructor(minConfidence = 0.65) {
    this.minConfidence = minConfidence;
  }

  /**
   * Validates a candidate concept against the 10 quality questions and computes confidence.
   */
  validateCandidate(
    candidate: ConceptCandidate,
    allChunks: TextChunk[],
    profile?: DocumentProfile
  ): { accepted: boolean; confidence: number; reason: string; importance: ConceptImportance } {
    const name = candidate.name.trim();
    const lower = name.toLowerCase();

    // 1. Noise check
    if (!isValidConceptName(name, profile)) {
      return {
        accepted: false,
        confidence: 0,
        reason: 'Failed structural validation or identified as generic/uninformative word.',
        importance: 'supporting'
      };
    }

    // 2. Standalone generic words protection:
    // e.g. "system", "software", "resources", "program", "execution", "next", "data", "information"
    const words = lower.split(/\s+/).filter(Boolean);
    if (words.length === 1 && GENERIC_STANDALONE_WORDS.has(words[0])) {
      const isExplicitlyDefined = profile?.definitionsFound.some(d => d.term.toLowerCase() === lower);
      if (!isExplicitlyDefined) {
        return {
          accepted: false,
          confidence: 0,
          reason: `Standalone generic term "${name}" without explicit document definition.`,
          importance: 'supporting'
        };
      }
    }

    // 3. Mandatory Evidence Check: Must have substantive textual evidence
    if (!candidate.evidence || candidate.evidence.trim().length < 15) {
      return {
        accepted: false,
        confidence: 0,
        reason: 'Mandatory source evidence missing or insufficient (< 15 characters).',
        importance: 'supporting'
      };
    }

    // 4. Scoring Signals
    const baseWord = name.replace(/s$/i, '');
    const hasDefinition = Boolean(
      profile?.definitionsFound.some(d => d.term.toLowerCase() === lower || d.term.toLowerCase().includes(baseWord.toLowerCase())) ||
      /(?:is defined as|refers to|is a|is an|is called|known as|ensures|preserves|controls|determines|guarantees|divides|enables|is software that|is an essential mechanism|is a memory management technique|is a hardware cache that)/i.test(candidate.evidence)
    );

    const hasHeadingEvidence = Boolean(
      candidate.isCoreConcept ||
      profile?.sections.some(s => {
        const sh = s.heading.toLowerCase();
        return sh.includes(lower) || lower.includes(sh) || sh.includes(baseWord.toLowerCase());
      })
    );

    const isDomainSpecific = Boolean(
      profile?.domainKeywords.some(dk => dk.toLowerCase() === lower || dk.toLowerCase() === baseWord.toLowerCase()) ||
      words.length >= 2 ||
      (TECHNICAL_DOMAIN_ACRONYMS.has(lower) || (name === name.toUpperCase() && name.length >= 2 && name.length <= 6))
    );

    const explanationDepth = candidate.evidence.length >= 50 ? 1.0 : candidate.evidence.length >= 25 ? 0.7 : 0.4;

    // Count actual meaningful occurrences across all chunks (matching singular & plural)
    let occurrences = candidate.occurrences || 1;
    const escapedRoot = baseWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const nameRegex = new RegExp(`\\b${escapedRoot}(?:s|es)?\\b`, 'i');
    for (const chunk of allChunks) {
      const matches = (chunk.text || '').match(new RegExp(nameRegex.source, 'gi'));
      if (matches) {
        occurrences = Math.max(occurrences, matches.length);
      }
    }
    const meaningfulRecurrence = Math.min(1.0, occurrences / 2);

    // Compute composite confidence
    let confidence = 
      (hasDefinition ? 0.35 : 0) +
      (hasHeadingEvidence ? 0.25 : 0) +
      (isDomainSpecific ? 0.20 : 0) +
      (explanationDepth * 0.15) +
      (meaningfulRecurrence * 0.10);

    // Penalties
    if (words.some(w => GENERIC_STANDALONE_WORDS.has(w)) && !hasDefinition && words.length === 1) {
      confidence -= 0.50;
    }
    if (CONVERSATIONAL_FRAGMENTS.has(lower)) {
      confidence -= 0.50;
    }

    confidence = Math.max(0, Math.min(1, Number(confidence.toFixed(4))));

    if (confidence < this.minConfidence) {
      return {
        accepted: false,
        confidence,
        reason: `Confidence score (${confidence.toFixed(2)}) is below the strict quality threshold (${this.minConfidence}).`,
        importance: 'supporting'
      };
    }

    const importance: ConceptImportance = determineConceptImportance(candidate.name, hasHeadingEvidence, candidate.type).importance;

    return {
      accepted: true,
      confidence,
      reason: hasDefinition
        ? 'Explicitly defined and verified in source text.'
        : 'Domain-specific concept verified with direct text evidence.',
      importance
    };
  }
}

// -------------------------------------------------------------------------
// 5. STRUCTURED LLM CONCEPT EXTRACTOR (Optional Provider)
// -------------------------------------------------------------------------

export function getGeminiApiKey(): string | undefined {
  if (typeof import.meta !== 'undefined' && (import.meta as any).env) {
    const metaEnv = (import.meta as any).env;
    if (metaEnv.VITE_GEMINI_API_KEY) return metaEnv.VITE_GEMINI_API_KEY;
  }
  const proc = typeof globalThis !== 'undefined' ? (globalThis as any).process : undefined;
  if (proc?.env) {
    return proc.env.VITE_GEMINI_API_KEY || proc.env.GEMINI_API_KEY;
  }
  return undefined;
}

export class LLMConceptExtractor implements ConceptExtractionProvider {
  name = 'Gemini-Structured-ConceptExtractor';
  private apiKey?: string;

  constructor(apiKey?: string) {
    this.apiKey = apiKey || getGeminiApiKey();
  }

  async extractConcepts(chunk: TextChunk, profile?: DocumentProfile): Promise<ConceptCandidate[]> {
    if (!this.apiKey) {
      // Fallback to local heuristic extractor if no API key is provided
      const local = new HeuristicConceptExtractor();
      return local.extractConcepts(chunk, profile);
    }

    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${this.apiKey}`;
      const systemInstruction = `
You are GraphMind's high-precision concept extractor.
Your task is to extract ONLY meaningful, teachable concepts supported by direct evidence from the provided text.
PRIORITIZE PRECISION OVER RECALL.
If the evidence does not support the candidate as a genuine knowledge concept, set accepted=false.
Do NOT extract generic words (e.g. system, data, method, result, example, process, problem, student, user).
Respond ONLY with a valid JSON object matching the schema:
{
  "concepts": [
    {
      "candidate": "string",
      "accepted": boolean,
      "canonicalName": "string",
      "type": "string",
      "description": "string",
      "importance": "core | supporting",
      "confidence": number,
      "evidence": [
        {
          "page": number,
          "chunkId": "string",
          "quote": "string"
        }
      ],
      "reason": "string"
    }
  ]
}
`.trim();

      const prompt = `
Document Title: ${profile?.title || 'Learning Material'}
Domain: ${profile?.inferredDomain || 'General'}
Chunk Content:
"""
${chunk.text}
"""
Extract genuine concepts from this chunk.
`.trim();

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: 'application/json'
          }
        })
      });

      if (!response.ok) {
        const local = new HeuristicConceptExtractor();
        return local.extractConcepts(chunk, profile);
      }

      const json = await response.json();
      const rawText = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!rawText) {
        const local = new HeuristicConceptExtractor();
        return local.extractConcepts(chunk, profile);
      }

      const parsed = JSON.parse(rawText);
      const items = Array.isArray(parsed?.concepts) ? parsed.concepts : [];

      const acceptedList: ConceptCandidate[] = [];
      for (const item of items) {
        if (!item.accepted || !item.canonicalName) continue;
        const name = cleanConceptCandidateName(item.canonicalName);
        if (!isStructurallyValidCandidateName(name)) continue;

        // Verify quote exists in chunk text to prevent hallucinations
        const quote = item.evidence?.[0]?.quote || '';
        if (quote && !chunk.text.toLowerCase().includes(quote.toLowerCase().slice(0, 30))) {
          continue; // Hallucination guardrail: reject if quote is absent
        }

        const evidenceItem: ConceptEvidenceItem = {
          sourceId: chunk.sourceId,
          page: chunk.page || 1,
          chunkId: chunk.chunkId,
          text: quote || chunk.text.slice(0, 150)
        };

        acceptedList.push({
          name,
          type: item.type || 'Concept',
          description: item.description || extractConceptDescription(name, chunk.text),
          sourceId: chunk.sourceId,
          sourceChunkId: chunk.chunkId,
          page: chunk.page || 1,
          sourceChunkIds: [chunk.chunkId],
          sourceIds: [chunk.sourceId],
          confidence: typeof item.confidence === 'number' ? item.confidence : 0.9,
          evidence: evidenceItem.text,
          evidenceItems: [evidenceItem],
          importance: item.importance === 'core' ? 'core' : 'supporting',
          isCoreConcept: item.importance === 'core'
        });
      }

      return acceptedList;
    } catch {
      const local = new HeuristicConceptExtractor();
      return local.extractConcepts(chunk, profile);
    }
  }
}

// -------------------------------------------------------------------------
// 6. HEURISTIC HIGH-PRECISION EXTRACTOR (Production Default & Local Engine)
// -------------------------------------------------------------------------

export class HeuristicConceptExtractor implements ConceptExtractionProvider {
  name = 'Heuristic-Evidence-ConceptExtractor';
  private generator = new CandidateGenerator();
  private validator = new ConceptValidator(0.65);

  async extractConcepts(chunk: TextChunk, profile?: DocumentProfile): Promise<ConceptCandidate[]> {
    const rawCandidates = this.generator.generateCandidates(chunk, profile);
    const validatedCandidates: ConceptCandidate[] = [];

    for (const cand of rawCandidates) {
      const result = this.validator.validateCandidate(cand, [chunk], profile);
      if (result.accepted) {
        validatedCandidates.push({
          ...cand,
          confidence: result.confidence,
          importance: result.importance,
          isCoreConcept: result.importance === 'core'
        });
      }
    }

    return validatedCandidates;
  }
}

// -------------------------------------------------------------------------
// 7. DEDUPLICATION HELPER (Clean merging)
// -------------------------------------------------------------------------

export function deduplicateConceptCandidates(candidates: ConceptCandidate[]): ConceptCandidate[] {
  const map = new Map<string, ConceptCandidate>();

  for (const c of candidates) {
    const norm = cleanConceptCandidateName(c.name).toLowerCase();
    if (!norm) continue;

    const existing = map.get(norm);
    if (!existing) {
      map.set(norm, {
        ...c,
        name: cleanConceptCandidateName(c.name),
        sourceIds: [...(c.sourceIds || [c.sourceId])],
        sourceChunkIds: [...(c.sourceChunkIds || [c.sourceChunkId])],
        evidenceItems: c.evidenceItems ? [...c.evidenceItems] : []
      });
    } else {
      // Merge source IDs
      for (const sId of c.sourceIds || [c.sourceId]) {
        if (!existing.sourceIds?.includes(sId)) {
          existing.sourceIds?.push(sId);
        }
      }
      // Merge chunk IDs
      for (const chId of c.sourceChunkIds || [c.sourceChunkId]) {
        if (!existing.sourceChunkIds?.includes(chId)) {
          existing.sourceChunkIds?.push(chId);
        }
      }
      // Merge evidence items
      if (c.evidenceItems) {
        if (!existing.evidenceItems) existing.evidenceItems = [];
        for (const item of c.evidenceItems) {
          if (!existing.evidenceItems.some(e => e.chunkId === item.chunkId && e.text === item.text)) {
            existing.evidenceItems.push(item);
          }
        }
      }
      // Keep higher confidence
      if (typeof c.confidence === 'number') {
        existing.confidence = Math.max(existing.confidence || 0, c.confidence);
      }
      // Core status promotion
      if (c.isCoreConcept || c.importance === 'core') {
        existing.isCoreConcept = true;
        existing.importance = 'core';
      }
      existing.occurrences = (existing.occurrences || 1) + 1;
    }
  }

  return Array.from(map.values());
}

// -------------------------------------------------------------------------
// 8. MASTER CONCEPT EXTRACTION SERVICE
// -------------------------------------------------------------------------

export class ConceptExtractionService {
  private generator = new CandidateGenerator();
  private validator = new ConceptValidator(0.65);

  /**
   * Processes a collection of text chunks end-to-end:
   * 1. Candidate Generation
   * 2. Semantic Validation & Evidence Verification
   * 3. Noise Rejection
   * 4. Deduplication & Importance Classification
   */
  async extractFromChunks(
    chunks: TextChunk[],
    options: ConceptExtractionOptions = {}
  ): Promise<ConceptCandidate[]> {
    if (!chunks || chunks.length === 0) return [];

    const profile = options.documentProfile || buildDocumentProfile(chunks);
    const minConfidence = options.minConfidence ?? 0.65;
    this.validator = new ConceptValidator(minConfidence);

    // Diagnostics reset
    const rejectionReasons: Array<{ candidate: string; reason: string }> = [];
    let noiseRejectedCount = 0;

    // Phase 1: Candidate Generation across all chunks
    const allRawCandidates: ConceptCandidate[] = [];
    for (const chunk of chunks) {
      const chunkCandidates = this.generator.generateCandidates(chunk, profile);
      allRawCandidates.push(...chunkCandidates);
    }

    const uniqueRaw = deduplicateConceptCandidates(allRawCandidates);

    // Phase 2: Strict Semantic Validation & Evidence Checking
    const acceptedCandidates: ConceptCandidate[] = [];
    for (const cand of uniqueRaw) {
      const valResult = this.validator.validateCandidate(cand, chunks, profile);

      if (valResult.accepted) {
        acceptedCandidates.push({
          ...cand,
          confidence: valResult.confidence,
          importance: valResult.importance,
          isCoreConcept: valResult.importance === 'core'
        });
      } else {
        rejectionReasons.push({
          candidate: cand.name,
          reason: valResult.reason
        });
        noiseRejectedCount++;
      }
    }

    const finalDeduplicated = deduplicateConceptCandidates(acceptedCandidates);

    // Record diagnostics
    latestDiagnostics = {
      candidateCount: uniqueRaw.length,
      acceptedCount: finalDeduplicated.length,
      rejectedCount: rejectionReasons.length,
      coreCount: finalDeduplicated.filter(c => c.importance === 'core' || c.isCoreConcept).length,
      supportingCount: finalDeduplicated.filter(c => c.importance !== 'core' && !c.isCoreConcept).length,
      noiseRejectedCount,
      rejectionReasons
    };

    return finalDeduplicated;
  }
}

export const conceptExtractionService = new ConceptExtractionService();

export async function extractConceptsFromChunks(
  chunks: TextChunk[],
  options: ConceptExtractionOptions = {}
): Promise<ConceptCandidate[]> {
  return conceptExtractionService.extractFromChunks(chunks, options);
}

export async function extractConcepts(
  source: KnowledgeSource,
  textOrChunksOrOptions?: string | TextChunk[] | ConceptExtractionOptions,
  options?: ConceptExtractionOptions
): Promise<ConceptExtractionResult> {
  let resolvedOptions: ConceptExtractionOptions = {};
  let resolvedChunks: TextChunk[] = [];

  if (Array.isArray(textOrChunksOrOptions)) {
    resolvedChunks = textOrChunksOrOptions;
    resolvedOptions = options || {};
  } else if (typeof textOrChunksOrOptions === 'string') {
    resolvedChunks = [{
      chunkId: `${source.id}_c1`,
      sourceId: source.id,
      page: 1,
      text: textOrChunksOrOptions,
      index: 0,
      wordCount: textOrChunksOrOptions.split(/\s+/).filter(Boolean).length,
      characterCount: textOrChunksOrOptions.length
    }];
    resolvedOptions = options || {};
  } else if (textOrChunksOrOptions && typeof textOrChunksOrOptions === 'object') {
    resolvedOptions = textOrChunksOrOptions;
  }

  if (resolvedChunks.length === 0) {
    const text = source.text || '';
    if (!text.trim()) {
      return {
        success: true,
        sourceId: source.id,
        concepts: []
      };
    }
    resolvedChunks = [{
      chunkId: `${source.id}_c1`,
      sourceId: source.id,
      page: 1,
      text,
      index: 0,
      wordCount: text.split(/\s+/).filter(Boolean).length,
      characterCount: text.length
    }];
  }

  const concepts = await extractConceptsFromChunks(resolvedChunks, resolvedOptions);
  return {
    success: true,
    sourceId: source.id,
    concepts
  };
}
