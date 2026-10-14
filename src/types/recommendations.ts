/**
 * GraphMind Personalized Revision Recommendations Data Models
 * Phase 4 — Prompt 18
 * 
 * Provides evidence-grounded recommendation types:
 * - Categories: continue-learning, review-difficulty, review-foundation, practice-concept, explore-connection, start-new
 * - Deterministic Priority: transparent ranking with contextual adaptation
 * - Explain Why: concise, factual explanations grounded in actual learning records
 * - Functional Actions: resume, review, foundation, practice, explore, start
 */

export type RecommendationCategory =
  | 'continue-learning'
  | 'review-difficulty'
  | 'review-foundation'
  | 'practice-concept'
  | 'explore-connection'
  | 'start-new';

export type RecommendationActionType =
  | 'continue-revision'
  | 'review-concept'
  | 'open-foundation'
  | 'practice-concept'
  | 'explore-graph'
  | 'start-concept';

export type RecommendationPriorityLabel =
  | 'urgent'
  | 'high'
  | 'recommended'
  | 'suggested'
  | 'exploratory'
  | 'introductory';

export interface RevisionRecommendationItem {
  id: string;
  category: RecommendationCategory;
  categoryLabel: string;
  priority: number; // 1 (highest) to 6 (lowest)
  priorityLabel: RecommendationPriorityLabel;
  conceptId: string;
  conceptName: string;
  targetConceptId?: string; // Optional related or struggling concept ID
  targetConceptName?: string;
  
  // Transparent "Explain Why" - grounded in actual evidence
  explanation: string;
  evidenceSnippet?: string;
  evidenceCount?: number;

  // Clear, functional action
  actionType: RecommendationActionType;
  actionLabel: string;
  actionDescription: string;
  targetSectionId?: string;

  // Graph relationship metadata (when applicable)
  relationshipType?: string;
  relationshipDescription?: string;

  isPrimary?: boolean;
  dismissedAt?: string;
  deferredUntil?: string;
}

export interface RecommendationPreferences {
  dismissedIds: string[];
  deferredMap: Record<string, string>; // recommendationId -> ISO expiry string
}

export interface RevisionRecommendationsReport {
  graphId: string;
  graphName: string;
  hasActiveRecommendations: boolean;
  primaryRecommendation: RevisionRecommendationItem | null;
  secondaryRecommendations: RevisionRecommendationItem[];
  allRecommendations: RevisionRecommendationItem[];
  dismissedCount: number;
  totalCount: number;
  generatedAt: string;
}
