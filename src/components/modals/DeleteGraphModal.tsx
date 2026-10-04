import React, { useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteGraphModalProps {
  isOpen: boolean;
  graphName: string;
  onClose: () => void;
  onConfirm: () => void;
}

export const DeleteGraphModal: React.FC<DeleteGraphModalProps> = ({
  isOpen,
  graphName,
  onClose,
  onConfirm
}) => {
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="modal-backdrop"
          onClick={onClose}
          aria-modal="true"
          role="dialog"
          aria-labelledby="delete-graph-modal-title"
        >
          <motion.div
            className="delete-graph-dialog"
            onClick={(e) => e.stopPropagation()}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6, scale: 0.99 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="delete-graph-header">
              <div className="delete-graph-title-wrap">
                <AlertTriangle size={16} className="delete-graph-warning-icon" aria-hidden="true" />
                <h2 id="delete-graph-modal-title" className="delete-graph-title">
                  Delete graph
                </h2>
              </div>
              <button
                type="button"
                className="delete-graph-close-btn"
                onClick={onClose}
                aria-label="Close dialog"
              >
                <X size={15} aria-hidden="true" />
              </button>
            </div>

            <div className="delete-graph-body">
              <p className="delete-graph-message">
                This will remove this graph and all of its sources, concepts, relationships, and learning-path progress.
              </p>
              <div className="delete-graph-target-badge">
                <span className="delete-graph-target-label">Graph to delete:</span>
                <span className="delete-graph-target-name">{graphName}</span>
              </div>
            </div>

            <div className="delete-graph-actions">
              <button
                type="button"
                className="delete-graph-btn-cancel"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="button"
                className="delete-graph-btn-confirm"
                onClick={() => {
                  onConfirm();
                  onClose();
                }}
                id="btn-confirm-delete-graph"
                autoFocus
              >
                Delete graph
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
