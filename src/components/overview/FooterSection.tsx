import React, { useRef, useState, useCallback } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

/* ==========================================================================
   SVG Architectural Wordmark Constants & Metrics
   ========================================================================== */

const SVG_W = 1400;
const SVG_H = 280;
const BASELINE_Y = 252; // Baseline in SVG units
const FONT_SIZE = 255;  // Base font size before condensed architectural scaling
const STROKE_PITCH = 2.2; // Spacing between hairline vertical strokes
const STROKE_W = 1.0;     // Crisp hairline stroke width
const FONT_FAMILY =
  "'Inter Tight', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const BASE_DELAY = 0.25; // Delay before wordmark construction starts
const STAGGER = 0.075;   // 75ms stagger between successive character reveals

interface CharSlot {
  char: string;
  start: number;
  width: number;
  center: number;
  dur: number;
}

// Tailored slots spanning x=34 to x=1366 (1332px out of 1400 = 95.1% width)
// Tall, condensed letterforms with minimal gap (almost visually touching)
const SLOTS: CharSlot[] = [
  { char: 'G', start: 34,    width: 154, center: 111,   dur: 0.58 },
  { char: 'R', start: 192.5, width: 146, center: 265.5, dur: 0.56 },
  { char: 'A', start: 343,   width: 150, center: 418,   dur: 0.60 },
  { char: 'P', start: 497.5, width: 140, center: 567.5, dur: 0.54 },
  { char: 'H', start: 642,   width: 152, center: 718,   dur: 0.58 },
  { char: 'M', start: 798.5, width: 186, center: 891.5, dur: 0.62 },
  { char: 'I', start: 989,   width: 62,  center: 1020,  dur: 0.50 },
  { char: 'N', start: 1055.5,width: 152, center: 1131.5,dur: 0.58 },
  { char: 'D', start: 1212,  width: 154, center: 1289,  dur: 0.60 },
];

// Architectural stroke colors by mouse proximity (subtle neutral gray/white)
const STROKE_COLOUR = [
  'rgba(255, 255, 255, 0.88)', // direct hovered character
  'rgba(255, 255, 255, 0.74)', // 1st neighbour
  'rgba(255, 255, 255, 0.64)', // 2nd neighbour
  'rgba(255, 255, 255, 0.56)', // resting state (restrained architectural tone)
] as const;

/** Generate crisp vertical lines across a character slot */
function genStrokes(slot: CharSlot, color: string): React.ReactNode[] {
  const count = Math.ceil(slot.width / STROKE_PITCH) + 1;
  return Array.from({ length: count }, (_, j) => {
    const x = slot.start + j * STROKE_PITCH;
    return (
      <line
        key={j}
        x1={x}
        y1={0}
        x2={x}
        y2={SVG_H}
        stroke={color}
        strokeWidth={STROKE_W}
        strokeLinecap="butt"
        vectorEffect="non-scaling-stroke"
      />
    );
  });
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

  // Mouse proximity tracking across character slots
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const handleSvgMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const svgX = relX * SVG_W;
    let closestIdx = 0;
    let minDist = Infinity;
    SLOTS.forEach((slot, idx) => {
      const dist = Math.abs(svgX - slot.center);
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

  return (
    <footer
      ref={sectionRef}
      className="gmf-section"
      aria-label="GraphMind"
    >
      {/* ── TOP: Small metadata row ────────────────────────────────────────── */}
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

      {/* ── GIANT ARCHITECTURAL SVG WORDMARK (Occupies 60–70% of footer) ───── */}
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
            {/* 1. Silhouette clip-path for each character: tall, condensed architectural letterform */}
            {SLOTS.map((slot, i) => (
              <clipPath key={`clip-char-${slot.char}`} id={`gmf-char-${i}`}>
                <text
                  x={slot.center}
                  y={BASELINE_Y}
                  textAnchor="middle"
                  dominantBaseline="alphabetic"
                  fontSize={FONT_SIZE}
                  fontWeight={900}
                  fontFamily={FONT_FAMILY}
                  transform={`translate(${slot.center}, ${BASELINE_Y}) scale(0.85, 1.25) translate(${-slot.center}, ${-BASELINE_Y})`}
                >
                  {slot.char}
                </text>
              </clipPath>
            ))}

            {/* 2. Physical upward reveal clip-path: grows from baseline to cap-height */}
            {SLOTS.map((slot, i) => {
              const delay = R ? 0 : BASE_DELAY + i * STAGGER;
              const dur   = R ? 0 : slot.dur;
              return (
                <clipPath key={`clip-reveal-${slot.char}`} id={`gmf-reveal-${i}`}>
                  <motion.rect
                    x={slot.start - 2}
                    width={slot.width + 4}
                    initial={{ y: BASELINE_Y, height: 0 }}
                    animate={
                      isInView
                        ? { y: 0, height: BASELINE_Y + 10 }
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

          {/* Render each character group: upward construction from baseline */}
          {SLOTS.map((slot, i) => {
            const delay = R ? 0 : BASE_DELAY + i * STAGGER;
            const dur   = R ? 0 : slot.dur;

            return (
              <g key={slot.char} clipPath={`url(#gmf-reveal-${i})`}>
                <motion.g
                  clipPath={`url(#gmf-char-${i})`}
                  initial={{
                    y: 20,
                    opacity: 0.35,
                  }}
                  animate={
                    isInView
                      ? {
                          y: 0,
                          opacity: 1,
                        }
                      : {}
                  }
                  transition={{
                    y:       { duration: dur, delay, ease: EASE },
                    opacity: { duration: dur * 0.5, delay, ease: 'easeOut' },
                  }}
                >
                  {genStrokes(slot, strokeColor(i))}
                </motion.g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── BOTTOM: Thin rule + technical caption metadata ────────────────── */}
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
