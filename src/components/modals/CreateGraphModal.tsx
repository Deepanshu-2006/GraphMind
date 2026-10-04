import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X, FileText, Loader2 } from 'lucide-react';
import type { KnowledgeSource } from '../../types/knowledgeGraph';
import type { PipelineProgressEvent } from '../../services/pipelineOrchestrator';
import { 
  createSourcesFromFiles, 
  validateFileForIngestion, 
  formatFileSize,
  generateSourceId
} from '../../services/sourceIngestion';

interface CreateGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (
    sources: KnowledgeSource[], 
    onProgress?: (event: PipelineProgressEvent) => void
  ) => Promise<boolean | void> | void;
  existingSources?: KnowledgeSource[];
  initialFiles?: File[];
}

export const CreateGraphModal: React.FC<CreateGraphModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  existingSources = [],
  initialFiles = []
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close and reset modal state
  const handleClose = useCallback(() => {
    setSelectedFiles([]);
    setIsSubmitting(false);
    setErrorMessage('');
    setIsDragging(false);
    onClose();
  }, [onClose]);

  // Keyboard close on Escape and submit on Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape' && !isSubmitting) {
        handleClose();
      }

      if (e.key === 'Enter' && selectedFiles.length > 0 && !isSubmitting) {
        const target = e.target as HTMLElement | null;
        if (target && target.tagName !== 'BUTTON' && target.tagName !== 'A') {
          e.preventDefault();
          handleStartProcessing();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, selectedFiles, handleClose]);

  // Process incoming files from file picker or drag-and-drop
  const handleFilesAdded = (files: FileList | File[]) => {
    const incoming = Array.from(files);
    if (incoming.length === 0) return;

    const currentVirtualSources: KnowledgeSource[] = [
      ...existingSources,
      ...selectedFiles.map(f => ({
        id: generateSourceId(f.name, f.size),
        name: f.name,
        fileName: f.name,
        type: 'pdf' as const,
        size: formatFileSize(f.size),
        createdAt: new Date().toISOString(),
        status: 'pending' as const
      }))
    ];

    for (const file of incoming) {
      const validation = validateFileForIngestion(file, currentVirtualSources);
      if (!validation.valid) {
        setErrorMessage(validation.error || "Couldn't accept this file.");
        return;
      }
      currentVirtualSources.push({
        id: generateSourceId(file.name, file.size),
        name: file.name,
        fileName: file.name,
        type: 'pdf',
        size: formatFileSize(file.size),
        createdAt: new Date().toISOString(),
        status: 'pending'
      });
    }

    setSelectedFiles(prev => [...prev, ...incoming]);
    setErrorMessage('');
  };

  useEffect(() => {
    if (isOpen && initialFiles && initialFiles.length > 0) {
      handleFilesAdded(initialFiles);
    }
  }, [isOpen, initialFiles]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFilesAdded(files);
    }
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
    setErrorMessage('');
  };

  // Submit and ingest real sources
  const handleStartProcessing = async () => {
    if (selectedFiles.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const { successful, errors } = await createSourcesFromFiles(selectedFiles, existingSources);

      if (successful.length === 0 && errors.length > 0) {
        setErrorMessage(errors[0].error);
        setIsSubmitting(false);
        return;
      }

      // Close modal immediately so it does not overlap or interfere with the knowledge graph
      handleClose();
      onSuccess(successful);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to process document.');
      setIsSubmitting(false);
    }
  };

  // Sample document helper
  const handleSelectDemo = () => {
    const demoContent = new Blob([
      'Stanford CS229: Machine Learning Course Notes on Deep Neural Architectures and Representation Learning.'
    ], { type: 'application/pdf' });
    const demoFile = new File([demoContent], 'Stanford_CS229_Lecture_04.pdf', {
      type: 'application/pdf',
      lastModified: Date.now()
    });

    handleFilesAdded([demoFile]);
  };

  const selectedFile = selectedFiles[0];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="upload-modal-root">
          {/* Subtle Dark Backdrop */}
          <motion.div 
            className="upload-modal-backdrop" 
            onClick={isSubmitting ? undefined : handleClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.20 }}
            aria-hidden="true"
          />

          <div className="upload-modal-positioner">
            <motion.div 
              className="upload-modal-container" 
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="upload-modal-title"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Native File Picker */}
              <input
                type="file"
                id="file-upload-input"
                ref={fileInputRef}
                onChange={handleInputChange}
                accept=".pdf,.txt,.md,.markdown"
                multiple
                style={{ display: 'none' }}
                aria-label="Select files"
              />

              {/* Header */}
              <div className="upload-modal-header">
                <div className="upload-modal-title-group">
                  <h2 id="upload-modal-title" className="upload-modal-title">
                    Add material
                  </h2>
                  <p className="upload-modal-subtitle">
                    Turn a document into a knowledge graph.
                  </p>
                </div>

                {!isSubmitting && (
                  <button 
                    type="button"
                    className="upload-modal-close-btn" 
                    onClick={handleClose} 
                    aria-label="Close dialog"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                )}
              </div>

              {/* Drop Area or Selected File Row */}
              {selectedFiles.length === 0 ? (
                <div
                  className={`upload-modal-dropzone ${isDragging ? 'is-dragging' : ''}`}
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
                  aria-label="Drop a file here or choose from your computer"
                  id="modal-upload-dropzone"
                >
                  <div className="upload-dropzone-top-content">
                    <h3 className="upload-dropzone-heading">
                      {isDragging ? 'Drop to add material' : 'Drop a file here'}
                    </h3>
                    <p className="upload-dropzone-action-line">
                      or{' '}
                      <button
                        type="button"
                        className="upload-dropzone-browse-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                      >
                        choose from your computer
                      </button>
                    </p>
                  </div>

                  <p className="upload-dropzone-meta">
                    PDF, TXT, Markdown · up to 50 MB
                  </p>
                </div>
              ) : (
                <div className="upload-selected-card">
                  <div className="upload-selected-left">
                    <div className="upload-selected-icon-square" aria-hidden="true">
                      <FileText size={18} />
                    </div>
                    <div className="upload-selected-info">
                      <span className="upload-selected-filename" title={selectedFile.name}>
                        {selectedFile.name}
                      </span>
                      <span className="upload-selected-meta">
                        {selectedFile.name.split('.').pop()?.toUpperCase() || 'FILE'} · {formatFileSize(selectedFile.size)}
                      </span>
                    </div>
                  </div>

                  {!isSubmitting && (
                    <button
                      type="button"
                      className="upload-selected-remove-btn"
                      onClick={() => handleRemoveFile(0)}
                      aria-label={`Remove ${selectedFile.name}`}
                    >
                      Remove
                    </button>
                  )}
                </div>
              )}

              {/* Inline Error (if any) */}
              {errorMessage && (
                <div className="upload-inline-error" role="alert">
                  {errorMessage}
                </div>
              )}

              {/* Supporting row: note + optional sample link */}
              <div className="upload-modal-support-row">
                <p className="upload-support-note">
                  You can add more material later.
                </p>

                {selectedFiles.length === 0 && !isSubmitting && (
                  <button
                    type="button"
                    className="upload-sample-link"
                    onClick={handleSelectDemo}
                  >
                    Try a sample instead
                  </button>
                )}
              </div>

              {/* Footer Actions */}
              <div className="upload-modal-footer">
                <button
                  type="button"
                  className="upload-footer-cancel-btn"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="upload-footer-primary-btn"
                  onClick={handleStartProcessing}
                  disabled={selectedFiles.length === 0 || isSubmitting}
                  id="btn-modal-create-graph"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                      <span>Adding material...</span>
                    </>
                  ) : (
                    <>
                      <span>Add material</span>
                      <span className="upload-footer-primary-btn-arrow" aria-hidden="true">→</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
