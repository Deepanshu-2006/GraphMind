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
  attemptId?: string;
  persistenceStatus?: 'saved' | 'failed';
  persistenceError?: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  timeSpentSeconds: number;
  strongConceptNames: string[];
  reviewRecommendedConcepts: MissedConceptItem[];
}

/**
 * Completion reason signaling whether the attempt was submitted manually or auto-submitted on timer expiration
 */
export type AssessmentCompletionReason = 'submission' | 'time_expired';

/**
 * Persistent historical assessment attempt record.
 * Frozen snapshot that preserves exact questions, options, user answers, correct answers,
 * explanations, and score independently of subsequent graph mutations.
 */
export interface AssessmentAttempt {
  id: string; // Unique attempt ID e.g. "attempt-graph-123-1728512345678-abc12"
  testId: string; // Reference to original generated test ID
  userId?: string | null; // User ID when authentication is available
  graphId: string; // Target knowledge graph ID
  graphName: string; // Snapshot of graph title at time of attempt
  createdAt: string; // ISO timestamp when test was started
  completedAt: string; // ISO timestamp when test was submitted
  totalQuestions: number;
  correctAnswers: number;
  scorePercentage: number; // 0–100 integer
  timeSpentSeconds: number;
  questions: TestQuestion[]; // Deep immutable snapshot of questions and choices
  userAnswers: Record<string, string>; // Recorded user answers; unanswered questions are absent
  conceptIds: string[]; // Aggregated unique concept IDs covered
  conceptNames: string[]; // Aggregated concept names covered
  sourceIds: string[]; // Aggregated source IDs referenced
  completionReason: AssessmentCompletionReason; // 'submission' | 'time_expired'
  resultsSummary: TestResultsSummary; // Calculated results summary
}
