/**
 * GraphMind Adaptive Revision Flow Service (Phase 3 — Prompt 11)
 * 
 * Generates transparent, source-grounded adaptive revision recommendations
 * based strictly on observable student activity and knowledge-check evidence.
 * 
 * Rules:
 * - Never infers mastery from reading time alone or opening a concept.
 * - Distinguishes clearly between 'not-studied', 'studied-unassessed', 'needs-review',
 *   'showing-understanding', and 'demonstrated-understanding'.
 * - Preserves student control: the original revision sequence remains stable and accessible.
 * - Isolated strictly by graph ID and concept ID.
 */

import type { KnowledgeGraph } from '../types/knowledgeGraph';
import type { ConceptPracticeState } from '../types/practice';
import type { ConceptKnowledgeCheckState, KnowledgeCheckAttempt } from '../types/knowledgeCheck';
import type {
  ConceptPerformanceState,
  AdaptiveRecommendation,
  AdaptiveAction,
  GenerateAdaptiveRecommendationParams
} from '../types/adaptiveRevision';

export const STORAGE_ADAPTIVE_REC_PREFIX = 'graphmind_adaptive_rec_v1_';

export function getAdaptiveRecStorageKey(graphId: string, conceptId: string): string {
  const safeGraph = (graphId || 'default_graph').trim();
  const safeConcept = (conceptId || 'default_concept').trim();
  return `${STORAGE_ADAPTIVE_REC_PREFIX}${safeGraph}_${safeConcept}`;
}

export interface DeriveConceptPerformanceParams {
  graphId: string;
  conceptId: string;
  conceptName: string;
  isReviewedInSession?: boolean;
  knowledgeCheckState?: ConceptKnowledgeCheckState | null;
  conceptPracticeState?: ConceptPracticeState | null;
}

/**
 * Derives the observable concept performance state strictly from recorded student actions.
 * Never infers understanding or mastery from reading time alone or merely opening a concept.
 */
export function deriveConceptPerformanceState({
  conceptId,
  conceptName,
  isReviewedInSession = false,
  knowledgeCheckState,
  conceptPracticeState
}: DeriveConceptPerformanceParams): ConceptPerformanceState {
  const attemptsMap = knowledgeCheckState?.attempts || {};
  const attemptList: KnowledgeCheckAttempt[] = Object.values(attemptsMap);

  // Case 1: No knowledge check attempts recorded
  if (attemptList.length === 0) {
    const isStudied = isReviewedInSession || conceptPracticeState?.status === 'learning';
    return {
      conceptId,
      conceptName,
      status: isStudied ? 'studied-unassessed' : 'not-studied',
      attemptCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      consecutiveIncorrectCount: 0
    };
  }

  // Sort attempts by attemptedAt chronological order
  const sortedAttempts = [...attemptList].sort((a, b) => {
    const timeA = new Date(a.attemptedAt || 0).getTime();
    const timeB = new Date(b.attemptedAt || 0).getTime();
    return timeA - timeB;
  });

  const attemptCount = sortedAttempts.length;
  let correctCount = 0;
  let incorrectCount = 0;

  for (const att of sortedAttempts) {
    if (att.evaluation?.isCorrect) {
      correctCount++;
    } else {
      incorrectCount++;
    }
  }

  // Calculate consecutive incorrect count backwards from latest attempt
  let consecutiveIncorrectCount = 0;
  for (let i = sortedAttempts.length - 1; i >= 0; i--) {
    if (!sortedAttempts[i].evaluation?.isCorrect) {
      consecutiveIncorrectCount++;
    } else {
      break;
    }
  }

  const latestAttempt = sortedAttempts[sortedAttempts.length - 1];
  const isCorrect = Boolean(latestAttempt.evaluation?.isCorrect);
  const isUncertain = latestAttempt.evaluation?.evaluationConfidence === 'uncertain';

  let status: ConceptPerformanceState['status'];
  if (!isCorrect) {
    status = 'needs-review';
  } else if (attemptCount >= 2 || correctCount >= 2) {
    status = 'demonstrated-understanding';
  } else {
    status = 'showing-understanding';
  }

  return {
    conceptId,
    conceptName,
    status,
    attemptCount,
    correctCount,
    incorrectCount,
    consecutiveIncorrectCount,
    lastAttemptCorrect: isCorrect,
    isUncertain,
    lastAttemptAt: latestAttempt.attemptedAt,
    misconceptionGuidance: latestAttempt.evaluation?.misconceptionGuidance,
    reviewSectionId: latestAttempt.evaluation?.reviewSectionId,
    reviewSectionTitle: latestAttempt.evaluation?.reviewSectionTitle
  };
}

/**
 * Identifies whether an authentic prerequisite/foundation relationship exists in the graph.
 */
export function findConnectedPrerequisite(
  graph: KnowledgeGraph | null | undefined,
  conceptId: string
): { id: string; name: string; relationType: string } | null {
  const edges: any[] = (graph as any)?.edges || graph?.relationships || [];
  if (!graph || !Array.isArray(edges) || !Array.isArray(graph.nodes)) {
    return null;
  }

  const prereqPattern = /(prerequisite|depends-on|requires|part-of|basis|foundation|precedes)/i;

  for (const edge of edges) {
    const target = edge.target || (edge as any).targetId;
    const source = edge.source || (edge as any).sourceId;
    const relType = edge.relationType || (edge as any).label || (edge as any).type || '';

    // If edge points to currentConceptId as target and relation indicates dependency
    if (target === conceptId && prereqPattern.test(relType)) {
      const sourceNode = graph.nodes.find((n) => n.id === source);
      if (sourceNode) {
        return {
          id: sourceNode.id,
          name: sourceNode.name,
          relationType: relType
        };
      }
    }
  }

  return null;
}

/**
 * Resolves directly connected concepts from graph edges or relationships.
 */
export function findConnectedConcepts(
  graph: KnowledgeGraph | null | undefined,
  conceptId: string
): Array<{ id: string; name: string; relationType: string }> {
  const edges: any[] = (graph as any)?.edges || graph?.relationships || [];
  if (!graph || !Array.isArray(edges) || !Array.isArray(graph.nodes)) {
    return [];
  }

  const results: Array<{ id: string; name: string; relationType: string }> = [];
  const seenIds = new Set<string>();

  for (const edge of edges) {
    const target = edge.target || (edge as any).targetId;
    const source = edge.source || (edge as any).sourceId;
    const relType = edge.relationType || (edge as any).label || (edge as any).type || 'related-to';

    if (source === conceptId && target !== conceptId && !seenIds.has(target)) {
      const node = graph.nodes.find((n) => n.id === target);
      if (node) {
        seenIds.add(target);
        results.push({ id: node.id, name: node.name, relationType: relType });
      }
    } else if (target === conceptId && source !== conceptId && !seenIds.has(source)) {
      const node = graph.nodes.find((n) => n.id === source);
      if (node) {
        seenIds.add(source);
        results.push({ id: node.id, name: node.name, relationType: relType });
      }
    }
  }

  return results;
}

/**
 * Generates transparent, plain-language adaptive recommendations.
 * Preserves the student's control by always maintaining planned sequence options.
 */
export function generateAdaptiveRecommendation({
  graphId,
  currentConceptId,
  currentConceptName,
  performance,
  explanation,
  graph,
  session,
  allGraphConcepts = []
}: GenerateAdaptiveRecommendationParams): AdaptiveRecommendation {
  const now = new Date().toISOString();

  // Determine next scheduled concept in session if available
  let nextIndex: number | undefined;
  let nextConceptId: string | undefined;
  let nextConceptName: string | undefined;

  if (session && Array.isArray(session.conceptIds)) {
    const currentIdx = session.currentIndex;
    if (currentIdx >= 0 && currentIdx < session.conceptIds.length - 1) {
      nextIndex = currentIdx + 1;
      nextConceptId = session.conceptIds[nextIndex];
      const match = allGraphConcepts.find((c) => c.id === nextConceptId) ||
        graph?.nodes.find((n) => n.id === nextConceptId);
      nextConceptName = match?.name || `Concept ${nextIndex + 1}`;
    }
  }

  const prereq = findConnectedPrerequisite(graph, currentConceptId);
  const connected = findConnectedConcepts(graph, currentConceptId);
  const hasWorkedExample = Boolean(explanation?.workedExample);

  // 1. Struggling with concept ('needs-review')
  if (performance.status === 'needs-review') {
    let rationale = performance.consecutiveIncorrectCount >= 2
      ? `Consider reviewing this concept again because your last ${performance.consecutiveIncorrectCount} answers were incorrect.`
      : `Consider reviewing this concept again because your last answer was incorrect.`;

    if (performance.misconceptionGuidance) {
      rationale += ` Note on misconception: ${performance.misconceptionGuidance}`;
    }

    // Determine primary action
    let primaryAction: AdaptiveAction;
    if (performance.reviewSectionId) {
      primaryAction = {
        id: 'act-review-misconception',
        label: `Review ${performance.reviewSectionTitle || 'explanation'} ↑`,
        type: 'review-explanation-section',
        isPrimary: true,
        targetSectionId: performance.reviewSectionId,
        description: 'Focus directly on the section explaining this principle'
      };
    } else if (hasWorkedExample) {
      primaryAction = {
        id: 'act-review-worked-example',
        label: 'Study worked example step-by-step ↑',
        type: 'review-worked-example',
        isPrimary: true,
        targetSectionId: 'section-step-by-step-learning',
        description: 'Inspect step-by-step application of this concept'
      };
    } else {
      primaryAction = {
        id: 'act-review-overview',
        label: 'Review concept explanation ↑',
        type: 'review-explanation-section',
        isPrimary: true,
        targetSectionId: 'section-overview',
        description: 'Re-read the core definition and mechanism'
      };
    }

    // Secondary actions: retry question, review prerequisite if any, and continue planned order
    const secondaryActions: AdaptiveAction[] = [];

    secondaryActions.push({
      id: 'act-retry-check',
      label: 'Try question again ↺',
      type: 'retry-knowledge-check',
      isPrimary: false,
      targetSectionId: 'section-knowledge-check',
      description: 'Re-attempt the formative check'
    });

    if (prereq) {
      secondaryActions.push({
        id: `act-prereq-${prereq.id}`,
        label: `Review foundation: ${prereq.name}`,
        type: 'explore-prerequisite-concept',
        isPrimary: false,
        targetConceptId: prereq.id,
        targetConceptName: prereq.name,
        description: `Connected prerequisite in knowledge graph (${prereq.relationType.replace(/-/g, ' ')})`
      });
    }

    if (nextConceptId && nextConceptName) {
      secondaryActions.push({
        id: 'act-continue-planned',
        label: `Continue in planned order (${nextConceptName}) →`,
        type: 'continue-planned-path',
        isPrimary: false,
        targetIndex: nextIndex,
        targetConceptId: nextConceptId,
        targetConceptName: nextConceptName,
        description: 'Skip review and continue with the original revision sequence'
      });
    }

    return {
      graphId,
      conceptId: currentConceptId,
      conceptName: currentConceptName,
      performanceState: performance,
      rationale,
      primaryAction,
      secondaryActions,
      fallbackToSequence: false,
      generatedAt: now
    };
  }

  // 2. Inconclusive or Uncertain Short Answer ('isUncertain')
  if (performance.isUncertain) {
    const rationale = `Your response touched on key ideas, but evaluation was uncertain. Reviewing the core mechanism will help clarify your understanding.`;

    const primaryAction: AdaptiveAction = {
      id: 'act-review-uncertain',
      label: `Review ${performance.reviewSectionTitle || 'mechanism'} ↑`,
      type: 'review-explanation-section',
      isPrimary: true,
      targetSectionId: performance.reviewSectionId || 'section-overview',
      description: 'Solidify your understanding of key terminology'
    };

    const secondaryActions: AdaptiveAction[] = [
      {
        id: 'act-retry-uncertain',
        label: 'Refine your answer ↺',
        type: 'retry-knowledge-check',
        isPrimary: false,
        targetSectionId: 'section-knowledge-check',
        description: 'Submit an updated explanation'
      }
    ];

    if (nextConceptId && nextConceptName) {
      secondaryActions.push({
        id: 'act-continue-planned',
        label: `Continue in planned order (${nextConceptName}) →`,
        type: 'continue-planned-path',
        isPrimary: false,
        targetIndex: nextIndex,
        targetConceptId: nextConceptId,
        targetConceptName: nextConceptName
      });
    }

    return {
      graphId,
      conceptId: currentConceptId,
      conceptName: currentConceptName,
      performanceState: performance,
      rationale,
      primaryAction,
      secondaryActions,
      fallbackToSequence: false,
      generatedAt: now
    };
  }

  // 3. Demonstrating Understanding ('showing-understanding' or 'demonstrated-understanding')
  if (
    performance.status === 'showing-understanding' ||
    performance.status === 'demonstrated-understanding'
  ) {
    const rationale = performance.status === 'demonstrated-understanding'
      ? `You have demonstrated consistent understanding across multiple checks for "${currentConceptName}".`
      : `You answered the knowledge check for "${currentConceptName}" correctly. You are ready to continue your planned revision sequence.`;

    let primaryAction: AdaptiveAction;
    if (nextConceptId && nextConceptName) {
      primaryAction = {
        id: 'act-continue-next',
        label: `Continue to next: ${nextConceptName} →`,
        type: 'continue-planned-path',
        isPrimary: true,
        targetIndex: nextIndex,
        targetConceptId: nextConceptId,
        targetConceptName: nextConceptName,
        description: 'Advance to the next concept in your revision path'
      };
    } else {
      primaryAction = {
        id: 'act-complete-session',
        label: 'Complete revision session ✓',
        type: 'continue-planned-path',
        isPrimary: true,
        description: 'All scheduled concepts in this session have been studied'
      };
    }

    const secondaryActions: AdaptiveAction[] = [];

    // Optional review of related concepts
    if (connected.length > 0) {
      const firstRel = connected[0];
      secondaryActions.push({
        id: `act-rel-${firstRel.id}`,
        label: `Explore related: ${firstRel.name}`,
        type: 'explore-related-concept',
        isPrimary: false,
        targetConceptId: firstRel.id,
        targetConceptName: firstRel.name,
        description: `Connected in knowledge graph (${firstRel.relationType.replace(/-/g, ' ')})`
      });
    }

    secondaryActions.push({
      id: 'act-reread',
      label: 'Re-read explanation',
      type: 'review-explanation-section',
      isPrimary: false,
      targetSectionId: 'section-overview'
    });

    return {
      graphId,
      conceptId: currentConceptId,
      conceptName: currentConceptName,
      performanceState: performance,
      rationale,
      primaryAction,
      secondaryActions,
      fallbackToSequence: false,
      generatedAt: now
    };
  }

  // 4. Studied but Unassessed ('studied-unassessed')
  if (performance.status === 'studied-unassessed') {
    const rationale = `You have studied the explanation for "${currentConceptName}". Complete the knowledge check to test your understanding and unlock targeted revision recommendations.`;

    const primaryAction: AdaptiveAction = {
      id: 'act-take-check',
      label: 'Test understanding with Knowledge Check ↓',
      type: 'retry-knowledge-check',
      isPrimary: true,
      targetSectionId: 'section-knowledge-check',
      description: 'Answer formative questions for this concept'
    };

    const secondaryActions: AdaptiveAction[] = [];
    if (nextConceptId && nextConceptName) {
      secondaryActions.push({
        id: 'act-continue-planned',
        label: `Continue in planned order (${nextConceptName}) →`,
        type: 'continue-planned-path',
        isPrimary: false,
        targetIndex: nextIndex,
        targetConceptId: nextConceptId,
        targetConceptName: nextConceptName
      });
    }

    return {
      graphId,
      conceptId: currentConceptId,
      conceptName: currentConceptName,
      performanceState: performance,
      rationale,
      primaryAction,
      secondaryActions,
      fallbackToSequence: true,
      generatedAt: now
    };
  }

  // 5. Fallback / Not Studied ('not-studied')
  const fallbackRationale = `Follow the planned revision sequence to explore this concept's explanation.`;
  const primaryAction: AdaptiveAction = {
    id: 'act-study-concept',
    label: 'Study concept explanation',
    type: 'review-explanation-section',
    isPrimary: true,
    targetSectionId: 'section-overview'
  };

  const secondaryActions: AdaptiveAction[] = [];
  if (nextConceptId && nextConceptName) {
    secondaryActions.push({
      id: 'act-continue-planned',
      label: `Skip to next: ${nextConceptName} →`,
      type: 'continue-planned-path',
      isPrimary: false,
      targetIndex: nextIndex,
      targetConceptId: nextConceptId,
      targetConceptName: nextConceptName
    });
  }

  return {
    graphId,
    conceptId: currentConceptId,
    conceptName: currentConceptName,
    performanceState: performance,
    rationale: fallbackRationale,
    primaryAction,
    secondaryActions,
    fallbackToSequence: true,
    generatedAt: now
  };
}

/**
 * Saves an adaptive recommendation to localStorage, isolated by graph and concept.
 */
export function saveAdaptiveRecommendation(rec: AdaptiveRecommendation): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const key = getAdaptiveRecStorageKey(rec.graphId, rec.conceptId);
    localStorage.setItem(key, JSON.stringify(rec));
  } catch (err) {
    console.warn('[AdaptiveRevision] Failed to persist adaptive recommendation:', err);
  }
}

/**
 * Loads an adaptive recommendation from localStorage, isolated by graph and concept.
 */
export function loadAdaptiveRecommendation(
  graphId: string,
  conceptId: string
): AdaptiveRecommendation | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const key = getAdaptiveRecStorageKey(graphId, conceptId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || !parsed.primaryAction) {
      return null;
    }
    return parsed as AdaptiveRecommendation;
  } catch (err) {
    console.warn('[AdaptiveRevision] Failed to load adaptive recommendation:', err);
    return null;
  }
}

/**
 * Clears adaptive recommendations for a specific graph.
 */
export function clearAdaptiveRecommendations(graphId: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const prefix = `${STORAGE_ADAPTIVE_REC_PREFIX}${graphId}_`;
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key);
      }
    }
    for (const key of keysToRemove) {
      localStorage.removeItem(key);
    }
  } catch (err) {
    console.warn('[AdaptiveRevision] Failed to clear adaptive recommendations:', err);
  }
}
