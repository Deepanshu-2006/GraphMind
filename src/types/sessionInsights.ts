/**
 * GraphMind Revision Session Insights Data Model (Phase 3 — Prompt 13)
 * 
 * Provides a structured, evidence-grounded summary of revision activity
 * when a student completes or pauses a revision session.
 */

import type { ConceptMasteryStatus } from './mastery';

export interface ConceptInsightItem {
  conceptId: string;
  conceptName: string;
  conceptIndex: number;
  masteryStatus: ConceptMasteryStatus;
  masteryLabel: string;
  wasVisited: boolean;
  wasAssessed: boolean;
  questionAttemptsCount: number;
  correctAttemptsCount: number;
  hasUncertainEvaluation?: boolean;
  evidenceNote: string;
  isMarkedForReview?: boolean;
}

export type SessionNextActionType =
  | 'review-difficult'
  | 'continue-sequence'
  | 'return-graph'
  | 'finish-session'
  | 'resume-current';

export interface SessionNextAction {
  id: string;
  type: SessionNextActionType;
  label: string;
  description: string;
  conceptId?: string;
  conceptIndex?: number;
  isPrimary?: boolean;
}

export interface RevisionSessionInsights {
  graphId: string;
  graphName: string;
  sessionStartedAt?: string;
  sessionEndedAt?: string;
  isCompleted: boolean; // True if every concept in the planned revision path was visited
  totalSessionConcepts: number;
  visitedCount: number;
  assessedCount: number;
  demonstratedCount: number;
  needsReviewCount: number;
  unassessedVisitedCount: number;
  unvisitedCount: number;
  reviewedConcepts: ConceptInsightItem[];
  demonstratedConcepts: ConceptInsightItem[];
  revisitConcepts: ConceptInsightItem[];
  unvisitedConcepts: ConceptInsightItem[];
  nextActions: SessionNextAction[];
  notes?: string[];
}
