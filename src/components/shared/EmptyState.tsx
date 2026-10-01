import { Network, UploadCloud, BookOpen } from 'lucide-react';

interface EmptyStateProps {
  onAction: () => void;
  onLoadDemo: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onAction, onLoadDemo }) => {
  return (
    <div className="empty-state-card" id="empty-state-view">
      <div className="empty-state-art">
        <Network size={36} style={{ color: 'var(--accent-cyan)' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
        <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
          KNOWLEDGE GRAPH // EMPTY STATE
        </span>
        <h3 className="empty-state-title">No Synapse Nodes Extracted Yet</h3>
        <p className="empty-state-desc">
          Drop unstructured lecture slides, textbooks, or research papers to synthesize your first interactive visual knowledge graph.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
        <button className="btn-primary" onClick={onAction}>
          <UploadCloud size={16} />
          <span>Ingest Learning Material</span>
        </button>
        <button className="btn-secondary" onClick={onLoadDemo}>
          <BookOpen size={16} />
          <span>Load Curated Demo</span>
        </button>
      </div>
    </div>
  );
};
