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
