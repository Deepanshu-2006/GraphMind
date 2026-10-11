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
  width = 760
): TrajectoryGeometry {
  const X_MIN = 44;
  const X_MAX = width - 40; // 720
  const Y_MIN = 28; // 100% score
  const Y_MAX = 148; // 0% score
  const Y_MID = 88; // 50% score
  const H = Y_MAX - Y_MIN; // 120

  function getY(score: number): number {
    const clamped = Math.max(0, Math.min(100, Number(score) || 0));
    return Y_MAX - (clamped / 100) * H;
  }

  const N = attempts.length;
  if (N === 0) {
    return { coords: [], pathD: '', X_MIN, X_MAX, Y_MIN, Y_MID, Y_MAX, plotWidth: X_MAX - X_MIN };
  }

  if (N === 1) {
    const x = 76;
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
  const step = Math.min(180, availableWidth / (N - 1));
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
    return calculateTrajectoryGeometry(attempts, 760);
  }, [attempts]);

  const LINE_DELAY = 0.28;
  const LINE_DURATION = 1.15;

  const { pointArrivalDelays } = useMemo(() => {
    if (coords.length <= 1) {
      return { totalPathLength: 0, pointArrivalDelays: [LINE_DELAY] };
    }

    const dists: number[] = [0];
    let totalLen = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      const dx = coords[i + 1].x - coords[i].x;
      const dy = coords[i + 1].y - coords[i].y;
      const d = Math.hypot(dx, dy);
      totalLen += d;
      dists.push(totalLen);
    }

    const delays = dists.map(dist => {
      const progressFrac = totalLen > 0 ? dist / totalLen : 0;
      const timeFrac = progressFrac <= 0
        ? 0
        : progressFrac >= 1
          ? 1
          : 1 - Math.pow(1 - progressFrac, 1 / 3);
      return Math.round((LINE_DELAY + timeFrac * LINE_DURATION) * 1000) / 1000;
    });

    return { totalPathLength: Math.round(totalLen * 10) / 10, pointArrivalDelays: delays };
  }, [coords]);

  const [isPathSettled, setIsPathSettled] = useState(Boolean(shouldReduceMotion));

  const totalPoints = coords.length;
  const isSingle = totalPoints === 1;

  // Deterministic collision avoidance for score labels
  const visibleLabels = useMemo(() => {
    const visible = new Set<string>();
    if (totalPoints === 0) return visible;

    if (activeAttemptId) visible.add(activeAttemptId);
    if (hoveredAttemptId) visible.add(hoveredAttemptId);

    const latest = coords[totalPoints - 1];
    if (latest) visible.add(latest.pt.attemptId);

    if (totalPoints <= 6) {
      coords.forEach(c => visible.add(c.pt.attemptId));
      return visible;
    }

    const first = coords[0];
    if (first) visible.add(first.pt.attemptId);

    const MIN_DIST = 52;
    const placedX: number[] = [];
    coords.forEach(c => {
      if (visible.has(c.pt.attemptId)) placedX.push(c.x);
    });

    coords.forEach(c => {
      if (visible.has(c.pt.attemptId)) return;
      const isColliding = placedX.some(px => Math.abs(px - c.x) < MIN_DIST);
      if (!isColliding) {
        visible.add(c.pt.attemptId);
        placedX.push(c.x);
      }
    });

    return visible;
  }, [coords, totalPoints, activeAttemptId, hoveredAttemptId]);

  const activeCoord = useMemo(() => {
    const targetId = hoveredAttemptId || activeAttemptId;
    return targetId ? coords.find(c => c.pt.attemptId === targetId) : null;
  }, [coords, hoveredAttemptId, activeAttemptId]);

  return (
    <div className="study-trajectory-chart-shell">
      <svg
        viewBox="0 0 760 180"
        className="study-trajectory-svg"
        preserveAspectRatio="none"
        aria-label={`Score trajectory chart for ${graphName}`}
      >
        {/* PHASE 2 — Reference grid lines at 100%, 50%, 0% */}
        <motion.g
          className="study-trajectory-reference-grid"
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={inView ? { opacity: 1 } : { opacity: 0 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.35, delay: 0.12, ease: REVEAL_EASE }}
        >
          <line
            x1={X_MIN}
            y1={Y_MIN}
            x2={X_MAX}
            y2={Y_MIN}
            className="study-trajectory-grid-line line-100"
            stroke="rgba(255, 255, 255, 0.035)"
            strokeWidth="1"
          />
          <text
            x={X_MIN - 10}
            y={Y_MIN + 3}
            textAnchor="end"
            className="study-trajectory-axis-lbl"
            fill="#555555"
            fontSize="9"
            fontFamily="var(--font-mono, monospace)"
          >
            100%
          </text>

          <line
            x1={X_MIN}
            y1={Y_MID}
            x2={X_MAX}
            y2={Y_MID}
            className="study-trajectory-grid-line line-50"
            stroke="rgba(255, 255, 255, 0.025)"
            strokeWidth="1"
          />
          <text
            x={X_MIN - 10}
            y={Y_MID + 3}
            textAnchor="end"
            className="study-trajectory-axis-lbl"
            fill="#444444"
            fontSize="9"
            fontFamily="var(--font-mono, monospace)"
          >
            50%
          </text>

          <line
            x1={X_MIN}
            y1={Y_MAX}
            x2={X_MAX}
            y2={Y_MAX}
            className="study-trajectory-grid-line line-0"
            stroke="rgba(255, 255, 255, 0.07)"
            strokeWidth="1.25"
          />
          <text
            x={X_MIN - 10}
            y={Y_MAX + 3}
            textAnchor="end"
            className="study-trajectory-axis-lbl"
            fill="#555555"
            fontSize="9"
            fontFamily="var(--font-mono, monospace)"
          >
            0%
          </text>
        </motion.g>

        {/* PHASE 3 — Trajectory Drawing Line */}
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
            transition={shouldReduceMotion ? { duration: 0 } : {
              pathLength: { duration: LINE_DURATION, delay: LINE_DELAY, ease: REVEAL_EASE },
              opacity: { duration: 0.2, delay: LINE_DELAY }
            }}
            onAnimationComplete={() => setIsPathSettled(true)}
          />
        )}

        {/* PHASE 4 & 5 — Interactive Data Points and Score Labels */}
        {coords.map((c, idx) => {
          const isSelected = activeAttemptId === c.pt.attemptId;
          const isHovered = hoveredAttemptId === c.pt.attemptId;
          const isLatest = idx === totalPoints - 1;
          const isHighlighted = isSelected || isHovered;
          const showLabel = visibleLabels.has(c.pt.attemptId);
          const arrivalDelay = pointArrivalDelays[idx] ?? (LINE_DELAY + idx * 0.1);
          const labelDelay = arrivalDelay + 0.08;

          return (
            <motion.g
              key={c.pt.attemptId}
              className={`study-trajectory-node ${isHighlighted ? 'active' : ''} ${isLatest ? 'latest' : ''}`}
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
              initial={shouldReduceMotion ? false : { scale: 0.4, opacity: 0 }}
              animate={inView ? { scale: 1, opacity: 1 } : { scale: 0.4, opacity: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, delay: arrivalDelay, ease: REVEAL_EASE }}
            >
              {/* Subtle hover pulse / focus ring */}
              {isHighlighted && (
                <circle
                  cx={c.x}
                  cy={c.y}
                  r="10"
                  fill="none"
                  stroke="var(--accent, #A3FF12)"
                  strokeWidth="1"
                  strokeOpacity="0.3"
                />
              )}

              {/* Point Node Marker */}
              <circle
                cx={c.x}
                cy={c.y}
                r={isHighlighted ? 5.5 : isLatest ? 4.5 : 3.5}
                fill={isHighlighted ? 'var(--accent, #A3FF12)' : '#0A0A0A'}
                stroke={isHighlighted ? '#FFFFFF' : isLatest ? 'var(--accent, #A3FF12)' : 'rgba(163, 255, 18, 0.45)'}
                strokeWidth={isHighlighted ? 2 : isLatest ? 1.75 : 1.25}
                className="study-trajectory-point"
              />

              {/* Score Value Label */}
              {showLabel && (
                <motion.text
                  x={c.x}
                  y={c.y < 42 ? c.y + 14 : c.y - 9}
                  textAnchor={c.x < X_MIN + 20 ? 'start' : c.x > X_MAX - 20 ? 'end' : 'middle'}
                  className={`study-trajectory-point-lbl ${isHighlighted ? 'highlight' : ''}`}
                  fill={isHighlighted ? '#FFFFFF' : isLatest ? 'var(--text-primary, #F5F5F5)' : '#7A7A7A'}
                  fontSize={isHighlighted ? '10.5' : isLatest ? '9.5' : '9'}
                  fontWeight={isHighlighted ? '600' : '500'}
                  fontFamily="var(--font-mono, monospace)"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: c.y < 42 ? -3 : 3 }}
                  animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: c.y < 42 ? -3 : 3 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.25, delay: labelDelay, ease: REVEAL_EASE }}
                >
                  {c.pt.scorePercentage}%
                </motion.text>
              )}
            </motion.g>
          );
        })}
      </svg>

      {/* Unclipped HTML Tooltip */}
      {activeCoord && (
        <div
          className="study-trajectory-tooltip"
          role="tooltip"
          style={{
            left: `${(activeCoord.x / 760) * 100}%`,
            top: `${(activeCoord.y / 180) * 100}%`,
            transform: activeCoord.y < 50 ? 'translate(-50%, 14px)' : 'translate(-50%, -100%)',
            marginTop: activeCoord.y < 50 ? 0 : -10
          }}
        >
          <div className="study-trajectory-tooltip-row">
            <span className="study-trajectory-tooltip-num">{activeCoord.pt.attemptNumber}</span>
            <span className="study-trajectory-tooltip-score">{activeCoord.pt.scorePercentage}%</span>
          </div>
          {activeCoord.pt.dateStr && (
            <div className="study-trajectory-tooltip-date">{activeCoord.pt.dateStr}</div>
          )}
        </div>
      )}
    </div>
  );
}
