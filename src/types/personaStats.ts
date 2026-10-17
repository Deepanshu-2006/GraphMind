/**
 * GraphMind Persona — Statistics Data Model
 * 
 * Defines the typed structures for the Persona learning statistics dashboard:
 * - Activity Statistics (left panel data): total graphs, recent graph activity, concepts, demonstrated mastery.
 * - Performance Statistics (right panel data): assessment attempts, recent scores, average score, revision progress, concepts needing review.
 * - Strict adherence to actual persisted data: no hardcoded metrics, no fake retention, no streaks.
 */

export interface RecentGraphActivity {
  graphId: string;
  graphName: string;
  updatedAt: string;
  createdAt: string;
  totalConcepts: number;
}

export interface PersonaActivityStats {
  /** Total number of knowledge graphs created by the user */
  totalGraphs: number;
  /** Most recently updated graph and activity, or null if no graphs exist */
  recentGraph: RecentGraphActivity | null;
  /** Up to 3 most recently updated graphs, newest first */
  recentGraphs: RecentGraphActivity[];
  /** Total concepts aggregated across all user knowledge graphs */
  totalConcepts: number;
  /** Count of concepts with demonstrated understanding across user graphs */
  demonstratedConcepts: number;
  /** Overall demonstrated-understanding percentage (0–100) */
  demonstratedPercentage: number;
}

export interface PersonaRecentAssessment {
  /** Unique historical attempt ID */
  id: string;
  /** Test identifier */
  testId: string;
  /** Associated knowledge graph ID */
  graphId: string;
  /** Name of the knowledge graph at the time of the test */
  graphName: string;
  /** Final score percentage (0–100 integer) */
  scorePercentage: number;
  /** Number of correctly answered questions */
  correctAnswers: number;
  /** Total number of questions on the assessment */
  totalQuestions: number;
  /** ISO 8601 completion timestamp */
  completedAt: string;
  /** Time spent on assessment in seconds */
  timeSpentSeconds: number;
}

export interface PersonaRevisionProgress {
  /** Knowledge graph ID of the active session */
  graphId: string;
  /** Name of the knowledge graph */
  graphName: string;
  /** Number of concepts reviewed so far in the active session */
  reviewedCount: number;
  /** Total concepts in the revision path */
  totalConcepts: number;
  /** Session completion progress (0–100 integer) */
  progressPercent: number;
  /** Name of the current concept in the revision path, if available */
  currentConceptName?: string | null;
}

export interface PersonaPerformanceStats {
  /** Total number of completed assessment attempts */
  totalAssessmentAttempts: number;
  /** Most recent completed assessment attempts (capped at 3, newest first) */
  recentAssessments: PersonaRecentAssessment[];
  /** Average score percentage across completed attempts, or null if no attempts exist */
  averageScore: number | null;
  /** Active revision session progress, or null if no active session exists */
  activeRevisionProgress: PersonaRevisionProgress | null;
  /** Total number of unique concepts requiring revision across user graphs */
  conceptsNeedingRevisionCount: number;
  /** Up to 2 example concept names currently needing revision */
  conceptsNeedingRevisionExamples: string[];
}

export interface PersonaStatsData {
  /** Learning activity and graph creation statistics (Left Panel) */
  activity: PersonaActivityStats;
  /** Assessment scores and revision performance statistics (Right Panel) */
  performance: PersonaPerformanceStats;
  /** Currently authenticated user ID */
  userId: string | null;
  /** Display name of the user */
  userName: string | null;
}

export interface UsePersonaStatsReturn {
  /** Aggregated Persona statistics, or null while loading */
  stats: PersonaStatsData | null;
  /** True while initial statistics are loading */
  isLoading: boolean;
  /** Error message if loading or calculating statistics failed */
  error: string | null;
  /** Function to manually trigger an immediate re-read and calculation */
  refresh: () => void;
}
