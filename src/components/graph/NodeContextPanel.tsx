import React from 'react';
import type { GraphConceptData } from '../../types/graph';
import { X, ArrowUpRight } from 'lucide-react';

interface NodeContextPanelProps {
  concept: GraphConceptData | null;
  onClose: () => void;
  onSelectConcept: (conceptId: string) => void;
  onFocusNode: (conceptId: string) => void;
  isCollapsed: boolean;
}

export const NodeContextPanel: React.FC<NodeContextPanelProps> = ({
  concept,
  onClose,
  onSelectConcept,
  isCollapsed
}) => {
  if (isCollapsed || !concept) {
    return null;
  }

  return (
    <aside className="floating-node-inspector" aria-label="Concept inspector">
      {/* Top Header */}
      <div className="inspector-header">
        <div className="inspector-title-wrap">
          <span className="inspector-category">{concept.category}</span>
          <h2 className="inspector-name">{concept.label}</h2>
        </div>
        <button 
          className="inspector-close-btn" 
          onClick={onClose}
          aria-label="Close inspector"
        >
          <X size={15} />
        </button>
      </div>

      {/* Description */}
      <p className="inspector-desc">
        {concept.description}
      </p>

      {/* Connections List */}
      <div className="inspector-section">
        <span className="inspector-section-label">Connections</span>
        <div className="inspector-connections-list">
          {concept.relationships.map((rel, idx) => (
            <button
              key={`${rel.targetId}-${idx}`}
              className="inspector-conn-item"
              onClick={() => onSelectConcept(rel.targetId)}
              title={`View ${rel.targetName}`}
            >
              <span className="inspector-conn-bullet">•</span>
              <span className="inspector-conn-name">{rel.targetName}</span>
              <span className="inspector-conn-rel">({rel.type})</span>
              <ArrowUpRight size={12} className="inspector-conn-arrow" />
            </button>
          ))}
        </div>
      </div>

      {/* Source Citation */}
      <div className="inspector-footer">
        <span className="inspector-source-label">Source</span>
        <span className="inspector-source-value">{concept.source}</span>
      </div>
    </aside>
  );
};
