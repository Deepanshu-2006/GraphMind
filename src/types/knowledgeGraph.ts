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
  sourceChunkIds?: string[];
  position?: NodePosition;
  
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
  | 'depends-on'
  | 'extends'
  | 'uses'
  | 'applied-to'
  | 'instance-of'
  | string;

/**
 * Relationship Model (Day 2 Step 6)
 * Represents a semantic, directed or bidirectional connection between concepts.
 */
export interface KnowledgeRelationship {
  id: string;
  source: string; // source concept/node id
  target: string; // target concept/node id
  type: SemanticRelationType;
  description?: string;
  sourceChunkIds: string[]; // supporting source chunks for traceability
  sourceIds?: string[]; // origin document IDs
  confidence?: number; // internal confidence score
  label?: string; // Optional human-readable display label
}

export interface RelationshipExtractionResult {
  success: boolean;
  relationships: KnowledgeRelationship[];
  conceptCount: number;
  sourceChunkCount: number;
  error?: string;
}

/**
 * Source Model & Lifecycle
 * Represents the original learning material from which concepts were extracted.
 */
export type SourceType = 'pdf' | 'text' | 'markdown' | 'url' | string;

export type SourceLifecycleState = 'pending' | 'processing' | 'ready' | 'failed';

export interface KnowledgeSource {
  id: string;
  name: string;
  type: SourceType;
  fileName?: string;
  text?: string;
  createdAt: string | number;
  status: SourceLifecycleState | 'Ready' | 'Processing' | 'Failed' | 'Indexed' | string;
  errorMessage?: string;
  
  // Optional metadata needed by UI
  size?: string;
  conceptsExtracted?: number;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  relationships: KnowledgeRelationship[];
  sources: KnowledgeSource[];
}

/**
 * Text Extraction & Chunking Models (Day 2 Step 3)
 */
export interface TextChunk {
  chunkId: string;
  sourceId: string;
  text: string;
  heading?: string;
  index: number;
  wordCount: number;
  characterCount: number;
}

export interface ExtractionResult {
  success: boolean;
  sourceId: string;
  rawText?: string;
  cleanText?: string;
  chunks?: TextChunk[];
  error?: string; // Structured user-facing error message (e.g. "Couldn't read this file.")
}

/**
 * Concept Extraction Models (Day 2 Step 4)
 * Flow: SOURCE → TEXT → CHUNKS → CONCEPTS
 */
export type ConceptCandidateType =
  | 'concept'
  | 'topic'
  | 'method'
  | 'algorithm'
  | 'architecture'
  | 'theory'
  | 'application'
  | 'dataset'
  | 'technology'
  | 'paradigm'
  | string;

export interface ConceptCandidate {
  name: string;
  type: ConceptCandidateType;
  description: string;
  sourceId: string;
  sourceChunkId: string;
  
  // Deduplication & Normalization metadata for Day 2 Step 5 (Prompt 17)
  sourceChunkIds?: string[];
  occurrences?: number;
  confidence?: number;
}

export interface ConceptExtractionResult {
  success: boolean;
  sourceId: string;
  concepts: ConceptCandidate[];
  chunkCount?: number;
  error?: string;
}

/**
 * Concept Normalization Models (Day 2 Step 5)
 * Flow: RAW EXTRACTED CONCEPTS → CANONICAL CONCEPTS
 */
export interface CanonicalConcept {
  id: string;
  name: string;
  type: ConceptCandidateType;
  description: string;
  sourceIds: string[];
  sourceChunkIds: string[];
  occurrences: number;
  confidence: number;
  aliases?: string[];
}

export interface NormalizationResult {
  success: boolean;
  canonicalConcepts: CanonicalConcept[];
  rawCount: number;
  mergedCount: number;
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

