import { useState, useEffect, useMemo, memo } from 'react';
import { motion } from 'framer-motion';

export interface QuestionResultItem {
  questionNumber: number;
  questionId: string;
  isCorrect: boolean;
  status?: 'correct' | 'incorrect' | 'unanswered';
  conceptName: string;
  questionText?: string;
}

export interface CircularPerformanceVisualProps {
  score: number;
  totalQuestions: number;
  percentage: number;
  timeFormatted?: string;
  questionItems: QuestionResultItem[];
  isExiting: boolean;
  exitTarget: 'missed' | 'graph' | null;
  onSelectQuestion?: (questionItem: QuestionResultItem) => void;
}

function polarToCartesian(cx: number, cy: number, r: number, angleInDegrees: number) {
  const rad = (angleInDegrees * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad)
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y}`;
}

/**
 * Editorial slot digit rolling transition
 * Rolls smoothly from 0 to targetDigit with restrained cubic-bezier easing
 */
function SlotDigit({
  targetDigit,
  delay = 0.22,
  duration = 0.58
}: {
  targetDigit: number;
  delay?: number;
  duration?: number;
}) {
  return (
    <span className="editorial-slot-digit" aria-hidden="true">
      <motion.span
        className="editorial-slot-column"
        initial={{ y: '0%' }}
        animate={{ y: `-${targetDigit * 10}%` }}
        transition={{
          duration,
          delay,
          ease: [0.16, 1, 0.3, 1]
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <span key={d} className="editorial-slot-numeral">
            {d}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

/**
 * Isolated Percentage Counter to avoid re-rendering SVG during animation
 */
const PercentageCounter = memo(function PercentageCounter({
  target,
  delay = 420,
  duration = 580
}: {
  target: number;
  delay?: number;
  duration?: number;
}) {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setCount(target);
      return;
    }

    let animId: number;
    const startTime = Date.now() + delay;

    const tick = () => {
      const now = Date.now();
      if (now < startTime) {
        animId = requestAnimationFrame(tick);
        return;
      }
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(eased * target));

      if (progress < 1) {
        animId = requestAnimationFrame(tick);
      }
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [target, delay, duration]);

  return <>{count}% CORRECT</>;
});

export const CircularPerformanceVisual = memo(function CircularPerformanceVisual({
  score,
  totalQuestions,
  percentage,
  timeFormatted,
  questionItems,
  isExiting,
  exitTarget,
  onSelectQuestion
}: CircularPerformanceVisualProps) {
  // Synchronous detection of reduced motion (zero re-renders)
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const safeTotal = Math.max(1, totalQuestions);

  // Geometry dimensions: spatially stable circle
  const viewBoxSize = 320;
  const cx = 160;
  const cy = 160;
  const radius = 112;

  // Arc calculations per segment with subtle variable length/gap treatment
  const segments = useMemo(() => {
    const N = safeTotal;
    const slotDeg = 360 / N;

    return questionItems.map((item, i) => {
      const gapDeg = i % 2 === 0 ? 5.6 : 4.6;
      const spanDeg = Math.max(2, slotDeg - gapDeg);
      const startAngle = -90 + i * slotDeg + gapDeg / 2;
      const endAngle = startAngle + spanDeg;
      const pathD = describeArc(cx, cy, radius, startAngle, endAngle);

      return {
        ...item,
        index: i,
        pathD,
        startAngle,
        endAngle,
        gapDeg,
        spanDeg
      };
    });
  }, [safeTotal, questionItems, cx, cy, radius]);

  const reviewCount = Math.max(0, safeTotal - score);
  const totalFormatted = safeTotal.toString().padStart(2, '0');
  const scoreFormatted = score.toString().padStart(2, '0');

  const tensDigit = Math.floor(score / 10) % 10;
  const unitsDigit = score % 10;

  // Energy Point Geometry (Section 7)
  // Calculates exact angle start and target on the circumference
  const energyPointData = useMemo(() => {
    if (score <= 0 || segments.length === 0) return null;
    const firstSeg = segments[0];
    const lastAchievedIndex = Math.min(score, segments.length) - 1;
    const lastSeg = segments[lastAchievedIndex];

    const startRotate = firstSeg.startAngle + 90;
    const targetRotate = lastSeg.endAngle + 90;
    const duration = Math.min(
      0.82,
      Math.max(0.48, 0.36 + (score / safeTotal) * 0.44)
    );

    return {
      startRotate,
      targetRotate,
      duration
    };
  }, [score, segments, safeTotal]);

  return (
    <motion.div
      className={`circular-performance-container ${
        isExiting && exitTarget === 'missed'
          ? 'exiting-missed'
          : isExiting && exitTarget === 'graph'
          ? 'exiting-graph'
          : ''
      }`}
      role="region"
      aria-label="Knowledge Performance Circular Visualization"
      initial={false}
      animate={
        isExiting && exitTarget === 'missed'
          ? { scale: 0.86, opacity: 0, transition: { duration: 0.36, delay: 0.24, ease: [0.16, 1, 0.3, 1] } }
          : isExiting && exitTarget === 'graph'
          ? { scale: 0.85, opacity: 0, transition: { duration: 0.28, delay: 0.12, ease: [0.16, 1, 0.3, 1] } }
          : { scale: 1, opacity: 1 }
      }
    >
      {/* Label above: • KNOWLEDGE PERFORMANCE (Section 1) */}
      <div className="circular-visual-header">
        <span className="circular-header-marker" aria-hidden="true" />
        <span className="circular-header-label">KNOWLEDGE PERFORMANCE</span>
      </div>

      {/* SVG Canvas with Segments & Center Content */}
      <div className="circular-visual-stage">
        <svg
          viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
          className="circular-performance-svg"
          aria-hidden="true"
        >
          {/* Subtle background guide track */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.04)"
            strokeWidth={1}
          />

          {/* Micro-motion Group: Ring "Wakes Up" (Section 3) */}
          {/* Controlled 10-degree rotational movement once upon entry, then stops completely */}
          <motion.g
            className="circular-ring-wake-group"
            initial={prefersReducedMotion ? { rotate: 0 } : { rotate: -10 }}
            animate={{ rotate: 0 }}
            transition={{
              duration: 0.35,
              ease: [0.16, 1, 0.3, 1]
            }}
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          >
            {/* STEP 1: Resting Track — Entire circular track is visible initially in dormant dark graphite (Section 2) */}
            {segments.map((seg) => {
              const isUnanswered = seg.status === 'unanswered';
              return (
                <path
                  key={`track-${seg.questionId || seg.index}`}
                  d={seg.pathD}
                  fill="none"
                  stroke={
                    isUnanswered
                      ? 'rgba(255, 255, 255, 0.04)'
                      : 'rgba(255, 255, 255, 0.08)'
                  }
                  strokeWidth={8.5}
                  strokeLinecap="round"
                  className="circular-segment-track"
                />
              );
            })}

            {/* STEP 2: Green Performance Segments "Lock In" sequentially with angular motion (Section 4 & 5) */}
            {segments.map((seg) => {
              if (!seg.isCorrect) return null;

              // Sequential angular delay per achieved segment
              const correctTotal = Math.max(1, score);
              const segmentDelay = prefersReducedMotion
                ? 0
                : 0.32 + (seg.index / correctTotal) * 0.44;

              return (
                <motion.path
                  key={`achieved-${seg.questionId || seg.index}`}
                  d={seg.pathD}
                  fill="none"
                  stroke="var(--accent, #B8FF3D)"
                  strokeWidth={10}
                  strokeLinecap="round"
                  className="circular-segment-achieved"
                  initial={
                    prefersReducedMotion
                      ? { pathLength: 1, rotate: 0, opacity: 1 }
                      : { pathLength: 0, rotate: -8, opacity: 0 }
                  }
                  animate={{
                    pathLength: 1,
                    rotate: [-8, 1.2, 0],
                    opacity: 1
                  }}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : {
                          pathLength: {
                            duration: 0.34,
                            delay: segmentDelay,
                            ease: [0.16, 1, 0.3, 1]
                          },
                          rotate: {
                            duration: 0.46,
                            delay: segmentDelay,
                            times: [0, 0.74, 1],
                            ease: [0.16, 1, 0.3, 1]
                          },
                          opacity: {
                            duration: 0.16,
                            delay: segmentDelay
                          }
                        }
                  }
                  onClick={() => onSelectQuestion?.(seg)}
                  style={{
                    cursor: 'pointer',
                    transformOrigin: `${cx}px ${cy}px`,
                    transition: 'stroke 200ms ease'
                  }}
                />
              );
            })}

            {/* STEP 3: Traveling Energy Point at leading edge of animating arc (Section 7) */}
            {energyPointData && !prefersReducedMotion && (
              <motion.g
                className="circular-energy-point-group"
                initial={{
                  rotate: energyPointData.startRotate,
                  opacity: 0
                }}
                animate={{
                  rotate: [
                    energyPointData.startRotate,
                    energyPointData.targetRotate + 1.2,
                    energyPointData.targetRotate
                  ],
                  opacity: [0, 1, 1, 0]
                }}
                transition={{
                  duration: energyPointData.duration,
                  delay: 0.30,
                  times: [0, 0.82, 1],
                  opacity: {
                    duration: energyPointData.duration + 0.05,
                    delay: 0.30,
                    times: [0, 0.08, 0.82, 1]
                  },
                  ease: [0.16, 1, 0.3, 1]
                }}
                style={{ transformOrigin: `${cx}px ${cy}px` }}
              >
                {/* 2.2px tiny green measurement tracer */}
                <circle
                  cx={cx}
                  cy={cy - radius}
                  r={2.2}
                  fill="#B8FF3D"
                  className="circular-energy-dot"
                />
              </motion.g>
            )}
          </motion.g>
        </svg>

        {/* Center Typography (Section 1 & 8) */}
        {/* Synchronized: Number counts up as ring measures, confirms the score */}
        <motion.div
          className="circular-center-content"
          animate={
            isExiting && exitTarget === 'missed'
              ? { scale: 0.90, opacity: 0, transition: { duration: 0.24, delay: 0.06, ease: [0.16, 1, 0.3, 1] } }
              : { scale: 1, opacity: 1 }
          }
        >
          <div className="circular-center-score-row" aria-label={`${scoreFormatted} of ${totalFormatted}`}>
            <span className="circular-center-number">
              <SlotDigit targetDigit={tensDigit} delay={0.42} duration={0.68} />
              <SlotDigit targetDigit={unitsDigit} delay={0.46} duration={0.72} />
            </span>
            <span className="circular-center-total">/{totalFormatted}</span>
          </div>

          <motion.span
            className="circular-center-percentage"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.42, ease: [0.16, 1, 0.3, 1] }}
          >
            <PercentageCounter target={percentage} delay={420} duration={580} />
          </motion.span>
        </motion.div>
      </div>

      {/* Footer Subtitle: e.g. 2 correct · 8 to revisit + quiet 00:53 elapsed (Section 1 & 8) */}
      <motion.div
        className="circular-summary-footer"
        initial={{ opacity: 0, y: 6 }}
        animate={
          isExiting
            ? { opacity: 0, y: -6, transition: { duration: 0.20, delay: 0.04, ease: [0.16, 1, 0.3, 1] } }
            : { opacity: 1, y: 0, transition: { duration: 0.35, delay: 0.98, ease: [0.16, 1, 0.3, 1] } }
        }
      >
        <div className="circular-summary-counts">
          <span>{score} correct</span>
          <span className="summary-footer-dot" aria-hidden="true">·</span>
          <span>{reviewCount} to revisit</span>
        </div>
        {timeFormatted && (
          <div className="circular-summary-elapsed">
            <span>{timeFormatted} elapsed</span>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
});
