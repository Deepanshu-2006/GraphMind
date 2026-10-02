import React, { useRef, useState, useCallback, useMemo } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

/* ==========================================================================
   Procedural Architectural SVG Wordmark (Vertical Lines Only)
   Inspired by the Arena elevation drawing principle.
   NO <text> elements, NO font clipping, NO gradient textures.
   The lines ARE the typography.
   ========================================================================== */

const SVG_W = 1400;
const SVG_H = 280;
const BASELINE_Y = 260; // Bottom baseline for vertical strokes
const TOP_Y = 20;       // Cap-height for vertical strokes
const STROKE_PITCH = 1.8; // Hairline spacing between adjacent vertical strokes
const STROKE_W = 0.85;    // Thin architectural stroke width

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const BASE_DELAY = 0.20; // Delay before wordmark construction starts
const STAGGER = 0.070;   // 70ms stagger across characters (continuous overlapping wave)

type Segment = [number, number]; // [yStart, yEnd]

interface CharSlot {
  char: string;
  start: number;
  width: number;
  dur: number;
}

// 9 Character slots spanning x=35 to x=1365 (1330px out of 1400 = 95.0% width)
const SLOTS: CharSlot[] = [
  { char: 'G', start: 35,   width: 152, dur: 0.58 },
  { char: 'R', start: 192,  width: 146, dur: 0.56 },
  { char: 'A', start: 343,  width: 148, dur: 0.60 },
  { char: 'P', start: 496,  width: 140, dur: 0.54 },
  { char: 'H', start: 641,  width: 150, dur: 0.58 },
  { char: 'M', start: 796,  width: 186, dur: 0.62 },
  { char: 'I', start: 987,  width: 64,  dur: 0.50 },
  { char: 'N', start: 1056, width: 150, dur: 0.58 },
  { char: 'D', start: 1211, width: 154, dur: 0.60 },
];

// Architectural stroke colors by mouse proximity (restrained gray tones)
const STROKE_COLOUR = [
  'rgba(255, 255, 255, 0.85)', // direct hovered character
  'rgba(255, 255, 255, 0.68)', // 1st neighbour
  'rgba(255, 255, 255, 0.56)', // 2nd neighbour
  'rgba(255, 255, 255, 0.48)', // resting state (restrained architectural line)
] as const;

/**
 * Procedural geometry function for each character.
 * Given normalized horizontal position u in [0, 1], returns the vertical stroke
 * intervals [yStart, yEnd] that define the character's architectural form.
 */
function getSegmentsForChar(char: string, u: number): Segment[] {
  const Y_TOP = TOP_Y;
  const Y_BASE = BASELINE_Y;
  const Y_MID = (Y_TOP + Y_BASE) / 2; // 140
  const T = 30; // standard bar / stem thickness

  switch (char) {
    case 'I': {
      // Clean, monumental vertical pillar
      return [[Y_TOP, Y_BASE]];
    }

    case 'H': {
      // Left vertical stem: u in [0, 0.24]
      // Right vertical stem: u in [0.76, 1.0]
      // Central crossbar: u in [0.24, 0.76]
      if (u <= 0.24 || u >= 0.76) {
        return [[Y_TOP, Y_BASE]];
      }
      return [[Y_MID - 15, Y_MID + 15]];
    }

    case 'M': {
      // Left vertical stem: u in [0, 0.22]
      // Right vertical stem: u in [0.78, 1.0]
      // Central V-valley meeting at center baseline
      const segments: Segment[] = [];
      if (u <= 0.22 || u >= 0.78) {
        segments.push([Y_TOP, Y_BASE]);
      } else if (u <= 0.50) {
        const progress = (u - 0.20) / 0.30;
        const center = Y_TOP + progress * (Y_BASE - Y_TOP);
        segments.push([Math.max(Y_TOP, center - 16), Math.min(Y_BASE, center + 16)]);
        if (progress < 0.25) segments.push([Y_TOP, Y_TOP + 28]);
      } else {
        const progress = (u - 0.50) / 0.30;
        const center = Y_BASE - progress * (Y_BASE - Y_TOP);
        segments.push([Math.max(Y_TOP, center - 16), Math.min(Y_BASE, center + 16)]);
        if (progress > 0.75) segments.push([Y_TOP, Y_TOP + 28]);
      }
      return segments;
    }

    case 'N': {
      // Left stem: u <= 0.24
      // Right stem: u >= 0.76
      // Diagonal: u in [0.20, 0.80]
      const segments: Segment[] = [];
      if (u <= 0.24 || u >= 0.76) {
        segments.push([Y_TOP, Y_BASE]);
      }
      if (u >= 0.20 && u <= 0.80) {
        const progress = (u - 0.20) / 0.60;
        const center = Y_TOP + progress * (Y_BASE - Y_TOP);
        segments.push([Math.max(Y_TOP, center - 18), Math.min(Y_BASE, center + 18)]);
      }
      return segments;
    }

    case 'A': {
      // Apex at center (u = 0.50, Y_TOP)
      // Diagonals down to feet (u = 0.08 and u = 0.92)
      // Crossbar at 64% height
      const segments: Segment[] = [];
      const Y_CROSS = Y_TOP + 0.64 * (Y_BASE - Y_TOP);

      // Apex cap
      if (u >= 0.44 && u <= 0.56) {
        segments.push([Y_TOP, Y_TOP + 32]);
      }

      if (u < 0.50) {
        const progress = (0.50 - u) / 0.44;
        const center = Y_TOP + progress * (Y_BASE - Y_TOP);
        if (center <= Y_BASE + 10) {
          segments.push([Math.max(Y_TOP, center - 18), Math.min(Y_BASE, center + 18)]);
        }
      } else {
        const progress = (u - 0.50) / 0.44;
        const center = Y_TOP + progress * (Y_BASE - Y_TOP);
        if (center <= Y_BASE + 10) {
          segments.push([Math.max(Y_TOP, center - 18), Math.min(Y_BASE, center + 18)]);
        }
      }

      // Crossbar
      if (u >= 0.24 && u <= 0.76) {
        segments.push([Y_CROSS - 14, Y_CROSS + 14]);
      }

      return segments;
    }

    case 'P': {
      // Left vertical stem: u <= 0.24
      // Upper loop: u in [0.24, 1.0], y in [Y_TOP, Y_MID + 12]
      // Negative space below loop!
      const segments: Segment[] = [];
      const Y_LOOP_BOT = Y_MID + 12;

      if (u <= 0.24) {
        segments.push([Y_TOP, Y_BASE]);
        return segments;
      }

      // Top bar
      if (u <= 0.76) {
        segments.push([Y_TOP, Y_TOP + T]);
      }
      // Bottom bar of loop
      if (u <= 0.76) {
        segments.push([Y_LOOP_BOT - T, Y_LOOP_BOT]);
      }
      // Curved outer right edge
      if (u > 0.64) {
        const radY = (Y_LOOP_BOT - Y_TOP) / 2;
        const midY = (Y_TOP + Y_LOOP_BOT) / 2;
        const dist = Math.min(1, Math.max(0, (u - 0.64) / 0.36));
        const span = Math.sqrt(Math.max(0, 1 - dist * dist)) * radY;
        segments.push([midY - span, midY + span]);
      }

      return segments;
    }

    case 'R': {
      // Left stem: u <= 0.24
      // Upper loop: same as P
      // Lower diagonal leg: u in [0.42, 1.0], y in [Y_MID + 8, Y_BASE]
      const segments: Segment[] = [];
      const Y_LOOP_BOT = Y_MID + 10;

      if (u <= 0.24) {
        segments.push([Y_TOP, Y_BASE]);
        return segments;
      }

      if (u <= 0.74) {
        segments.push([Y_TOP, Y_TOP + T]);
      }
      if (u <= 0.74) {
        segments.push([Y_LOOP_BOT - T, Y_LOOP_BOT]);
      }
      if (u > 0.62) {
        const radY = (Y_LOOP_BOT - Y_TOP) / 2;
        const midY = (Y_TOP + Y_LOOP_BOT) / 2;
        const dist = Math.min(1, Math.max(0, (u - 0.62) / 0.38));
        const span = Math.sqrt(Math.max(0, 1 - dist * dist)) * radY;
        segments.push([midY - span, midY + span]);
      }

      // Diagonal leg in lower half
      if (u >= 0.42) {
        const legProgress = (u - 0.42) / 0.56;
        const legCenter = Y_LOOP_BOT + legProgress * (Y_BASE - Y_LOOP_BOT);
        if (legCenter <= Y_BASE + 10) {
          segments.push([Math.max(Y_LOOP_BOT, legCenter - 18), Math.min(Y_BASE, legCenter + 18)]);
        }
      }

      return segments;
    }

    case 'D': {
      // Left vertical stem: u <= 0.24
      // Curved outer right arch spanning full height from Y_TOP to Y_BASE
      const segments: Segment[] = [];
      if (u <= 0.24) {
        segments.push([Y_TOP, Y_BASE]);
        return segments;
      }

      if (u <= 0.68) {
        segments.push([Y_TOP, Y_TOP + T]);
      }
      if (u <= 0.68) {
        segments.push([Y_BASE - T, Y_BASE]);
      }
      if (u > 0.58) {
        const radY = (Y_BASE - Y_TOP) / 2;
        const midY = Y_MID;
        const dist = Math.min(1, Math.max(0, (u - 0.58) / 0.42));
        const span = Math.sqrt(Math.max(0, 1 - dist * dist)) * radY;
        segments.push([midY - span, midY + span]);
      }

      return segments;
    }

    case 'G': {
      // C-curve with top horizontal bar, bottom horizontal bar,
      // right vertical spur and horizontal inner crossbar
      const segments: Segment[] = [];

      if (u <= 0.26) {
        const corner = u < 0.12 ? (0.12 - u) * 120 : 0;
        segments.push([Y_TOP + corner, Y_BASE - corner]);
        return segments;
      }

      if (u <= 0.88) {
        segments.push([Y_TOP, Y_TOP + T]);
      }
      if (u <= 0.94) {
        segments.push([Y_BASE - T, Y_BASE]);
      }
      if (u >= 0.78 && u <= 0.96) {
        segments.push([Y_MID - 12, Y_BASE]);
      }
      if (u >= 0.52 && u <= 0.82) {
        segments.push([Y_MID - 14, Y_MID + 14]);
      }

      return segments;
    }

    default:
      return [];
  }
}

/** Merge overlapping vertical intervals */
function mergeSegments(segments: Segment[]): Segment[] {
  if (segments.length <= 1) return segments;
  const sorted = [...segments].sort((a, b) => a[0] - b[0]);
  const merged: Segment[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = sorted[i];
    if (curr[0] <= prev[1] + 2) {
      prev[1] = Math.max(prev[1], curr[1]);
    } else {
      merged.push(curr);
    }
  }
  return merged;
}

/** Pre-calculate all procedural stroke data for maximum runtime efficiency */
function computeLetterStrokes(slot: CharSlot): Segment[][] {
  const count = Math.round(slot.width / STROKE_PITCH);
  const strokes: Segment[][] = [];

  for (let i = 0; i <= count; i++) {
    const x = slot.start + i * STROKE_PITCH;
    if (x > slot.start + slot.width) break;
    const u = (x - slot.start) / slot.width;
    const raw = getSegmentsForChar(slot.char, Math.max(0, Math.min(1, u)));
    strokes.push(mergeSegments(raw));
  }

  return strokes;
}

/* ==========================================================================
   FooterSection Component
   ========================================================================== */

interface FooterSectionProps {
  onUploadMaterial?: () => void;
}

export const FooterSection: React.FC<FooterSectionProps> = ({ onUploadMaterial }) => {
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { amount: 0.04, once: true });
  const R = useReducedMotion();

  // Mouse proximity across character slots
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const handleSvgMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const svgX = relX * SVG_W;
    let closestIdx = 0;
    let minDist = Infinity;
    SLOTS.forEach((slot, idx) => {
      const center = slot.start + slot.width / 2;
      const dist = Math.abs(svgX - center);
      if (dist < minDist) {
        minDist = dist;
        closestIdx = idx;
      }
    });
    setHoveredIdx(closestIdx);
  }, []);

  const handleSvgMouseLeave = useCallback(() => {
    setHoveredIdx(null);
  }, []);

  const strokeColor = (i: number): string => {
    if (hoveredIdx === null) return STROKE_COLOUR[3];
    const dist = Math.abs(i - hoveredIdx);
    return dist <= 2 ? STROKE_COLOUR[dist] : STROKE_COLOUR[3];
  };

  // Pre-generate procedural lines data once
  const slotsData = useMemo(() => {
    return SLOTS.map(slot => ({
      slot,
      strokes: computeLetterStrokes(slot),
    }));
  }, []);

  return (
    <footer
      ref={sectionRef}
      className="gmf-section"
      aria-label="GraphMind"
    >
      {/* ── TOP: Subtle metadata row ───────────────────────────────────────── */}
      <div className="gmf-top">
        <motion.div
          className="gmf-meta-row"
          initial={{ opacity: 0, y: 4 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: R ? 0 : 0.45, delay: R ? 0 : 0.10, ease: EASE }}
        >
          <span className="gmf-meta-label">
            <span className="gmf-accent-dot" aria-hidden="true" />
            GRAPHMIND / KNOWLEDGE MAPPING
          </span>
          <span className="gmf-meta-label">2026</span>
        </motion.div>
      </div>

      {/* ── GIANT PROCEDURAL VERTICAL-LINE WORDMARK ────────────────────────── */}
      <div className="gmf-wordmark-wrap" aria-label="GRAPHMIND" role="img">
        <svg
          className="gmf-svg"
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
          onMouseMove={handleSvgMouseMove}
          onMouseLeave={handleSvgMouseLeave}
        >
          <defs>
            {/* Physical upward construction clip-path for each letter */}
            {SLOTS.map((slot, i) => {
              const delay = R ? 0 : BASE_DELAY + i * STAGGER;
              const dur   = R ? 0 : slot.dur;
              return (
                <clipPath key={`reveal-${slot.char}`} id={`gmf-line-reveal-${i}`}>
                  <motion.rect
                    x={slot.start - 2}
                    width={slot.width + 4}
                    initial={{ y: BASELINE_Y, height: 0 }}
                    animate={
                      isInView
                        ? { y: TOP_Y - 4, height: (BASELINE_Y - TOP_Y) + 8 }
                        : { y: BASELINE_Y, height: 0 }
                    }
                    transition={{
                      duration: dur,
                      delay,
                      ease: EASE,
                    }}
                  />
                </clipPath>
              );
            })}
          </defs>

          {/* Render procedural vertical strokes for each character */}
          {slotsData.map(({ slot, strokes }, i) => {
            const delay = R ? 0 : BASE_DELAY + i * STAGGER;
            const dur   = R ? 0 : slot.dur;
            const color = strokeColor(i);

            return (
              <g key={slot.char} clipPath={`url(#gmf-line-reveal-${i})`}>
                <motion.g
                  className={`letter-${slot.char.toLowerCase()}`}
                  initial={{ y: 16, opacity: 0.35 }}
                  animate={isInView ? { y: 0, opacity: 1 } : {}}
                  transition={{
                    y:       { duration: dur, delay, ease: EASE },
                    opacity: { duration: dur * 0.5, delay, ease: 'easeOut' },
                  }}
                >
                  {strokes.map((segments, colIdx) => {
                    const x = slot.start + colIdx * STROKE_PITCH;
                    return segments.map(([y1, y2], segIdx) => (
                      <line
                        key={`${colIdx}-${segIdx}`}
                        x1={x}
                        y1={y1}
                        x2={x}
                        y2={y2}
                        stroke={color}
                        strokeWidth={STROKE_W}
                        strokeLinecap="butt"
                        vectorEffect="non-scaling-stroke"
                      />
                    ));
                  })}
                </motion.g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── BOTTOM: Structural rule + technical caption ───────────────────── */}
      <div className="gmf-bottom">
        <motion.div
          className="gmf-rule"
          aria-hidden="true"
          initial={{ scaleX: 0 }}
          animate={isInView ? { scaleX: 1 } : {}}
          style={{ transformOrigin: '100% 50%' }}
          transition={{
            duration: R ? 0 : 0.75,
            delay: R ? 0 : BASE_DELAY + SLOTS.length * STAGGER,
            ease: EASE,
          }}
        />
        <motion.div
          className="gmf-meta-row gmf-meta-bottom-row"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{
            duration: R ? 0 : 0.45,
            delay: R ? 0 : BASE_DELAY + SLOTS.length * STAGGER + 0.10,
            ease: EASE,
          }}
        >
          <span className="gmf-meta-label gmf-copy">© GRAPHMIND</span>
          <button
            type="button"
            className="gmf-explore-btn"
            onClick={onUploadMaterial}
            aria-label="Explore GraphMind workspace"
          >
            <span>EXPLORE</span>
            <span className="gmf-explore-arrow" aria-hidden="true">↗</span>
          </button>
        </motion.div>
      </div>
    </footer>
  );
};
