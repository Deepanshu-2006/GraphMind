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

export interface KeyComponentItem {
  name: string;
  description: string;
  role?: string;
}

export interface ExplanationTableData {
  caption?: string;
  headers: string[];
  rows: string[][];
}

export interface ExplanationCodeSnippet {
  language: string;
  code: string;
  caption?: string;
}

export interface ConceptExplanation {
  graphId: string;
  conceptId: string;
  conceptName: string;
  category?: string;

  // 1. Structured Learning Sections (Task 06)
  // Section 01: Understand the concept
  overview: string;
  detailedExplanation?: string[];

  // Section 02: How it works (operational mechanism & code)
  howItWorks?: string[];
  codeSnippet?: ExplanationCodeSnippet;

  // Section 03: Key components / terminology / comparison tables
  keyComponents?: KeyComponentItem[];
  keyTerminology?: KeyTerminologyItem[];
  comparisonTable?: ExplanationTableData;

  // Section 04: Important details / key points
  importantDetails?: string[];
  importantPoints?: string[];

  // Section 05: Concrete examples (when supported)
  examples?: string[];

  // Section 06: Related concepts
  relatedConceptReferences?: RelatedConceptReference[];

  // Section 07: Source references
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
