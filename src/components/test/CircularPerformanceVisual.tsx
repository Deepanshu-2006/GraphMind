import { useState, useEffect, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface QuestionResultItem {
  questionNumber: number;
  questionId: string;
  isCorrect: boolean;
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

  // Animation states for knowledge assembly (Section 7 & 8)
  const [resolvedIndex, setResolvedIndex] = useState<number>(-1);
  const [scannerAngle, setScannerAngle] = useState<number>(-90);
  const [showScanner, setShowScanner] = useState<boolean>(true);
  const [isSettled, setIsSettled] = useState<boolean>(false);

  // Center score count-up
  const [displayScore, setDisplayScore] = useState<number>(0);

  const safeTotal = Math.max(1, totalQuestions);

  useEffect(() => {
    // Respect prefers-reduced-motion (Section 19)
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setResolvedIndex(safeTotal);
      setShowScanner(false);
      setIsSettled(true);
      setDisplayScore(score);
      return;
    }

    const duration = 640; // ms
    const startTime = performance.now();

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / duration);
      // Eased scan progress
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentAngle = -90 + eased * 360;
      setScannerAngle(currentAngle);

      const currentItem = Math.floor(eased * safeTotal);
      setResolvedIndex(currentItem);

      // Interpolate center score simultaneously
      setDisplayScore(Math.round(eased * score));

      if (progress < 1) {
        requestAnimationFrame(step);
      } else {
        setResolvedIndex(safeTotal);
        setDisplayScore(score);
        setShowScanner(false);
        setIsSettled(true);
      }
    };

    const frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [safeTotal, score]);

  // Geometry dimensions
  const viewBoxSize = 320;
  const cx = 160;
  const cy = 160;
  const radius = 112;
  const strokeWidth = 10;

  // Arc calculations per segment
  const segments = useMemo(() => {
    const N = safeTotal;
    const slotDeg = 360 / N;
    // Restrained gap between 4 and 7 degrees
    const gapDeg = N <= 4 ? 7 : N <= 8 ? 6 : N <= 16 ? 5 : 4;
    const spanDeg = Math.max(2, slotDeg - gapDeg);

    return questionItems.map((item, i) => {
      const startAngle = -90 + i * slotDeg + gapDeg / 2;
      const endAngle = startAngle + spanDeg;
      const pathD = describeArc(cx, cy, radius, startAngle, endAngle);
      return {
        ...item,
        index: i,
        pathD,
        startAngle,
        endAngle
      };
    });
  }, [safeTotal, questionItems, cx, cy, radius]);

  // Scanning marker position
  const scannerCoord = useMemo(() => {
    return polarToCartesian(cx, cy, radius, scannerAngle);
  }, [cx, cy, radius, scannerAngle]);

  const reviewCount = Math.max(0, safeTotal - score);
  const scoreFormatted = displayScore.toString().padStart(2, '0');
  const totalFormatted = safeTotal.toString().padStart(2, '0');

  const hoveredItem = hoveredIndex !== null ? questionItems[hoveredIndex] : null;

  return (
    <div
      className={`circular-performance-container ${
        isExiting && exitTarget === 'missed'
          ? 'exiting-missed'
          : isExiting && exitTarget === 'graph'
          ? 'exiting-graph'
          : ''
      }`}
      role="region"
      aria-label="Knowledge Performance Circular Visualization"
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

          {/* 10 distinct arc segments */}
          {segments.map((seg) => {
            const isResolved = seg.index < resolvedIndex;
            const isItemCorrect = seg.isCorrect;
            const isHovered = hoveredIndex === seg.index;
            const isSelected = selectedIndex === seg.index;

            // Stroke color determined strictly by state (Section 4)
            let strokeColor = 'rgba(255, 255, 255, 0.08)';
            if (isResolved) {
              if (isItemCorrect) {
                strokeColor = 'var(--accent, #A3FF12)';
              } else {
                strokeColor = isHovered
                  ? 'rgba(255, 255, 255, 0.24)'
                  : 'rgba(255, 255, 255, 0.09)';
              }
            }

            const currentStrokeWidth = isHovered || isSelected ? strokeWidth + 3 : strokeWidth;

            return (
              <path
                key={seg.questionId || seg.index}
                d={seg.pathD}
                fill="none"
                stroke={strokeColor}
                strokeWidth={currentStrokeWidth}
                strokeLinecap="round"
                className={`circular-segment-path ${
                  isItemCorrect ? 'segment-correct' : 'segment-review'
                } ${isHovered ? 'hovered' : ''} ${isSelected ? 'selected' : ''}`}
                onMouseEnter={() => setHoveredIndex(seg.index)}
                onMouseLeave={() => setHoveredIndex(null)}
                onClick={() => {
                  setSelectedIndex(seg.index);
                  onSelectQuestion?.(seg);
                }}
                style={{
                  cursor: 'pointer',
                  transition: 'stroke-width 220ms ease, stroke 220ms ease, opacity 220ms ease'
                }}
              />
            );
          })}

          {/* Creative Motion Detail: Tiny scanning marker during assembly (Section 8) */}
          {showScanner && (
            <circle
              cx={scannerCoord.x}
              cy={scannerCoord.y}
              r={3.5}
              fill="var(--accent, #A3FF12)"
              className="circular-scanner-dot"
            />
          )}
        </svg>

        {/* Center Typography (Section 5) */}
        <div className="circular-center-content">
          <div className="circular-center-score-row">
            <span className="circular-center-number">{scoreFormatted}</span>
            <span className="circular-center-total">/{totalFormatted}</span>
          </div>
          <span className="circular-center-percentage">{percentage}% correct</span>
        </div>

        {/* Contextual Interactive Tooltip (Section 10 & 11) */}
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
                    hoveredItem.isCorrect ? 'status-correct' : 'status-review'
                  }`}
                >
                  {hoveredItem.isCorrect ? 'CORRECT' : 'REVIEW'}
                </span>
              </div>
              <div className="tooltip-concept-name" title={hoveredItem.conceptName}>
                {hoveredItem.conceptName}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Subtitle: 4 correct · 6 to revisit (Section 12) */}
      <div className="circular-summary-footer">
        <span>{score} correct</span>
        <span className="summary-footer-dot" aria-hidden="true">·</span>
        <span>{reviewCount} to revisit</span>
      </div>
    </div>
  );
});
