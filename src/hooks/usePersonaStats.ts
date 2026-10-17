import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  PersonaStatsData,
  PersonaActivityStats,
  PersonaPerformanceStats,
  PersonaRecentAssessment,
  PersonaRevisionProgress,
  RecentGraphActivity,
  UsePersonaStatsReturn
} from '../types/personaStats';
import { useOptionalGraph } from '../context/GraphContext';
import {
  loadGraphs,
  loadGraphData,
  loadRevisionSession,
  getConceptsByKnowledgeState
} from '../services/storage';
import { getAssessmentAttempts } from '../services/assessmentHistory';
import { loadGraphMasteryOverview } from '../services/conceptMastery';
import { getCurrentUser } from '../services/auth';
import type { KnowledgeGraphMeta, KnowledgeGraph } from '../types/knowledgeGraph';

export interface CalculatePersonaStatsOptions {
  userId?: string | null;
  graphs?: KnowledgeGraphMeta[];
  activeGraphId?: string | null;
  activeGraph?: KnowledgeGraph | null;
}

/**
 * Pure calculation function that aggregates actual persisted GraphMind data into the Persona statistics structure.
 * 
 * Rules:
 * - Strictly grounded in persisted data: no synthetic metrics, no streaks, no fake retention.
 * - If no assessments exist, averageScore is null (not 0%).
 * - If no active revision session exists, activeRevisionProgress is null.
 * - Global concept counts and demonstrated understanding roll up across all user graphs.
 */
export function calculatePersonaStats(options: CalculatePersonaStatsOptions = {}): PersonaStatsData {
  const user = getCurrentUser();
  const userId = options.userId !== undefined ? options.userId : (user?.id || null);
  const userName = user?.name || null;

  // 1. Resolve graphs registry
  const graphs: KnowledgeGraphMeta[] = options.graphs || loadGraphs();
  const totalGraphs = graphs.length;

  // 2. Identify most recently updated graphs
  let recentGraph: RecentGraphActivity | null = null;
  const recentGraphs: RecentGraphActivity[] = [];

  if (graphs.length > 0) {
    const sortedGraphs = [...graphs].sort((a, b) => {
      const timeA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const timeB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return timeB - timeA;
    });

    const latest = sortedGraphs[0];
    const latestData = latest.id === options.activeGraphId && options.activeGraph
      ? options.activeGraph
      : loadGraphData(latest.id);

    recentGraph = {
      graphId: latest.id,
      graphName: latest.name,
      updatedAt: latest.updatedAt,
      createdAt: latest.createdAt,
      totalConcepts: latestData?.nodes?.length || 0
    };

    for (const g of sortedGraphs.slice(0, 3)) {
      const gData = g.id === options.activeGraphId && options.activeGraph
        ? options.activeGraph
        : loadGraphData(g.id);
      recentGraphs.push({
        graphId: g.id,
        graphName: g.name,
        updatedAt: g.updatedAt,
        createdAt: g.createdAt,
        totalConcepts: gData?.nodes?.length || 0
      });
    }
  }

  // 3. Aggregate Concepts, Demonstrated Mastery, and Revision Needs across all user graphs
  let totalConcepts = 0;
  let demonstratedConcepts = 0;
  const uniqueConceptsNeedingReview = new Set<string>();
  const conceptsNeedingRevisionExamples: string[] = [];

  const recordConceptNeedingReview = (metaId: string, conceptId: string, nodes: Array<{ id: string; name: string }>) => {
    const key = `${metaId}:${conceptId}`;
    if (!uniqueConceptsNeedingReview.has(key)) {
      uniqueConceptsNeedingReview.add(key);
      if (conceptsNeedingRevisionExamples.length < 2) {
        const found = nodes.find(n => n.id === conceptId);
        if (found?.name && !conceptsNeedingRevisionExamples.includes(found.name)) {
          conceptsNeedingRevisionExamples.push(found.name);
        }
      }
    }
  };

  // Check active revision session (prefer active graph, fallback to first active session found)
  let foundActiveRevision: PersonaRevisionProgress | null = null;

  for (const meta of graphs) {
    const graphData: KnowledgeGraph | null = meta.id === options.activeGraphId && options.activeGraph
      ? options.activeGraph
      : loadGraphData(meta.id);

    const nodes = graphData?.nodes || [];
    totalConcepts += nodes.length;

    // Check revision session for this graph
    const session = loadRevisionSession(meta.id);

    // If an active session hasn't been picked yet and this one is active, capture it
    if (!foundActiveRevision && session && session.isActive && session.totalConcepts > 0) {
      const reviewed = session.reviewedConceptIds?.length || 0;
      const isCompleted = reviewed >= session.totalConcepts && session.currentIndex >= session.totalConcepts - 1;

      if (!isCompleted) {
        const currId = session.currentConceptId || (session.conceptIds ? session.conceptIds[session.currentIndex] : null);
        const currNode = nodes.find(n => n.id === currId);
        foundActiveRevision = {
          graphId: meta.id,
          graphName: meta.name,
          reviewedCount: reviewed,
          totalConcepts: session.totalConcepts,
          progressPercent: Math.min(100, Math.round((reviewed / session.totalConcepts) * 100)),
          currentConceptName: currNode?.name || null
        };
      }
    }

    // Accumulate mastery status if graph has nodes
    if (nodes.length > 0) {
      const mastery = loadGraphMasteryOverview(meta.id, nodes, session);
      demonstratedConcepts += mastery.understandingDemonstratedCount;

      // Collect concepts needing review from mastery
      for (const cId of mastery.needsReviewConceptIds) {
        recordConceptNeedingReview(meta.id, cId, nodes);
      }
    }

    // Collect concepts needing review from practice states
    const needsReviewFromPractice = getConceptsByKnowledgeState(meta.id, 'needs-review');
    for (const cId of needsReviewFromPractice) {
      recordConceptNeedingReview(meta.id, cId, nodes);
    }

    // Collect concepts flagged in session
    if (session?.markedForReviewIds) {
      for (const cId of session.markedForReviewIds) {
        recordConceptNeedingReview(meta.id, cId, nodes);
      }
    }
  }

  const demonstratedPercentage = totalConcepts > 0
    ? Math.round((demonstratedConcepts / totalConcepts) * 100)
    : 0;

  const activityStats: PersonaActivityStats = {
    totalGraphs,
    recentGraph,
    recentGraphs,
    totalConcepts,
    demonstratedConcepts,
    demonstratedPercentage
  };

  // 4. Retrieve assessment attempts with user ownership isolation
  const attempts = getAssessmentAttempts({ userId });

  // Filter completed attempts (ensure valid score and completion date)
  const completedAttempts = attempts.filter(
    (a) => typeof a.scorePercentage === 'number' && !isNaN(a.scorePercentage) && a.completedAt
  );

  const totalAssessmentAttempts = completedAttempts.length;

  // Average score across completed attempts
  let averageScore: number | null = null;
  if (completedAttempts.length > 0) {
    const totalScore = completedAttempts.reduce((acc, a) => acc + a.scorePercentage, 0);
    averageScore = Math.round(totalScore / completedAttempts.length);
  }

  // Recent 3 completed attempts (already sorted newest first)
  const recentAssessments: PersonaRecentAssessment[] = completedAttempts.slice(0, 3).map((a) => ({
    id: a.id,
    testId: a.testId,
    graphId: a.graphId,
    graphName: a.graphName || 'Knowledge Graph',
    scorePercentage: a.scorePercentage,
    correctAnswers: a.correctAnswers,
    totalQuestions: a.totalQuestions,
    completedAt: a.completedAt,
    timeSpentSeconds: a.timeSpentSeconds
  }));

  const performanceStats: PersonaPerformanceStats = {
    totalAssessmentAttempts,
    recentAssessments,
    averageScore,
    activeRevisionProgress: foundActiveRevision,
    conceptsNeedingRevisionCount: uniqueConceptsNeedingReview.size,
    conceptsNeedingRevisionExamples
  };

  return {
    activity: activityStats,
    performance: performanceStats,
    userId,
    userName
  };
}

/**
 * usePersonaStats
 * 
 * Reusable React hook for GraphMind Persona.
 * Aggregates user learning activity and performance statistics from persisted sources:
 * - Graph registry and nodes (GraphContext & storage.ts)
 * - Assessment attempts and historical scores (assessmentHistory.ts)
 * - Concept mastery and demonstrated understanding (conceptMastery.ts)
 * - Active revision sessions (revisionSession.ts)
 * 
 * Guarantees zero fake statistics, zero streaks, zero fabricated retention, and safe lifecycle cleanup.
 */
export function usePersonaStats(): UsePersonaStatsReturn {
  const optionalGraphContext = useOptionalGraph();

  const [stats, setStats] = useState<PersonaStatsData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);

  const loadStats = useCallback(() => {
    try {
      setIsLoading(true);
      setError(null);

      const calculated = calculatePersonaStats({
        graphs: optionalGraphContext?.graphs,
        activeGraphId: optionalGraphContext?.activeGraphId,
        activeGraph: optionalGraphContext?.activeGraph
      });

      if (isMountedRef.current) {
        setStats(calculated);
        setIsLoading(false);
      }
    } catch (err) {
      if (isMountedRef.current) {
        console.error('[usePersonaStats] Failed to calculate statistics:', err);
        setError(err instanceof Error ? err.message : 'Failed to retrieve Persona statistics.');
        setIsLoading(false);
      }
    }
  }, [
    optionalGraphContext?.graphs,
    optionalGraphContext?.activeGraphId,
    optionalGraphContext?.activeGraph
  ]);

  useEffect(() => {
    isMountedRef.current = true;
    loadStats();

    // Listen to cross-tab storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (!e.key || e.key.startsWith('graphmind_')) {
        loadStats();
      }
    };

    // Listen to in-app custom notification event if dispatched
    const handleCustomUpdate = () => {
      loadStats();
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorageChange);
      window.addEventListener('graphmind:data-updated', handleCustomUpdate);
    }

    return () => {
      isMountedRef.current = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorageChange);
        window.removeEventListener('graphmind:data-updated', handleCustomUpdate);
      }
    };
  }, [loadStats]);

  return {
    stats,
    isLoading,
    error,
    refresh: loadStats
  };
}

export * from '../types/personaStats';
