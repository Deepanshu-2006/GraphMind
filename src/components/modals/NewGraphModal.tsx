import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';

interface NewGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description?: string) => void;
  existingNames?: string[];
}

export const NewGraphModal: React.FC<NewGraphModalProps> = ({
  isOpen,
  onClose,
  onCreate,
  existingNames = []
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input upon opening
  useEffect(() => {
    if (isOpen) {
      setName('');
      setDescription('');
      setErrorMessage('');
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle keyboard shortcuts (Escape and Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setErrorMessage('Please provide a name for your graph.');
      inputRef.current?.focus();
      return;
    }

    if (trimmed.length > 80) {
      setErrorMessage('Graph name must be 80 characters or fewer.');
      return;
    }

    // Check duplicate name warning (soft prevention)
    const isDuplicate = existingNames.some(
      n => n.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      setErrorMessage('A graph with this name already exists.');
      return;
    }

    onCreate(trimmed, description.trim() || undefined);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="modal-backdrop"
          onClick={onClose}
          aria-modal="true"
          role="dialog"
          aria-labelledby="new-graph-modal-title"
        >
          <motion.div
            className="new-graph-dialog"
            onClick={(e) => e.stopPropagation()}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.99 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="new-graph-header">
              <h2 id="new-graph-modal-title" className="new-graph-title">
                New graph
              </h2>
              <button
                type="button"
                className="new-graph-close-btn"
                onClick={onClose}
                aria-label="Close dialog"
              >
                <X size={15} aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="new-graph-form" noValidate>
              <div className="new-graph-body">
                <div className="new-graph-field">
                  <label htmlFor="new-graph-name-input" className="new-graph-label">
                    Name
                  </label>
                  <input
                    id="new-graph-name-input"
                    ref={inputRef}
                    type="text"
                    className={`new-graph-input ${errorMessage ? 'has-error' : ''}`}
                    placeholder="e.g. Machine Learning"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      if (errorMessage) setErrorMessage('');
                    }}
                    maxLength={80}
                    autoComplete="off"
                    required
                  />
                  {errorMessage && (
                    <span className="new-graph-error" role="alert">
                      {errorMessage}
                    </span>
                  )}
                </div>

                <div className="new-graph-field">
                  <label htmlFor="new-graph-desc-input" className="new-graph-label">
                    Description <span className="new-graph-optional">(optional)</span>
                  </label>
                  <textarea
                    id="new-graph-desc-input"
                    className="new-graph-textarea"
                    placeholder="Brief description of this knowledge graph..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    maxLength={250}
                  />
                </div>
              </div>

              <div className="new-graph-actions">
                <button
                  type="button"
                  className="new-graph-btn-cancel"
                  onClick={onClose}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="new-graph-btn-submit"
                  id="btn-confirm-create-graph"
                >
                  Create graph
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
