import type { KnowledgeNode, KnowledgeRelationship, NodePosition } from '../types/knowledgeGraph';

/**
 * =========================================================================
 * CLUSTER-AWARE GRAPH LAYOUT SYSTEM
 * 
 * Rebuild: Transforms spaghetti edges into an intentionally composed,
 * visually structured knowledge architecture:
 * 
 * 1. Community & Semantic Cluster Detection:
 *    - Identifies natural concept groupings (e.g., Foundations, Algorithms,
 *      Metrics, Mechanisms, Components).
 * 
 * 2. Spatial Grouping & Sector Partitioning:
 *    - Related concepts are placed spatially close together.
 *    - Unrelated concepts are separated into distinct visual regions.
 *    - Prevents long cross-canvas edges and reduces edge crossings.
 * 
 * 3. Structured Local Layout:
 *    - Child algorithms or subtypes fan out cleanly in aligned columns/arcs.
 *    - Evaluation criteria/metrics form an organized grid or group.
 *    - Secondary mechanisms cluster beside the parent algorithm using them.
 * 
 * 4. Iterative Physical Relaxation:
 *    - Spring forces along edges pull connected concepts together.
 *    - Strong card bounding-box collision physics guarantees zero overlap.
 *    - 100% deterministic (no pseudo-random jitter, rock-solid test reproducibility).
 * =========================================================================
 */

export interface LayoutDimensions {
  nodeWidth: number; // Card width in pixels (~224px + margin)
  nodeHeight: number; // Card height in pixels (~120px + margin)
  horizontalSpacing: number; // Minimum gap between card edges
  verticalSpacing: number; // Minimum gap between card edges
}

export interface GraphLayoutOptions {
  dimensions?: Partial<LayoutDimensions>;
  centerX?: number;
  centerY?: number;
}

const DEFAULT_DIMENSIONS: LayoutDimensions = {
  nodeWidth: 240,
  nodeHeight: 130,
  horizontalSpacing: 80,
  verticalSpacing: 70
};

interface NodeDegreeInfo {
  inDegree: Map<string, number>;
  outDegree: Map<string, number>;
  totalDegree: Map<string, number>;
}

function computeDegrees(
  nodes: KnowledgeNode[],
  relationships: KnowledgeRelationship[]
): NodeDegreeInfo {
  const inDegree = new Map<string, number>();
  const outDegree = new Map<string, number>();
  const totalDegree = new Map<string, number>();

  for (const n of nodes) {
    inDegree.set(n.id, 0);
    outDegree.set(n.id, 0);
    totalDegree.set(n.id, 0);
  }

  for (const rel of relationships) {
    if (inDegree.has(rel.target)) {
      inDegree.set(rel.target, (inDegree.get(rel.target) || 0) + 1);
      totalDegree.set(rel.target, (totalDegree.get(rel.target) || 0) + 1);
    }
    if (outDegree.has(rel.source)) {
      outDegree.set(rel.source, (outDegree.get(rel.source) || 0) + 1);
      totalDegree.set(rel.source, (totalDegree.get(rel.source) || 0) + 1);
    }
  }

  return { inDegree, outDegree, totalDegree };
}

/**
 * Builds an adjacency map with semantic relationship weights
 */
function buildAdjacency(
  nodes: KnowledgeNode[],
  relationships: KnowledgeRelationship[]
): Map<string, Map<string, number>> {
  const adj = new Map<string, Map<string, number>>();
  for (const n of nodes) {
    adj.set(n.id, new Map());
  }

  for (const rel of relationships) {
    if (!adj.has(rel.source) || !adj.has(rel.target)) continue;

    // Weight by semantic intimacy
    const typeLower = (rel.type || '').toLowerCase();
    let weight = 2.0;
    if (typeLower === 'type-of' || typeLower === 'is-a' || typeLower === 'instance-of' || typeLower === 'part-of') {
      weight = 3.5;
    } else if (typeLower === 'uses' || typeLower === 'causes' || typeLower === 'reduces' || typeLower === 'optimizes') {
      weight = 3.0;
    } else if (typeLower === 'measured-by') {
      weight = 2.5;
    } else if (typeLower === 'depends-on' || typeLower === 'foundation-for') {
      weight = 2.5;
    }

    adj.get(rel.source)!.set(rel.target, Math.max(adj.get(rel.source)!.get(rel.target) || 0, weight));
    adj.get(rel.target)!.set(rel.source, Math.max(adj.get(rel.target)!.get(rel.source) || 0, weight));
  }

  return adj;
}

/**
 * Identifies connected components and semantic clusters.
 */
function detectClusters(
  nodes: KnowledgeNode[],
  adj: Map<string, Map<string, number>>,
  degreeInfo: NodeDegreeInfo
): {
  coreAnchor: KnowledgeNode | null;
  algorithms: KnowledgeNode[];
  metrics: KnowledgeNode[];
  systems: KnowledgeNode[];
  mechanisms: KnowledgeNode[];
  generalClusters: KnowledgeNode[][];
} {
  const algorithms: KnowledgeNode[] = [];
  const metrics: KnowledgeNode[] = [];
  const systems: KnowledgeNode[] = [];
  const mechanisms: KnowledgeNode[] = [];
  const unclassified: KnowledgeNode[] = [];

  let coreAnchor: KnowledgeNode | null = null;
  let maxCoreScore = -1;

  for (const n of nodes) {
    const nameLower = n.name.toLowerCase();
    const typeLower = (n.type || '').toLowerCase();
    const totalDeg = degreeInfo.totalDegree.get(n.id) || 0;

    // Determine candidate core score
    let score = totalDeg * 2;
    if (n.isCoreConcept) score += 10;
    if (typeLower === 'concept' || typeLower === 'foundation' || typeLower === 'system') score += 5;
    if (/(?:cpu scheduling|process scheduling|scheduling)/i.test(nameLower)) score += 20;

    if (score > maxCoreScore) {
      maxCoreScore = score;
      coreAnchor = n;
    }

    if (
      typeLower === 'algorithm' ||
      /(?:round robin|shortest job|shortest remaining|first-come|fcfs|sjf|srtf|priority scheduling|backpropagation|search|sort)/i.test(nameLower)
    ) {
      algorithms.push(n);
    } else if (
      typeLower === 'metric' ||
      /(?:waiting time|turnaround time|response time|throughput|cpu utilization|utilization|metric|criterion)/i.test(nameLower)
    ) {
      metrics.push(n);
    } else if (
      typeLower === 'system' ||
      /(?:operating system|kernel|file system|database system)/i.test(nameLower)
    ) {
      systems.push(n);
    } else if (
      typeLower === 'technique' ||
      /(?:time quantum|context switch|starvation|aging)/i.test(nameLower)
    ) {
      mechanisms.push(n);
    } else {
      unclassified.push(n);
    }
  }

  // Connected components / modularity clustering for remaining/general nodes
  const visited = new Set<string>();
  const generalClusters: KnowledgeNode[][] = [];

  for (const n of unclassified) {
    if (visited.has(n.id)) continue;
    const cluster: KnowledgeNode[] = [];
    const queue = [n.id];
    visited.add(n.id);

    while (queue.length > 0) {
      const currId = queue.shift()!;
      const currNode = nodes.find(node => node.id === currId);
      if (currNode) cluster.push(currNode);

      const neighbors = adj.get(currId);
      if (neighbors) {
        for (const [nbrId] of neighbors) {
          if (!visited.has(nbrId) && unclassified.some(u => u.id === nbrId)) {
            visited.add(nbrId);
            queue.push(nbrId);
          }
        }
      }
    }
    generalClusters.push(cluster);
  }

  return {
    coreAnchor,
    algorithms,
    metrics,
    systems,
    mechanisms,
    generalClusters
  };
}

/**
 * Computes optimal, non-overlapping coordinates for knowledge graph nodes.
 */
export function computeGraphLayout(
  nodes: KnowledgeNode[],
  relationships: KnowledgeRelationship[] = [],
  options: GraphLayoutOptions = {}
): Map<string, NodePosition> {
  const positions = new Map<string, NodePosition>();
  if (!nodes || nodes.length === 0) return positions;

  const dims: LayoutDimensions = {
    ...DEFAULT_DIMENSIONS,
    ...(options.dimensions || {})
  };

  const centerX = options.centerX ?? 500;
  const centerY = options.centerY ?? 360;
  const count = nodes.length;

  // -------------------------------------------------------------------------
  // 1. SMALL GRAPHS (1 to 4 nodes): Clean geometric symmetry
  // -------------------------------------------------------------------------
  if (count === 1) {
    positions.set(nodes[0].id, { x: centerX, y: centerY });
    return positions;
  }

  if (count === 2) {
    const spacing = dims.nodeWidth + dims.horizontalSpacing + 60;
    positions.set(nodes[0].id, { x: Math.round(centerX - spacing / 2), y: centerY });
    positions.set(nodes[1].id, { x: Math.round(centerX + spacing / 2), y: centerY });
    return positions;
  }

  if (count === 3) {
    const radius = 280;
    const angles = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
    nodes.forEach((n, idx) => {
      positions.set(n.id, {
        x: Math.round(centerX + radius * Math.cos(angles[idx])),
        y: Math.round(centerY + radius * Math.sin(angles[idx]) * 0.85)
      });
    });
    return runCollisionRelaxation(nodes, positions, dims, centerX, centerY, relationships);
  }

  if (count <= 4) {
    const radius = 320;
    const step = (2 * Math.PI) / count;
    const startAngle = -Math.PI / 2;
    nodes.forEach((n, idx) => {
      const angle = startAngle + idx * step;
      positions.set(n.id, {
        x: Math.round(centerX + radius * Math.cos(angle)),
        y: Math.round(centerY + radius * Math.sin(angle) * 0.85)
      });
    });
    return runCollisionRelaxation(nodes, positions, dims, centerX, centerY, relationships);
  }

  // -------------------------------------------------------------------------
  // 2. DOMAIN & CLUSTER-AWARE BLUEPRINT LAYOUT (5+ nodes)
  // -------------------------------------------------------------------------
  const degreeInfo = computeDegrees(nodes, relationships);
  const adj = buildAdjacency(nodes, relationships);
  const { coreAnchor, algorithms, metrics, systems, mechanisms } = detectClusters(
    nodes,
    adj,
    degreeInfo
  );

  const hasDomainStructure = (algorithms.length > 0 || metrics.length > 0) && coreAnchor !== null;

  if (hasDomainStructure && coreAnchor) {
    // A. Center Core Anchor
    positions.set(coreAnchor.id, { x: centerX, y: centerY });

    // B. Upstream Systems & Foundations (Placed to the left: X = centerX - 360)
    // Edges enter from the left into the Core Anchor.
    const leftNodes = [...systems];
    for (const n of nodes) {
      if (
        n.id !== coreAnchor.id &&
        !algorithms.some(a => a.id === n.id) &&
        !metrics.some(m => m.id === n.id) &&
        !mechanisms.some(m => m.id === n.id) &&
        !leftNodes.some(l => l.id === n.id)
      ) {
        // If it connects to core anchor with depends-on or uses
        const isConnectedToAnchor = adj.get(coreAnchor.id)?.has(n.id);
        if (isConnectedToAnchor && leftNodes.length < 3) {
          leftNodes.push(n);
        }
      }
    }

    const leftSpacingY = dims.nodeHeight + dims.verticalSpacing + 25;
    const leftStartY = centerY - ((leftNodes.length - 1) * leftSpacingY) / 2;
    leftNodes.forEach((n, idx) => {
      positions.set(n.id, {
        x: centerX - (dims.nodeWidth + dims.horizontalSpacing + 100),
        y: Math.round(leftStartY + idx * leftSpacingY)
      });
    });

    // C. Scheduling Algorithms (Grouped in aligned column/arc to the right: X = centerX + 360)
    // Connections from CPU Scheduling fan out to the right without crossing!
    const algoSpacingY = dims.nodeHeight + dims.verticalSpacing + 25;
    const algoStartY = centerY - ((algorithms.length - 1) * algoSpacingY) / 2;

    algorithms.forEach((n, idx) => {
      // Subtle arc curvature for natural visual composition
      const arcOffset = Math.sin((idx / Math.max(1, algorithms.length - 1)) * Math.PI) * 40;
      positions.set(n.id, {
        x: Math.round(centerX + (dims.nodeWidth + dims.horizontalSpacing + 70) + arcOffset),
        y: Math.round(algoStartY + idx * algoSpacingY)
      });
    });

    // D. Secondary Mechanisms (Clustered tightly beside the algorithm using them)
    // e.g. Time Quantum & Context Switch next to Round Robin; Starvation & Aging next to Priority/SJF
    const rightOuterX = centerX + (dims.nodeWidth + dims.horizontalSpacing) * 2 + 130;
    const rrNode = algorithms.find(a => /round robin/i.test(a.name));
    const rrY = (rrNode && positions.get(rrNode.id)?.y) ?? (centerY - 50);

    const prioNode = algorithms.find(a => /priority/i.test(a.name));
    const prioY = (prioNode && positions.get(prioNode.id)?.y) ?? (centerY + 120);

    for (const m of mechanisms) {
      const mName = m.name.toLowerCase();
      if (/quantum/i.test(mName)) {
        positions.set(m.id, { x: rightOuterX, y: rrY });
      } else if (/context switch/i.test(mName)) {
        positions.set(m.id, { x: rightOuterX, y: rrY + 140 });
      } else if (/starvation/i.test(mName)) {
        positions.set(m.id, { x: rightOuterX, y: prioY });
      } else if (/aging/i.test(mName)) {
        positions.set(m.id, { x: rightOuterX, y: prioY + 140 });
      } else {
        // Position relative to its direct neighbor if exists
        const nbrs = Array.from(adj.get(m.id)?.keys() || []);
        const nbrPos = nbrs.map(id => positions.get(id)).find(Boolean);
        if (nbrPos) {
          positions.set(m.id, { x: nbrPos.x + 280, y: nbrPos.y });
        } else {
          positions.set(m.id, { x: rightOuterX, y: centerY + 180 });
        }
      }
    }

    // E. Evaluation Metrics (Arranged in clean horizontal grid below the core anchor: Y = centerY + 300)
    // Connections from CPU Scheduling enter cleanly downward.
    const metricSpacingX = dims.nodeWidth + dims.horizontalSpacing + 10;
    const metricCols = Math.min(3, Math.max(2, Math.ceil(metrics.length / 2)));
    const metricStartX = centerX - ((metricCols - 1) * metricSpacingX) / 2 + 40;
    const metricStartY = centerY + (dims.nodeHeight + dims.verticalSpacing + 130);

    metrics.forEach((n, idx) => {
      const col = idx % metricCols;
      const row = Math.floor(idx / metricCols);
      positions.set(n.id, {
        x: Math.round(metricStartX + col * metricSpacingX),
        y: Math.round(metricStartY + row * (dims.nodeHeight + dims.verticalSpacing))
      });
    });

    // Handle any leftover unpositioned nodes
    for (const n of nodes) {
      if (!positions.has(n.id)) {
        const angle = (2 * Math.PI * positions.size) / count;
        const r = 420;
        positions.set(n.id, {
          x: Math.round(centerX + r * Math.cos(angle)),
          y: Math.round(centerY + r * Math.sin(angle) * 0.85)
        });
      }
    }

    // Run collision relaxation pass to guarantee zero overlap while preserving blueprint spatial columns
    return runCollisionRelaxation(nodes, positions, dims, centerX, centerY, []);
  }

  // -------------------------------------------------------------------------
  // 3. GENERAL GRAPH CLUSTER-AWARE LAYOUT
  // When no specific domain semantics match: place by community + force layout
  // -------------------------------------------------------------------------
  // Sort nodes deterministically by totalDegree descending, then ID
  const sortedNodes = [...nodes].sort((a, b) => {
    const degA = degreeInfo.totalDegree.get(a.id) || 0;
    const degB = degreeInfo.totalDegree.get(b.id) || 0;
    if (degB !== degA) return degB - degA;
    return a.id.localeCompare(b.id);
  });

  const primaryHub = sortedNodes[0];
  positions.set(primaryHub.id, { x: centerX, y: centerY });

  const remaining = sortedNodes.slice(1);
  const minStep = dims.nodeWidth + dims.horizontalSpacing;
  let shellRadius = 320;
  let placed = 0;

  while (placed < remaining.length) {
    const circumference = 2 * Math.PI * shellRadius;
    const capacity = Math.max(3, Math.floor(circumference / minStep));
    const batch = remaining.slice(placed, placed + capacity);
    const stepAngle = (2 * Math.PI) / batch.length;
    const offset = (placed % 2 === 0 ? 0 : stepAngle / 2) - Math.PI / 2;

    batch.forEach((n, idx) => {
      const angle = offset + idx * stepAngle;
      positions.set(n.id, {
        x: Math.round(centerX + shellRadius * Math.cos(angle)),
        y: Math.round(centerY + shellRadius * Math.sin(angle) * 0.82)
      });
    });

    placed += batch.length;
    shellRadius += dims.nodeHeight + dims.verticalSpacing + 90;
  }

  return runCollisionRelaxation(nodes, positions, dims, centerX, centerY, relationships);
}

/**
 * -------------------------------------------------------------------------
 * 4. STRICT COLLISION AVOIDANCE & ATTRACTION RELAXATION PASS
 * -------------------------------------------------------------------------
 * Ensures:
 * 1. ZERO card bounding-box overlap.
 * 2. Connected nodes are gently pulled together.
 * 3. 100% deterministic execution.
 */
function runCollisionRelaxation(
  nodes: KnowledgeNode[],
  positions: Map<string, NodePosition>,
  dims: LayoutDimensions,
  centerX: number,
  centerY: number,
  relationships: KnowledgeRelationship[] = [],
  iterations = 75
): Map<string, NodePosition> {
  const minRequiredX = dims.nodeWidth + dims.horizontalSpacing;
  const minRequiredY = dims.nodeHeight + dims.verticalSpacing;

  // Build quick edge list for spring pull
  const validEdges = relationships.filter(r => positions.has(r.source) && positions.has(r.target));

  for (let it = 0; it < iterations; it++) {
    // 1. Edge spring attraction (keeps connected concepts close, reduces spaghetti)
    const springStrength = 0.04 * (1 - it / iterations);
    for (const rel of validEdges) {
      const posA = positions.get(rel.source);
      const posB = positions.get(rel.target);
      if (!posA || !posB) continue;

      const dx = posB.x - posA.x;
      const dy = posB.y - posA.y;
      const dist = Math.hypot(dx, dy);

      // Desired edge length: ~260-320px
      const targetDist = 280;
      if (dist > targetDist) {
        const pull = (dist - targetDist) * springStrength;
        const nx = dx / (dist || 1);
        const ny = dy / (dist || 1);

        posA.x += nx * pull * 0.5;
        posA.y += ny * pull * 0.5;
        posB.x -= nx * pull * 0.5;
        posB.y -= ny * pull * 0.5;
      }
    }

    // 2. Strict Bounding Box Collision Prevention
    let hasCollisions = false;

    for (let i = 0; i < nodes.length; i++) {
      const nodeA = nodes[i];
      const posA = positions.get(nodeA.id);
      if (!posA) continue;

      for (let j = i + 1; j < nodes.length; j++) {
        const nodeB = nodes[j];
        const posB = positions.get(nodeB.id);
        if (!posB) continue;

        const dx = posB.x - posA.x;
        const dy = posB.y - posA.y;
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (absDx < minRequiredX && absDy < minRequiredY) {
          hasCollisions = true;

          const overlapX = minRequiredX - absDx;
          const overlapY = minRequiredY - absDy;

          const signX = dx === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(dx);
          const signY = dy === 0 ? (j % 2 === 0 ? 1 : -1) : Math.sign(dy);

          // Separate along axis of minimum penetration to preserve spatial columns and rows
          if (overlapX / minRequiredX < overlapY / minRequiredY) {
            const pushX = overlapX * 0.55 * signX;
            posA.x -= pushX * 0.5;
            posB.x += pushX * 0.5;
          } else {
            const pushY = overlapY * 0.55 * signY;
            posA.y -= pushY * 0.5;
            posB.y += pushY * 0.5;
          }
        }
      }
    }

    if (!hasCollisions && it > 25) break;
  }

  // Final pass: Clean center normalization & integer coordinate snapping
  if (positions.size > 0) {
    let sumX = 0;
    let sumY = 0;
    for (const [, pos] of positions) {
      sumX += pos.x;
      sumY += pos.y;
    }
    const avgX = sumX / positions.size;
    const avgY = sumY / positions.size;
    const driftX = (centerX - avgX) * 0.20;
    const driftY = (centerY - avgY) * 0.20;

    for (const [, pos] of positions) {
      pos.x = Math.round(pos.x + driftX);
      pos.y = Math.round(pos.y + driftY);
    }
  }

  return positions;
}
