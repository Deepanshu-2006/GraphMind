import type {
  CanonicalConcept,
  KnowledgeGraph,
  KnowledgeNode,
  KnowledgeRelationship,
  KnowledgeSource,
  TextChunk
} from '../types/knowledgeGraph';
import { extractText } from './textExtraction';
import { extractAndNormalizeConcepts } from './conceptNormalization';
import { extractRelationshipsFromChunks } from './relationshipExtraction';

/**
 * =========================================================================
 * GRAPH BUILDER SERVICE (Day 2, Step 7)
 * Pipeline: SOURCES + CONCEPTS + RELATIONSHIPS → FINAL KNOWLEDGE GRAPH
 * =========================================================================
 */

export interface GraphBuilderOptions {
  removeDanglingEdges?: boolean; // Defaults to true
  allowSelfLoops?: boolean; // Defaults to false
  strictValidation?: boolean; // Defaults to true
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
 * Preserves: id, name, type, description, sourceIds, sourceChunkIds
 * -------------------------------------------------------------------------
 */
export function buildGraphNodes(concepts: CanonicalConcept[]): KnowledgeNode[] {
  if (!concepts || concepts.length === 0) {
    return [];
  }

  const nodeMap = new Map<string, KnowledgeNode>();

  for (const c of concepts) {
    if (!c || !c.id || !c.name) continue;

    const trimmedId = c.id.trim();
    if (!trimmedId) continue;

    const existing = nodeMap.get(trimmedId);

    if (!existing) {
      // Create new node without hardcoded layout coordinates
      // Layout is intentionally separated from semantic graph construction
      nodeMap.set(trimmedId, {
        id: trimmedId,
        name: c.name.trim(),
        type: c.type || 'concept',
        description: c.description?.trim() || '',
        sourceIds: [...(c.sourceIds || [])],
        sourceChunkIds: [...(c.sourceChunkIds || [])],
        confidence: c.confidence
      });
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
 * - Remove duplicate relationships
 * - Do not force artificial connectivity
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

  const edgeMap = new Map<string, KnowledgeRelationship>();

  for (const rel of relationships) {
    if (!rel) continue;

    const source = (rel.source || '').trim();
    const target = (rel.target || '').trim();
    const type = (rel.type || '').trim();

    // 1. Invalidation: missing endpoints or empty relation type
    if (!source || !target || !type) {
      continue;
    }

    // 2. Disallow self-loops unless explicitly allowed
    if (!allowSelfLoops && source === target) {
      continue;
    }

    // 3. Remove references to missing nodes (strictly do not synthesize missing concepts)
    if (removeDanglingEdges) {
      if (!validNodeIds.has(source) || !validNodeIds.has(target)) {
        continue;
      }
    }

    const key = `${source}->${type}->${target}`;
    const existing = edgeMap.get(key);

    if (!existing) {
      edgeMap.set(key, {
        id: rel.id || `rel-${source}-${type}-${target}`,
        source,
        target,
        type: rel.type,
        description: rel.description?.trim() || '',
        sourceChunkIds: [...(rel.sourceChunkIds || [])],
        sourceIds: [...(rel.sourceIds || [])],
        confidence: rel.confidence,
        label: rel.label || rel.type
      });
    } else {
      // Deduplicate relationships while merging supporting chunks and sources
      for (const cId of rel.sourceChunkIds || []) {
        if (!existing.sourceChunkIds.includes(cId)) {
          existing.sourceChunkIds.push(cId);
        }
      }

      for (const sId of rel.sourceIds || []) {
        if (!existing.sourceIds) existing.sourceIds = [];
        if (!existing.sourceIds.includes(sId)) {
          existing.sourceIds.push(sId);
        }
      }

      // Preserve richer contextual sentence
      if ((rel.description?.trim() || '').length > (existing.description || '').length) {
        existing.description = rel.description?.trim() || '';
      }

      if (typeof rel.confidence === 'number') {
        existing.confidence = Math.min(0.99, Math.max(existing.confidence || 0, rel.confidence) + 0.02);
      }
    }
  }

  return Array.from(edgeMap.values());
}

/**
 * -------------------------------------------------------------------------
 * 3. DEDICATED GRAPH BUILDER
 * Assembles validated concepts, relationships, and sources into KnowledgeGraph
 * -------------------------------------------------------------------------
 */
export function buildKnowledgeGraph(
  concepts: CanonicalConcept[],
  relationships: KnowledgeRelationship[],
  sources: KnowledgeSource[],
  options: GraphBuilderOptions = {}
): KnowledgeGraph {
  // 1. Build and validate nodes (deduplicated, canonical)
  const nodes = buildGraphNodes(concepts);
  const validNodeIds = new Set(nodes.map(n => n.id));

  // 2. Build and validate edges (dangling edges removed, missing concepts NOT created)
  const cleanRelationships = buildGraphEdges(relationships, validNodeIds, options);

  // 3. Deduplicate sources by id
  const sourceMap = new Map<string, KnowledgeSource>();
  for (const s of sources || []) {
    if (s && s.id && !sourceMap.has(s.id)) {
      sourceMap.set(s.id, s);
    }
  }

  return {
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
