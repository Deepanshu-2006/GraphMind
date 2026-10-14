/**
 * GraphMind Knowledge Gap Detection Data Model (Phase 4 — Prompt 16)
 * 
 * Provides evidence-based knowledge-gap detection grounded strictly in the
 * student's actual revision activity, assessment attempts, concept mastery data,
 * and existing graph relationships.
 * 
 * Four explicit gap states:
 * 1. 'observed-difficulty': Recorded incorrect or unreliable responses associated with a concept.
 * 2. 'insufficient-evidence': Not enough assessment activity to judge understanding.
 * 3. 'potential-foundational-gap': Student struggles with a concept and there is evidence
 *    that a related foundational concept may also need attention.
 * 4. 'review-recommended': Sufficient evidence of difficulty to justify revisiting the concept.
 * 
 * Non-gap state:
 * - 'understanding-demonstrated': Formative/summative evidence shows verified correct understanding.
 */

export type KnowledgeGapState =
  | 'observed-difficulty'
  | 'insufficient-evidence'
  | 'potential-foundational-gap'
  | 'review-recommended'
  | 'understanding-demonstrated';

export type GapEvidenceSourceType =
  | 'formative-check'
  | 'summative-test'
  | 'uncertain-evaluation'
  | 'concept-mastery'
  | 'graph-prerequisite'
  | 'graph-relationship';

export interface KnowledgeGapEvidenceItem {
  id: string;
  sourceType: GapEvidenceSourceType;
  description: string;
  timestamp?: string;
  score?: number;
  questionId?: string;
  questionText?: string;
  attemptId?: string;
  details?: string;
}

export type GapActionType =
  | 'reopen-explanation'
  | 'review-worked-example'
  | 'retry-knowledge-check'
  | 'open-related-concept'
  | 'dismiss'
  | 'defer';

export interface KnowledgeGapAction {
  id: string;
  label: string;
  type: GapActionType;
  conceptId: string;
  conceptName: string;
  targetSectionId?: string;
  targetConceptId?: string;
  targetConceptName?: string;
  description?: string;
  isPrimary?: boolean;
}

export interface RelatedConceptGapInfo {
  conceptId: string;
  conceptName: string;
  relationshipType: string; // e.g. 'depends-on', 'foundation-for', 'prerequisite', 'related-to', 'uses'
  isPrerequisite: boolean; // true ONLY if explicitly declared in prerequisites or has foundation/depends-on edge
  relationshipLabel: string; // "Prerequisite foundation" vs "Related concept in graph"
  gapState: KnowledgeGapState;
  hasDifficulty: boolean;
  evidenceSummary: string;
}

export interface DetectedKnowledgeGap {
  conceptId: string;
  conceptName: string;
  category?: string;
  gapState: KnowledgeGapState;
  statusLabel: string; // e.g. "Observed difficulty", "Insufficient evidence", "Potential foundational gap", "Review recommended"
  reason: string;
  supportingEvidence: KnowledgeGapEvidenceItem[];
  recommendedAction: KnowledgeGapAction;
  secondaryActions: KnowledgeGapAction[];
  relatedConcepts: RelatedConceptGapInfo[];
  isDismissed: boolean;
  isDeferred: boolean;
  deferredUntil?: string;
  
  // Deterministic metrics behind the classification
  totalAssessedQuestions: number;
  correctAnswersCount: number;
  incorrectAnswersCount: number;
  consecutiveIncorrectCount: number;
  hasUncertainEvaluation: boolean;
  lastAssessedAt?: string;
  detectedAt: string;
}

export interface GraphKnowledgeGapsReport {
  graphId: string;
  graphName: string;
  generatedAt: string;
  totalConcepts: number;
  flaggedGapsCount: number; // Count of concepts with review-recommended, observed-difficulty, or potential-foundational-gap
  reviewRecommendedCount: number;
  observedDifficultyCount: number;
  potentialFoundationalCount: number;
  insufficientEvidenceCount: number;
  understandingDemonstratedCount: number;
  
  // Collections
  items: DetectedKnowledgeGap[]; // All concepts analyzed
  activeGaps: DetectedKnowledgeGap[]; // Only concepts with actionable gaps that are not dismissed or deferred
  dismissedCount: number;
  deferredCount: number;
}

export interface GapPreferences {
  dismissedConceptIds: string[];
  deferredMap: Record<string, string>; // conceptId -> ISO string expiration
}
