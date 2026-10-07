import { MarkerType } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import type { 
  GraphConceptData, 
  GraphDensityMode, 
  ConceptVisibilityState, 
  ZoomDisclosureLevel 
} from '../types/graph';

/**
 * =========================================================================
 * GRAPH VIEWPORT PRESENTATION LAYER
 * 
 * CORE PRINCIPLE:
 * Keep the complete knowledge graph in memory.
 * Only render the most useful subset in the current viewport.
 * 
 * Implements an intelligent visibility scoring and exploration depth model:
 * - Depth 0: Selected concept (focused)
 * - Depth 1: Direct meaningful connections (contextual / highlighted)
 * - Depth 2: Secondary contextual connections (contextual)
 * - Rest: Background concepts (visible) or filtered from canvas (hidden)
 * 
 * For small graphs (<= 20 concepts): renders all concepts naturally.
 * For large graphs (> 20 concepts): uses density budgets (Focused, Balanced, Expanded).
 * Guaranteed layout stability: node (x, y) coordinates never jitter or jump.
 * =========================================================================
 */

export interface GraphViewportParams {
  allNodes: Node<GraphConceptData>[];
  allEdges: Edge[];
  selectedNodeId: string | null;
  densityMode: GraphDensityMode;
  zoomLevel?: ZoomDisclosureLevel;
  exploredNodeIds?: string[];
  studyFilterMode?: import('../types/practice').StudyFilterMode;
  practiceStates?: Record<string, import('../types/practice').ConceptPracticeState>;
  recalledConceptIds?: Set<string> | string[];
  reviewConceptIds?: Set<string> | string[];
}

export interface GraphViewportResult {
  visibleNodes: Node<GraphConceptData>[];
  visibleEdges: Edge[];
  totalNodeCount: number;
  renderedNodeCount: number;
  isSubsetEnabled: boolean;
  densityMode: GraphDensityMode;
  contextualHint?: string;
  hiddenCount: number;
}

// Density budget constraints for large graphs
const DENSITY_BUDGETS: Record<GraphDensityMode, { min: number; max: number; maxDepth1: number; maxDepth2: number }> = {
  focused: { min: 8, max: 14, maxDepth1: 8, maxDepth2: 4 },
  balanced: { min: 20, max: 30, maxDepth1: 14, maxDepth2: 8 },
  expanded: { min: 45, max: 80, maxDepth1: 25, maxDepth2: 20 }
};

/**
 * Category hierarchy weight for intrinsic concept importance
 */
const CATEGORY_WEIGHTS: Record<string, number> = {
  foundation: 20,
  paradigm: 16,
  architecture: 12,
  method: 8,
  application: 4
};

/**
 * Relationship priority weight (prerequisites and foundations rank higher)
 */
const RELATIONSHIP_WEIGHTS: Record<string, number> = {
  'prerequisite': 10,
  'foundation-for': 10,
  'part-of': 8,
  'implements': 8,
  'extends': 7,
  'uses': 6,
  'applied-to': 5,
  'instance-of': 5,
  'related-to': 4
};

/**
 * Computes an intrinsic concept importance score based on:
 * - Stated confidence / extraction score
 * - Number of connections (degree centrality)
 * - Knowledge category (Foundations rank higher than leaf applications)
 * - Source citations / document grounding
 */
export function computeConceptPriority(
  node: Node<GraphConceptData>,
  incidentDegree: number
): number {
  const data = node.data;
  const baseConfidence = typeof data.confidence === 'number' ? data.confidence : 80;
  const categoryBonus = CATEGORY_WEIGHTS[(data.category || '').toLowerCase()] || 6;
  const degreeBonus = incidentDegree * 4.5;
  const sourceBonus = Math.min(15, (data.sources?.length || (data.source ? 1 : 0)) * 3);

  return Math.round(baseConfidence + categoryBonus + degreeBonus + sourceBonus);
}

/**
 * Calculates the visible graph subset for presentation in the canvas.
 * Preserves the full underlying graph in data and keeps coordinates stable.
 */
export function calculateVisibleGraph({
  allNodes,
  allEdges,
  selectedNodeId,
  densityMode = 'balanced',
  zoomLevel = 'standard',
  studyFilterMode = 'all',
  practiceStates = {},
  recalledConceptIds,
  reviewConceptIds
}: GraphViewportParams): GraphViewportResult {
  const totalCount = allNodes.length;
  const recalledSet = recalledConceptIds instanceof Set ? recalledConceptIds : new Set(recalledConceptIds || []);
  const reviewSet = reviewConceptIds instanceof Set ? reviewConceptIds : new Set(reviewConceptIds || []);

  // Compute filtered nodes & direct neighbors for revision/study filter
  const reviewNodeIds = new Set<string>();
  const targetFilterStatus = studyFilterMode === 'needs-review'
    ? 'needs-review'
    : studyFilterMode === 'in-progress'
    ? 'learning'
    : studyFilterMode === 'studied'
    ? 'understood'
    : null;

  if (targetFilterStatus) {
    for (const n of allNodes) {
      const pStatus = practiceStates[n.id]?.status || n.data.practiceStatus;
      if (pStatus === targetFilterStatus) {
        reviewNodeIds.add(n.id);
      }
    }
  }

  const reviewNeighbors = new Set<string>();
  if (targetFilterStatus && reviewNodeIds.size > 0) {
    for (const edge of allEdges) {
      if (reviewNodeIds.has(edge.source) && !reviewNodeIds.has(edge.target)) {
        reviewNeighbors.add(edge.target);
      }
      if (reviewNodeIds.has(edge.target) && !reviewNodeIds.has(edge.source)) {
        reviewNeighbors.add(edge.source);
      }
    }
  }

  const isReviewFilterActive = Boolean(targetFilterStatus) && reviewNodeIds.size > 0;

  // -------------------------------------------------------------------------
  // 1. SMALL GRAPHS (<= 20 concepts): Show all naturally without artificial hiding
  // -------------------------------------------------------------------------
  if (totalCount <= 20) {
    const directNeighbors = new Set<string>();
    if (selectedNodeId) {
      for (const edge of allEdges) {
        if (edge.source === selectedNodeId) directNeighbors.add(edge.target);
        if (edge.target === selectedNodeId) directNeighbors.add(edge.source);
      }
    }

    const styledNodes: Node<GraphConceptData>[] = allNodes.map((node) => {
      const isSelected = Boolean(selectedNodeId && node.id === selectedNodeId);
      const isNeighbor = directNeighbors.has(node.id);
      const hasSelection = Boolean(selectedNodeId);

      let visibilityState: ConceptVisibilityState = 'visible';
      let explorationDepth = 3;
      let isDimmed = false;
      let isHighlighted = false;

      if (isReviewFilterActive) {
        const isReviewNode = reviewNodeIds.has(node.id);
        const isReviewNeighbor = reviewNeighbors.has(node.id);

        if (isReviewNode) {
          visibilityState = 'focused';
          explorationDepth = 0;
          isDimmed = false;
          isHighlighted = false;
        } else if (isReviewNeighbor) {
          visibilityState = 'contextual';
          explorationDepth = 1;
          isDimmed = false;
          isHighlighted = true;
        } else {
          visibilityState = 'visible';
          explorationDepth = 3;
          isDimmed = true;
          isHighlighted = false;
        }

        // Selection priority (Section 21)
        if (isSelected) {
          isDimmed = false;
          visibilityState = 'focused';
        }
      } else {
        if (isSelected) {
          visibilityState = 'focused';
          explorationDepth = 0;
        } else if (isNeighbor) {
          visibilityState = 'contextual';
          explorationDepth = 1;
          isHighlighted = true;
        }
        isDimmed = hasSelection && !isSelected && !isNeighbor;
      }

      return {
        ...node,
        selected: isSelected,
        data: {
          ...node.data,
          visibilityState,
          explorationDepth,
          zoomLevel,
          selected: isSelected,
          highlighted: isHighlighted,
          dimmed: isDimmed,
          isSessionRecalled: Boolean(recalledSet.has(node.id) || node.data?.isSessionRecalled),
          isSessionReview: Boolean(reviewSet.has(node.id) || node.data?.isSessionReview)
        }
      };
    });

    const styledEdges: Edge[] = allEdges.map((edge) => {
      let isIncident = false;
      let isDimmed = false;

      if (isReviewFilterActive) {
        const connectsReviewContext = 
          (reviewNodeIds.has(edge.source) && (reviewNodeIds.has(edge.target) || reviewNeighbors.has(edge.target))) ||
          (reviewNodeIds.has(edge.target) && (reviewNodeIds.has(edge.source) || reviewNeighbors.has(edge.source)));

        if (connectsReviewContext) {
          isIncident = true;
          isDimmed = false;
        } else {
          isIncident = false;
          isDimmed = true;
        }

        if (selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId)) {
          isIncident = true;
          isDimmed = false;
        }
      } else {
        isIncident = Boolean(
          selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId)
        );
        const hasSelection = Boolean(selectedNodeId);
        isDimmed = hasSelection && !isIncident;
      }

      return {
        ...edge,
        selected: isIncident,
        className: isIncident ? 'highlighted' : isDimmed ? 'dimmed' : '',
        data: {
          ...(edge.data || {}),
          isHighlighted: isIncident
        },
        style: {
          stroke: isIncident ? '#A3FF12' : isDimmed ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.12)',
          strokeWidth: isIncident ? 1.85 : 1,
          opacity: isDimmed ? 0.12 : 0.85
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 12,
          height: 12,
          color: isIncident ? '#A3FF12' : isDimmed ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.14)'
        }
      };
    });

    let contextualHint: string | undefined;
    if (studyFilterMode === 'needs-review') {
      contextualHint = reviewNodeIds.size === 0
        ? 'Nothing needs review yet'
        : `${reviewNodeIds.size} concept${reviewNodeIds.size === 1 ? '' : 's'} to review`;
    } else if (studyFilterMode === 'in-progress') {
      contextualHint = reviewNodeIds.size === 0
        ? 'No concepts in progress'
        : `${reviewNodeIds.size} concept${reviewNodeIds.size === 1 ? '' : 's'} in progress`;
    } else if (studyFilterMode === 'studied') {
      contextualHint = reviewNodeIds.size === 0
        ? 'No studied concepts yet'
        : `${reviewNodeIds.size} studied concept${reviewNodeIds.size === 1 ? '' : 's'}`;
    }

    return {
      visibleNodes: styledNodes,
      visibleEdges: styledEdges,
      totalNodeCount: totalCount,
      renderedNodeCount: totalCount,
      isSubsetEnabled: false,
      densityMode,
      contextualHint,
      hiddenCount: 0
    };
  }

  // -------------------------------------------------------------------------
  // 2. LARGE GRAPHS (> 20 concepts): Intelligent Viewport Presentation Layer
  // -------------------------------------------------------------------------
  // Build fast adjacency graph
  const adjacency = new Map<string, Array<{ targetId: string; edge: Edge; weight: number }>>();
  const degreeMap = new Map<string, number>();

  for (const n of allNodes) {
    adjacency.set(n.id, []);
    degreeMap.set(n.id, 0);
  }

  for (const edge of allEdges) {
    degreeMap.set(edge.source, (degreeMap.get(edge.source) || 0) + 1);
    degreeMap.set(edge.target, (degreeMap.get(edge.target) || 0) + 1);

    const relLabel = ((edge.label as string) || (edge.data as any)?.relation || '').toLowerCase();
    const weight = RELATIONSHIP_WEIGHTS[relLabel] || 5;

    adjacency.get(edge.source)?.push({ targetId: edge.target, edge, weight });
    adjacency.get(edge.target)?.push({ targetId: edge.source, edge, weight });
  }

  // Compute intrinsic priority scores for all nodes
  const priorityMap = new Map<string, number>();
  for (const node of allNodes) {
    const deg = degreeMap.get(node.id) || 0;
    const score = computeConceptPriority(node, deg);
    priorityMap.set(node.id, score);
  }

  // Determine exploration depth model from selectedNodeId
  const depthMap = new Map<string, number>();
  const depth1Neighbors: string[] = [];
  const depth2Neighbors: string[] = [];

  if (selectedNodeId && adjacency.has(selectedNodeId)) {
    depthMap.set(selectedNodeId, 0);

    // Depth 1: Direct neighbors sorted by relationship weight + intrinsic score
    const d1List = adjacency.get(selectedNodeId) || [];
    const sortedD1 = [...d1List]
      .sort((a, b) => {
        const scoreA = (priorityMap.get(a.targetId) || 0) + a.weight * 6;
        const scoreB = (priorityMap.get(b.targetId) || 0) + b.weight * 6;
        return scoreB - scoreA;
      })
      .map((item) => item.targetId);

    for (const neighborId of sortedD1) {
      if (!depthMap.has(neighborId)) {
        depthMap.set(neighborId, 1);
        depth1Neighbors.push(neighborId);
      }
    }

    // Depth 2: Secondary contextual connections
    for (const d1Id of depth1Neighbors) {
      const d2List = adjacency.get(d1Id) || [];
      for (const item of d2List) {
        if (!depthMap.has(item.targetId)) {
          depthMap.set(item.targetId, 2);
          depth2Neighbors.push(item.targetId);
        }
      }
    }
  }

  // Determine visible node set according to Density Budget
  const budget = DENSITY_BUDGETS[densityMode];
  const chosenNodeIds = new Set<string>();

  if (selectedNodeId && depthMap.has(selectedNodeId)) {
    // 1. Depth 0: Always include the selected node
    chosenNodeIds.add(selectedNodeId);

    // 2. Depth 1: Direct connections up to budget limit
    const d1ToInclude = depth1Neighbors.slice(0, budget.maxDepth1);
    for (const id of d1ToInclude) {
      chosenNodeIds.add(id);
    }

    // 3. Depth 2: Secondary connections up to budget limit
    const d2ToInclude = depth2Neighbors
      .sort((a, b) => (priorityMap.get(b) || 0) - (priorityMap.get(a) || 0))
      .slice(0, budget.maxDepth2);
    for (const id of d2ToInclude) {
      chosenNodeIds.add(id);
    }

    // 4. In Balanced / Expanded mode, include top global foundational hubs to provide global subject context
    if (densityMode !== 'focused') {
      const remainingSlots = budget.max - chosenNodeIds.size;
      if (remainingSlots > 0) {
        const globalCandidates = allNodes
          .filter((n) => !chosenNodeIds.has(n.id))
          .sort((a, b) => (priorityMap.get(b.id) || 0) - (priorityMap.get(a.id) || 0));

        for (let i = 0; i < Math.min(remainingSlots, globalCandidates.length); i++) {
          chosenNodeIds.add(globalCandidates[i].id);
        }
      }
    }
  } else {
    // No concept is currently selected: Initial View Composition
    // Prioritize major foundational concepts and key structural hubs
    // Stratified across categories to provide a balanced overview of the subject
    const byCategory = new Map<string, Node<GraphConceptData>[]>();
    for (const n of allNodes) {
      const cat = (n.data.category || 'Foundation').toLowerCase();
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat)!.push(n);
    }

    // Sort within each category by priority score
    for (const [, list] of byCategory) {
      list.sort((a, b) => (priorityMap.get(b.id) || 0) - (priorityMap.get(a.id) || 0));
    }

    const targetCount = budget.max;
    // Guaranteed quota from key categories for balanced subject representation
    const foundations = byCategory.get('foundation') || [];
    const paradigms = byCategory.get('paradigm') || [];
    const architectures = byCategory.get('architecture') || [];
    const methods = byCategory.get('method') || [];
    const applications = byCategory.get('application') || [];

    // Distribute slots proportionally
    const pickFrom = (list: Node<GraphConceptData>[], count: number) => {
      for (let i = 0; i < Math.min(count, list.length); i++) {
        chosenNodeIds.add(list[i].id);
      }
    };

    if (densityMode === 'focused') {
      // Focused without selection: top 10 core hubs
      const topGlobal = [...allNodes].sort((a, b) => (priorityMap.get(b.id) || 0) - (priorityMap.get(a.id) || 0));
      for (let i = 0; i < Math.min(budget.max, topGlobal.length); i++) {
        chosenNodeIds.add(topGlobal[i].id);
      }
    } else {
      pickFrom(foundations, Math.ceil(targetCount * 0.35));
      pickFrom(paradigms, Math.ceil(targetCount * 0.2));
      pickFrom(architectures, Math.ceil(targetCount * 0.2));
      pickFrom(methods, Math.ceil(targetCount * 0.15));
      pickFrom(applications, Math.ceil(targetCount * 0.1));

      // Fill remaining budget with highest priority nodes
      if (chosenNodeIds.size < targetCount) {
        const remaining = [...allNodes]
          .filter((n) => !chosenNodeIds.has(n.id))
          .sort((a, b) => (priorityMap.get(b.id) || 0) - (priorityMap.get(a.id) || 0));

        const needed = targetCount - chosenNodeIds.size;
        for (let i = 0; i < Math.min(needed, remaining.length); i++) {
          chosenNodeIds.add(remaining[i].id);
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // 3. ASSEMBLE VISIBLE NODES (Coordinates remain strictly fixed)
  // -------------------------------------------------------------------------
  const visibleNodes: Node<GraphConceptData>[] = [];
  const nodeLookup = new Map<string, Node<GraphConceptData>>();
  for (const n of allNodes) {
    nodeLookup.set(n.id, n);
  }

  // Ensure review nodes & neighbors are in chosenNodeIds when review filter is active
  if (isReviewFilterActive) {
    for (const rId of reviewNodeIds) {
      chosenNodeIds.add(rId);
    }
    for (const nId of reviewNeighbors) {
      chosenNodeIds.add(nId);
    }
  }

  for (const id of chosenNodeIds) {
    const originalNode = nodeLookup.get(id);
    if (!originalNode) continue;

    const depth = depthMap.get(id);
    const isSelected = id === selectedNodeId;
    const isDirectNeighbor = depth === 1;
    const hasSelection = Boolean(selectedNodeId);

    let visibilityState: ConceptVisibilityState = 'visible';
    let isDimmed = false;
    let isHighlighted = false;

    if (isReviewFilterActive) {
      const isReviewNode = reviewNodeIds.has(id);
      const isReviewNeighbor = reviewNeighbors.has(id);

      if (isReviewNode) {
        visibilityState = 'focused';
        isDimmed = false;
        isHighlighted = false;
      } else if (isReviewNeighbor) {
        visibilityState = 'contextual';
        isDimmed = false;
        isHighlighted = true;
      } else {
        visibilityState = 'visible';
        isDimmed = true;
        isHighlighted = false;
      }

      if (isSelected) {
        isDimmed = false;
        visibilityState = 'focused';
      }
    } else {
      if (isSelected) {
        visibilityState = 'focused';
      } else if (depth === 1 || depth === 2) {
        visibilityState = 'contextual';
      }
      isHighlighted = isDirectNeighbor;
      isDimmed = hasSelection && !isSelected && !isDirectNeighbor;
    }

    visibleNodes.push({
      ...originalNode,
      selected: isSelected,
      data: {
        ...originalNode.data,
        visibilityState,
        visibilityPriority: priorityMap.get(id) || 80,
        explorationDepth: depth ?? 3,
        zoomLevel,
        selected: isSelected,
        highlighted: isHighlighted,
        dimmed: isDimmed,
        isSessionRecalled: Boolean(recalledSet.has(id) || originalNode.data?.isSessionRecalled),
        isSessionReview: Boolean(reviewSet.has(id) || originalNode.data?.isSessionReview)
      }
    });
  }

  // -------------------------------------------------------------------------
  // 4. FILTER AND STYLE RELATIONSHIPS (EDGES)
  // -------------------------------------------------------------------------
  // Only draw edges between nodes currently present in the visible viewport subset
  const visibleNodeSet = chosenNodeIds;
  const visibleEdges: Edge[] = [];

  for (const edge of allEdges) {
    if (!visibleNodeSet.has(edge.source) || !visibleNodeSet.has(edge.target)) {
      continue;
    }

    let isIncident = false;
    let isDimmed = false;

    if (isReviewFilterActive) {
      const connectsReviewContext = 
        (reviewNodeIds.has(edge.source) && (reviewNodeIds.has(edge.target) || reviewNeighbors.has(edge.target))) ||
        (reviewNodeIds.has(edge.target) && (reviewNodeIds.has(edge.source) || reviewNeighbors.has(edge.source)));

      if (connectsReviewContext) {
        isIncident = true;
        isDimmed = false;
      } else {
        isIncident = false;
        isDimmed = true;
      }

      if (selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId)) {
        isIncident = true;
        isDimmed = false;
      }
    } else {
      isIncident = Boolean(
        selectedNodeId && (edge.source === selectedNodeId || edge.target === selectedNodeId)
      );
      const hasSelection = Boolean(selectedNodeId);
      isDimmed = hasSelection && !isIncident;
    }

    visibleEdges.push({
      ...edge,
      selected: isIncident,
      className: isIncident ? 'highlighted' : isDimmed ? 'dimmed' : '',
      data: {
        ...(edge.data || {}),
        isHighlighted: isIncident
      },
      style: {
        stroke: isIncident ? '#A3FF12' : isDimmed ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.12)',
        strokeWidth: isIncident ? 1.85 : 1,
        opacity: isDimmed ? 0.12 : 0.85
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 12,
        height: 12,
        color: isIncident ? '#A3FF12' : isDimmed ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.14)'
      }
    });
  }

  // Understated contextual hint
  let contextualHint: string | undefined;
  if (studyFilterMode === 'needs-review') {
    contextualHint = reviewNodeIds.size === 0
      ? 'Nothing needs review yet'
      : `${reviewNodeIds.size} concept${reviewNodeIds.size === 1 ? '' : 's'} to review`;
  } else if (studyFilterMode === 'in-progress') {
    contextualHint = reviewNodeIds.size === 0
      ? 'No concepts in progress'
      : `${reviewNodeIds.size} concept${reviewNodeIds.size === 1 ? '' : 's'} in progress`;
  } else if (studyFilterMode === 'studied') {
    contextualHint = reviewNodeIds.size === 0
      ? 'No studied concepts yet'
      : `${reviewNodeIds.size} studied concept${reviewNodeIds.size === 1 ? '' : 's'}`;
  } else if (densityMode === 'focused') {
    contextualHint = selectedNodeId 
      ? 'Focused on neighborhood' 
      : 'Focused view';
  } else if (densityMode === 'balanced') {
    contextualHint = 'Showing most relevant concepts';
  } else if (densityMode === 'expanded') {
    contextualHint = 'Expanded view';
  }

  return {
    visibleNodes,
    visibleEdges,
    totalNodeCount: totalCount,
    renderedNodeCount: visibleNodes.length,
    isSubsetEnabled: true,
    densityMode,
    contextualHint,
    hiddenCount: totalCount - visibleNodes.length
  };
}
