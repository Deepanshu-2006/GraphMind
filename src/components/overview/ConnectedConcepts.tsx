import React, { useState } from 'react';
import type { ConceptNode } from '../../types';
import { ArrowUpRight } from 'lucide-react';

interface ConnectedConceptsProps {
  concepts: ConceptNode[];
  onOpenExplore: () => void;
}

export const ConnectedConcepts: React.FC<ConnectedConceptsProps> = ({
  concepts,
  onOpenExplore
}) => {
  const [selectedId, setSelectedId] = useState<string>('c3'); // Deep Learning by default
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const activeId = hoveredId || selectedId;
  const activeConcept = concepts.find(c => c.id === activeId) || concepts[0];

  const connectedIds = new Set(
    activeConcept.connections.map(c => c.targetId)
  );
  connectedIds.add(activeConcept.id);

  // Concept node circle radius based on importance
  const getNodeRadius = (id: string) => {
    switch (id) {
      case 'c1': return 22; // Machine Learning
      case 'c3': return 24; // Deep Learning
      case 'c2': return 19; // Neural Networks
      case 'c4': return 19; // Transformers
      case 'c5': return 18; // Computer Vision
      default: return 18;
    }
  };

  return (
    <div className="overview-sections-container">
      {/* 1. Your Knowledge Graph Centerpiece */}
      <section className="overview-graph-section">
        <div className="overview-section-header">
          <div>
            <h2 className="overview-section-title">Your knowledge graph</h2>
            <p className="overview-section-desc">Interactive visual map of connected concepts</p>
          </div>
          <button 
            className="overview-text-btn" 
            onClick={onOpenExplore}
          >
            <span>Open in workspace</span>
            <ArrowUpRight size={14} />
          </button>
        </div>

        {/* Centerpiece Graph Board */}
        <div className="centerpiece-graph-board-wrap">
          <div className="centerpiece-graph-board">
            <svg className="centerpiece-svg" viewBox="0 0 900 360">
              {/* Edges */}
              {concepts.flatMap((source) =>
                source.connections.map((conn) => {
                  const target = concepts.find((c) => c.id === conn.targetId);
                  if (!target) return null;

                  const x1 = (source.x / 100) * 780 + 60;
                  const y1 = (source.y / 100) * 280 + 40;
                  const x2 = (target.x / 100) * 780 + 60;
                  const y2 = (target.y / 100) * 280 + 40;

                  const isConnectedToActive = source.id === activeId || target.id === activeId;
                  const isDirectPair = (source.id === activeId && target.id === selectedId) || 
                                       (target.id === activeId && source.id === selectedId);

                  return (
                    <line
                      key={`${source.id}-${target.id}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={isConnectedToActive ? 'var(--accent)' : 'var(--border-default)'}
                      strokeWidth={isConnectedToActive ? 1.75 : 1}
                      strokeDasharray={isConnectedToActive && !isDirectPair ? 'none' : '3 3'}
                      style={{ transition: 'stroke 200ms ease, stroke-width 200ms ease' }}
                    />
                  );
                })
              )}

              {/* Nodes */}
              {concepts.map((node) => {
                const cx = (node.x / 100) * 780 + 60;
                const cy = (node.y / 100) * 280 + 40;
                const isSelected = node.id === activeId;
                const isConnected = connectedIds.has(node.id);
                const radius = getNodeRadius(node.id);

                return (
                  <g
                    key={node.id}
                    className="centerpiece-node-group"
                    transform={`translate(${cx}, ${cy})`}
                    onClick={() => setSelectedId(node.id)}
                    onMouseEnter={() => setHoveredId(node.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{ 
                      cursor: 'pointer',
                      opacity: isConnected ? 1 : 0.35,
                      transition: 'opacity 200ms ease'
                    }}
                  >
                    {/* Selected halo */}
                    {isSelected && (
                      <circle
                        r={radius + 8}
                        fill="none"
                        stroke="var(--accent)"
                        strokeWidth="1.5"
                        strokeDasharray="4 2"
                        opacity={0.8}
                      />
                    )}

                    {/* Circular Node Body */}
                    <circle
                      r={radius}
                      fill={isSelected ? '#141414' : '#101010'}
                      stroke={isSelected ? 'var(--accent)' : isConnected ? '#444444' : '#2A2A2A'}
                      strokeWidth={isSelected ? 2 : 1.25}
                      style={{ transition: 'all 180ms ease' }}
                    />

                    {/* Center Core Dot */}
                    <circle
                      r="4.5"
                      fill={isSelected ? 'var(--accent)' : isConnected ? '#F5F5F5' : '#666666'}
                      style={{ transition: 'fill 180ms ease' }}
                    />

                    {/* Node Label Below */}
                    <text
                      y={radius + 18}
                      textAnchor="middle"
                      fill={isSelected ? '#F5F5F5' : isConnected ? '#A1A1A1' : '#666666'}
                      fontSize="13"
                      fontFamily="var(--font-body)"
                      fontWeight={isSelected ? 500 : 400}
                    >
                      {node.name}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Compact Node Info Inspector (Section 8) */}
            <div className="centerpiece-node-panel">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span className="node-panel-category">{activeConcept.category}</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {activeConcept.connections.length} connections
                </span>
              </div>

              <h3 className="node-panel-title">{activeConcept.name}</h3>

              <p className="node-panel-desc">{activeConcept.summary}</p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Connections</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {activeConcept.connections.map((c) => (
                    <button
                      key={c.targetId}
                      className="node-panel-conn-chip"
                      onClick={() => setSelectedId(c.targetId)}
                      title={`Focus ${c.targetName}`}
                    >
                      <span>{c.targetName}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-default)', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                <span>Source</span>
                <span style={{ color: 'var(--text-secondary)' }}>Lecture 04.pdf</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Recent Concepts Clean List (Section 12) */}
      <section className="overview-concepts-section">
        <div className="overview-section-header">
          <div>
            <h2 className="overview-section-title">Concepts</h2>
            <p className="overview-section-desc">Key concepts mapped in your graph</p>
          </div>
        </div>

        <div className="concepts-clean-list">
          {concepts.map((concept) => {
            const isSelected = concept.id === activeId;
            return (
              <div
                key={concept.id}
                className={`concept-clean-row ${isSelected ? 'selected' : ''}`}
                onClick={() => setSelectedId(concept.id)}
              >
                <div className="concept-clean-main">
                  <span
                    className="concept-clean-dot"
                    style={{ background: isSelected ? 'var(--accent)' : 'var(--border-hover)' }}
                  />
                  <span className="concept-clean-name">{concept.name}</span>
                  <span className="concept-clean-category">{concept.category}</span>
                </div>

                <div className="concept-clean-meta">
                  <span className="concept-clean-count">
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
