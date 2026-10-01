/**
 * GraphMind Knowledge Graph Canonical Data Model
 * 
 * Pipeline flow:
 * SOURCE → CONCEPTS → RELATIONSHIPS → KNOWLEDGE GRAPH
 */

export type ConceptNodeType = 
  | 'foundation'
  | 'paradigm'
  | 'architecture'
  | 'method'
  | 'application'
  | string;

export interface NodePosition {
  x: number;
  y: number;
}

/**
 * Concept Node Model
 * Represents an extracted or synthesized semantic concept.
 */
export interface KnowledgeNode {
  id: string;
  name: string;
  type: ConceptNodeType;
  description: string;
  sourceIds: string[];
  position: NodePosition;
  
  // Optional domain metadata
  code?: string;
  confidence?: number;
  prerequisites?: string[];
}

/**
 * Semantic Relationship Types
 * Restrained, meaningful relationship taxonomy.
 */
export type SemanticRelationType =
  | 'related-to'
  | 'part-of'
  | 'foundation-for'
  | 'extends'
  | 'uses'
  | 'applied-to'
  | 'depends-on';

/**
 * Relationship Model
 * Represents a semantic, directed or bidirectional connection between concepts.
 */
export interface KnowledgeRelationship {
  id: string;
  source: string; // source node id
  target: string; // target node id
  type: SemanticRelationType | string;
  description?: string;
  label?: string; // Optional human-readable display label
}

/**
 * Source Model
 * Represents the original learning material from which concepts were extracted.
 */
export type SourceType = 'pdf' | 'text' | 'markdown' | 'url' | string;

export interface KnowledgeSource {
  id: string;
  name: string;
  type: SourceType;
  fileName?: string;
  text?: string;
  createdAt: string | number;
  
  // Optional metadata needed by UI
  size?: string;
  status?: 'Ready' | 'Processing' | 'Failed' | 'Indexed' | string;
  conceptsExtracted?: number;
}

/**
 * Top-Level Knowledge Graph Model
 * The unified container for nodes, relationships, and origin sources.
 */
export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  relationships: KnowledgeRelationship[];
  sources: KnowledgeSource[];
}

/**
 * Knowledge Graph Query & Traversal Utilities
 */

export function findNodeById(graph: KnowledgeGraph, id: string): KnowledgeNode | undefined {
  return graph.nodes.find(n => n.id === id);
}

export function findSourceById(graph: KnowledgeGraph, id: string): KnowledgeSource | undefined {
  return graph.sources.find(s => s.id === id);
}

export function getNodeSources(graph: KnowledgeGraph, nodeOrId: KnowledgeNode | string): KnowledgeSource[] {
  const node = typeof nodeOrId === 'string' ? findNodeById(graph, nodeOrId) : nodeOrId;
  if (!node || !node.sourceIds) return [];
  const sourceIdSet = new Set(node.sourceIds);
  return graph.sources.filter(s => sourceIdSet.has(s.id));
}

export function getNodeRelationships(
  graph: KnowledgeGraph, 
  nodeOrId: KnowledgeNode | string
): { incoming: KnowledgeRelationship[]; outgoing: KnowledgeRelationship[] } {
  const nodeId = typeof nodeOrId === 'string' ? nodeOrId : nodeOrId.id;
  const incoming: KnowledgeRelationship[] = [];
  const outgoing: KnowledgeRelationship[] = [];

  for (const rel of graph.relationships) {
    if (rel.source === nodeId) {
      outgoing.push(rel);
    } else if (rel.target === nodeId) {
      incoming.push(rel);
    }
  }

  return { incoming, outgoing };
}

export function getConnectedNodes(graph: KnowledgeGraph, nodeOrId: KnowledgeNode | string): KnowledgeNode[] {
  const nodeId = typeof nodeOrId === 'string' ? nodeOrId : nodeOrId.id;
  const connectedIds = new Set<string>();

  for (const rel of graph.relationships) {
    if (rel.source === nodeId) connectedIds.add(rel.target);
    if (rel.target === nodeId) connectedIds.add(rel.source);
  }

  return graph.nodes.filter(n => connectedIds.has(n.id));
}

