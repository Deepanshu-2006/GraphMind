import React, { useRef, useState, useCallback } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

/* ==========================================================================
   SVG Wordmark Constants
   ========================================================================== */

// SVG coordinate space — viewBox="0 0 1000 190"
const SVG_W = 1000;
const SVG_H = 190;
const CHARS = ['G', 'R', 'A', 'P', 'H', 'M', 'I', 'N', 'D'] as const;
const SLOT_W = SVG_W / CHARS.length;      // 111.11px per character slot
const BASELINE_Y = 155;                    // text baseline in SVG user units
const FONT_SIZE = 164;                     // large enough to fill slot height
const STROKE_PITCH = 3.5;                 // gap between vertical strokes (SVG units)
const STROKE_W = 1.5;                     // stroke width (SVG units)
const FONT_FAMILY =
  "'Inter Tight', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif";

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const BASE_STAGGER = 0.083;    // 83ms between characters
const BASE_DELAY   = 0.30;     // delay after inView fires

// Per-character micro-variation — intentional, not random
const CHAR_META = [
  { d: 0,    dur: 0.72 }, // G
  { d: 0.04, dur: 0.70 }, // R
  { d: 0.02, dur: 0.74 }, // A
  { d: 0.03, dur: 0.68 }, // P
  { d: 0.01, dur: 0.72 }, // H
  { d: 0.05, dur: 0.76 }, // M
  { d: 0.02, dur: 0.64 }, // I
  { d: 0.03, dur: 0.70 }, // N
  { d: 0.01, dur: 0.74 }, // D
] as const;

// Stroke colours by hover proximity (0=hovered, 1=neighbour, 2=2-away, null=rest)
const STROKE_COLOUR = [
  'rgba(245,245,245,0.88)', // hov-0  (direct)
  'rgba(235,235,235,0.76)', // hov-1  (neighbour)
  'rgba(225,225,225,0.68)', // hov-2  (2 away)
  'rgba(215,215,215,0.60)', // resting
] as const;

/* ==========================================================================
   Helpers
   ========================================================================== */

/** Generate the vertical stroke <line> elements for one character slot */
function genStrokes(slotIdx: number, color: string): React.ReactNode[] {
  const x0    = SLOT_W * slotIdx;
  const count = Math.ceil(SLOT_W / STROKE_PITCH) + 1;
  return Array.from({ length: count }, (_, j) => {
    const x = x0 + j * STROKE_PITCH;
    return (
      <line
        key={j}
        x1={x} y1={0}
        x2={x} y2={SVG_H}
        stroke={color}
        strokeWidth={STROKE_W}
        strokeLinecap="square"
        vectorEffect="non-scaling-stroke"
      />
    );
  });
}

/* ==========================================================================
   FooterSection
   ========================================================================== */

interface FooterSectionProps {
  onUploadMaterial?: () => void;
}

export const FooterSection: React.FC<FooterSectionProps> = ({ onUploadMaterial }) => {
  const sectionRef = useRef<HTMLElement>(null);
  // Fire as soon as the footer's top edge enters the viewport
  const isInView = useInView(sectionRef, { amount: 0.04, once: true });
  const R = useReducedMotion();

  // Hover: track which character slot the cursor is over
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const handleSvgMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX  = (e.clientX - rect.left) / rect.width;
    const idx   = Math.floor(relX * CHARS.length);
    setHoveredIdx(Math.max(0, Math.min(CHARS.length - 1, idx)));
  }, []);

  const handleSvgMouseLeave = useCallback(() => {
    setHoveredIdx(null);
  }, []);

  // Returns the correct stroke colour for a given character index
  const strokeColor = (i: number): string => {
    if (hoveredIdx === null) return STROKE_COLOUR[3];
    const dist = Math.abs(i - hoveredIdx);
    return dist <= 2 ? STROKE_COLOUR[dist] : STROKE_COLOUR[3];
  };

  return (
    <section
      ref={sectionRef}
      className="gmf-section"
      aria-label="GraphMind — the end of the page"
    >

      {/* ── TOP: rule + metadata ───────────────────────────────────────────── */}
      <div className="gmf-top">
        <motion.div
          className="gmf-rule"
          aria-hidden="true"
          initial={{ scaleX: 0 }}
          animate={isInView ? { scaleX: 1 } : {}}
          style={{ transformOrigin: '0% 50%' }}
          transition={{ duration: R ? 0 : 0.9, ease: EASE }}
        />
        <motion.div
          className="gmf-meta-row"
          initial={{ opacity: 0, y: 6 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: R ? 0 : 0.5, delay: R ? 0 : 0.20, ease: EASE }}
        >
          <span className="gmf-meta-label">
            <span className="gmf-accent-dot" aria-hidden="true" />
            GRAPHMIND / KNOWLEDGE MAPPING
          </span>
          <span className="gmf-meta-label">2026</span>
        </motion.div>
      </div>

      {/* ── CENTRE: giant SVG wordmark ────────────────────────────────────── */}
      <div className="gmf-wordmark-wrap" aria-label="GRAPHMIND" role="img">
        <svg
          className="gmf-svg"
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
          onMouseMove={handleSvgMouseMove}
          onMouseLeave={handleSvgMouseLeave}
        >
          {/* ── defs: one clipPath per character ── */}
          <defs>
            {CHARS.map((char, i) => (
              <clipPath key={char} id={`gmf-clip-${i}`}>
                <text
                  x={SLOT_W * i + SLOT_W * 0.5}
                  y={BASELINE_Y}
                  textAnchor="middle"
                  dominantBaseline="auto"
                  fontSize={FONT_SIZE}
                  fontWeight={800}
                  fontFamily={FONT_FAMILY}
                  letterSpacing={-FONT_SIZE * 0.03}
                >
                  {char}
                </text>
              </clipPath>
            ))}
          </defs>

          {/* ── character groups: each grows upward from baseline ── */}
          {CHARS.map((char, i) => {
            const delay = R ? 0 : BASE_DELAY + i * BASE_STAGGER + CHAR_META[i].d;
            const dur   = R ? 0 : CHAR_META[i].dur;

            return (
              <motion.g
                key={char}
                clipPath={`url(#gmf-clip-${i})`}
                // Grow from the bottom of the stroke group upward
                // transformBox:fill-box makes transform-origin relative to the element bounds
                // transformOrigin:center bottom = scale from the baseline
                style={{
                  transformBox: 'fill-box',
                  transformOrigin: 'center bottom',
                }}
                initial={{ scaleY: 0, opacity: 0 }}
                animate={isInView ? { scaleY: 1, opacity: 1 } : {}}
                transition={{
                  scaleY:   { duration: dur, delay, ease: EASE },
                  opacity:  { duration: dur * 0.5, delay, ease: 'easeIn' },
                }}
              >
                {genStrokes(i, strokeColor(i))}
              </motion.g>
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
          duration: R ? 0 : 0.55,
          delay: R ? 0 : BASE_DELAY + CHARS.length * BASE_STAGGER + 0.18,
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
            duration: R ? 0 : 0.9,
            delay: R ? 0 : BASE_DELAY + CHARS.length * BASE_STAGGER,
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
