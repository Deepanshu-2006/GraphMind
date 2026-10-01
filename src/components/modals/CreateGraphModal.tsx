import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  UploadCloud, 
  FileText, 
  AlertCircle, 
  ArrowRight,
  Trash2,
  Check
} from 'lucide-react';

interface CreateGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type UploadStep = 'select' | 'processing' | 'ready' | 'error';

interface SelectedFileInfo {
  name: string;
  size: string;
  type: string;
}

const processingSteps = [
  'Reading material',
  'Extracting concepts',
  'Mapping relationships',
  'Building graph'
];

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileDescription(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'pdf': return 'PDF Document';
    case 'txt': return 'Text File';
    case 'md':
    case 'markdown': return 'Markdown Notes';
    default: return 'Learning Document';
  }
}

export const CreateGraphModal: React.FC<CreateGraphModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [step, setStep] = useState<UploadStep>('select');
  const [selectedFile, setSelectedFile] = useState<SelectedFileInfo | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [processingStage, setProcessingStage] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close and reset modal state
  const handleClose = useCallback(() => {
    setStep('select');
    setSelectedFile(null);
    setIsDragging(false);
    setProcessingStage(0);
    onClose();
  }, [onClose]);

  // Keyboard close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  // Handle stage transitions during processing (Section 5)
  useEffect(() => {
    if (step !== 'processing') return;

    const interval = setInterval(() => {
      setProcessingStage((prev) => {
        if (prev < processingSteps.length - 1) {
          return prev + 1;
        } else {
          clearInterval(interval);
          setStep('ready');
          return prev;
        }
      });
    }, 550);

    return () => clearInterval(interval);
  }, [step]);

  if (!isOpen) return null;

  // Handle selecting or dropping a file
  const handleFileChosen = (file: File) => {
    const validExtensions = ['pdf', 'txt', 'md', 'markdown'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    // Error state validation (Section 7)
    if (!validExtensions.includes(ext) || file.size === 0) {
      setStep('error');
      return;
    }

    setSelectedFile({
      name: file.name,
      size: formatFileSize(file.size),
      type: getFileDescription(file.name)
    });
    setStep('select');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileChosen(files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileChosen(files[0]);
    }
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleStartProcessing = () => {
    if (!selectedFile) return;
    setStep('processing');
    setProcessingStage(0);
  };

  const handleFinish = () => {
    handleClose();
    onSuccess();
  };

  const handleRetry = () => {
    setStep('select');
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Demo file helper for quick inspection
  const handleSelectDemo = () => {
    setSelectedFile({
      name: 'Stanford_CS229_Lecture_04.pdf',
      size: '2.4 MB',
      type: 'PDF Document'
    });
  };

  return (
    <div className="modal-backdrop" onClick={handleClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Hidden Native File Picker (Section 2 & 9) */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleInputChange}
          accept=".pdf,.txt,.md,.markdown"
          style={{ display: 'none' }}
          aria-label="Upload learning material"
        />

        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <h3 className="modal-title">
              {step === 'ready' 
                ? 'Your knowledge graph is ready.' 
                : step === 'error'
                ? 'Upload failed'
                : 'Add learning material'}
            </h3>
            <p className="modal-subtitle">
              {step === 'ready'
                ? 'Concepts and connections mapped from your material.'
                : step === 'processing'
                ? 'Processing learning material...'
                : step === 'error'
                ? 'There was an issue reading the provided file.'
                : 'Upload papers, lecture notes, transcripts, or other learning material.'}
            </p>
          </div>
          <button 
            className="modal-close-btn" 
            onClick={handleClose} 
            aria-label="Close modal"
            title="Close"
          >
            <X size={15} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* STEP 1: SELECT FILE */}
          {step === 'select' && (
            <>
              {!selectedFile ? (
                /* Dropzone (Section 3) */
                <div
                  className={`upload-dropzone ${isDragging ? 'dragging' : ''}`}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-label="Drag and drop file here, or click to browse"
                >
                  <div className="upload-dropzone-icon">
                    <UploadCloud size={20} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    <span className="upload-dropzone-instruction">
                      {isDragging ? 'Drop file to upload' : 'Drag & drop file here, or click to browse'}
                    </span>
                    <span className="upload-dropzone-formats">
                      Supported formats: PDF, TXT, MD
                    </span>
                  </div>

                  <button
                    type="button"
                    className="demo-file-pill-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelectDemo();
                    }}
                    title="Or test with an example lecture PDF"
                  >
                    Load sample lecture paper
                  </button>
                </div>
              ) : (
                /* Selected File Card (Section 4) */
                <div className="selected-file-card">
                  <div className="selected-file-info">
                    <div className="selected-file-icon">
                      <FileText size={18} />
                    </div>
                    <div className="selected-file-details">
                      <span className="selected-file-name" title={selectedFile.name}>
                        {selectedFile.name}
                      </span>
                      <div className="selected-file-meta">
                        <span>{selectedFile.type}</span>
                        <span>·</span>
                        <span>{selectedFile.size}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="selected-file-remove"
                    onClick={handleRemoveFile}
                    aria-label="Remove selected file"
                    title="Remove file"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </>
          )}

          {/* STEP 2: PROCESSING SEQUENCE (Section 5) */}
          {step === 'processing' && (
            <div className="processing-sequence-wrap">
              {/* Minimal Progress Bar */}
              <div className="processing-progress-bar">
                <div
                  className="processing-progress-fill"
                  style={{
                    width: `${((processingStage + 1) / processingSteps.length) * 100}%`
                  }}
                />
              </div>

              {/* 4-Step Sequence */}
              <div className="processing-steps-list">
                {processingSteps.map((stg, index) => {
                  const isDone = index < processingStage;
                  const isCurrent = index === processingStage;

                  return (
                    <div
                      key={stg}
                      className={`processing-step-item ${isCurrent ? 'active' : ''} ${isDone ? 'completed' : ''}`}
                    >
                      {isDone ? (
                        <Check size={13} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                      ) : (
                        <span className="processing-step-pip" />
                      )}
                      <span>{stg}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 3: SUCCESS STATE (Section 6) */}
          {step === 'ready' && selectedFile && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '8px 0' }}>
              <div className="selected-file-card" style={{ borderColor: 'rgba(163, 255, 18, 0.3)' }}>
                <div className="selected-file-info">
                  <div className="selected-file-icon" style={{ color: 'var(--accent)' }}>
                    <Check size={18} />
                  </div>
                  <div className="selected-file-details">
                    <span className="selected-file-name">
                      {selectedFile.name}
                    </span>
                    <div className="selected-file-meta">
                      <span>Concepts and relationships ready for exploration</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: ERROR STATE (Section 7) */}
          {step === 'error' && (
            <div className="upload-error-box">
              <AlertCircle size={24} style={{ color: '#FF4D4D' }} />
              <div className="upload-error-title">Couldn't process this file.</div>
              <p className="upload-error-subtitle">
                Try another file or upload it again.
              </p>
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={handleRetry}
                style={{ marginTop: '8px' }}
              >
                <span>Try again</span>
              </button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          {step === 'select' && (
            <>
              <button className="btn-secondary" onClick={handleClose}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleStartProcessing}
                disabled={!selectedFile}
                style={{ opacity: selectedFile ? 1 : 0.45 }}
              >
                <span>Create knowledge graph</span>
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
