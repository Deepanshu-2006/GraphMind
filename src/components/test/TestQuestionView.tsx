import { memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowLeft, Bookmark } from 'lucide-react';
import type { TestQuestion, TestOption } from '../../types/test';

interface TestQuestionViewProps {
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
}

const optionVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.22,
      delay: i * 0.038,
      ease: [0.16, 1, 0.3, 1] as const
    }
  })
};

const OptionRow = memo(function OptionRow({
  option,
  index,
  isSelected,
  onSelect
}: {
  option: TestOption;
  index: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <motion.button
      type="button"
      className={`test-option-row ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(option.id)}
      custom={index}
      variants={optionVariants}
      initial="hidden"
      animate="visible"
      whileTap={{ scale: 0.995 }}
      role="radio"
      aria-checked={isSelected}
      aria-label={`Option ${option.id}: ${option.text}`}
    >
      <div className="option-row-left">
        <span className="option-slot-badge">{option.id}</span>
        <span className="option-slot-text">{option.text}</span>
      </div>

      <div className="option-row-right" aria-hidden="true">
        <span className="option-hover-arrow">→</span>
        {isSelected && (
          <motion.div
            className="option-active-accent-line"
            layoutId="optionAccent"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          />
        )}
      </div>
    </motion.button>
  );
});

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
  onToggleNavigator
}: TestQuestionViewProps) {
  const currentNumStr = (currentIndex + 1).toString().padStart(2, '0');
  const totalNumStr = totalQuestions.toString().padStart(2, '0');
  const progressRatio = (currentIndex + 1) / totalQuestions;

  const canAdvance = Boolean(selectedOptionId);

  return (
    <div className="test-question-workspace">
      {/* Editorial Progress Header */}
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

        {/* Thin editorial progress line */}
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

      {/* Central Visual Focus: Animated Question Body */}
      <AnimatePresence mode="wait">
        <motion.div
          key={question.id}
          className="test-question-card-canvas"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
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

          {/* Four Options */}
          <div 
            className="test-options-stack" 
            role="radiogroup" 
            aria-label="Answer options"
          >
            {question.options.map((opt, idx) => (
              <OptionRow
                key={opt.id}
                option={opt}
                index={idx}
                isSelected={selectedOptionId === opt.id}
                onSelect={onSelectOption}
              />
            ))}
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
