/**
 * GraphMind Persona — Contextual Observation Engine
 *
 * Generates concise, truthful, deterministic observations based on the learner's
 * actual GraphMind data (assessments, revision sessions, concept progress, and graphs).
 *
 * Requirements & Constraints:
 * 1. Only report what is reliably determined from authoritative learning data.
 * 2. Never claim improvement unless historical data (>= 2 assessments) explicitly confirms it.
 * 3. Never invent mastery, streaks, or completion without supporting evidence.
 * 4. Coordinate with the two-cycle analysis sequence (Cycle 1 & Cycle 2).
 * 5. Calm, observant, dignified learning companion tone (not a chatbot or gamified notification).
 */

import type { PersonaStatsData, PersonaRecentAssessment } from '../types/personaStats';

export type PersonaObservationCategory =
  | 'low-performance'
  | 'strong-performance'
  | 'steady-performance'
  | 'improved-progress'
  | 'unfinished-revision'
  | 'concepts-needing-attention'
  | 'unassessed-learning'
  | 'getting-started';

export interface PersonaContextualObservation {
  cycle1: string;
  cycle2: string;
  category: PersonaObservationCategory;
  metadata?: {
    score?: number | null;
    improved?: boolean;
    previousScore?: number;
    latestScore?: number;
    conceptName?: string;
    graphName?: string;
    remainingConcepts?: number;
  };
}

export interface HistoricalImprovement {
  hasImproved: boolean;
  latestScore: number;
  previousScore: number;
  delta: number;
  graphName: string;
  sameGraph: boolean;
}

/**
 * Evaluates whether historical assessment records confirm measurable score improvement.
 * Strictly requires at least 2 completed assessments with latestScore > previousScore.
 */
export function checkHistoricalImprovement(
  recentAssessments?: PersonaRecentAssessment[] | null
): HistoricalImprovement | null {
  if (!recentAssessments || recentAssessments.length < 2) {
    return null;
  }

  // recentAssessments are sorted in newest-first order
  const latest = recentAssessments[0];
  const previous = recentAssessments[1];

  if (
    typeof latest?.scorePercentage === 'number' &&
    typeof previous?.scorePercentage === 'number' &&
    latest.scorePercentage > previous.scorePercentage
  ) {
    return {
      hasImproved: true,
      latestScore: latest.scorePercentage,
      previousScore: previous.scorePercentage,
      delta: latest.scorePercentage - previous.scorePercentage,
      graphName: latest.graphName || 'Assessment',
      sameGraph: Boolean(latest.graphId && previous.graphId && latest.graphId === previous.graphId)
    };
  }

  return null;
}

/**
 * Derives a deterministic two-cycle contextual observation pair from authoritative learner stats.
 */
export function getContextualObservations(
  stats: PersonaStatsData | null
): PersonaContextualObservation {
  const avgScore = stats?.performance?.averageScore ?? null;
  const recentAssessments = stats?.performance?.recentAssessments ?? [];
  const activeRev = stats?.performance?.activeRevisionProgress ?? null;
  const needsRevisionCount = stats?.performance?.conceptsNeedingRevisionCount ?? 0;
  const exampleConcepts = stats?.performance?.conceptsNeedingRevisionExamples ?? [];
  const totalGraphs = stats?.activity?.totalGraphs ?? 0;
  const recentGraph = stats?.activity?.recentGraph ?? null;
  const demonstratedPercentage = stats?.activity?.demonstratedPercentage ?? 0;
  const demonstratedConcepts = stats?.activity?.demonstratedConcepts ?? 0;
  const totalConcepts = stats?.activity?.totalConcepts ?? 0;

  const isRevisionUnfinished = Boolean(
    activeRev &&
    activeRev.totalConcepts > 0 &&
    activeRev.reviewedCount < activeRev.totalConcepts &&
    activeRev.progressPercent < 100
  );
  const remainingRevisionConcepts = activeRev
    ? Math.max(1, activeRev.totalConcepts - activeRev.reviewedCount)
    : 0;

  const improvement = checkHistoricalImprovement(recentAssessments);

  // -------------------------------------------------------------------------
  // Case 1: Low Assessment Performance (Average Score < 60%)
  // Acknowledge the difficulty respectfully and encourage reviewing core concepts.
  // -------------------------------------------------------------------------
  if (avgScore !== null && avgScore < 60) {
    const isVeryLow = avgScore < 40;
    const topConcept = exampleConcepts.length > 0 ? exampleConcepts[0] : null;

    let cycle1: string;
    let cycle2: string;
    let category: PersonaObservationCategory = 'low-performance';

    if (improvement) {
      category = 'improved-progress';
      cycle1 = isVeryLow
        ? 'Recent assessments proved challenging, though your latest score showed upward progress.'
        : "You're establishing a foundation, and your latest assessment showed measurable improvement.";

      cycle2 = improvement.sameGraph
        ? `Your latest test in ${improvement.graphName} improved to ${improvement.latestScore}%, up from ${improvement.previousScore}%.`
        : `Your latest score rose to ${improvement.latestScore}%, up from ${improvement.previousScore}%. Focusing on ${topConcept || 'key concepts'} will help keep this momentum.`;
    } else {
      cycle1 = isVeryLow
        ? 'Recent assessments proved challenging. Taking a step back to review the fundamentals will help.'
        : "You're establishing a foundation, though recent tests show several areas that need review.";

      if (topConcept) {
        cycle2 = `Focusing on ${topConcept} is a great place to start clarifying your understanding.`;
      } else if (needsRevisionCount > 0) {
        cycle2 = 'Reviewing the concepts flagged for attention will help clarify the tricky areas.';
      } else if (isRevisionUnfinished && activeRev) {
        cycle2 = `Resuming your revision in ${activeRev.graphName} will help work through the difficult material.`;
      } else if (recentGraph) {
        cycle2 = `Revisiting the concept relationships in ${recentGraph.graphName} will help strengthen your foundation.`;
      } else {
        cycle2 = 'Working through the concepts in your graph will help build steady confidence.';
      }
    }

    return {
      cycle1,
      cycle2,
      category,
      metadata: {
        score: avgScore,
        improved: Boolean(improvement),
        previousScore: improvement?.previousScore,
        latestScore: improvement?.latestScore,
        conceptName: topConcept ?? undefined,
        graphName: activeRev?.graphName || improvement?.graphName || recentGraph?.graphName,
        remainingConcepts: remainingRevisionConcepts
      }
    };
  }

  // -------------------------------------------------------------------------
  // Case 2: Strong Assessment Performance (Average Score >= 80%)
  // Acknowledge the strong result quietly and with dignity, avoiding exaggeration.
  // -------------------------------------------------------------------------
  if (avgScore !== null && avgScore >= 80) {
    const cycle1 = `Strong grasp demonstrated across assessments, averaging ${avgScore}%.`;

    let cycle2: string;
    let category: PersonaObservationCategory = 'strong-performance';
    if (improvement) {
      category = 'improved-progress';
      cycle2 = improvement.sameGraph
        ? `Your latest assessment in ${improvement.graphName} improved to ${improvement.latestScore}%, up from ${improvement.previousScore}%.`
        : `Your latest test showed measurable improvement, rising from ${improvement.previousScore}% to ${improvement.latestScore}%.`;
    } else if (isRevisionUnfinished && activeRev) {
      cycle2 = `You still have an open revision session in ${activeRev.graphName} if you want to complete it.`;
    } else if (exampleConcepts.length > 0) {
      cycle2 = `Even with strong results, a quick pass over ${exampleConcepts[0]} can help maintain mastery.`;
    } else {
      cycle2 = 'Consistent understanding shown in your tests. Keep building from this foundation.';
    }

    return {
      cycle1,
      cycle2,
      category,
      metadata: {
        score: avgScore,
        improved: Boolean(improvement),
        previousScore: improvement?.previousScore,
        latestScore: improvement?.latestScore,
        conceptName: exampleConcepts[0],
        graphName: activeRev?.graphName || improvement?.graphName
      }
    };
  }

  // -------------------------------------------------------------------------
  // Case 3: Steady / Moderate Assessment Performance (60% <= Average Score < 80%)
  // Acknowledge solid progress and guide toward next level of understanding.
  // -------------------------------------------------------------------------
  if (avgScore !== null && avgScore >= 60 && avgScore < 80) {
    const cycle1 = `Steady progress across your assessments, averaging ${avgScore}%.`;

    let cycle2: string;
    let category: PersonaObservationCategory = 'steady-performance';
    if (improvement) {
      category = 'improved-progress';
      cycle2 = improvement.sameGraph
        ? `Your latest assessment in ${improvement.graphName} showed improvement, reaching ${improvement.latestScore}%.`
        : `Your latest test showed solid improvement, rising from ${improvement.previousScore}% to ${improvement.latestScore}%.`;
    } else if (exampleConcepts.length > 0) {
      cycle2 = `Reviewing ${exampleConcepts[0]} would be a great next step to push your score higher.`;
    } else if (isRevisionUnfinished && activeRev) {
      cycle2 = `Your revision session in ${activeRev.graphName} is ready to resume whenever you'd like.`;
    } else {
      cycle2 = "You're gaining confidence with these concepts. Keep developing your understanding.";
    }

    return {
      cycle1,
      cycle2,
      category,
      metadata: {
        score: avgScore,
        improved: Boolean(improvement),
        previousScore: improvement?.previousScore,
        latestScore: improvement?.latestScore,
        conceptName: exampleConcepts[0],
        graphName: activeRev?.graphName || improvement?.graphName
      }
    };
  }

  // -------------------------------------------------------------------------
  // Case 4: No Completed Assessments Yet (avgScore === null)
  // Derived strictly from graph creation, revision sessions, or concept progress.
  // -------------------------------------------------------------------------
  if (isRevisionUnfinished && activeRev) {
    // Unfinished revision session takes precedence when no test scores exist
    const cycle1 = remainingRevisionConcepts === 1
      ? `You have an active revision session in ${activeRev.graphName} with 1 concept left to review.`
      : `You have an active revision session in ${activeRev.graphName} with ${remainingRevisionConcepts} concepts remaining.`;
    const cycle2 = `You can resume your revision in ${activeRev.graphName} whenever you're ready to continue.`;

    return {
      cycle1,
      cycle2,
      category: 'unfinished-revision',
      metadata: {
        graphName: activeRev.graphName,
        remainingConcepts: remainingRevisionConcepts
      }
    };
  }

  if (needsRevisionCount > 0) {
    // Concepts requiring attention when unassessed
    const topConcept = exampleConcepts.length > 0 ? exampleConcepts[0] : null;
    const cycle1 = needsRevisionCount === 1
      ? 'There is 1 concept flagged for review in your workspace.'
      : `There are ${needsRevisionCount} concepts flagged for review in your workspace.`;
    const cycle2 = topConcept
      ? `Focusing on ${topConcept} will help solidify your understanding.`
      : 'Reviewing these concepts in the revision workspace will build solid understanding.';

    return {
      cycle1,
      cycle2,
      category: 'concepts-needing-attention',
      metadata: {
        conceptName: topConcept ?? undefined
      }
    };
  }

  if (totalGraphs > 0) {
    // Knowledge graphs created but unassessed
    const graphName = recentGraph?.graphName;
    const cycle1 = totalGraphs === 1 && graphName
      ? `You've established your knowledge graph in ${graphName}.`
      : `You've created ${totalGraphs} knowledge graphs across GraphMind.`;

    const cycle2 = demonstratedPercentage > 0 && totalConcepts > 0
      ? `You've demonstrated understanding of ${demonstratedConcepts} of ${totalConcepts} concepts. Taking an assessment will test retention.`
      : 'Taking an assessment will help establish your baseline and identify focus areas.';

    return {
      cycle1,
      cycle2,
      category: 'unassessed-learning',
      metadata: {
        graphName
      }
    };
  }

  // Brand-new learner (0 graphs, 0 tests)
  return {
    cycle1: 'Welcome to your learning space. Creating your first graph will begin mapping your concepts.',
    cycle2: "Once you add study materials, I'll help highlight relationships and guide your review.",
    category: 'getting-started'
  };
}

/**
 * Convenience helper to retrieve the exact contextual observation for an active cycle (1 or 2).
 */
export function getContextualObservationForCycle(
  stats: PersonaStatsData | null,
  cycle: 1 | 2
): string | null {
  const obs = getContextualObservations(stats);
  return cycle === 1 ? obs.cycle1 : obs.cycle2;
}
