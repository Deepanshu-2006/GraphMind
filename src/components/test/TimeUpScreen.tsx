import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export interface TimeUpScreenProps {
  onViewResults: () => void;
  assessmentName?: string;
  totalQuestions?: number;
  answeredCount?: number;
}

export const TimeUpScreen = memo(function TimeUpScreen({
  onViewResults,
  assessmentName = 'ASSESSMENT',
  totalQuestions = 10,
  answeredCount = 0
}: TimeUpScreenProps) {
  const shouldReduceMotion = useReducedMotion();

  // Controlled editorial bezier easing matching GraphMind identity
  const easeCurve = [0.16, 1, 0.3, 1] as const;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: shouldReduceMotion
        ? { duration: 0.01 }
        : {
            duration: 0.35,
            ease: easeCurve,
            staggerChildren: 0.08,
            delayChildren: 0.06
          }
    },
    exit: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : -14,
      transition: {
        duration: 0.22,
        ease: easeCurve
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 16 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.44,
        ease: easeCurve
      }
    }
  };

  const headingLineVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.48,
        ease: easeCurve
      }
    }
  };

  return (
    <motion.div
      className="test-timeup-stage"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      role="region"
      aria-label="Assessment time expired"
    >
      {/* 2. RESTRAINED VISUAL DETAIL: Subtle oversized background numeral (00:00) */}
      <div className="test-timeup-bg-numeral" aria-hidden="true">
        00:00
      </div>

      <div className="test-timeup-content">
        {/* A. STATUS */}
        <motion.div className="test-timeup-status-wrap" variants={itemVariants}>
          <div className="test-timeup-status" role="status">
            <span className="test-timeup-status-dot" aria-hidden="true">●</span>
            <span className="test-timeup-status-text">ASSESSMENT / TIME EXPIRED</span>
          </div>
        </motion.div>

        {/* B. MAIN HEADING */}
        <motion.h1 className="test-timeup-title" aria-label="Time's Up.">
          <motion.span className="test-timeup-title-line" variants={headingLineVariants}>
            TIME'S
          </motion.span>
          <motion.span className="test-timeup-title-line" variants={headingLineVariants}>
            UP<span className="test-timeup-period" aria-hidden="true">.</span>
          </motion.span>
        </motion.h1>

        {/* C. SUPPORTING MESSAGE */}
        <motion.p className="test-timeup-message" variants={itemVariants}>
          Your assessment has been submitted.
          <br />
          Your recorded answers are ready to review.
        </motion.p>

        {/* D. ASSESSMENT CONTEXT */}
        <motion.div
          className="test-timeup-context-row"
          variants={itemVariants}
          aria-label="Assessment metadata context"
        >
          <span className="test-timeup-context-item">{assessmentName}</span>
          <span className="test-timeup-context-sep" aria-hidden="true">·</span>
          <span className="test-timeup-context-item">{totalQuestions} QUESTIONS</span>
          <span className="test-timeup-context-sep" aria-hidden="true">·</span>
          <span className="test-timeup-context-item">{answeredCount} RECORDED</span>
        </motion.div>

        {/* E. PRIMARY ACTION */}
        <motion.div className="test-timeup-actions" variants={itemVariants}>
          <button
            type="button"
            className="test-timeup-action-btn"
            onClick={onViewResults}
            autoFocus
            aria-label="View assessment results"
          >
            <span className="test-timeup-action-text">VIEW RESULTS</span>
            <span className="test-timeup-action-arrow" aria-hidden="true">→</span>
            <span className="test-timeup-action-underline" aria-hidden="true" />
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
});
