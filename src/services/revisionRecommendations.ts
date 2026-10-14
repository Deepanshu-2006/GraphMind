/**
 * GraphMind Personalized Revision Recommendations Engine
 * Phase 4 — Prompt 18
 * 
 * Generates transparent, evidence-grounded revision recommendations using:
 * - Existing revision sessions (resuming unfinished sessions)
 * - Concept mastery tracking (status, attempt counts, consecutive errors)
 * - Knowledge-gap detection (observed difficulty, potential foundational gaps)
 * - Prerequisite-aware learning analysis (confirmed prerequisites & source foundations)
 * - Graph concept relationships (connections between demonstrated & unstudied concepts)
 * - Assessment history (recent performance records)
 * 
 * Rules:
 * 1. Zero AI chatbot hallucination: every recommendation explains "Why" strictly from actual data.
 * 2. Transparent priority ranking: adaptive order based on learner context (e.g. foundational blockers).
 * 3. Clear, functional actions: continue revision, review concept, review foundation, practice questions, explore in graph.
 * 4. User control: dismissals & deferrals persisted in localStorage; recommendations are always optional.
 * 5. Deduplication: avoids recommending the same concept repeatedly across multiple categories.
 */

import type { KnowledgeGraph, KnowledgeNode } from '../types/knowledgeGraph';
import type { RevisionSessionState } from '../types/practice';
import type {
  RevisionRecommendationItem,
  RevisionRecommendationsReport,
  RecommendationPreferences
} from '../types/recommendations';
import { loadRevisionSession, validateRevisionSession } from './revisionSession';
import { calculateConceptMastery, loadStoredMastery } from './conceptMastery';
import { detectKnowledgeGaps } from './knowledgeGapDetection';
import { analyzeConceptFoundations } from './prerequisiteAnalysis';
import { loadConceptPracticeStates } from './storage';
import { loadStoredKnowledgeCheck } from './knowledgeCheck';
import { getAssessmentAttempts } from './assessmentHistory';

export const STORAGE_REC_DISMISSED_PREFIX = 'graphmind_rec_dismissed_v1_';
export const STORAGE_REC_DEFERRED_PREFIX = 'graphmind_rec_deferred_v1_';

export function getRecDismissedStorageKey(graphId: string): string {
  const safeGraph = (graphId || 'default_graph').trim();
  return `${STORAGE_REC_DISMISSED_PREFIX}${safeGraph}`;
}

export function getRecDeferredStorageKey(graphId: string): string {
  const safeGraph = (graphId || 'default_graph').trim();
  return `${STORAGE_REC_DEFERRED_PREFIX}${safeGraph}`;
}

/**
 * Loads student recommendation preferences (dismissed IDs and deferred timestamps).
 */
export function loadRecommendationPreferences(graphId: string): RecommendationPreferences {
  if (typeof localStorage === 'undefined' || !graphId) {
    return { dismissedIds: [], deferredMap: {} };
  }

  let dismissedIds: string[] = [];
  let deferredMap: Record<string, string> = {};

  try {
    const rawDismissed = localStorage.getItem(getRecDismissedStorageKey(graphId));
    if (rawDismissed) {
      const parsed = JSON.parse(rawDismissed);
      if (Array.isArray(parsed)) {
        dismissedIds = parsed.filter(id => typeof id === 'string');
      }
    }
  } catch (err) {
    console.warn('[RevisionRecommendations] Failed to read dismissed recommendations:', err);
  }

  try {
    const rawDeferred = localStorage.getItem(getRecDeferredStorageKey(graphId));
    if (rawDeferred) {
      const parsed = JSON.parse(rawDeferred);
      if (parsed && typeof parsed === 'object') {
        const now = Date.now();
        for (const [recId, expiryIso] of Object.entries(parsed)) {
          if (typeof expiryIso === 'string') {
            const expiryTime = new Date(expiryIso).getTime();
            if (expiryTime > now) {
              deferredMap[recId] = expiryIso;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[RevisionRecommendations] Failed to read deferred recommendations:', err);
  }

  return { dismissedIds, deferredMap };
}

/**
 * Dismisses a revision recommendation for a graph.
 */
export function dismissRecommendation(graphId: string, recommendationId: string): void {
  if (typeof localStorage === 'undefined' || !graphId || !recommendationId) return;
  try {
    const prefs = loadRecommendationPreferences(graphId);
    if (!prefs.dismissedIds.includes(recommendationId)) {
      prefs.dismissedIds.push(recommendationId);
      localStorage.setItem(
        getRecDismissedStorageKey(graphId),
        JSON.stringify(prefs.dismissedIds)
      );
    }
    invalidateRecommendationsCache(graphId);
  } catch (err) {
    console.warn('[RevisionRecommendations] Failed to persist recommendation dismissal:', err);
  }
}

/**
 * Defers a recommendation for a specified duration in hours (default 24h).
 */
export function deferRecommendation(
  graphId: string,
  recommendationId: string,
  durationHours: number = 24
): void {
  if (typeof localStorage === 'undefined' || !graphId || !recommendationId) return;
  try {
    const prefs = loadRecommendationPreferences(graphId);
    const expiryIso = new Date(Date.now() + durationHours * 3600 * 1000).toISOString();
    prefs.deferredMap[recommendationId] = expiryIso;
    localStorage.setItem(
      getRecDeferredStorageKey(graphId),
      JSON.stringify(prefs.deferredMap)
    );
    invalidateRecommendationsCache(graphId);
  } catch (err) {
    console.warn('[RevisionRecommendations] Failed to persist recommendation deferral:', err);
  }
}

/**
 * Restores a dismissed or deferred recommendation.
 */
export function restoreRecommendation(graphId: string, recommendationId: string): void {
  if (typeof localStorage === 'undefined' || !graphId || !recommendationId) return;
  try {
    const prefs = loadRecommendationPreferences(graphId);
    prefs.dismissedIds = prefs.dismissedIds.filter(id => id !== recommendationId);
    delete prefs.deferredMap[recommendationId];

    localStorage.setItem(
      getRecDismissedStorageKey(graphId),
      JSON.stringify(prefs.dismissedIds)
    );
    localStorage.setItem(
      getRecDeferredStorageKey(graphId),
      JSON.stringify(prefs.deferredMap)
    );
    invalidateRecommendationsCache(graphId);
  } catch (err) {
    console.warn('[RevisionRecommendations] Failed to restore recommendation:', err);
  }
}

/**
 * Clears all recommendation preferences for a graph.
 */
export function clearRecommendationPreferences(graphId: string): void {
  if (typeof localStorage === 'undefined' || !graphId) return;
  try {
    localStorage.removeItem(getRecDismissedStorageKey(graphId));
    localStorage.removeItem(getRecDeferredStorageKey(graphId));
    invalidateRecommendationsCache(graphId);
  } catch (err) {
    console.warn('[RevisionRecommendations] Failed to clear preferences:', err);
  }
}

// In-memory cache
interface CachedReportEntry {
  report: RevisionRecommendationsReport;
  cachedAt: number;
}
const recommendationsCache = new Map<string, CachedReportEntry>();
const CACHE_TTL_MS = 20000; // 20 seconds

export function invalidateRecommendationsCache(graphId?: string): void {
  if (!graphId) {
    recommendationsCache.clear();
    return;
  }
  for (const key of recommendationsCache.keys()) {
    if (key.startsWith(graphId)) {
      recommendationsCache.delete(key);
    }
  }
}

export interface GenerateRecommendationsParams {
  graph: KnowledgeGraph;
  activeSession?: RevisionSessionState | null;
  userId?: string | null;
  forceRefresh?: boolean;
  maxRecommendations?: number;
}

/**
 * Generates personalized, evidence-grounded revision recommendations.
 */
export function generateRevisionRecommendations({
  graph,
  activeSession,
  userId,
  forceRefresh = false,
  maxRecommendations = 4
}: GenerateRecommendationsParams): RevisionRecommendationsReport {
  if (!graph || !graph.id || !Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    return {
      graphId: graph?.id || 'unknown',
      graphName: graph?.name || 'Untitled Graph',
      hasActiveRecommendations: false,
      primaryRecommendation: null,
      secondaryRecommendations: [],
      allRecommendations: [],
      dismissedCount: 0,
      totalCount: 0,
      generatedAt: new Date().toISOString()
    };
  }

  const safeGraphId = (graph?.id || '').trim();
  const safeGraphName = (graph?.name || 'Untitled Graph').trim();

  const cacheKey = `${safeGraphId}:${userId || 'anonymous'}`;
  if (!forceRefresh) {
    const cached = recommendationsCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached.report;
    }
  }

  const prefs = loadRecommendationPreferences(safeGraphId);
  const rawSession = activeSession || loadRevisionSession(safeGraphId);
  const validatedSession = validateRevisionSession(rawSession, graph);

  // Load existing records
  const practiceStates = loadConceptPracticeStates();
  const assessmentAttempts = getAssessmentAttempts({ graphId: safeGraphId, userId });
  const gapReport = detectKnowledgeGaps({ graph, userId, forceRefresh });

  // Map nodes for fast lookup
  const nodeMap = new Map<string, KnowledgeNode>();
  graph.nodes.forEach(n => {
    if (n && n.id) nodeMap.set(n.id, n);
  });

  // Calculate concept mastery summaries for all nodes
  const masterySummaries = new Map<string, ReturnType<typeof calculateConceptMastery>>();
  graph.nodes.forEach(node => {
    const storedMastery = loadStoredMastery(safeGraphId, node.id);
    const kc = loadStoredKnowledgeCheck(safeGraphId, node.id);
    const ps = practiceStates[node.id] || null;
    const isVisited = validatedSession?.reviewedConceptIds?.includes(node.id) || false;
    const isMarked = validatedSession?.markedForReviewIds?.includes(node.id) || false;

    const summary = storedMastery || calculateConceptMastery({
      graphId: safeGraphId,
      conceptId: node.id,
      conceptName: node.name,
      isVisitedInSession: isVisited,
      knowledgeCheckState: kc,
      practiceState: ps,
      isMarkedForReview: isMarked
    });
    masterySummaries.set(node.id, summary);
  });

  // Collect raw candidate recommendations across all categories
  const candidates: RevisionRecommendationItem[] = [];

  // =========================================================================
  // Category A: Continue Learning (Unfinished Revision Session)
  // =========================================================================
  let unfinishedSessionCandidate: RevisionRecommendationItem | null = null;
  if (validatedSession && validatedSession.isActive && validatedSession.conceptIds.length > 0) {
    const total = validatedSession.conceptIds.length;
    const reviewedCount = validatedSession.reviewedConceptIds?.length || 0;
    const currIdx = validatedSession.currentIndex ?? 0;
    const isCompleted = reviewedCount >= total && currIdx >= total - 1;

    if (!isCompleted) {
      const currentConceptId = validatedSession.currentConceptId || validatedSession.conceptIds[currIdx];
      const conceptNode = nodeMap.get(currentConceptId) || graph.nodes[0];
      const remaining = Math.max(1, total - reviewedCount);

      const explanation = `Continue your unfinished revision session with ${remaining} of ${total} ${remaining === 1 ? 'concept' : 'concepts'} remaining.`;
      const evidenceSnippet = `${reviewedCount} of ${total} concepts reviewed; paused at ${conceptNode.name}`;

      unfinishedSessionCandidate = {
        id: `rec-continue-${graph.id}-${conceptNode.id}`,
        category: 'continue-learning',
        categoryLabel: 'CONTINUE LEARNING',
        priority: 1, // Standard priority 1
        priorityLabel: 'urgent',
        conceptId: conceptNode.id,
        conceptName: conceptNode.name,
        explanation,
        evidenceSnippet,
        evidenceCount: remaining,
        actionType: 'continue-revision',
        actionLabel: 'Continue revision',
        actionDescription: `Resume your session at ${conceptNode.name}.`
      };
    }
  }

  // =========================================================================
  // Category B: Review a Difficult Concept
  // =========================================================================
  graph.nodes.forEach(node => {
    const summary = masterySummaries.get(node.id);
    if (!summary) return;

    const gap = gapReport.items.find(g => g.conceptId === node.id);
    const hasNeedsReview = summary.status === 'needs-review';
    const consecutiveErrors = summary.consecutiveIncorrectCount || 0;
    const hasGapDifficulty = gap?.gapState === 'review-recommended' || gap?.gapState === 'observed-difficulty';

    if (hasNeedsReview || consecutiveErrors > 0 || hasGapDifficulty) {
      let explanation = `Review this concept: recorded responses indicate difficulty on recent checks.`;
      let evidenceSnippet = 'Observed difficulty on formative checks';
      
      if (consecutiveErrors >= 2) {
        explanation = `Review this concept because your ${consecutiveErrors} most recent answers were incorrect.`;
        evidenceSnippet = `${consecutiveErrors} consecutive incorrect answers`;
      } else if (consecutiveErrors === 1) {
        explanation = `Review this concept to clarify understanding after an incorrect answer.`;
        evidenceSnippet = '1 recent incorrect answer';
      } else if (gap && gap.supportingEvidence && gap.supportingEvidence.length > 0) {
        explanation = gap.reason;
        evidenceSnippet = gap.supportingEvidence[0].description;
      }

      candidates.push({
        id: `rec-diff-${node.id}`,
        category: 'review-difficulty',
        categoryLabel: 'REVIEW DIFFICULTY',
        priority: 2, // Standard priority 2
        priorityLabel: 'high',
        conceptId: node.id,
        conceptName: node.name,
        explanation,
        evidenceSnippet,
        evidenceCount: consecutiveErrors || 1,
        actionType: 'review-concept',
        actionLabel: 'Review concept',
        actionDescription: `Revisit core definitions, mechanisms, and source excerpts for ${node.name}.`
      });
    }
  });

  // =========================================================================
  // Category C: Review a Foundational Concept / Prerequisite
  // =========================================================================
  graph.nodes.forEach(node => {
    // Only analyze foundations for concepts where student is studying or struggling
    const summary = masterySummaries.get(node.id);
    const isCurrentSessionNode = validatedSession?.currentConceptId === node.id;
    const isStruggling = summary?.status === 'needs-review' || (summary?.consecutiveIncorrectCount || 0) > 0;
    const hasGap = gapReport.items.some(g => g.conceptId === node.id && g.gapState === 'potential-foundational-gap');

    if (isStruggling || isCurrentSessionNode || hasGap) {
      try {
        const foundationsReport = analyzeConceptFoundations({
          graph,
          conceptId: node.id,
          activeSession: validatedSession
        });

        // Filter true prerequisites for this node (incoming confirmed prerequisites or source foundations)
        const foundationalItems = foundationsReport.items.filter(
          item => (item.prerequisiteCategory === 'confirmed-prerequisite' || item.category === 'source-foundation') &&
                  item.conceptId !== node.id &&
                  (item.direction === 'incoming' || item.relationshipType === 'depends-on')
        );

        foundationalItems.forEach(foundItem => {
          const foundNode = nodeMap.get(foundItem.conceptId);
          if (!foundNode) return;

          const foundMastery = masterySummaries.get(foundItem.conceptId);
          const needsFoundationReview = foundMastery?.status === 'needs-review' || 
                                        foundItem.evidenceStatus === 'needs-review' ||
                                        foundItem.evidenceStatus === 'observed-difficulty' ||
                                        foundItem.evidenceStatus === 'not-assessed';

          if (needsFoundationReview) {
            let explanation = `Review prerequisite ${foundNode.name} before returning to ${node.name}.`;
            let evidenceSnippet = `Confirmed prerequisite for ${node.name}`;

            if (foundMastery?.status === 'needs-review') {
              evidenceSnippet = `Prerequisite for ${node.name} with recorded difficulty`;
            } else if (foundItem.evidenceStatus === 'not-assessed') {
              evidenceSnippet = `Unassessed prerequisite for ${node.name}`;
            }

            candidates.push({
              id: `rec-found-${foundNode.id}-for-${node.id}`,
              category: 'review-foundation',
              categoryLabel: 'FOUNDATIONAL PREREQUISITE',
              priority: 3, // Standard priority 3
              priorityLabel: 'high',
              conceptId: foundNode.id,
              conceptName: foundNode.name,
              targetConceptId: node.id,
              targetConceptName: node.name,
              explanation,
              evidenceSnippet,
              evidenceCount: (foundMastery?.consecutiveIncorrectCount || 0) > 0 ? foundMastery?.consecutiveIncorrectCount : undefined,
              actionType: 'open-foundation',
              actionLabel: 'Review foundation',
              actionDescription: `Study ${foundNode.name} to establish key fundamentals for ${node.name}.`,
              relationshipType: foundItem.relationshipType || 'prerequisite',
              relationshipDescription: foundItem.relationshipDescription
            });
          }
        });
      } catch (err) {
        console.warn(`[RevisionRecommendations] Foundation check failed for ${node.id}:`, err);
      }
    }
  });

  // =========================================================================
  // Category D: Practice a Concept (Needs More Evidence)
  // =========================================================================
  graph.nodes.forEach(node => {
    const summary = masterySummaries.get(node.id);
    if (!summary) return;

    // Studied/visited in session or marked in progress, but has 0 or insufficient attempts
    const isVisited = validatedSession?.reviewedConceptIds?.includes(node.id);
    const isInProgress = summary.status === 'in-progress';
    const noAttempts = summary.attemptCount === 0;

    if ((isVisited || isInProgress) && noAttempts && summary.status !== 'needs-review') {
      candidates.push({
        id: `rec-practice-${node.id}`,
        category: 'practice-concept',
        categoryLabel: 'PRACTICE CONCEPT',
        priority: 4, // Standard priority 4
        priorityLabel: 'recommended',
        conceptId: node.id,
        conceptName: node.name,
        explanation: `Practice this concept to gather more evidence of understanding.`,
        evidenceSnippet: 'Studied in session with no knowledge check completed',
        actionType: 'practice-concept',
        actionLabel: 'Practice questions',
        actionDescription: `Test your knowledge with interactive questions for ${node.name}.`,
        targetSectionId: 'section-knowledge-check'
      });
    }
  });

  // =========================================================================
  // Category E: Explore a Connection (Real Graph Relationships)
  // =========================================================================
  const demonstratedNodeIds = new Set<string>();
  graph.nodes.forEach(n => {
    const summary = masterySummaries.get(n.id);
    if (summary?.status === 'understanding-demonstrated') {
      demonstratedNodeIds.add(n.id);
    }
  });

  if (Array.isArray(graph.relationships)) {
    for (const rel of graph.relationships) {
      const sourceId = rel.source;
      const targetId = rel.target;
      if (!sourceId || !targetId) continue;

      const sourceDemonstrated = demonstratedNodeIds.has(sourceId);
      const targetDemonstrated = demonstratedNodeIds.has(targetId);

      // Connect demonstrated source to an unstudied / in-progress target
      if (sourceDemonstrated && !targetDemonstrated && nodeMap.has(targetId) && nodeMap.has(sourceId)) {
        const targetNode = nodeMap.get(targetId)!;
        const sourceNode = nodeMap.get(sourceId)!;
        const relType = rel.type || 'related-to';

        candidates.push({
          id: `rec-conn-${targetNode.id}-from-${sourceNode.id}`,
          category: 'explore-connection',
          categoryLabel: 'EXPLORE CONNECTION',
          priority: 5, // Standard priority 5
          priorityLabel: 'suggested',
          conceptId: targetNode.id,
          conceptName: targetNode.name,
          targetConceptId: sourceNode.id,
          targetConceptName: sourceNode.name,
          explanation: `Explore ${targetNode.name}, connected via "${relType}" from ${sourceNode.name}.`,
          evidenceSnippet: `Connected to demonstrated concept ${sourceNode.name}`,
          actionType: 'explore-graph',
          actionLabel: 'Explore in graph',
          actionDescription: `Inspect relationship from ${sourceNode.name} to ${targetNode.name}.`,
          relationshipType: relType,
          relationshipDescription: rel.description
        });
        break; // Keep exploratory recommendations concise
      }
    }
  }

  // =========================================================================
  // Category F: Start Something New (Unstudied Concept)
  // =========================================================================
  const unstudiedNodes = graph.nodes.filter(node => {
    const summary = masterySummaries.get(node.id);
    return summary?.status === 'not-started';
  });

  if (unstudiedNodes.length > 0) {
    // Select the first unstudied concept (introductory or topological order)
    const introNode = unstudiedNodes[0];
    candidates.push({
      id: `rec-new-${introNode.id}`,
      category: 'start-new',
      categoryLabel: 'START SOMETHING NEW',
      priority: 6, // Standard priority 6
      priorityLabel: 'introductory',
      conceptId: introNode.id,
      conceptName: introNode.name,
      explanation: `Begin studying this unstudied concept in your graph.`,
      evidenceSnippet: 'Not yet started in revision',
      actionType: 'start-concept',
      actionLabel: 'Start concept',
      actionDescription: `Start learning ${introNode.name}.`
    });
  }

  // =========================================================================
  // Contextual Priority Adaptation & Ranking
  // =========================================================================
  // Add unfinished session candidate if available
  if (unfinishedSessionCandidate) {
    // Check if the current paused concept has a blocking foundational prerequisite with difficulty
    const currentConceptId = unfinishedSessionCandidate.conceptId;
    const currentSummary = masterySummaries.get(currentConceptId);
    const isCurrentStruggling = currentSummary?.status === 'needs-review' || (currentSummary?.consecutiveIncorrectCount || 0) > 0;

    // Only elevate blocking foundation if the current concept is struggling or the foundation has recorded difficulty
    const blockingFoundation = candidates.find(
      c => c.category === 'review-foundation' &&
           c.targetConceptId === currentConceptId &&
           (isCurrentStruggling || (c.evidenceCount !== undefined && c.evidenceCount > 0))
    );

    if (blockingFoundation) {
      // Elevate the blocking foundation to Priority 1 (above session continuation)
      blockingFoundation.priority = 1;
      blockingFoundation.priorityLabel = 'urgent';
      unfinishedSessionCandidate.priority = 2; // Session continuation moves to Priority 2
      unfinishedSessionCandidate.priorityLabel = 'high';
    }

    candidates.unshift(unfinishedSessionCandidate);
  }

  // Check recent assessment history: if student just scored poorly on a concept, elevate review-difficulty
  if (assessmentAttempts.length > 0) {
    const latestAttempt = assessmentAttempts[0];
    const missedConceptNames = (latestAttempt.resultsSummary?.reviewRecommendedConcepts || []).map((m: { conceptName: string }) => m.conceptName.toLowerCase());
    if (missedConceptNames.length > 0) {
      candidates.forEach(c => {
        if (c.category === 'review-difficulty' && missedConceptNames.includes(c.conceptName.toLowerCase())) {
          c.priority = Math.min(c.priority, 1.5);
          c.evidenceSnippet = `Missed on recent assessment (${latestAttempt.scorePercentage}%)`;
        }
      });
    }
  }

  // Sort deterministically by priority (ascending, 1 is highest)
  candidates.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.conceptName.localeCompare(b.conceptName);
  });

  // Deduplicate by conceptId: a concept should only appear once at its highest priority need
  const seenConceptIds = new Set<string>();
  const deduplicated: RevisionRecommendationItem[] = [];

  for (const item of candidates) {
    if (!seenConceptIds.has(item.conceptId)) {
      seenConceptIds.add(item.conceptId);
      deduplicated.push(item);
    }
  }

  // Apply user preferences: filter out dismissed and currently deferred recommendations
  const activeRecommendations: RevisionRecommendationItem[] = [];
  let dismissedCount = 0;

  for (const item of deduplicated) {
    const isDismissed = prefs.dismissedIds.includes(item.id);
    const isDeferred = Boolean(prefs.deferredMap[item.id]);

    if (isDismissed || isDeferred) {
      dismissedCount++;
    } else {
      activeRecommendations.push(item);
    }
  }

  // Pick primary recommendation (first active) and secondary recommendations (next up to maxRecommendations - 1)
  const primaryRecommendation = activeRecommendations.length > 0 ? { ...activeRecommendations[0], isPrimary: true } : null;
  const secondaryRecommendations = activeRecommendations.slice(1, maxRecommendations);

  const report: RevisionRecommendationsReport = {
    graphId: safeGraphId,
    graphName: safeGraphName,
    hasActiveRecommendations: primaryRecommendation !== null,
    primaryRecommendation,
    secondaryRecommendations,
    allRecommendations: activeRecommendations,
    dismissedCount,
    totalCount: deduplicated.length,
    generatedAt: new Date().toISOString()
  };

  recommendationsCache.set(cacheKey, { report, cachedAt: Date.now() });
  return report;
}
