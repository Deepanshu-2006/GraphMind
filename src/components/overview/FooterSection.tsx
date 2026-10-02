import React, { useRef, useState, useCallback } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

/* ==========================================================================
   SVG Wordmark Constants & Layout
   ========================================================================== */

const SVG_W = 1200;
const SVG_H = 224;
const BASELINE_Y = 202; // Baseline in SVG coordinates
const FONT_SIZE = 226;  // Scaled for maximum presence within viewBox
const STROKE_PITCH = 2.6; // Gap between thin vertical stroke lines (SVG units)
const STROKE_W = 1.0;     // Crisp hairline stroke width
const FONT_FAMILY =
  "'Inter Tight', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const BASE_DELAY = 0.28; // Delay after top rule starts
const STAGGER = 0.072;   // 72ms stagger between successive characters

interface CharSlot {
  char: string;
  start: number;
  width: number;
  center: number;
  dur: number;
}

// Tailored character slots for GRAPHMIND with editorial kerning
// Total span: x=20 to x=1180 (1160px out of 1200 = 96.7% width)
const SLOTS: CharSlot[] = [
  { char: 'G', start: 20,   width: 136, center: 88,   dur: 0.58 },
  { char: 'R', start: 160,  width: 126, center: 223,  dur: 0.56 },
  { char: 'A', start: 290,  width: 130, center: 355,  dur: 0.60 },
  { char: 'P', start: 424,  width: 122, center: 485,  dur: 0.54 },
  { char: 'H', start: 550,  width: 132, center: 616,  dur: 0.58 },
  { char: 'M', start: 686,  width: 162, center: 767,  dur: 0.62 },
  { char: 'I', start: 852,  width: 50,  center: 877,  dur: 0.50 },
  { char: 'N', start: 906,  width: 134, center: 973,  dur: 0.58 },
  { char: 'D', start: 1044, width: 136, center: 1112, dur: 0.60 },
];

// Architectural stroke colors by mouse proximity (resting in 0.55–0.70 range)
const STROKE_COLOUR = [
  'rgba(255, 255, 255, 0.90)', // direct hovered character
  'rgba(248, 248, 248, 0.78)', // 1st neighbour
  'rgba(245, 245, 245, 0.68)', // 2nd neighbour
  'rgba(245, 245, 245, 0.62)', // resting state
] as const;

/** Generate crisp vertical lines for a character slot */
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

  // Mouse proximity
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
    <section
      ref={sectionRef}
      className="gmf-section"
      aria-label="GraphMind"
    >
      {/* ── TOP: rule + metadata ───────────────────────────────────────────── */}
      <div className="gmf-top">
        <motion.div
          className="gmf-rule"
          aria-hidden="true"
          initial={{ scaleX: 0 }}
          animate={isInView ? { scaleX: 1 } : {}}
          style={{ transformOrigin: '0% 50%' }}
          transition={{ duration: R ? 0 : 0.75, ease: EASE }}
        />
        <motion.div
          className="gmf-meta-row"
          initial={{ opacity: 0, y: 4 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: R ? 0 : 0.45, delay: R ? 0 : 0.15, ease: EASE }}
        >
          <span className="gmf-meta-label">
            <span className="gmf-accent-dot" aria-hidden="true" />
            GRAPHMIND / KNOWLEDGE MAPPING
          </span>
          <span className="gmf-meta-label">2026</span>
        </motion.div>
      </div>

      {/* ── GIANT GRAPHMIND WORDMARK ───────────────────────────────────────── */}
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
            {/* Silhouette clip-path for each character */}
            {SLOTS.map((slot, i) => (
              <clipPath key={`clip-char-${slot.char}`} id={`gmf-clip-char-${i}`}>
                <text
                  x={slot.center}
                  y={BASELINE_Y}
                  textAnchor="middle"
                  dominantBaseline="alphabetic"
                  fontSize={FONT_SIZE}
                  fontWeight={800}
                  fontFamily={FONT_FAMILY}
                  letterSpacing="-0.015em"
                >
                  {slot.char}
                </text>
              </clipPath>
            ))}

            {/* Bottom-to-top reveal clip-path for each character */}
            {SLOTS.map((slot, i) => {
              const delay = R ? 0 : BASE_DELAY + i * STAGGER;
              const dur   = R ? 0 : slot.dur;
              return (
                <clipPath key={`clip-reveal-${slot.char}`} id={`gmf-clip-reveal-${i}`}>
                  <motion.rect
                    x={slot.start - 4}
                    width={slot.width + 8}
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

          {/* Render each character with dual clip: silhouette + bottom-to-top reveal */}
          {SLOTS.map((slot, i) => {
            const delay = R ? 0 : BASE_DELAY + i * STAGGER;
            const dur   = R ? 0 : slot.dur;

            return (
              <g key={slot.char} clipPath={`url(#gmf-clip-reveal-${i})`}>
                <motion.g
                  clipPath={`url(#gmf-clip-char-${i})`}
                  style={{
                    transformOrigin: `${slot.center}px ${BASELINE_Y}px`,
                  }}
                  initial={{
                    scaleY: 0.90,
                    y: 18,
                    opacity: 0.1,
                  }}
                  animate={
                    isInView
                      ? {
                          scaleY: 1,
                          y: 0,
                          opacity: 1,
                        }
                      : {}
                  }
                  transition={{
                    scaleY:  { duration: dur, delay, ease: EASE },
                    y:       { duration: dur, delay, ease: EASE },
                    opacity: { duration: dur * 0.45, delay, ease: 'easeIn' },
                  }}
                >
                  {genStrokes(slot, strokeColor(i))}
                </motion.g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── BOTTOM: rule + copyright ──────────────────────────────────────── */}
      <motion.div
        className="gmf-bottom"
        initial={{ opacity: 0 }}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{
          duration: R ? 0 : 0.50,
          delay: R ? 0 : BASE_DELAY + SLOTS.length * STAGGER + 0.12,
          ease: EASE,
        }}
      >
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
        <div className="gmf-meta-row gmf-meta-bottom-row">
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
        </div>
      </motion.div>
    </section>
  );
};
