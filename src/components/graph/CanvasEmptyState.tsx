import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowUpRight } from 'lucide-react';

interface CanvasEmptyStateProps {
  onOpenUpload?: () => void;
  isDragOver?: boolean;
  onDragEnter?: React.DragEventHandler;
  onDragOver?: React.DragEventHandler;
  onDragLeave?: React.DragEventHandler;
  onDrop?: React.DragEventHandler;
}

export type NodeTier = 'primary' | 'secondary' | 'tertiary';

export interface PreGraphNode {
  id: string;
  x: number;
  y: number;
  r: number;
  tier: NodeTier;
  isAccent?: boolean; // Permanent GraphMind green
  driftClass: string;
  delaySec: number;
}

export interface PreGraphEdge {
  id: string;
  source: string;
  target: string;
}

// 16 nodes arranged into 4 loose organic clusters + 2 isolated bridging nodes
// Breaking any perimeter ring/polygon and maintaining an unobstructed quiet center
export const PRE_GRAPH_NODES: PreGraphNode[] = [
  // Cluster 1: Upper-Left (4 nodes)
  { id: 'n1', x: 135, y: 145, r: 2.25, tier: 'secondary', driftClass: 'node-drift-1', delaySec: 0.2 },
  { id: 'n2', x: 215, y: 110, r: 3.25, tier: 'primary', isAccent: true, driftClass: 'node-drift-2', delaySec: 1.1 },
  { id: 'n3', x: 250, y: 180, r: 1.5, tier: 'tertiary', driftClass: 'node-drift-3', delaySec: 2.4 },
  { id: 'n4', x: 160, y: 225, r: 2.0, tier: 'secondary', driftClass: 'node-drift-4', delaySec: 0.7 },

  // Cluster 2: Upper-Right (4 nodes)
  { id: 'n5', x: 775, y: 130, r: 2.25, tier: 'secondary', driftClass: 'node-drift-3', delaySec: 1.8 },
  { id: 'n6', x: 860, y: 95, r: 1.5, tier: 'tertiary', driftClass: 'node-drift-5', delaySec: 0.4 },
  { id: 'n7', x: 895, y: 185, r: 3.25, tier: 'primary', isAccent: true, driftClass: 'node-drift-1', delaySec: 2.9 },
  { id: 'n8', x: 820, y: 210, r: 2.0, tier: 'secondary', driftClass: 'node-drift-4', delaySec: 1.5 },

  // Cluster 3: Lower-Left (3 nodes)
  { id: 'n9', x: 145, y: 535, r: 2.25, tier: 'secondary', driftClass: 'node-drift-2', delaySec: 2.1 },
  { id: 'n10', x: 220, y: 585, r: 1.5, tier: 'tertiary', driftClass: 'node-drift-6', delaySec: 0.9 },
  { id: 'n11', x: 185, y: 470, r: 2.0, tier: 'secondary', driftClass: 'node-drift-3', delaySec: 3.2 },

  // Cluster 4: Lower-Right (3 nodes)
  { id: 'n12', x: 840, y: 555, r: 3.25, tier: 'primary', isAccent: true, driftClass: 'node-drift-5', delaySec: 1.3 },
  { id: 'n13', x: 780, y: 505, r: 2.0, tier: 'secondary', driftClass: 'node-drift-4', delaySec: 2.7 },
  { id: 'n14', x: 890, y: 475, r: 1.5, tier: 'tertiary', driftClass: 'node-drift-1', delaySec: 0.6 },

  // Loose margin bridging nodes (2 nodes)
  { id: 'n15', x: 95, y: 345, r: 1.5, tier: 'tertiary', driftClass: 'node-drift-6', delaySec: 1.7 },
  { id: 'n16', x: 935, y: 330, r: 1.5, tier: 'tertiary', driftClass: 'node-drift-2', delaySec: 2.3 },
];

export const PRE_GRAPH_EDGES: PreGraphEdge[] = [
  // Cluster 1 internal relationships
  { id: 'e1-2', source: 'n1', target: 'n2' },
  { id: 'e2-3', source: 'n2', target: 'n3' },
  { id: 'e1-4', source: 'n1', target: 'n4' },
  { id: 'e4-3', source: 'n4', target: 'n3' },

  // Cluster 2 internal relationships
  { id: 'e5-6', source: 'n5', target: 'n6' },
  { id: 'e6-7', source: 'n6', target: 'n7' },
  { id: 'e7-8', source: 'n7', target: 'n8' },
  { id: 'e5-8', source: 'n5', target: 'n8' },

  // Cluster 3 internal relationships
  { id: 'e9-10', source: 'n9', target: 'n10' },
  { id: 'e9-11', source: 'n9', target: 'n11' },

  // Cluster 4 internal relationships
  { id: 'e12-13', source: 'n12', target: 'n13' },
  { id: 'e12-14', source: 'n12', target: 'n14' },

  // Loose margin relationships
  { id: 'e4-15', source: 'n4', target: 'n15' },
  { id: 'e7-16', source: 'n7', target: 'n16' },
];

const nodeMap = new Map(PRE_GRAPH_NODES.map(n => [n.id, n]));

export const CanvasEmptyState: React.FC<CanvasEmptyStateProps> = ({
  onOpenUpload,
  isDragOver = false,
  onDragEnter,
  onDragOver,
  onDragLeave,
  onDrop,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offsets, setOffsets] = useState<Record<string, { dx: number; dy: number; active: boolean }>>({});
  const [hoveredGreenNodeId, setHoveredGreenNodeId] = useState<string | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Pre-calculate edge lengths for initial staggered stroke drawing animation
  const edgeLengths = useMemo(() => {
    const lengths: Record<string, number> = {};
    for (const edge of PRE_GRAPH_EDGES) {
      const s = nodeMap.get(edge.source);
      const t = nodeMap.get(edge.target);
      if (s && t) {
        lengths[edge.id] = Math.round(Math.hypot(t.x - s.x, t.y - s.y));
      }
    }
    return lengths;
  }, []);

  // Subtle cursor interaction: nearby cluster nodes deflect 1-2px toward cursor
  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    // Convert client coordinates to 1000x700 viewBox coordinate space
    const mx = ((e.clientX - rect.left) / rect.width) * 1000;
    const my = ((e.clientY - rect.top) / rect.height) * 700;

    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);

    rafIdRef.current = requestAnimationFrame(() => {
      const newOffsets: Record<string, { dx: number; dy: number; active: boolean }> = {};
      const INFLUENCE_RADIUS = 115;
      let closestNode: { id: string; dist: number } | null = null;

      for (const node of PRE_GRAPH_NODES) {
        const dist = Math.hypot(node.x - mx, node.y - my);
        if (dist < INFLUENCE_RADIUS) {
          const factor = (1 - dist / INFLUENCE_RADIUS) * 1.8; // 1-2px deflection toward cursor
          const angle = Math.atan2(my - node.y, mx - node.x);
          newOffsets[node.id] = {
            dx: Math.cos(angle) * factor,
            dy: Math.sin(angle) * factor,
            active: true,
          };

          if (!closestNode || dist < closestNode.dist) {
            closestNode = { id: node.id, dist };
          }
        }
      }

      setOffsets(newOffsets);
      setHoveredGreenNodeId(closestNode ? closestNode.id : null);
    });
  }, []);

  const handlePointerLeave = useCallback(() => {
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    // Smoothly relax back to resting position
    setOffsets({});
    setHoveredGreenNodeId(null);
  }, []);

  useEffect(() => {
    return () => {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`graph-canvas-overlay empty-overlay ${isDragOver ? 'is-drag-over' : ''}`}
      id="graph-empty-overlay"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
    >
      {/* =========================================================================
          LAYER 1 & 3: BACKGROUND UNBUILT KNOWLEDGE GRAPH (Organic Clusters)
          ========================================================================= */}
      <svg
        className="canvas-empty-pregraph-svg"
        viewBox="0 0 1000 700"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        {/* Subtle Pre-graph Relationships: Staggered initial stroke-draw sequence */}
        <g className="pregraph-edges-group">
          {PRE_GRAPH_EDGES.map((edge, index) => {
            const sourceNode = nodeMap.get(edge.source);
            const targetNode = nodeMap.get(edge.target);
            if (!sourceNode || !targetNode) return null;

            const sOffset = offsets[edge.source] || { dx: 0, dy: 0, active: false };
            const tOffset = offsets[edge.target] || { dx: 0, dy: 0, active: false };

            const x1 = sourceNode.x + sOffset.dx;
            const y1 = sourceNode.y + sOffset.dy;
            const x2 = targetNode.x + tOffset.dx;
            const y2 = targetNode.y + tOffset.dy;

            const isEdgeHighlighted = sOffset.active || tOffset.active;
            const length = edgeLengths[edge.id] || 100;

            return (
              <line
                key={edge.id}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                className={`pregraph-edge ${isEdgeHighlighted ? 'is-highlighted' : ''}`}
                style={{
                  '--edge-len': `${length}px`,
                  strokeDasharray: length,
                  animationDelay: `${320 + index * 45}ms`,
                } as React.CSSProperties}
              />
            );
          })}
        </g>

        {/* Potential Pre-graph Nodes in 3 HIERARCHICAL LEVELS */}
        <g className="pregraph-nodes-group">
          {PRE_GRAPH_NODES.map(node => {
            const offset = offsets[node.id] || { dx: 0, dy: 0, active: false };
            const cx = node.x + offset.dx;
            const cy = node.y + offset.dy;
            const isGreen = node.isAccent || hoveredGreenNodeId === node.id;

            let tierClass = 'tier-tertiary';
            if (node.tier === 'primary' || isGreen) {
              tierClass = 'tier-primary';
            } else if (node.tier === 'secondary') {
              tierClass = 'tier-secondary';
            }

            return (
              <g
                key={node.id}
                className={`pregraph-node-anchor ${node.driftClass}`}
                style={{
                  animationDelay: `${node.delaySec}s`,
                }}
              >
                <circle
                  cx={cx}
                  cy={cy}
                  r={isGreen ? Math.max(node.r, 2.75) : node.r}
                  className={`pregraph-node-circle ${tierClass} ${isGreen ? 'is-green' : ''}`}
                />
              </g>
            );
          })}
        </g>
      </svg>

      {/* =========================================================================
          LAYER 2: FOREGROUND EDITORIAL CONTENT BLOCK
          Central quiet zone with tightened eyebrow and dominant typography
          ========================================================================= */}
      <div className="canvas-empty-editorial-block">
        {/* 01 — Small Editorial Eyebrow with 4px GraphMind Green Dot */}
        <div className="canvas-empty-eyebrow">
          <span className="eyebrow-accent-dot" aria-hidden="true" />
          <span className="eyebrow-label">KNOWLEDGE GRAPH / EMPTY CANVAS</span>
        </div>

        {/* 02 — Large Dominant Editorial Heading */}
        <h1 className="canvas-empty-heading" id="empty-canvas-heading">
          {isDragOver ? (
            <>
              Drop material<br />
              to build graph.
            </>
          ) : (
            <>
              Build your first<br />
              knowledge graph.
            </>
          )}
        </h1>

        {/* 03 — Supporting Educational Copy */}
        <p className="canvas-empty-description">
          {isDragOver
            ? 'GraphMind will extract concepts and map their relationships.'
            : 'Upload your study material and GraphMind will map the concepts and relationships inside it.'}
        </p>

        {/* 04 & 05 — Text-First Editorial CTA with sliding arrow & supported formats */}
        <div className="canvas-empty-cta-container">
          <button
            type="button"
            className="canvas-editorial-action-btn"
            onClick={onOpenUpload}
            id="btn-empty-upload-material"
            aria-label="Upload material to build your first knowledge graph"
          >
            <span>UPLOAD MATERIAL</span>
            <ArrowUpRight size={14} className="editorial-arrow-icon" aria-hidden="true" />
          </button>

          <span className="canvas-empty-formats-label">
            PDF · TXT · MARKDOWN
          </span>
        </div>
      </div>
    </div>
  );
};
