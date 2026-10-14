/**
 * GraphMind Adaptive Revision Flow Data Model (Phase 3 — Prompt 11)
 * 
 * Provides adaptive revision recommendations grounded strictly in
 * actual student activity, knowledge-check performance, and knowledge graph structure.
 * 
 * Never infers mastery from reading time alone or mere concept visits.
 * Preserves the student's control by keeping the original revision order stable.
 */

import type { ConceptExplanation } from './explanation';
import type { KnowledgeGraph } from './knowledgeGraph';
import type { RevisionSessionState } from './practice';

/**
 * Observable concept performance status grounded strictly in student activity and evidence.
 * 
 * - 'not-studied': Concept in session has not been studied or visited yet.
 * - 'studied-unassessed': Explanation was read/visited, but no formative check attempted.
 * - 'needs-review': Formative check attempted with incorrect answer or repeated errors.
 * - 'showing-understanding': Answered correctly on recent formative check attempt.
 * - 'demonstrated-understanding': Answered correctly across multiple attempts or verified retries.
 */
export type ConceptPerformanceStatus =
  | 'not-studied'
  | 'studied-unassessed'
  | 'needs-review'
  | 'showing-understanding'
  | 'demonstrated-understanding';

export interface ConceptPerformanceState {
  conceptId: string;
  conceptName: string;
  status: ConceptPerformanceStatus;
  attemptCount: number;
  correctCount: number;
  incorrectCount: number;
  consecutiveIncorrectCount: number;
  lastAttemptCorrect?: boolean;
  isUncertain?: boolean;
  lastAttemptAt?: string;
  misconceptionGuidance?: string;
  reviewSectionId?: string;
  reviewSectionTitle?: string;
}

export type AdaptiveActionType =
  | 'continue-planned-path'
  | 'review-explanation-section'
  | 'review-worked-example'
  | 'retry-knowledge-check'
  | 'explore-prerequisite-concept'
  | 'explore-related-concept';

export interface AdaptiveAction {
  id: string;
  label: string;
  type: AdaptiveActionType;
  isPrimary: boolean;
  targetSectionId?: string;
  targetConceptId?: string;
  targetConceptName?: string;
  targetIndex?: number;
  description?: string;
}

export interface AdaptiveRecommendation {
  graphId: string;
  conceptId: string;
  conceptName: string;
  performanceState: ConceptPerformanceState;
  rationale: string;
  primaryAction: AdaptiveAction;
  secondaryActions: AdaptiveAction[];
  fallbackToSequence: boolean;
  generatedAt: string;
}

export interface GenerateAdaptiveRecommendationParams {
  graphId: string;
  currentConceptId: string;
  currentConceptName: string;
  performance: ConceptPerformanceState;
  explanation?: ConceptExplanation | null;
  graph?: KnowledgeGraph | null;
  session?: RevisionSessionState | null;
  allGraphConcepts?: Array<{ id: string; name: string }>;
}
