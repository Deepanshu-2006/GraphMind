/**
 * GraphMind Concept Mastery Tracking Data Model (Phase 3 — Prompt 12)
 * 
 * Tracks concept-level mastery grounded strictly in recorded learning evidence.
 * 
 * Four explicit states:
 * 1. 'not-started': No recorded revision or formative check activity.
 * 2. 'in-progress': Revision activity exists (reading/study or uncertain attempt), but evidence is insufficient.
 * 3. 'needs-review': Recorded responses indicate difficulty, repeated errors, or marked for review.
 * 4. 'understanding-demonstrated': Student has met the defined, evidence-based threshold on formative checks.
 */

import type { PracticeStatus } from './practice';

export type ConceptMasteryStatus =
  | 'not-started'
  | 'in-progress'
  | 'needs-review'
  | 'understanding-demonstrated';

export interface ConceptMasterySummary {
  conceptId: string;
  conceptName: string;
  status: ConceptMasteryStatus;
  statusLabel: string; // e.g. "Not started", "In progress", "Needs review", "Understanding demonstrated"
  attemptCount: number;
  correctCount: number;
  incorrectCount: number;
  consecutiveIncorrectCount: number;
  lastAttemptAt?: string;
  lastAttemptCorrect?: boolean;
  isUncertain?: boolean;
  studiedAt?: string;
  evidenceSource: 'knowledge-check' | 'session-study' | 'legacy-practice' | 'none';
  explanationSummary?: string;
}

export interface GraphMasteryOverview {
  graphId: string;
  totalConcepts: number;
  notStartedCount: number;
  inProgressCount: number;
  needsReviewCount: number;
  understandingDemonstratedCount: number;
  concepts: Record<string, ConceptMasterySummary>;
  needsReviewConceptIds: string[];
}

/**
 * Maps between ConceptMasteryStatus and legacy PracticeStatus for backward compatibility.
 */
export function masteryStatusToPracticeStatus(status: ConceptMasteryStatus): PracticeStatus {
  switch (status) {
    case 'not-started':
      return 'unseen';
    case 'in-progress':
      return 'learning';
    case 'needs-review':
      return 'needs-review';
    case 'understanding-demonstrated':
      return 'understood';
    default:
      return 'unseen';
  }
}

export function practiceStatusToMasteryStatus(status?: PracticeStatus): ConceptMasteryStatus {
  switch (status) {
    case 'unseen':
      return 'not-started';
    case 'learning':
      return 'in-progress';
    case 'needs-review':
      return 'needs-review';
    case 'understood':
      return 'understanding-demonstrated';
    default:
      return 'not-started';
  }
}
