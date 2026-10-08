import { memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface BigTimerProps {
  remainingSeconds: number;
  totalSeconds: number;
  isPaused?: boolean;
}

/**
 * Animated single digit that translates vertically on change.
 */
const AnimatedDigit = memo(function AnimatedDigit({ digit }: { digit: string }) {
  return (
    <span className="big-timer-digit-slot">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={digit}
          className="big-timer-digit"
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -8, opacity: 0 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
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
  isPaused = false
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
      className={`big-timer-container timer-urgency-${urgencyLevel} ${isPaused ? 'timer-paused' : ''}`}
      role="timer"
      aria-label={`Time remaining: ${minutesStr} minutes and ${secondsStr} seconds`}
      aria-live="off"
    >
      <div className="big-timer-digits">
        <AnimatedDigit digit={minutesStr[0]} />
        <AnimatedDigit digit={minutesStr[1]} />
        <span className="big-timer-separator">:</span>
        <AnimatedDigit digit={secondsStr[0]} />
        <AnimatedDigit digit={secondsStr[1]} />
      </div>
      <div className="big-timer-label">TIME REMAINING</div>
    </div>
  );
});
