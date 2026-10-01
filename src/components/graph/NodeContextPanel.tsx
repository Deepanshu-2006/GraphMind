import React from 'react';
import type { GraphConceptData, SelectedRelationshipData } from '../../types/graph';
import { X, ArrowUpRight, ArrowLeft } from 'lucide-react';

interface NodeContextPanelProps {
  concept: GraphConceptData | null;
  selectedRelationship?: SelectedRelationshipData | null;
  previousConceptName?: string | null;
  onGoBack?: () => void;
  onClose: () => void;
  onSelectConcept: (conceptId: string) => void;
  onFocusNode?: (conceptId: string) => void;
  onSelectSource?: (sourceNameOrId?: string) => void;
  isCollapsed: boolean;
}

export const NodeContextPanel: React.FC<NodeContextPanelProps> = ({
  concept,
  selectedRelationship,
  previousConceptName,
  onGoBack,
  onClose,
  onSelectConcept,
  onSelectSource,
  isCollapsed
}) => {
  if (isCollapsed || (!concept && !selectedRelationship)) {
    return null;
  }

  // 1. Relationship Source Traceability View (Prompt 20 & 26)
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
            type="button"
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
            {selectedRelationship.type.replace(/-/g, ' ')}
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
          <div className="inspector-section-header">
            <span className="inspector-section-label">Connected concepts</span>
            <span className="inspector-section-count">2</span>
          </div>
          <div className="inspector-connections-list">
            <button
              type="button"
              className="inspector-conn-card"
              onClick={() => onSelectConcept(selectedRelationship.sourceId)}
              title={`Explore ${selectedRelationship.sourceName}`}
            >
              <div className="inspector-conn-rel-indicator">
                <span className="inspector-conn-rel-symbol">↰</span>
                <span className="inspector-conn-rel-label">source node</span>
              </div>
              <div className="inspector-conn-main-row">
                <span className="inspector-conn-target-dot" />
                <span className="inspector-conn-name">{selectedRelationship.sourceName}</span>
                <ArrowUpRight size={12} className="inspector-conn-arrow" />
              </div>
            </button>
            <button
              type="button"
              className="inspector-conn-card"
              onClick={() => onSelectConcept(selectedRelationship.targetId)}
              title={`Explore ${selectedRelationship.targetName}`}
            >
              <div className="inspector-conn-rel-indicator">
                <span className="inspector-conn-rel-symbol">↳</span>
                <span className="inspector-conn-rel-label">target node</span>
              </div>
              <div className="inspector-conn-main-row">
                <span className="inspector-conn-target-dot" />
                <span className="inspector-conn-name">{selectedRelationship.targetName}</span>
                <ArrowUpRight size={12} className="inspector-conn-arrow" />
              </div>
            </button>
          </div>
        </div>

        {/* Relationship Source Citation */}
        {hasMultipleSources ? (
          <div className="inspector-sources-container">
            <span className="inspector-source-label">Sources</span>
            <div className="inspector-sources-compact-list">
              {selectedRelationship.sourceNames!.map((name, idx) => (
                <button 
                  key={idx} 
                  type="button"
                  className="inspector-source-item clickable"
                  onClick={() => onSelectSource?.(name)}
                  title={`View ${name} in Sources`}
                >
                  <span className="inspector-source-bullet">•</span>
                  <span className="inspector-source-value">{name}</span>
                  <ArrowUpRight size={10} className="inspector-source-link-icon" />
                </button>
              ))}
            </div>
          </div>
        ) : selectedRelationship.sourceNames && selectedRelationship.sourceNames.length === 1 ? (
          <div className="inspector-footer">
            <span className="inspector-source-label">Source</span>
            <button
              type="button"
              className="inspector-source-value-btn"
              onClick={() => onSelectSource?.(selectedRelationship.sourceNames![0])}
              title={`View ${selectedRelationship.sourceNames[0]} in Sources`}
            >
              <span>{selectedRelationship.sourceNames[0]}</span>
              <ArrowUpRight size={10} className="inspector-source-link-icon" />
            </button>
          </div>
        ) : null}
      </aside>
    );
  }

  // 2. Concept View with Natural Exploration (Prompt 26)
  const hasMultipleSources = concept?.sources && concept.sources.length > 1;

  return (
    <aside className="floating-node-inspector" aria-label="Concept details">
      {/* Mobile bottom sheet drag handle */}
      <div className="inspector-drag-handle" aria-hidden="true" />

      {/* Subtle Return Navigation to previous concept (Prompt 26, Requirement 6) */}
      {previousConceptName && onGoBack && (
        <button
          type="button"
          className="inspector-back-btn"
          onClick={onGoBack}
          title={`Back to ${previousConceptName}`}
        >
          <ArrowLeft size={11} className="inspector-back-arrow" />
          <span className="inspector-back-label">Previous:</span>
          <span className="inspector-back-name">{previousConceptName}</span>
        </button>
      )}

      {/* Header: Category + Name + Close */}
      <div className="inspector-header">
        <div className="inspector-title-wrap">
          <span className="inspector-category">{concept!.category}</span>
          <h2 className="inspector-name">{concept!.label}</h2>
        </div>
        <button 
          type="button"
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

      {/* Connected Concepts (Prompt 26, Requirements 1, 2, 3: Clickable exploration loop with subtle relationships) */}
      {concept!.relationships && concept!.relationships.length > 0 && (
        <div className="inspector-section">
          <div className="inspector-section-header">
            <span className="inspector-section-label">Connected concepts</span>
            <span className="inspector-section-count">{concept!.relationships.length}</span>
          </div>
          <div className="inspector-connections-list">
            {concept!.relationships.map((rel, idx) => {
              const isOutgoing = rel.direction !== 'incoming';
              const relLabel = rel.type ? rel.type.replace(/-/g, ' ') : 'connected to';
              return (
                <button
                  key={`${rel.targetId}-${idx}`}
                  type="button"
                  className="inspector-conn-card"
                  onClick={() => onSelectConcept(rel.targetId)}
                  title={`Explore ${rel.targetName}`}
                >
                  <div className="inspector-conn-rel-indicator">
                    <span className="inspector-conn-rel-symbol">
                      {isOutgoing ? '↳' : '↰'}
                    </span>
                    <span className="inspector-conn-rel-label">
                      {relLabel}
                    </span>
                  </div>
                  <div className="inspector-conn-main-row">
                    <span className="inspector-conn-target-dot" />
                    <span className="inspector-conn-name">{rel.targetName}</span>
                    <ArrowUpRight size={12} className="inspector-conn-arrow" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Source Citation: Compact list for multiple sources, single line for one source (Prompt 26, Requirement 5) */}
      {hasMultipleSources ? (
        <div className="inspector-sources-container">
          <span className="inspector-source-label">Sources</span>
          <div className="inspector-sources-compact-list">
            {concept!.sources!.map((s, idx) => (
              <button
                key={`${s.id}-${idx}`}
                type="button"
                className="inspector-source-item clickable"
                onClick={() => onSelectSource?.(s.name)}
                title={`View ${s.name} in Sources`}
              >
                <span className="inspector-source-bullet">•</span>
                <span className="inspector-source-value">{s.name}</span>
                <ArrowUpRight size={10} className="inspector-source-link-icon" />
              </button>
            ))}
          </div>
        </div>
      ) : concept!.source ? (
        <div className="inspector-footer">
          <span className="inspector-source-label">Source</span>
          <button
            type="button"
            className="inspector-source-value-btn"
            onClick={() => onSelectSource?.(concept!.source)}
            title={`View ${concept!.source} in Sources`}
          >
            <span>{concept!.source}</span>
            <ArrowUpRight size={10} className="inspector-source-link-icon" />
          </button>
        </div>
      ) : null}
    </aside>
  );
};

