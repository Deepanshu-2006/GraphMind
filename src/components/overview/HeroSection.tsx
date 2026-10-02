import React, { useState, useEffect } from 'react';
import { ArrowUpRight } from 'lucide-react';

interface HeroSectionProps {
  onCreateGraph: () => void;
  onExploreDemo: () => void;
  selectedConceptId?: string;
  onSelectConcept?: (id: string) => void;
}

interface HeroNodeDef {
  id: string;
  name: string;
  category: string;
  summary: string;
  x: number;
  y: number;
  radius: number;
  connections: string[];
}

const HERO_NODES: HeroNodeDef[] = [
  {
    id: 'c1',
    name: 'Machine Learning',
    category: 'Foundation',
    summary: 'A field focused on learning patterns and relationships directly from data.',
    x: 95,
    y: 135,
    radius: 19,
    connections: ['c6', 'c3']
  },
  {
    id: 'c6',
    name: 'Supervised Learning',
    category: 'Paradigm',
    summary: 'Learning predictive mapping functions from labeled training data.',
    x: 235,
    y: 60,
    radius: 16,
    connections: ['c1']
  },
  {
    id: 'c3',
    name: 'Deep Learning',
    category: 'Paradigm',
    summary: 'Multi-layer neural representations used to learn complex patterns.',
    x: 245,
    y: 205,
    radius: 20,
    connections: ['c1', 'c2', 'c5']
  },
  {
    id: 'c2',
    name: 'Neural Networks',
    category: 'Architecture',
    summary: 'Layered computational models performing parameterized non-linear transformations.',
    x: 395,
    y: 145,
    radius: 17,
    connections: ['c3', 'c4']
  },
  {
    id: 'c5',
    name: 'Computer Vision',
    category: 'Application',
    summary: 'Perceptual intelligence processing spatial structures and visual understanding.',
    x: 390,
    y: 235,
    radius: 16,
    connections: ['c3']
  },
  {
    id: 'c4',
    name: 'Transformers',
    category: 'Architecture',
    summary: 'Self-attention based network structures processing parallel contextual sequences.',
    x: 465,
    y: 75,
    radius: 16,
    connections: ['c2']
  }
];

interface HeroEdgeDef {
  sourceId: string;
  targetId: string;
  label: string;
}

const HERO_EDGES: HeroEdgeDef[] = [
  { sourceId: 'c1', targetId: 'c6', label: 'branch' },
  { sourceId: 'c1', targetId: 'c3', label: 'branch' },
  { sourceId: 'c3', targetId: 'c2', label: 'includes' },
  { sourceId: 'c3', targetId: 'c5', label: 'applied in' },
  { sourceId: 'c2', targetId: 'c4', label: 'architecture' }
];

export const HeroSection: React.FC<HeroSectionProps> = ({
  onCreateGraph,
  onExploreDemo,
  selectedConceptId,
  onSelectConcept
}) => {
  const [internalSelectedId, setInternalSelectedId] = useState<string>('c3');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [pointerPos, setPointerPos] = useState<{ x: number; y: number } | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(true), 60);
    return () => clearTimeout(timer);
  }, []);

  const activeId = hoveredId || selectedConceptId || internalSelectedId;
  const activeNode = HERO_NODES.find(n => n.id === activeId) || HERO_NODES[2];

  const connectedIds = new Set<string>([activeNode.id, ...activeNode.connections]);

  const handleSelect = (id: string) => {
    setInternalSelectedId(id);
    onSelectConcept?.(id);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const scaleX = 540 / rect.width;
    const scaleY = 270 / rect.height;
    setPointerPos({
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    });
  };

  const handlePointerLeave = () => {
    setPointerPos(null);
    setHoveredId(null);
  };

  const getNodeOffset = (nx: number, ny: number) => {
    if (!pointerPos) return { dx: 0, dy: 0 };
    const distX = pointerPos.x - nx;
    const distY = pointerPos.y - ny;
    const dist = Math.hypot(distX, distY);
    if (dist < 80 && dist > 0) {
      const factor = (1 - dist / 80) * 3;
      return {
        dx: (distX / dist) * factor,
        dy: (distY / dist) * factor
      };
    }
    return { dx: 0, dy: 0 };
  };

  return (
    <section className="overview-hero">
      {/* LEFT ZONE: Typography and actions */}
      <div className="overview-hero-left">
        <h1 className="overview-hero-title">
          Turn scattered knowledge<br />into a connected mind.
        </h1>

        <p className="overview-hero-desc">
          GraphMind transforms unstructured learning material into an interactive knowledge graph.
        </p>

        <div className="overview-hero-actions">
          <button 
            type="button"
            className="btn-primary"
            onClick={onCreateGraph}
            aria-label="Upload material"
            id="btn-overview-add-material"
          >
            <span>Upload material</span>
          </button>

          <button 
            type="button"
            className="btn-secondary"
            onClick={onExploreDemo}
            aria-label="Explore knowledge graph"
            id="btn-explore-demo-graph"
          >
            <span>Explore graph</span>
          </button>
        </div>
      </div>

      {/* RIGHT ZONE: Living miniature knowledge graph */}
      <div className="overview-hero-right">
        <div className="hero-graph-canvas-frame">
          <div className="hero-graph-topbar">
            <button 
              type="button"
              className="hero-workspace-link"
              onClick={onExploreDemo}
              aria-label="Open graph in workspace"
            >
              <span>Open in workspace</span>
              <ArrowUpRight size={13} />
            </button>
          </div>

          <svg 
            className={`hero-mini-svg ${settled ? 'settled' : 'initial'}`}
            viewBox="0 0 540 270"
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
            aria-label="Interactive preview graph"
          >
            {/* Edges */}
            {HERO_EDGES.map((edge) => {
              const source = HERO_NODES.find(n => n.id === edge.sourceId);
              const target = HERO_NODES.find(n => n.id === edge.targetId);
              if (!source || !target) return null;

              const isConnected = edge.sourceId === activeId || edge.targetId === activeId;
              const sourceOffset = getNodeOffset(source.x, source.y);
              const targetOffset = getNodeOffset(target.x, target.y);

              const x1 = source.x + sourceOffset.dx;
              const y1 = source.y + sourceOffset.dy;
              const x2 = target.x + targetOffset.dx;
              const y2 = target.y + targetOffset.dy;

              const midX = (x1 + x2) / 2;
              const midY = (y1 + y2) / 2;

              return (
                <g key={`${edge.sourceId}-${edge.targetId}`} className="hero-edge-group">
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isConnected ? 'var(--accent)' : 'var(--border-default)'}
                    strokeWidth={isConnected ? 1.75 : 1}
                    strokeDasharray={isConnected ? 'none' : '3 3'}
                    opacity={isConnected ? 1 : activeId ? 0.35 : 0.8}
                    style={{ transition: 'stroke 180ms ease, stroke-width 180ms ease, opacity 180ms ease' }}
                  />

                  {/* Subtle label only shown on connected edge */}
                  {isConnected && edge.label && (
                    <g transform={`translate(${midX}, ${midY})`}>
                      <rect
                        x={-edge.label.length * 3.4 - 5}
                        y={-8}
                        width={edge.label.length * 6.8 + 10}
                        height={16}
                        rx={3}
                        fill="#0A0A0A"
                        stroke="rgba(163, 255, 18, 0.25)"
                        strokeWidth={0.8}
                      />
                      <text
                        y={3.5}
                        textAnchor="middle"
                        fill="var(--accent)"
                        fontSize="9.5"
                        fontFamily="var(--font-mono)"
                        letterSpacing="0.02em"
                      >
                        {edge.label}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Nodes */}
            {HERO_NODES.map((node) => {
              const isSelected = node.id === activeId;
              const isConnected = connectedIds.has(node.id);
              const offset = getNodeOffset(node.x, node.y);
              const cx = node.x + offset.dx;
              const cy = node.y + offset.dy;

              return (
                <g
                  key={node.id}
                  className="hero-node-group"
                  transform={`translate(${cx}, ${cy})`}
                  onClick={() => handleSelect(node.id)}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select concept ${node.name}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelect(node.id);
                    }
                  }}
                  style={{
                    cursor: 'pointer',
                    opacity: isConnected ? 1 : 0.35,
                    transition: 'opacity 180ms ease, transform 200ms cubic-bezier(0.16, 1, 0.3, 1)'
                  }}
                >
                  {/* Subtle Halo for Selected Node */}
                  {isSelected && (
                    <circle
                      r={node.radius + 6}
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="1"
                      strokeDasharray="3 2"
                      opacity={0.7}
                    />
                  )}

                  {/* Node Circle */}
                  <circle
                    r={node.radius}
                    fill={isSelected ? '#141414' : '#101010'}
                    stroke={isSelected ? 'var(--accent)' : isConnected ? '#383838' : '#222222'}
                    strokeWidth={isSelected ? 1.75 : 1.2}
                    style={{ transition: 'all 180ms ease' }}
                  />

                  {/* Core Indicator Dot */}
                  <circle
                    r={3.5}
                    fill={isSelected ? 'var(--accent)' : isConnected ? '#F5F5F5' : '#666666'}
                    style={{ transition: 'fill 180ms ease' }}
                  />

                  {/* Node Label */}
                  <text
                    y={node.radius + 15}
                    textAnchor="middle"
                    fill={isSelected ? '#F5F5F5' : isConnected ? '#A1A1A1' : '#666666'}
                    fontSize="11.5"
                    fontFamily="var(--font-body)"
                    fontWeight={isSelected ? 500 : 400}
                    style={{ transition: 'fill 180ms ease' }}
                  >
                    {node.name}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* Compact Contextual Description Bar (Section 3) */}
          <div className="hero-graph-context" aria-live="polite">
            <div className="hero-context-header">
              <span className="hero-context-name">{activeNode.name}</span>
              <span className="hero-context-type">{activeNode.category}</span>
            </div>
            <p className="hero-context-desc">"{activeNode.summary}"</p>
          </div>
        </div>
      </div>
    </section>
  );
};
