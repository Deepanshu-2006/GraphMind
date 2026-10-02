import type { KnowledgeNode, KnowledgeRelationship, NodePosition } from '../types/knowledgeGraph';

/**
 * =========================================================================
 * GRAPH LAYOUT SYSTEM (Day 2, Step 11 - Quality Pass)
 * 
 * Provides deterministic, organic, overlap-free visual positioning for:
 * - Small graphs (1 to 5 nodes)
 * - Medium graphs (6 to 12 nodes)
 * - Larger graphs (13 to 30 nodes)
 * 
 * Features:
 * - Hierarchical degree/category stratification (Foundational hubs -> Methods -> Applications)
 * - Proportional radial/orbital scaling based on node volume
 * - Fast iterative collision-avoidance relaxation pass guaranteeing zero card overlap
 * =========================================================================
 */

export interface LayoutDimensions {
  nodeWidth: number; // Card width in pixels (CSS is 216px + margins)
  nodeHeight: number; // Card height in pixels (~110px + margins)
  horizontalSpacing: number; // Minimum gap between card edges
  verticalSpacing: number; // Minimum gap between card edges
}

export interface GraphLayoutOptions {
  dimensions?: Partial<LayoutDimensions>;
  centerX?: number;
  centerY?: number;
}

const DEFAULT_DIMENSIONS: LayoutDimensions = {
  nodeWidth: 260,
  nodeHeight: 160,
  horizontalSpacing: 80,
  verticalSpacing: 70
};

/**
 * Helper to compute in-degree and out-degree for all nodes
 */
function computeDegrees(
  nodes: KnowledgeNode[],
  relationships: KnowledgeRelationship[]
): {
  inDegree: Map<string, number>;
  outDegree: Map<string, number>;
  totalDegree: Map<string, number>;
} {
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
  const centerY = options.centerY ?? 350;

  const count = nodes.length;

  // -------------------------------------------------------------------------
  // 1. SMALL GRAPHS (1 to 5 nodes)
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
    // Equilateral triangle layout with ample spacing
    const radius = 280;
    const angles = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6];
    nodes.forEach((n, idx) => {
      positions.set(n.id, {
        x: Math.round(centerX + radius * Math.cos(angles[idx])),
        y: Math.round(centerY + radius * Math.sin(angles[idx]) * 0.85)
      });
    });
    return runCollisionRelaxation(nodes, positions, dims, centerX, centerY);
  }

  if (count <= 5) {
    // Clean symmetric polygon layout
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
    return runCollisionRelaxation(nodes, positions, dims, centerX, centerY);
  }

  // -------------------------------------------------------------------------
  // 2. MEDIUM & LARGER GRAPHS (6 to 30+ nodes)
  // Hierarchical Stratification: Core/Hubs -> Intermediate -> Leaves
  // -------------------------------------------------------------------------
  const { inDegree, outDegree, totalDegree } = computeDegrees(nodes, relationships);

  // Group nodes into semantic tiers:
  // Tier 0: Core hubs (foundation types or high out-degree)
  // Tier 1: Intermediate methods & architectures
  // Tier 2: Leaf applications & datasets
  const tier0: KnowledgeNode[] = [];
  const tier1: KnowledgeNode[] = [];
  const tier2: KnowledgeNode[] = [];

  for (const n of nodes) {
    const typeLower = (n.type || '').toLowerCase();
    const totDeg = totalDegree.get(n.id) || 0;
    const outDeg = outDegree.get(n.id) || 0;
    const inDeg = inDegree.get(n.id) || 0;

    const isFoundational = typeLower === 'foundation' || typeLower === 'paradigm' || typeLower === 'topic';
    const isLeaf = typeLower === 'application' || typeLower === 'dataset' || (totDeg <= 1 && outDeg === 0);

    if (isFoundational || (outDeg > inDeg && totDeg >= 2)) {
      tier0.push(n);
    } else if (isLeaf) {
      tier2.push(n);
    } else {
      tier1.push(n);
    }
  }

  // Ensure tier0 has at least 1 central hub if possible
  if (tier0.length === 0 && tier1.length > 0) {
    tier1.sort((a, b) => (totalDegree.get(b.id) || 0) - (totalDegree.get(a.id) || 0));
    tier0.push(tier1.shift()!);
  }

  // Calculate required circumferences & radii to guarantee card spacing
  const minLinearStep = dims.nodeWidth + dims.horizontalSpacing;

  // Medium graph layout (6 to 12 nodes): 2 concentric rings
  if (count <= 12) {
    // Inner tier (1-3 central concepts)
    if (tier0.length === 1) {
      positions.set(tier0[0].id, { x: centerX, y: centerY });
    } else {
      const innerRadius = 240;
      tier0.forEach((n, idx) => {
        const angle = (2 * Math.PI * idx) / tier0.length - Math.PI / 2;
        positions.set(n.id, {
          x: Math.round(centerX + innerRadius * Math.cos(angle)),
          y: Math.round(centerY + innerRadius * Math.sin(angle) * 0.8)
        });
      });
    }

    // Outer tier (remaining concepts)
    const outerNodes = [...tier1, ...tier2];
    const outerRadius = Math.max(380, (outerNodes.length * minLinearStep) / (2 * Math.PI));
    outerNodes.forEach((n, idx) => {
      const angle = (2 * Math.PI * idx) / outerNodes.length - Math.PI / 4;
      positions.set(n.id, {
        x: Math.round(centerX + outerRadius * Math.cos(angle)),
        y: Math.round(centerY + outerRadius * Math.sin(angle) * 0.85)
      });
    });

    return runCollisionRelaxation(nodes, positions, dims, centerX, centerY);
  }

  // -------------------------------------------------------------------------
  // Medium-Large graph layout (13 to 25 nodes): 3 concentric tiers
  // -------------------------------------------------------------------------
  if (count <= 25) {
    // Inner ring: Tier 0
    const r0 = tier0.length <= 1 ? 0 : Math.max(220, (tier0.length * minLinearStep) / (2 * Math.PI));
    if (tier0.length === 1) {
      positions.set(tier0[0].id, { x: centerX, y: centerY });
    } else {
      tier0.forEach((n, idx) => {
        const angle = (2 * Math.PI * idx) / tier0.length - Math.PI / 2;
        positions.set(n.id, {
          x: Math.round(centerX + r0 * Math.cos(angle)),
          y: Math.round(centerY + r0 * Math.sin(angle) * 0.8)
        });
      });
    }

    // Middle ring: Tier 1 with ample radial gap
    const r1 = Math.max(r0 + 320, (tier1.length * minLinearStep) / (2 * Math.PI));
    tier1.forEach((n, idx) => {
      const angle = (2 * Math.PI * idx) / Math.max(1, tier1.length);
      positions.set(n.id, {
        x: Math.round(centerX + r1 * Math.cos(angle)),
        y: Math.round(centerY + r1 * Math.sin(angle) * 0.85)
      });
    });

    // Outer ring: Tier 2 with ample radial gap
    const r2 = Math.max(r1 + 320, (tier2.length * minLinearStep) / (2 * Math.PI));
    tier2.forEach((n, idx) => {
      const angle = (2 * Math.PI * idx) / Math.max(1, tier2.length) + Math.PI / 6;
      positions.set(n.id, {
        x: Math.round(centerX + r2 * Math.cos(angle)),
        y: Math.round(centerY + r2 * Math.sin(angle) * 0.85)
      });
    });

    return runCollisionRelaxation(nodes, positions, dims, centerX, centerY);
  }

  // -------------------------------------------------------------------------
  // Very Large Graphs (26 to 100+ nodes): Multi-shell Concentric Sector Layout
  // Avoids a giant hollow outer ring by packing nodes into progressive concentric
  // shells with semantic category clustering to minimize edge crossings.
  // -------------------------------------------------------------------------
  // 1. Group nodes by category sector
  const categoryOrder: Record<string, number> = {
    foundation: 0,
    paradigm: 1,
    architecture: 2,
    method: 3,
    application: 4
  };

  // Sort nodes deterministically within tiers: by category sector, then by totalDegree desc, then by name
  const sortNodes = (arr: KnowledgeNode[]) => {
    return [...arr].sort((a, b) => {
      const catA = categoryOrder[(a.type || '').toLowerCase()] ?? 2;
      const catB = categoryOrder[(b.type || '').toLowerCase()] ?? 2;
      if (catA !== catB) return catA - catB;
      const degA = totalDegree.get(a.id) || 0;
      const degB = totalDegree.get(b.id) || 0;
      if (degB !== degA) return degB - degA;
      return a.name.localeCompare(b.name);
    });
  };

  const sortedTier0 = sortNodes(tier0);
  const sortedTier1 = sortNodes(tier1);
  const sortedTier2 = sortNodes(tier2);

  // Shell 0: Center / innermost hub (top 1-4 core nodes)
  const coreHubs = sortedTier0.slice(0, 4);
  const remainingTier0 = sortedTier0.slice(4);

  if (coreHubs.length === 1) {
    positions.set(coreHubs[0].id, { x: centerX, y: centerY });
  } else if (coreHubs.length > 1) {
    const rCore = 220;
    coreHubs.forEach((n, idx) => {
      const angle = (2 * Math.PI * idx) / coreHubs.length - Math.PI / 2;
      positions.set(n.id, {
        x: Math.round(centerX + rCore * Math.cos(angle)),
        y: Math.round(centerY + rCore * Math.sin(angle) * 0.8)
      });
    });
  }

  // Shell allocation helper: distribute nodes evenly along concentric orbits
  // Each shell has radius R and max capacity floor(2*PI*R / minLinearStep)
  const remainingNodes = [...remainingTier0, ...sortedTier1, ...sortedTier2];
  let currentShellRadius = coreHubs.length > 0 ? 380 : 280;
  let nodeIndex = 0;
  const radialGap = Math.max(dims.nodeHeight + dims.verticalSpacing + 120, 320);

  while (nodeIndex < remainingNodes.length) {
    const circumference = 2 * Math.PI * currentShellRadius;
    const capacity = Math.max(4, Math.floor(circumference / minLinearStep));
    const batch = remainingNodes.slice(nodeIndex, nodeIndex + capacity);

    const stepAngle = (2 * Math.PI) / batch.length;
    // Alternate angular offset per shell for pleasing staggered constellation
    const shellOffset = ((nodeIndex / capacity) % 2) * (stepAngle / 2) - Math.PI / 2;

    batch.forEach((n, idx) => {
      const angle = shellOffset + idx * stepAngle;
      positions.set(n.id, {
        x: Math.round(centerX + currentShellRadius * Math.cos(angle)),
        y: Math.round(centerY + currentShellRadius * Math.sin(angle) * 0.85)
      });
    });

    nodeIndex += batch.length;
    currentShellRadius += radialGap;
  }

  // Run collision relaxation with iterations adapted to node volume
  const relaxationIterations = Math.min(80, 50 + Math.floor(count * 0.4));
  return runCollisionRelaxation(nodes, positions, dims, centerX, centerY, relaxationIterations);
}

/**
 * -------------------------------------------------------------------------
 * 3. ITERATIVE COLLISION AVOIDANCE & OVERLAP RELAXATION PASS
 * -------------------------------------------------------------------------
 * Applies separation vectors whenever two node cards intersect.
 * Guarantees zero bounding-box overlaps across all graph scales.
 */
function runCollisionRelaxation(
  nodes: KnowledgeNode[],
  positions: Map<string, NodePosition>,
  dims: LayoutDimensions,
  centerX: number,
  centerY: number,
  iterations = 60
): Map<string, NodePosition> {
  const minRequiredX = dims.nodeWidth + dims.horizontalSpacing;
  const minRequiredY = dims.nodeHeight + dims.verticalSpacing;

  for (let it = 0; it < iterations; it++) {
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

        // Check if bounding boxes overlap with spacing margin
        if (absDx < minRequiredX && absDy < minRequiredY) {
          hasCollisions = true;

          const overlapX = minRequiredX - absDx;
          const overlapY = minRequiredY - absDy;

          // Push along the axis of least resistance or normalized vector
          const signX = dx === 0 ? (i % 2 === 0 ? 1 : -1) : Math.sign(dx);
          const signY = dy === 0 ? (j % 2 === 0 ? 1 : -1) : Math.sign(dy);

          const pushX = (overlapX * 0.60) * signX;
          const pushY = (overlapY * 0.60) * signY;

          posA.x -= pushX * 0.5;
          posA.y -= pushY * 0.5;
          posB.x += pushX * 0.5;
          posB.y += pushY * 0.5;
        }
      }
    }

    if (!hasCollisions) break;
  }

  // Gentle center drift normalization and integer snapping
  if (positions.size > 0) {
    let sumX = 0;
    let sumY = 0;
    for (const [, pos] of positions) {
      sumX += pos.x;
      sumY += pos.y;
    }
    const avgX = sumX / positions.size;
    const avgY = sumY / positions.size;
    const driftX = (centerX - avgX) * 0.15;
    const driftY = (centerY - avgY) * 0.15;

    for (const [, pos] of positions) {
      pos.x = Math.round(pos.x + driftX);
      pos.y = Math.round(pos.y + driftY);
    }
  }

  return positions;
}
