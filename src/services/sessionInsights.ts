/**
 * GraphMind Revision Session Insights Service (Phase 3 — Prompt 13)
 * 
 * Derives factual, evidence-grounded session summaries without fabricating
 * metrics, mastery scores, or artificial study duration.
 */

import type { KnowledgeGraph } from '../types/knowledgeGraph';
import type { RevisionSessionState } from '../types/practice';
import type {
  ConceptInsightItem,
  RevisionSessionInsights,
  SessionNextAction
} from '../types/sessionInsights';
import { calculateConceptMastery } from './conceptMastery';
import { loadConceptPracticeStates } from './storage';
import { loadStoredKnowledgeCheck } from './knowledgeCheck';

export interface DeriveSessionInsightsParams {
  graph?: KnowledgeGraph | null;
  graphName?: string;
  session: RevisionSessionState | null;
  concepts?: Array<{ id: string; name: string }>;
}

/**
 * Derives comprehensive session insights grounded strictly in actual recorded activity.
 */
export function deriveRevisionSessionInsights({
  graph,
  graphName,
  session,
  concepts: providedConcepts
}: DeriveSessionInsightsParams): RevisionSessionInsights {
  const safeGraphId = session?.graphId || graph?.id || 'default_graph';
  const resolvedGraphName = graphName || graph?.name || 'Knowledge Graph';

  // 1. Resolve ordered concepts
  let conceptList: Array<{ id: string; name: string }> = [];
  if (providedConcepts && providedConcepts.length > 0) {
    conceptList = providedConcepts;
  } else if (session?.conceptIds && session.conceptIds.length > 0) {
    const nodeMap = new Map((graph?.nodes || []).map(n => [n.id, n.name]));
    conceptList = session.conceptIds.map(id => ({
      id,
      name: nodeMap.get(id) || id
    }));
  } else if (graph?.nodes && graph.nodes.length > 0) {
    conceptList = graph.nodes.map(n => ({ id: n.id, name: n.name }));
  }

  const practiceStates = loadConceptPracticeStates(safeGraphId);
  const reviewedSet = new Set(session?.reviewedConceptIds || []);
  if (session?.currentConceptId) {
    reviewedSet.add(session.currentConceptId);
  }
  if (session?.conceptIds && session.currentIndex !== undefined && session.conceptIds[session.currentIndex]) {
    reviewedSet.add(session.conceptIds[session.currentIndex]);
  }

  const markedSet = new Set(session?.markedForReviewIds || []);

  const reviewedConcepts: ConceptInsightItem[] = [];
  const demonstratedConcepts: ConceptInsightItem[] = [];
  const revisitConcepts: ConceptInsightItem[] = [];
  const unvisitedConcepts: ConceptInsightItem[] = [];

  let assessedCount = 0;

  for (let idx = 0; idx < conceptList.length; idx++) {
    const concept = conceptList[idx];
    if (!concept || !concept.id) continue;

    const wasVisited = reviewedSet.has(concept.id);
    const isMarked = markedSet.has(concept.id);

    // Load recorded formative assessment state
    const kcState = loadStoredKnowledgeCheck(safeGraphId, concept.id);
    const rawAttempts = Object.values(kcState?.attempts || {});
    const validAttempts = rawAttempts.filter(
      (att) => att && typeof att === 'object' && att.evaluation
    );
    const attemptCount = validAttempts.length;
    const correctCount = validAttempts.filter(att => att.evaluation?.isCorrect).length;
    const hasUncertain = validAttempts.some(
      att => att.evaluation?.evaluationConfidence === 'uncertain'
    );
    const wasAssessed = attemptCount > 0;

    if (wasAssessed && wasVisited) {
      assessedCount++;
    }

    const masterySummary = calculateConceptMastery({
      graphId: safeGraphId,
      conceptId: concept.id,
      conceptName: concept.name,
      isVisitedInSession: wasVisited,
      knowledgeCheckState: kcState,
      practiceState: practiceStates[concept.id],
      isMarkedForReview: isMarked
    });

    // Evidence note grounded in recorded actions
    let evidenceNote: string;
    if (masterySummary.status === 'understanding-demonstrated') {
      evidenceNote = `${correctCount} correct response${correctCount === 1 ? '' : 's'} verified in formative assessment.`;
    } else if (masterySummary.status === 'needs-review') {
      if (isMarked) {
        evidenceNote = 'Flagged for review by student.';
      } else {
        evidenceNote = 'Recorded responses indicate difficulty or misconception.';
      }
    } else if (masterySummary.status === 'in-progress') {
      if (wasAssessed && hasUncertain) {
        evidenceNote = 'Formative response evaluated with uncertain confidence; review recommended.';
      } else if (wasVisited) {
        evidenceNote = 'Concept was visited and studied; formative assessment pending.';
      } else {
        evidenceNote = 'Preliminary study recorded.';
      }
    } else {
      evidenceNote = 'Not visited in this revision session.';
    }

    const item: ConceptInsightItem = {
      conceptId: concept.id,
      conceptName: concept.name,
      conceptIndex: idx,
      masteryStatus: masterySummary.status,
      masteryLabel: masterySummary.statusLabel,
      wasVisited,
      wasAssessed,
      questionAttemptsCount: attemptCount,
      correctAttemptsCount: correctCount,
      hasUncertainEvaluation: hasUncertain,
      evidenceNote,
      isMarkedForReview: isMarked
    };

    if (wasVisited) {
      reviewedConcepts.push(item);
      if (masterySummary.status === 'understanding-demonstrated') {
        demonstratedConcepts.push(item);
      }
      if (masterySummary.status === 'needs-review') {
        revisitConcepts.push(item);
      }
    } else {
      unvisitedConcepts.push(item);
      // If unvisited concept was previously marked for review or needs review from older records
      if (masterySummary.status === 'needs-review') {
        revisitConcepts.push(item);
      }
    }
  }

  const totalSessionConcepts = conceptList.length;
  const visitedCount = reviewedConcepts.length;
  const demonstratedCount = demonstratedConcepts.length;
  const needsReviewCount = revisitConcepts.length;
  const unassessedVisitedCount = reviewedConcepts.filter(c => !c.wasAssessed).length;
  const unvisitedCount = unvisitedConcepts.length;
  const isCompleted = totalSessionConcepts > 0 && visitedCount >= totalSessionConcepts;

  // 2. Derive Contextual Next Actions
  const nextActions: SessionNextAction[] = [];

  // Action A: Review difficult concept if any exist
  if (revisitConcepts.length > 0) {
    const firstRevisit = revisitConcepts[0];
    nextActions.push({
      id: 'action-review-difficult',
      type: 'review-difficult',
      label: `Review ${firstRevisit.conceptName}`,
      description: 'Revisit this concept to address misconceptions and consolidate understanding.',
      conceptId: firstRevisit.conceptId,
      conceptIndex: firstRevisit.conceptIndex,
      isPrimary: true
    });
  }

  // Action B: Continue sequence if unvisited concepts remain
  if (unvisitedConcepts.length > 0) {
    const firstUnvisited = unvisitedConcepts[0];
    nextActions.push({
      id: 'action-continue-sequence',
      type: 'continue-sequence',
      label: `Continue with ${firstUnvisited.conceptName}`,
      description: `Resume the planned revision path (${totalSessionConcepts - unvisitedCount + 1} of ${totalSessionConcepts} concepts).`,
      conceptId: firstUnvisited.conceptId,
      conceptIndex: firstUnvisited.conceptIndex,
      isPrimary: revisitConcepts.length === 0
    });
  }

  // Action C: Return to knowledge graph
  nextActions.push({
    id: 'action-return-graph',
    type: 'return-graph',
    label: 'Return to knowledge graph',
    description: 'Explore the full conceptual topology, connections, and source materials.',
    isPrimary: revisitConcepts.length === 0 && unvisitedConcepts.length === 0
  });

  // Action D: Conclude / finish session
  nextActions.push({
    id: 'action-finish-session',
    type: 'finish-session',
    label: 'Complete & exit session',
    description: 'Save all recorded progress and conclude this revision cycle.',
    isPrimary: false
  });

  // 3. Honest, non-gamified notes
  const notes: string[] = [];
  if (unassessedVisitedCount > 0) {
    notes.push(
      `${unassessedVisitedCount} concept${unassessedVisitedCount === 1 ? '' : 's'} visited without formative assessment attempts. Status remains In Progress until understanding is verified.`
    );
  }
  if (assessedCount === 0 && visitedCount > 0) {
    notes.push(
      'No formative questions were attempted in this session. Understanding demonstrated requires verified responses.'
    );
  }
  if (unvisitedCount > 0) {
    notes.push(
      `${unvisitedCount} concept${unvisitedCount === 1 ? '' : 's'} remain unvisited in the planned sequence.`
    );
  }

  return {
    graphId: safeGraphId,
    graphName: resolvedGraphName,
    sessionStartedAt: session?.createdAt,
    sessionEndedAt: session?.updatedAt,
    isCompleted,
    totalSessionConcepts,
    visitedCount,
    assessedCount,
    demonstratedCount,
    needsReviewCount,
    unassessedVisitedCount,
    unvisitedCount,
    reviewedConcepts,
    demonstratedConcepts,
    revisitConcepts,
    unvisitedConcepts,
    nextActions,
    notes
  };
}
