import { useEffect, useRef, useState, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface LeaveConfirmationModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  answeredCount?: number;
  totalCount?: number;
  remainingSeconds?: number;
  testLabel?: string;
}

/**
 * Format remaining seconds into MM:SS format (e.g. 588 -> "09:48")
 */
export function formatRemainingTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export const LeaveConfirmationModal = memo(function LeaveConfirmationModal({
  isOpen,
  onConfirm,
  onCancel,
  answeredCount = 0,
  totalCount = 10,
  remainingSeconds = 600,
  testLabel = 'TEST 01'
}: LeaveConfirmationModalProps) {
  const continueBtnRef = useRef<HTMLButtonElement>(null);
  const exitBtnRef = useRef<HTMLButtonElement>(null);

  // Tracks closing transition phase: 'continue' (retract reverse) or 'exit' (quick transition)
  const [closingType, setClosingType] = useState<'continue' | 'exit' | null>(null);

  // Formatted remaining time in MM:SS
  const formattedTime = formatRemainingTime(remainingSeconds);

  // Reset closing state when modal becomes open
  useEffect(() => {
    if (isOpen) {
      setClosingType(null);
    }
  }, [isOpen]);

  // Handle safe cancel (CONTINUE TEST or Escape) with reverse entrance retraction
  const handleSafeCancel = useCallback(() => {
    if (closingType) return;
    setClosingType('continue');
    setTimeout(() => {
      onCancel();
      setClosingType(null);
    }, 240);
  }, [closingType, onCancel]);

  // Handle confirmed exit with fast exit transition
  const handleConfirmExit = useCallback(() => {
    if (closingType) return;
    setClosingType('exit');
    setTimeout(() => {
      onConfirm();
      setClosingType(null);
    }, 180);
  }, [closingType, onConfirm]);

  // Escape listener, auto-focus, and Tab focus trap (Section 13)
  useEffect(() => {
    if (!isOpen || closingType) return;

    // Focus automatically on CONTINUE TEST
    const focusTimer = setTimeout(() => {
      continueBtnRef.current?.focus();
    }, 40);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleSafeCancel();
      } else if (e.key === 'Tab') {
        const continueBtn = continueBtnRef.current;
        const exitBtn = exitBtnRef.current;
        if (!continueBtn || !exitBtn) return;

        if (e.shiftKey) {
          if (document.activeElement === continueBtn) {
            e.preventDefault();
            exitBtn.focus();
          }
        } else {
          if (document.activeElement === exitBtn) {
            e.preventDefault();
            continueBtn.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closingType, handleSafeCancel]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="leave-modal-backdrop"
          onClick={handleSafeCancel}
          initial={{ opacity: 0 }}
          animate={{ opacity: closingType ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            className="leave-modal-card"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.985, y: 12 }}
            animate={
              closingType === 'continue'
                ? { opacity: 0, scale: 0.985, y: -8 }
                : closingType === 'exit'
                ? { opacity: 0, scale: 0.98, y: 4 }
                : { opacity: 1, scale: 1, y: 0 }
            }
            exit={{ opacity: 0, scale: 0.985, y: 8 }}
            transition={{
              duration: closingType === 'exit' ? 0.18 : 0.32,
              ease: [0.16, 1, 0.3, 1]
            }}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="leave-modal-title"
            aria-describedby="leave-modal-desc"
          >
            {/* GROUP 1: Status marker (Section 4 & 11) */}
            <motion.div
              className="leave-modal-group leave-modal-group-status"
              initial={{ opacity: 0, y: 8 }}
              animate={
                closingType === 'continue'
                  ? { opacity: 0, y: 6, transition: { duration: 0.16, delay: 0.08 } }
                  : { opacity: 1, y: 0, transition: { duration: 0.26, delay: 0.05, ease: [0.16, 1, 0.3, 1] } }
              }
            >
              <div className="leave-modal-status-marker">
                <span className="leave-status-dot" aria-hidden="true">●</span>
                <span className="leave-status-text">EXITING TEST</span>
              </div>
            </motion.div>

            {/* GROUP 2: Main title + Body copy (Section 5, 6, 11) */}
            <motion.div
              className="leave-modal-group leave-modal-group-content"
              initial={{ opacity: 0, y: 8 }}
              animate={
                closingType === 'continue'
                  ? { opacity: 0, y: 6, transition: { duration: 0.16, delay: 0.04 } }
                  : { opacity: 1, y: 0, transition: { duration: 0.26, delay: 0.10, ease: [0.16, 1, 0.3, 1] } }
              }
            >
              <h2 id="leave-modal-title" className="leave-modal-title">
                Leave this test?
              </h2>
              <p id="leave-modal-desc" className="leave-modal-body">
                Your current progress and remaining time will be lost.
                <br />
                You can start a new assessment when you return.
              </p>
            </motion.div>

            {/* GROUP 3: Live Test Context Line + Action Buttons (Section 7, 8, 9, 11) */}
            <motion.div
              className="leave-modal-group leave-modal-group-footer"
              initial={{ opacity: 0, y: 8 }}
              animate={
                closingType === 'continue'
                  ? { opacity: 0, y: 6, transition: { duration: 0.16, delay: 0 } }
                  : { opacity: 1, y: 0, transition: { duration: 0.26, delay: 0.16, ease: [0.16, 1, 0.3, 1] } }
              }
            >
              {/* Context line: TEST 01  ·  7 / 10 ANSWERED  ·  09:48 REMAINING (Section 7) */}
              <div className="leave-modal-context-line" aria-label="Current test state">
                <span>{testLabel}</span>
                <span className="leave-context-sep" aria-hidden="true">·</span>
                <span>{answeredCount} / {totalCount} ANSWERED</span>
                <span className="leave-context-sep" aria-hidden="true">·</span>
                <span>{formattedTime} REMAINING</span>
              </div>

              {/* Action Buttons: CONTINUE TEST →  ...  EXIT TEST (Section 8 & 9) */}
              <div className="leave-modal-actions">
                <button
                  ref={continueBtnRef}
                  type="button"
                  className="leave-action-continue-btn"
                  onClick={handleSafeCancel}
                  autoFocus
                >
                  <span>CONTINUE TEST</span>
                  <span className="leave-continue-arrow" aria-hidden="true">→</span>
                </button>

                <button
                  ref={exitBtnRef}
                  type="button"
                  className="leave-action-exit-btn"
                  onClick={handleConfirmExit}
                >
                  <span>EXIT TEST</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});
