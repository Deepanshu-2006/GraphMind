import { useState, useEffect, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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

export const CircularPerformanceVisual = memo(function CircularPerformanceVisual({
  score,
  totalQuestions,
  percentage,
  questionItems,
  isExiting,
  exitTarget,
  onSelectQuestion
}: CircularPerformanceVisualProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // Animation sequence states (Section 4 & 5)
  // 01 -> correct segment activates
  // 02 -> remaining segments resolve
  // 03 -> center score settles
  // 04 -> supporting text appears
  const [animationStep, setAnimationStep] = useState<number>(0);
  const [isSettled, setIsSettled] = useState<boolean>(false);

  const safeTotal = Math.max(1, totalQuestions);

  useEffect(() => {
    // Respect prefers-reduced-motion
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setAnimationStep(4);
      setIsSettled(true);
      return;
    }

    // Sequenced editorial reveal: 500–800ms total
    // Step 1: correct segments activate (180ms)
    const t1 = setTimeout(() => {
      setAnimationStep(1);
    }, 180);

    // Step 2: remaining segments resolve (360ms)
    const t2 = setTimeout(() => {
      setAnimationStep(2);
    }, 360);

    // Step 3: center score settles (520ms)
    const t3 = setTimeout(() => {
      setAnimationStep(3);
    }, 520);

    // Step 4: supporting text appears (680ms)
    const t4 = setTimeout(() => {
      setAnimationStep(4);
      setIsSettled(true);
    }, 680);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [safeTotal, score]);

  // Geometry dimensions: spatially stable circle, no full rotation
  const viewBoxSize = 320;
  const cx = 160;
  const cy = 160;
  const radius = 112;

  // Arc calculations per segment with subtle variable length/gap treatment (Section 3)
  const segments = useMemo(() => {
    const N = safeTotal;
    const slotDeg = 360 / N;

    return questionItems.map((item, i) => {
      // Subtle variable gap treatment: alternating 4.8° and 5.8° to avoid cookie-cutter look
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

  const hoveredItem = hoveredIndex !== null ? questionItems[hoveredIndex] : null;

  const tensDigit = Math.floor(score / 10) % 10;
  const unitsDigit = score % 10;

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
      initial={{ scale: 0.94, opacity: 0 }}
      animate={
        isExiting && exitTarget === 'graph'
          ? { scale: 0.85, opacity: 0, transition: { duration: 0.28, delay: 0.12, ease: [0.16, 1, 0.3, 1] } }
          : { scale: 1, opacity: 1, transition: { duration: 0.65, ease: [0.16, 1, 0.3, 1] } }
      }
    >
      {/* Label above: • KNOWLEDGE PERFORMANCE (Section 6) */}
      <div className="circular-visual-header">
        <span className="circular-header-marker" aria-hidden="true" />
        <span className="circular-header-label">KNOWLEDGE PERFORMANCE</span>
      </div>

      {/* SVG Canvas with Segments & Center Content */}
      <div className="circular-visual-stage">
        <svg
          viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
          className={`circular-performance-svg ${isSettled ? 'settled' : ''}`}
          aria-hidden="true"
        >
          {/* Subtle background guide track */}
          <circle
            cx={cx}
            cy={cy}
            r={radius}
            fill="none"
            stroke="rgba(255, 255, 255, 0.03)"
            strokeWidth={1}
          />

          {/* Question arc segments */}
          {segments.map((seg) => {
            const isItemCorrect = seg.isCorrect;
            const isUnanswered = seg.status === 'unanswered';
            const isHovered = hoveredIndex === seg.index;
            const isSelected = selectedIndex === seg.index;

            // Step 1: correct segments activate first
            // Step 2: remaining segments resolve into inactive state
            const isVisible = isItemCorrect
              ? animationStep >= 1
              : animationStep >= 2;

            let strokeColor = 'rgba(255, 255, 255, 0.02)';
            if (isVisible) {
              if (isItemCorrect) {
                strokeColor = 'var(--accent, #A3FF12)';
              } else if (isUnanswered) {
                strokeColor = isHovered
                  ? 'rgba(255, 255, 255, 0.18)'
                  : 'rgba(255, 255, 255, 0.04)';
              } else {
                strokeColor = isHovered
                  ? 'rgba(255, 255, 255, 0.22)'
                  : 'rgba(255, 255, 255, 0.09)';
              }
            }

            // Variable stroke presence: correct segments have a confident 10px presence, inactive 8.5px
            const baseStroke = isItemCorrect ? 10 : 8.5;
            const currentStrokeWidth = isHovered || isSelected ? baseStroke + 2.5 : baseStroke;

            return (
              <path
                key={seg.questionId || seg.index}
                d={seg.pathD}
                fill="none"
                stroke={strokeColor}
                strokeWidth={currentStrokeWidth}
                strokeLinecap="round"
                className={`circular-segment-path ${
                  isItemCorrect ? 'segment-correct' : isUnanswered ? 'segment-unanswered' : 'segment-review'
                } ${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''}`}
                onMouseEnter={() => setHoveredIndex(seg.index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => {
                  setSelectedIndex(seg.index);
                  onSelectQuestion?.(seg);
                }}
                style={{
                  cursor: 'pointer',
                  opacity: isVisible ? 1 : 0.15,
                  transition: 'stroke-width 220ms ease, stroke 240ms ease, opacity 260ms ease'
                }}
              />
            );
          })}
        </svg>

        {/* Center Typography (Section 3, 4, 5) */}
        <div className="circular-center-content">
          <div className="circular-center-score-row" aria-label={`${scoreFormatted} of ${totalFormatted}`}>
            <span className="circular-center-number">
              <SlotDigit targetDigit={tensDigit} delay={0.24} duration={0.52} />
              <SlotDigit targetDigit={unitsDigit} delay={0.28} duration={0.56} />
            </span>
            <span className="circular-center-total">/{totalFormatted}</span>
          </div>

          <motion.span
            className="circular-center-percentage"
            initial={{ opacity: 0, y: 4 }}
            animate={animationStep >= 3 ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            {percentage}% CORRECT
          </motion.span>
        </div>

        {/* Contextual Interactive Tooltip */}
        <AnimatePresence>
          {hoveredItem && (
            <motion.div
              className="circular-interactive-tooltip"
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="tooltip-header-row">
                <span className="tooltip-q-num">
                  QUESTION {hoveredItem.questionNumber.toString().padStart(2, '0')}
                </span>
                <span
                  className={`tooltip-q-status ${
                    hoveredItem.isCorrect
                      ? 'status-correct'
                      : hoveredItem.status === 'unanswered'
                      ? 'status-unanswered'
                      : 'status-review'
                  }`}
                >
                  {hoveredItem.isCorrect ? 'CORRECT' : hoveredItem.status === 'unanswered' ? 'UNANSWERED' : 'REVIEW'}
                </span>
              </div>
              <div className="tooltip-concept-name" title={hoveredItem.conceptName}>
                {hoveredItem.conceptName}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Subtitle: e.g. 1 correct · 9 to revisit (Section 12) */}
      <motion.div
        className="circular-summary-footer"
        initial={{ opacity: 0 }}
        animate={animationStep >= 4 ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <span>{score} correct</span>
        <span className="summary-footer-dot" aria-hidden="true">·</span>
        <span>{reviewCount} to revisit</span>
      </motion.div>
    </motion.div>
  );
});
