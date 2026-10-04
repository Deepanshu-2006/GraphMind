import type {
  CanonicalConcept,
  KnowledgeGraph,
  KnowledgeNode,
  KnowledgeRelationship,
  KnowledgeSource,
  TextChunk
} from '../types/knowledgeGraph';
import { extractText } from './textExtraction';
import { extractAndNormalizeConcepts, generateCanonicalKey } from './conceptNormalization';
import { extractRelationshipsFromChunks, deduplicateRelationships } from './relationshipExtraction';
import { computeGraphLayout } from './graphLayout';

/**
 * =========================================================================
 * GRAPH BUILDER SERVICE (Day 2, Step 7 & Step 11 Quality Pass)
 * Pipeline: SOURCES + CONCEPTS + RELATIONSHIPS → FINAL KNOWLEDGE GRAPH
 * =========================================================================
 */

export interface GraphBuilderOptions {
  graphId?: string;
  removeDanglingEdges?: boolean; // Defaults to true
  allowSelfLoops?: boolean; // Defaults to false
  strictValidation?: boolean; // Defaults to true
  filterNoiseNodes?: boolean; // Defaults to true
}

export interface PipelineOptions extends GraphBuilderOptions {
  minConfidence?: number;
  provider?: string;
  apiKey?: string;
  endpoint?: string;
}

/**
 * -------------------------------------------------------------------------
 * 1. NODE CREATION & VALIDATION
 * Each canonical concept becomes one graph node.
 * Merges duplicates by ID and canonical normalized key.
 * Preserves: id, name, type, description, sourceIds, sourceChunkIds
 * -------------------------------------------------------------------------
 */
export function buildGraphNodes(concepts: CanonicalConcept[]): KnowledgeNode[] {
  if (!concepts || concepts.length === 0) {
    return [];
  }

  const nodeMap = new Map<string, KnowledgeNode>();
  const keyMap = new Map<string, KnowledgeNode>();

  for (const c of concepts) {
    if (!c || !c.id || !c.name) continue;

    const trimmedId = c.id.trim();
    if (!trimmedId) continue;

    const normKey = generateCanonicalKey(c.name);
    const existing = nodeMap.get(trimmedId) || (normKey ? keyMap.get(normKey) : undefined);

    if (!existing) {
      const newNode: KnowledgeNode = {
        id: trimmedId,
        name: c.name.trim(),
        type: c.type || 'concept',
        description: c.description?.trim() || '',
        sourceIds: [...(c.sourceIds || [])],
        sourceChunkIds: [...(c.sourceChunkIds || [])],
        confidence: c.confidence,
        evidence: c.evidence,
        importance: c.importance,
        isCoreConcept: c.isCoreConcept
      };
      nodeMap.set(trimmedId, newNode);
      if (normKey) keyMap.set(normKey, newNode);
    } else {
      // Remove duplicate nodes while merging supporting evidence
      for (const sId of c.sourceIds || []) {
        if (!existing.sourceIds.includes(sId)) {
          existing.sourceIds.push(sId);
        }
      }

      if (!existing.sourceChunkIds) existing.sourceChunkIds = [];
      for (const chunkId of c.sourceChunkIds || []) {
        if (!existing.sourceChunkIds.includes(chunkId)) {
          existing.sourceChunkIds.push(chunkId);
        }
      }

      // Preserve the most descriptive summary
      if ((c.description?.trim() || '').length > existing.description.length) {
        existing.description = c.description.trim();
      }

      // Retain maximum confidence
      if (typeof c.confidence === 'number') {
        existing.confidence = Math.max(existing.confidence || 0, c.confidence);
      }

      // Preserve evidence, importance, and core status
      if (c.evidence && !existing.evidence) {
        existing.evidence = c.evidence;
      }
      if (typeof c.importance === 'number') {
        existing.importance = Math.max(existing.importance || 0, c.importance);
      }
      if (c.isCoreConcept) {
        existing.isCoreConcept = true;
      }
    }
  }

  return Array.from(nodeMap.values());
}

/**
 * -------------------------------------------------------------------------
 * 2. EDGE CREATION & VALIDATION
 * Each valid relationship becomes one graph edge.
 * Preserves: source, target, type, description, sourceChunkIds
 * 
 * Rules:
 * - Remove invalid relationships
 * - Remove references to missing nodes (no dangling edges)
 * - Do not silently create missing concepts
 * - Remove duplicate relationships (via pair-level deduplication)
 * - Disallow self-loops
 * -------------------------------------------------------------------------
 */
export function buildGraphEdges(
  relationships: KnowledgeRelationship[],
  validNodeIds: Set<string>,
  options: GraphBuilderOptions = {}
): KnowledgeRelationship[] {
  if (!relationships || relationships.length === 0 || validNodeIds.size === 0) {
    return [];
  }

  const {
    removeDanglingEdges = true,
    allowSelfLoops = false
  } = options;

  // 1. Run semantic deduplication first to resolve parallel edges
  const deduplicated = deduplicateRelationships(relationships);

  // 2. Validate against valid node set and options
  const cleanEdges: KnowledgeRelationship[] = [];

  for (const rel of deduplicated) {
    if (!rel) continue;

    const source = (rel.source || '').trim();
    const target = (rel.target || '').trim();
    const type = (rel.type || '').trim();

    if (!source || !target || !type) continue;

    if (!allowSelfLoops && source === target) continue;

    if (removeDanglingEdges) {
      if (!validNodeIds.has(source) || !validNodeIds.has(target)) {
        continue;
      }
    }

    cleanEdges.push({
      ...rel,
      source,
      target,
      type,
      label: rel.label || type,
      sourceChunkIds: [...(rel.sourceChunkIds || [])],
      sourceIds: [...(rel.sourceIds || [])]
    });
  }

  // 3. Degree capping for visual clarity & decluttering
  // If a graph has high connectivity, prevent hairball explosion by keeping the top most meaningful edges per node
  if (cleanEdges.length > 25) {
    const REL_PRIORITY: Record<string, number> = {
      'prerequisite': 10,
      'foundation-for': 10,
      'part-of': 8,
      'implements': 8,
      'extends': 7,
      'uses': 6,
      'applied-to': 5,
      'instance-of': 5,
      'depends-on': 5,
      'related-to': 4
    };

    const edgeScores = new Map<KnowledgeRelationship, number>();
    for (const edge of cleanEdges) {
      const typeWeight = REL_PRIORITY[edge.type] || 5;
      const conf = edge.confidence || 0.85;
      edgeScores.set(edge, typeWeight * 10 + conf * 10);
    }

    const maxDegreePerNode = 4;
    const finalEdges = new Set<KnowledgeRelationship>();
    const nodeDegree = new Map<string, number>();

    const sortedEdges = [...cleanEdges].sort((a, b) => (edgeScores.get(b) || 0) - (edgeScores.get(a) || 0));

    for (const edge of sortedEdges) {
      const degS = nodeDegree.get(edge.source) || 0;
      const degT = nodeDegree.get(edge.target) || 0;

      // Allow edge if both endpoints are under the degree cap
      if (degS < maxDegreePerNode && degT < maxDegreePerNode) {
        finalEdges.add(edge);
        nodeDegree.set(edge.source, degS + 1);
        nodeDegree.set(edge.target, degT + 1);
      }
    }

    return Array.from(finalEdges);
  }

  return cleanEdges;
}

/**
 * -------------------------------------------------------------------------
 * 3. DEDICATED GRAPH BUILDER
 * Assembles validated concepts, relationships, and sources into KnowledgeGraph.
 * Reduces graph noise, filters weak isolated nodes, and calculates collision-free layout.
 * -------------------------------------------------------------------------
 */
export function buildKnowledgeGraph(
  concepts: CanonicalConcept[],
  relationships: KnowledgeRelationship[],
  sources: KnowledgeSource[],
  options: GraphBuilderOptions = {}
): KnowledgeGraph {
  const { filterNoiseNodes = true } = options;

  // 1. Build and validate initial nodes (deduplicated, canonical)
  let nodes = buildGraphNodes(concepts);
  let validNodeIds = new Set(nodes.map(n => n.id));

  // 2. Build and validate edges
  let cleanRelationships = buildGraphEdges(relationships, validNodeIds, options);

  // 3. Noise reduction: For substantive graphs (> 12 nodes), prune disconnected weak singletons
  if (filterNoiseNodes && nodes.length > 12 && cleanRelationships.length >= 5) {
    const connectedNodeIds = new Set<string>();
    for (const rel of cleanRelationships) {
      connectedNodeIds.add(rel.source);
      connectedNodeIds.add(rel.target);
    }

    // Keep connected nodes OR high-confidence/prominent nodes
    nodes = nodes.filter(n => {
      if (connectedNodeIds.has(n.id)) return true;
      // Keep foundational or highly mentioned concepts even if isolated
      const isCore = n.type === 'foundation' || n.type === 'topic' || n.type === 'paradigm';
      const hasHighEvidence = (n.sourceChunkIds && n.sourceChunkIds.length >= 2) || (n.confidence && n.confidence >= 0.95);
      return isCore || hasHighEvidence;
    });

    validNodeIds = new Set(nodes.map(n => n.id));
    cleanRelationships = buildGraphEdges(cleanRelationships, validNodeIds, options);
  }

  // 4. Compute organic, non-overlapping spatial layout
  const layoutPositions = computeGraphLayout(nodes, cleanRelationships);
  for (const n of nodes) {
    const pos = layoutPositions.get(n.id);
    if (pos) {
      n.position = pos;
    }
  }

  // 5. Deduplicate sources by id
  const sourceMap = new Map<string, KnowledgeSource>();
  for (const s of sources || []) {
    if (s && s.id && !sourceMap.has(s.id)) {
      sourceMap.set(s.id, s);
    }
  }

  const resolvedGraphId = options.graphId || sources.find(s => s.graphId)?.graphId;
  if (resolvedGraphId) {
    for (const n of nodes) {
      if (!n.graphId) n.graphId = resolvedGraphId;
    }
    for (const r of cleanRelationships) {
      if (!r.graphId) r.graphId = resolvedGraphId;
    }
  }

  return {
    id: resolvedGraphId,
    nodes,
    relationships: cleanRelationships,
    sources: Array.from(sourceMap.values())
  };
}

/**
 * -------------------------------------------------------------------------
 * 4. END-TO-END PIPELINE: SOURCE → KNOWLEDGE GRAPH
 * Full execution from raw learning document to verified KnowledgeGraph
 * -------------------------------------------------------------------------
 */
export async function buildKnowledgeGraphFromSource(
  source: KnowledgeSource,
  options: PipelineOptions = {}
): Promise<{
  success: boolean;
  graph?: KnowledgeGraph;
  error?: string;
}> {
  try {
    // Stage 1: Text extraction & chunking
    const extractionResult = await extractText(source);
    if (!extractionResult.success || !extractionResult.chunks || extractionResult.chunks.length === 0) {
      return {
        success: false,
        error: extractionResult.error || `Failed to extract readable text from "${source.name}".`
      };
    }

    const chunks = extractionResult.chunks;

    // Stage 2: Concept extraction & normalization
    const conceptResult = await extractAndNormalizeConcepts(source, chunks, options);
    if (!conceptResult.success || conceptResult.concepts.length === 0) {
      return {
        success: false,
        error: conceptResult.error || `No meaningful concepts could be identified from "${source.name}".`
      };
    }

    const canonicalConcepts = conceptResult.concepts;

    // Stage 3: Semantic relationship extraction
    const relationships = await extractRelationshipsFromChunks(canonicalConcepts, chunks, options);

    // Stage 4: Graph assembly & strict validation
    const graph = buildKnowledgeGraph(canonicalConcepts, relationships, [source], options);

    return {
      success: true,
      graph
    };
  } catch (err: unknown) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Knowledge graph generation failed.'
    };
  }
}

/**
 * Multi-source pipeline coordinator
 */
export async function buildKnowledgeGraphFromSources(
  sources: KnowledgeSource[],
  options: PipelineOptions = {}
): Promise<{
  success: boolean;
  graph?: KnowledgeGraph;
  errors?: { sourceId: string; error: string }[];
}> {
  if (!sources || sources.length === 0) {
    return {
      success: true,
      graph: { nodes: [], relationships: [], sources: [] }
    };
  }

  const allConcepts: CanonicalConcept[] = [];
  const allChunks: TextChunk[] = [];
  const validSources: KnowledgeSource[] = [];
  const errors: { sourceId: string; error: string }[] = [];

  for (const source of sources) {
    const textRes = await extractText(source);
    if (!textRes.success || !textRes.chunks) {
      errors.push({ sourceId: source.id, error: textRes.error || 'Text extraction failed' });
      continue;
    }

    allChunks.push(...textRes.chunks);
    validSources.push(source);

    const conceptRes = await extractAndNormalizeConcepts(source, textRes.chunks, options);
    if (conceptRes.success && conceptRes.concepts) {
      allConcepts.push(...conceptRes.concepts);
    }
  }

  if (allConcepts.length === 0) {
    return {
      success: false,
      errors,
      graph: { nodes: [], relationships: [], sources: validSources }
    };
  }

  // Extract cross-source relationships
  const relationships = await extractRelationshipsFromChunks(allConcepts, allChunks, options);
  const graph = buildKnowledgeGraph(allConcepts, relationships, validSources, options);

  return {
    success: true,
    graph,
    errors: errors.length > 0 ? errors : undefined
  };
}

/**
 * Service class wrapper
 */
export class GraphBuilderService {
  buildGraph(
    concepts: CanonicalConcept[],
    relationships: KnowledgeRelationship[],
    sources: KnowledgeSource[],
    options?: GraphBuilderOptions
  ): KnowledgeGraph {
    return buildKnowledgeGraph(concepts, relationships, sources, options);
  }

  async buildFromSource(source: KnowledgeSource, options?: PipelineOptions) {
    return buildKnowledgeGraphFromSource(source, options);
  }

  async buildFromSources(sources: KnowledgeSource[], options?: PipelineOptions) {
    return buildKnowledgeGraphFromSources(sources, options);
  }
}

export const graphBuilderService = new GraphBuilderService();
