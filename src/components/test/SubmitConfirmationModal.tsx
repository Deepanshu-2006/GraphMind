import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface SubmitConfirmationModalProps {
  isOpen: boolean;
  answeredCount: number;
  totalCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Segmented Completion Ring (Section 5)
 * Renders N arc segments (for N questions) mathematically positioned around a 44px ring.
 * Staggers drawing sequentially (50–70ms) when modal opens.
 * Expands during submit calculation to bridge into the results visualization (Section 12).
 */
const SegmentedCompletionRing = memo(function SegmentedCompletionRing({
  totalCount,
  answeredCount,
  isSubmitting
}: {
  totalCount: number;
  answeredCount: number;
  isSubmitting: boolean;
}) {
  const safeTotal = Math.max(1, totalCount);
  const radius = 17;
  const center = 22;
  const slotAngle = 360 / safeTotal;
  const gapAngle = Math.min(7, Math.max(4, 40 / safeTotal));
  const spanAngle = Math.max(1, slotAngle - gapAngle);

  const segments = Array.from({ length: safeTotal }, (_, i) => {
    const isAnswered = i < answeredCount;
    const startAngle = -90 + i * slotAngle + gapAngle / 2;
    const endAngle = startAngle + spanAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);

    const d = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;

    return {
      index: i,
      d,
      isAnswered
    };
  });

  return (
    <motion.svg
      className="submit-ring-svg"
      viewBox="0 0 44 44"
      width="44"
      height="44"
      aria-hidden="true"
      animate={
        isSubmitting
          ? { scale: [1, 2.5], opacity: [1, 0.85] }
          : { scale: 1, opacity: 1 }
      }
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
    >
      {segments.map((seg) => (
        <motion.path
          key={seg.index}
          d={seg.d}
          fill="none"
          stroke={seg.isAnswered ? 'var(--accent, #A3FF12)' : 'rgba(255, 255, 255, 0.12)'}
          strokeWidth="2.2"
          strokeLinecap="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{
            duration: 0.22,
            delay: 0.26 + seg.index * 0.055, // 55ms sequential stagger
            ease: [0.16, 1, 0.3, 1]
          }}
        />
      ))}
    </motion.svg>
  );
});

export function SubmitConfirmationModal({
  isOpen,
  answeredCount,
  totalCount,
  onConfirm,
  onCancel
}: SubmitConfirmationModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitBtnRef = useRef<HTMLButtonElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  // Reset submit state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setIsSubmitting(false);
      // Autofocus the submit action
      const timer = setTimeout(() => {
        submitBtnRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleCancel = useCallback(() => {
    if (isSubmitting) return; // Cannot close while transition is executing (Section 14)
    onCancel();
  }, [isSubmitting, onCancel]);

  const handleTriggerSubmit = useCallback(() => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    // Section 11: 650ms choreographed submission transition
    // SUBMIT -> PROCESSING (CALCULATING) -> RESULTS
    const timer = setTimeout(() => {
      onConfirm();
    }, 650);

    return () => clearTimeout(timer);
  }, [isSubmitting, onConfirm]);

  // Global Keyboard listener for Enter & Escape (Section 14 & 15)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleCancel();
      } else if (e.key === 'Enter') {
        // If Enter is pressed inside modal, trigger submit
        e.preventDefault();
        handleTriggerSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleCancel, handleTriggerSubmit]);

  const unanswered = Math.max(0, totalCount - answeredCount);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="submit-assessment-backdrop"
          onClick={handleCancel}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            className="submit-assessment-card"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="submit-modal-title"
            aria-describedby="submit-modal-description"
            initial={{ opacity: 0, y: 14, scale: 0.985 }}
            animate={
              isSubmitting
                ? { opacity: 0, scale: 0.96, y: -6 }
                : { opacity: 1, y: 0, scale: 1 }
            }
            exit={{ opacity: 0, y: 10, scale: 0.985 }}
            transition={{ duration: isSubmitting ? 0.45 : 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Step 3: Small Metadata Eyebrow (Section 1, 2, 3) */}
            <motion.div
              className="submit-modal-eyebrow"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
            >
              <span className="submit-eyebrow-marker" aria-hidden="true">•</span>
              <span>ASSESSMENT COMPLETE</span>
            </motion.div>

            {/* Step 4: Editorial Headline (Section 1, 3) */}
            <motion.h2
              id="submit-modal-title"
              className="submit-modal-heading"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
            >
              READY TO SEE<br />HOW YOU DID?
            </motion.h2>

            {/* Step 5: Supporting Copy (Section 1, 3) */}
            <motion.p
              id="submit-modal-description"
              className="submit-modal-supporting"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.32, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {unanswered === 0
                ? `You've answered all ${totalCount} questions. Your result will be calculated from your answers.`
                : `You've answered ${answeredCount} of ${totalCount} questions. ${unanswered} remain unanswered. Your result will be calculated from your answers.`}
            </motion.p>

            {/* Step 6: Completion Ring Visual & Fraction (Section 4 & 5) */}
            <motion.div
              className="submit-completion-block"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, delay: 0.26, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="submit-ring-wrapper">
                <SegmentedCompletionRing
                  totalCount={totalCount}
                  answeredCount={answeredCount}
                  isSubmitting={isSubmitting}
                />
              </div>

              <span className="submit-completion-fraction">
                {answeredCount.toString().padStart(2, '0')} / {totalCount.toString().padStart(2, '0')}
              </span>
              <span className="submit-completion-label">
                {answeredCount === totalCount ? 'ALL ANSWERED' : 'ANSWERED'}
              </span>
            </motion.div>

            {/* Step 7: Actions (Section 1, 9, 10, 11, 13) */}
            <motion.div
              className="submit-modal-actions"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
            >
              <button
                ref={cancelBtnRef}
                type="button"
                className="submit-action-back-btn"
                onClick={handleCancel}
                disabled={isSubmitting}
              >
                <span className="back-arrow" aria-hidden="true">←</span>
                <span>GO BACK</span>
              </button>

              <button
                ref={submitBtnRef}
                type="button"
                className={`submit-action-confirm-btn ${isSubmitting ? 'is-submitting' : ''}`}
                onClick={handleTriggerSubmit}
                disabled={isSubmitting}
              >
                <span className="confirm-btn-content">
                  <span className="confirm-btn-label">
                    {isSubmitting ? 'CALCULATING' : 'SUBMIT TEST'}
                  </span>
                  <span className="confirm-btn-arrow" aria-hidden="true">
                    {isSubmitting ? '...' : '→'}
                  </span>
                </span>

                {/* Subtitle Underline on hover (Section 10) */}
                <span className="confirm-btn-underline" aria-hidden="true" />

                {/* Left-to-right sweep line on click (Section 11) */}
                {isSubmitting && (
                  <motion.span
                    className="confirm-btn-sweep-line"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                    aria-hidden="true"
                  />
                )}
              </button>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
