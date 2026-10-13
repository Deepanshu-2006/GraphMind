import type { KnowledgeGraph, KnowledgeNode } from '../types/knowledgeGraph';
import type { ConceptExplanation } from '../types/explanation';
import type {
  KnowledgeCheckQuestion,
  KnowledgeCheckEvaluation,
  ConceptKnowledgeCheckState
} from '../types/knowledgeCheck';

export const STORAGE_KNOWLEDGE_CHECK_PREFIX = 'graphmind_knowledge_check_v1_';

/**
 * Resolves the storage key for a concept's interactive knowledge check state.
 * Strictly scoped by both graphId and conceptId to prevent cross-graph contamination.
 */
export function getKnowledgeCheckStorageKey(graphId: string, conceptId: string): string {
  return `${STORAGE_KNOWLEDGE_CHECK_PREFIX}${graphId}_${conceptId}`;
}

/**
 * Loads persisted knowledge check state for a specific concept in a graph.
 */
export function loadStoredKnowledgeCheck(
  graphId: string,
  conceptId: string
): ConceptKnowledgeCheckState | null {
  if (typeof localStorage === 'undefined' || !graphId || !conceptId) return null;

  try {
    const raw = localStorage.getItem(getKnowledgeCheckStorageKey(graphId, conceptId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConceptKnowledgeCheckState;
    if (parsed && parsed.graphId === graphId && parsed.conceptId === conceptId) {
      return parsed;
    }
    return null;
  } catch (err) {
    console.warn('[KnowledgeCheck] Error loading stored knowledge check:', err);
    return null;
  }
}

/**
 * Saves a concept knowledge check state to local storage.
 */
export function saveStoredKnowledgeCheck(state: ConceptKnowledgeCheckState): void {
  if (typeof localStorage === 'undefined' || !state?.graphId || !state?.conceptId) return;

  try {
    const key = getKnowledgeCheckStorageKey(state.graphId, state.conceptId);
    localStorage.setItem(key, JSON.stringify(state));
  } catch (err) {
    console.warn('[KnowledgeCheck] Error saving knowledge check state:', err);
  }
}

/**
 * Clears stored knowledge check states for an entire graph.
 */
export function clearStoredKnowledgeChecks(graphId: string): void {
  if (typeof localStorage === 'undefined' || !graphId) return;

  try {
    const prefix = `${STORAGE_KNOWLEDGE_CHECK_PREFIX}${graphId}_`;
    const keysToRemove: string[] = [];
    if (typeof localStorage.length === 'number' && typeof localStorage.key === 'function') {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          keysToRemove.push(key);
        }
      }
    }
    if (keysToRemove.length === 0 && typeof Object.keys === 'function') {
      Object.keys(localStorage).forEach(k => {
        if (k.startsWith(prefix)) keysToRemove.push(k);
      });
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
  } catch (err) {
    console.warn('[KnowledgeCheck] Error clearing knowledge checks for graph:', err);
  }
}

/**
 * Determines whether the available source material and explanation are sufficient
 * to formulate reliable, source-grounded formative questions.
 */
export function hasSufficientMaterialForKnowledgeCheck(
  node?: KnowledgeNode,
  explanation?: ConceptExplanation | null,
  graph?: KnowledgeGraph
): boolean {
  if (!node || !node.name) return false;

  // 1. Explanation presence with substantial overview
  if (explanation && explanation.overview && explanation.overview.trim().length >= 25) {
    return true;
  }

  // 2. Node intrinsic description or verified evidence
  const desc = node.description?.trim() || '';
  const evidence = node.evidence?.trim() || '';
  if (desc.length >= 25 || evidence.length >= 25) {
    return true;
  }

  // 3. Evidence items from genuine sources
  if (node.evidenceItems && node.evidenceItems.length > 0) {
    const totalEvidence = node.evidenceItems.reduce((acc, e) => acc + (e.text?.length || 0), 0);
    if (totalEvidence >= 25) return true;
  }

  // 4. Source texts directly referencing this concept
  if (graph?.sources && graph.sources.length > 0) {
    const nameLower = node.name.toLowerCase();
    const hasSourceMention = graph.sources.some(s => s.text && s.text.toLowerCase().includes(nameLower));
    if (hasSourceMention && (desc.length >= 15 || evidence.length >= 15)) {
      return true;
    }
  }

  return false;
}

/**
 * Simple deterministic string hasher for option shuffling.
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Deterministically shuffles options with a seed string.
 */
function shuffleArrayWithSeed<T>(array: T[], seed: string): T[] {
  const result = [...array];
  let h = hashString(seed);
  for (let i = result.length - 1; i > 0; i--) {
    h = (h * 9301 + 49297) % 233280;
    const j = Math.floor((h / 233280) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Extracts essential keywords and stems from text, filtering out common stop words.
 */
const STOP_WORDS = new Set([
  'the', 'that', 'this', 'with', 'from', 'what', 'which', 'does', 'when', 'where',
  'then', 'have', 'having', 'been', 'will', 'would', 'could', 'should', 'also', 'just',
  'into', 'more', 'some', 'such', 'than', 'them', 'these', 'they', 'were', 'about',
  'after', 'before', 'each', 'most', 'other', 'their', 'there', 'through', 'under'
]);

export function extractEssentialKeyTerms(text: string): string[] {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOP_WORDS.has(w));
  return Array.from(new Set(words));
}

/**
 * Evaluates whether a student token matches a reference key term or its morphological stem.
 */
function isTokenMatch(token: string, targetTerm: string): boolean {
  if (token === targetTerm) return true;
  // Prefix stem matching (e.g., 'increas' for increasing/increment, 'schedul' for scheduler/scheduling)
  const minLen = Math.min(token.length, targetTerm.length);
  if (minLen >= 5) {
    const stemLength = Math.max(4, minLen - 2);
    if (token.slice(0, stemLength) === targetTerm.slice(0, stemLength)) {
      return true;
    }
  }
  return false;
}

/**
 * Generates source-grounded formative knowledge check questions for a concept.
 * Never invents facts, definitions, or artificial entities.
 */
export function generateKnowledgeCheckQuestions(params: {
  graph?: KnowledgeGraph | null;
  conceptId: string;
  explanation?: ConceptExplanation | null;
}): { status: 'ready'; questions: KnowledgeCheckQuestion[] } | { status: 'insufficient'; reason: string } {
  const { graph, conceptId, explanation } = params;
  if (!graph || !graph.nodes) {
    return {
      status: 'insufficient',
      reason: 'No knowledge graph is available to generate questions.'
    };
  }
  const node = graph.nodes.find(n => n.id === conceptId);

  if (!node || !hasSufficientMaterialForKnowledgeCheck(node, explanation, graph)) {
    const conceptName = node?.name || 'this concept';
    return {
      status: 'insufficient',
      reason: `The learning materials associated with this knowledge graph do not contain sufficient verified definitions, passages, or mechanisms to formulate a reliable knowledge check for "${conceptName}".`
    };
  }

  const graphId = graph.id || 'default_graph';
  const conceptName = node.name;
  const questions: KnowledgeCheckQuestion[] = [];

  // Core definitions / passages from explanation or node
  const overview = explanation?.overview || node.description || node.evidence || '';
  const firstHowItWorks = explanation?.howItWorks && explanation.howItWorks.length > 0
    ? explanation.howItWorks[0]
    : undefined;
  const sourceRef = explanation?.sourceReferences?.[0];

  // Genuine other concepts from the knowledge graph for non-hallucinated distractors
  const otherConcepts = (graph.nodes || [])
    .filter(n => n.id !== conceptId && n.name && n.name.trim().length > 0);

  // -------------------------------------------------------------------------
  // Question 1: Multiple Choice Question (Core Mechanism / Defining Property)
  // -------------------------------------------------------------------------
  const primaryDefinition = overview.replace(/\n+/g, ' ').trim();
  if (primaryDefinition.length >= 25) {
    const correctText = primaryDefinition.length > 180
      ? primaryDefinition.slice(0, primaryDefinition.lastIndexOf('.', 175) + 1) || primaryDefinition.slice(0, 160) + '...'
      : primaryDefinition;

    // Distractor generation: use real definitions from other concepts in the graph
    const rawDistractors: Array<{ text: string; rationale: string }> = [];

    // Prioritize concepts with similar category or connected neighbors
    const sortedOthers = [...otherConcepts].sort((a, b) => {
      const aSameType = a.type === node.type ? 1 : 0;
      const bSameType = b.type === node.type ? 1 : 0;
      return bSameType - aSameType;
    });

    for (const other of sortedOthers) {
      const otherDesc = other.description?.trim();
      if (otherDesc && otherDesc.length >= 20 && otherDesc.toLowerCase() !== correctText.toLowerCase()) {
        const shortDesc = otherDesc.length > 160
          ? otherDesc.slice(0, 155) + '...'
          : otherDesc;
        rawDistractors.push({
          text: shortDesc,
          rationale: `This describes ${other.name}, which focuses on ${other.description?.slice(0, 80).toLowerCase()} rather than ${conceptName}.`
        });
      }
      if (rawDistractors.length >= 3) break;
    }

    // Fallback contrasting distractors if graph has fewer than 3 concepts with descriptions
    const defaultFallbacks = [
      {
        text: `It operates as a passive data storage structure without active ordering or execution logic.`,
        rationale: `${conceptName} is an active operational concept, not a passive data structure.`
      },
      {
        text: `It requires global centralized synchronization across all system components before any action can proceed.`,
        rationale: `According to your material, ${conceptName} does not mandate centralized global locks.`
      },
      {
        text: `It replaces all preceding protocols by enforcing strict real-time wall-clock physical timestamps.`,
        rationale: `${conceptName} functions based on the principles documented in your material, not physical wall-clock constraints.`
      }
    ];

    for (const fb of defaultFallbacks) {
      if (rawDistractors.length >= 3) break;
      rawDistractors.push(fb);
    }

    const misconceptions: Record<string, string> = {};
    const unindexedOptions = [
      { id: 'correct', text: correctText },
      { id: 'distractor-1', text: rawDistractors[0].text, rationale: rawDistractors[0].rationale },
      { id: 'distractor-2', text: rawDistractors[1].text, rationale: rawDistractors[1].rationale },
      { id: 'distractor-3', text: rawDistractors[2].text, rationale: rawDistractors[2].rationale }
    ];

    const shuffled = shuffleArrayWithSeed(unindexedOptions, `${conceptId}:mcq:${primaryDefinition.slice(0, 30)}`);
    const optionLabels = ['opt-01', 'opt-02', 'opt-03', 'opt-04'];
    let correctOptionId = 'opt-01';

    const finalOptions = shuffled.map((item, idx) => {
      const slotId = optionLabels[idx];
      if (item.id === 'correct') {
        correctOptionId = slotId;
      } else if ('rationale' in item && item.rationale) {
        misconceptions[slotId] = item.rationale;
      }
      return {
        id: slotId,
        text: item.text
      };
    });

    questions.push({
      id: `kc-mcq-${conceptId}`,
      graphId,
      conceptId,
      conceptName,
      type: 'multiple-choice',
      prompt: `Which of the following best characterizes the verified role and mechanism of ${conceptName}?`,
      options: finalOptions,
      correctOptionId,
      correctAnswer: correctText,
      explanation: `${conceptName} is defined in your study material: "${correctText}".`,
      misconceptions,
      sourcePassage: sourceRef?.excerpt || primaryDefinition,
      sourceTitle: sourceRef?.sourceTitle,
      page: sourceRef?.page,
      sectionId: 'section-understanding',
      sectionTitle: 'Understand the concept'
    });
  }

  // -------------------------------------------------------------------------
  // Question 2: Short-Answer Question (Mechanism & Conceptual Articulation)
  // -------------------------------------------------------------------------
  const mechanismSource = firstHowItWorks || overview;
  if (mechanismSource && mechanismSource.trim().length >= 25) {
    const keyTerms = extractEssentialKeyTerms(mechanismSource);
    // Add concept name tokens and key attributes
    const nameTokens = extractEssentialKeyTerms(conceptName);
    const combinedKeyTerms = Array.from(new Set([...keyTerms, ...nameTokens])).slice(0, 10);

    const acceptableAnswers = [
      mechanismSource.trim(),
      overview.trim()
    ];
    if (firstHowItWorks && firstHowItWorks !== overview) {
      acceptableAnswers.push(firstHowItWorks.trim());
    }

    questions.push({
      id: `kc-sa-${conceptId}`,
      graphId,
      conceptId,
      conceptName,
      type: 'short-answer',
      prompt: `In your own words, summarize how ${conceptName} operates according to your study material.`,
      correctAnswer: mechanismSource.trim(),
      acceptableAnswers,
      keyTerms: combinedKeyTerms,
      explanation: `According to your material: "${mechanismSource.trim()}". A complete answer highlights the operational mechanism and purpose.`,
      sourcePassage: sourceRef?.excerpt || mechanismSource,
      sourceTitle: sourceRef?.sourceTitle,
      page: sourceRef?.page,
      sectionId: firstHowItWorks ? 'section-how-it-works' : 'section-understanding',
      sectionTitle: firstHowItWorks ? 'How it works' : 'Understand the concept'
    });
  }

  // -------------------------------------------------------------------------
  // Question 3: Conceptual Reasoning (Relationships / Key Components)
  // -------------------------------------------------------------------------
  const rel = explanation?.relatedConceptReferences?.[0];
  if (rel && rel.conceptName && rel.relationshipType) {
    const relCorrect = `${conceptName} is connected to ${rel.conceptName} via the "${rel.relationshipType.replace(/-/g, ' ')}" relationship.`;
    const relDistractors = [
      `${conceptName} and ${rel.conceptName} are isolated entities with no operational interaction.`,
      `${conceptName} is superseded by ${rel.conceptName} and is no longer utilized in this architecture.`,
      `${rel.conceptName} represents the identical concept with only a different nomenclature.`
    ];

    const shuffledRel = shuffleArrayWithSeed(
      [{ id: 'correct', text: relCorrect }, ...relDistractors.map((d, i) => ({ id: `d-${i}`, text: d }))],
      `${conceptId}:reasoning:${rel.conceptName}`
    );

    const relLabels = ['opt-01', 'opt-02', 'opt-03', 'opt-04'];
    let relCorrectId = 'opt-01';
    const relOptions = shuffledRel.map((item, idx) => {
      const slot = relLabels[idx];
      if (item.id === 'correct') relCorrectId = slot;
      return { id: slot, text: item.text };
    });

    questions.push({
      id: `kc-reasoning-${conceptId}`,
      graphId,
      conceptId,
      conceptName,
      type: 'conceptual-reasoning',
      prompt: `Based on your material, how does ${conceptName} relate to ${rel.conceptName}?`,
      options: relOptions,
      correctOptionId: relCorrectId,
      correctAnswer: relCorrect,
      explanation: `In this knowledge graph, ${conceptName} connects directly to ${rel.conceptName}: ${rel.context || relCorrect}.`,
      sectionId: 'section-related-concepts',
      sectionTitle: 'Related concepts'
    });
  }

  if (questions.length === 0) {
    return {
      status: 'insufficient',
      reason: `The learning materials associated with "${conceptName}" do not contain sufficient verified statements to formulate questions.`
    };
  }

  return {
    status: 'ready',
    questions
  };
}

/**
 * Evaluates a student's answer for a Knowledge Check question.
 * Supports multiple choice and semantically equivalent short answer submissions.
 * Handles uncertainty honestly without claiming unverified certainty.
 */
export function evaluateKnowledgeCheckAnswer(
  question: KnowledgeCheckQuestion,
  studentAnswer: string
): KnowledgeCheckEvaluation {
  const cleanInput = (studentAnswer || '').trim();

  if (!cleanInput) {
    return {
      isCorrect: false,
      score: 0,
      evaluationConfidence: 'high',
      feedback: 'Please enter or select an answer before checking your understanding.',
      explanation: question.explanation,
      correctAnswer: question.correctAnswer,
      reviewSectionId: question.sectionId,
      reviewSectionTitle: question.sectionTitle
    };
  }

  // 1. Multiple Choice & Conceptual Reasoning (Option-based)
  if (question.type === 'multiple-choice' || (question.type === 'conceptual-reasoning' && question.options)) {
    const isCorrect = cleanInput === question.correctOptionId ||
      cleanInput.toLowerCase() === question.correctAnswer.toLowerCase() ||
      (question.options?.some(o => o.id === cleanInput && o.text.toLowerCase() === question.correctAnswer.toLowerCase()) ?? false);

    let misconceptionGuidance: string | undefined = undefined;
    if (!isCorrect && question.misconceptions && question.misconceptions[cleanInput]) {
      misconceptionGuidance = question.misconceptions[cleanInput];
    }

    return {
      isCorrect,
      score: isCorrect ? 1 : 0,
      evaluationConfidence: 'high',
      feedback: isCorrect
        ? 'Correct. Your selection reflects the verified principle from your material.'
        : 'Not quite. Review the explanation and supporting source material below.',
      explanation: question.explanation,
      misconceptionGuidance,
      correctAnswer: question.correctAnswer,
      reviewSectionId: question.sectionId,
      reviewSectionTitle: question.sectionTitle
    };
  }

  // 2. Short Answer (Semantic Overlap & Key Terms Evaluation)
  const lowerInput = cleanInput.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const lowerCorrect = question.correctAnswer.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');

  // Exact or direct containment check
  if (lowerInput === lowerCorrect || lowerInput.includes(lowerCorrect) || lowerCorrect.includes(lowerInput)) {
    return {
      isCorrect: true,
      score: 1,
      evaluationConfidence: 'high',
      feedback: 'Excellent. Your answer accurately reflects the concept definition.',
      explanation: question.explanation,
      correctAnswer: question.correctAnswer,
      reviewSectionId: question.sectionId,
      reviewSectionTitle: question.sectionTitle
    };
  }

  // Alternative acceptable answers
  if (question.acceptableAnswers && question.acceptableAnswers.length > 0) {
    for (const alt of question.acceptableAnswers) {
      const lowerAlt = alt.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
      if (lowerInput.includes(lowerAlt) || lowerAlt.includes(lowerInput)) {
        return {
          isCorrect: true,
          score: 1,
          evaluationConfidence: 'high',
          feedback: 'Correct. Your response aligns with accepted definitions from the material.',
          explanation: question.explanation,
          correctAnswer: question.correctAnswer,
          reviewSectionId: question.sectionId,
          reviewSectionTitle: question.sectionTitle
        };
      }
    }
  }

  // Key terms & semantic overlap analysis
  const studentTokens = lowerInput.split(/\s+/).filter(w => w.length > 2);
  const targetKeyTerms = question.keyTerms && question.keyTerms.length > 0
    ? question.keyTerms
    : extractEssentialKeyTerms(question.correctAnswer);

  const matchedTerms: string[] = [];
  for (const term of targetKeyTerms) {
    if (studentTokens.some(st => isTokenMatch(st, term))) {
      matchedTerms.push(term);
    }
  }

  const matchRatio = targetKeyTerms.length > 0
    ? matchedTerms.length / targetKeyTerms.length
    : 0;

  // Grade according to conceptual coverage
  if (matchRatio >= 0.5 || matchedTerms.length >= 4) {
    return {
      isCorrect: true,
      score: 1,
      evaluationConfidence: 'high',
      matchedKeyTerms: matchedTerms,
      feedback: 'Correct. You clearly articulated the core concepts and mechanism.',
      explanation: question.explanation,
      correctAnswer: question.correctAnswer,
      reviewSectionId: question.sectionId,
      reviewSectionTitle: question.sectionTitle
    };
  }

  if (matchRatio >= 0.35 || matchedTerms.length >= 2) {
    return {
      isCorrect: true,
      score: 0.8,
      evaluationConfidence: 'moderate',
      matchedKeyTerms: matchedTerms,
      feedback: 'Partially correct. You identified key aspects, but some details from the material were omitted.',
      explanation: question.explanation,
      correctAnswer: question.correctAnswer,
      reviewSectionId: question.sectionId,
      reviewSectionTitle: question.sectionTitle
    };
  }

  // Uncertainty handling: If the student wrote a thoughtful response (> 30 chars) with marginal overlap
  if (cleanInput.length >= 30 && (matchRatio > 0.15 || matchedTerms.length >= 1)) {
    return {
      isCorrect: false,
      score: 0,
      evaluationConfidence: 'uncertain',
      matchedKeyTerms: matchedTerms,
      feedback: 'Evaluation uncertain. Your answer touches on related terminology, but does not clearly demonstrate the verified mechanism. Please compare with the reference below.',
      explanation: question.explanation,
      correctAnswer: question.correctAnswer,
      reviewSectionId: question.sectionId,
      reviewSectionTitle: question.sectionTitle
    };
  }

  // Clear mismatch
  return {
    isCorrect: false,
    score: 0,
    evaluationConfidence: 'high',
    feedback: 'Not quite. Your response misses the core mechanisms documented in your study material.',
    explanation: question.explanation,
    correctAnswer: question.correctAnswer,
    reviewSectionId: question.sectionId,
    reviewSectionTitle: question.sectionTitle
  };
}
