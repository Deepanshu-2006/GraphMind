import { useState } from 'react';
import type { ConceptNode } from '../../types';
import { Network, Grid, Share2, ArrowRight, Layers } from 'lucide-react';

interface ConnectedConceptsProps {
  concepts: ConceptNode[];
  onOpenExplore: () => void;
}

export const ConnectedConcepts: React.FC<ConnectedConceptsProps> = ({
  concepts,
  onOpenExplore
}) => {
  const [selectedConceptId, setSelectedConceptId] = useState<string>('c3'); // Default to Deep Learning (central hub)
  const [hoveredConceptId, setHoveredConceptId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'both' | 'graph' | 'matrix'>('both');

  const activeId = hoveredConceptId || selectedConceptId;
  const activeConcept = concepts.find(c => c.id === activeId) || concepts[0];

  // Helper to determine if an edge is connected to the active concept
  const isEdgeActive = (sourceId: string, targetId: string) => {
    return sourceId === activeId || targetId === activeId;
  };

  // Helper to get connected concepts for the active one
  const connectedTargetIds = new Set(
    activeConcept.connections.map(conn => conn.targetId)
  );

  return (
    <section className="recent-knowledge-section">
      {/* Section Header & View Toggles */}
      <div className="section-header-block">
        <div className="section-title-wrap">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className="section-label">Active Knowledge Graph</span>
            <span className="mono" style={{ fontSize: '10px', color: 'var(--accent-cyan)', background: 'var(--accent-cyan-dim)', padding: '2px 6px', borderRadius: '4px' }}>
              5 NODES CONNECTED
            </span>
          </div>
          <h2 className="section-heading">Recent Knowledge Synapses</h2>
          <p className="section-subtext">
            High-density conceptual cluster mapped from ingested papers, lectures, and transcripts.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* View mode switcher */}
          <div className="view-mode-tabs">
            <button
              className={`view-tab-btn ${viewMode === 'both' ? 'active' : ''}`}
              onClick={() => setViewMode('both')}
              title="Split View: Graph & Relational Matrix"
            >
              <Layers size={13} />
              <span>Full Topology</span>
            </button>
            <button
              className={`view-tab-btn ${viewMode === 'graph' ? 'active' : ''}`}
              onClick={() => setViewMode('graph')}
              title="Graph Constellation View Only"
            >
              <Network size={13} />
              <span>Synapse Graph</span>
            </button>
            <button
              className={`view-tab-btn ${viewMode === 'matrix' ? 'active' : ''}`}
              onClick={() => setViewMode('matrix')}
              title="Relational Matrix View Only"
            >
              <Grid size={13} />
              <span>Node Matrix</span>
            </button>
          </div>

          <button 
            className="btn-secondary" 
            onClick={onOpenExplore}
            style={{ padding: '6px 12px', fontSize: '12px' }}
          >
            <Share2 size={13} />
            <span>Interactive Canvas</span>
          </button>
        </div>
      </div>

      {/* Visual Connected Graph Canvas (Directly showing connectivity) */}
      {(viewMode === 'both' || viewMode === 'graph') && (
        <div className="graph-preview-board">
          <div className="graph-board-controls">
            <span className="canvas-badge">Click node to spotlight synapses</span>
            <span className="canvas-badge">
              Active: <strong style={{ color: 'var(--accent-cyan)' }}>{activeConcept.name}</strong> ({activeConcept.connections.length} links)
            </span>
          </div>

          <div className="graph-canvas-container">
            <svg className="graph-svg" viewBox="0 0 1000 380">
              <defs>
                {/* SVG glowing filters and gradients */}
                <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
                <linearGradient id="edge-grad-active" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00f2fe" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#818cf8" stopOpacity="0.8" />
                </linearGradient>
                <marker
                  id="arrow-active"
                  viewBox="0 0 10 10"
                  refX="18"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#00f2fe" />
                </marker>
                <marker
                  id="arrow-default"
                  viewBox="0 0 10 10"
                  refX="18"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 2 L 6 5 L 0 8 z" fill="rgba(255,255,255,0.25)" />
                </marker>
              </defs>

              {/* Background ambient mesh lines */}
              <circle cx="500" cy="190" r="160" fill="none" stroke="rgba(255,255,255,0.025)" strokeDasharray="3 3" />
              <circle cx="500" cy="190" r="100" fill="none" stroke="rgba(255,255,255,0.03)" strokeDasharray="4 4" />

              {/* Synapse Relationship Edges */}
              {concepts.flatMap((source) =>
                source.connections.map((conn) => {
                  const target = concepts.find((c) => c.id === conn.targetId);
                  if (!target) return null;

                  // Transform percentage coords to SVG canvas viewBox (1000 x 380)
                  const x1 = (source.x / 100) * 940 + 30;
                  const y1 = (source.y / 100) * 320 + 30;
                  const x2 = (target.x / 100) * 940 + 30;
                  const y2 = (target.y / 100) * 320 + 30;

                  const midX = (x1 + x2) / 2;
                  const midY = (y1 + y2) / 2;

                  const isActive = isEdgeActive(source.id, target.id);

                  return (
                    <g key={`${source.id}-${target.id}`}>
                      {/* Connection Line */}
                      <line
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        className={`synapse-edge ${isActive ? 'highlighted' : ''}`}
                        stroke={isActive ? 'url(#edge-grad-active)' : 'rgba(255, 255, 255, 0.12)'}
                        strokeWidth={isActive ? 2.5 : 1.2}
                        strokeDasharray={isActive ? 'none' : '4 4'}
                        markerEnd={isActive ? 'url(#arrow-active)' : 'url(#arrow-default)'}
                      />

                      {/* Directional Relation Tag along the edge */}
                      {isActive && (
                        <g transform={`translate(${midX}, ${midY - 8})`}>
                          <rect
                            x="-34"
                            y="-9"
                            width="68"
                            height="18"
                            rx="3"
                            fill="#0d0f14"
                            stroke="var(--accent-cyan)"
                            strokeWidth="1"
                            opacity="0.95"
                          />
                          <text
                            className="synapse-edge-label"
                            y="3"
                            textAnchor="middle"
                            fill="var(--accent-cyan)"
                            style={{ fontSize: '9px', fontWeight: 600 }}
                          >
                            {conn.relationType}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })
              )}

              {/* Concept Nodes */}
              {concepts.map((node) => {
                const cx = (node.x / 100) * 940 + 30;
                const cy = (node.y / 100) * 320 + 30;
                const isSelected = node.id === activeId;
                const isConnected = connectedTargetIds.has(node.id);

                return (
                  <g
                    key={node.id}
                    className="graph-node-group"
                    transform={`translate(${cx}, ${cy})`}
                    onClick={() => setSelectedConceptId(node.id)}
                    onMouseEnter={() => setHoveredConceptId(node.id)}
                    onMouseLeave={() => setHoveredConceptId(null)}
                  >
                    {/* Outer pulse aura for selected node */}
                    {isSelected && (
                      <circle
                        r={node.size + 10}
                        fill="none"
                        stroke={node.accentColor}
                        strokeWidth="1.5"
                        opacity="0.4"
                        strokeDasharray="4 2"
                      />
                    )}

                    {/* Node Core Background */}
                    <circle
                      r={node.size}
                      className="graph-node-circle"
                      fill={isSelected ? '#171e2c' : '#0d1017'}
                      stroke={isSelected ? 'var(--accent-cyan)' : isConnected ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.18)'}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      filter={isSelected ? 'url(#glow-cyan)' : undefined}
                    />

                    {/* Node Center Dot */}
                    <circle
                      r="4"
                      fill={node.accentColor}
                    />

                    {/* Node Label Text */}
                    <text
                      className="graph-node-label"
                      y={node.size + 18}
                      fill={isSelected ? 'var(--text-primary)' : 'var(--text-secondary)'}
                    >
                      {node.name}
                    </text>

                    {/* Node Metadata / Code */}
                    <text
                      className="graph-node-sub"
                      y={node.size + 30}
                    >
                      {node.code} • {node.synapseCount} links
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>
      )}

      {/* Relational Cards Grid - Visually Communicating Interconnection */}
      {(viewMode === 'both' || viewMode === 'matrix') && (
        <div className="connected-cards-grid">
          {concepts.map((concept) => {
            const isSelected = concept.id === activeId;
            const isDirectlyConnected = connectedTargetIds.has(concept.id);

            return (
              <div
                key={concept.id}
                className={`concept-card ${isSelected ? 'selected' : isDirectlyConnected ? 'peer-connected' : ''}`}
                onClick={() => setSelectedConceptId(concept.id)}
                onMouseEnter={() => setHoveredConceptId(concept.id)}
                onMouseLeave={() => setHoveredConceptId(null)}
                id={`concept-card-${concept.code.toLowerCase()}`}
              >
                <div className="concept-card-header">
                  <span className="concept-category-tag">{concept.category}</span>
                  <span className="concept-code">{concept.code}</span>
                </div>

                <div className="concept-title-row">
                  <h3 className="concept-title">{concept.name}</h3>
                  <span className="synapse-count-pill" title={`${concept.synapseCount} mapped synapses`}>
                    <Network size={11} />
                    <span>{concept.synapseCount}</span>
                  </span>
                </div>

                <p className="concept-summary">{concept.summary}</p>

                {/* Explicit Relational Synapses */}
                <div className="concept-connections-block">
                  <span className="connections-label">Mapped Synapse Links</span>
                  <div className="connection-chips-row">
                    {concept.connections.map((conn) => (
                      <span
                        key={`${concept.id}-${conn.targetId}`}
                        className="connection-chip"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedConceptId(conn.targetId);
                        }}
                        title={`Click to jump to ${conn.targetName}`}
                      >
                        <span className="relation-type-tag">{conn.relationType}</span>
                        <ArrowRight size={10} style={{ opacity: 0.5 }} />
                        <span>{conn.targetName}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
