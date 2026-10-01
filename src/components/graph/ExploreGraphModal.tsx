import { useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Network } from 'lucide-react';
import type { ConceptNode } from '../../types';

interface ExploreGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  concepts: ConceptNode[];
}

export const ExploreGraphModal: React.FC<ExploreGraphModalProps> = ({
  isOpen,
  onClose,
  concepts
}) => {
  const [selectedId, setSelectedId] = useState<string>('c3'); // Deep Learning by default
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [filterCategory, setFilterCategory] = useState<string>('ALL');

  if (!isOpen) return null;

  const activeNode = concepts.find(c => c.id === selectedId) || concepts[0];
  const filteredConcepts = filterCategory === 'ALL' 
    ? concepts 
    : concepts.filter(c => c.category.toUpperCase() === filterCategory);

  return (
    <div className="demo-graph-drawer">
      {/* Drawer Top Navigation */}
      <div className="demo-graph-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="brand-glyph" style={{ width: '28px', height: '28px' }}>
            <Network size={16} />
          </div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Interactive Knowledge Explorer
            </div>
            <div className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              TOPOLOGICAL MAP // CS898 • SPRING 2026
            </div>
          </div>
        </div>

        {/* Filter & Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-inset)', padding: '2px 4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            {(['ALL', 'FOUNDATION', 'ARCHITECTURE', 'PARADIGM', 'APPLICATION'] as const).map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(cat)}
                style={{
                  padding: '4px 8px',
                  borderRadius: 'var(--radius-xs)',
                  fontSize: '10.5px',
                  fontFamily: 'var(--font-mono)',
                  color: filterCategory === cat ? 'var(--accent-cyan)' : 'var(--text-muted)',
                  background: filterCategory === cat ? 'var(--accent-cyan-dim)' : 'transparent'
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--bg-surface-elevated)', padding: '4px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
            <button 
              className="topbar-action-btn" 
              style={{ width: '28px', height: '28px' }} 
              onClick={() => setZoomLevel(prev => Math.min(prev + 0.2, 1.8))}
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>
            <span className="mono" style={{ fontSize: '11px', padding: '0 6px', color: 'var(--text-muted)' }}>
              {Math.round(zoomLevel * 100)}%
            </span>
            <button 
              className="topbar-action-btn" 
              style={{ width: '28px', height: '28px' }} 
              onClick={() => setZoomLevel(prev => Math.max(prev - 0.2, 0.6))}
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>
            <button 
              className="topbar-action-btn" 
              style={{ width: '28px', height: '28px' }} 
              onClick={() => setZoomLevel(1)}
              title="Reset View"
            >
              <RotateCcw size={13} />
            </button>
          </div>

          <button className="modal-close-btn" onClick={onClose} aria-label="Close Explorer">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Fullscreen Canvas Area */}
      <div className="demo-graph-canvas-full">
        <svg 
          style={{ width: '100%', height: '100%', transform: `scale(${zoomLevel})`, transformOrigin: 'center center', transition: 'transform 0.2s ease-out' }}
          viewBox="0 0 1200 680"
        >
          <defs>
            <pattern id="grid-dots" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="1" fill="rgba(255,255,255,0.06)" />
            </pattern>
          </defs>

          {/* Background grid */}
          <rect width="100%" height="100%" fill="url(#grid-dots)" />

          {/* Connections */}
          {filteredConcepts.flatMap(source => 
            source.connections.map(conn => {
              const target = concepts.find(c => c.id === conn.targetId);
              if (!target) return null;

              const x1 = (source.x / 100) * 1100 + 50;
              const y1 = (source.y / 100) * 600 + 40;
              const x2 = (target.x / 100) * 1100 + 50;
              const y2 = (target.y / 100) * 600 + 40;

              const isHighlighted = source.id === selectedId || target.id === selectedId;

              return (
                <g key={`full-${source.id}-${target.id}`}>
                  <line
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke={isHighlighted ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.1)'}
                    strokeWidth={isHighlighted ? 2.5 : 1.2}
                    strokeDasharray={isHighlighted ? 'none' : '4 4'}
                  />
                  {isHighlighted && (
                    <text
                      x={(x1 + x2) / 2}
                      y={(y1 + y2) / 2 - 8}
                      fill="var(--accent-cyan)"
                      fontSize="10"
                      fontFamily="var(--font-mono)"
                      textAnchor="middle"
                    >
                      {conn.relationType}
                    </text>
                  )}
                </g>
              );
            })
          )}

          {/* Nodes */}
          {filteredConcepts.map(node => {
            const cx = (node.x / 100) * 1100 + 50;
            const cy = (node.y / 100) * 600 + 40;
            const isSelected = node.id === selectedId;

            return (
              <g 
                key={`node-full-${node.id}`}
                transform={`translate(${cx}, ${cy})`}
                onClick={() => setSelectedId(node.id)}
                style={{ cursor: 'pointer' }}
              >
                {isSelected && (
                  <circle
                    r={node.size + 14}
                    fill="none"
                    stroke="var(--accent-cyan)"
                    strokeWidth="1.5"
                    strokeDasharray="4 2"
                    opacity="0.6"
                  />
                )}
                <circle
                  r={node.size}
                  fill={isSelected ? '#141b27' : '#0e1118'}
                  stroke={isSelected ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.2)'}
                  strokeWidth={isSelected ? 3 : 1.5}
                />
                <circle r="4.5" fill={node.accentColor} />
                <text
                  y={node.size + 18}
                  fill="var(--text-primary)"
                  fontSize="12.5"
                  fontWeight="600"
                  fontFamily="var(--font-display)"
                  textAnchor="middle"
                >
                  {node.name}
                </text>
                <text
                  y={node.size + 32}
                  fill="var(--text-muted)"
                  fontSize="9.5"
                  fontFamily="var(--font-mono)"
                  textAnchor="middle"
                >
                  {node.code} • {node.synapseCount} links
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Node Details Card */}
        <div className="graph-floating-details">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="concept-category-tag">{activeNode.category}</span>
            <span className="mono" style={{ fontSize: '10px', color: 'var(--accent-cyan)' }}>
              {activeNode.code}
            </span>
          </div>

          <div style={{ fontSize: '17px', fontWeight: 600, color: 'var(--text-primary)' }}>
            {activeNode.name}
          </div>

          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {activeNode.summary}
          </p>

          <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div className="connections-label">Direct Synapse Connections ({activeNode.connections.length})</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {activeNode.connections.map(conn => (
                <span
                  key={conn.targetId}
                  className="connection-chip"
                  onClick={() => setSelectedId(conn.targetId)}
                  style={{ cursor: 'pointer' }}
                >
                  <span className="relation-type-tag">{conn.relationType}</span>
                  <span>{conn.targetName}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
