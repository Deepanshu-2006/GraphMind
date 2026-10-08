import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LeaveConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function LeaveConfirmationModal({
  isOpen,
  onConfirm,
  onCancel
}: LeaveConfirmationModalProps) {
  const continueBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    continueBtnRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="test-modal-backdrop" onClick={onCancel}>
          <motion.div
            className="test-modal-card"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="leave-modal-title"
          >
            <div className="test-modal-kicker">EXIT TEST</div>
            <h2 id="leave-modal-title" className="test-modal-title">Leave test?</h2>
            <p className="test-modal-body">
              Your current progress and test timer will be lost. You can start a new assessment whenever you return.
            </p>

            <div className="test-modal-actions">
              <button
                ref={continueBtnRef}
                type="button"
                className="test-editorial-action-btn action-primary"
                onClick={onCancel}
              >
                CONTINUE TEST
              </button>
              <button
                type="button"
                className="test-editorial-action-btn action-danger"
                onClick={onConfirm}
              >
                EXIT TEST
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
