export * from './knowledgeGraph';

export type ConceptCategory = 
  | 'Foundation' 
  | 'Paradigm' 
  | 'Architecture' 
  | 'Method' 
  | 'Application';

export type FilterCategory = 'ALL' | 'CONCEPTS' | 'PREREQUISITES' | 'APPLICATIONS' | 'METHODS';

export type GraphLayoutMode = 'hierarchical' | 'organic' | 'focus';

export interface ConceptRelationship {
  id?: string;
  type: string;
  targetId: string;
  targetName: string;
  direction: 'outgoing' | 'incoming';
  description?: string;
  sourceChunkIds?: string[];
  sourceNames?: string[];
}

export interface ConceptSourceReference {
  id: string;
  name: string;
  fileName?: string;
  chunkIds?: string[];
  page?: number;
}

export interface SelectedRelationshipData {
  id: string;
  sourceId: string;
  sourceName: string;
  targetId: string;
  targetName: string;
  type: string;
  description?: string;
  sourceNames?: string[];
  sourceChunkIds?: string[];
}

export type ConceptVisibilityState = 'visible' | 'focused' | 'contextual' | 'hidden';

export type GraphDensityMode = 'focused' | 'balanced' | 'expanded';

export type ZoomDisclosureLevel = 'simplified' | 'standard' | 'detailed';

export interface GraphConceptData extends Record<string, unknown> {
  id: string;
  label: string;
  name?: string;
  code: string;
  category: ConceptCategory;
  description: string;
  prerequisites: string[];
  relationships: ConceptRelationship[];
  confidence: number; // e.g. 94
  source: string;
  sources?: ConceptSourceReference[];
  sourceChunkIds?: string[];
  evidence?: string;
  evidenceItems?: import('./knowledgeGraph').ConceptEvidenceItem[];
  keyIdeas?: string[];
  page?: number;
  synapseCount: number;
  highlighted?: boolean;
  dimmed?: boolean;
  selected?: boolean;
  isPrerequisite?: boolean;
  isApplication?: boolean;
  isMethod?: boolean;
  craftingNew?: boolean;
  craftingActive?: boolean;
  // Scalable viewport presentation attributes
  visibilityState?: ConceptVisibilityState;
  visibilityPriority?: number;
  explorationDepth?: number;
  zoomLevel?: ZoomDisclosureLevel;
}

export interface SearchResultItem {
  id: string;
  label: string;
  category: ConceptCategory;
  code: string;
}
