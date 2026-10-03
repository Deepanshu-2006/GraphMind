import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { 
  X, 
  ArrowUp,
  FileText, 
  AlertCircle
} from 'lucide-react';
import type { KnowledgeSource } from '../../types/knowledgeGraph';
import type { PipelineProgressEvent, PipelineStage } from '../../services/pipelineOrchestrator';
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
}

type ModalStep = 'select' | 'processing' | 'error';

const STAGE_CONTENT: Record<string, { title: string; subtitle: string }> = {
  'reading': {
    title: 'READING YOUR MATERIAL',
    subtitle: 'Finding the ideas inside your material.'
  },
  'extracting-concepts': {
    title: 'FINDING CONCEPTS',
    subtitle: 'Extracting key technical concepts and definitions.'
  },
  'normalizing': {
    title: 'FINDING CONCEPTS',
    subtitle: 'Consolidating canonical entities across your notes.'
  },
  'mapping-relationships': {
    title: 'CONNECTING IDEAS',
    subtitle: 'Mapping structural connections between concepts.'
  },
  'building-graph': {
    title: 'CRAFTING YOUR KNOWLEDGE GRAPH',
    subtitle: 'Synthesizing the knowledge space.'
  },
  'complete': {
    title: 'GRAPH READY',
    subtitle: 'Your knowledge graph is assembled.'
  }
};

export const CreateGraphModal: React.FC<CreateGraphModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  existingSources = []
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [step, setStep] = useState<ModalStep>('select');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [processingStage, setProcessingStage] = useState<PipelineStage>('reading');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close and reset modal state
  const handleClose = useCallback(() => {
    if (isSubmitting && step === 'processing') return; // Prevent closing while processing
    setStep('select');
    setSelectedFiles([]);
    setIsSubmitting(false);
    setErrorMessage('');
    setIsDragging(false);
    setProcessingStage('reading');
    onClose();
  }, [onClose, isSubmitting, step]);

  // Keyboard close on Escape and submit on Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        if (!isSubmitting && step !== 'processing') {
          handleClose();
        }
      }

      if (e.key === 'Enter' && step === 'select' && selectedFiles.length > 0 && !isSubmitting) {
        // Trigger start processing unless focusing on an interactive element
        const target = e.target as HTMLElement | null;
        if (target && target.tagName !== 'BUTTON' && target.tagName !== 'A') {
          e.preventDefault();
          handleStartProcessing();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, step, selectedFiles, handleClose]);

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
        setStep('error');
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
    setStep('processing');
    setProcessingStage('reading');

    try {
      const { successful, errors } = await createSourcesFromFiles(selectedFiles, existingSources);

      if (successful.length === 0 && errors.length > 0) {
        setErrorMessage(errors[0].error);
        setStep('error');
        setIsSubmitting(false);
        return;
      }

      // Propagate live stage events through the pipeline
      const success = await onSuccess(successful, (evt: PipelineProgressEvent) => {
        setProcessingStage(evt.stage);
      });

      if (success !== false) {
        setProcessingStage('complete');
        // Brief pause to display "GRAPH READY" before smooth modal exit
        await new Promise((res) => setTimeout(res, 550));
        handleClose();
      } else {
        setErrorMessage('Failed to construct knowledge graph from uploaded material.');
        setStep('error');
        setIsSubmitting(false);
      }
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to process file.');
      setStep('error');
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    setStep('select');
    setErrorMessage('');
    setIsSubmitting(false);
  };

  // Demo file helper for quick inspection
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

  const currentStageInfo = STAGE_CONTENT[processingStage] || STAGE_CONTENT['reading'];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="upload-modal-root">
          {/* Subtle Dim Backdrop */}
          <motion.div 
            className="upload-modal-backdrop" 
            onClick={step === 'processing' ? undefined : handleClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            aria-hidden="true"
          />

          <div className="upload-modal-positioner">
            <motion.div 
              className="upload-modal-container" 
              onClick={(e) => e.stopPropagation()}
              role="dialog"
              aria-modal="true"
              aria-labelledby="upload-modal-title"
              initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 18, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 14, scale: 0.985 }}
              transition={{ duration: 0.40, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Hidden Native File Picker */}
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

              {/* 1. Modal Header */}
              <div className="upload-modal-header">
                <div className="upload-modal-title-group">
                  <h2 id="upload-modal-title" className="upload-modal-title">
                    Upload material
                  </h2>
                  <p className="upload-modal-subtitle">
                    Bring your study material into GraphMind.
                  </p>
                </div>

                {step !== 'processing' && (
                  <button 
                    type="button"
                    className="upload-modal-close-btn" 
                    onClick={handleClose} 
                    aria-label="Close dialog"
                    title="Close (Esc)"
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                )}
              </div>

              {/* 2. Editorial Workflow Indicator (01 / 02 MATERIAL → KNOWLEDGE) */}
              <div className="upload-modal-workflow" aria-hidden="true">
                <span className="upload-workflow-step">
                  {step === 'processing' ? '02 / 02' : '01 / 02'}
                </span>
                <span className="upload-workflow-divider">·</span>
                <span className={step === 'processing' ? 'upload-workflow-inactive' : 'upload-workflow-active'}>
                  MATERIAL
                </span>
                <span className="upload-workflow-arrow">→</span>
                <span className={step === 'processing' ? 'upload-workflow-active' : 'upload-workflow-inactive'}>
                  KNOWLEDGE
                </span>
              </div>

              {/* 3. Modal Body */}
              <div className="upload-modal-body">
                {/* STEP A: FILE SELECTION */}
                {step === 'select' && (
                  <>
                    {selectedFiles.length === 0 ? (
                      /* Empty Drop Zone */
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
                        aria-label="Drop your material here, or browse from your computer"
                        id="modal-upload-dropzone"
                      >
                        <div className="upload-dropzone-icon-square">
                          <ArrowUp size={18} strokeWidth={2.2} />
                        </div>

                        <div className="upload-dropzone-heading-wrap">
                          {isDragging && <span className="upload-dropzone-marker" aria-hidden="true" />}
                          <span className="upload-dropzone-heading">
                            {isDragging ? 'DROP TO ADD TO GRAPH' : 'DROP YOUR MATERIAL HERE'}
                          </span>
                        </div>

                        <p className="upload-dropzone-subtext">
                          or{' '}
                          <button
                            type="button"
                            className="upload-dropzone-browse-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              fileInputRef.current?.click();
                            }}
                          >
                            browse
                          </button>{' '}
                          from your computer
                        </p>

                        <div className="upload-dropzone-meta">
                          <span>PDF · TXT · MARKDOWN</span>
                          <span>Up to 50 MB</span>
                        </div>
                      </div>
                    ) : (
                      /* Selected Material State */
                      <div className="upload-selected-container">
                        {selectedFiles.map((file, idx) => {
                          const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
                          const formattedSize = formatFileSize(file.size);

                          return (
                            <motion.div
                              key={`${file.name}-${idx}`}
                              className="upload-selected-card"
                              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                            >
                              <div className="upload-selected-left">
                                <div className="upload-selected-icon-square">
                                  <FileText size={18} />
                                </div>
                                <div className="upload-selected-info">
                                  <span className="upload-selected-filename" title={file.name}>
                                    {file.name}
                                  </span>
                                  <div className="upload-selected-meta">
                                    <span>{ext} · {formattedSize}</span>
                                    <span className="upload-selected-status-tag">
                                      <span className="upload-selected-dot" aria-hidden="true" />
                                      READY TO PROCESS
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <button
                                type="button"
                                className="upload-selected-remove-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveFile(idx);
                                }}
                                aria-label={`Remove file ${file.name}`}
                              >
                                REMOVE
                              </button>
                            </motion.div>
                          );
                        })}

                        <button
                          type="button"
                          className="upload-selected-add-more"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          + Add another file
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* STEP B: REAL PROCESSING STATE */}
                {step === 'processing' && (
                  <div className="upload-processing-container" aria-live="polite">
                    <div className="upload-processing-kicker">
                      <span className="upload-processing-pulse-dot" aria-hidden="true" />
                      <span>PROCESSING</span>
                    </div>

                    <AnimatePresence mode="wait">
                      <motion.div
                        key={processingStage}
                        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
                        transition={{ duration: 0.30, ease: [0.16, 1, 0.3, 1] }}
                        className="upload-processing-text-wrap"
                      >
                        <div className="upload-processing-title">
                          {currentStageInfo.title}
                        </div>
                        <p className="upload-processing-subtitle">
                          {currentStageInfo.subtitle}
                        </p>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                )}

                {/* STEP C: ERROR STATE */}
                {step === 'error' && (
                  <div className="upload-error-container">
                    <div className="upload-error-icon-square">
                      <AlertCircle size={20} />
                    </div>
                    <div className="upload-error-title">Could not assemble knowledge graph</div>
                    <p className="upload-error-desc">
                      {errorMessage || 'There was an issue processing your uploaded material.'}
                    </p>
                    <button
                      type="button"
                      className="upload-error-retry-btn"
                      onClick={handleRetry}
                    >
                      <span>TRY AGAIN</span>
                      <span style={{ display: 'inline-block', marginLeft: '4px' }}>↗</span>
                    </button>
                  </div>
                )}
              </div>

              {/* 4. Sample Material Action (Subtle Text Action) */}
              {step === 'select' && selectedFiles.length === 0 && (
                <div className="upload-modal-sample-zone">
                  <button
                    type="button"
                    className="upload-sample-action"
                    onClick={handleSelectDemo}
                    aria-label="Try with sample notes"
                  >
                    <span>TRY WITH A SAMPLE</span>
                    <span className="upload-sample-action-arrow" aria-hidden="true">↗</span>
                  </button>
                </div>
              )}

              {/* 5. Editorial Modal Footer */}
              {step === 'select' && (
                <div className="upload-modal-footer">
                  <div className="upload-footer-hint">
                    ESC to cancel
                  </div>

                  <div className="upload-footer-actions">
                    <button
                      type="button"
                      className="upload-footer-cancel-btn"
                      onClick={handleClose}
                    >
                      CANCEL
                    </button>

                    <button
                      type="button"
                      className="upload-footer-primary-btn"
                      onClick={handleStartProcessing}
                      disabled={selectedFiles.length === 0 || isSubmitting}
                      id="btn-modal-create-graph"
                    >
                      <span>CREATE KNOWLEDGE GRAPH</span>
                      <span className="upload-footer-arrow" aria-hidden="true">↗</span>
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
