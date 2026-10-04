import type { 
  ConceptCandidate, 
  CanonicalConcept, 
  NormalizationResult,
  ConceptCandidateType,
  KnowledgeSource,
  TextChunk,
  ConceptRelevanceReport
} from '../types/knowledgeGraph';
import { extractConcepts, type ConceptExtractionOptions } from './conceptExtraction';
import { GENERIC_BROAD_ROOTS } from '../config/conceptQuality';

/**
 * =========================================================================
 * CONCEPT NORMALIZATION SERVICE (Day 2, Step 5)
 * Pipeline: RAW EXTRACTED CONCEPTS → CANONICAL CONCEPTS
 * =========================================================================
 */

// -------------------------------------------------------------------------
// 1. DICTIONARIES & EQUIVALENCE TABLES
// -------------------------------------------------------------------------

/**
 * Technical Acronym / Abbreviation Equivalences
 * Bi-directional mapping between recognized technical acronyms and full names.
 */
const TECHNICAL_ACRONYM_MAP = new Map<string, string>([
  ['cnn', 'convolutional neural network'],
  ['rnn', 'recurrent neural network'],
  ['gan', 'generative adversarial network'],
  ['svm', 'support vector machine'],
  ['mlp', 'multilayer perceptron'],
  ['sgd', 'stochastic gradient descent'],
  ['gnn', 'graph neural network'],
  ['vae', 'variational autoencoder'],
  ['nlp', 'natural language processing'],
  ['llm', 'large language model'],
  ['ann', 'artificial neural network'],
  ['pca', 'principal component analysis'],
  ['rl', 'reinforcement learning'],
  ['lstm', 'long short term memory'],
  ['gru', 'gated recurrent unit'],
  ['bert', 'bert'],
  ['gpt', 'gpt']
]);

/**
 * Words ending with 's' that are intrinsically singular in technical literature
 * and MUST NOT be stemmed or singularized.
 */
const PRESERVE_S_WORDS = new Set<string>([
  'means', 'bayes', 'gauss', 'series', 'basis', 'physics', 'cross', 'bias',
  'hypothesis', 'analysis', 'synthesis', 'metropolis', 'markov', 'corpus', 'status',
  'axis', 'focus', 'lens', 'radius', 'apparatus', 'stimulus', 'nucleus', 'calculus'
]);

/**
 * Safe singularization of technical noun suffixes.
 * Handles standard plurals (-ies -> -y, -es -> -, -s -> -) while protecting invariants.
 */
export function safeSingularize(word: string): string {
  const lower = word.toLowerCase();
  const root = lower.split(/[- ]/).pop() || lower;
  if (PRESERVE_S_WORDS.has(root)) return lower;

  // -ies -> -y: e.g. "methodologies" -> "methodology", "properties" -> "property"
  if (lower.endsWith('ies') && lower.length > 4) {
    return `${lower.slice(0, -3)}y`;
  }

  // -es after sibilants: e.g. "losses" -> "loss", "matrices" -> "matrix"
  if (lower === 'matrices') return 'matrix';
  if (lower.endsWith('es') && (lower.endsWith('ses') || lower.endsWith('xes') || lower.endsWith('ches') || lower.endsWith('shes'))) {
    return lower.slice(0, -2);
  }

  // standard trailing -s: e.g. "networks" -> "network", "transformers" -> "transformer"
  if (lower.endsWith('s') && !lower.endsWith('ss') && lower.length > 3) {
    return lower.slice(0, -1);
  }

  return lower;
}

/**
 * Converts a raw name into a clean singular Title Case canonical display name.
 * e.g. "Transformers" -> "Transformer", "Convolutional Neural Networks" -> "Convolutional Neural Network"
 * Also strips redundant classification suffixes if the base technical root is substantive.
 */
export function toCanonicalDisplayName(name: string): string {
  let clean = name.trim();

  // Strip redundant classification suffix only when it's genuinely redundant
  // e.g. "Transformer Architecture" -> "Transformer"
  // But preserve complete technical compounds like "Backpropagation Algorithm", "Mirror Formula", "Process Control Block"
  if (/^transformer\s+architecture$/i.test(clean)) {
    clean = 'Transformer';
  }

  const words = clean.split(' ');
  const last = words[words.length - 1];
  const sing = safeSingularize(last);
  if (sing !== last.toLowerCase()) {
    const isUpper = last[0] === last[0].toUpperCase();
    words[words.length - 1] = isUpper ? (last[0] + sing.slice(1)) : sing;
    clean = words.join(' ');
  }
  return clean;
}

/**
 * Generates a normalized semantic key for grouping concept variations.
 * Handles:
 * - Case insensitivity ("Deep Learning" vs "deep learning")
 * - Punctuation stripping ("Deep-learning" vs "Deep Learning")
 * - Whitespace consolidation
 * - Spelling/dialect variations (e.g., "neighbours" vs "neighbors")
 * - Safe singularization of final nouns ("Neural Networks" vs "Neural Network")
 */
export function generateCanonicalKey(name: string): string {
  if (!name || typeof name !== 'string') return '';

  let clean = name.toLowerCase()
    .replace(/^(?:the|a|an)\s+/i, '')
    .replace(/[-_–—/]/g, ' ')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Standardize common spelling/dialect variations
  clean = clean
    .replace(/\bneighbours?\b/g, 'neighbor')
    .replace(/\boptimis(e|ing|ation)s?\b/g, 'optimize')
    .replace(/\bnormalis(e|ing|ation)s?\b/g, 'normalize')
    .replace(/\bmodell?ings?\b/g, 'modeling')
    .replace(/\bfeed\s*forward\b/g, 'feedforward')
    .replace(/\bmulti\s*head\b/g, 'multihead')
    .replace(/\bself\s*attention\b/g, 'self attention');

  // Singularize the final noun of the phrase (e.g. "Convolutional Neural Networks" -> "network")
  const words = clean.split(' ');
  const singularized = words.map((w, idx) => {
    if (idx === words.length - 1) {
      return safeSingularize(w);
    }
    return w;
  });

  const baseKey = singularized.join(' ');

  // If the normalized key is an acronym (e.g. "cnn"), expand to full canonical key
  return TECHNICAL_ACRONYM_MAP.get(baseKey) || baseKey;
}

/**
 * Strips redundant generic classifying suffixes if the base technical root is substantive.
 * e.g. "transformer architecture" -> "transformer", "transformer model" -> "transformer"
 */
export function getClusterRootKey(key: string): string {
  const stripped = key.replace(/\s+(?:architecture|model|algorithm|method|technique|mechanism)$/i, '').trim();
  // Protect base words that need modifiers (e.g. "deep", "neural", "linear", "machine")
  const nonStandalones = new Set([
    'deep', 'neural', 'linear', 'machine', 'support', 'random', 'gradient',
    ...GENERIC_BROAD_ROOTS
  ]);
  if (stripped.length >= 6 && !nonStandalones.has(stripped)) {
    return stripped;
  }
  return key;
}

/**
 * Checks whether two concept names refer to the exact same semantic entity.
 * Strictly prevents merging related but distinct concepts (e.g. "Neural Networks" != "Deep Learning").
 */
export function areSemanticDuplicates(nameA: string, nameB: string): boolean {
  if (!nameA || !nameB) return false;
  const keyA = generateCanonicalKey(nameA);
  const keyB = generateCanonicalKey(nameB);

  // Exact normalized match
  if (keyA === keyB) return true;

  // Root cluster match (e.g. "transformer" vs "transformer architecture")
  const rootA = getClusterRootKey(keyA);
  const rootB = getClusterRootKey(keyB);
  if (rootA === rootB && rootA.length >= 5) return true;

  return false;
}

/**
 * Generates a clean, deterministic, kebab-case canonical ID.
 * e.g. "Deep Learning" -> "concept-deep-learning"
 * e.g. "Transformer Architecture" -> "concept-transformer"
 */
export function generateCanonicalConceptId(name: string): string {
  const key = generateCanonicalKey(name);
  const cluster = getClusterRootKey(key);
  const slug = cluster
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  return `concept-${slug}`;
}

// -------------------------------------------------------------------------
// 2. CANONICAL REPRESENTATION SELECTION
// -------------------------------------------------------------------------

/**
 * Selects the best canonical display name between two candidates.
 * Prefers clean standalone entity names over redundant suffixes, and Title Case over acronyms.
 */
function isBetterName(candidate: string, currentBest: string): boolean {
  // If one is an all-caps acronym (e.g. "CNN") and the other is spelled out, prefer spelled out
  const isAcronymA = /^[A-Z]{2,6}$/.test(candidate.trim());
  const isAcronymB = /^[A-Z]{2,6}$/.test(currentBest.trim());
  if (isAcronymA && !isAcronymB) return false;
  if (!isAcronymA && isAcronymB) return true;

  // Prefer clean entity name without redundant suffix (e.g. "Transformer" > "Transformer Architecture")
  const hasSuffixA = /\s+(?:architecture|model|algorithm|method|technique|mechanism)$/i.test(candidate);
  const hasSuffixB = /\s+(?:architecture|model|algorithm|method|technique|mechanism)$/i.test(currentBest);
  if (!hasSuffixA && hasSuffixB) return true;
  if (hasSuffixA && !hasSuffixB) return false;

  // Prefer Title Case over lowercase
  const upperA = (candidate.match(/[A-Z]/g) || []).length;
  const upperB = (currentBest.match(/[A-Z]/g) || []).length;
  if (upperA !== upperB) return upperA > upperB;

  // Prefer singular over plural in canonical name
  const candidateLower = candidate.toLowerCase();
  const currentLower = currentBest.toLowerCase();
  if (candidateLower.endsWith('s') && !currentLower.endsWith('s')) return false;
  if (!candidateLower.endsWith('s') && currentLower.endsWith('s')) return true;

  // Prefer names without unnecessary hyphens when space is standard, but preserve Self-Attention
  return candidate.length >= currentBest.length;
}

/**
 * Selects the most informative, definitive explanation between two candidate descriptions.
 */
function selectBestDescription(descA: string, descB: string): string {
  if (!descA) return descB || '';
  if (!descB) return descA || '';

  const hasDefA = /\b(?:is an?|are|refers to|computes|enables|was proposed)\b/i.test(descA);
  const hasDefB = /\b(?:is an?|are|refers to|computes|enables|was proposed)\b/i.test(descB);

  if (hasDefA && !hasDefB) return descA;
  if (!hasDefA && hasDefB) return descB;

  // Avoid fallback boilerplate ("is a key concept discussed in...")
  const isFallbackA = descA.includes('discussed in') || descA.includes('key concept');
  const isFallbackB = descB.includes('discussed in') || descB.includes('key concept');
  if (!isFallbackA && isFallbackB) return descA;
  if (isFallbackA && !isFallbackB) return descB;

  return descA.length >= descB.length ? descA : descB;
}

/**
 * Upgrades generic 'concept' types to specific architecture, algorithm, or method categories.
 */
function resolveConceptType(typeA: ConceptCandidateType, typeB: ConceptCandidateType): ConceptCandidateType {
  if (typeA && typeA !== 'concept') return typeA;
  if (typeB && typeB !== 'concept') return typeB;
  return typeA || typeB || 'concept';
}

// -------------------------------------------------------------------------
// 3. MASTER NORMALIZATION ENGINE
// -------------------------------------------------------------------------

/**
 * Normalizes and merges extracted concept candidates into canonical knowledge graph concepts.
 * Handles capitalization, whitespace, punctuation, spelling variations, plurals, and semantic duplicates.
 * Merges source references (sourceIds) and preserves provenance evidence (sourceChunkIds).
 */
export function normalizeConcepts(rawConcepts: ConceptCandidate[]): CanonicalConcept[] {
  if (!rawConcepts || rawConcepts.length === 0) {
    return [];
  }

  const canonicalMap = new Map<string, CanonicalConcept>();

  for (const raw of rawConcepts) {
    if (!raw.name || typeof raw.name !== 'string') continue;

    const baseKey = generateCanonicalKey(raw.name);
    if (!baseKey) continue;

    // Determine cluster key for semantic merging
    const clusterKey = getClusterRootKey(baseKey);

    // Normalize source IDs and chunk IDs from raw candidate
    const candidateSourceIds: string[] = raw.sourceId ? [raw.sourceId] : [];
    const candidateChunkIds: string[] = [];
    if (raw.sourceChunkId) candidateChunkIds.push(raw.sourceChunkId);
    if (raw.sourceChunkIds && Array.isArray(raw.sourceChunkIds)) {
      for (const id of raw.sourceChunkIds) {
        if (!candidateChunkIds.includes(id)) candidateChunkIds.push(id);
      }
    }

    const displayName = toCanonicalDisplayName(raw.name);
    const existing = canonicalMap.get(clusterKey);

    if (!existing) {
      // First time seeing this concept: initialize canonical representation
      const id = generateCanonicalConceptId(raw.name);
      canonicalMap.set(clusterKey, {
        id,
        name: displayName,
        type: raw.type || 'concept',
        description: raw.description?.trim() || '',
        sourceIds: candidateSourceIds,
        sourceChunkIds: candidateChunkIds,
        occurrences: raw.occurrences || 1,
        confidence: raw.confidence || 0.90,
        aliases: [],
        evidence: raw.evidence,
        importance: raw.importance,
        isCoreConcept: raw.isCoreConcept
      });
    } else {
      // Merge with existing canonical concept
      existing.occurrences += (raw.occurrences || 1);

      // Merge source IDs (deduplicated)
      for (const sId of candidateSourceIds) {
        if (!existing.sourceIds.includes(sId)) {
          existing.sourceIds.push(sId);
        }
      }

      // Merge source chunk IDs (preserving complete provenance evidence)
      for (const cId of candidateChunkIds) {
        if (!existing.sourceChunkIds.includes(cId)) {
          existing.sourceChunkIds.push(cId);
        }
      }

      // Track alternate naming variation in aliases
      if (raw.name.trim() !== existing.name) {
        if (!existing.aliases) existing.aliases = [];
        const alt = raw.name.trim();
        if (!existing.aliases.includes(alt)) {
          existing.aliases.push(alt);
        }
      }

      // Upgrade canonical name if current candidate has better casing/spelling
      if (isBetterName(displayName, existing.name)) {
        if (!existing.aliases) existing.aliases = [];
        if (!existing.aliases.includes(existing.name)) {
          existing.aliases.push(existing.name);
        }
        existing.name = displayName;
        existing.id = generateCanonicalConceptId(displayName);
      }

      // Upgrade type if more specific
      existing.type = resolveConceptType(existing.type, raw.type);

      // Upgrade description if current candidate has a better definition
      existing.description = selectBestDescription(raw.description, existing.description);

      // Preserve highest importance and evidence
      if (raw.evidence && !existing.evidence) {
        existing.evidence = raw.evidence;
      }
      if (typeof raw.importance === 'string') {
        existing.importance = raw.importance;
      } else if (typeof raw.importance === 'number') {
        const prev = typeof existing.importance === 'number' ? existing.importance : 0;
        existing.importance = Math.max(prev, raw.importance);
      }
      if (raw.isCoreConcept) {
        existing.isCoreConcept = true;
      }

      // Boost confidence on cross-source / cross-chunk validation
      existing.confidence = Math.min(0.99, existing.confidence + 0.03);
    }
  }

  // -------------------------------------------------------------------------
  // Subsumption Pass:
  // 1. Subsume bare generic single-word nouns when compound concepts exist
  //    (e.g., "Length" subsumed into "Focal Length", "Image" into "Real Image")
  // 2. Subsume overly-specific phrase variants into the cleaner canonical concept
  //    (e.g., "Focal Length of Concave Mirror" into "Focal Length")
  // -------------------------------------------------------------------------
  const multiWordConcepts = Array.from(canonicalMap.values()).filter(c => c.name.trim().split(/\s+/).length > 1);
  const droppedIds = new Set<string>();

  for (const concept of canonicalMap.values()) {
    const words = concept.name.trim().toLowerCase().split(/\s+/);

    // 1. Bare generic single word check
    if (words.length === 1 && GENERIC_BROAD_ROOTS.has(words[0])) {
      const parentCompound = multiWordConcepts.find(mc => {
        const mcWords = mc.name.toLowerCase().split(/\s+/);
        return mcWords.includes(words[0]) || mcWords.includes(safeSingularize(words[0]));
      });

      if (parentCompound) {
        parentCompound.occurrences += concept.occurrences;
        for (const sId of concept.sourceIds || []) {
          if (!parentCompound.sourceIds.includes(sId)) parentCompound.sourceIds.push(sId);
        }
        for (const cId of concept.sourceChunkIds || []) {
          if (!parentCompound.sourceChunkIds.includes(cId)) parentCompound.sourceChunkIds.push(cId);
        }
        droppedIds.add(concept.id);
        continue;
      }
    }

    // 2. Overly-specific phrase variant: e.g. "Focal Length Of..."
    const lowerName = concept.name.toLowerCase();
    if (/\b(?:of|by|for|in)\b/.test(lowerName)) {
      const baseRoot = lowerName.split(/\s+(?:of|by|for|in)\s+/)[0].trim();
      if (baseRoot.length >= 4) {
        const matchingClean = Array.from(canonicalMap.values()).find(
          c => c.id !== concept.id && !droppedIds.has(c.id) && c.name.toLowerCase() === baseRoot
        );
        if (matchingClean) {
          matchingClean.occurrences += concept.occurrences;
          for (const sId of concept.sourceIds || []) {
            if (!matchingClean.sourceIds.includes(sId)) matchingClean.sourceIds.push(sId);
          }
          for (const cId of concept.sourceChunkIds || []) {
            if (!matchingClean.sourceChunkIds.includes(cId)) matchingClean.sourceChunkIds.push(cId);
          }
          droppedIds.add(concept.id);
        }
      }
    }
  }

  // Format final canonical concepts
  const result: CanonicalConcept[] = [];
  for (const concept of canonicalMap.values()) {
    if (droppedIds.has(concept.id)) continue;
    // Ensure aliases don't include the primary canonical name
    if (concept.aliases) {
      concept.aliases = concept.aliases.filter(a => a.toLowerCase() !== concept.name.toLowerCase());
      if (concept.aliases.length === 0) {
        delete concept.aliases;
      }
    }
    result.push(concept);
  }

  // Sort by prominence (number of sources and occurrences)
  return result.sort((a, b) => {
    if (b.sourceIds.length !== a.sourceIds.length) {
      return b.sourceIds.length - a.sourceIds.length;
    }
    return b.occurrences - a.occurrences;
  });
}

/**
 * Normalizes extracted concept candidates and returns an informative report with reduction metrics.
 */
export function normalizeConceptsWithReport(rawConcepts: ConceptCandidate[]): NormalizationResult {
  const canonicalConcepts = normalizeConcepts(rawConcepts);
  return {
    success: true,
    canonicalConcepts,
    rawCount: rawConcepts.length,
    mergedCount: rawConcepts.length - canonicalConcepts.length
  };
}

/**
 * Master Pipeline Integration Function:
 * SOURCE → TEXT → CHUNKS → RAW CONCEPTS → CANONICAL CONCEPTS
 */
export async function extractAndNormalizeConcepts(
  source: KnowledgeSource,
  textOrChunks?: string | TextChunk[],
  options?: ConceptExtractionOptions
): Promise<{
  success: boolean;
  sourceId: string;
  concepts: CanonicalConcept[];
  relevanceReport?: ConceptRelevanceReport;
  error?: string;
}> {
  const extractionResult = await extractConcepts(source, textOrChunks, options);
  if (!extractionResult.success) {
    return {
      success: false,
      sourceId: source.id,
      concepts: [],
      error: extractionResult.error
    };
  }

  const canonicalConcepts = normalizeConcepts(extractionResult.concepts);
  return {
    success: true,
    sourceId: source.id,
    concepts: canonicalConcepts,
    relevanceReport: extractionResult.relevanceReport
  };
}

