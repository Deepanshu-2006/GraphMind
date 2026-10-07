import type { ConceptRelationship } from './graph';

export type PracticeStatus = 'unseen' | 'learning' | 'needs-review' | 'understood';
export type KnowledgeStatus = PracticeStatus;

export interface ConceptPracticeState {
  conceptId: string;
  status: PracticeStatus;
  firstStudiedAt?: string;
  lastStudiedAt?: string;
  lastPracticedAt?: string;
  practiceCount?: number;
}

export type ConceptKnowledgeState = ConceptPracticeState;

export type StudyFilterMode = 'all' | 'needs-review' | 'in-progress' | 'studied';

/**
 * Returns lightweight internal review priority score (Section 11):
 * needs-review: 2, learning: 1, unseen: 0, understood: 0
 */
export function getConceptReviewPriority(status: PracticeStatus): number {
  switch (status) {
    case 'needs-review':
      return 2;
    case 'learning':
      return 1;
    case 'unseen':
    case 'understood':
    default:
      return 0;
  }
}


export type PracticeQuestionType =
  | 'multiple-choice'
  | 'short-answer'
  | 'true-false'
  | 'concept-relationship'
  | 'comparison'
  | 'numerical-procedural';

export interface PracticeQuestion {
  id: string;
  conceptId: string;
  conceptName: string;
  type: PracticeQuestionType;
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  passage?: string;
  sourceName?: string;
  page?: number;
  sourceIds?: string[];
  sourceChunkIds?: string[];
}

export interface QuestionGenerationContext {
  conceptId: string;
  conceptName: string;
  category?: string;
  description?: string;
  evidence?: string;
  keyIdeas?: string[];
  page?: number;
  sourceName?: string;
  sourceIds?: string[];
  sourceChunkIds?: string[];
  relationships?: ConceptRelationship[];
  neighborConcepts?: Array<{
    id: string;
    name: string;
    category?: string;
    description?: string;
  }>;
  allGraphConcepts?: Array<{
    id: string;
    name: string;
    category?: string;
    description?: string;
  }>;
}

/**
 * Phase 4: Active Recall Question Patterns
 */
export type ActiveRecallPattern =
  | 'definition'
  | 'explanation'
  | 'relationship'
  | 'connection'
  | 'concept-understanding'
  | 'fill-connection'
  | 'two-concept'
  | 'source-based';

export type ActiveRecallQuestionType =
  | 'concept-understanding'
  | 'relationship'
  | 'connection'
  | 'fill-connection'
  | 'two-concept'
  | 'source-based';

export interface ActiveRecallOption {
  id: string;
  label: string;
  isCorrect: boolean;
  conceptId?: string;
  conceptName?: string;
}

export interface ActiveRecallDiagram {
  sourceName: string;
  relationshipLabel: string;
  targetPlaceholder: string;
  targetMystery?: boolean;
}

export interface ActiveRecallQuestion {
  id: string;
  conceptId: string;
  conceptName: string;
  pattern: ActiveRecallPattern;
  question: string;
  answer: string;
  explanation?: string;
  sourceName?: string;
  page?: number;
  passage?: string;
  relatedConceptId?: string;
  relatedConceptName?: string;
  relationshipType?: string;
  relationshipDescription?: string;

  // Active Recall Test Mode Extensions
  questionType?: ActiveRecallQuestionType;
  conceptIds?: string[];
  relationshipIds?: string[];
  diagram?: ActiveRecallDiagram;
  options?: ActiveRecallOption[];
  correctOptionId?: string;
  sourceEvidence?: string;
  sourceIds?: string[];
  sourceChunkIds?: string[];
  concealedNodeId?: string;
  concealedEdgeId?: string;
  concealType?: 'node' | 'relationship-label' | 'description';
}

export type ActiveRecallPrompt = ActiveRecallQuestion;

export interface ActiveRecallTestAnswer {
  selectedOptionId: string;
  isCorrect: boolean;
  isRevealed: boolean;
  attempts: number;
}

export interface MissedConceptSummary {
  conceptId: string;
  conceptName: string;
  relationshipLabel?: string;
  sourceName?: string;
}

export interface ActiveRecallTestSession {
  focusConceptId?: string;
  questions: ActiveRecallQuestion[];
  currentIndex: number;
  answers: Record<string, ActiveRecallTestAnswer>;
  missedConcepts: MissedConceptSummary[];
  isCompleted: boolean;
}

/**
 * In-memory study session state for Active Recall (Phase 4 Section 12)
 */
export interface ActiveRecallSessionState {
  testedConceptIds: string[];
  recalledConceptIds: string[];
  reviewConceptIds: string[];
  currentConceptId: string | null;
}

/**
 * Phase 5: Revision Mode & Guided Graph Path Types
 */
export type RevisionReason =
  | 'marked-for-review'
  | 'connected-concept'
  | 'core-concept'
  | 'unreviewed'
  | 'review-again';

export interface RevisionPathStep {
  conceptId: string;
  conceptName: string;
  category?: string;
  reason: RevisionReason;
  connectedThroughConceptId?: string;
  relationshipType?: string;
  isCore?: boolean;
}

export interface RevisionSessionState {
  isActive: boolean;
  path: RevisionPathStep[];
  currentIndex: number;
  reviewedConceptIds: string[];
  markedForReviewIds: string[];
}


