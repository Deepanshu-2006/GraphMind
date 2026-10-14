/**
 * GraphMind Unified Learning Overview Types
 * Phase 4 — Prompt 19
 * 
 * Aggregates:
 * - Learning progress: demonstrated, needs review, in-progress, not started
 * - Distinguishes mere activity from demonstrated understanding
 * - Unfinished revision sessions
 * - Recommended next action (from revisionRecommendations engine)
 * - Grounded concepts needing attention (knowledge gaps & repeated difficulty)
 * - Empty & partial states: new users, no assessments, no gaps, inconclusive
 */

import type { ConceptMasteryStatus } from './mastery';
import type { RevisionRecommendationItem, RecommendationActionType } from './recommendations';

export interface ConceptAttentionItem {
  conceptId: string;
  conceptName: string;
  status: ConceptMasteryStatus;
  statusLabel: string;
  reason: string;
  evidenceSnippet?: string;
  isPrerequisiteIssue?: boolean;
  prerequisiteName?: string;
  actionLabel: string;
  actionType: RecommendationActionType;
  actionDescription: string;
}

export interface UnfinishedSessionOverview {
  currentConceptId: string;
  currentConceptName: string;
  currentIndex: number;
  totalConcepts: number;
  reviewedConceptsCount: number;
  remainingCount: number;
  progressPercent: number;
}

export interface UnifiedLearningOverviewData {
  graphId: string;
  graphName: string;
  totalConcepts: number;
  demonstratedCount: number;
  needsReviewCount: number;
  inProgressCount: number;
  notStartedCount: number;
  activityCount: number; // inProgress + needsReview + demonstrated (concepts touched)
  demonstratedPercentage: number; // percentage of total concepts demonstrated

  // Recently studied concept or graph timestamp
  lastStudiedAt?: string | null;
  lastStudiedConceptName?: string | null;

  // Unfinished revision session
  hasUnfinishedSession: boolean;
  unfinishedSession?: UnfinishedSessionOverview | null;

  // Top recommended next action & secondary actions
  primaryRecommendation: RevisionRecommendationItem | null;
  secondaryRecommendations: RevisionRecommendationItem[];

  // Concepts needing attention (grounded difficulties and gaps)
  conceptsNeedingAttention: ConceptAttentionItem[];

  // State flags for adaptive editorial rendering
  isNewUser: boolean; // no activity anywhere
  hasZeroAssessments: boolean;
  hasZeroRevisionActivity: boolean;
  hasAllDemonstrated: boolean; // all concepts in graph demonstrated
  isInconclusive: boolean; // some activity but 0 demonstrated and 0 difficulty
}
