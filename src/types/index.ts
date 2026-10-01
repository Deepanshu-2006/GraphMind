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
  code: string;
  domain: string;
  activeNodes: number;
  density: string;
  lastUpdated: string;
}

export type SourceStatus = 'Ready' | 'Processing' | 'Failed' | 'Indexed' | 'synced' | 'indexing';

export interface RecentMaterial {
  id: string;
  title: string;
  format: 'PDF' | 'TXT' | 'MD' | 'TRANSCRIPT' | 'ARXIV' | 'NOTE' | string;
  size: string;
  conceptsExtracted?: number;
  timestamp: string;
  status: 'Ready' | 'Processing' | 'Failed' | 'Indexed' | 'synced' | 'indexing' | string;
}

export interface LearningPath {
  id: string;
  title: string;
  progress: number;
  nodeCount: number;
  estimatedHours: string;
  status: string;
}

