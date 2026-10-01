import React, { useState, useEffect } from 'react';
import { X, UploadCloud, FileText, CheckCircle2, ArrowRight } from 'lucide-react';

interface CreateGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type ModalTab = 'upload' | 'paste';
type ModalStep = 'input' | 'processing' | 'ready';

export const CreateGraphModal: React.FC<CreateGraphModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [tab, setTab] = useState<ModalTab>('upload');
  const [step, setStep] = useState<ModalStep>('input');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [pastedNotes, setPastedNotes] = useState<string>('');
  const [processingStage, setProcessingStage] = useState<number>(0);

  const processingStages = [
    'Reading your material',
    'Extracting concepts',
    'Connecting related ideas',
    'Building your knowledge graph'
  ];

  const handleClose = () => {
    setStep('input');
    setProcessingStage(0);
    setSelectedFile(null);
    setPastedNotes('');
    onClose();
  };

  // Handle stage transitions during processing
  useEffect(() => {
    if (step !== 'processing') return;

    const interval = setInterval(() => {
      setProcessingStage((prev) => {
        if (prev < processingStages.length - 1) {
          return prev + 1;
        } else {
          clearInterval(interval);
          setStep('ready');
          return prev;
        }
      });
    }, 600);

    return () => clearInterval(interval);
  }, [step, processingStages.length]);

  if (!isOpen) return null;

  const handleStartProcessing = () => {
    setStep('processing');
    setProcessingStage(0);
  };

  const handleFinish = () => {
    handleClose();
    onSuccess();
  };

  const hasContent = Boolean(selectedFile || pastedNotes.trim());

  return (
    <div className="modal-backdrop" onClick={handleClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <h3 className="modal-title">
              {step === 'ready' ? 'Your knowledge graph is ready.' : 'Create a knowledge graph'}
            </h3>
            <p className="modal-subtitle">
              {step === 'ready' 
                ? 'Concepts and relationships extracted from your learning material' 
                : step === 'processing' 
                ? 'Processing your material...' 
                : 'Upload your learning material'}
            </p>
          </div>
          <button className="modal-close-btn" onClick={handleClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body">
          {step === 'input' && (
            <>
              {/* Tab Selector */}
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-default)', paddingBottom: '12px' }}>
                <button
                  type="button"
                  onClick={() => setTab('upload')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-btn)',
                    fontSize: '13px',
                    fontWeight: tab === 'upload' ? 500 : 400,
                    color: tab === 'upload' ? 'var(--text-primary)' : 'var(--text-muted)',
                    backgroundColor: tab === 'upload' ? 'var(--bg-surface-elevated)' : 'transparent',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  Upload files
                </button>
                <button
                  type="button"
                  onClick={() => setTab('paste')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-btn)',
                    fontSize: '13px',
                    fontWeight: tab === 'paste' ? 500 : 400,
                    color: tab === 'paste' ? 'var(--text-primary)' : 'var(--text-muted)',
                    backgroundColor: tab === 'paste' ? 'var(--bg-surface-elevated)' : 'transparent',
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  Paste notes
                </button>
              </div>

              {tab === 'upload' ? (
                <div
                  className="ingestion-dropzone"
                  onClick={() => setSelectedFile('Attention_Is_All_You_Need.pdf')}
                  title="Click to select file"
                >
                  <div className="dropzone-icon-box">
                    {selectedFile ? (
                      <CheckCircle2 size={20} style={{ color: 'var(--accent)' }} />
                    ) : (
                      <UploadCloud size={20} />
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div className="dropzone-title">
                      {selectedFile ? selectedFile : 'Drag & drop files here'}
                    </div>
                    <div className="dropzone-hint">
                      {selectedFile 
                        ? '1.4 MB · Ready to process' 
                        : 'or click to browse files (PDF, TXT, DOCX, Markdown)'}
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <textarea
                    value={pastedNotes}
                    onChange={(e) => setPastedNotes(e.target.value)}
                    placeholder="Paste lecture notes, article excerpts, or research summaries here..."
                    style={{
                      width: '100%',
                      minHeight: '140px',
                      padding: '12px',
                      backgroundColor: 'var(--bg-inset)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-input)',
                      color: 'var(--text-primary)',
                      fontSize: '13.5px',
                      lineHeight: 1.5,
                      resize: 'vertical'
                    }}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    GraphMind automatically resolves dependencies and hierarchy from unstructured notes.
                  </span>
                </div>
              )}
            </>
          )}

          {step === 'processing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '16px 4px' }}>
              {/* Progress bar */}
              <div style={{ width: '100%', height: '3px', backgroundColor: 'var(--bg-surface-elevated)', borderRadius: '2px', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${((processingStage + 1) / processingStages.length) * 100}%`,
                    backgroundColor: 'var(--accent)',
                    transition: 'width 400ms ease-out'
                  }}
                />
              </div>

              {/* Steps list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {processingStages.map((stg, index) => {
                  const isDone = index < processingStage;
                  const isCurrent = index === processingStage;

                  return (
                    <div
                      key={stg}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        fontSize: '13.5px',
                        color: isCurrent 
                          ? 'var(--text-primary)' 
                          : isDone 
                          ? 'var(--text-secondary)' 
                          : 'var(--text-muted)',
                        transition: 'color var(--transition-fast)'
                      }}
                    >
                      <span
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: isDone || isCurrent ? 'var(--accent)' : 'var(--border-default)',
                          transition: 'background-color var(--transition-fast)'
                        }}
                      />
                      <span>{stg}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'ready' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '12px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' }}>
                  <FileText size={18} />
                </div>
                <div>
                  <div style={{ fontSize: '14.5px', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {selectedFile || 'Pasted learning material'}
                  </div>
                  <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                    Processed into interactive knowledge structure
                  </div>
                </div>
              </div>

              <div style={{ 
                padding: '16px 20px', 
                backgroundColor: 'var(--bg-inset)', 
                border: '1px solid var(--border-default)', 
                borderRadius: 'var(--radius-card)',
                display: 'flex',
                justifyContent: 'space-around',
                textAlign: 'center'
              }}>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                    418
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>concepts</div>
                </div>
                <div style={{ width: '1px', backgroundColor: 'var(--border-default)' }} />
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                    1,280
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>relationships</div>
                </div>
                <div style={{ width: '1px', backgroundColor: 'var(--border-default)' }} />
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
                    24
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>sources</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          {step === 'input' && (
            <>
              <button className="btn-secondary" onClick={handleClose}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleStartProcessing}
                disabled={!hasContent}
                style={{ opacity: hasContent ? 1 : 0.5 }}
              >
                <span>Process material</span>
              </button>
            </>
          )}

          {step === 'ready' && (
            <button
              className="btn-primary"
              onClick={handleFinish}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              <span>Explore knowledge graph</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
