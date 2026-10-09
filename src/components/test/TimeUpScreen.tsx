import { memo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

export interface TimeUpScreenProps {
  onViewResults: () => void;
  assessmentName?: string;
  totalQuestions?: number;
  answeredCount?: number;
  initialTimerOffset?: { x: number; y: number };
}

export const TimeUpScreen = memo(function TimeUpScreen({
  onViewResults,
  assessmentName = 'ASSESSMENT',
  totalQuestions = 10,
  answeredCount = 0,
  initialTimerOffset = { x: -280, y: -220 }
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

  // Atmospheric background numeral appears subtly after the hero settles
  const bgNumeralVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: shouldReduceMotion
        ? { duration: 0.01 }
        : {
            duration: 0.8,
            ease: easeCurve,
            delay: 3.2
          }
    }
  };

  // STAGE B: Clock glides from topbar into the exact center of main content area and scales up substantially
  // Duration: 0.8s. Smooth acceleration followed by long controlled deceleration.
  const clockContainerVariants = {
    hidden: {
      x: initialTimerOffset.x,
      y: initialTimerOffset.y,
      scale: 0.42,
      opacity: 1
    },
    initial: {
      x: initialTimerOffset.x,
      y: initialTimerOffset.y,
      scale: 0.42,
      opacity: 1
    },
    visible: {
      x: 0,
      y: 0,
      scale: 1,
      opacity: 1,
      transition: shouldReduceMotion
        ? { duration: 0.01 }
        : {
            duration: 0.8,
            ease: easeCurve
          }
    },
    animate: {
      x: 0,
      y: 0,
      scale: 1,
      opacity: 1,
      transition: shouldReduceMotion
        ? { duration: 0.01 }
        : {
            duration: 0.8,
            ease: easeCurve
          }
    }
  };

  // STAGE C: Enlarged clock holds at 00:00 for ~900ms (until delay 1.7s), then digits begin separating visually and dissolving upward
  const minutesGroupVariants = {
    hidden: { x: 0, y: 0, opacity: 1 },
    initial: { x: 0, y: 0, opacity: 1 },
    visible: {
      x: shouldReduceMotion ? 0 : -48,
      y: shouldReduceMotion ? 0 : -36,
      opacity: 0,
      transition: shouldReduceMotion
        ? { duration: 0.01 }
        : {
            duration: 0.85,
            delay: 1.7,
            ease: easeCurve
          }
    },
    animate: {
      x: shouldReduceMotion ? 0 : -48,
      y: shouldReduceMotion ? 0 : -36,
      opacity: 0,
      transition: shouldReduceMotion
        ? { duration: 0.01 }
        : {
            duration: 0.85,
            delay: 1.7,
            ease: easeCurve
          }
    }
  };

  const secondsGroupVariants = {
    hidden: { x: 0, y: 0, opacity: 1 },
    initial: { x: 0, y: 0, opacity: 1 },
    visible: {
      x: shouldReduceMotion ? 0 : 48,
      y: shouldReduceMotion ? 0 : -36,
      opacity: 0,
      transition: shouldReduceMotion
        ? { duration: 0.01 }
        : {
            duration: 0.85,
            delay: 1.7,
            ease: easeCurve
          }
    },
    animate: {
      x: shouldReduceMotion ? 0 : 48,
      y: shouldReduceMotion ? 0 : -36,
      opacity: 0,
      transition: shouldReduceMotion
        ? { duration: 0.01 }
        : {
            duration: 0.85,
            delay: 1.7,
            ease: easeCurve
          }
    }
  };

  const separatorVariants = {
    hidden: { opacity: 0.85, scale: 1 },
    initial: { opacity: 0.85, scale: 1 },
    visible: {
      opacity: 0,
      scale: 0.75,
      transition: shouldReduceMotion
        ? { duration: 0.01 }
        : {
            duration: 0.6,
            delay: 1.7,
            ease: easeCurve
          }
    },
    animate: {
      opacity: 0,
      scale: 0.75,
      transition: shouldReduceMotion
        ? { duration: 0.01 }
        : {
            duration: 0.6,
            delay: 1.7,
            ease: easeCurve
          }
    }
  };

  // STAGE D: Coordinated two-line heading reveal emerging directly while the clock is dissolving
  // TIME'S starts at delay 1.9s, BEFORE the clock has completely disappeared at 2.55s
  const headingLine1Variants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : '100%' },
    initial: { opacity: 0, y: shouldReduceMotion ? 0 : '100%' },
    visible: {
      opacity: 1,
      y: '0%',
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.65,
        ease: easeCurve,
        delay: shouldReduceMotion ? 0 : 1.9
      }
    },
    animate: {
      opacity: 1,
      y: '0%',
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.65,
        ease: easeCurve,
        delay: shouldReduceMotion ? 0 : 1.9
      }
    }
  };

  const headingLine2Variants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : '100%' },
    initial: { opacity: 0, y: shouldReduceMotion ? 0 : '100%' },
    visible: {
      opacity: 1,
      y: '0%',
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.65,
        ease: easeCurve,
        delay: shouldReduceMotion ? 0 : 2.35
      }
    },
    animate: {
      opacity: 1,
      y: '0%',
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.65,
        ease: easeCurve,
        delay: shouldReduceMotion ? 0 : 2.35
      }
    }
  };

  // STAGE E: Status eyebrow, supporting message, metadata, and primary action settle sequentially
  const statusVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
    initial: { opacity: 0, y: shouldReduceMotion ? 0 : 8 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.45,
        ease: easeCurve,
        delay: shouldReduceMotion ? 0 : 2.85
      }
    },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.45,
        ease: easeCurve,
        delay: shouldReduceMotion ? 0 : 2.85
      }
    }
  };

  const messageVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 12 },
    initial: { opacity: 0, y: shouldReduceMotion ? 0 : 12 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.45,
        ease: easeCurve,
        delay: shouldReduceMotion ? 0 : 3.05
      }
    },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.45,
        ease: easeCurve,
        delay: shouldReduceMotion ? 0 : 3.05
      }
    }
  };

  const contextVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 10 },
    initial: { opacity: 0, y: shouldReduceMotion ? 0 : 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.4,
        ease: easeCurve,
        delay: shouldReduceMotion ? 0 : 3.25
      }
    },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.4,
        ease: easeCurve,
        delay: shouldReduceMotion ? 0 : 3.25
      }
    }
  };

  const actionVariants = {
    hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 10 },
    initial: { opacity: 0, y: shouldReduceMotion ? 0 : 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.45,
        ease: easeCurve,
        delay: shouldReduceMotion ? 0 : 3.45
      }
    },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0.01 : 0.45,
        ease: easeCurve,
        delay: shouldReduceMotion ? 0 : 3.45
      }
    }
  };

  return (
    <motion.div
      className="test-timeup-stage test-timeup-transition-layer"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      role="region"
      aria-label="Assessment time expired"
    >
      {/* 1. ATMOSPHERIC BACKGROUND DETAIL: Extremely low-contrast 00:00 numeral */}
      <motion.div
        className="test-timeup-bg-numeral"
        variants={bgNumeralVariants}
        initial="hidden"
        animate="visible"
        aria-hidden="true"
      >
        00:00
      </motion.div>

      <div className="test-timeup-content">
        {/* A. STATUS */}
        <motion.div
          className="test-timeup-status-wrap"
          variants={statusVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="test-timeup-status" role="status">
            <span className="test-timeup-status-dot" aria-hidden="true">●</span>
            <span className="test-timeup-status-text">ASSESSMENT / TIME EXPIRED</span>
          </div>
        </motion.div>

        {/* B. HERO ANCHOR: TRANSFORMING CLOCK & EMERGING HEADING */}
        <div className="test-timeup-hero-anchor">
          {/* Transforming Clock (moves from topbar, centers in content bounds, scales up, then separates and dissolves upward) */}
          {!shouldReduceMotion && (
            <motion.div
              className="test-timeup-cinematic-clock"
              variants={clockContainerVariants}
              initial="hidden"
              animate="visible"
              aria-hidden="true"
            >
              <motion.span
                className="test-timeup-clock-group group-minutes"
                variants={minutesGroupVariants}
                initial="hidden"
                animate="visible"
              >
                <span className="test-timeup-clock-digit">0</span>
                <span className="test-timeup-clock-digit">0</span>
              </motion.span>
              <motion.span
                className="test-timeup-clock-sep"
                variants={separatorVariants}
                initial="hidden"
                animate="visible"
              >
                :
              </motion.span>
              <motion.span
                className="test-timeup-clock-group group-seconds"
                variants={secondsGroupVariants}
                initial="hidden"
                animate="visible"
              >
                <span className="test-timeup-clock-digit">0</span>
                <span className="test-timeup-clock-digit">0</span>
              </motion.span>
            </motion.div>
          )}

          {/* Main Heading emerges directly from the clock transformation */}
          <motion.h1 className="test-timeup-title" aria-label="Time's Up.">
            <span className="test-timeup-title-line-mask">
              <motion.span
                className="test-timeup-title-line"
                variants={headingLine1Variants}
                initial="hidden"
                animate="visible"
              >
                TIME'S
              </motion.span>
            </span>
            <span className="test-timeup-title-line-mask">
              <motion.span
                className="test-timeup-title-line"
                variants={headingLine2Variants}
                initial="hidden"
                animate="visible"
              >
                UP<span className="test-timeup-period" aria-hidden="true">.</span>
              </motion.span>
            </span>
          </motion.h1>
        </div>

        {/* FOOTER GROUP: Supporting message, assessment metadata context, and action button */}
        <div className="test-timeup-footer-group">
          {/* C. SUPPORTING MESSAGE */}
          <motion.p
            className="test-timeup-message"
            variants={messageVariants}
            initial="hidden"
            animate="visible"
          >
            Your assessment has been submitted.
            <br />
            Your recorded answers are ready to review.
          </motion.p>

          {/* D. ASSESSMENT CONTEXT */}
          <motion.div
            className="test-timeup-context-row"
            variants={contextVariants}
            initial="hidden"
            animate="visible"
            aria-label="Assessment metadata context"
          >
            <span className="test-timeup-context-item">{assessmentName}</span>
            <span className="test-timeup-context-sep" aria-hidden="true">·</span>
            <span className="test-timeup-context-item">{totalQuestions} QUESTIONS</span>
            <span className="test-timeup-context-sep" aria-hidden="true">·</span>
            <span className="test-timeup-context-item">{answeredCount} RECORDED</span>
          </motion.div>

          {/* E. PRIMARY ACTION */}
          <motion.div
            className="test-timeup-actions"
            variants={actionVariants}
            initial="hidden"
            animate="visible"
          >
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
      </div>
    </motion.div>
  );
});
