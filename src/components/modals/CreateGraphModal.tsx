import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  UploadCloud, 
  FileText, 
  AlertCircle, 
  Trash2,
  Plus
} from 'lucide-react';
import type { KnowledgeSource } from '../../types/knowledgeGraph';
import { 
  createSourcesFromFiles, 
  validateFileForIngestion, 
  formatFileSize,
  generateSourceId
} from '../../services/sourceIngestion';

interface CreateGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (sources: KnowledgeSource[]) => void;
  existingSources?: KnowledgeSource[];
}

type UploadStep = 'select' | 'error';

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
  onSuccess,
  existingSources = []
}) => {
  const [step, setStep] = useState<UploadStep>('select');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close and reset modal state
  const handleClose = useCallback(() => {
    setStep('select');
    setSelectedFiles([]);
    setIsSubmitting(false);
    setErrorMessage('');
    setIsDragging(false);
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

  if (!isOpen) return null;

  // Process incoming files from file picker or drag-and-drop
  const handleFilesAdded = (files: FileList | File[]) => {
    const incoming = Array.from(files);
    if (incoming.length === 0) return;

    // Validate against already selected files + existing sources
    const currentVirtualSources: KnowledgeSource[] = [
      ...existingSources,
      ...selectedFiles.map(f => ({
        id: generateSourceId(f.name, f.size),
        name: f.name,
        fileName: f.name,
        type: 'pdf',
        size: formatFileSize(f.size),
        createdAt: Date.now(),
        status: 'pending' as const
      }))
    ];

    for (const file of incoming) {
      const validation = validateFileForIngestion(file, currentVirtualSources);
      if (!validation.valid) {
        setErrorMessage(validation.error || "Couldn't accept this file.");
        setStep('error');
        return;
      }
      currentVirtualSources.push({
        id: generateSourceId(file.name, file.size),
        name: file.name,
        fileName: file.name,
        type: 'pdf',
        size: formatFileSize(file.size),
        createdAt: Date.now(),
        status: 'pending'
      });
    }

    // All valid: append to selectedFiles
    setSelectedFiles(prev => [...prev, ...incoming]);
    setStep('select');
    setErrorMessage('');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFilesAdded(files);
    }
    // Reset file input so user can re-select if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
      handleFilesAdded(files);
    }
  };

  const handleRemoveFile = (indexToRemove: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== indexToRemove));
  };

  // Submit and ingest real sources
  const handleStartProcessing = async () => {
    if (selectedFiles.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const { successful, errors } = await createSourcesFromFiles(selectedFiles, existingSources);

      if (successful.length === 0 && errors.length > 0) {
        setErrorMessage(errors[0].error);
        setStep('error');
        setIsSubmitting(false);
        return;
      }

      handleClose();
      onSuccess(successful);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to process file.');
      setStep('error');
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    setStep('select');
    setErrorMessage('');
  };

  // Demo file helper for quick inspection
  const handleSelectDemo = () => {
    // Construct real demo file
    const demoContent = new Blob([
      'Stanford CS229: Machine Learning Course Notes on Deep Neural Architectures and Representation Learning.'
    ], { type: 'application/pdf' });
    const demoFile = new File([demoContent], 'Stanford_CS229_Lecture_04.pdf', {
      type: 'application/pdf',
      lastModified: Date.now()
    });

    handleFilesAdded([demoFile]);
  };

  return (
    <div 
      className="modal-backdrop" 
      onClick={handleClose} 
      role="dialog" 
      aria-modal="true"
      aria-labelledby="create-modal-title"
      aria-describedby="create-modal-desc"
    >
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Hidden Native File Picker supporting multiple files */}
        <input
          type="file"
          id="file-upload-input"
          ref={fileInputRef}
          onChange={handleInputChange}
          accept=".pdf,.txt,.md,.markdown"
          multiple
          style={{ display: 'none' }}
          aria-label="Select learning material files"
        />

        {/* Modal Header */}
        <div className="modal-header">
          <div>
            <h3 id="create-modal-title" className="modal-title">
              {step === 'error' ? 'Upload failed' : 'Add learning material'}
            </h3>
            <p id="create-modal-desc" className="modal-subtitle">
              {step === 'error'
                ? 'There was an issue reading the provided file.'
                : 'Upload papers, lecture notes, transcripts, or other learning material.'}
            </p>
          </div>
          <button 
            type="button"
            className="modal-close-btn" 
            onClick={handleClose} 
            aria-label="Close dialog"
            title="Close dialog"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* STEP 1: SELECT FILES */}
          {step === 'select' && (
            <>
              {selectedFiles.length === 0 ? (
                /* Dropzone */
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
                  aria-label="Drag and drop files here, or click to browse"
                  id="modal-upload-dropzone"
                >
                  <div className="upload-dropzone-icon">
                    <UploadCloud size={20} />
                  </div>
                  <div className="upload-dropzone-text">
                    <span className="upload-dropzone-primary">
                      Drag and drop your files here, or browse
                    </span>
                    <span className="upload-dropzone-secondary">
                      Supports PDF, TXT, Markdown (up to 50MB)
                    </span>
                  </div>

                  <div style={{ marginTop: '12px' }}>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectDemo();
                      }}
                      style={{ fontSize: '11.5px', padding: '4px 10px' }}
                    >
                      Use sample lecture note
                    </button>
                  </div>
                </div>
              ) : (
                /* Selected Files List */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>
                      {selectedFiles.length} {selectedFiles.length === 1 ? 'source selected' : 'sources selected'}
                    </span>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => fileInputRef.current?.click()}
                      style={{ fontSize: '11.5px', padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Plus size={12} />
                      <span>Add another</span>
                    </button>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto' }}>
                    {selectedFiles.map((file, idx) => (
                      <div 
                        key={`${file.name}-${idx}`} 
                        className="selected-file-card" 
                        id={`selected-file-card-${idx}`}
                      >
                        <div className="selected-file-info">
                          <div className="selected-file-icon">
                            <FileText size={18} />
                          </div>
                          <div className="selected-file-details">
                            <span className="selected-file-name" title={file.name}>
                              {file.name}
                            </span>
                            <div className="selected-file-meta">
                              <span>{getFileDescription(file.name)}</span>
                              <span className="meta-separator">•</span>
                              <span>{formatFileSize(file.size)}</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          className="selected-file-remove"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveFile(idx);
                          }}
                          aria-label={`Remove file ${file.name}`}
                          title="Remove file"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* STEP 2: ERROR STATE */}
          {step === 'error' && (
            <div className="upload-error-box">
              <AlertCircle size={24} style={{ color: '#FF4D4D' }} />
              <div className="upload-error-title">Couldn't process this file.</div>
              <p className="upload-error-subtitle">
                {errorMessage || 'Try another file or upload it again.'}
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
        {step === 'select' && (
          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={handleClose}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleStartProcessing}
              disabled={selectedFiles.length === 0 || isSubmitting}
              style={{ opacity: selectedFiles.length > 0 && !isSubmitting ? 1 : 0.45 }}
              id="btn-modal-create-graph"
            >
              <span>{isSubmitting ? 'Creating knowledge graph…' : 'Create knowledge graph'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
