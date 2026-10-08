/**
 * GraphMind Academic Test Experience Data Model
 * 
 * Flow:
 * KNOWLEDGE GRAPH / SOURCES → TEST GENERATION → TIMED MCQ TEST WORKSPACE → RESULTS & REVIEW → GRAPH REVISION
 */

export type TestQuestionType = 'concept' | 'relationship' | 'application' | 'comparison';

export interface TestOption {
  id: string; // '01', '02', '03', '04'
  text: string;
}

export interface TestQuestion {
  id: string;
  type: TestQuestionType;
  question: string;
  options: TestOption[]; // Exactly 4 options
  correctOptionId: string;
  explanation: string;
  conceptIds: string[];
  conceptNames: string[];
  relationshipIds?: string[];
  sourceIds: string[];
  sourceChunkIds?: string[];
  sourceEvidence?: string;
  sourceName?: string;
  page?: number;
}

export interface KnowledgeTest {
  id: string;
  graphId: string;
  title: string;
  questions: TestQuestion[];
  timeLimitSeconds: number; // default 600 (10 minutes)
  startedAt: string;
  submittedAt?: string;
  answers: Record<string, string>; // questionId -> selectedOptionId
  flaggedQuestionIds: string[];
  score?: number;
  timeSpentSeconds?: number;
}

export interface TestGenerationResult {
  success: boolean;
  test?: KnowledgeTest;
  reason?: 'insufficient_material' | 'no_graph';
  message?: string;
  conceptsCovered?: string[];
}

export interface MissedConceptItem {
  conceptId: string;
  conceptName: string;
  questionId: string;
  questionText: string;
  selectedOptionText: string;
  correctOptionText: string;
  explanation: string;
  sourceName?: string;
  sourceEvidence?: string;
  page?: number;
}

export interface TestResultsSummary {
  testId: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  timeSpentSeconds: number;
  strongConceptNames: string[];
  reviewRecommendedConcepts: MissedConceptItem[];
}
