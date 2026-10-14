/**
 * GraphMind Unified Learning Overview Service
 * Phase 4 — Prompt 19
 * 
 * Aggregates and correlates:
 * - Graph concept mastery overview (demonstrated, needs review, in-progress, unstudied)
 * - Clear distinction between activity and demonstrated understanding
 * - Active / unfinished revision sessions
 * - Recommended next actions from existing revision recommendations engine
 * - Concepts needing attention (grounded difficulties and knowledge gaps)
 * - Safe handling of empty, new user, and inconclusive states
 */

import type { KnowledgeGraph } from '../types/knowledgeGraph';
import type { RevisionSessionState } from '../types/practice';
import type {
  UnifiedLearningOverviewData,
  UnfinishedSessionOverview,
  ConceptAttentionItem
} from '../types/learningOverview';
import { loadRevisionSession, validateRevisionSession } from './revisionSession';
import { loadGraphMasteryOverview } from './conceptMastery';
import { generateRevisionRecommendations } from './revisionRecommendations';
import { detectKnowledgeGaps } from './knowledgeGapDetection';
import { getAssessmentAttempts } from './assessmentHistory';

export interface ComputeUnifiedLearningOverviewParams {
  graph: KnowledgeGraph;
  activeSession?: RevisionSessionState | null;
  userId?: string | null;
  forceRefresh?: boolean;
}

export function computeUnifiedLearningOverview({
  graph,
  activeSession,
  userId,
  forceRefresh = false
}: ComputeUnifiedLearningOverviewParams): UnifiedLearningOverviewData {
  const safeGraphId = (graph?.id || '').trim();
  const safeGraphName = (graph?.name || 'Untitled Graph').trim();

  // Guard against missing, empty or nodeless graphs
  if (!graph || !safeGraphId || !Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    return {
      graphId: safeGraphId || 'unknown',
      graphName: safeGraphName,
      totalConcepts: 0,
      demonstratedCount: 0,
      needsReviewCount: 0,
      inProgressCount: 0,
      notStartedCount: 0,
      activityCount: 0,
      demonstratedPercentage: 0,
      lastStudiedAt: null,
      lastStudiedConceptName: null,
      hasUnfinishedSession: false,
      unfinishedSession: null,
      primaryRecommendation: null,
      secondaryRecommendations: [],
      conceptsNeedingAttention: [],
      isNewUser: true,
      hasZeroAssessments: true,
      hasZeroRevisionActivity: true,
      hasAllDemonstrated: false,
      isInconclusive: false
    };
  }

  // 1. Session resolution
  const rawSession = activeSession || loadRevisionSession(safeGraphId);
  const validatedSession = validateRevisionSession(rawSession, graph);

  let hasUnfinishedSession = false;
  let unfinishedSession: UnfinishedSessionOverview | null = null;

  if (validatedSession && validatedSession.isActive && validatedSession.conceptIds.length > 0) {
    const total = validatedSession.conceptIds.length;
    const reviewedCount = validatedSession.reviewedConceptIds?.length || 0;
    const currIdx = validatedSession.currentIndex ?? 0;
    const isCompleted = reviewedCount >= total && currIdx >= total - 1;

    if (!isCompleted) {
      hasUnfinishedSession = true;
      const currentId = validatedSession.currentConceptId || validatedSession.conceptIds[currIdx];
      const currentNode = graph.nodes.find(n => n.id === currentId);
      const remaining = Math.max(1, total - reviewedCount);
      const progressPercent = total > 0 ? Math.round((reviewedCount / total) * 100) : 0;

      unfinishedSession = {
        currentConceptId: currentId,
        currentConceptName: currentNode?.name || 'Current concept',
        currentIndex: currIdx,
        totalConcepts: total,
        reviewedConceptsCount: reviewedCount,
        remainingCount: remaining,
        progressPercent
      };
    }
  }

  // 2. Mastery overview (distinguishing activity from demonstrated understanding)
  const masteryOverview = loadGraphMasteryOverview(safeGraphId, graph.nodes, validatedSession);
  const totalConcepts = graph.nodes.length;
  const demonstratedCount = masteryOverview.understandingDemonstratedCount;
  const needsReviewCount = masteryOverview.needsReviewCount;
  const inProgressCount = masteryOverview.inProgressCount;
  const notStartedCount = masteryOverview.notStartedCount;
  const activityCount = inProgressCount + needsReviewCount + demonstratedCount;
  const demonstratedPercentage = totalConcepts > 0 ? Math.round((demonstratedCount / totalConcepts) * 100) : 0;

  // 3. Assessment history for graph
  const attempts = getAssessmentAttempts({ graphId: safeGraphId, userId });
  const hasZeroAssessments = attempts.length === 0;

  // 4. Recommendations from existing recommendation engine
  const recReport = generateRevisionRecommendations({
    graph,
    activeSession: validatedSession,
    userId,
    forceRefresh
  });

  // 5. Grounded Knowledge Gaps & Difficulties (Prioritizing strong evidence of difficulty)
  const gapReport = detectKnowledgeGaps({ graph, userId, forceRefresh });
  const conceptsNeedingAttention: ConceptAttentionItem[] = [];
  const seenAttentionIds = new Set<string>();

  // A. Concepts with explicit needs-review mastery or consecutive errors (strongest evidence)
  for (const nodeId of masteryOverview.needsReviewConceptIds) {
    const summary = masteryOverview.concepts[nodeId];
    if (!summary || seenAttentionIds.has(nodeId)) continue;
    seenAttentionIds.add(nodeId);

    const errors = summary.consecutiveIncorrectCount || summary.incorrectCount || 1;
    let reason = `Recorded responses indicate difficulty on recent checks.`;
    if (summary.consecutiveIncorrectCount >= 2) {
      reason = `${summary.consecutiveIncorrectCount} consecutive incorrect answers recorded.`;
    }

    conceptsNeedingAttention.push({
      conceptId: nodeId,
      conceptName: summary.conceptName,
      status: summary.status,
      statusLabel: summary.statusLabel,
      reason,
      evidenceSnippet: `${errors} incorrect ${errors === 1 ? 'answer' : 'answers'} recorded`,
      actionLabel: 'Review concept',
      actionType: 'review-concept',
      actionDescription: `Study core definitions and explanation for ${summary.conceptName}.`
    });
  }

  // B. Concepts from gap report with review-recommended or observed-difficulty
  for (const gap of gapReport.items) {
    if (seenAttentionIds.has(gap.conceptId)) continue;

    if (gap.gapState === 'review-recommended' || gap.gapState === 'observed-difficulty' || gap.gapState === 'potential-foundational-gap') {
      seenAttentionIds.add(gap.conceptId);
      const summary = masteryOverview.concepts[gap.conceptId];

      const isFoundational = gap.gapState === 'potential-foundational-gap';
      const prereqInfo = isFoundational ? gap.relatedConcepts.find(r => r.isPrerequisite && r.hasDifficulty) : undefined;

      conceptsNeedingAttention.push({
        conceptId: gap.conceptId,
        conceptName: gap.conceptName,
        status: summary?.status || 'needs-review',
        statusLabel: gap.statusLabel,
        reason: gap.reason,
        evidenceSnippet: gap.supportingEvidence[0]?.description,
        isPrerequisiteIssue: isFoundational,
        prerequisiteName: prereqInfo?.conceptName,
        actionLabel: isFoundational ? 'Review foundation' : 'Review concept',
        actionType: isFoundational ? 'open-foundation' : 'review-concept',
        actionDescription: gap.recommendedAction?.description || `Review ${gap.conceptName}.`
      });
    }
  }

  // 6. Last studied timestamp & concept
  let lastStudiedAt: string | null = null;
  let lastStudiedConceptName: string | null = null;

  if (validatedSession?.updatedAt) {
    lastStudiedAt = validatedSession.updatedAt;
    if (unfinishedSession) {
      lastStudiedConceptName = unfinishedSession.currentConceptName;
    }
  } else if (attempts.length > 0) {
    lastStudiedAt = attempts[0].completedAt;
  }

  // 7. State flags
  const hasZeroRevisionActivity = activityCount === 0 && !hasUnfinishedSession;
  const isNewUser = hasZeroAssessments && hasZeroRevisionActivity;
  const hasAllDemonstrated = totalConcepts > 0 && demonstratedCount === totalConcepts;
  const isInconclusive = activityCount > 0 && demonstratedCount === 0 && needsReviewCount === 0;

  return {
    graphId: safeGraphId,
    graphName: safeGraphName,
    totalConcepts,
    demonstratedCount,
    needsReviewCount,
    inProgressCount,
    notStartedCount,
    activityCount,
    demonstratedPercentage,
    lastStudiedAt,
    lastStudiedConceptName,
    hasUnfinishedSession,
    unfinishedSession,
    primaryRecommendation: recReport.primaryRecommendation,
    secondaryRecommendations: recReport.secondaryRecommendations,
    conceptsNeedingAttention,
    isNewUser,
    hasZeroAssessments,
    hasZeroRevisionActivity,
    hasAllDemonstrated,
    isInconclusive
  };
}
