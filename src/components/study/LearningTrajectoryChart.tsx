import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { ChronologicalScorePoint } from './StudySpaceView';

const REVEAL_EASE = [0.16, 1, 0.3, 1] as const;

export interface TrajectoryPointCoord {
  x: number;
  y: number;
  pt: ChronologicalScorePoint;
  index: number;
}

export interface TrajectoryGeometry {
  coords: TrajectoryPointCoord[];
  pathD: string;
  X_MIN: number;
  X_MAX: number;
  Y_MIN: number;
  Y_MID: number;
  Y_MAX: number;
  plotWidth: number;
}

export function calculateTrajectoryGeometry(
  attempts: ChronologicalScorePoint[],
  width = 740
): TrajectoryGeometry {
  const X_MIN = 44;
  const X_MAX = width - 40; // 700
  const Y_MIN = 22; // 100% score
  const Y_MAX = 98; // 0% score
  const Y_MID = 60; // 50% score
  const H = Y_MAX - Y_MIN; // 76

  function getY(score: number): number {
    const clamped = Math.max(0, Math.min(100, Number(score) || 0));
    return Y_MAX - (clamped / 100) * H;
  }

  const N = attempts.length;
  if (N === 0) {
    return { coords: [], pathD: '', X_MIN, X_MAX, Y_MIN, Y_MID, Y_MAX, plotWidth: X_MAX - X_MIN };
  }

  if (N === 1) {
    const x = 74;
    const y = getY(attempts[0].scorePercentage);
    return {
      coords: [{ x, y, pt: attempts[0], index: 0 }],
      pathD: '',
      X_MIN,
      X_MAX,
      Y_MIN,
      Y_MID,
      Y_MAX,
      plotWidth: X_MAX - X_MIN
    };
  }

  const availableWidth = X_MAX - X_MIN;
  const step = Math.min(160, availableWidth / (N - 1));
  const coords = attempts.map((pt, i) => {
    const x = X_MIN + i * step;
    const y = getY(pt.scorePercentage);
    return {
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      pt,
      index: i
    };
  });

  const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');

  return {
    coords,
    pathD,
    X_MIN,
    X_MAX,
    Y_MIN,
    Y_MID,
    Y_MAX,
    plotWidth: X_MAX - X_MIN
  };
}

export interface LearningTrajectoryChartProps {
  attempts: ChronologicalScorePoint[];
  graphName: string;
  activeAttemptId: string | null;
  hoveredAttemptId: string | null;
  onHoverAttempt: (attemptId: string | null) => void;
  onSelectAttempt: (attemptId: string) => void;
  inView: boolean;
  shouldReduceMotion: boolean;
}

export function LearningTrajectoryChart({
  attempts,
  graphName,
  activeAttemptId,
  hoveredAttemptId,
  onHoverAttempt,
  onSelectAttempt,
  inView,
  shouldReduceMotion
}: LearningTrajectoryChartProps) {
  const { coords, pathD, X_MIN, X_MAX, Y_MIN, Y_MID, Y_MAX } = useMemo(() => {
    return calculateTrajectoryGeometry(attempts, 740);
  }, [attempts]);

  const [isPathSettled, setIsPathSettled] = useState(Boolean(shouldReduceMotion));

  const totalPoints = coords.length;
  const isSingle = totalPoints === 1;

  return (
    <div className="study-trajectory-chart-shell">
      <svg
        viewBox="0 0 740 120"
        className="study-trajectory-svg"
        preserveAspectRatio="none"
        aria-label={`Score trajectory chart for ${graphName}`}
      >
        {/* Architectural Baseline Reference Grid */}
        {/* 100% Guideline */}
        <line
          x1={X_MIN}
          y1={Y_MIN}
          x2={X_MAX}
          y2={Y_MIN}
          className="study-trajectory-grid-line line-100"
          stroke="rgba(255, 255, 255, 0.05)"
          strokeDasharray="2 3"
        />
        <text
          x={X_MIN - 8}
          y={Y_MIN + 3}
          textAnchor="end"
          className="study-trajectory-axis-lbl"
          fill="#555555"
          fontSize="9"
          fontFamily="var(--font-mono, monospace)"
        >
          100%
        </text>

        {/* 50% Guideline */}
        <line
          x1={X_MIN}
          y1={Y_MID}
          x2={X_MAX}
          y2={Y_MID}
          className="study-trajectory-grid-line line-50"
          stroke="rgba(255, 255, 255, 0.035)"
          strokeDasharray="2 3"
        />
        <text
          x={X_MIN - 8}
          y={Y_MID + 3}
          textAnchor="end"
          className="study-trajectory-axis-lbl"
          fill="#444444"
          fontSize="9"
          fontFamily="var(--font-mono, monospace)"
        >
          50%
        </text>

        {/* 0% Baseline Guideline */}
        <line
          x1={X_MIN}
          y1={Y_MAX}
          x2={X_MAX}
          y2={Y_MAX}
          className="study-trajectory-grid-line line-0"
          stroke="rgba(255, 255, 255, 0.05)"
          strokeDasharray="2 3"
        />
        <text
          x={X_MIN - 8}
          y={Y_MAX + 3}
          textAnchor="end"
          className="study-trajectory-axis-lbl"
          fill="#555555"
          fontSize="9"
          fontFamily="var(--font-mono, monospace)"
        >
          0%
        </text>

        {/* Trajectory Drawing Line (Phase 3 Motion Animation) */}
        {!isSingle && pathD && (
          <motion.path
            d={pathD}
            fill="none"
            className="study-trajectory-line"
            stroke="var(--accent, #A3FF12)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={isPathSettled ? { strokeDasharray: 'none' } : undefined}
            initial={shouldReduceMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
            animate={inView ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.95, delay: 0.22, ease: REVEAL_EASE }}
            onAnimationComplete={() => setIsPathSettled(true)}
          />
        )}

        {/* Interactive Data Points */}
        {coords.map((c, idx) => {
          const isSelected = activeAttemptId === c.pt.attemptId;
          const isHovered = hoveredAttemptId === c.pt.attemptId;
          const isLatest = idx === totalPoints - 1;
          const isHighlighted = isSelected || isHovered;

          // Always show score label for small attempt sets, otherwise first, latest, and active/hovered
          const showLabel = totalPoints <= 6 || idx === 0 || isLatest || isHighlighted;

          return (
            <motion.g
              key={c.pt.attemptId}
              className={`study-trajectory-node ${isHighlighted ? 'active' : ''}`}
              tabIndex={0}
              role="button"
              aria-label={`Attempt ${c.index + 1}: ${c.pt.scorePercentage}% on ${c.pt.dateStr}`}
              onClick={() => onSelectAttempt(c.pt.attemptId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectAttempt(c.pt.attemptId);
                }
              }}
              onMouseEnter={() => onHoverAttempt(c.pt.attemptId)}
              onMouseLeave={() => onHoverAttempt(null)}
              onFocus={() => onHoverAttempt(c.pt.attemptId)}
              onBlur={() => onHoverAttempt(null)}
              initial={shouldReduceMotion ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
              animate={inView ? { scale: 1, opacity: 1 } : { scale: 0, opacity: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.35, delay: 0.28 + idx * 0.045, ease: REVEAL_EASE }}
            >
              {/* Subtle hover pulse / focus ring */}
              {isHighlighted && (
                <circle
                  cx={c.x}
                  cy={c.y}
                  r="9"
                  fill="none"
                  stroke="var(--accent, #A3FF12)"
                  strokeWidth="1"
                  strokeOpacity="0.3"
                />
              )}

              {/* Point Node */}
              <circle
                cx={c.x}
                cy={c.y}
                r={isHighlighted ? 5.5 : isLatest ? 4.5 : 3.5}
                fill={isHighlighted ? 'var(--accent, #A3FF12)' : '#0A0A0A'}
                stroke={isHighlighted ? '#FFFFFF' : 'var(--accent, #A3FF12)'}
                strokeWidth={isHighlighted ? 2 : 1.75}
                className="study-trajectory-point"
              />

              {/* Score Value Label */}
              {showLabel && (
                <text
                  x={c.x}
                  y={c.y < 30 ? c.y + 14 : c.y - 8}
                  textAnchor="middle"
                  className={`study-trajectory-point-lbl ${isHighlighted ? 'highlight' : ''}`}
                  fill={isHighlighted ? '#FFFFFF' : isLatest ? 'var(--text-primary, #F5F5F5)' : '#8A8A8A'}
                  fontSize={isHighlighted ? '10.5' : '9.5'}
                  fontWeight={isHighlighted ? '600' : '500'}
                  fontFamily="var(--font-mono, monospace)"
                >
                  {c.pt.scorePercentage}%
                </text>
              )}
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}
