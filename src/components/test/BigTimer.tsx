import { memo, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';

interface BigTimerProps {
  remainingSeconds: number;
  totalSeconds: number;
  isPaused?: boolean;
  isTransitionAccent?: boolean;
  isTransitioning?: boolean;
}

/**
 * Animated single digit column that rolls vertically when changed.
 * Outgoing digit moves downward (+100%) out of the slot window,
 * while incoming digit slides downward into place from above (-100% to 0%).
 * Uses cubic-bezier(0.22, 1, 0.36, 1) over 400ms without fade or scale.
 */
const AnimatedDigit = memo(function AnimatedDigit({ digit }: { digit: string }) {
  const shouldReduceMotion = useReducedMotion();

  if (shouldReduceMotion) {
    return (
      <span className="big-timer-digit-slot">
        <span className="big-timer-digit">{digit}</span>
      </span>
    );
  }

  return (
    <span className="big-timer-digit-slot">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={digit}
          className="big-timer-digit"
          initial={{ y: '-100%' }}
          animate={{ y: '0%' }}
          exit={{ y: '100%' }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          {digit}
        </motion.span>
      </AnimatePresence>
    </span>
  );
});

export const BigTimer = memo(function BigTimer({
  remainingSeconds,
  totalSeconds,
  isPaused = false,
  isTransitionAccent = false,
  isTransitioning = false
}: BigTimerProps) {
  const safeRemaining = Math.max(0, remainingSeconds);

  const { minutesStr, secondsStr, urgencyLevel } = useMemo(() => {
    const mins = Math.floor(safeRemaining / 60);
    const secs = safeRemaining % 60;
    const mStr = mins.toString().padStart(2, '0');
    const sStr = secs.toString().padStart(2, '0');

    // Urgency calculation
    // Healthy: > 25% remaining
    // Emphasis: <= 25% remaining
    // Warning: <= 10% remaining
    // Critical: <= 30 seconds
    const ratio = totalSeconds > 0 ? safeRemaining / totalSeconds : 1;
    let level: 'healthy' | 'emphasis' | 'warning' | 'critical' = 'healthy';

    if (safeRemaining <= 30) {
      level = 'critical';
    } else if (ratio <= 0.1 || safeRemaining <= 60) {
      level = 'warning';
    } else if (ratio <= 0.25) {
      level = 'emphasis';
    }

    return { minutesStr: mStr, secondsStr: sStr, urgencyLevel: level };
  }, [safeRemaining, totalSeconds]);

  return (
    <div 
      className={`big-timer-container timer-urgency-${urgencyLevel} ${isPaused ? 'timer-paused' : ''} ${
        isTransitionAccent ? 'timer-transition-accent' : ''
      } ${isTransitioning ? 'is-transitioning' : ''}`}
      role="timer"
      aria-label={`Time remaining: ${minutesStr} minutes and ${secondsStr} seconds`}
      aria-live="off"
    >
      <div className="big-timer-digits">
        <AnimatedDigit digit={minutesStr[0]} />
        <AnimatedDigit digit={minutesStr[1]} />
        <span className="big-timer-separator" aria-hidden="true">:</span>
        <AnimatedDigit digit={secondsStr[0]} />
        <AnimatedDigit digit={secondsStr[1]} />
      </div>
      <div className="big-timer-label">TIME REMAINING</div>
    </div>
  );
});
