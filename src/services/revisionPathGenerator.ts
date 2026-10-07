import type { RevisionPathStep, RevisionReason } from '../types/practice';

export interface GenerateRevisionPathParams {
  allNodes: Array<{
    id: string;
    label?: string;
    name?: string;
    category?: string;
    importance?: string;
    confidence?: number;
    description?: string;
    isCore?: boolean;
    relationships?: Array<{
      targetId?: string;
      target?: string;
      type?: string;
      direction?: string;
      description?: string;
    }>;
    directConnections?: Array<{
      targetId?: string;
      target?: string;
      type?: string;
    }>;
    data?: any;
  }>;
  allEdges?: Array<{
    id?: string;
    source: string;
    target: string;
    label?: any;
    data?: any;
  }>;
  reviewConceptIds?: Set<string> | string[];
  testedConceptIds?: Set<string> | string[];
  practiceStates?: Record<string, { status?: string }>;
  startConceptId?: string | null;
  onlyReviewQueue?: boolean;
}

interface AdjacencyEdge {
  targetId: string;
  type?: string;
  direction: 'outgoing' | 'incoming';
}

/**
 * Checks if a concept is considered a core / foundational concept
 * using existing metadata and natural connectivity, without inventing scores.
 */
function isCoreConcept(node: any, degree: number): boolean {
  if (node.importance === 'core' || node.data?.importance === 'core' || node.isCore === true) {
    return true;
  }
  const category = (node.category || node.data?.category || '').toLowerCase();
  if (category.includes('core') || category.includes('primitive') || category.includes('foundation') || category.includes('principle')) {
    return true;
  }
  return degree >= 3;
}

function getNodeName(node: any): string {
  return node.name || node.data?.name || node.label || node.data?.label || node.id;
}

function getNodeCategory(node: any): string | undefined {
  return node.category || node.data?.category;
}

/**
 * Generates an intelligent, graph-grounded guided revision sequence (Phase 5 Section 2 & 7).
 * Priority:
 * 1. concepts marked "Review Again"
 * 2. concepts connected to those concepts
 * 3. important/core concepts
 * 4. concepts not recently reviewed
 */
export function generateRevisionPath({
  allNodes,
  allEdges = [],
  reviewConceptIds,
  testedConceptIds: _testedConceptIds,
  practiceStates = {},
  startConceptId,
  onlyReviewQueue = false
}: GenerateRevisionPathParams): RevisionPathStep[] {
  if (!allNodes || allNodes.length === 0) {
    return [];
  }

  // 1. Normalize Review Concept IDs
  const reviewSet = new Set<string>();
  if (reviewConceptIds) {
    const list = reviewConceptIds instanceof Set ? Array.from(reviewConceptIds) : reviewConceptIds;
    for (const id of list) {
      if (id) reviewSet.add(id);
    }
  }
  // Also include persistent practice states marked needs-review
  for (const [id, state] of Object.entries(practiceStates)) {
    if (state?.status === 'needs-review') {
      reviewSet.add(id);
    }
  }

  // If onlyReviewQueue is requested and nothing is marked for review, return empty array for empty state (Section 18)
  if (onlyReviewQueue && reviewSet.size === 0) {
    return [];
  }

  // 2. Build Adjacency Map from allEdges & node relationships
  const adjacencyMap = new Map<string, AdjacencyEdge[]>();
  for (const n of allNodes) {
    adjacencyMap.set(n.id, []);
  }

  // From allEdges
  for (const edge of allEdges) {
    const edgeType = edge.label || edge.data?.relation || edge.data?.type;
    if (adjacencyMap.has(edge.source)) {
      adjacencyMap.get(edge.source)!.push({
        targetId: edge.target,
        type: edgeType,
        direction: 'outgoing'
      });
    }
    if (adjacencyMap.has(edge.target)) {
      adjacencyMap.get(edge.target)!.push({
        targetId: edge.source,
        type: edgeType,
        direction: 'incoming'
      });
    }
  }

  // From node relationships & directConnections
  for (const n of allNodes) {
    const connections = [
      ...(n.directConnections || []),
      ...(n.data?.directConnections || []),
      ...(n.relationships || []),
      ...(n.data?.relationships || [])
    ];
    for (const conn of connections) {
      const target = conn.targetId || conn.target;
      if (target && target !== n.id && adjacencyMap.has(n.id) && adjacencyMap.has(target)) {
        const existing = adjacencyMap.get(n.id)!;
        if (!existing.some(e => e.targetId === target)) {
          existing.push({
            targetId: target,
            type: conn.type,
            direction: conn.direction === 'incoming' ? 'incoming' : 'outgoing'
          });
        }
      }
    }
  }

  // 3. Compute degree centrality for core detection
  const degreeMap = new Map<string, number>();
  for (const [id, edges] of adjacencyMap.entries()) {
    degreeMap.set(id, edges.length);
  }

  // 4. Candidate subset if onlyReviewQueue is active
  let candidateNodeIds: Set<string>;
  if (onlyReviewQueue) {
    candidateNodeIds = new Set<string>();
    // Include all review concepts
    for (const rId of reviewSet) {
      if (adjacencyMap.has(rId)) {
        candidateNodeIds.add(rId);
        // Include direct neighbors of review concepts for contextual learning
        const neighbors = adjacencyMap.get(rId) || [];
        for (const nb of neighbors) {
          candidateNodeIds.add(nb.targetId);
        }
      }
    }
  } else {
    candidateNodeIds = new Set(allNodes.map(n => n.id));
  }

  const nodeLookup = new Map<string, any>(allNodes.map(n => [n.id, n]));
  const visited = new Set<string>();
  const path: RevisionPathStep[] = [];

  // Helper to add a step
  const addStep = (nodeId: string, reason: RevisionReason, connectedThrough?: string, relType?: string) => {
    const node = nodeLookup.get(nodeId);
    if (!node || visited.has(nodeId)) return;
    visited.add(nodeId);
    path.push({
      conceptId: nodeId,
      conceptName: getNodeName(node),
      category: getNodeCategory(node),
      reason,
      connectedThroughConceptId: connectedThrough,
      relationshipType: relType,
      isCore: isCoreConcept(node, degreeMap.get(nodeId) || 0)
    });
  };

  // Helper to choose the next best seed when a chain ends
  const findNextSeed = (): string | null => {
    // 1. Review concepts not yet visited
    for (const rId of reviewSet) {
      if (!visited.has(rId) && candidateNodeIds.has(rId)) {
        return rId;
      }
    }
    // 2. Core concepts not yet visited
    for (const [id, node] of nodeLookup.entries()) {
      if (!visited.has(id) && candidateNodeIds.has(id) && isCoreConcept(node, degreeMap.get(id) || 0)) {
        return id;
      }
    }
    // 3. Any unvisited candidate
    for (const id of candidateNodeIds) {
      if (!visited.has(id)) {
        return id;
      }
    }
    return null;
  };

  // 5. Determine Starting Node
  let currentId: string = '';
  if (startConceptId && nodeLookup.has(startConceptId) && candidateNodeIds.has(startConceptId)) {
    currentId = startConceptId;
  } else {
    currentId = findNextSeed() || '';
  }

  if (!currentId) {
    return [];
  }

  // Add initial step
  const initialNode = nodeLookup.get(currentId)!;
  const initialReason: RevisionReason = reviewSet.has(currentId)
    ? 'marked-for-review'
    : isCoreConcept(initialNode, degreeMap.get(currentId) || 0)
    ? 'core-concept'
    : 'unreviewed';

  addStep(currentId, initialReason);

  // 6. Trace Connected Chains along actual relationships
  while (visited.size < candidateNodeIds.size) {
    const rawNeighbors: AdjacencyEdge[] = adjacencyMap.get(currentId) || [];
    const neighbors: AdjacencyEdge[] = rawNeighbors
      .filter(e => candidateNodeIds.has(e.targetId) && !visited.has(e.targetId));

    if (neighbors.length > 0) {
      // Score and rank neighbors according to revision priorities
      neighbors.sort((a: AdjacencyEdge, b: AdjacencyEdge) => {
        const aNode = nodeLookup.get(a.targetId);
        const bNode = nodeLookup.get(b.targetId);
        const aInReview = reviewSet.has(a.targetId);
        const bInReview = reviewSet.has(b.targetId);
        if (aInReview && !bInReview) return -1;
        if (!aInReview && bInReview) return 1;

        const aCore = isCoreConcept(aNode, degreeMap.get(a.targetId) || 0);
        const bCore = isCoreConcept(bNode, degreeMap.get(b.targetId) || 0);
        if (aCore && !bCore) return -1;
        if (!aCore && bCore) return 1;

        // Prefer outgoing relationships
        if (a.direction === 'outgoing' && b.direction !== 'outgoing') return -1;
        if (a.direction !== 'outgoing' && b.direction === 'outgoing') return 1;

        return 0;
      });

      const nextEdge: AdjacencyEdge = neighbors[0];
      const nextId: string = nextEdge.targetId;
      const nextReason: RevisionReason = reviewSet.has(nextId)
        ? 'marked-for-review'
        : 'connected-concept';

      addStep(nextId, nextReason, currentId, nextEdge.type);
      currentId = nextId;
    } else {
      // Connected branch reached its end, jump to the next unvisited seed
      const nextSeedId = findNextSeed();
      if (!nextSeedId) break;

      const seedNode = nodeLookup.get(nextSeedId)!;
      const seedReason: RevisionReason = reviewSet.has(nextSeedId)
        ? 'marked-for-review'
        : isCoreConcept(seedNode, degreeMap.get(nextSeedId) || 0)
        ? 'core-concept'
        : 'unreviewed';

      addStep(nextSeedId, seedReason);
      currentId = nextSeedId;
    }
  }

  return path;
}
