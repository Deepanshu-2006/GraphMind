import type { 
  ConceptCandidate, 
  TextChunk, 
  ScoredCandidateConcept, 
  ConceptRelevanceReport,
  DocumentProfile
} from '../types/knowledgeGraph';
import {
  type ConceptQualityConfig,
  DEFAULT_CONCEPT_QUALITY_CONFIG,
  GENERIC_BROAD_ROOTS,
  GENERIC_ADJECTIVES_AND_ADVERBS,
  GENERIC_VERB_ROOTS,
  ACADEMIC_META_WORDS,
  TECHNICAL_DOMAIN_ACRONYMS
} from '../config/conceptQuality';

/**
 * =========================================================================
 * CONCEPT RELEVANCE & QUALITY FILTERING SERVICE
 * 
 * Pipeline position:
 * Candidate Extraction → CONCEPT RELEVANCE & QUALITY FILTERING → Normalization → Graph
 * =========================================================================
 */

/**
 * Strips formatting, punctuation, and leading determiners to get clean lexical tokens.
 */
function cleanLexicalWord(word: string): string {
  return word.toLowerCase().replace(/^[^\w]+|[^\w]+$/g, '').trim();
}

/**
 * Evaluates whether a candidate concept is a generic word, adjective, verb, or uninformative phrase.
 * If documentProfile is provided, recognizes domain-specific terms within this document.
 */
export function isGenericConceptPhrase(name: string, documentProfile?: DocumentProfile): { isGeneric: boolean; reason?: string } {
  if (!name || typeof name !== 'string') {
    return { isGeneric: true, reason: 'Empty or invalid concept string' };
  }

  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();

  // Strip leading determiners ("the", "a", "an")
  const substantive = lower.replace(/^(?:the|a|an|this|that|these|those)\s+/i, '').trim();
  const words = substantive.split(/[\s-]+/).map(cleanLexicalWord).filter(Boolean);

  if (words.length === 0) {
    return { isGeneric: true, reason: 'No substantive words in candidate' };
  }

  // Length checks
  if (trimmed.length < 2) {
    return { isGeneric: true, reason: 'Candidate name too short (< 2 chars)' };
  }

  // Document Context Check:
  // If the document explicitly identifies this term as a domain keyword, definition, or major topic,
  // do NOT classify it as generic unless it is a classic generic standalone lacking an explicit definition.
  const ALWAYS_GENERIC_STANDALONES = new Set([
    'system', 'data', 'information', 'method', 'result', 'example', 'problem',
    'approach', 'section', 'chapter', 'student', 'user', 'software', 'resource',
    'resources', 'program', 'execution', 'next', 'use', 'using', 'detail', 'object',
    'property', 'case', 'content', 'procedure', 'value', 'parameter', 'pattern',
    'metric', 'input', 'output', 'error', 'solution', 'answer', 'table', 'figure',
    'page', 'algorithm', 'process',
    ...GENERIC_BROAD_ROOTS
  ]);

  if (words.length === 1 && ALWAYS_GENERIC_STANDALONES.has(words[0])) {
    const isExplicitlyDefined = documentProfile?.definitionsFound?.some(df => df.term.toLowerCase() === lower);
    if (!isExplicitlyDefined) {
      return { isGeneric: true, reason: `Generic standalone noun without explicit document definition ("${trimmed}")` };
    }
    return { isGeneric: false };
  }

  if (documentProfile) {

    const isAllGenericOrMeta = words.every(w =>
      GENERIC_BROAD_ROOTS.has(w) ||
      GENERIC_ADJECTIVES_AND_ADVERBS.has(w) ||
      GENERIC_VERB_ROOTS.has(w) ||
      ACADEMIC_META_WORDS.has(w)
    );

    if (!isAllGenericOrMeta) {
      const isDomainTerm = 
        !ACADEMIC_META_WORDS.has(lower) &&
        !ALWAYS_GENERIC_STANDALONES.has(words[0]) &&
        (documentProfile.domainKeywords.some(dk => dk.toLowerCase() === lower || dk.toLowerCase() === words[0]) ||
         documentProfile.definitionsFound.some(df => df.term.toLowerCase() === lower) ||
         documentProfile.majorTopics.some(mt => {
           const cleanMt = mt.toLowerCase().replace(/^#+\s*/, '').trim();
           const mtWords = cleanMt.split(/\s+/).filter(Boolean);
           if (mtWords.every(w => GENERIC_BROAD_ROOTS.has(w) || GENERIC_ADJECTIVES_AND_ADVERBS.has(w) || ACADEMIC_META_WORDS.has(w))) {
             return false;
           }
           return cleanMt === lower || (words.length >= 2 && cleanMt.includes(lower));
         }));
      if (isDomainTerm) {
        return { isGeneric: false };
      }
    }
  }

  // Single word checks
  if (words.length === 1) {
    const word = words[0];

    // Check if approved technical acronym (e.g. CPU, MMU, IPC, CNN, OS)
    if (TECHNICAL_DOMAIN_ACRONYMS.has(word) || (trimmed === trimmed.toUpperCase() && trimmed.length >= 2 && trimmed.length <= 6)) {
      return { isGeneric: false };
    }

    const PRONOUNS_AND_DETERMINERS = new Set([
      'the', 'a', 'an', 'this', 'that', 'these', 'those', 'there', 'here',
      'it', 'its', 'they', 'them', 'their', 'we', 'us', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her',
      'user', 'users', 'someone', 'everyone', 'anyone', 'some', 'many', 'such', 'each', 'every', 'all', 'both', 'few', 'other', 'another', 'more', 'most'
    ]);
    if (PRONOUNS_AND_DETERMINERS.has(word)) {
      return { isGeneric: true, reason: `Pronoun, determiner, or generic user reference ("${trimmed}")` };
    }

    if (GENERIC_BROAD_ROOTS.has(word)) {
      return { isGeneric: true, reason: `Generic standalone noun without domain qualifier ("${trimmed}")` };
    }

    if (GENERIC_ADJECTIVES_AND_ADVERBS.has(word)) {
      return { isGeneric: true, reason: `Standalone adjective or adverb ("${trimmed}")` };
    }

    if (GENERIC_VERB_ROOTS.has(word)) {
      return { isGeneric: true, reason: `Standalone verb or non-noun ("${trimmed}")` };
    }

    if (ACADEMIC_META_WORDS.has(word)) {
      return { isGeneric: true, reason: `Document meta-word or publishing artifact ("${trimmed}")` };
    }

    // Single lowercase words without domain markers are typically noise
    if (!/^[A-Z]/.test(trimmed) && trimmed.length < 6) {
      return { isGeneric: true, reason: `Uncapitalized short single word ("${trimmed}")` };
    }
  }

  // Multi-word checks:
  // Reject if EVERY word in the phrase is a generic filler, adjective, verb, or meta-word
  // e.g. "Important Method", "System Data", "Example Process", "General Information", "New Approach"
  const allWordsGeneric = words.every(
    w => GENERIC_BROAD_ROOTS.has(w) ||
         GENERIC_ADJECTIVES_AND_ADVERBS.has(w) ||
         GENERIC_VERB_ROOTS.has(w) ||
         ACADEMIC_META_WORDS.has(w)
  );

  if (allWordsGeneric) {
    return { 
      isGeneric: true, 
      reason: `Phrase composed entirely of generic words ("${trimmed}")` 
    };
  }

  // Reject phrases ending with prepositions, conjunctions, relative pronouns, or auxiliary verbs
  const lastWord = words[words.length - 1];
  if (['and', 'or', 'in', 'on', 'at', 'for', 'with', 'by', 'from', 'to', 'of', 'as', 'that', 'which', 'who', 'whose', 'where', 'when', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has'].includes(lastWord)) {
    return { isGeneric: true, reason: `Phrase ends with function word ("${trimmed}")` };
  }

  // Reject conversational fragments
  if (['such as', 'for example', 'as well as', 'in addition', 'on the other hand'].includes(substantive)) {
    return { isGeneric: true, reason: `Conversational sentence fragment ("${trimmed}")` };
  }

  return { isGeneric: false };
}

/**
 * Searches all chunks for occurrences, dispersion, headings, and contextual sentences for a concept candidate.
 */
export function analyzeCandidateOccurrences(
  name: string,
  chunks: TextChunk[],
  documentProfile?: DocumentProfile
): {
  frequency: number;
  chunkIds: string[];
  headings: string[];
  contextSentences: string[];
  hasDefinitionEvidence: boolean;
  hasRelationshipEvidence: boolean;
  onlySentenceInitial: boolean;
} {
  const clean = name.trim();
  const lower = clean.toLowerCase();

  // Escape regex special chars
  const escaped = lower.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const termRegex = new RegExp(`\\b${escaped}(?:s|es)?\\b`, 'gi');

  let frequency = 0;
  const chunkIdSet = new Set<string>();
  const headingSet = new Set<string>();
  const sentenceList: string[] = [];

  let sentenceInitialMatches = 0;
  let nonSentenceInitialMatches = 0;
  let hasDefinitionEvidence = false;
  let hasRelationshipEvidence = false;

  const definitionPattern = new RegExp(
    `\\b${escaped}\\b(?:\\s*\\([A-Z0-9]{2,6}\\))?\\s+(?:is an?|are|refers to|is defined as|was proposed as|enables|allows|provides the|computes|acts as|serves as|manages|allocates|translates|accelerates|executes|coordinates|controls|divides|creates|updates|optimizes|trains|learns|processes|evaluates|transforms|minimizes|maximizes)\\b`,
    'i'
  );

  const relationshipPattern = new RegExp(
    `\\b${escaped}\\b[\\s\\w,()]{0,35}\\b(?:use[s]?|depend[s]? on|rel(?:y|ies) on|consist[s]? of|composed of|part of|extends?|interacts? with|connected to|allocates?|translates?|exchanges?|accelerates?|updates?|optimizes?|minimizes?|maximizes?)\\b`,
    'i'
  );

  for (const chunk of chunks) {
    const text = chunk.text || '';
    const heading = chunk.heading || '';

    // Check heading presence
    if (heading) {
      if (termRegex.test(heading)) {
        headingSet.add(heading);
      }
    }

    // Scan text for occurrences
    const sentences = text
      .split(/(?<=[.!?])\s+|\n+/)
      .map(s => s.trim())
      .filter(s => s.length > 15);

    for (const sentence of sentences) {
      termRegex.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = termRegex.exec(sentence)) !== null) {
        frequency++;
        chunkIdSet.add(chunk.chunkId);

        // Check whether this match is sentence-initial or non-sentence-initial
        const matchIndex = match.index;
        const precedingText = sentence.slice(0, matchIndex).trim();

        if (precedingText.length === 0 || /^[0-9]+[.)]\s*$/.test(precedingText) || /^[-*•]\s*$/.test(precedingText)) {
          sentenceInitialMatches++;
        } else {
          // If capitalized inside the sentence, strong signal of proper noun/technical entity
          const matchedText = match[0];
          if (/^[A-Z]/.test(matchedText)) {
            nonSentenceInitialMatches += 2;
          } else {
            nonSentenceInitialMatches++;
          }
        }

        // Collect rich contextual sentences (up to 4)
        if (sentenceList.length < 4 && !sentenceList.includes(sentence)) {
          sentenceList.push(sentence);
        }

        // Check for definition syntax
        if (!hasDefinitionEvidence && definitionPattern.test(sentence)) {
          hasDefinitionEvidence = true;
        }

        // Check for relationship predicate syntax
        if (!hasRelationshipEvidence && relationshipPattern.test(sentence)) {
          hasRelationshipEvidence = true;
        }
      }
    }
  }

  // Cross-reference with DocumentProfile definitions and formulas
  if (documentProfile?.definitionsFound) {
    if (documentProfile.definitionsFound.some(d => d.term.toLowerCase() === lower)) {
      hasDefinitionEvidence = true;
    }
  }
  if (documentProfile?.formulasFound) {
    if (documentProfile.formulasFound.some(f => (f.term && f.term.toLowerCase() === lower) || f.formula.includes(clean))) {
      hasRelationshipEvidence = true;
    }
  }
  if (documentProfile?.sections) {
    for (const sec of documentProfile.sections) {
      if (termRegex.test(sec.heading)) {
        headingSet.add(sec.heading);
      }
    }
  }

  const onlySentenceInitial = (sentenceInitialMatches > 0 && nonSentenceInitialMatches === 0);

  return {
    frequency: Math.max(1, frequency),
    chunkIds: Array.from(chunkIdSet),
    headings: Array.from(headingSet),
    contextSentences: sentenceList,
    hasDefinitionEvidence,
    hasRelationshipEvidence,
    onlySentenceInitial
  };
}

/**
 * Calculates the adaptive maximum concepts limit based on document size.
 */
export function getAdaptiveMaxConcepts(
  totalChunks: number,
  totalWords: number,
  config: ConceptQualityConfig = DEFAULT_CONCEPT_QUALITY_CONFIG
): number {
  if (config.maxConceptsOverride && config.maxConceptsOverride > 0) {
    return config.maxConceptsOverride;
  }

  const limits = config.adaptiveLimits;

  if (totalChunks <= limits.smallDocument.maxChunks || totalWords <= limits.smallDocument.maxWords) {
    return limits.smallDocument.maxConcepts;
  }

  if (totalChunks <= limits.mediumDocument.maxChunks || totalWords <= limits.mediumDocument.maxWords) {
    return limits.mediumDocument.maxConcepts;
  }

  return limits.largeDocument.maxConcepts;
}

/**
 * Evaluates a candidate concept against the 9 quality/relevance criteria.
 */
export function scoreCandidate(
  candidate: ConceptCandidate,
  allChunks: TextChunk[],
  _totalWords: number,
  config: ConceptQualityConfig = DEFAULT_CONCEPT_QUALITY_CONFIG,
  documentProfile?: DocumentProfile
): ScoredCandidateConcept {
  const { isGeneric, reason: genericReason } = isGenericConceptPhrase(candidate.name, documentProfile);
  const occ = analyzeCandidateOccurrences(candidate.name, allChunks, documentProfile);

  const totalChunks = Math.max(1, allChunks.length);
  const words = candidate.name.trim().split(/[\s-]+/).filter(Boolean);
  const wordCount = words.length;
  const isAcronym = TECHNICAL_DOMAIN_ACRONYMS.has(candidate.name.toLowerCase()) || 
    (candidate.name === candidate.name.toUpperCase() && candidate.name.length >= 2 && candidate.name.length <= 6);

  // If candidate has explicit definitional evidence attached
  if (candidate.evidence && new RegExp(`\\b${candidate.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b[\\s\\w,()]{0,15}\\b(?:is an?|are|refers to|is defined as|is called|known as)\\b`, 'i').test(candidate.evidence)) {
    occ.hasDefinitionEvidence = true;
  }

  // 1. Frequency Score (logarithmic scaling so raw repetition never dominates)
  const frequencyScore = Math.min(1.0, Math.log2(1 + occ.frequency) / 3.5);

  // 2. Dispersion Score (presence across multiple sections/chunks)
  const dispersionScore = Math.min(1.0, occ.chunkIds.length / Math.min(totalChunks, 4));

  // 3. Heading Score (presence in chunk heading or section title)
  let headingScore = 0.0;
  if (occ.headings.length > 0) {
    const exactHeading = occ.headings.some(h => new RegExp(`\\b${candidate.name}\\b`, 'i').test(h));
    headingScore = exactHeading ? 1.0 : 0.65;
  }

  // 4. Semantic Specificity Score
  let specificityScore = 0.35;
  if (isAcronym) {
    specificityScore = 0.95;
  } else if (wordCount >= 3) {
    specificityScore = 0.95;
  } else if (wordCount === 2) {
    specificityScore = 0.85;
  } else if (wordCount === 1) {
    if (/^[A-Z]/.test(candidate.name) && candidate.name.length >= 9) {
      specificityScore = 0.85;
    } else if (/^[A-Z]/.test(candidate.name) && candidate.name.length >= 6) {
      specificityScore = 0.65;
    } else if (documentProfile?.domainKeywords.some(dk => dk.toLowerCase() === candidate.name.toLowerCase().trim())) {
      // Specialized domain single word (e.g. "mirror" in optics)
      specificityScore = 0.80;
    } else {
      specificityScore = 0.25;
    }
  }

  // 5. Relationship or Definition Score
  let relationshipScore = 0.0;
  if (occ.hasDefinitionEvidence) {
    relationshipScore = 1.0;
  } else if (occ.hasRelationshipEvidence) {
    relationshipScore = 0.70;
  } else if (candidate.evidence && candidate.evidence.length >= 40) {
    relationshipScore = 0.30;
  }

  // 6. Context Quality Score (substantiveness of contextual sentences)
  let contextQualityScore = 0.30;
  if (occ.contextSentences.length > 0) {
    const avgLen = occ.contextSentences.reduce((acc, s) => acc + s.length, 0) / occ.contextSentences.length;
    if (avgLen > 80) contextQualityScore = 0.90;
    else if (avgLen > 40) contextQualityScore = 0.65;
  }

  // 7. Penalties
  let penaltyScore = 0.0;

  if (isGeneric) {
    penaltyScore += config.penalties.genericStandalonePenalty;
  }

  if (occ.onlySentenceInitial && !isAcronym && wordCount === 1 && !occ.hasDefinitionEvidence && (candidate.type === 'concept' || candidate.type === 'Concept')) {
    penaltyScore += config.penalties.sentenceInitialOnlyPenalty;
  }

  // Never penalize single mention if explicitly defined or provided with evidence
  if (occ.frequency === 1 && occ.headings.length === 0 && !occ.hasDefinitionEvidence && !occ.hasRelationshipEvidence && !candidate.isCoreConcept) {
    if (isGeneric || (wordCount === 1 && (candidate.type === 'concept' || candidate.type === 'Concept') && contextQualityScore < 0.7)) {
      penaltyScore += config.penalties.singleMentionNoContextPenalty;
    }
  }

  if (candidate.name.length < 4 && !isAcronym) {
    penaltyScore += config.penalties.shortWordPenalty;
  }

  // Semantic AI Evaluation Adjustment
  let semanticBonus = 0.0;
  if (typeof candidate.importance === 'number') {
    semanticBonus += (candidate.importance - 0.5) * 0.20;
  }
  if (candidate.isCoreConcept) {
    semanticBonus += 0.10;
  }

  // Weighted Composite Relevance Score
  const w = config.weights;
  const baseScore = 
    w.frequency * frequencyScore +
    w.dispersion * dispersionScore +
    w.heading * headingScore +
    w.specificity * specificityScore +
    w.relationshipOrDefinition * relationshipScore +
    w.contextQuality * contextQualityScore;

  const relevanceScore = Math.max(0, Math.min(1.0, Number((baseScore + penaltyScore + semanticBonus).toFixed(4))));

  // Acceptance Decision
  let isAccepted = true;
  let rejectionReason: string | undefined;

  if (isGeneric) {
    // A generic term can ONLY be accepted if the document clearly establishes it as a defined concept
    if (!occ.hasDefinitionEvidence || relevanceScore < 0.75) {
      isAccepted = false;
      rejectionReason = genericReason || `Generic concept without substantive definition ("${candidate.name}")`;
    }
  }

  if (isAccepted && relevanceScore < config.minRelevanceScore && !candidate.isCoreConcept && !occ.hasDefinitionEvidence) {
    isAccepted = false;
    rejectionReason = `Relevance score (${relevanceScore.toFixed(2)}) below quality threshold (${config.minRelevanceScore})`;
  }

  if (isAccepted && occ.frequency === 1 && occ.headings.length === 0 && !occ.hasDefinitionEvidence && !occ.hasRelationshipEvidence && !candidate.isCoreConcept) {
    isAccepted = false;
    rejectionReason = 'Single mention without meaningful heading or definition context';
  }

  const isTechnicalOrTopic = !isGeneric && (isAcronym || wordCount >= 2 || headingScore > 0 || occ.hasDefinitionEvidence || Boolean(candidate.evidence));

  // Preserve source traceability: combine existing chunk IDs with newly found ones
  const combinedChunkIds = Array.from(new Set([
    candidate.sourceChunkId,
    ...(candidate.sourceChunkIds || []),
    ...occ.chunkIds
  ])).filter(Boolean);

  const resolvedEvidence = candidate.evidence || 
    (occ.hasDefinitionEvidence ? occ.contextSentences.find(s => /\b(?:is an?|are|refers to|is defined as|called|known as)\b/i.test(s)) : undefined) ||
    occ.contextSentences[0];

  return {
    ...candidate,
    sourceChunkIds: combinedChunkIds,
    frequency: occ.frequency,
    sectionHeadings: occ.headings,
    contextualSentences: occ.contextSentences,
    relevanceScore,
    isGeneric,
    isTechnicalOrTopic,
    hasDefinition: occ.hasDefinitionEvidence || Boolean(candidate.evidence),
    hasHeadingEvidence: occ.headings.length > 0,
    hasRelationshipEvidence: occ.hasRelationshipEvidence,
    scoreBreakdown: {
      frequencyScore,
      dispersionScore,
      headingScore,
      specificityScore,
      relationshipScore,
      contextQualityScore,
      penaltyScore
    },
    isAccepted,
    rejectionReason,
    evidence: resolvedEvidence,
    importance: candidate.importance ?? relevanceScore,
    isCoreConcept: candidate.isCoreConcept ?? (relevanceScore >= 0.8)
  };
}

/**
 * Master Relevance Evaluation Function:
 * Evaluates candidate concepts, filters low-quality noise, applies adaptive limits,
 * and generates a complete internal debug report.
 */
export function evaluateAndFilterCandidates(
  candidates: ConceptCandidate[],
  allChunks: TextChunk[],
  config: ConceptQualityConfig = DEFAULT_CONCEPT_QUALITY_CONFIG,
  documentProfile?: DocumentProfile
): {
  acceptedCandidates: ConceptCandidate[];
  scoredCandidates: ScoredCandidateConcept[];
  report: ConceptRelevanceReport;
} {
  if (!candidates || candidates.length === 0) {
    return {
      acceptedCandidates: [],
      scoredCandidates: [],
      report: {
        totalCandidates: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        accepted: [],
        rejected: [],
        thresholds: {
          minRelevanceScore: config.minRelevanceScore,
          maxPrimaryConcepts: config.adaptiveLimits.smallDocument.maxConcepts,
          documentChunkCount: allChunks.length
        }
      }
    };
  }

  // Calculate total words in document for adaptive sizing
  const totalWords = allChunks.reduce((acc, c) => acc + (c.text ? c.text.split(/\s+/).length : 0), 0);
  const maxPrimaryConcepts = getAdaptiveMaxConcepts(allChunks.length, totalWords, config);

  // Score all candidates with document-level semantic awareness
  const scoredCandidates: ScoredCandidateConcept[] = candidates.map(c => 
    scoreCandidate(c, allChunks, totalWords, config, documentProfile)
  );

  // Partition into accepted and rejected
  const initialAccepted = scoredCandidates.filter(c => c.isAccepted);
  const initialRejected = scoredCandidates.filter(c => !c.isAccepted);

  // Sort accepted by relevance score descending (secondary: frequency)
  initialAccepted.sort((a, b) => {
    if (Math.abs(b.relevanceScore - a.relevanceScore) > 0.01) {
      return b.relevanceScore - a.relevanceScore;
    }
    return b.frequency - a.frequency;
  });

  // Preserve all accepted concepts unless a strict hard cap override is explicitly requested
  // Knowledge extraction preserves concepts; viewport/presentation layer controls density
  const finalAccepted: ScoredCandidateConcept[] = [];
  const excessRejected: ScoredCandidateConcept[] = [];

  const shouldEnforceLimit = Boolean(config.maxConceptsOverride && config.maxConceptsOverride > 0);
  const effectiveLimit = shouldEnforceLimit ? config.maxConceptsOverride! : Infinity;

  for (let i = 0; i < initialAccepted.length; i++) {
    if (i < effectiveLimit) {
      finalAccepted.push(initialAccepted[i]);
    } else {
      excessRejected.push({
        ...initialAccepted[i],
        isAccepted: false,
        rejectionReason: `Prioritized out: exceeded configured concept limit (${effectiveLimit})`
      });
    }
  }

  const allRejected = [...initialRejected, ...excessRejected];

  // Build internal debug report
  const report: ConceptRelevanceReport = {
    totalCandidates: candidates.length,
    acceptedCount: finalAccepted.length,
    rejectedCount: allRejected.length,
    accepted: finalAccepted,
    rejected: allRejected.map(r => ({
      name: r.name,
      score: r.relevanceScore,
      reason: r.rejectionReason || 'Filtered by quality criteria',
      isGeneric: r.isGeneric,
      frequency: r.frequency
    })),
    thresholds: {
      minRelevanceScore: config.minRelevanceScore,
      maxPrimaryConcepts,
      documentChunkCount: allChunks.length
    }
  };

  // Convert accepted scored concepts back to ConceptCandidate with preserved traceability and semantic evidence
  const acceptedCandidates: ConceptCandidate[] = finalAccepted.map(sc => ({
    name: sc.name,
    type: sc.type,
    description: sc.description,
    sourceId: sc.sourceId,
    sourceChunkId: sc.sourceChunkId,
    sourceChunkIds: sc.sourceChunkIds,
    occurrences: sc.frequency,
    confidence: sc.confidence,
    relevanceScore: sc.relevanceScore,
    frequency: sc.frequency,
    sectionHeadings: sc.sectionHeadings,
    contextualSentences: sc.contextualSentences,
    isGeneric: sc.isGeneric,
    isTechnicalOrTopic: sc.isTechnicalOrTopic,
    importance: sc.importance ?? sc.relevanceScore,
    isCoreConcept: sc.isCoreConcept,
    evidence: sc.evidence,
    teachesOrExplains: sc.teachesOrExplains
  }));

  return {
    acceptedCandidates,
    scoredCandidates,
    report
  };
}
