/**
 * GraphMind Persona — Contextual Next-Step Recommendation Engine
 * 
 * Derives a single, high-leverage next action grounded in the learner's actual
 * progress across graphs, assessments, revision sessions, and concept states.
 * 
 * Recommendation Priority Order:
 * 1. If a valid unfinished revision session exists, recommend resuming it.
 *    (Avoids duplicating the Resume action if already clearly available elsewhere).
 * 2. Otherwise, if concepts require attention, recommend reviewing those concepts.
 * 3. Otherwise, if a graph has not been assessed, recommend taking an assessment for that graph.
 * 4. Otherwise, recommend continuing learning through an existing relevant feature.
 */

import type { KnowledgeGraphMeta } from '../types/knowledgeGraph';
import type { PersonaStatsData } from '../types/personaStats';
import { loadGraphs, loadGraphData, getConceptsByKnowledgeState } from './storage';
import { loadRevisionSession } from './revisionSession';
import { getAssessmentAttempts } from './assessmentHistory';

export type PersonaNextStepType =
  | 'resume-revision'
  | 'review-concepts'
  | 'take-assessment'
  | 'continue-learning';

export interface PersonaNextStepRecommendation {
  type: PersonaNextStepType;
  title: string;
  description: string;
  actionLabel: string;
  destination: 'revision' | 'study' | 'graph' | 'overview';
  graphId?: string;
  graphName?: string;
  conceptName?: string;
  conceptId?: string;
}

export interface GetPersonaRecommendationOptions {
  graphs?: KnowledgeGraphMeta[];
  activeGraphId?: string | null;
  /** Set to true if the existing Resume session action is already visibly rendered elsewhere on the dashboard */
  hasExistingResumeAction?: boolean;
  userId?: string | null;
}

/**
 * Derives the single most pertinent next learning step for the learner.
 * Operates purely on authoritative stored records without fabricated data.
 */
export function getPersonaNextStepRecommendation(
  stats: PersonaStatsData | null,
  options: GetPersonaRecommendationOptions = {}
): PersonaNextStepRecommendation | null {
  const graphs = options.graphs ?? (typeof localStorage !== 'undefined' ? loadGraphs() : []);
  const storageAttempts = typeof localStorage !== 'undefined' ? getAssessmentAttempts({ userId: options.userId }) : [];
  const statsAttempts = stats?.performance?.recentAssessments || [];

  // -------------------------------------------------------------------------
  // Priority 1: Valid unfinished revision session exists
  // -------------------------------------------------------------------------
  const activeRev = stats?.performance?.activeRevisionProgress;
  const isRevUnfinished = (session: { reviewedCount: number; totalConcepts: number; progressPercent?: number }) => {
    return session.totalConcepts > 0 && session.reviewedCount < session.totalConcepts && (session.progressPercent ?? 0) < 100;
  };

  let unfinishedSession: {
    graphId: string;
    graphName: string;
    reviewedCount: number;
    totalConcepts: number;
    progressPercent: number;
    isDisplayedElsewhere?: boolean;
  } | null = null;

  if (activeRev && isRevUnfinished(activeRev)) {
    unfinishedSession = {
      graphId: activeRev.graphId,
      graphName: activeRev.graphName,
      reviewedCount: activeRev.reviewedCount,
      totalConcepts: activeRev.totalConcepts,
      progressPercent: activeRev.progressPercent,
      isDisplayedElsewhere: true
    };
  } else if (typeof localStorage !== 'undefined') {
    // Check if any other user graph has an unfinished session in storage
    for (const g of graphs) {
      const session = loadRevisionSession(g.id);
      if (session?.isActive && session.conceptIds && session.conceptIds.length > 0) {
        const reviewed = session.reviewedConceptIds?.length || 0;
        if (reviewed < session.conceptIds.length) {
          const total = session.conceptIds.length;
          unfinishedSession = {
            graphId: g.id,
            graphName: g.name,
            reviewedCount: reviewed,
            totalConcepts: total,
            progressPercent: Math.round((reviewed / total) * 100),
            isDisplayedElsewhere: false
          };
          break;
        }
      }
    }
  }

  // Check anti-duplication rule:
  // "Do not duplicate the existing Resume session action if the same recommendation is already clearly available elsewhere."
  const isDuplicateResume = options.hasExistingResumeAction && unfinishedSession?.isDisplayedElsewhere;

  if (unfinishedSession && !isDuplicateResume) {
    const remaining = Math.max(1, unfinishedSession.totalConcepts - unfinishedSession.reviewedCount);
    return {
      type: 'resume-revision',
      title: `Resume revision in ${unfinishedSession.graphName}`,
      description: `${remaining} ${remaining === 1 ? 'concept remains' : 'concepts remain'} to complete this session.`,
      actionLabel: 'Resume session',
      destination: 'revision',
      graphId: unfinishedSession.graphId,
      graphName: unfinishedSession.graphName
    };
  }

  // -------------------------------------------------------------------------
  // Priority 2: Concepts require attention
  // -------------------------------------------------------------------------
  let needsRevisionCount = stats?.performance?.conceptsNeedingRevisionCount ?? 0;
  const exampleConcepts = stats?.performance?.conceptsNeedingRevisionExamples ?? [];
  let topConcept = exampleConcepts.length > 0 ? exampleConcepts[0] : undefined;
  let targetGraphName: string | undefined;
  let targetGraphId: string | undefined;

  // Fallback to storage practice states if stats object was empty or missing
  if (needsRevisionCount === 0 && typeof localStorage !== 'undefined') {
    for (const g of graphs) {
      const needsReviewIds = getConceptsByKnowledgeState(g.id, 'needs-review');
      if (needsReviewIds.length > 0) {
        needsRevisionCount = needsReviewIds.length;
        const gData = loadGraphData(g.id);
        const node = gData?.nodes?.find(n => n.id === needsReviewIds[0]);
        topConcept = node?.name || needsReviewIds[0];
        targetGraphId = g.id;
        targetGraphName = g.name;
        break;
      }
    }
  }

  if (needsRevisionCount > 0) {
    // Resolve which graph contains this concept for rich context
    if (topConcept && !targetGraphName && typeof localStorage !== 'undefined') {
      for (const g of graphs) {
        const data = loadGraphData(g.id);
        if (data?.nodes?.some(n => n.name.toLowerCase() === topConcept!.toLowerCase() || n.id === topConcept)) {
          targetGraphId = g.id;
          targetGraphName = g.name;
          break;
        }
      }
    }

    const title = topConcept
      ? `Review ${topConcept}`
      : needsRevisionCount === 1
      ? 'Review 1 concept needing attention'
      : `Review ${needsRevisionCount} concepts needing attention`;

    const description = targetGraphName
      ? `${needsRevisionCount} ${needsRevisionCount === 1 ? 'concept requires' : 'concepts require'} review in ${targetGraphName}.`
      : `${needsRevisionCount} ${needsRevisionCount === 1 ? 'concept requires' : 'concepts require'} review to solidify understanding.`;

    return {
      type: 'review-concepts',
      title,
      description,
      actionLabel: 'Review concepts',
      destination: 'revision',
      conceptName: topConcept,
      graphId: targetGraphId,
      graphName: targetGraphName
    };
  }

  // -------------------------------------------------------------------------
  // Priority 3: A graph has not been assessed
  // -------------------------------------------------------------------------
  if (graphs.length > 0) {
    const assessedGraphIds = new Set([
      ...storageAttempts.map(a => a.graphId),
      ...statsAttempts.map(a => a.graphId)
    ]);
    // Prioritize currently active graph if unassessed, otherwise first unassessed graph
    const activeUnassessed = options.activeGraphId && !assessedGraphIds.has(options.activeGraphId)
      ? graphs.find(g => g.id === options.activeGraphId)
      : null;
    const unassessedGraph = activeUnassessed || graphs.find(g => !assessedGraphIds.has(g.id));

    if (unassessedGraph) {
      return {
        type: 'take-assessment',
        title: `Assess ${unassessedGraph.name}`,
        description: 'Test your understanding of this knowledge graph to measure progress.',
        actionLabel: 'Start assessment',
        destination: 'graph',
        graphId: unassessedGraph.id,
        graphName: unassessedGraph.name
      };
    }
  }

  // -------------------------------------------------------------------------
  // Priority 4: Continue learning through an existing relevant feature
  // -------------------------------------------------------------------------
  if (graphs.length > 0) {
    const targetGraph =
      (options.activeGraphId && graphs.find(g => g.id === options.activeGraphId)) ||
      (stats?.activity?.recentGraph && graphs.find(g => g.id === stats.activity.recentGraph!.graphId)) ||
      graphs[0];

    return {
      type: 'continue-learning',
      title: `Continue learning in ${targetGraph.name}`,
      description: 'Explore concept relationships and deepen your mastery.',
      actionLabel: 'Explore graph',
      destination: 'graph',
      graphId: targetGraph.id,
      graphName: targetGraph.name
    };
  }

  // Fallback when 0 graphs exist
  return {
    type: 'continue-learning',
    title: 'Create your first graph',
    description: 'Upload materials or create a graph to begin exploring concepts.',
    actionLabel: 'Create graph',
    destination: 'overview'
  };
}
