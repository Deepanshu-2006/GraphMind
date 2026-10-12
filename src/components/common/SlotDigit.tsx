import { memo } from 'react';
import { motion } from 'framer-motion';

export interface SlotDigitProps {
  targetDigit: number;
  delay?: number;
  duration?: number;
  ease?: readonly [number, number, number, number];
  shouldReduceMotion?: boolean;
  hasEnteredView?: boolean;
  spinIfZero?: boolean;
  className?: string;
}

const NUMERALS_WITH_WRAP = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
const NUMERALS_STANDARD = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

/**
 * Editorial slot digit rolling transition.
 * Rolls smoothly from 0 to targetDigit with restrained cubic-bezier easing.
 */
export const SlotDigit = memo(function SlotDigit({
  targetDigit,
  delay = 0.22,
  duration = 0.58,
  ease = [0.22, 1, 0.36, 1],
  shouldReduceMotion = false,
  hasEnteredView = true,
  spinIfZero = false,
  className = ''
}: SlotDigitProps) {
  const safeDigit = Math.max(0, Math.min(9, Math.round(Number(targetDigit) || 0)));
  const useWrap = spinIfZero && safeDigit === 0;
  const numerals = useWrap ? NUMERALS_WITH_WRAP : NUMERALS_STANDARD;
  const targetIndex = useWrap ? 10 : safeDigit;
  const total = numerals.length;
  const targetY = `-${(targetIndex / total) * 100}%`;

  if (shouldReduceMotion) {
    return (
      <span className={`editorial-slot-digit study-continue-slot-digit ${className}`.trim()} aria-hidden="true">
        <span className="editorial-slot-column study-continue-slot-column" style={{ transform: `translateY(${targetY})` }}>
          <span className="editorial-slot-numeral study-continue-slot-numeral">
            {safeDigit}
          </span>
        </span>
      </span>
    );
  }

  return (
    <span className={`editorial-slot-digit study-continue-slot-digit ${className}`.trim()} aria-hidden="true">
      <motion.span
        className="editorial-slot-column study-continue-slot-column"
        initial={{ y: '0%' }}
        animate={hasEnteredView ? { y: targetY } : { y: '0%' }}
        transition={{
          duration,
          delay,
          ease
        }}
      >
        {numerals.map((d, idx) => (
          <span key={idx} className="editorial-slot-numeral study-continue-slot-numeral">
            {d}
          </span>
        ))}
      </motion.span>
    </span>
  );
});
