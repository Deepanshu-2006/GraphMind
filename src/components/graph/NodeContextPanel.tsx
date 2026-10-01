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
    <aside className="floating-node-inspector" aria-label="Concept details">
      {/* Header: Category + Name + Close */}
      <div className="inspector-header">
        <div className="inspector-title-wrap">
          <span className="inspector-category">{concept.category}</span>
          <h2 className="inspector-name">{concept.label}</h2>
        </div>
        <button 
          className="inspector-close-btn" 
          onClick={onClose}
          aria-label="Close panel"
          title="Close panel"
        >
          <X size={14} />
        </button>
      </div>

      {/* 1–2 sentence explanation */}
      <p className="inspector-desc">
        {concept.description}
      </p>

      {/* Connected Concepts (Section 4: Clickable exploration loop) */}
      {concept.relationships && concept.relationships.length > 0 && (
        <div className="inspector-section">
          <span className="inspector-section-label">Connected concepts</span>
          <div className="inspector-connections-list">
            {concept.relationships.map((rel, idx) => (
              <button
                key={`${rel.targetId}-${idx}`}
                className="inspector-conn-item"
                onClick={() => onSelectConcept(rel.targetId)}
                title={`Explore ${rel.targetName}`}
              >
                <span className="inspector-conn-bullet">•</span>
                <span className="inspector-conn-name">{rel.targetName}</span>
                {rel.type && <span className="inspector-conn-rel">{rel.type}</span>}
                <ArrowUpRight size={11} className="inspector-conn-arrow" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Source Citation (Section 5: visually secondary, gracefully omitted if missing) */}
      {concept.source && (
        <div className="inspector-footer">
          <span className="inspector-source-label">Source</span>
          <span className="inspector-source-value" title={concept.source}>
            {concept.source}
          </span>
        </div>
      )}
    </aside>
  );
};
