import type { ConceptRelationship } from './graph';

export type PracticeStatus = 'unseen' | 'learning' | 'needs-review' | 'understood';

export interface ConceptPracticeState {
  conceptId: string;
  status: PracticeStatus;
  lastPracticedAt?: string;
  practiceCount?: number;
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
