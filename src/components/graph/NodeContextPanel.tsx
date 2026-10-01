import React from 'react';
import type { GraphConceptData, SelectedRelationshipData } from '../../types/graph';
import { X, ArrowUpRight } from 'lucide-react';

interface NodeContextPanelProps {
  concept: GraphConceptData | null;
  selectedRelationship?: SelectedRelationshipData | null;
  onClose: () => void;
  onSelectConcept: (conceptId: string) => void;
  onFocusNode: (conceptId: string) => void;
  isCollapsed: boolean;
}

export const NodeContextPanel: React.FC<NodeContextPanelProps> = ({
  concept,
  selectedRelationship,
  onClose,
  onSelectConcept,
  isCollapsed
}) => {
  if (isCollapsed || (!concept && !selectedRelationship)) {
    return null;
  }

  // 1. Relationship Source Traceability View (Prompt 20, Requirement 4)
  if (selectedRelationship) {
    const hasMultipleSources = selectedRelationship.sourceNames && selectedRelationship.sourceNames.length > 1;

    return (
      <aside className="floating-node-inspector" aria-label="Relationship details">
        {/* Mobile bottom sheet drag handle */}
        <div className="inspector-drag-handle" aria-hidden="true" />

        {/* Header: Relationship + Connection + Close */}
        <div className="inspector-header">
          <div className="inspector-title-wrap">
            <span className="inspector-category">Relationship</span>
            <h2 className="inspector-name" style={{ fontSize: '15px' }}>
              {selectedRelationship.sourceName} <span style={{ color: 'var(--accent)' }}>→</span> {selectedRelationship.targetName}
            </h2>
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

        {/* Relationship Type Badge */}
        <div style={{ marginTop: '2px', marginBottom: '8px' }}>
          <span 
            className="edge-semantic-badge active" 
            style={{ position: 'static', transform: 'none', display: 'inline-block' }}
          >
            {selectedRelationship.type}
          </span>
        </div>

        {/* Short explanation / evidence quote */}
        {selectedRelationship.description && (
          <p className="inspector-desc">
            {selectedRelationship.description}
          </p>
        )}

        {/* Connected Concepts navigation */}
        <div className="inspector-section">
          <span className="inspector-section-label">Connected concepts</span>
          <div className="inspector-connections-list">
            <button
              className="inspector-conn-item"
              onClick={() => onSelectConcept(selectedRelationship.sourceId)}
              title={`View ${selectedRelationship.sourceName}`}
            >
              <span className="inspector-conn-bullet">•</span>
              <span className="inspector-conn-name">{selectedRelationship.sourceName}</span>
              <span className="inspector-conn-rel">source</span>
              <ArrowUpRight size={11} className="inspector-conn-arrow" />
            </button>
            <button
              className="inspector-conn-item"
              onClick={() => onSelectConcept(selectedRelationship.targetId)}
              title={`View ${selectedRelationship.targetName}`}
            >
              <span className="inspector-conn-bullet">•</span>
              <span className="inspector-conn-name">{selectedRelationship.targetName}</span>
              <span className="inspector-conn-rel">target</span>
              <ArrowUpRight size={11} className="inspector-conn-arrow" />
            </button>
          </div>
        </div>

        {/* Relationship Source Citation */}
        {hasMultipleSources ? (
          <div className="inspector-sources-container">
            <span className="inspector-source-label">Sources</span>
            <div className="inspector-sources-compact-list">
              {selectedRelationship.sourceNames!.map((name, idx) => (
                <div key={idx} className="inspector-source-item" title={name}>
                  <span className="inspector-source-bullet">•</span>
                  <span className="inspector-source-value">{name}</span>
                </div>
              ))}
            </div>
          </div>
        ) : selectedRelationship.sourceNames && selectedRelationship.sourceNames.length === 1 ? (
          <div className="inspector-footer">
            <span className="inspector-source-label">Source</span>
            <span className="inspector-source-value" title={selectedRelationship.sourceNames[0]}>
              {selectedRelationship.sourceNames[0]}
            </span>
          </div>
        ) : null}
      </aside>
    );
  }

  // 2. Concept Source Traceability View (Prompt 20, Requirements 1, 2, 3)
  const hasMultipleSources = concept?.sources && concept.sources.length > 1;

  return (
    <aside className="floating-node-inspector" aria-label="Concept details">
      {/* Mobile bottom sheet drag handle */}
      <div className="inspector-drag-handle" aria-hidden="true" />

      {/* Header: Category + Name + Close */}
      <div className="inspector-header">
        <div className="inspector-title-wrap">
          <span className="inspector-category">{concept!.category}</span>
          <h2 className="inspector-name">{concept!.label}</h2>
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
        {concept!.description}
      </p>

      {/* Connected Concepts (Section 4: Clickable exploration loop) */}
      {concept!.relationships && concept!.relationships.length > 0 && (
        <div className="inspector-section">
          <span className="inspector-section-label">Connected concepts</span>
          <div className="inspector-connections-list">
            {concept!.relationships.map((rel, idx) => (
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

      {/* Source Citation: Compact list for multiple sources, single line for one source */}
      {hasMultipleSources ? (
        <div className="inspector-sources-container">
          <span className="inspector-source-label">Sources</span>
          <div className="inspector-sources-compact-list">
            {concept!.sources!.map((s, idx) => (
              <div key={`${s.id}-${idx}`} className="inspector-source-item" title={s.name}>
                <span className="inspector-source-bullet">•</span>
                <span className="inspector-source-value">{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      ) : concept!.source ? (
        <div className="inspector-footer">
          <span className="inspector-source-label">Source</span>
          <span className="inspector-source-value" title={concept!.source}>
            {concept!.source}
          </span>
        </div>
      ) : null}
    </aside>
  );
};

