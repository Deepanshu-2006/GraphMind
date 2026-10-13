/**
 * GraphMind Interactive Knowledge Checks Data Model (Phase 3 — Prompt 10)
 * 
 * Provides interactive, source-grounded formative assessments embedded
 * directly within the Deep Revision Workspace to help students test
 * their understanding of the concept they just studied.
 */

export type KnowledgeCheckQuestionType =
  | 'multiple-choice'
  | 'short-answer'
  | 'conceptual-reasoning';

export interface KnowledgeCheckOption {
  id: string; // e.g., 'opt-01', 'opt-02', 'opt-03', 'opt-04'
  text: string;
}

export interface KnowledgeCheckQuestion {
  id: string;
  graphId: string;
  conceptId: string;
  conceptName: string;
  type: KnowledgeCheckQuestionType;
  prompt: string;
  options?: KnowledgeCheckOption[]; // For multiple-choice and option-based conceptual reasoning
  correctOptionId?: string; // ID of the correct option
  correctAnswer: string; // Canonical text of the correct answer
  acceptableAnswers?: string[]; // Alternative valid wordings / synonyms for short-answer
  keyTerms?: string[]; // Essential concept terms for semantic overlap evaluation
  explanation: string; // Source-grounded rationale for why the answer is correct
  misconceptions?: Record<string, string>; // Explanations for why specific distractors are incorrect
  sourcePassage?: string; // Verified excerpt from the learning material supporting this question
  sourceTitle?: string; // Document title
  page?: number;
  sectionId?: string; // Revision section anchor to jump back to (e.g., 'section-how-it-works')
  sectionTitle?: string; // Display title of the section (e.g., 'How it works')
}

export interface KnowledgeCheckEvaluation {
  isCorrect: boolean;
  score: number; // 1 for full credit, 0.8 for partial match, 0 for incorrect
  evaluationConfidence: 'high' | 'moderate' | 'uncertain';
  feedback: string;
  matchedKeyTerms?: string[];
  explanation: string;
  misconceptionGuidance?: string;
  correctAnswer: string;
  reviewSectionId?: string;
  reviewSectionTitle?: string;
}

export interface KnowledgeCheckAttempt {
  questionId: string;
  submittedAnswer: string;
  evaluation: KnowledgeCheckEvaluation;
  attemptedAt: string;
}

export interface ConceptKnowledgeCheckState {
  graphId: string;
  conceptId: string;
  status: 'idle' | 'loading' | 'ready' | 'insufficient' | 'error';
  insufficientReason?: string;
  errorMessage?: string;
  questions: KnowledgeCheckQuestion[];
  activeQuestionIndex: number;
  attempts: Record<string, KnowledgeCheckAttempt>; // questionId -> KnowledgeCheckAttempt
  updatedAt: string;
}
