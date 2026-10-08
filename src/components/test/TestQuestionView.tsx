import { memo, useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, type Variants } from 'framer-motion';
import { ArrowRight, ArrowLeft, Bookmark } from 'lucide-react';
import type { TestQuestion, TestOption } from '../../types/test';

export interface TestQuestionViewProps {
  question: TestQuestion;
  currentIndex: number;
  totalQuestions: number;
  selectedOptionId?: string;
  isFlagged: boolean;
  onSelectOption: (optionId: string) => void;
  onToggleFlag: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSubmit: () => void;
  isFirst: boolean;
  isLast: boolean;
  onToggleNavigator: () => void;
  showFeedback?: boolean;
}

/**
 * Editorial Sequential Stagger for Option List Entry (Section 12)
 * 01 appears first, 02 ~50ms later, 03 ~50ms later, 04 ~50ms later
 * translateY(8px -> 0) with opacity
 */
const optionRowVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.22,
      delay: i * 0.05,
      ease: [0.16, 1, 0.3, 1] as const
    }
  })
};

interface OptionRowProps {
  option: TestOption;
  index: number;
  isSelected: boolean;
  isFocused: boolean;
  showFeedback?: boolean;
  isCorrect?: boolean;
  isRevealedCorrect?: boolean;
  onSelect: (id: string) => void;
  onFocus: () => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
}

const OptionRow = memo(function OptionRow({
  option,
  index,
  isSelected,
  isFocused,
  showFeedback,
  isCorrect,
  isRevealedCorrect,
  onSelect,
  onFocus,
  buttonRef
}: OptionRowProps) {
  // Format two-digit tabular anchor numeral: 01, 02, 03, 04 (Section 1 & 15)
  const formattedNumber = /^\d+$/.test(option.id)
    ? option.id.padStart(2, '0')
    : String(index + 1).padStart(2, '0');

  // Feedback states (Section 10 & 11)
  const isStateCorrect = Boolean(showFeedback && (isCorrect || isRevealedCorrect));
  const isStateIncorrect = Boolean(showFeedback && isSelected && !isCorrect);

  const rowClasses = [
    'test-option-row',
    isSelected ? 'selected' : '',
    isFocused ? 'is-focused' : '',
    isStateCorrect ? 'state-correct' : '',
    isStateIncorrect ? 'state-incorrect' : ''
  ].filter(Boolean).join(' ');

  return (
    <motion.button
      ref={buttonRef}
      type="button"
      className={rowClasses}
      onClick={() => onSelect(option.id)}
      onFocus={onFocus}
      custom={index}
      variants={optionRowVariants}
      initial="hidden"
      animate="visible"
      role="radio"
      aria-checked={isSelected}
      aria-label={`Option ${formattedNumber}: ${option.text}`}
      tabIndex={isFocused ? 0 : -1}
    >
      {/* Step 1 & 2: Vertical Left Rule on Selection / Feedback (Section 6 & 7) */}
      <AnimatePresence>
        {(isSelected || isStateCorrect || isStateIncorrect) && (
          <motion.span
            className={`option-edge-rule ${isStateIncorrect ? 'edge-amber' : ''}`}
            initial={{ scaleY: 0, opacity: 0 }}
            animate={{ scaleY: 1, opacity: 1 }}
            exit={{ scaleY: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
      </AnimatePresence>

      {/* Option Number Column with sliding hover dot (Section 3, 5, 15) */}
      <div className="option-row-left">
        <span className="option-hover-marker" aria-hidden="true">•</span>
        <span className="option-slot-badge">{formattedNumber}</span>
      </div>

      {/* Option Text Column with tactile 4px shift and settle motion (Section 5, 7, 8) */}
      <div className="option-row-center">
        <motion.span
          className="option-slot-text"
          animate={
            isSelected
              ? { x: [0, 4, 3] }
              : isFocused
              ? { x: 4 }
              : { x: 0 }
          }
          transition={{
            duration: isSelected ? 0.32 : 0.18,
            ease: [0.16, 1, 0.3, 1]
          }}
        >
          {option.text}
        </motion.span>
      </div>

      {/* Right Selection Indicator & Optional Correct Reveal (Section 2, 7, 10, 11) */}
      <div className="option-row-right" aria-hidden="true">
        {isRevealedCorrect && (
          <motion.span
            className="option-reveal-correct-label"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          >
            CORRECT
          </motion.span>
        )}

        <svg
          className="option-indicator-svg"
          viewBox="0 0 16 16"
          width="16"
          height="16"
        >
          <circle
            cx="8"
            cy="8"
            r="6"
            className="option-indicator-ring"
          />
          {(isSelected || isStateCorrect) && (
            <motion.circle
              cx="8"
              cy="8"
              r="3.2"
              className={`option-indicator-dot ${isStateIncorrect ? 'dot-amber' : ''}`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            />
          )}
        </svg>
      </div>
    </motion.button>
  );
});

/**
 * Directional Question Transition Variants (Section 13)
 * NEXT: moves 18px upward and fades out; next enters from 18px below
 * PREVIOUS: moves 18px downward and fades out; previous enters from 18px above
 */
const questionCanvasVariants: Variants = {
  enter: (dir: number) => ({
    opacity: 0,
    y: dir >= 0 ? 18 : -18,
    transition: { duration: 0.24, ease: [0.16, 1, 0.3, 1] as const }
  }),
  center: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.26, ease: [0.16, 1, 0.3, 1] as const }
  },
  exit: (dir: number) => ({
    opacity: 0,
    y: dir >= 0 ? -18 : 18,
    transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] as const }
  })
};

export function TestQuestionView({
  question,
  currentIndex,
  totalQuestions,
  selectedOptionId,
  isFlagged,
  onSelectOption,
  onToggleFlag,
  onPrev,
  onNext,
  onSubmit,
  isFirst,
  isLast,
  onToggleNavigator,
  showFeedback = false
}: TestQuestionViewProps) {
  const currentNumStr = (currentIndex + 1).toString().padStart(2, '0');
  const totalNumStr = totalQuestions.toString().padStart(2, '0');
  const progressRatio = (currentIndex + 1) / totalQuestions;
  const canAdvance = Boolean(selectedOptionId);

  // Direction tracking for Section 13 transition
  const prevIndexRef = useRef(currentIndex);
  const [direction, setDirection] = useState<number>(1);

  useEffect(() => {
    if (currentIndex > prevIndexRef.current) {
      setDirection(1); // Moving forward
    } else if (currentIndex < prevIndexRef.current) {
      setDirection(-1); // Moving backward
    }
    prevIndexRef.current = currentIndex;
  }, [currentIndex]);

  // Keyboard focus index for Arrow navigation (Section 9)
  const [focusedIndex, setFocusedIndex] = useState<number>(() => {
    const selIdx = question.options.findIndex(opt => opt.id === selectedOptionId);
    return selIdx >= 0 ? selIdx : 0;
  });

  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const selIdx = question.options.findIndex(opt => opt.id === selectedOptionId);
    if (selIdx >= 0) {
      setFocusedIndex(selIdx);
    } else {
      setFocusedIndex(0);
    }
  }, [question.id, selectedOptionId]);

  // Keyboard support: ArrowUp, ArrowDown, Enter, Space (Section 9)
  const handleStackKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(prev => {
        const next = (prev + 1) % question.options.length;
        optionRefs.current[next]?.focus();
        return next;
      });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(prev => {
        const next = (prev - 1 + question.options.length) % question.options.length;
        optionRefs.current[next]?.focus();
        return next;
      });
    } else if (e.key === ' ' || e.key === 'Enter') {
      const activeOpt = question.options[focusedIndex];
      if (activeOpt) {
        e.preventDefault();
        onSelectOption(activeOpt.id);
      }
    }
  }, [question.options, focusedIndex, onSelectOption]);

  return (
    <div className="test-question-workspace">
      {/* Editorial Progress Header - Remains stable across question navigation (Section 13) */}
      <div className="test-question-header-bar">
        <div className="question-header-left">
          <button
            type="button"
            className="question-index-toggle-btn"
            onClick={onToggleNavigator}
            title="Click to view question navigator"
            aria-label={`Question ${currentNumStr} of ${totalNumStr}. Click to open navigator.`}
          >
            <span className="q-label-kicker">QUESTION</span>
            <span className="q-label-number">{currentNumStr} / {totalNumStr}</span>
          </button>
        </div>

        {/* Stable continuous progress track */}
        <div className="test-progress-track" aria-hidden="true">
          <motion.div
            className="test-progress-fill"
            animate={{ width: `${progressRatio * 100}%` }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>

        <div className="question-header-right">
          <button
            type="button"
            className={`question-flag-btn ${isFlagged ? 'flagged' : ''}`}
            onClick={onToggleFlag}
            title={isFlagged ? 'Flagged question (click to unflag)' : 'Flag for review later'}
            aria-pressed={isFlagged}
          >
            <Bookmark size={12} className="flag-icon" aria-hidden="true" />
            <span>{isFlagged ? 'FLAGGED' : 'FLAG'}</span>
          </button>
        </div>
      </div>

      {/* Directional Question Transition Canvas (Section 13) */}
      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={question.id}
          custom={direction}
          variants={questionCanvasVariants}
          initial="enter"
          animate="center"
          exit="exit"
          className="test-question-card-canvas"
        >
          <div className="test-question-meta">
            <span className="test-question-type-tag">
              {question.type.toUpperCase()} UNDERSTANDING
            </span>
            {question.conceptNames.length > 0 && (
              <span className="test-question-concept-tag">
                {question.conceptNames[0]}
              </span>
            )}
          </div>

          <h2 className="test-question-text">
            {question.question}
          </h2>

          {/* Composed Editorial Answer List (Section 1, 2, 14, 19) */}
          <div 
            className="test-options-stack" 
            role="radiogroup" 
            aria-label="Answer options"
            onKeyDown={handleStackKeyDown}
          >
            {question.options.map((opt, idx) => {
              const isSelected = selectedOptionId === opt.id;
              const isCorrect = opt.id === question.correctOptionId;
              const isRevealedCorrect = Boolean(
                showFeedback && 
                isCorrect && 
                selectedOptionId && 
                selectedOptionId !== opt.id
              );

              return (
                <OptionRow
                  key={opt.id}
                  option={opt}
                  index={idx}
                  isSelected={isSelected}
                  isFocused={focusedIndex === idx}
                  showFeedback={showFeedback}
                  isCorrect={isCorrect}
                  isRevealedCorrect={isRevealedCorrect}
                  onSelect={onSelectOption}
                  onFocus={() => setFocusedIndex(idx)}
                  buttonRef={(el) => {
                    optionRefs.current[idx] = el;
                  }}
                />
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Bottom Navigation */}
      <div className="test-question-bottom-nav">
        <button
          type="button"
          className="test-nav-btn btn-prev"
          onClick={onPrev}
          disabled={isFirst}
          title="Previous question (ArrowLeft)"
        >
          <ArrowLeft size={13} aria-hidden="true" />
          <span>PREVIOUS</span>
        </button>

        <div className="bottom-nav-right">
          {isLast ? (
            <button
              type="button"
              className="test-nav-btn btn-submit"
              onClick={onSubmit}
              disabled={!canAdvance}
              title="Submit test"
            >
              <span>SUBMIT TEST</span>
              <ArrowRight size={13} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="test-nav-btn btn-next"
              onClick={onNext}
              disabled={!canAdvance}
              title={canAdvance ? "Next question (Enter / ArrowRight)" : "Select an answer to proceed"}
            >
              <span>NEXT</span>
              <ArrowRight size={13} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
