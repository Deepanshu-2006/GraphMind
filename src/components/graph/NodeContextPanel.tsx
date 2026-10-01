import type { GraphConceptData } from '../../types/graph';
import { 
  X, 
  ArrowRight, 
  ArrowLeft, 
  FileText, 
  CheckCircle2, 
  Maximize2, 
  BookOpen
} from 'lucide-react';

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
  onFocusNode,
  isCollapsed
}) => {
  if (isCollapsed || !concept) {
    return null;
  }

  return (
    <aside className="graph-context-panel" aria-label="Concept Context Inspector">
      {/* Header */}
      <div className="context-panel-header">
        <div className="context-header-meta">
          <span className="node-category-pill">{concept.category}</span>
          <span className="mono" style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
            {concept.code}
          </span>
        </div>
        <button 
          className="modal-close-btn" 
          onClick={onClose}
          aria-label="Close context panel"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="context-panel-body">
        {/* Title */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h2 className="context-concept-title">{concept.label}</h2>
          <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            SYNAPSE DEGREE: {concept.synapseCount} DIRECT EDGES
          </span>
        </div>

        {/* Description */}
        <div className="context-section-group">
          <span className="context-section-label">Description</span>
          <p className="context-description-text">
            {concept.description}
          </p>
        </div>

        {/* Prerequisites */}
        {concept.prerequisites && concept.prerequisites.length > 0 && (
          <div className="context-section-group">
            <span className="context-section-label">Prerequisites</span>
            <div className="context-chips-wrap">
              {concept.prerequisites.map((prereq) => (
                <div 
                  key={prereq} 
                  className="context-interactive-chip"
                  title={`Prerequisite topic: ${prereq}`}
                >
                  <BookOpen size={11} style={{ color: 'var(--accent-indigo)' }} />
                  <span>{prereq}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Direct Synapse Relationships */}
        <div className="context-section-group">
          <span className="context-section-label">
            Relationships ({concept.relationships.length})
          </span>
          <div className="relationships-table">
            {concept.relationships.map((rel, idx) => (
              <div
                key={`${rel.targetId}-${idx}`}
                className="relationship-row"
                onClick={() => onSelectConcept(rel.targetId)}
                title={`Jump to ${rel.targetName}`}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {rel.direction === 'outgoing' ? (
                    <ArrowRight size={13} style={{ color: 'var(--accent-cyan)' }} />
                  ) : (
                    <ArrowLeft size={13} style={{ color: 'var(--accent-amber)' }} />
                  )}
                  <span className="rel-type-tag">{rel.type}</span>
                </div>
                <span className="rel-target-name">{rel.targetName}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Confidence Meter */}
        <div className="confidence-card">
          <div className="confidence-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={13} style={{ color: 'var(--accent-emerald)' }} />
              <span style={{ fontWeight: 550, color: 'var(--text-primary)' }}>Extraction Confidence</span>
            </div>
            <span className="mono" style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>
              {concept.confidence}%
            </span>
          </div>
          <div className="confidence-bar-bg">
            <div 
              className="confidence-bar-fill" 
              style={{ width: `${concept.confidence}%` }} 
            />
          </div>
          <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
            Semantic validation verified against contextual curriculum documents.
          </span>
        </div>

        {/* Source Citation */}
        <div className="context-section-group">
          <span className="context-section-label">Source Document</span>
          <div className="source-citation-box">
            <FileText size={15} style={{ color: 'var(--accent-indigo)', flexShrink: 0, marginTop: '2px' }} />
            <div>
              <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                {concept.source}
              </div>
              <div className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Indexed via AI Document Synapse Parser
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="context-panel-footer">
        <button 
          className="btn-primary" 
          style={{ flex: 1, padding: '8px 14px', fontSize: '12.5px', justifyContent: 'center' }}
          onClick={() => onFocusNode(concept.id)}
        >
          <Maximize2 size={13} />
          <span>Focus in Canvas</span>
        </button>
      </div>
    </aside>
  );
};
