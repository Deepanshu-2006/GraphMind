import type { KnowledgeNode } from './knowledgeGraph';
export * from './graph';

export interface Concept {
  id: string;
  name: string;
  category?: string;
  description?: string;
  sourceEvidence?: string;
  sourceIds?: string[];
  sourceChunkIds?: string[];
  isCore?: boolean;
  label?: string;
}

export interface Relationship {
  id: string;
  sourceId?: string;
  targetId?: string;
  source?: string;
  target?: string;
  type?: string;
  predicate?: string;
  label?: string;
  description?: string;
  sourceEvidence?: string;
  sourceIds?: string[];
  sourceChunkIds?: string[];
}

export type NavSection = 'overview' | 'graph' | 'paths' | 'sources' | 'settings';

export interface ConceptConnection {
  targetId: string;
  targetName: string;
  relationType: 'generalizes' | 'powers' | 'utilizes' | 'hierarchical' | 'synthesizes';
  strength: number; // 0 to 1
}

export interface ConceptNode {
  id: string;
  name: string;
  code: string;
  category: 'Foundation' | 'Architecture' | 'Technique' | 'Application' | 'Paradigm';
  depth: number;
  synapseCount: number;
  summary: string;
  connections: ConceptConnection[];
  x: number; // coordinate for visual graph canvas (0-100%)
  y: number;
  size: number;
  accentColor: string;
  status: 'synapsed' | 'active' | 'referenced';
  documentsSourceCount: number;
}

export interface MetricItem {
  id: string;
  label: string;
  value: string;
  numericalValue: number;
  unit?: string;
  delta: string;
  deltaDirection: 'up' | 'stable' | 'down';
  subtitle: string;
  telemetryCode?: string;
}

export interface ProjectWorkspace {
  id: string;
  name: string;
  code?: string;
  domain?: string;
  description?: string;
  activeNodes: number;
  density: string;
  lastUpdated: string;
  createdAt?: string;
  updatedAt?: string;
}

export type SourceStatus = 'Ready' | 'Processing' | 'Failed' | 'Indexed' | 'synced' | 'indexing';

export interface RecentMaterial {
  id: string;
  graphId?: string;
  title: string;
  name?: string;
  fileName?: string;
  format: 'PDF' | 'TXT' | 'MD' | 'TRANSCRIPT' | 'ARXIV' | 'NOTE' | string;
  size: string;
  sizeBytes?: number;
  mimeType?: string;
  conceptsExtracted?: number;
  conceptIds?: string[];
  timestamp: string;
  createdAt?: string | number;
  status: 'Ready' | 'Processing' | 'Failed' | 'Indexed' | 'synced' | 'indexing' | string;
  error?: string;
}

export interface LearningPath {
  id: string;
  graphId?: string;
  title: string;
  conceptIds: string[];
  concepts: KnowledgeNode[];
  nodeCount: number;
  estimatedMinutes: number;
  estimatedHours: string;
  completedConceptIds: string[];
  progress: number;
  status: 'NOT STARTED' | 'IN PROGRESS' | 'COMPLETE' | string;
}

export * from './test';
