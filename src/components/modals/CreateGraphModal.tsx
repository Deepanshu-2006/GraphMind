import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  X, 
  UploadCloud, 
  FileText, 
  AlertCircle, 
  Trash2
} from 'lucide-react';

interface CreateGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type UploadStep = 'select' | 'error';

interface SelectedFileInfo {
  name: string;
  size: string;
  type: string;
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close and reset modal state
  const handleClose = useCallback(() => {
    setStep('select');
    setSelectedFile(null);
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

  // Handle selecting or dropping a file
  const handleFileChosen = (file: File) => {
    const validExtensions = ['pdf', 'txt', 'md', 'markdown'];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';

    // Error state validation
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

  // Submit and immediately transition to the full Knowledge Graph experience
  const handleStartProcessing = () => {
    if (!selectedFile) return;
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
        {/* Hidden Native File Picker */}
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
              {step === 'error' ? 'Upload failed' : 'Add learning material'}
            </h3>
            <p className="modal-subtitle">
              {step === 'error'
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
                  aria-label="Drag and drop file here, or click to browse"
                  id="modal-upload-dropzone"
                >
                  <div className="upload-dropzone-icon">
                    <UploadCloud size={20} />
                  </div>
                  <div className="upload-dropzone-text">
                    <span className="upload-dropzone-primary">
                      Drag and drop your file here, or browse
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
                /* Selected File Card */
                <div className="selected-file-card" id="selected-file-card">
                  <div className="selected-file-info">
                    <div className="selected-file-icon">
                      <FileText size={18} />
                    </div>
                    <div className="selected-file-details">
                      <span className="selected-file-name">
                        {selectedFile.name}
                      </span>
                      <div className="selected-file-meta">
                        <span>{selectedFile.type}</span>
                        <span className="meta-separator">•</span>
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

          {/* STEP 2: ERROR STATE */}
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
        {step === 'select' && (
          <div className="modal-footer">
            <button className="btn-secondary" onClick={handleClose}>
              Cancel
            </button>
            <button
              className="btn-primary"
              onClick={handleStartProcessing}
              disabled={!selectedFile}
              style={{ opacity: selectedFile ? 1 : 0.45 }}
              id="btn-modal-create-graph"
            >
              <span>Create knowledge graph</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
