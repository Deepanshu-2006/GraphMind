/**
 * Prerequisite-Aware Learning Data Models
 * GraphMind Phase 4 — Prompt 17
 */

import type { ConceptMasterySummary } from './mastery';

export type PrerequisiteCategory =
  | 'confirmed-prerequisite'
  | 'source-foundation'
  | 'related-concept';

export type PrerequisiteEvidenceStatus =
  | 'needs-review'
  | 'observed-difficulty'
  | 'not-assessed'
  | 'demonstrated';

export interface FoundationalConceptRecommendation {
  conceptId: string;
  conceptName: string;
  category: PrerequisiteCategory | string;
  description?: string;
  prerequisiteCategory: PrerequisiteCategory;
  categoryLabel: string;
  provenance?: 'explicit-node-prerequisite' | 'graph-relationship-edge' | 'source-foundation-node' | string;
  relationshipType?: string;
  relationshipDescription?: string;
  direction: 'incoming' | 'outgoing';
  evidenceStatus: PrerequisiteEvidenceStatus;
  evidenceStatusLabel: string;
  whyItHelps: string;
  isInCurrentSession: boolean;
  sessionIndex?: number;
  masteryState?: ConceptMasterySummary | null;
}

export interface ConceptFoundationsReport {
  conceptId: string;
  conceptName: string;
  hasFoundations: boolean;
  summaryText?: string;
  items: FoundationalConceptRecommendation[];
  confirmedPrerequisitesCount: number;
  sourceFoundationsCount: number;
  relatedConceptsCount: number;
  reviewRecommendedCount: number;
  unassessedCount: number;
  demonstratedCount: number;
}

export interface FoundationalExcursionState {
  originConceptId: string;
  originConceptName: string;
  originIndex: number;
  foundationalConceptId: string;
  foundationalConceptName: string;
}
