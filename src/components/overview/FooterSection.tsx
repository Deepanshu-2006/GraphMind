import React, { useRef, useCallback, useState, useEffect } from 'react';
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
  fn: (i: number, N: number) => Seg[];
}

const SLOTS: SlotDef[] = [
  { char: 'G', x0: 100, n: 26, fn: segG },
  { char: 'R', x0: 268, n: 26, fn: segR },
  { char: 'A', x0: 436, n: 28, fn: segA },
  { char: 'P', x0: 620, n: 25, fn: segP },
  { char: 'H', x0: 788, n: 26, fn: segH },
];

/* ──────────────────────────────────────────────────────────────────────── */
/* Precomputed Stroke Items with Architectural Wave Delays & Physical Overshoot */
/* ──────────────────────────────────────────────────────────────────────── */

export interface StrokeItem {
  key: string;
  char: string;
  letterIdx: number;
  colIdx: number;
  segIdx: number;
  x: number;
  y1: number;
  y2: number;
  targetHeight: number;
  extra: number;
  fullLen: number;
  yTopGeom: number;
  yBotGeom: number;
  isBaseline: boolean;
  delay: number;
  dur: number;
}

const MIN_X = SLOTS[0].x0; // 100
const MAX_X = SLOTS[4].x0 + (SLOTS[4].n - 1) * PITCH; // 933

function getDeterministicJitter(x: number, colIdx: number, segIdx: number): number {
  const val = Math.sin(x * 12.9898 + colIdx * 78.233 + segIdx * 37.719) * 43758.5453;
  return (val - Math.floor(val)) - 0.5; // -0.5 to +0.5
}

const LETTER_STROKES: StrokeItem[][] = [[], [], [], [], []];
const ALL_STROKES: StrokeItem[] = [];

SLOTS.forEach((slot, letterIdx) => {
  for (let colIdx = 0; colIdx < slot.n; colIdx++) {
    const x = slot.x0 + colIdx * PITCH;
    const segs = slot.fn(colIdx, slot.n);
    segs.forEach(([y1, y2], segIdx) => {
      const targetHeight = y2 - y1;
      // 1.8% physical overshoot
      const extra = Math.max(1.5, Math.round(targetHeight * 0.018 * 10) / 10);
      const fullLen = targetHeight + extra;
      const yTopGeom = y1 - extra;
      const yBotGeom = y2;
      const isBaseline = y2 === Y_BASE;

      const normX = (x - MIN_X) / (MAX_X - MIN_X);
      const normH = targetHeight / (Y_BASE - Y_TOP);
      const jitter = getDeterministicJitter(x, colIdx, segIdx);

      // Architectural construction wave moving Left -> Right across G -> R -> A -> P -> H
      const waveTime = 0.35 + normX * 1.50; // 0.35s to 1.85s
      const heightLag = (1 - normH) * 0.08; // taller strokes rise slightly earlier
      const jitterDelay = jitter * 0.12;    // neighboring strokes vary deterministically
      const upperSegDelay = isBaseline ? 0 : 0.09; // baseline anchors form first

      const delay = Math.max(0.35, waveTime + heightLag + jitterDelay + upperSegDelay);
      const dur = 0.50 + normH * 0.08 + jitter * 0.05; // 480ms–620ms per stroke

      const item: StrokeItem = {
        key: `${slot.char}-${colIdx}-${segIdx}`,
        char: slot.char,
        letterIdx,
        colIdx,
        segIdx,
        x,
        y1,
        y2,
        targetHeight,
        extra,
        fullLen,
        yTopGeom,
        yBotGeom,
        isBaseline,
        delay,
        dur,
      };

      LETTER_STROKES[letterIdx].push(item);
      ALL_STROKES.push(item);
    });
  }
});

// Construction completes around ~2.47s
const SETTLE_DELAY_MS = 2480;
const LIGHT_PASS_DELAY_MS = 2780;
const METADATA_DELAY_S = 2.85;

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

interface FooterSectionProps {
  onUploadMaterial?: () => void;
}

export const FooterSection: React.FC<FooterSectionProps> = ({ onUploadMaterial }) => {
  const sectionRef       = useRef<HTMLElement>(null);
  const svgRef           = useRef<SVGSVGElement>(null);
  const baselineRef      = useRef<SVGLineElement>(null);
  const wordmarkGroupRef = useRef<SVGGElement>(null);
  const lightPassRef     = useRef<SVGRectElement>(null);
  const hasAnimatedRef   = useRef(false);

  const isInView    = useInView(sectionRef, { amount: 0.05, once: true });
  const prefersLess = useReducedMotion();

  const [hoveredIdx, setHoveredIdx]   = useState<number | null>(null);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);

  useEffect(() => {
    if (prefersLess) {
      setIsCompleted(true);
      return;
    }
    if (!isInView || hasAnimatedRef.current) return;
    hasAnimatedRef.current = true;

    // 1. Baseline reveal: 0.0s to 0.40s
    if (baselineRef.current) {
      baselineRef.current.animate(
        [
          { strokeDashoffset: 884 },
          { strokeDashoffset: 0 },
        ],
        {
          duration: 400,
          delay: 0,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
          fill: 'forwards',
        }
      );
    }

    // 2. Individual vertical stroke construction wave (left -> right)
    const lineEls = svgRef.current?.querySelectorAll<SVGLineElement>('.gmf-stroke-line');
    if (lineEls) {
      lineEls.forEach((line) => {
        const fullLen = parseFloat(line.dataset.fullLen || '0');
        const extra = parseFloat(line.dataset.extra || '0');
        const delayMs = parseFloat(line.dataset.delay || '0') * 1000;
        const durMs = parseFloat(line.dataset.dur || '0') * 1000;
        const isBase = line.dataset.isBase === 'true';

        const initialOffset = isBase ? fullLen - 2 : fullLen;
        const initialOpacity = isBase ? 0.06 : 0;

        line.animate(
          [
            { strokeDashoffset: initialOffset, opacity: initialOpacity, offset: 0 },
            { strokeDashoffset: fullLen * 0.55, opacity: 0.85, offset: 0.35 },
            { strokeDashoffset: 0, opacity: 1.0, offset: 0.72 }, // peak overshoot (1.8%)
            { strokeDashoffset: extra + 0.8, opacity: 1.0, offset: 0.88 }, // precision settle
            { strokeDashoffset: extra, opacity: 1.0, offset: 1.0 }, // locked into position
          ],
          {
            duration: durMs,
            delay: delayMs,
            easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
            fill: 'forwards',
          }
        );
      });
    }

    // 3. Structural settle when H finishes: translateY 0 -> -1px -> 0
    if (wordmarkGroupRef.current) {
      wordmarkGroupRef.current.animate(
        [
          { transform: 'translateY(0px)' },
          { transform: 'translateY(-1px)', offset: 0.35 },
          { transform: 'translateY(0px)', offset: 1.0 },
        ],
        {
          duration: 280,
          delay: SETTLE_DELAY_MS,
          easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
          fill: 'forwards',
        }
      );
    }

    // 4. Subtle inspection light pass: travels left to right across strokes
    if (lightPassRef.current) {
      lightPassRef.current.animate(
        [
          { transform: 'translateX(30px)', opacity: 0 },
          { transform: 'translateX(80px)', opacity: 1, offset: 0.08 },
          { transform: 'translateX(900px)', opacity: 1, offset: 0.92 },
          { transform: 'translateX(960px)', opacity: 0, offset: 1.0 },
        ],
        {
          duration: 820,
          delay: LIGHT_PASS_DELAY_MS,
          easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
          fill: 'forwards',
        }
      );
    }

    // Mark completed once all sequences finish (~3.6s)
    const completeTimer = setTimeout(() => {
      setIsCompleted(true);
    }, LIGHT_PASS_DELAY_MS + 820);

    return () => {
      clearTimeout(completeTimer);
    };
  }, [isInView, prefersLess]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    // Only enable interactive hover after initial construction sequence has completed
    if (!isCompleted && !prefersLess) return;

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
  }, [isCompleted, prefersLess]);

  const handleMouseLeave = useCallback(() => setHoveredIdx(null), []);

  return (
    <footer ref={sectionRef} className="gmf-section" aria-label="GRAPH wordmark footer">

      {/* ── Top metadata row (quiet, minimal, visible before GRAPH begins) ── */}
      <div className="gmf-top">
        <div className="gmf-meta-row">
          <span className="gmf-meta-label">
            <span className="gmf-accent-dot" aria-hidden="true" />
            GRAPH / KNOWLEDGE MAPPING
          </span>
          <span className="gmf-meta-label">2026</span>
        </div>
      </div>

      {/* ── Giant procedural-line GRAPH wordmark ──────────────────────────── */}
      <div className="gmf-wordmark-wrap" aria-label="GRAPH" role="img">
        <svg
          ref={svgRef}
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

            {/* Subtle inspection light pass gradient — purely monochromatic, no glow */}
            <linearGradient
              id="gmf-light-pass-gradient"
              x1="0%" y1="0%" x2="100%" y2="0%"
            >
              <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.00" />
              <stop offset="25%"  stopColor="#FFFFFF" stopOpacity="0.05" />
              <stop offset="50%"  stopColor="#FFFFFF" stopOpacity="0.14" />
              <stop offset="75%"  stopColor="#FFFFFF" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0.00" />
            </linearGradient>

            {/* Mask of all completed strokes — ensures inspection light pass only illuminates the lines */}
            <mask id="gmf-all-strokes-mask">
              <rect x="0" y="0" width={SVG_W} height={SVG_H} fill="#000000" />
              {ALL_STROKES.map((s) => (
                <line
                  key={`mask-${s.key}`}
                  x1={s.x}
                  y1={s.yBotGeom}
                  x2={s.x}
                  y2={s.y1}
                  stroke="#FFFFFF"
                  strokeWidth={STROKE}
                  strokeLinecap="butt"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </mask>
          </defs>

          {/* ── Subtle origin baseline beneath GRAPH (scaleX 0 -> 1) ────────── */}
          <line
            ref={baselineRef}
            x1="70"
            y1={Y_BASE}
            x2="954"
            y2={Y_BASE}
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth={1}
            strokeLinecap="butt"
            vectorEffect="non-scaling-stroke"
            strokeDasharray="884 884"
            style={{
              strokeDashoffset: prefersLess ? 0 : 884,
            }}
          />

          {/* ── Main architectural wordmark group with structural settle ─────── */}
          <g ref={wordmarkGroupRef} id="gmf-wordmark-group">
            {SLOTS.map((slot, letterIdx) => {
              const isHov = hoveredIdx === letterIdx;
              const gradUrl = isHov ? 'url(#arena-hover-gradient)' : 'url(#arena-line-gradient)';
              const strokes = LETTER_STROKES[letterIdx];

              return (
                <g key={slot.char} stroke={gradUrl}>
                  {strokes.map((s) => {
                    const isDone = isCompleted || prefersLess;
                    const initOffset = s.isBaseline ? s.fullLen - 2 : s.fullLen;
                    const initOpacity = s.isBaseline ? 0.06 : 0;

                    return (
                      <line
                        key={s.key}
                        className="gmf-stroke-line"
                        data-full-len={s.fullLen}
                        data-extra={s.extra}
                        data-delay={s.delay}
                        data-dur={s.dur}
                        data-is-base={s.isBaseline}
                        x1={s.x}
                        y1={s.yBotGeom}
                        x2={s.x}
                        y2={s.yTopGeom}
                        strokeWidth={STROKE}
                        strokeLinecap="butt"
                        vectorEffect="non-scaling-stroke"
                        strokeDasharray={`${s.fullLen + 20} ${s.fullLen + 20}`}
                        style={{
                          strokeDashoffset: isDone ? s.extra : initOffset,
                          opacity: isDone ? 1 : initOpacity,
                        }}
                      />
                    );
                  })}
                </g>
              );
            })}
          </g>

          {/* ── Final inspection light pass (travels across GRAPH) ─────────── */}
          {!prefersLess && (
            <g mask="url(#gmf-all-strokes-mask)" style={{ pointerEvents: 'none' }}>
              <rect
                ref={lightPassRef}
                x={0}
                y={Y_TOP - 6}
                width={84}
                height={(Y_BASE - Y_TOP) + 12}
                fill="url(#gmf-light-pass-gradient)"
                style={{
                  opacity: 0,
                  transform: 'translateX(30px)',
                }}
              />
            </g>
          )}
        </svg>
      </div>

      {/* ── Bottom: rule + copyright / explore ───────────────────────────── */}
      <div className="gmf-bottom">
        <motion.div
          className="gmf-rule"
          aria-hidden="true"
          initial={{ scaleX: 0 }}
          animate={isInView ? { scaleX: 1 } : {}}
          style={{ transformOrigin: '0% 50%' }}
          transition={{
            duration: prefersLess ? 0 : 0.50,
            delay:    prefersLess ? 0 : METADATA_DELAY_S - 0.05,
            ease:     EASE,
          }}
        />
        <motion.div
          className="gmf-meta-row gmf-meta-bottom-row"
          initial={{ opacity: 0, y: 6 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{
            duration: prefersLess ? 0 : 0.45,
            delay:    prefersLess ? 0 : METADATA_DELAY_S,
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
