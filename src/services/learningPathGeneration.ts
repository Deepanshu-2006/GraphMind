import type { 
  KnowledgeGraph, 
  KnowledgeNode, 
  KnowledgeRelationship 
} from '../types/knowledgeGraph';
import type { LearningPath } from '../types';

/**
 * =========================================================================
 * DETERMINISTIC LEARNING PATH GENERATION SERVICE
 * Pipeline: KNOWLEDGE GRAPH → RELATIONSHIPS → PATH DISCOVERY → CURRICULUM
 * =========================================================================
 */

export interface LearningPathGenerationResult {
  paths: LearningPath[];
  totalConcepts: number;
  totalRelationships: number;
  state: 'empty' | 'insufficient' | 'ready';
}

export interface PedagogicalEdge {
  fromId: string;
  toId: string;
  type: string;
  weight: number;
  confidence: number;
  description?: string;
}

// -------------------------------------------------------------------------
// 1. CONTROLLED TAXONOMY & PEDAGOGICAL LEVEL HIERARCHY
// -------------------------------------------------------------------------

/**
 * Priority weighting for semantic relationships in learning paths
 */
export const RELATION_WEIGHTS: Record<string, number> = {
  'foundation-for': 10,
  'depends-on': 9,
  'part-of': 8,
  'extends': 7,
  'uses': 6,
  'applied-to': 5,
  'instance-of': 4,
  'related-to': 2
};

/**
 * Pedagogical progression levels (lower = foundational, higher = advanced/applied)
 */
export const CATEGORY_LEVELS: Record<string, number> = {
  foundation: 1,
  paradigm: 2,
  architecture: 3,
  method: 4,
  application: 5
};

export function getNodeLevel(node: KnowledgeNode): number {
  if (!node.type) return 3;
  const norm = node.type.toLowerCase().trim();
  return CATEGORY_LEVELS[norm] || 3;
}

// -------------------------------------------------------------------------
// 2. DURATION ESTIMATION (Requirement 9: Deterministic base 8m + complexity)
// -------------------------------------------------------------------------

/**
 * Calculate deterministic estimated learning minutes for a sequence of concepts.
 * Base 8 minutes per concept, adjusted for rich descriptions and prerequisites.
 */
export function calculateEstimatedMinutes(concepts: KnowledgeNode[]): number {
  if (!concepts || concepts.length === 0) return 0;

  let totalMinutes = 0;
  for (const concept of concepts) {
    let conceptMinutes = 8; // Base 8 minutes per concept

    // Adjust for rich conceptual description depth
    if (concept.description && concept.description.length > 120) {
      conceptMinutes += 2;
    }

    // Adjust for prerequisites complexity if recorded
    if (concept.prerequisites && concept.prerequisites.length > 0) {
      conceptMinutes += Math.min(4, concept.prerequisites.length);
    }

    totalMinutes += conceptMinutes;
  }

  return totalMinutes;
}

/**
 * Format minutes into editorial display string:
 * < 60 min: "42 min"
 * >= 60 min: "1.5 hrs"
 */
export function formatEstimatedDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.max(1, Math.round(minutes))} min`;
  }
  const hours = (minutes / 60).toFixed(1);
  return `${hours} hrs`;
}

// -------------------------------------------------------------------------
// 3. PROGRESS & STATUS CALCULATION (Requirements 10 & 11)
// -------------------------------------------------------------------------

export function calculatePathProgress(
  conceptIds: string[],
  completedConceptIds: string[] = []
): {
  completedCount: number;
  totalCount: number;
  progress: number;
  status: 'NOT STARTED' | 'IN PROGRESS' | 'COMPLETE';
} {
  const totalCount = conceptIds.length;
  if (totalCount === 0) {
    return { completedCount: 0, totalCount: 0, progress: 0, status: 'NOT STARTED' };
  }

  const completedSet = new Set(completedConceptIds);
  const completedCount = conceptIds.filter(id => completedSet.has(id)).length;
  const progress = Math.min(100, Math.max(0, Math.round((completedCount / totalCount) * 100)));

  let status: 'NOT STARTED' | 'IN PROGRESS' | 'COMPLETE' = 'NOT STARTED';
  if (progress === 100) {
    status = 'COMPLETE';
  } else if (progress > 0) {
    status = 'IN PROGRESS';
  } else {
    status = 'NOT STARTED';
  }

  return { completedCount, totalCount, progress, status };
}

// -------------------------------------------------------------------------
// 4. TITLE GENERATION (Requirement 7: [first concept] → [final concept])
// -------------------------------------------------------------------------

export function generatePathTitle(concepts: KnowledgeNode[]): string {
  if (!concepts || concepts.length === 0) return 'Untitled Path';
  if (concepts.length === 1) return concepts[0].name;

  const origin = concepts[0].name.trim();
  const destination = concepts[concepts.length - 1].name.trim();

  if (origin.toLowerCase() === destination.toLowerCase() && concepts.length > 2) {
    const mid = concepts[Math.floor(concepts.length / 2)].name.trim();
    return `${origin} → ${mid}`;
  }

  return `${origin} → ${destination}`;
}

// -------------------------------------------------------------------------
// 5. DIRECTED PEDAGOGICAL EDGE EXTRACTION (Requirements 4 & 5)
// -------------------------------------------------------------------------

/**
 * Determines the directed pedagogical flow between two connected concepts
 * ensuring foundation/prerequisite concepts precede advanced/applied concepts.
 */
export function resolvePedagogicalEdge(
  rel: KnowledgeRelationship,
  nodeMap: Map<string, KnowledgeNode>
): PedagogicalEdge | null {
  const sourceNode = nodeMap.get(rel.source);
  const targetNode = nodeMap.get(rel.target);
  if (!sourceNode || !targetNode || sourceNode.id === targetNode.id) {
    return null;
  }

  const relType = (rel.type || 'related-to').toLowerCase().trim();
  const weight = RELATION_WEIGHTS[relType] || 3;
  const confidence = rel.confidence || 0.90;

  const sourceLevel = getNodeLevel(sourceNode);
  const targetLevel = getNodeLevel(targetNode);

  let fromId: string;
  let toId: string;

  switch (relType) {
    case 'foundation-for':
      // A is foundation for B → A precedes B
      fromId = sourceNode.id;
      toId = targetNode.id;
      break;

    case 'depends-on':
      // Source depends on Target → Target is prerequisite, so Target precedes Source
      fromId = targetNode.id;
      toId = sourceNode.id;
      break;

    case 'applied-to':
      // Method/Architecture applied to Application → Architecture precedes Application
      fromId = sourceNode.id;
      toId = targetNode.id;
      break;

    case 'extends':
      // A extends B: base concept precedes extension
      if (targetLevel <= sourceLevel) {
        fromId = targetNode.id;
        toId = sourceNode.id;
      } else {
        fromId = sourceNode.id;
        toId = targetNode.id;
      }
      break;

    case 'uses':
    case 'part-of':
    case 'instance-of':
    default:
      // Compare hierarchical levels: lower level (foundational) precedes higher level
      if (sourceLevel < targetLevel) {
        fromId = sourceNode.id;
        toId = targetNode.id;
      } else if (targetLevel < sourceLevel) {
        fromId = targetNode.id;
        toId = sourceNode.id;
      } else {
        // Equal level: preserve source -> target direction from relationship
        fromId = sourceNode.id;
        toId = targetNode.id;
      }
      break;
  }

  return {
    fromId,
    toId,
    type: relType,
    weight,
    confidence,
    description: rel.description
  };
}

// -------------------------------------------------------------------------
// 6. MAIN DETERMINISTIC GENERATION PIPELINE
// -------------------------------------------------------------------------

/**
 * Deterministically generates curriculum learning paths from the knowledge graph.
 */
export function generateLearningPaths(
  graph: KnowledgeGraph | null | undefined,
  completedConceptIds: string[] = []
): LearningPathGenerationResult {
  if (!graph || !Array.isArray(graph.nodes) || graph.nodes.length === 0) {
    return {
      paths: [],
      totalConcepts: 0,
      totalRelationships: 0,
      state: 'empty'
    };
  }

  const nodes = graph.nodes;
  const relationships = Array.isArray(graph.relationships) ? graph.relationships : [];
  const totalConcepts = nodes.length;
  const totalRelationships = relationships.length;

  if (totalRelationships === 0) {
    return {
      paths: [],
      totalConcepts,
      totalRelationships,
      state: 'insufficient'
    };
  }

  // 1. Build node lookup
  const nodeMap = new Map<string, KnowledgeNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  // 2. Build directed pedagogical adjacency list
  const adj = new Map<string, PedagogicalEdge[]>();
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();

  for (const node of nodes) {
    adj.set(node.id, []);
    inDegree.set(node.id, 0);
    outDegree.set(node.id, 0);
  }

  // Deduplicate directed edges between pairs keeping highest weight
  const edgePairMap = new Map<string, PedagogicalEdge>();
  for (const rel of relationships) {
    const edge = resolvePedagogicalEdge(rel, nodeMap);
    if (!edge) continue;

    const pairKey = `${edge.fromId}->${edge.toId}`;
    const existing = edgePairMap.get(pairKey);
    if (!existing || edge.weight > existing.weight) {
      edgePairMap.set(pairKey, edge);
    }
  }

  for (const edge of edgePairMap.values()) {
    adj.get(edge.fromId)?.push(edge);
    inDegree.set(edge.toId, (inDegree.get(edge.toId) || 0) + 1);
    outDegree.set(edge.fromId, (outDegree.get(edge.fromId) || 0) + 1);
  }

  // 3. Sort outgoing edges deterministically by weight descending, then target node name
  for (const edges of adj.values()) {
    edges.sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      const nameA = nodeMap.get(a.toId)?.name || a.toId;
      const nameB = nodeMap.get(b.toId)?.name || b.toId;
      return nameA.localeCompare(nameB);
    });
  }

  // 4. Identify starting candidate concepts (roots and foundational concepts)
  const candidateStarts = [...nodes].sort((a, b) => {
    const inDegA = inDegree.get(a.id) || 0;
    const inDegB = inDegree.get(b.id) || 0;
    if (inDegA !== inDegB) return inDegA - inDegB; // Lower in-degree first (true roots)

    const levelA = getNodeLevel(a);
    const levelB = getNodeLevel(b);
    if (levelA !== levelB) return levelA - levelB; // Lower level (foundational) first

    const outDegA = outDegree.get(a.id) || 0;
    const outDegB = outDegree.get(b.id) || 0;
    if (outDegB !== outDegA) return outDegB - outDegA; // Higher out-degree first

    return a.name.localeCompare(b.name);
  });

  // 5. Depth-First Search for coherent concept sequences with balanced start allocation
  const rawPaths: { nodes: KnowledgeNode[]; edgeWeights: number[] }[] = [];
  const MAX_PATH_LENGTH = 6;
  const MIN_PATH_LENGTH = 2;
  const MAX_PATHS_PER_START = 8;
  const MAX_TOTAL_CANDIDATES = 120;

  function dfs(
    currentId: string,
    currentPath: KnowledgeNode[],
    currentWeights: number[],
    visited: Set<string>,
    startPathCount: { count: number }
  ) {
    if (rawPaths.length >= MAX_TOTAL_CANDIDATES || startPathCount.count >= MAX_PATHS_PER_START) return;

    if (currentPath.length >= MIN_PATH_LENGTH) {
      rawPaths.push({
        nodes: [...currentPath],
        edgeWeights: [...currentWeights]
      });
      startPathCount.count++;
    }

    if (currentPath.length >= MAX_PATH_LENGTH) return;

    const neighbors = adj.get(currentId) || [];
    for (const edge of neighbors) {
      if (!visited.has(edge.toId)) {
        const nextNode = nodeMap.get(edge.toId);
        if (!nextNode) continue;

        visited.add(edge.toId);
        currentPath.push(nextNode);
        currentWeights.push(edge.weight);

        dfs(edge.toId, currentPath, currentWeights, visited, startPathCount);

        currentPath.pop();
        currentWeights.pop();
        visited.delete(edge.toId);
      }
    }
  }

  for (const startNode of candidateStarts) {
    if ((outDegree.get(startNode.id) || 0) > 0) {
      const visited = new Set<string>([startNode.id]);
      const startPathCount = { count: 0 };
      dfs(startNode.id, [startNode], [], visited, startPathCount);
    }
  }

  if (rawPaths.length === 0) {
    return {
      paths: [],
      totalConcepts,
      totalRelationships,
      state: 'insufficient'
    };
  }

  // 6. Score each candidate path deterministically (Requirement 15)
  interface ScoredPath {
    nodes: KnowledgeNode[];
    score: number;
    title: string;
    key: string;
    originId: string;
    destId: string;
  }

  const scoredPaths: ScoredPath[] = rawPaths.map(candidate => {
    const cNodes = candidate.nodes;
    const weights = candidate.edgeWeights;

    // 6a. Semantic edge strength
    const semanticScore = weights.reduce((sum, w) => sum + w, 0);

    // 6b. Progression length bonus (preferring 3 to 5 concepts for curriculum clarity)
    let lengthScore = 0;
    switch (cNodes.length) {
      case 2: lengthScore = 12; break;
      case 3: lengthScore = 32; break;
      case 4: lengthScore = 48; break;
      case 5: lengthScore = 52; break;
      case 6: lengthScore = 46; break;
      default: lengthScore = 30; break;
    }

    // 6c. Foundation → Advanced progression coherence
    let coherenceScore = 0;
    let isMonotonic = true;
    for (let i = 0; i < cNodes.length - 1; i++) {
      if (getNodeLevel(cNodes[i]) > getNodeLevel(cNodes[i + 1])) {
        isMonotonic = false;
        break;
      }
    }
    if (isMonotonic) coherenceScore += 20;

    // Root start bonus
    const startInDeg = inDegree.get(cNodes[0].id) || 0;
    if (startInDeg === 0) coherenceScore += 12;

    // Terminal leaf or application bonus
    const endOutDeg = outDegree.get(cNodes[cNodes.length - 1].id) || 0;
    if (endOutDeg === 0) coherenceScore += 10;
    if (getNodeLevel(cNodes[cNodes.length - 1]) === 5) coherenceScore += 10;

    // Node confidence / quality
    const avgConfidence = cNodes.reduce((acc, n) => acc + (n.confidence || 90), 0) / cNodes.length;

    const totalScore = semanticScore + lengthScore + coherenceScore + (avgConfidence * 0.1);
    const key = cNodes.map(n => n.id).join('->');
    const title = generatePathTitle(cNodes);

    return {
      nodes: cNodes,
      score: totalScore,
      title,
      key,
      originId: cNodes[0].id,
      destId: cNodes[cNodes.length - 1].id
    };
  });

  // Sort descending by score, deterministic tie-breaking
  scoredPaths.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.nodes.length !== a.nodes.length) return b.nodes.length - a.nodes.length;
    return a.title.localeCompare(b.title);
  });

  // 7. Deduplication & Curriculum Topic Diversity (Requirements 14, 15, 16)
  const selectedPaths: ScoredPath[] = [];
  const seenSequences = new Set<string>();
  const seenTerminalPairs = new Set<string>();
  const seenTitles = new Set<string>();
  const originCounts = new Map<string, number>();

  const targetMaxPaths = Math.min(8, Math.max(3, Math.ceil(totalConcepts / 2.5)));

  // Helper: check concept overlap percentage with already selected paths
  const calculateMaxOverlap = (nodes: KnowledgeNode[], existingPaths: ScoredPath[]): number => {
    if (existingPaths.length === 0) return 0;
    const nodeIds = new Set(nodes.map(n => n.id));
    let maxOverlapRatio = 0;

    for (const ep of existingPaths) {
      let sharedCount = 0;
      for (const n of ep.nodes) {
        if (nodeIds.has(n.id)) sharedCount++;
      }
      const ratio = sharedCount / Math.min(nodes.length, ep.nodes.length);
      if (ratio > maxOverlapRatio) maxOverlapRatio = ratio;
    }
    return maxOverlapRatio;
  };

  // PASS 1: Select diverse paths with unique endpoints, diverse origins, and low overlap (< 50%)
  for (const candidate of scoredPaths) {
    if (selectedPaths.length >= targetMaxPaths) break;

    const terminalKey = `${candidate.originId}->${candidate.destId}`;
    if (seenSequences.has(candidate.key)) continue;
    if (seenTerminalPairs.has(terminalKey)) continue; // Never duplicate origin -> destination pair!
    if ((originCounts.get(candidate.originId) || 0) >= 1) continue; // Max 1 path per origin concept in Pass 1

    // Check overlap with already selected paths
    if (calculateMaxOverlap(candidate.nodes, selectedPaths) > 0.50) continue;

    selectedPaths.push(candidate);
    seenSequences.add(candidate.key);
    seenTerminalPairs.add(terminalKey);
    seenTitles.add(candidate.title);
    originCounts.set(candidate.originId, (originCounts.get(candidate.originId) || 0) + 1);
  }

  // PASS 2: If we have room, relax origin limit to 2 per origin, but still enforce unique terminal pairs & < 65% overlap
  if (selectedPaths.length < targetMaxPaths) {
    for (const candidate of scoredPaths) {
      if (selectedPaths.length >= targetMaxPaths) break;

      const terminalKey = `${candidate.originId}->${candidate.destId}`;
      if (seenSequences.has(candidate.key)) continue;
      if (seenTerminalPairs.has(terminalKey)) continue; // Still enforce unique endpoints!
      if ((originCounts.get(candidate.originId) || 0) >= 2) continue;

      if (calculateMaxOverlap(candidate.nodes, selectedPaths) > 0.65) continue;

      selectedPaths.push(candidate);
      seenSequences.add(candidate.key);
      seenTerminalPairs.add(terminalKey);
      seenTitles.add(candidate.title);
      originCounts.set(candidate.originId, (originCounts.get(candidate.originId) || 0) + 1);
    }
  }

  // PASS 3: Fallback for small or tightly coupled graphs to reach at least 3 paths if candidates exist
  if (selectedPaths.length < 3) {
    for (const candidate of scoredPaths) {
      if (seenSequences.has(candidate.key)) continue;

      // Disambiguate title if endpoint pair already exists
      let finalTitle = candidate.title;
      if (seenTitles.has(finalTitle) && candidate.nodes.length > 2) {
        const midConcept = candidate.nodes[Math.floor(candidate.nodes.length / 2)].name;
        finalTitle = `${candidate.nodes[0].name} → ${midConcept} → ${candidate.nodes[candidate.nodes.length - 1].name}`;
      }

      selectedPaths.push({
        ...candidate,
        title: finalTitle
      });
      seenSequences.add(candidate.key);
      seenTitles.add(finalTitle);
      if (selectedPaths.length >= 3) break;
    }
  }

  // 8. Transform to final LearningPath models (Requirement 6)
  const paths: LearningPath[] = selectedPaths.map((sp, idx) => {
    const conceptIds = sp.nodes.map(n => n.id);
    const estimatedMinutes = calculateEstimatedMinutes(sp.nodes);
    const estimatedHours = formatEstimatedDuration(estimatedMinutes);
    const { progress, status } = calculatePathProgress(conceptIds, completedConceptIds);

    const pathCompletedIds = conceptIds.filter(id => completedConceptIds.includes(id));

    // Stable deterministic ID
    const originSlug = sp.nodes[0].id.replace(/[^a-zA-Z0-9]/g, '');
    const destSlug = sp.nodes[sp.nodes.length - 1].id.replace(/[^a-zA-Z0-9]/g, '');
    const pathId = `lp-${originSlug}-${destSlug}-${idx + 1}`;

    return {
      id: pathId,
      title: sp.title,
      conceptIds,
      concepts: sp.nodes,
      nodeCount: sp.nodes.length,
      estimatedMinutes,
      estimatedHours,
      completedConceptIds: pathCompletedIds,
      progress,
      status
    };
  });

  return {
    paths,
    totalConcepts,
    totalRelationships,
    state: paths.length > 0 ? 'ready' : 'insufficient'
  };
}
