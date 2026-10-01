import { useState } from 'react';
import { X, UploadCloud, Sparkles, CheckCircle2 } from 'lucide-react';

interface CreateGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const CreateGraphModal: React.FC<CreateGraphModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [graphDensity, setGraphDensity] = useState<'hierarchical' | 'balanced' | 'dense'>('balanced');

  if (!isOpen) return null;

  const handleSimulatedUpload = () => {
    setSelectedFile('Attention_Is_All_You_Need_Research_Paper.pdf');
  };

  const handleSynthesize = () => {
    setIsSynthesizing(true);
    setTimeout(() => {
      setIsSynthesizing(false);
      onSuccess();
      onClose();
    }, 1200);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <h3 className="modal-title">Create Knowledge Graph</h3>
            <span className="modal-subtitle">
              Convert unstructured papers, notes, or slides into connected conceptual nodes
            </span>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* File Dropzone */}
          <div 
            className="ingestion-dropzone" 
            onClick={handleSimulatedUpload}
            title="Click to select sample file"
          >
            {isSynthesizing && <div className="laser-line" />}

            <div className="dropzone-icon-box">
              {selectedFile ? (
                <CheckCircle2 size={24} style={{ color: 'var(--accent-emerald)' }} />
              ) : (
                <UploadCloud size={24} />
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div className="dropzone-title">
                {selectedFile ? selectedFile : 'Click to select or drag & drop learning material'}
              </div>
              <div className="dropzone-hint">
                {selectedFile 
                  ? 'Ready for semantic extraction • 1.42 MB' 
                  : 'Automated entity discovery, relation extraction & path synthesis'}
              </div>
            </div>

            <div className="dropzone-formats">
              <span className="format-tag">PDF</span>
              <span className="format-tag">ARXIV</span>
              <span className="format-tag">MARKDOWN</span>
              <span className="format-tag">TRANSCRIPTS</span>
            </div>
          </div>

          {/* Graph Configuration Controls */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                TOPOLOGY CONFIGURATION
              </span>
              <span className="mono" style={{ fontSize: '11px', color: 'var(--accent-cyan)' }}>
                CONFIDENCE &gt; 0.85
              </span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {(['hierarchical', 'balanced', 'dense'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setGraphDensity(mode)}
                  style={{
                    padding: '8px',
                    borderRadius: 'var(--radius-sm)',
                    border: graphDensity === mode ? '1px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                    background: graphDensity === mode ? 'var(--accent-cyan-dim)' : 'var(--bg-surface-elevated)',
                    color: graphDensity === mode ? 'var(--accent-cyan)' : 'var(--text-tertiary)',
                    fontSize: '12px',
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'capitalize',
                    textAlign: 'center'
                  }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button 
            className="btn-primary" 
            onClick={handleSynthesize}
            disabled={isSynthesizing}
            style={{ opacity: isSynthesizing ? 0.7 : 1 }}
          >
            <Sparkles size={14} />
            <span>{isSynthesizing ? 'Vectorizing Synapses...' : 'Synthesize Graph'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
