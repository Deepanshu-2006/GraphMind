import React, { useRef, useCallback, useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform, useReducedMotion } from 'framer-motion';

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
/* Precomputed Stroke Items with Continuous Bidirectional Wave Parameters   */
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
  isBaseline: boolean;
  startP: number;
  endP: number;
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
      const isBaseline = y2 === Y_BASE;

      const normX = (x - MIN_X) / (MAX_X - MIN_X);
      const normH = targetHeight / (Y_BASE - Y_TOP);
      const jitter = getDeterministicJitter(x, colIdx, segIdx);

      // Continuous overlapping wave across G -> R -> A -> P -> H
      const startP = 0.06 + normX * 0.54 + (1 - normH) * 0.03 + jitter * 0.02 + (isBaseline ? 0 : 0.025);
      const strokeWindow = 0.28 + normH * 0.04;
      const endP = startP + strokeWindow;

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
        isBaseline,
        startP,
        endP,
      };

      LETTER_STROKES[letterIdx].push(item);
      ALL_STROKES.push(item);
    });
  }
});

interface LineBinding {
  el: SVGLineElement;
  y2: number;
  targetHeight: number;
  isBaseline: boolean;
  startP: number;
  endP: number;
}

function getScrollMetrics(container: HTMLElement | null, footerEl: HTMLElement | null): number {
  let scrollTop = 0;
  let scrollHeight = 0;
  let clientHeight = 0;

  if (container) {
    scrollTop = container.scrollTop;
    scrollHeight = container.scrollHeight;
    clientHeight = container.clientHeight;
  } else {
    scrollTop = window.scrollY || document.documentElement.scrollTop;
    scrollHeight = document.documentElement.scrollHeight;
    clientHeight = window.innerHeight;
  }

  const maxScroll = Math.max(0, scrollHeight - clientHeight);
  if (maxScroll <= 0) return 1;

  const footerH = footerEl ? footerEl.offsetHeight : 420;
  // Dedicated travel range for footer reveal
  const travel = Math.min(maxScroll, Math.max(340, footerH + 60));
  const startScroll = Math.max(0, maxScroll - travel);

  if (scrollTop <= startScroll) return 0;
  if (scrollTop >= maxScroll) return 1;

  return (scrollTop - startScroll) / (maxScroll - startScroll);
}

interface FooterSectionProps {
  onUploadMaterial?: () => void;
}

export const FooterSection: React.FC<FooterSectionProps> = ({ onUploadMaterial }) => {
  const sectionRef       = useRef<HTMLElement>(null);
  const svgRef           = useRef<SVGSVGElement>(null);
  const wordmarkGroupRef = useRef<SVGGElement>(null);
  const lineBindingsRef  = useRef<LineBinding[] | null>(null);

  const prefersLess = useReducedMotion();
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Single normalized progress value: 0 (unrevealed) -> 1 (fully revealed)
  const footerProgress = useMotionValue(0);

  // Baseline: scaleX 0 -> 1 over progress 0.00 -> 0.14 (retracts toward center on reverse)
  const baselineScaleX = useTransform(footerProgress, [0, 0.14], [0, 1]);

  // Top metadata: quiet opacity 0.45 -> 1.0
  const topOpacity = useTransform(footerProgress, [0, 1], [0.45, 1.0]);

  // Structural settle: subtle 1px mechanical lock near completion (reversible)
  const wordmarkY = useTransform(
    footerProgress,
    [0, 0.85, 0.93, 1.0],
    ['0px', '0px', '-1px', '0px']
  );

  // Bottom rule: scaleX 0 -> 1 over progress 0.80 -> 0.96
  const bottomRuleScaleX = useTransform(footerProgress, [0.80, 0.96], [0, 1]);

  // Bottom metadata: opacity 0 -> 1, translateY 6px -> 0px over progress 0.84 -> 1.0
  const bottomOpacity = useTransform(footerProgress, [0.84, 1.0], [0, 1]);
  const bottomY = useTransform(footerProgress, [0.84, 1.0], [6, 0]);

  // Direct high-performance DOM update function (pure function of progress)
  const updateStrokes = useCallback((p: number) => {
    const bindings = lineBindingsRef.current;
    if (!bindings) return;
    const len = bindings.length;

    for (let i = 0; i < len; i++) {
      const b = bindings[i];
      if (p <= b.startP) {
        if (b.isBaseline) {
          b.el.setAttribute('y1', String(b.y2 - 2));
          b.el.style.opacity = '0.06';
        } else {
          b.el.setAttribute('y1', String(b.y2));
          b.el.style.opacity = '0';
        }
      } else if (p >= b.endP) {
        b.el.setAttribute('y1', String(b.y2 - b.targetHeight));
        b.el.style.opacity = '1';
      } else {
        const u = (p - b.startP) / (b.endP - b.startP);
        // Smoothstep curve: zero derivative at start and end for seamless physical feel
        const t = u * u * (3 - 2 * u);
        const h = b.targetHeight * t;
        b.el.setAttribute('y1', String(b.y2 - h));
        b.el.style.opacity = b.isBaseline ? String(0.06 + 0.94 * t) : String(t);
      }
    }
  }, []);

  // Subscribe to footerProgress MotionValue without causing React re-renders
  useEffect(() => {
    if (prefersLess) return;
    const unsubscribe = footerProgress.on('change', (latestProgress) => {
      updateStrokes(latestProgress);
    });
    return unsubscribe;
  }, [footerProgress, updateStrokes, prefersLess]);

  // Scroll listener: directly controls footerProgress based on scroll position
  useEffect(() => {
    if (prefersLess) {
      footerProgress.set(1);
      return;
    }

    const scrollContainer = sectionRef.current?.closest('.workspace-viewport') as HTMLElement | null;
    const scrollTarget = scrollContainer || window;

    // Cache line element references once on mount for ultra-fast scrubbing
    const lines = svgRef.current?.querySelectorAll<SVGLineElement>('.gmf-stroke-line');
    if (lines && lines.length === ALL_STROKES.length) {
      lineBindingsRef.current = ALL_STROKES.map((s, idx) => ({
        el: lines[idx],
        y2: s.y2,
        targetHeight: s.targetHeight,
        isBaseline: s.isBaseline,
        startP: s.startP,
        endP: s.endP,
      }));
    }

    let rafId: number | null = null;
    const onScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const p = getScrollMetrics(scrollContainer, sectionRef.current);
        footerProgress.set(p);
      });
    };

    // Initial check
    onScroll();

    scrollTarget.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      scrollTarget.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [footerProgress, prefersLess]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    // Only activate letter hover when wordmark is mostly constructed (progress >= 0.85)
    if (footerProgress.get() < 0.85 && !prefersLess) return;

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
  }, [footerProgress, prefersLess]);

  const handleMouseLeave = useCallback(() => setHoveredIdx(null), []);

  return (
    <footer ref={sectionRef} className="gmf-section" aria-label="GRAPH wordmark footer">

      {/* ── Top metadata row (quiet, minimal, progress-linked) ────────────── */}
      <div className="gmf-top">
        <motion.div
          className="gmf-meta-row"
          style={{
            opacity: prefersLess ? 1 : topOpacity,
          }}
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
          </defs>

          {/* ── Subtle origin baseline beneath GRAPH (scaleX 0 -> 1 reversible) ─ */}
          <motion.line
            x1="70"
            y1={Y_BASE}
            x2="954"
            y2={Y_BASE}
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth={1}
            strokeLinecap="butt"
            vectorEffect="non-scaling-stroke"
            style={{
              scaleX: prefersLess ? 1 : baselineScaleX,
              transformOrigin: '512px 208px',
            }}
          />

          {/* ── Main architectural wordmark group with structural settle ─────── */}
          <motion.g
            ref={wordmarkGroupRef}
            id="gmf-wordmark-group"
            style={{
              y: prefersLess ? '0px' : wordmarkY,
            }}
          >
            {SLOTS.map((slot, letterIdx) => {
              const isHov = hoveredIdx === letterIdx;
              const gradUrl = isHov ? 'url(#arena-hover-gradient)' : 'url(#arena-line-gradient)';
              const strokes = LETTER_STROKES[letterIdx];

              return (
                <g key={slot.char} stroke={gradUrl}>
                  {strokes.map((s) => (
                    <line
                      key={s.key}
                      className="gmf-stroke-line"
                      x1={s.x}
                      y1={prefersLess ? s.y1 : (s.isBaseline ? s.y2 - 2 : s.y2)}
                      x2={s.x}
                      y2={s.y2}
                      strokeWidth={STROKE}
                      strokeLinecap="butt"
                      vectorEffect="non-scaling-stroke"
                      style={{
                        opacity: prefersLess ? 1 : (s.isBaseline ? 0.06 : 0),
                      }}
                    />
                  ))}
                </g>
              );
            })}
          </motion.g>
        </svg>
      </div>

      {/* ── Bottom: rule + copyright / explore (progress-driven) ─────────── */}
      <div className="gmf-bottom">
        <motion.div
          className="gmf-rule"
          aria-hidden="true"
          style={{
            scaleX: prefersLess ? 1 : bottomRuleScaleX,
            transformOrigin: '50% 50%',
          }}
        />
        <motion.div
          className="gmf-meta-row gmf-meta-bottom-row"
          style={{
            opacity: prefersLess ? 1 : bottomOpacity,
            y: prefersLess ? 0 : bottomY,
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
