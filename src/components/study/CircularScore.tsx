import { motion } from 'framer-motion';

export interface CircularScoreProps {
  score: number;
  displayedScore?: number;
  hasEnteredView?: boolean;
  shouldReduceMotion?: boolean;
  size?: number;
  radius?: number;
  strokeWidth?: number;
  label?: string;
  className?: string;
}

export const CIRCLE_RADIUS = 82;
export const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;
export const REVEAL_EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Calculates the exact Cartesian endpoint (x, y) along the circular arc
 * starting from 12 o'clock (-90 deg) and progressing clockwise.
 */
export function getArcEndpoint(score: number, radius = CIRCLE_RADIUS, cx = 100, cy = 100) {
  const clamped = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const angle = -Math.PI / 2 + (clamped / 100) * 2 * Math.PI;
  return {
    x: Number((cx + radius * Math.cos(angle)).toFixed(2)),
    y: Number((cy + radius * Math.sin(angle)).toFixed(2)),
    angle
  };
}

/**
 * Reusable, mathematically precise circular score visualization using SVG.
 * Features a thin, muted track, a lime-green progress arc, and centered tabular numerals.
 * Handles 0%, partial, and 100% scores with proper stroke caps and opacity.
 */
export function CircularScore({
  score,
  displayedScore,
  hasEnteredView = true,
  shouldReduceMotion = false,
  size = 320,
  radius = CIRCLE_RADIUS,
  label = 'SCORE',
  className = ''
}: CircularScoreProps) {
  const clampedScore = Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const currentNum = displayedScore !== undefined ? displayedScore : clampedScore;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference * (1 - clampedScore / 100);

  const endpoint = getArcEndpoint(currentNum, radius, 100, 100);

  return (
    <div className={`study-continue-circle-wrap ${className}`.trim()}>
      <svg 
        className="study-continue-circle-svg" 
        width={size} 
        height={size} 
        viewBox="0 0 200 200" 
        role="progressbar" 
        aria-valuenow={clampedScore} 
        aria-valuemin={0} 
        aria-valuemax={100} 
        aria-label={`Assessment score: ${clampedScore}%`}
      >
        <circle 
          cx="100" 
          cy="100" 
          r={radius} 
          className="study-continue-circle-track" 
        />
        <motion.circle 
          cx="100" 
          cy="100" 
          r={radius} 
          className="study-continue-circle-arc"
          transform="rotate(-90 100 100)"
          strokeDasharray={circumference}
          strokeLinecap={clampedScore === 0 ? 'butt' : 'round'}
          initial={shouldReduceMotion ? false : { strokeDashoffset: circumference, opacity: 0 }}
          animate={hasEnteredView ? {
            strokeDashoffset: strokeOffset,
            opacity: clampedScore === 0 ? 0 : 1
          } : { strokeDashoffset: circumference, opacity: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 1.2, delay: 0.32, ease: REVEAL_EASE }}
        />
        {currentNum > 0 && clampedScore > 0 && (
          <circle 
            cx={endpoint.x} 
            cy={endpoint.y} 
            r="3.2" 
            className="study-continue-circle-endpoint" 
          />
        )}
      </svg>
      <div className="study-continue-circle-content" aria-hidden="true">
        <span className="study-continue-score-pct">{currentNum}%</span>
        <span className="study-continue-circle-lbl">{label}</span>
      </div>
    </div>
  );
}
