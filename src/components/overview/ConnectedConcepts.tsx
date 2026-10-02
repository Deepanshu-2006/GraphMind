import React, { useState, useRef } from 'react';
import type { ConceptNode } from '../../types';
import { ArrowUpRight } from 'lucide-react';

interface ConnectedConceptsProps {
  concepts: ConceptNode[];
  onOpenExplore: () => void;
  selectedConceptId?: string;
  onSelectConcept?: (id: string) => void;
}

export const ConnectedConcepts: React.FC<ConnectedConceptsProps> = ({
  concepts,
  onOpenExplore,
  selectedConceptId,
  onSelectConcept
}) => {
  const [internalSelectedId, setInternalSelectedId] = useState<string>('c3'); // Deep Learning default
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const graphContainerRef = useRef<HTMLDivElement>(null);

  const activeId = hoveredId || selectedConceptId || internalSelectedId;
  const activeConcept = concepts.find(c => c.id === activeId) || concepts[0];

  const connectedIds = new Set<string>(
    activeConcept ? [activeConcept.id, ...activeConcept.connections.map(c => c.targetId)] : []
  );

  const handleSelectNode = (id: string) => {
    setInternalSelectedId(id);
    onSelectConcept?.(id);
  };

  const handleRowClick = (id: string) => {
    handleSelectNode(id);
    if (graphContainerRef.current) {
      const rect = graphContainerRef.current.getBoundingClientRect();
      if (rect.top < 60 || rect.bottom > window.innerHeight) {
        graphContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  };

  // Node position helper ensuring clear, non-overlapping hierarchy
  const getNodePosition = (node: ConceptNode) => {
    switch (node.id) {
      case 'c1': return { cx: 140, cy: 170, radius: 22 }; // Machine Learning
      case 'c6': return { cx: 340, cy: 80, radius: 19 };  // Supervised Learning
      case 'c3': return { cx: 360, cy: 245, radius: 23 }; // Deep Learning
      case 'c2': return { cx: 575, cy: 155, radius: 20 }; // Neural Networks
      case 'c4': return { cx: 755, cy: 95, radius: 19 };  // Transformers
      case 'c5': return { cx: 590, cy: 265, radius: 19 }; // Computer Vision
      default: return {
        cx: (node.x / 100) * 720 + 80,
        cy: (node.y / 100) * 240 + 50,
        radius: 19
      };
    }
  };

  // Relationship label helper
  const getRelationLabel = (sourceId: string, targetId: string) => {
    const pair = [sourceId, targetId].sort().join('-');
    switch (pair) {
      case 'c1-c6': return 'branch';
      case 'c1-c3': return 'branch';
      case 'c2-c3': return 'includes';
      case 'c3-c5': return 'applied in';
      case 'c2-c4': return 'architecture';
      case 'c1-c5': return 'foundation';
      default: return null;
    }
  };

  // Unique edges set to avoid duplicate line drawing
  const renderedEdges = new Set<string>();

  return (
    <div className="overview-sections-container">
      {/* 1. Knowledge Graph Section (Section 8) */}
      <section className="overview-graph-section" ref={graphContainerRef}>
        <div className="overview-section-header">
          <div>
            <h2 className="overview-section-title">Your knowledge graph</h2>
            <p className="overview-section-desc">A visual map of the ideas found in your material.</p>
          </div>
          <button 
            type="button"
            className="overview-text-btn" 
            onClick={onOpenExplore}
            aria-label="Open knowledge graph in workspace"
          >
            <span>Open in workspace</span>
            <ArrowUpRight size={13} />
          </button>
        </div>

        {/* Framing: calm, dark canvas with subtle borders; NO large inspector panel overlay */}
        <div className="overview-graph-canvas-frame">
          <svg className="overview-graph-svg" viewBox="0 0 880 340" aria-label="Knowledge Graph Visualization">
            {/* Edges */}
            {concepts.flatMap((source) =>
              source.connections.map((conn) => {
                const target = concepts.find((c) => c.id === conn.targetId);
                if (!target) return null;

                const edgeKey = [source.id, target.id].sort().join('-');
                if (renderedEdges.has(edgeKey)) return null;
                renderedEdges.add(edgeKey);

                const sourcePos = getNodePosition(source);
                const targetPos = getNodePosition(target);

                const isConnectedToActive = source.id === activeId || target.id === activeId;
                const relationLabel = getRelationLabel(source.id, target.id);

                const midX = (sourcePos.cx + targetPos.cx) / 2;
                const midY = (sourcePos.cy + targetPos.cy) / 2;

                return (
                  <g key={edgeKey} className="overview-edge-group">
                    <line
                      x1={sourcePos.cx}
                      y1={sourcePos.cy}
                      x2={targetPos.cx}
                      y2={targetPos.cy}
                      stroke={isConnectedToActive ? 'var(--accent)' : 'var(--border-default)'}
                      strokeWidth={isConnectedToActive ? 1.75 : 1}
                      strokeDasharray={isConnectedToActive ? 'none' : '3 3'}
                      opacity={isConnectedToActive ? 1 : activeId ? 0.3 : 0.75}
                      style={{ transition: 'stroke 180ms ease, stroke-width 180ms ease, opacity 180ms ease' }}
                    />

                    {/* Subtle relationship label on active edges */}
                    {isConnectedToActive && relationLabel && (
                      <g transform={`translate(${midX}, ${midY})`}>
                        <rect
                          x={-relationLabel.length * 3.4 - 5}
                          y={-8.5}
                          width={relationLabel.length * 6.8 + 10}
                          height={17}
                          rx={3}
                          fill="#0C0C0C"
                          stroke="rgba(163, 255, 18, 0.28)"
                          strokeWidth={0.8}
                        />
                        <text
                          y={3.5}
                          textAnchor="middle"
                          fill="var(--accent)"
                          fontSize="10"
                          fontFamily="var(--font-mono)"
                          letterSpacing="0.02em"
                        >
                          {relationLabel}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })
            )}

            {/* Nodes */}
            {concepts.map((node) => {
              const { cx, cy, radius } = getNodePosition(node);
              const isSelected = node.id === activeId;
              const isConnected = connectedIds.has(node.id);

              return (
                <g
                  key={node.id}
                  className="overview-node-group"
                  transform={`translate(${cx}, ${cy})`}
                  onClick={() => handleSelectNode(node.id)}
                  onMouseEnter={() => setHoveredId(node.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Select concept ${node.name}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectNode(node.id);
                    }
                  }}
                  style={{
                    cursor: 'pointer',
                    opacity: isConnected ? 1 : 0.35,
                    transition: 'opacity 180ms ease'
                  }}
                >
                  {/* Subtle Halo for Selected Node */}
                  {isSelected && (
                    <circle
                      r={radius + 7}
                      fill="none"
                      stroke="var(--accent)"
                      strokeWidth="1.2"
                      strokeDasharray="4 2"
                      opacity={0.75}
                    />
                  )}

                  {/* Circular Node Body */}
                  <circle
                    r={radius}
                    fill={isSelected ? '#141414' : '#101010'}
                    stroke={isSelected ? 'var(--accent)' : isConnected ? '#404040' : '#222222'}
                    strokeWidth={isSelected ? 1.75 : 1.2}
                    style={{ transition: 'all 180ms ease' }}
                  />

                  {/* Core Dot */}
                  <circle
                    r="4"
                    fill={isSelected ? 'var(--accent)' : isConnected ? '#F5F5F5' : '#666666'}
                    style={{ transition: 'fill 180ms ease' }}
                  />

                  {/* Node Label Below */}
                  <text
                    y={radius + 17}
                    textAnchor="middle"
                    fill={isSelected ? '#F5F5F5' : isConnected ? '#A1A1A1' : '#666666'}
                    fontSize="12.5"
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
        </div>
      </section>

      {/* 2. Concepts Editorial Section (Section 9, 10, 11) */}
      <section className="overview-concepts-section">
        <div className="overview-section-header">
          <div>
            <h2 className="overview-section-title">Concepts</h2>
            <p className="overview-section-desc">The ideas GraphMind found in this material.</p>
          </div>
        </div>

        {/* Clean continuous list with subtle dividers */}
        <div className="concepts-editorial-list" role="list">
          {concepts.map((concept) => {
            const isSelected = concept.id === activeId;
            return (
              <div
                key={concept.id}
                className={`concept-editorial-row ${isSelected ? 'selected' : ''}`}
                onClick={() => handleRowClick(concept.id)}
                onMouseEnter={() => setHoveredId(concept.id)}
                onMouseLeave={() => setHoveredId(null)}
                role="button"
                tabIndex={0}
                aria-label={`Select concept ${concept.name}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRowClick(concept.id);
                  }
                }}
              >
                {/* Subtle green indicator on hover / selected */}
                <div className="concept-editorial-indicator" aria-hidden="true" />

                <div className="concept-editorial-ident">
                  <span className="concept-editorial-name">{concept.name}</span>
                  <span className="concept-editorial-type">{concept.category}</span>
                </div>

                <p className="concept-editorial-desc">{concept.summary}</p>

                <div className="concept-editorial-meta">
                  <span className="concept-editorial-count">
                    {concept.connections.length} {concept.connections.length === 1 ? 'connection' : 'connections'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
