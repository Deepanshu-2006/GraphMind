import React, { useRef, useCallback, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'framer-motion';

/* ==========================================================================
   Procedural Architectural SVG Wordmark — "GRAPH"
   -------------------------------------------------------------------------
   Construction principle:
     ▸ Each letter is built ONLY from individual vertical <line> elements.
     ▸ No <text>, no font-clip, no background-stripe hack.
     ▸ The lines ARE the typography — exactly as in the Arena reference.

   Geometry calibration (derived from pixel analysis of reference image):
     ▸ SVG canvas:   1024 × 227
     ▸ Y_TOP  = 40   (cap-height)
     ▸ Y_BASE = 208  (baseline)
     ▸ PITCH  = 5.8 px  (center-to-center distance between adjacent lines)
     ▸ STROKE = 1.8 px  (stroke-width)
     ▸ Lines per letter: 26–28
   ========================================================================== */

const SVG_W   = 1024;
const SVG_H   = 227;
const Y_TOP   = 40;
const Y_BASE  = 208;
const Y_MID   = (Y_TOP + Y_BASE) / 2;   // 124
const PITCH   = 5.8;
const STROKE  = 1.8;
const BAR     = 38;       // horizontal bar thickness
const Y_BOWL  = Y_MID + 18; // 142 — bottom of R/P bowl

type Seg = readonly [number, number];

/* ──────────────────────────────────────────────────────────────────────── */
/* Segment generators — produce [y1, y2] intervals per vertical stroke      */
/* ──────────────────────────────────────────────────────────────────────── */

function segG(i: number, _N: number): Seg[] {
  const segs: Seg[] = [];
  if (i <= 8) {
    const corner = i === 0 ? 18 : i === 1 ? 8 : 0;
    segs.push([Y_TOP + corner, Y_BASE - corner]);
    return segs;
  }
  if (i <= 22) segs.push([Y_TOP, Y_TOP + BAR]);
  if (i >= 18) {
    segs.push([Y_MID - 6, Y_BASE]);
  } else {
    segs.push([Y_BASE - BAR, Y_BASE]);
  }
  if (i >= 11 && i <= 17) segs.push([Y_MID - 6, Y_MID + 24]);
  return segs;
}

function segR(i: number, _N: number): Seg[] {
  const segs: Seg[] = [];
  if (i <= 8) { segs.push([Y_TOP, Y_BASE]); return segs; }
  if (i <= 20) segs.push([Y_TOP, Y_TOP + BAR]);
  if (i <= 17) segs.push([Y_BOWL - BAR, Y_BOWL]);
  if (i >= 18 && i <= 20) {
    segs.push([Y_TOP + (i - 17) * 2, Y_BASE]);
  } else if (i >= 21) {
    const d = i - 20;
    const topSeg: Seg = [Y_TOP + 4 + d * 4, 130 - d * 3];
    const botSeg: Seg = [132 + d * 4, Y_BASE];
    if (topSeg[1] > topSeg[0]) segs.push(topSeg);
    if (botSeg[1] > botSeg[0]) segs.push(botSeg);
  }
  return segs;
}

function segA(i: number, _N: number): Seg[] {
  const segs: Seg[] = [];
  if (i <= 9) {
    segs.push([Y_TOP + (9 - i) * 15.5, Y_BASE]);
  } else if (i >= 18) {
    segs.push([Y_TOP + (i - 18) * 15.5, Y_BASE]);
  } else {
    const dist = Math.abs(i - 13.5);
    const counterBot = 94 + (3.5 - dist) * 14;
    segs.push([Y_TOP, counterBot]);
    if (i >= 11 && i <= 16) segs.push([147, 184]);
  }
  return segs;
}

function segP(i: number, _N: number): Seg[] {
  const segs: Seg[] = [];
  if (i <= 8) { segs.push([Y_TOP, Y_BASE]); return segs; }
  if (i <= 19) segs.push([Y_TOP, Y_TOP + BAR]);
  if (i <= 17) segs.push([Y_BOWL - BAR, Y_BOWL]);
  if (i >= 18 && i <= 24) {
    const d = i - 17;
    const topY = Y_TOP + d * 3.5;
    const botY = Y_BOWL - (d - 1) * 3;
    if (botY > topY) segs.push([topY, botY]);
  }
  return segs;
}

function segH(i: number, _N: number): Seg[] {
  if (i <= 8 || i >= 17) return [[Y_TOP, Y_BASE]];
  return [[Y_MID - BAR / 2, Y_MID + BAR / 2]];
}

/* ──────────────────────────────────────────────────────────────────────── */
interface SlotDef {
  char: string;
  x0: number;
  n: number;
  dur: number;
  fn: (i: number, N: number) => Seg[];
}

const SLOTS: SlotDef[] = [
  { char: 'G', x0: 100, n: 26, dur: 0.60, fn: segG },
  { char: 'R', x0: 268, n: 26, dur: 0.62, fn: segR },
  { char: 'A', x0: 436, n: 28, dur: 0.64, fn: segA },
  { char: 'P', x0: 620, n: 25, dur: 0.58, fn: segP },
  { char: 'H', x0: 788, n: 26, dur: 0.60, fn: segH },
];

const COMPUTED = SLOTS.map(slot => ({
  slot,
  strokes: Array.from({ length: slot.n }, (_, i) => ({
    x: slot.x0 + i * PITCH,
    segs: slot.fn(i, slot.n),
  })).filter(s => s.segs.length > 0),
}));

/* ──────────────────────────────────────────────────────────────────────── */
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const BASE_DELAY = 0.15;
const STAGGER    = 0.075;

interface FooterSectionProps {
  onUploadMaterial?: () => void;
}

export const FooterSection: React.FC<FooterSectionProps> = ({ onUploadMaterial }) => {
  const sectionRef  = useRef<HTMLElement>(null);
  const isInView    = useInView(sectionRef, { amount: 0.04, once: true });
  const prefersLess = useReducedMotion();

  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const rect   = e.currentTarget.getBoundingClientRect();
    const svgX   = ((e.clientX - rect.left) / rect.width) * SVG_W;
    let minDist  = Infinity;
    let closest  = 0;
    SLOTS.forEach((s, idx) => {
      const center = s.x0 + (s.n * PITCH) / 2;
      const dist   = Math.abs(svgX - center);
      if (dist < minDist) { minDist = dist; closest = idx; }
    });
    setHoveredIdx(closest);
  }, []);

  const handleMouseLeave = useCallback(() => setHoveredIdx(null), []);

  return (
    <footer ref={sectionRef} className="gmf-section" aria-label="GRAPH wordmark footer">

      {/* ── Top metadata row ──────────────────────────────────────────────── */}
      <div className="gmf-top">
        <motion.div
          className="gmf-meta-row"
          initial={{ opacity: 0, y: 4 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: prefersLess ? 0 : 0.42, delay: prefersLess ? 0 : 0.08, ease: EASE }}
        >
          <span className="gmf-meta-label">
            <span className="gmf-accent-dot" aria-hidden="true" />
            GRAPH / KNOWLEDGE MAPPING
          </span>
          <span className="gmf-meta-label">2026</span>
        </motion.div>
      </div>

      {/* ── Giant procedural-line GRAPH wordmark ──────────────────────────── */}
      <div className="gmf-wordmark-wrap" aria-label="GRAPH" role="img">
        <svg
          className="gmf-svg"
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            {/* Arena architectural baseline-fade gradient */}
            <linearGradient
              id="arena-line-gradient"
              gradientUnits="userSpaceOnUse"
              x1="0" y1={Y_TOP} x2="0" y2={Y_BASE}
            >
              <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.92" />
              <stop offset="70%"  stopColor="#FFFFFF" stopOpacity="0.92" />
              <stop offset="84%"  stopColor="#C8C8C8" stopOpacity="0.60" />
              <stop offset="93%"  stopColor="#808080" stopOpacity="0.28" />
              <stop offset="100%" stopColor="#0A0A0A" stopOpacity="0.00" />
            </linearGradient>

            {/* Brighter variant for hovered letter */}
            <linearGradient
              id="arena-hover-gradient"
              gradientUnits="userSpaceOnUse"
              x1="0" y1={Y_TOP} x2="0" y2={Y_BASE}
            >
              <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="1.00" />
              <stop offset="74%"  stopColor="#FFFFFF" stopOpacity="1.00" />
              <stop offset="87%"  stopColor="#E0E0E0" stopOpacity="0.72" />
              <stop offset="96%"  stopColor="#A0A0A0" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#0A0A0A" stopOpacity="0.00" />
            </linearGradient>

            {/* Per-letter upward-construction clip rect */}
            {COMPUTED.map(({ slot }, i) => {
              const delay = prefersLess ? 0 : BASE_DELAY + i * STAGGER;
              const dur   = prefersLess ? 0 : slot.dur;
              return (
                <clipPath key={`clip-${slot.char}`} id={`gmf-clip-${i}`}>
                  <motion.rect
                    x={slot.x0 - 4}
                    width={slot.n * PITCH + 8}
                    initial={{ y: Y_BASE, height: 0 }}
                    animate={
                      isInView
                        ? { y: Y_TOP - 6, height: (Y_BASE - Y_TOP) + 12 }
                        : { y: Y_BASE,    height: 0 }
                    }
                    transition={{ duration: dur, delay, ease: EASE }}
                  />
                </clipPath>
              );
            })}
          </defs>

          {/* Render each letter */}
          {COMPUTED.map(({ slot, strokes }, i) => {
            const delay   = prefersLess ? 0 : BASE_DELAY + i * STAGGER;
            const dur     = prefersLess ? 0 : slot.dur;
            const isHov   = hoveredIdx === i;
            const gradUrl = isHov ? 'url(#arena-hover-gradient)' : 'url(#arena-line-gradient)';

            return (
              <g key={slot.char} clipPath={`url(#gmf-clip-${i})`}>
                <motion.g
                  initial={{ opacity: 0 }}
                  animate={isInView ? { opacity: 1 } : {}}
                  transition={{ duration: dur * 0.55, delay, ease: 'easeOut' }}
                >
                  {strokes.map(({ x, segs }, colIdx) =>
                    segs.map(([y1, y2], segIdx) => (
                      <line
                        key={`${colIdx}-${segIdx}`}
                        x1={x}
                        y1={y1}
                        x2={x}
                        y2={y2}
                        stroke={gradUrl}
                        strokeWidth={STROKE}
                        strokeLinecap="butt"
                        vectorEffect="non-scaling-stroke"
                      />
                    ))
                  )}
                </motion.g>
              </g>
            );
          })}
        </svg>
      </div>

      {/* ── Bottom: rule + copyright / explore ───────────────────────────── */}
      <div className="gmf-bottom">
        <motion.div
          className="gmf-rule"
          aria-hidden="true"
          initial={{ scaleX: 0 }}
          animate={isInView ? { scaleX: 1 } : {}}
          style={{ transformOrigin: '100% 50%' }}
          transition={{
            duration: prefersLess ? 0 : 0.70,
            delay:    prefersLess ? 0 : BASE_DELAY + SLOTS.length * STAGGER,
            ease:     EASE,
          }}
        />
        <motion.div
          className="gmf-meta-row gmf-meta-bottom-row"
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{
            duration: prefersLess ? 0 : 0.40,
            delay:    prefersLess ? 0 : BASE_DELAY + SLOTS.length * STAGGER + 0.10,
            ease:     EASE,
          }}
        >
          <span className="gmf-meta-label gmf-copy">© GRAPH</span>
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
