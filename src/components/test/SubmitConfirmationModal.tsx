import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

interface SubmitConfirmationModalProps {
  isOpen: boolean;
  answeredCount: number;
  totalCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SubmitConfirmationModal({
  isOpen,
  answeredCount,
  totalCount,
  onConfirm,
  onCancel
}: SubmitConfirmationModalProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    cancelBtnRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  const unanswered = totalCount - answeredCount;

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
            aria-labelledby="submit-modal-title"
          >
            <div className="test-modal-kicker">CONFIRMATION</div>
            <h2 id="submit-modal-title" className="test-modal-title">SUBMIT TEST?</h2>
            <p className="test-modal-body">
              {unanswered > 0
                ? `You've answered ${answeredCount} of ${totalCount} questions. ${unanswered} question${unanswered === 1 ? '' : 's'} remain${unanswered === 1 ? 's' : ''} unanswered.`
                : `You've answered all ${totalCount} of ${totalCount} questions.`}
            </p>

            <div className="test-modal-actions">
              <button
                ref={cancelBtnRef}
                type="button"
                className="test-editorial-action-btn action-secondary"
                onClick={onCancel}
              >
                GO BACK
              </button>
              <button
                type="button"
                className="test-editorial-action-btn action-primary"
                onClick={onConfirm}
              >
                <span>SUBMIT TEST</span>
                <ArrowRight size={13} aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
