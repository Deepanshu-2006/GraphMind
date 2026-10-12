/**
 * GraphMind Deep Revision Explanation Data Model (Phase 2 — Task 05)
 * 
 * Represents a rich, source-grounded concept explanation designed for
 * deep comprehension rather than rote definition memorization.
 */

export interface KeyTerminologyItem {
  term: string;
  definition: string;
  context?: string;
}

export interface ExplanationSourceReference {
  sourceId: string;
  sourceTitle: string;
  page?: number;
  chunkId?: string;
  excerpt: string;
}

export interface RelatedConceptReference {
  conceptId?: string;
  conceptName: string;
  relationshipType: string;
  context: string;
}

export interface ConceptExplanation {
  graphId: string;
  conceptId: string;
  conceptName: string;
  category?: string;

  // 1. Core Explanation Structure (Section 2)
  overview: string;
  detailedExplanation: string[];
  keyTerminology?: KeyTerminologyItem[];
  importantPoints?: string[];
  examples?: string[];
  relatedConceptReferences?: RelatedConceptReference[];
  sourceReferences: ExplanationSourceReference[];

  // 2. Grounding Metadata & Integrity Verification (Section 3)
  isSourceGrounded: boolean;
  groundingConfidence: 'high' | 'moderate' | 'limited';
  limitations?: string;
  generatedAt: string;
}

export type ExplanationStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'insufficient'
  | 'empty'
  | 'error';

export interface ExplanationState {
  status: ExplanationStatus;
  explanation?: ConceptExplanation | null;
  errorMessage?: string;
  insufficientReason?: string;
  conceptId?: string;
  graphId?: string;
}
