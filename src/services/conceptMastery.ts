/**
 * GraphMind Concept Mastery Tracking Service (Phase 3 — Prompt 12)
 * 
 * Computes deterministic, evidence-grounded concept mastery statuses:
 * - 'not-started': No recorded revision activity.
 * - 'in-progress': Revision activity exists (reading or uncertain attempt), but evidence is insufficient.
 * - 'needs-review': Recorded responses indicate difficulty, consecutive errors, or marked for review.
 * - 'understanding-demonstrated': Student met evidence threshold on formative checks.
 * 
 * Rules:
 * - Never marks a concept as mastered after simply opening its page.
 * - Never treats one correct answer as proof of permanent, eternal mastery.
 * - Inconclusive or uncertain AI evaluations fall back conservatively to 'in-progress'.
 * - Preserves backward compatibility with existing PracticeStatus models.
 */

import type { ConceptPracticeState, RevisionSessionState } from '../types/practice';
import type { ConceptKnowledgeCheckState, KnowledgeCheckAttempt } from '../types/knowledgeCheck';
import type {
  ConceptMasteryStatus,
  ConceptMasterySummary,
  GraphMasteryOverview
} from '../types/mastery';
import {
  masteryStatusToPracticeStatus
} from '../types/mastery';
import {
  loadConceptPracticeStates,
  updateConceptPracticeState
} from './storage';
import { loadStoredKnowledgeCheck } from './knowledgeCheck';

export const STORAGE_MASTERY_PREFIX = 'graphmind_mastery_v1_';

export function getMasteryStorageKey(graphId: string, conceptId: string): string {
  const safeGraph = (graphId || 'default_graph').trim();
  const safeConcept = (conceptId || 'default_concept').trim();
  return `${STORAGE_MASTERY_PREFIX}${safeGraph}_${safeConcept}`;
}

export function formatMasteryLabel(status: ConceptMasteryStatus): string {
  switch (status) {
    case 'not-started':
      return 'Not started';
    case 'in-progress':
      return 'In progress';
    case 'needs-review':
      return 'Needs review';
    case 'understanding-demonstrated':
      return 'Understanding demonstrated';
    default:
      return 'Not started';
  }
}

export interface CalculateConceptMasteryParams {
  graphId: string;
  conceptId: string;
  conceptName: string;
  isVisitedInSession?: boolean;
  knowledgeCheckState?: ConceptKnowledgeCheckState | null;
  practiceState?: ConceptPracticeState | null;
  isMarkedForReview?: boolean;
}

/**
 * Calculates a concept's mastery summary deterministically from recorded learning evidence.
 */
export function calculateConceptMastery({
  conceptId,
  conceptName,
  isVisitedInSession = false,
  knowledgeCheckState,
  practiceState,
  isMarkedForReview = false
}: CalculateConceptMasteryParams): ConceptMasterySummary {
  const attemptsMap = knowledgeCheckState?.attempts || {};
  const rawAttempts: KnowledgeCheckAttempt[] = Object.values(attemptsMap);

  // Deduplicate attempts by questionId or clean timestamps
  const validAttempts = rawAttempts.filter(
    (att) => att && typeof att === 'object' && att.questionId && att.evaluation
  );

  // Case 1: No knowledge check attempts recorded
  if (validAttempts.length === 0) {
    if (isMarkedForReview) {
      return {
        conceptId,
        conceptName,
        status: 'needs-review',
        statusLabel: formatMasteryLabel('needs-review'),
        attemptCount: 0,
        correctCount: 0,
        incorrectCount: 0,
        consecutiveIncorrectCount: 0,
        evidenceSource: 'session-study'
      };
    }

    if (practiceState?.status === 'needs-review') {
      return {
        conceptId,
        conceptName,
        status: 'needs-review',
        statusLabel: formatMasteryLabel('needs-review'),
        attemptCount: 0,
        correctCount: 0,
        incorrectCount: 0,
        consecutiveIncorrectCount: 0,
        studiedAt: practiceState.lastStudiedAt,
        evidenceSource: 'legacy-practice'
      };
    }

    if (practiceState?.status === 'understood') {
      return {
        conceptId,
        conceptName,
        status: 'understanding-demonstrated',
        statusLabel: formatMasteryLabel('understanding-demonstrated'),
        attemptCount: practiceState.practiceCount || 1,
        correctCount: practiceState.practiceCount || 1,
        incorrectCount: 0,
        consecutiveIncorrectCount: 0,
        studiedAt: practiceState.lastStudiedAt,
        evidenceSource: 'legacy-practice'
      };
    }

    if (isVisitedInSession || practiceState?.status === 'learning') {
      return {
        conceptId,
        conceptName,
        status: 'in-progress',
        statusLabel: formatMasteryLabel('in-progress'),
        attemptCount: 0,
        correctCount: 0,
        incorrectCount: 0,
        consecutiveIncorrectCount: 0,
        studiedAt: practiceState?.lastStudiedAt,
        evidenceSource: 'session-study',
        explanationSummary: 'Concept was visited and studied during revision; assessment pending.'
      };
    }

    return {
      conceptId,
      conceptName,
      status: 'not-started',
      statusLabel: formatMasteryLabel('not-started'),
      attemptCount: 0,
      correctCount: 0,
      incorrectCount: 0,
      consecutiveIncorrectCount: 0,
      evidenceSource: 'none'
    };
  }

  // Case 2: Knowledge check attempts exist
  // Sort chronologically ascending
  const sortedAttempts = [...validAttempts].sort((a, b) => {
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

  // Calculate consecutive incorrect attempts leading backwards from the latest attempt
  let consecutiveIncorrectCount = 0;
  for (let i = sortedAttempts.length - 1; i >= 0; i--) {
    if (!sortedAttempts[i].evaluation?.isCorrect) {
      consecutiveIncorrectCount++;
    } else {
      break;
    }
  }

  const latest = sortedAttempts[sortedAttempts.length - 1];
  const isCorrect = Boolean(latest.evaluation?.isCorrect);
  const isUncertain = latest.evaluation?.evaluationConfidence === 'uncertain';

  let status: ConceptMasteryStatus;
  let explanationSummary = latest.evaluation?.feedback || '';

  if (!isCorrect) {
    status = 'needs-review';
  } else if (isUncertain) {
    // If the latest answer was marked correct but with uncertain confidence,
    // conservatively classify as 'in-progress' rather than claiming proven mastery.
    status = 'in-progress';
    explanationSummary = 'Answer touched on relevant concepts, but confidence is uncertain.';
  } else {
    // Verified correct response
    status = 'understanding-demonstrated';
  }

  return {
    conceptId,
    conceptName,
    status,
    statusLabel: formatMasteryLabel(status),
    attemptCount,
    correctCount,
    incorrectCount,
    consecutiveIncorrectCount,
    lastAttemptAt: latest.attemptedAt,
    lastAttemptCorrect: isCorrect,
    isUncertain,
    evidenceSource: 'knowledge-check',
    explanationSummary
  };
}

/**
 * Loads the complete concept mastery overview for an entire knowledge graph.
 */
export function loadGraphMasteryOverview(
  graphId: string,
  conceptNodes: Array<{ id: string; name: string }>,
  session?: RevisionSessionState | null
): GraphMasteryOverview {
  const safeGraphId = graphId || 'default_graph';
  const practiceStates = loadConceptPracticeStates(safeGraphId);

  const conceptsSummary: Record<string, ConceptMasterySummary> = {};
  let notStartedCount = 0;
  let inProgressCount = 0;
  let needsReviewCount = 0;
  let understandingDemonstratedCount = 0;
  const needsReviewConceptIds: string[] = [];

  for (const node of conceptNodes) {
    if (!node || !node.id) continue;
    const kcState = loadStoredKnowledgeCheck(safeGraphId, node.id);
    const practiceState = practiceStates[node.id];
    const isVisited = Boolean(
      session?.reviewedConceptIds?.includes(node.id) ||
      session?.currentConceptId === node.id ||
      (session?.conceptIds && session.conceptIds[session.currentIndex ?? -1] === node.id)
    );
    const isMarked = Boolean(session?.markedForReviewIds?.includes(node.id));

    const summary = calculateConceptMastery({
      graphId: safeGraphId,
      conceptId: node.id,
      conceptName: node.name || 'Untitled Concept',
      isVisitedInSession: isVisited,
      knowledgeCheckState: kcState,
      practiceState,
      isMarkedForReview: isMarked
    });

    conceptsSummary[node.id] = summary;

    switch (summary.status) {
      case 'not-started':
        notStartedCount++;
        break;
      case 'in-progress':
        inProgressCount++;
        break;
      case 'needs-review':
        needsReviewCount++;
        needsReviewConceptIds.push(node.id);
        break;
      case 'understanding-demonstrated':
        understandingDemonstratedCount++;
        break;
    }
  }

  return {
    graphId: safeGraphId,
    totalConcepts: conceptNodes.length,
    notStartedCount,
    inProgressCount,
    needsReviewCount,
    understandingDemonstratedCount,
    concepts: conceptsSummary,
    needsReviewConceptIds
  };
}

/**
 * Synchronizes mastery status to the underlying concept practice state.
 */
export function syncConceptMasteryToStorage(
  graphId: string,
  summary: ConceptMasterySummary
): void {
  const practiceStatus = masteryStatusToPracticeStatus(summary.status);
  updateConceptPracticeState(summary.conceptId, practiceStatus, graphId);
}

/**
 * Persists an explicit concept mastery summary record to localStorage.
 */
export function saveStoredMastery(graphId: string, summary: ConceptMasterySummary): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const key = getMasteryStorageKey(graphId, summary.conceptId);
    localStorage.setItem(key, JSON.stringify(summary));
    syncConceptMasteryToStorage(graphId, summary);
  } catch (err) {
    console.warn('[Mastery] Failed to persist concept mastery summary:', err);
  }
}

/**
 * Loads an explicit concept mastery summary from localStorage.
 */
export function loadStoredMastery(
  graphId: string,
  conceptId: string
): ConceptMasterySummary | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const key = getMasteryStorageKey(graphId, conceptId);
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || !parsed.status) {
      return null;
    }
    return parsed as ConceptMasterySummary;
  } catch (err) {
    console.warn('[Mastery] Failed to load concept mastery summary:', err);
    return null;
  }
}

/**
 * Clears all mastery records for a specific knowledge graph.
 */
export function clearGraphMastery(graphId: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const prefix = `${STORAGE_MASTERY_PREFIX}${graphId}_`;
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
    console.warn('[Mastery] Failed to clear graph mastery:', err);
  }
}
