export type ConceptCategory = 
  | 'Foundation' 
  | 'Paradigm' 
  | 'Architecture' 
  | 'Method' 
  | 'Application';

export type FilterCategory = 'ALL' | 'CONCEPTS' | 'PREREQUISITES' | 'APPLICATIONS' | 'METHODS';

export type GraphLayoutMode = 'hierarchical' | 'organic' | 'focus';

export interface ConceptRelationship {
  type: 'USED_FOR' | 'BASED_ON' | 'SPECIALIZES' | 'EXTENDS' | 'INTEGRATES' | 'SUBFIELD_OF';
  targetId: string;
  targetName: string;
  direction: 'outgoing' | 'incoming';
}

export interface GraphConceptData extends Record<string, unknown> {
  id: string;
  label: string;
  code: string;
  category: ConceptCategory;
  description: string;
  prerequisites: string[];
  relationships: ConceptRelationship[];
  confidence: number; // e.g. 94
  source: string;
  synapseCount: number;
  highlighted?: boolean;
  dimmed?: boolean;
  selected?: boolean;
  isPrerequisite?: boolean;
  isApplication?: boolean;
  isMethod?: boolean;
}

export interface SearchResultItem {
  id: string;
  label: string;
  category: ConceptCategory;
  code: string;
}
