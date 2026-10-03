import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  useReducedMotion,
  cubicBezier,
  type MotionValue
} from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

/* ==========================================================================
   Editorial Constants: Heading lines for staggered entrance
   ========================================================================== */
export const DESKTOP_TITLE_LINES = [
  'See how your material',
  'becomes connected',
  'knowledge.'
];

export const MOBILE_TITLE_LINES = [
  'See how your',
  'material becomes',
  'connected knowledge.'
];

export const TITLE_LINES = DESKTOP_TITLE_LINES;

/* ==========================================================================
   Data Structures: Core Concepts, Relationships & Editorial Stage Copy
   ========================================================================== */

export interface ConceptDefinition {
  id: string;
  name: string;
  category: string;
  isPrimary?: boolean;
  docX: number;   // normalized (0-1) coordinate over document text position
  docY: number;
  graphX: number; // normalized (0-1) coordinate in knowledge graph space
  graphY: number;
  halfWidth: number;
  halfHeight: number;
}

export interface RelationshipDefinition {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  drawStart: number;
  drawEnd: number;
}

export const KNOWLEDGE_CONCEPTS: ConceptDefinition[] = [
  {
    id: 'c1',
    name: 'Neural Networks',
    category: 'Architecture',
    isPrimary: true,
    docX: 0.28,
    docY: 0.38,
    graphX: 0.58,
    graphY: 0.28,
    halfWidth: 64,
    halfHeight: 15
  },
  {
    id: 'c2',
    name: 'Activation Functions',
    category: 'Function',
    isPrimary: false,
    docX: 0.70,
    docY: 0.42,
    graphX: 0.32,
    graphY: 0.55,
    halfWidth: 72,
    halfHeight: 15
  },
  {
    id: 'c3',
    name: 'Backpropagation',
    category: 'Optimization',
    isPrimary: false,
    docX: 0.36,
    docY: 0.58,
    graphX: 0.72,
    graphY: 0.55,
    halfWidth: 64,
    halfHeight: 15
  },
  {
    id: 'c4',
    name: 'Gradient Descent',
    category: 'Algorithm',
    isPrimary: false,
    docX: 0.68,
    docY: 0.64,
    graphX: 0.72,
    graphY: 0.80,
    halfWidth: 62,
    halfHeight: 15
  }
];

export const KNOWLEDGE_RELATIONSHIPS: RelationshipDefinition[] = [
  {
    id: 'r1',
    sourceId: 'c1',
    targetId: 'c2',
    label: 'uses',
    drawStart: 0.58,
    drawEnd: 0.68
  },
  {
    id: 'r2',
    sourceId: 'c1',
    targetId: 'c3',
    label: 'trained with',
    drawStart: 0.64,
    drawEnd: 0.74
  },
  {
    id: 'r3',
    sourceId: 'c3',
    targetId: 'c4',
    label: 'optimizes',
    drawStart: 0.70,
    drawEnd: 0.80
  }
];

export const EDITORIAL_STAGES = [
  {
    code: '01',
    step: '01 / 04',
    name: 'READ',
    tagline: 'Start with what you already have.',
    desc: 'GraphMind begins with your study material and turns it into something you can explore.'
  },
  {
    code: '02',
    step: '02 / 04',
    name: 'FIND',
    tagline: 'Find what matters.',
    desc: 'GraphMind identifies the meaningful concepts inside your material.'
  },
  {
    code: '03',
    step: '03 / 04',
    name: 'CONNECT',
    tagline: 'See how ideas relate.',
    desc: 'Concepts are connected through the relationships that give the material its structure.'
  },
  {
    code: '04',
    step: '04 / 04',
    name: 'EXPLORE',
    tagline: "Explore what you've built.",
    desc: 'Your material becomes a connected map you can navigate and understand.'
  }
];

/* ==========================================================================
   Editorial Stage Transition Definitions & Contextual Stage Card
   ========================================================================== */

// Refined easing curve: calm, editorial deceleration without overshoot or bounce
const EDITORIAL_EASE = cubicBezier(0.25, 0.1, 0.25, 1);

// Gold-standard fluid deceleration curve: crisp initial momentum, buttery dead-stop
const REVEAL_EASE = [0.16, 1, 0.3, 1] as const;

interface StageTransitionRange {
  enter: [number, number] | null;
  exit: [number, number] | null;
}

const STAGE_TRANSITION_RANGES: StageTransitionRange[] = [
  {
    // Stage 0: 01 READ
    enter: null,
    exit: [0.24, 0.34]
  },
  {
    // Stage 1: 02 FIND
    enter: [0.24, 0.34],
    exit: [0.49, 0.59]
  },
  {
    // Stage 2: 03 CONNECT
    enter: [0.49, 0.59],
    exit: [0.74, 0.84]
  },
  {
    // Stage 3: 04 EXPLORE
    enter: [0.74, 0.84],
    exit: null
  }
];

function interpolateSublayer(
  p: number,
  enterWindow: [number, number] | null,
  exitWindow: [number, number] | null,
  inY: number,
  outY: number,
  shouldReduceMotion: boolean | null,
  easeFn: (t: number) => number
): { y: number; opacity: number } {
  // If element has an entrance transition (stages 1, 2, 3)
  if (enterWindow) {
    const [e0, e1] = enterWindow;
    if (p <= e0) {
      return { y: shouldReduceMotion ? 0 : inY, opacity: 0 };
    }
    if (p < e1) {
      const rawT = (p - e0) / (e1 - e0);
      const factor = easeFn(Math.max(0, Math.min(1, rawT)));
      return {
        y: shouldReduceMotion ? 0 : inY * (1 - factor),
        opacity: factor
      };
    }
  }

  // If element is before its exit (or stage 0 before exit)
  if (exitWindow) {
    const [x0, x1] = exitWindow;
    if (p <= x0) {
      return { y: 0, opacity: 1 };
    }
    if (p < x1) {
      const rawT = (p - x0) / (x1 - x0);
      const factor = easeFn(Math.max(0, Math.min(1, rawT)));
      return {
        y: shouldReduceMotion ? 0 : outY * factor,
        opacity: 1 - factor
      };
    }
    return { y: shouldReduceMotion ? 0 : outY, opacity: 0 };
  }

  // Fully active plateau (or stage 3 settled)
  return { y: 0, opacity: 1 };
}

function isStageVisible(p: number, index: number): boolean {
  if (index === 0) return p < 0.34;
  if (index === 1) return p > 0.239 && p < 0.59;
  if (index === 2) return p > 0.489 && p < 0.84;
  if (index === 3) return p > 0.739;
  return false;
}

interface ContextualStageCardProps {
  stage: (typeof EDITORIAL_STAGES)[0];
  index: number;
  progress: MotionValue<number>;
  activeStageIndex: number;
  shouldReduceMotion: boolean | null;
  hasEntered: boolean;
  onExploreWorkspace: () => void;
}

const ContextualStageCard: React.FC<ContextualStageCardProps> = ({
  stage,
  index,
  progress,
  activeStageIndex,
  shouldReduceMotion,
  hasEntered,
  onExploreWorkspace
}) => {
  const range = STAGE_TRANSITION_RANGES[index];

  // Micro-staggered sublayer ranges within 0.10 window:
  // 1. Stage label: delay 0ms (starts at W0)
  const labelEnter: [number, number] | null = range.enter
    ? [range.enter[0], range.enter[0] + 0.080]
    : null;
  const labelExit: [number, number] | null = range.exit
    ? [range.exit[0], range.exit[0] + 0.080]
    : null;

  // 2. Heading: delay ~30ms (progress offset 0.008)
  const headingEnter: [number, number] | null = range.enter
    ? [range.enter[0] + 0.008, range.enter[0] + 0.088]
    : null;
  const headingExit: [number, number] | null = range.exit
    ? [range.exit[0] + 0.008, range.exit[0] + 0.088]
    : null;

  // 3. Paragraph: delay ~60ms (progress offset 0.016)
  const descEnter: [number, number] | null = range.enter
    ? [range.enter[0] + 0.016, range.enter[0] + 0.096]
    : null;
  const descExit: [number, number] | null = range.exit
    ? [range.exit[0] + 0.016, range.exit[0] + 0.096]
    : null;

  // 4. CTA Button (stage 3): delay ~60ms
  const ctaEnter: [number, number] | null = range.enter
    ? [range.enter[0] + 0.020, range.enter[0] + 0.100]
    : null;

  const cardVisibility = useTransform(progress, (p) =>
    isStageVisible(p, index) ? 'visible' : 'hidden'
  );
  const cardPointerEvents = useTransform(progress, (p) =>
    index === 3 && p >= 0.78 ? 'auto' : 'none'
  );

  const labelY = useTransform(
    progress,
    (p) =>
      interpolateSublayer(p, labelEnter, labelExit, 10, -10, shouldReduceMotion, EDITORIAL_EASE).y
  );
  const labelOpacity = useTransform(
    progress,
    (p) =>
      interpolateSublayer(p, labelEnter, labelExit, 10, -10, shouldReduceMotion, EDITORIAL_EASE).opacity
  );

  const headingY = useTransform(
    progress,
    (p) =>
      interpolateSublayer(p, headingEnter, headingExit, 20, -20, shouldReduceMotion, EDITORIAL_EASE).y
  );
  const headingOpacity = useTransform(
    progress,
    (p) =>
      interpolateSublayer(p, headingEnter, headingExit, 20, -20, shouldReduceMotion, EDITORIAL_EASE).opacity
  );

  const descY = useTransform(
    progress,
    (p) =>
      interpolateSublayer(p, descEnter, descExit, 12, -12, shouldReduceMotion, EDITORIAL_EASE).y
  );
  const descOpacity = useTransform(
    progress,
    (p) =>
      interpolateSublayer(p, descEnter, descExit, 12, -12, shouldReduceMotion, EDITORIAL_EASE).opacity
  );

  const ctaY = useTransform(
    progress,
    (p) =>
      interpolateSublayer(p, ctaEnter, null, 12, -12, shouldReduceMotion, EDITORIAL_EASE).y
  );
  const ctaOpacity = useTransform(
    progress,
    (p) =>
      interpolateSublayer(p, ctaEnter, null, 12, -12, shouldReduceMotion, EDITORIAL_EASE).opacity
  );

  return (
    <motion.div
      className="transformation-context-card"
      style={{
        visibility: cardVisibility,
        pointerEvents: cardPointerEvents
      }}
      aria-hidden={activeStageIndex !== index}
    >
      {index === 0 ? (
        <>
          <div className="transformation-context-clip">
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              animate={
                hasEntered
                  ? { opacity: 1, y: 0 }
                  : shouldReduceMotion
                  ? { opacity: 1, y: 0 }
                  : { opacity: 0, y: 8 }
              }
              transition={{
                duration: shouldReduceMotion ? 0.01 : 0.82,
                delay: shouldReduceMotion ? 0 : 1.02,
                ease: REVEAL_EASE
              }}
            >
              <motion.div
                className="transformation-context-step-row"
                style={{ y: labelY, opacity: labelOpacity }}
              >
                <span className="transformation-context-step">{stage.code}</span>
                <span className="transformation-context-divider">/</span>
                <span className="transformation-context-total">04</span>
                <span className="transformation-context-name">{stage.name}</span>
              </motion.div>
            </motion.div>
          </div>

          <div className="transformation-context-clip">
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              animate={
                hasEntered
                  ? { opacity: 1, y: 0 }
                  : shouldReduceMotion
                  ? { opacity: 1, y: 0 }
                  : { opacity: 0, y: 10 }
              }
              transition={{
                duration: shouldReduceMotion ? 0.01 : 0.90,
                delay: shouldReduceMotion ? 0 : 1.16,
                ease: REVEAL_EASE
              }}
            >
              <motion.h3
                className="transformation-context-tagline"
                style={{ y: headingY, opacity: headingOpacity }}
              >
                {stage.tagline}
              </motion.h3>
            </motion.div>
          </div>

          <div className="transformation-context-clip">
            <motion.div
              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              animate={
                hasEntered
                  ? { opacity: 1, y: 0 }
                  : shouldReduceMotion
                  ? { opacity: 1, y: 0 }
                  : { opacity: 0, y: 8 }
              }
              transition={{
                duration: shouldReduceMotion ? 0.01 : 0.95,
                delay: shouldReduceMotion ? 0 : 1.30,
                ease: REVEAL_EASE
              }}
            >
              <motion.p
                className="transformation-context-desc"
                style={{ y: descY, opacity: descOpacity }}
              >
                {stage.desc}
              </motion.p>
            </motion.div>
          </div>
        </>
      ) : (
        <>
          <motion.div
            className="transformation-context-step-row"
            style={{ y: labelY, opacity: labelOpacity }}
          >
            <span className="transformation-context-step">{stage.code}</span>
            <span className="transformation-context-divider">/</span>
            <span className="transformation-context-total">04</span>
            <span className="transformation-context-name">{stage.name}</span>
          </motion.div>

          <motion.h3
            className="transformation-context-tagline"
            style={{ y: headingY, opacity: headingOpacity }}
          >
            {stage.tagline}
          </motion.h3>

          <motion.p
            className="transformation-context-desc"
            style={{ y: descY, opacity: descOpacity }}
          >
            {stage.desc}
          </motion.p>

          {index === 3 && (
            <motion.button
              type="button"
              className="transformation-cta-link"
              onClick={onExploreWorkspace}
              style={{ y: ctaY, opacity: ctaOpacity }}
            >
              <span>Open workspace</span>
              <ArrowUpRight size={13} aria-hidden="true" />
            </motion.button>
          )}
        </>
      )}
    </motion.div>
  );
};

/* ==========================================================================
   Main Component: FromMaterialToMeaning
   ========================================================================== */

interface FromMaterialToMeaningProps {
  onExploreWorkspace: () => void;
  onUploadMaterial: () => void;
}

export const FromMaterialToMeaning: React.FC<FromMaterialToMeaningProps> = ({
  onExploreWorkspace
}) => {
  const sectionRef = useRef<HTMLElement>(null);
  const scrollProgress = useMotionValue(0);
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const [hasEntered, setHasEntered] = useState(false);
  const [isRestingRead, setIsRestingRead] = useState(true);
  const hasTriggeredRef = useRef(false);

  // ─── Direct Passive Scroll Engine ──────────────────────────────────────────
  // Derives exact progress (0.0 → 1.0) from the document / workspace scroll
  // without wheel interception, body-scroll locking, or per-frame setState.
  useEffect(() => {
    const sectionEl = sectionRef.current;
    if (!sectionEl) return;

    const scrollContainer: HTMLElement | Window =
      (sectionEl.closest('.workspace-viewport') as HTMLElement | null) ||
      (document.querySelector('.workspace-viewport') as HTMLElement | null) ||
      window;

    let rafId: number;

    const handleScroll = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const sEl = sectionRef.current;
        if (!sEl) return;

        // Entrance trigger: Fires once section is scrolled well into visible viewport (deliberate, later start)
        if (!hasTriggeredRef.current) {
          const sRect = sEl.getBoundingClientRect();
          const cHeight =
            scrollContainer instanceof Window
              ? window.innerHeight
              : scrollContainer.clientHeight;
          if (sRect.top <= cHeight * 0.52 && sRect.bottom >= 0) {
            hasTriggeredRef.current = true;
            setHasEntered(true);
          }
        }

        let scrolled = 0;
        let total = 0;

        if (scrollContainer instanceof Window) {
          const sRect = sEl.getBoundingClientRect();
          scrolled = -sRect.top;
          total = sEl.offsetHeight - window.innerHeight;
        } else {
          const sRect = sEl.getBoundingClientRect();
          const cRect = scrollContainer.getBoundingClientRect();
          scrolled = cRect.top - sRect.top;
          total = sEl.offsetHeight - scrollContainer.clientHeight;
        }

        if (total > 0) {
          const p = Math.min(1.0, Math.max(0.0, scrolled / total));
          scrollProgress.set(p);

          const isResting = p < 0.04;
          setIsRestingRead((prev) => (prev !== isResting ? isResting : prev));

          const nextIndex = p >= 0.79 ? 3 : p >= 0.54 ? 2 : p >= 0.29 ? 1 : 0;
          setActiveStageIndex((prev) => (prev !== nextIndex ? nextIndex : prev));
        }
      });
    };

    // IntersectionObserver declarative fallback for viewport entrance
    let observer: IntersectionObserver | null = null;
    const stickyEl = sectionEl.querySelector('.transformation-sticky') || sectionEl;
    try {
      observer = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && !hasTriggeredRef.current) {
            hasTriggeredRef.current = true;
            setHasEntered(true);
            observer?.disconnect();
          }
        },
        {
          root: scrollContainer instanceof HTMLElement ? scrollContainer : null,
          threshold: [0.30, 0.40]
        }
      );
      observer.observe(stickyEl);
    } catch {
      // IntersectionObserver fallback relies on handleScroll
    }

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    handleScroll();

    return () => {
      cancelAnimationFrame(rafId);
      observer?.disconnect();
      scrollContainer.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [scrollProgress]);

  // ─── Click-to-Scroll Stage Navigation ─────────────────────────────────────
  const scrollToStage = useCallback((index: number) => {
    const sEl = sectionRef.current;
    if (!sEl) return;

    const scrollContainer: HTMLElement | Window =
      (sEl.closest('.workspace-viewport') as HTMLElement | null) ||
      (document.querySelector('.workspace-viewport') as HTMLElement | null) ||
      window;

    const targets = [0.06, 0.38, 0.62, 0.88];
    const targetProgress = targets[index] ?? 0;

    if (scrollContainer instanceof Window) {
      const sRect = sEl.getBoundingClientRect();
      const currentScrollTop = window.scrollY;
      const sectionAbsoluteTop = currentScrollTop + sRect.top;
      const total = sEl.offsetHeight - window.innerHeight;
      window.scrollTo({
        top: sectionAbsoluteTop + total * targetProgress,
        behavior: 'smooth'
      });
    } else {
      const sRect = sEl.getBoundingClientRect();
      const cRect = scrollContainer.getBoundingClientRect();
      const sectionOffsetInContainer = scrollContainer.scrollTop + (sRect.top - cRect.top);
      const total = sEl.offsetHeight - scrollContainer.clientHeight;
      scrollContainer.scrollTo({
        top: sectionOffsetInContainer + total * targetProgress,
        behavior: 'smooth'
      });
    }
  }, []);

  // ─── Active concept in settled explore state ──────────────────────────────
  // Retains stable focal concept during CONNECT & EXPLORE; smoothly updates on hover without jitter
  const [focalConceptId, setFocalConceptId] = useState<string>('c1');

  const effectiveFocalId = useMemo(() => {
    if (activeStageIndex < 2) return null;
    return focalConceptId;
  }, [activeStageIndex, focalConceptId]);

  const activeNeighbors = useMemo(() => {
    if (!effectiveFocalId) return new Set<string>();
    const neighbors = new Set<string>([effectiveFocalId]);
    KNOWLEDGE_RELATIONSHIPS.forEach((rel) => {
      if (rel.sourceId === effectiveFocalId) neighbors.add(rel.targetId);
      if (rel.targetId === effectiveFocalId) neighbors.add(rel.sourceId);
    });
    return neighbors;
  }, [effectiveFocalId]);

  const handleHoverConcept = useCallback((id: string) => {
    setFocalConceptId(id);
  }, []);

  const handleLeaveGraph = useCallback(() => {
    setFocalConceptId('c1');
  }, []);

  const currentStage = EDITORIAL_STAGES[activeStageIndex];

  return (
    <section
      ref={sectionRef}
      className="transformation-scroll"
      aria-label="From Material to Meaning — Interactive Transformation"
    >
      <div className="transformation-sticky">
        {/* Subtle background ambient dot grid */}
        <motion.div
          className="transformation-ambience-canvas"
          aria-hidden="true"
          initial={{ opacity: 0 }}
          animate={hasEntered ? { opacity: 0.14 } : { opacity: 0 }}
          transition={{ duration: 1.6, ease: 'easeOut' }}
        />

        {/* Underlying architectural calibration layout grid */}
        <div className="transformation-grid-scaffold" aria-hidden="true">
          <motion.div
            className="transformation-grid-line horizontal-header"
            initial={shouldReduceMotion ? { opacity: 0.07, scaleX: 1 } : { opacity: 0, scaleX: 0 }}
            animate={
              hasEntered
                ? { opacity: 0.07, scaleX: 1 }
                : shouldReduceMotion
                ? { opacity: 0.07, scaleX: 1 }
                : { opacity: 0, scaleX: 0 }
            }
            transition={{
              duration: shouldReduceMotion ? 0.01 : 1.35,
              delay: 0.16,
              ease: REVEAL_EASE
            }}
          />
          <motion.div
            className="transformation-grid-line horizontal-bottom"
            initial={shouldReduceMotion ? { opacity: 0.06, scaleX: 1 } : { opacity: 0, scaleX: 0 }}
            animate={
              hasEntered
                ? { opacity: 0.06, scaleX: 1 }
                : shouldReduceMotion
                ? { opacity: 0.06, scaleX: 1 }
                : { opacity: 0, scaleX: 0 }
            }
            transition={{
              duration: shouldReduceMotion ? 0.01 : 1.35,
              delay: 0.28,
              ease: REVEAL_EASE
            }}
          />
        </div>

        {/* 1. Header: Eyebrow + Editorial Statement */}
        <header className="transformation-header">
          <div className="transformation-eyebrow">
            <motion.span
              className="transformation-eyebrow-dot"
              aria-hidden="true"
              initial={shouldReduceMotion ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0 }}
              animate={
                hasEntered
                  ? { opacity: 1, scale: 1 }
                  : shouldReduceMotion
                  ? { opacity: 1, scale: 1 }
                  : { opacity: 0, scale: 0 }
              }
              transition={{
                duration: shouldReduceMotion ? 0.01 : 0.65,
                delay: shouldReduceMotion ? 0 : 0.28,
                ease: REVEAL_EASE
              }}
            />
            <motion.span
              className="transformation-eyebrow-text"
              initial={
                shouldReduceMotion
                  ? { opacity: 1, y: 0, letterSpacing: '0.22em' }
                  : { opacity: 0, y: -6, letterSpacing: '0.28em' }
              }
              animate={
                hasEntered
                  ? { opacity: 1, y: 0, letterSpacing: '0.22em' }
                  : shouldReduceMotion
                  ? { opacity: 1, y: 0, letterSpacing: '0.22em' }
                  : { opacity: 0, y: -6, letterSpacing: '0.28em' }
              }
              transition={{
                duration: shouldReduceMotion ? 0.01 : 0.90,
                delay: shouldReduceMotion ? 0 : 0.36,
                ease: REVEAL_EASE
              }}
            >
              From Material to Meaning
            </motion.span>
          </div>
          <h2
            className="transformation-title"
            aria-label="See how your material becomes connected knowledge."
          >
            {/* Desktop & Tablet: Deliberate 3-line composition */}
            <span className="transformation-title-desktop" aria-hidden="true">
              {DESKTOP_TITLE_LINES.map((line, idx) => {
                const horizontalOffsets = [-8, 6, -4];
                const xOffset = horizontalOffsets[idx] ?? 0;
                const delays = [0.48, 0.70, 0.92];
                const delay = delays[idx] ?? 0.48;

                return (
                  <span
                    key={idx}
                    className={`transformation-title-line-mask line-${idx + 1}${
                      idx === 2 ? ' line-destination' : ''
                    }`}
                  >
                    <motion.span
                      className="transformation-title-line"
                      initial={
                        shouldReduceMotion
                          ? { opacity: 1, y: 0, x: 0 }
                          : { opacity: 0, y: 36, x: xOffset }
                      }
                      animate={
                        hasEntered
                          ? { opacity: 1, y: 0, x: 0 }
                          : shouldReduceMotion
                          ? { opacity: 1, y: 0, x: 0 }
                          : { opacity: 0, y: 36, x: xOffset }
                      }
                      transition={{
                        duration: shouldReduceMotion ? 0.01 : idx === 2 ? 1.35 : 1.20,
                        delay: shouldReduceMotion ? 0 : delay,
                        ease: REVEAL_EASE
                      }}
                    >
                      {line}
                    </motion.span>
                  </span>
                );
              })}
            </span>

            {/* Mobile: Intentional 3-line composition */}
            <span className="transformation-title-mobile" aria-hidden="true">
              {MOBILE_TITLE_LINES.map((line, idx) => {
                const horizontalOffsets = [-6, 5, -3];
                const xOffset = horizontalOffsets[idx] ?? 0;
                const delays = [0.48, 0.70, 0.92];
                const delay = delays[idx] ?? 0.48;

                return (
                  <span
                    key={idx}
                    className={`transformation-title-line-mask line-${idx + 1}${
                      idx === 2 ? ' line-destination' : ''
                    }`}
                  >
                    <motion.span
                      className="transformation-title-line"
                      initial={
                        shouldReduceMotion
                          ? { opacity: 1, y: 0, x: 0 }
                          : { opacity: 0, y: 30, x: xOffset }
                      }
                      animate={
                        hasEntered
                          ? { opacity: 1, y: 0, x: 0 }
                          : shouldReduceMotion
                          ? { opacity: 1, y: 0, x: 0 }
                          : { opacity: 0, y: 30, x: xOffset }
                      }
                      transition={{
                        duration: shouldReduceMotion ? 0.01 : 1.20,
                        delay: shouldReduceMotion ? 0 : delay,
                        ease: REVEAL_EASE
                      }}
                    >
                      {line}
                    </motion.span>
                  </span>
                );
              })}
            </span>
          </h2>
        </header>

        {/* 2. Main 3-Column Composition */}
        <div className="transformation-body">
          {/* Left Navigation: Process Index */}
          <nav className="transformation-nav" aria-label="Process stages">
            <ul className="transformation-nav-list" role="list">
              {EDITORIAL_STAGES.map((s, i) => (
                <motion.li
                  key={s.code}
                  className={[
                    'transformation-nav-item',
                    activeStageIndex === i ? 'active' : '',
                    activeStageIndex > i ? 'passed' : ''
                  ].join(' ')}
                  initial={shouldReduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -12 }}
                  animate={
                    hasEntered
                      ? { opacity: 1, x: 0 }
                      : shouldReduceMotion
                      ? { opacity: 1, x: 0 }
                      : { opacity: 0, x: -12 }
                  }
                  transition={{
                    duration: shouldReduceMotion ? 0.01 : 0.88,
                    delay: shouldReduceMotion ? 0 : 0.88 + i * 0.12,
                    ease: REVEAL_EASE
                  }}
                  onClick={() => scrollToStage(i)}
                  role="button"
                  tabIndex={0}
                  aria-label={`Jump to stage ${s.code}: ${s.name}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      scrollToStage(i);
                    }
                  }}
                >
                  <span className="transformation-nav-marker" aria-hidden="true">
                    {i === 0 ? (
                      <motion.span
                        className="transformation-nav-dot active-marker"
                        initial={
                          shouldReduceMotion
                            ? { opacity: 1, scaleY: 1 }
                            : { opacity: 0, scaleY: 0.25, scaleX: 0.6 }
                        }
                        animate={
                          hasEntered
                            ? { opacity: 1, scaleY: 1, scaleX: 1 }
                            : shouldReduceMotion
                            ? { opacity: 1, scaleY: 1 }
                            : { opacity: 0, scaleY: 0.25, scaleX: 0.6 }
                        }
                        transition={{
                          duration: shouldReduceMotion ? 0.01 : 0.70,
                          delay: shouldReduceMotion ? 0 : 0.88,
                          ease: REVEAL_EASE
                        }}
                      />
                    ) : (
                      <motion.span
                        className="transformation-nav-dot"
                        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.4 }}
                        animate={
                          hasEntered
                            ? { opacity: 1, scale: 1 }
                            : shouldReduceMotion
                            ? { opacity: 1 }
                            : { opacity: 0, scale: 0.4 }
                        }
                        transition={{
                          duration: shouldReduceMotion ? 0.01 : 0.55,
                          delay: shouldReduceMotion ? 0 : 0.88 + i * 0.12,
                          ease: 'easeOut'
                        }}
                      />
                    )}
                  </span>
                  <span className="transformation-nav-code">{s.code}</span>
                  <span className="transformation-nav-label">{s.name}</span>
                </motion.li>
              ))}
            </ul>
          </nav>

          {/* Center Stage: The Single Persistent Transforming Visual System */}
          <motion.div
            className="transformation-center-stage"
            initial={
              shouldReduceMotion
                ? { opacity: 1, y: 0, scale: 1 }
                : { opacity: 0, y: 28, scale: 0.98 }
            }
            animate={
              hasEntered
                ? { opacity: 1, y: 0, scale: 1 }
                : shouldReduceMotion
                ? { opacity: 1, y: 0, scale: 1 }
                : { opacity: 0, y: 28, scale: 0.98 }
            }
            transition={{
              duration: shouldReduceMotion ? 0.01 : 1.40,
              delay: shouldReduceMotion ? 0 : 0.82,
              ease: REVEAL_EASE
            }}
            style={{ transformStyle: 'preserve-3d' }}
          >
            <KnowledgeTransformationVisual
              progress={scrollProgress}
              effectiveFocalId={effectiveFocalId}
              activeNeighbors={activeNeighbors}
              onHoverConcept={handleHoverConcept}
              onLeaveGraph={handleLeaveGraph}
              isRestingRead={isRestingRead && hasEntered}
              hasEntered={hasEntered}
              shouldReduceMotion={shouldReduceMotion}
            />
          </motion.div>

          {/* Right Column: Contextual Stage Explanation */}
          <motion.aside
            className="transformation-context"
            aria-live="polite"
            initial={
              shouldReduceMotion
                ? { opacity: 1, x: 0 }
                : { opacity: 0, x: 16 }
            }
            animate={
              hasEntered
                ? { opacity: 1, x: 0 }
                : shouldReduceMotion
                ? { opacity: 1, x: 0 }
                : { opacity: 0, x: 16 }
            }
            transition={{
              duration: shouldReduceMotion ? 0.01 : 1.00,
              delay: shouldReduceMotion ? 0 : 0.98,
              ease: REVEAL_EASE
            }}
          >
            <div className="transformation-context-stack">
              {EDITORIAL_STAGES.map((stage, index) => (
                <ContextualStageCard
                  key={stage.code}
                  stage={stage}
                  index={index}
                  progress={scrollProgress}
                  activeStageIndex={activeStageIndex}
                  shouldReduceMotion={shouldReduceMotion}
                  hasEntered={hasEntered}
                  onExploreWorkspace={onExploreWorkspace}
                />
              ))}
            </div>
          </motion.aside>
        </div>

        {/* 3. Bottom Bar: GraphMind Pipeline Progress */}
        <motion.footer
          className="transformation-pipeline"
          aria-hidden="true"
          initial={
            shouldReduceMotion
              ? { opacity: 1, scaleX: 1 }
              : { opacity: 0, scaleX: 0, transformOrigin: '0% 50%' }
          }
          animate={
            hasEntered
              ? { opacity: 1, scaleX: 1, transformOrigin: '0% 50%' }
              : shouldReduceMotion
              ? { opacity: 1, scaleX: 1 }
              : { opacity: 0, scaleX: 0, transformOrigin: '0% 50%' }
          }
          transition={{
            duration: shouldReduceMotion ? 0.01 : 1.15,
            delay: shouldReduceMotion ? 0 : 1.12,
            ease: REVEAL_EASE
          }}
        >
          <motion.span
            className="transformation-pipeline-tag"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -6 }}
            animate={
              hasEntered
                ? { opacity: 1, x: 0 }
                : shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 0, x: -6 }
            }
            transition={{
              duration: shouldReduceMotion ? 0.01 : 0.75,
              delay: shouldReduceMotion ? 0 : 1.24,
              ease: REVEAL_EASE
            }}
          >
            GraphMind Pipeline
          </motion.span>
          <PipelineProgressTrack progress={scrollProgress} activeIndex={activeStageIndex} />
          <motion.span
            className="transformation-pipeline-counter"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={
              hasEntered ? { opacity: 1 } : shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }
            }
            transition={{
              duration: shouldReduceMotion ? 0.01 : 0.70,
              delay: shouldReduceMotion ? 0 : 1.36,
              ease: REVEAL_EASE
            }}
          >
            {currentStage.step}
          </motion.span>
        </motion.footer>
      </div>
    </section>
  );
};

/* ==========================================================================
   KnowledgeTransformationVisual
   ONE continuous visual system. All visual layers share the same 3D scene
   and coordinate space. Elements physically detach and transform.
   ========================================================================== */

interface KnowledgeTransformationVisualProps {
  progress: MotionValue<number>;
  effectiveFocalId: string | null;
  activeNeighbors: Set<string>;
  onHoverConcept: (id: string) => void;
  onLeaveGraph: () => void;
  isRestingRead?: boolean;
  hasEntered?: boolean;
  shouldReduceMotion?: boolean | null;
}

const KnowledgeTransformationVisual: React.FC<KnowledgeTransformationVisualProps> = ({
  progress,
  effectiveFocalId,
  activeNeighbors,
  onHoverConcept,
  onLeaveGraph,
  isRestingRead = true,
  hasEntered = false,
  shouldReduceMotion = false
}) => {
  // ─── Layer 1 & 2: Document Transforms ──────────────────────────────────────
  // READ (0.00-0.25): 100% stable reading surface, responds subtly as reading progresses
  // FIND (0.25-0.50): 85% opacity, terms highlight and lift
  // CONNECT (0.50-0.75): 35% opacity, edges draw
  // EXPLORE (0.75-1.00): 10% -> 8% opacity, graph settled in foreground
  const docOpacity = useTransform(
    progress,
    [0.0, 0.06, 0.25, 0.50, 0.75, 1.0],
    [1.0, 1.0, 0.85, 0.35, 0.10, 0.08]
  );

  // Subtle focus magnification during reading, then recedes into depth
  const docScale = useTransform(
    progress,
    [0.0, 0.05, 0.24, 0.48, 0.72, 0.90],
    [1.0, 1.0, 1.014, 0.99, 0.90, 0.86]
  );

  const docTranslateZ = useTransform(
    progress,
    [0.0, 0.05, 0.24, 0.48, 0.72, 0.90],
    [0, 0, 6, 0, -28, -44]
  );

  const docTranslateY = useTransform(
    progress,
    [0.0, 0.05, 0.24, 0.48],
    [0, 0, -5, -8]
  );

  const docBlur = useTransform(
    progress,
    [0.50, 0.75, 0.90],
    ['blur(0px)', 'blur(1.5px)', 'blur(2px)']
  );

  // Graph expands subtly as document recedes
  const graphScale = useTransform(progress, [0.35, 0.65, 1.0], [0.92, 1.0, 1.06]);

  // Document body text dimming only AFTER terms are highlighted and cards emerge
  const bodyTextDim = useTransform(progress, [0.44, 0.58], [1.0, 0.35]);

  // Scanline sweeping during READ (0.05 -> 0.22)
  const scanlineTop = useTransform(progress, [0.05, 0.22], [0, 100]);
  const scanlineOpacity = useTransform(
    progress,
    [0.0, 0.05, 0.20, 0.25],
    [0, 0.65, 0.65, 0]
  );

  // Highlighting and luminous underlining of terms inside document text
  const hlTerm1 = useTransform(progress, [0.22, 0.29], [0, 1]);
  const hlTerm2 = useTransform(progress, [0.26, 0.33], [0, 1]);
  const hlTerm3 = useTransform(progress, [0.30, 0.37], [0, 1]);
  const hlTerm4 = useTransform(progress, [0.34, 0.41], [0, 1]);

  // Lift progress: hands off from inline highlighted text to floating concept token
  const liftProgress = useTransform(progress, [0.44, 0.52], [0, 1]);

  const term1Ref = useRef<HTMLSpanElement>(null);
  const term2Ref = useRef<HTMLSpanElement>(null);
  const term3Ref = useRef<HTMLSpanElement>(null);
  const term4Ref = useRef<HTMLSpanElement>(null);

  const stageRef = useRef<HTMLDivElement>(null);
  const [stageDims, setStageDims] = useState({ width: 680, height: 460 });
  const [docPositions, setDocPositions] = useState<
    Record<string, { docX: number; docY: number }>
  >({});

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const updateDimsAndPositions = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setStageDims({ width: rect.width, height: rect.height });

        const termRefs = [term1Ref, term2Ref, term3Ref, term4Ref];
        const newPos: Record<string, { docX: number; docY: number }> = {};
        termRefs.forEach((tRef, idx) => {
          const tEl = tRef.current;
          if (tEl) {
            const tRect = tEl.getBoundingClientRect();
            const cx = tRect.left + tRect.width / 2 - rect.left;
            const cy = tRect.top + tRect.height / 2 - rect.top;
            newPos[KNOWLEDGE_CONCEPTS[idx].id] = {
              docX: cx / rect.width,
              docY: cy / rect.height
            };
          }
        });
        if (Object.keys(newPos).length === 4) {
          setDocPositions(newPos);
        }
      }
    };
    updateDimsAndPositions();
    const ro = new ResizeObserver(updateDimsAndPositions);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="ktv-viewport">
      <div className={['ktv-scene', isRestingRead ? 'ambient-active' : ''].join(' ')}>
        {/* Layer 1: Tactile Depth Underplate (Shadow / Thickness Slab) */}
        <motion.div
          className="ktv-underplate"
          style={{
            opacity: docOpacity,
            scale: docScale,
            y: docTranslateY
          }}
          aria-hidden="true"
        />

        {/* Layer 2: Primary Study Material Surface */}
        <motion.div
          className="ktv-material-surface"
          style={{
            opacity: docOpacity,
            scale: docScale,
            translateZ: docTranslateZ,
            y: docTranslateY,
            filter: docBlur
          }}
        >
          {/* Active reading scanline */}
          <motion.div
            className="ktv-scanline"
            style={{
              top: useTransform(scanlineTop, (v) => `${v}%`),
              opacity: scanlineOpacity
            }}
            aria-hidden="true"
          />

          {/* Initial assembly reading-line progression sweep */}
          <motion.div
            className="ktv-entrance-scanline"
            initial={{ top: '0%', opacity: 0 }}
            animate={
              hasEntered && !shouldReduceMotion
                ? { top: ['0%', '100%'], opacity: [0, 0.24, 0.16, 0] }
                : { top: '0%', opacity: 0 }
            }
            transition={{
              duration: 1.35,
              delay: 1.35,
              ease: REVEAL_EASE
            }}
            aria-hidden="true"
          />

          {/* Editorial study material source header */}
          <div className="ktv-doc-meta">
            <div className="ktv-doc-source-info">
              <span className="ktv-doc-source-institution">CS229 · MACHINE LEARNING</span>
              <span className="ktv-doc-source-divider" aria-hidden="true">·</span>
              <span className="ktv-doc-source-topic">AUTUMN 2024</span>
            </div>
            <span className="ktv-doc-folio">FOLIO 04 / 12</span>
          </div>

          {/* Editorial reading column with deliberate negative space */}
          <div className="ktv-doc-content">
            <div className="ktv-doc-heading-wrap">
              <h3 className="ktv-doc-heading">
                <span className="ktv-doc-kicker">Neural Networks</span>
                Representation Learning &amp; Optimization
              </h3>
            </div>
            <motion.p className="ktv-doc-paragraph primary" style={{ opacity: bodyTextDim }}>
              <InlineHighlightTerm
                ref={term1Ref}
                text="Neural Networks"
                highlight={hlTerm1}
                liftProgress={liftProgress}
              /> consist of
              stacked parameter layers transforming inputs through non-linear{' '}
              <InlineHighlightTerm
                ref={term2Ref}
                text="Activation Functions"
                highlight={hlTerm2}
                liftProgress={liftProgress}
              /> to isolate
              continuous representations across high-dimensional manifolds.
            </motion.p>
            <motion.p className="ktv-doc-paragraph secondary" style={{ opacity: bodyTextDim }}>
              During learning, error gradients flow backward via{' '}
              <InlineHighlightTerm
                ref={term3Ref}
                text="Backpropagation"
                highlight={hlTerm3}
                liftProgress={liftProgress}
              />. The objective loss
              is iteratively minimized by{' '}
              <InlineHighlightTerm
                ref={term4Ref}
                text="Gradient Descent"
                highlight={hlTerm4}
                liftProgress={liftProgress}
              /> across parameter
              space.
            </motion.p>
          </div>
        </motion.div>

        {/* Central Graph Canvas: Unified system (EdgeLayer -> LabelLayer -> NodeLayer) */}
        <motion.div
          ref={stageRef}
          className="graph-stage"
          style={{ scale: graphScale }}
          onMouseLeave={onLeaveGraph}
        >
          {/* Layer 1: Edge Layer (Behind nodes) */}
          <svg
            className="graph-edges"
            viewBox={`0 0 ${stageDims.width} ${stageDims.height}`}
            aria-hidden="true"
          >
            {KNOWLEDGE_RELATIONSHIPS.map((rel) => (
              <AnimatedRelationshipEdge
                key={rel.id}
                relationship={rel}
                concepts={KNOWLEDGE_CONCEPTS}
                progress={progress}
                stageDims={stageDims}
                effectiveFocalId={effectiveFocalId}
                docPositions={docPositions}
              />
            ))}
          </svg>

          {/* Layer 2: Relationship Label Layer (Between edges and nodes) */}
          <div className="graph-labels" aria-hidden="true">
            {KNOWLEDGE_RELATIONSHIPS.map((rel) => (
              <AnimatedRelationshipLabel
                key={rel.id}
                relationship={rel}
                concepts={KNOWLEDGE_CONCEPTS}
                progress={progress}
                stageDims={stageDims}
                effectiveFocalId={effectiveFocalId}
                docPositions={docPositions}
              />
            ))}
          </div>

          {/* Layer 3: Node Layer (Cleanly sits above edges and labels) */}
          <div className="graph-nodes" aria-label="Knowledge concepts">
            {KNOWLEDGE_CONCEPTS.map((concept) => (
              <AnimatedConceptNode
                key={concept.id}
                concept={concept}
                progress={progress}
                stageDims={stageDims}
                isFocal={effectiveFocalId === concept.id}
                isDimmed={
                  effectiveFocalId !== null &&
                  effectiveFocalId !== concept.id &&
                  !activeNeighbors.has(concept.id)
                }
                onHover={onHoverConcept}
                docPos={docPositions[concept.id]}
              />
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

/* ==========================================================================
   Subcomponent: InlineHighlightTerm
   Displays in-document highlighted term during FIND stage
   Smoothly hands off highlight to lifting concept node token
   ========================================================================== */

const InlineHighlightTerm = React.forwardRef<
  HTMLSpanElement,
  {
    text: string;
    highlight: MotionValue<number>;
    liftProgress: MotionValue<number>;
  }
>(({ text, highlight, liftProgress }, ref) => {
  const color = useTransform([highlight, liftProgress], ([h, l]: number[]) => {
    if (l > 0.05) {
      return `rgba(255, 255, 255, ${Math.max(0.2, 1 - l * 0.8)})`;
    }
    return h > 0.5 ? '#FFFFFF' : '#8A8A8A';
  });

  const bg = useTransform([highlight, liftProgress], ([h, l]: number[]) => {
    const opacity = Math.max(0, h * 0.18 * (1 - l));
    return `rgba(163, 255, 18, ${opacity})`;
  });

  const underlineScale = useTransform([highlight, liftProgress], ([h, l]: number[]) => {
    return Math.max(0, h * (1 - l));
  });

  const termScale = useTransform(highlight, [0, 0.7, 1], [1, 1.025, 1]);

  return (
    <motion.span
      ref={ref}
      className="ktv-inline-term"
      style={{ color, backgroundColor: bg, scale: termScale }}
    >
      {text}
      <motion.span
        className="ktv-inline-underline"
        style={{ scaleX: underlineScale, transformOrigin: '0% 50%' }}
      />
    </motion.span>
  );
});
InlineHighlightTerm.displayName = 'InlineHighlightTerm';

/* ==========================================================================
   Geometry Helper: Rectangular Boundary Intersection
   Computes exact entry and exit coordinates for clean edge termination
   ========================================================================== */

interface RectBounds {
  x: number;
  y: number;
  hw: number;
  hh: number;
}

export function getRectIntersection(
  source: RectBounds,
  target: RectBounds
): { x1: number; y1: number; x2: number; y2: number } {
  const dx = target.x - source.x;
  const dy = target.y - source.y;

  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
    return { x1: source.x, y1: source.y, x2: target.x, y2: target.y };
  }

  const sScale = Math.min(
    Math.abs(dx) > 0.001 ? source.hw / Math.abs(dx) : Infinity,
    Math.abs(dy) > 0.001 ? source.hh / Math.abs(dy) : Infinity
  );
  const x1 = source.x + dx * sScale;
  const y1 = source.y + dy * sScale;

  const tScale = Math.min(
    Math.abs(dx) > 0.001 ? target.hw / Math.abs(dx) : Infinity,
    Math.abs(dy) > 0.001 ? target.hh / Math.abs(dy) : Infinity
  );
  const x2 = target.x - dx * tScale;
  const y2 = target.y - dy * tScale;

  return { x1, y1, x2, y2 };
}

/* ==========================================================================
   Subcomponent: AnimatedRelationshipEdge
   SVG line drawing dynamically between moving nodes during CONNECT stage
   ========================================================================== */

interface AnimatedRelationshipEdgeProps {
  relationship: RelationshipDefinition;
  concepts: ConceptDefinition[];
  progress: MotionValue<number>;
  stageDims: { width: number; height: number };
  effectiveFocalId: string | null;
  docPositions: Record<string, { docX: number; docY: number }>;
}

const AnimatedRelationshipEdge: React.FC<AnimatedRelationshipEdgeProps> = React.memo(({
  relationship,
  concepts,
  progress,
  stageDims,
  effectiveFocalId,
  docPositions
}) => {
  const src = concepts.find((c) => c.id === relationship.sourceId) || concepts[0];
  const tgt = concepts.find((c) => c.id === relationship.targetId) || concepts[1];

  const srcStartX = docPositions[src.id]?.docX ?? src.docX;
  const srcStartY = docPositions[src.id]?.docY ?? src.docY;
  const tgtStartX = docPositions[tgt.id]?.docX ?? tgt.docX;
  const tgtStartY = docPositions[tgt.id]?.docY ?? tgt.docY;

  const srcNormX = useTransform(progress, [0.54, 0.74], [srcStartX, src.graphX]);
  const srcNormY = useTransform(progress, [0.54, 0.74], [srcStartY, src.graphY]);
  const tgtNormX = useTransform(progress, [0.54, 0.74], [tgtStartX, tgt.graphX]);
  const tgtNormY = useTransform(progress, [0.54, 0.74], [tgtStartY, tgt.graphY]);

  const srcX = useTransform(srcNormX, (nx) => nx * stageDims.width);
  const srcY = useTransform(srcNormY, (ny) => ny * stageDims.height);
  const tgtX = useTransform(tgtNormX, (nx) => nx * stageDims.width);
  const tgtY = useTransform(tgtNormY, (ny) => ny * stageDims.height);

  const x1 = useTransform([srcX, srcY, tgtX, tgtY], ([sx, sy, tx, ty]: number[]) => {
    return getRectIntersection(
      { x: sx, y: sy, hw: src.halfWidth, hh: src.halfHeight },
      { x: tx, y: ty, hw: tgt.halfWidth, hh: tgt.halfHeight }
    ).x1;
  });
  const y1 = useTransform([srcX, srcY, tgtX, tgtY], ([sx, sy, tx, ty]: number[]) => {
    return getRectIntersection(
      { x: sx, y: sy, hw: src.halfWidth, hh: src.halfHeight },
      { x: tx, y: ty, hw: tgt.halfWidth, hh: tgt.halfHeight }
    ).y1;
  });
  const x2 = useTransform([srcX, srcY, tgtX, tgtY], ([sx, sy, tx, ty]: number[]) => {
    return getRectIntersection(
      { x: sx, y: sy, hw: src.halfWidth, hh: src.halfHeight },
      { x: tx, y: ty, hw: tgt.halfWidth, hh: tgt.halfHeight }
    ).x2;
  });
  const y2 = useTransform([srcX, srcY, tgtX, tgtY], ([sx, sy, tx, ty]: number[]) => {
    return getRectIntersection(
      { x: sx, y: sy, hw: src.halfWidth, hh: src.halfHeight },
      { x: tx, y: ty, hw: tgt.halfWidth, hh: tgt.halfHeight }
    ).y2;
  });

  const pathLength = useTransform(
    progress,
    [relationship.drawStart, relationship.drawEnd],
    [0, 1]
  );

  const isEdgeActive =
    effectiveFocalId !== null &&
    (relationship.sourceId === effectiveFocalId || relationship.targetId === effectiveFocalId);

  return (
    <motion.line
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke={isEdgeActive ? 'rgba(163, 255, 18, 0.65)' : 'rgba(255, 255, 255, 0.18)'}
      strokeWidth={1}
      style={{ pathLength }}
      className="graph-edge-line"
    />
  );
});
AnimatedRelationshipEdge.displayName = 'AnimatedRelationshipEdge';

/* ==========================================================================
   Subcomponent: AnimatedRelationshipLabel
   Quiet horizontal edge annotation anchored to the edge midpoint
   ========================================================================== */

interface AnimatedRelationshipLabelProps {
  relationship: RelationshipDefinition;
  concepts: ConceptDefinition[];
  progress: MotionValue<number>;
  stageDims: { width: number; height: number };
  effectiveFocalId: string | null;
  docPositions: Record<string, { docX: number; docY: number }>;
}

const AnimatedRelationshipLabel: React.FC<AnimatedRelationshipLabelProps> = React.memo(({
  relationship,
  concepts,
  progress,
  stageDims,
  effectiveFocalId,
  docPositions
}) => {
  const src = concepts.find((c) => c.id === relationship.sourceId) || concepts[0];
  const tgt = concepts.find((c) => c.id === relationship.targetId) || concepts[1];

  const srcStartX = docPositions[src.id]?.docX ?? src.docX;
  const srcStartY = docPositions[src.id]?.docY ?? src.docY;
  const tgtStartX = docPositions[tgt.id]?.docX ?? tgt.docX;
  const tgtStartY = docPositions[tgt.id]?.docY ?? tgt.docY;

  const srcNormX = useTransform(progress, [0.54, 0.74], [srcStartX, src.graphX]);
  const srcNormY = useTransform(progress, [0.54, 0.74], [srcStartY, src.graphY]);
  const tgtNormX = useTransform(progress, [0.54, 0.74], [tgtStartX, tgt.graphX]);
  const tgtNormY = useTransform(progress, [0.54, 0.74], [tgtStartY, tgt.graphY]);

  const srcX = useTransform(srcNormX, (nx) => nx * stageDims.width);
  const srcY = useTransform(srcNormY, (ny) => ny * stageDims.height);
  const tgtX = useTransform(tgtNormX, (nx) => nx * stageDims.width);
  const tgtY = useTransform(tgtNormY, (ny) => ny * stageDims.height);

  const x1 = useTransform([srcX, srcY, tgtX, tgtY], ([sx, sy, tx, ty]: number[]) => {
    return getRectIntersection(
      { x: sx, y: sy, hw: src.halfWidth, hh: src.halfHeight },
      { x: tx, y: ty, hw: tgt.halfWidth, hh: tgt.halfHeight }
    ).x1;
  });
  const y1 = useTransform([srcX, srcY, tgtX, tgtY], ([sx, sy, tx, ty]: number[]) => {
    return getRectIntersection(
      { x: sx, y: sy, hw: src.halfWidth, hh: src.halfHeight },
      { x: tx, y: ty, hw: tgt.halfWidth, hh: tgt.halfHeight }
    ).y1;
  });
  const x2 = useTransform([srcX, srcY, tgtX, tgtY], ([sx, sy, tx, ty]: number[]) => {
    return getRectIntersection(
      { x: sx, y: sy, hw: src.halfWidth, hh: src.halfHeight },
      { x: tx, y: ty, hw: tgt.halfWidth, hh: tgt.halfHeight }
    ).x2;
  });
  const y2 = useTransform([srcX, srcY, tgtX, tgtY], ([sx, sy, tx, ty]: number[]) => {
    return getRectIntersection(
      { x: sx, y: sy, hw: src.halfWidth, hh: src.halfHeight },
      { x: tx, y: ty, hw: tgt.halfWidth, hh: tgt.halfHeight }
    ).y2;
  });

  const midX = useTransform([x1, x2], ([a, b]: number[]) => (a + b) * 0.5);
  const midY = useTransform([y1, y2], ([a, b]: number[]) => (a + b) * 0.5);

  const labelOpacity = useTransform(
    progress,
    [relationship.drawStart + 0.04, relationship.drawEnd + 0.04],
    [0, 1]
  );

  const left = useTransform(midX, (v) => `${v}px`);
  const top = useTransform(midY, (v) => `${v}px`);

  const isEdgeActive =
    effectiveFocalId !== null &&
    (relationship.sourceId === effectiveFocalId || relationship.targetId === effectiveFocalId);

  return (
    <motion.div
      className={`graph-edge-label ${isEdgeActive ? 'active' : ''}`}
      style={{
        left,
        top,
        opacity: labelOpacity
      }}
    >
      {relationship.label}
    </motion.div>
  );
});
AnimatedRelationshipLabel.displayName = 'AnimatedRelationshipLabel';

/* ==========================================================================
   Subcomponent: AnimatedConceptNode
   Emerges at source text position, travels cleanly, settles into graph position
   ========================================================================== */

interface AnimatedConceptNodeProps {
  concept: ConceptDefinition;
  progress: MotionValue<number>;
  stageDims: { width: number; height: number };
  isFocal: boolean;
  isDimmed: boolean;
  onHover: (id: string) => void;
  docPos?: { docX: number; docY: number };
}

const AnimatedConceptNode: React.FC<AnimatedConceptNodeProps> = React.memo(({
  concept,
  progress,
  stageDims,
  isFocal,
  isDimmed,
  onHover,
  docPos
}) => {
  const startX = docPos?.docX ?? concept.docX;
  const startY = docPos?.docY ?? concept.docY;

  // Emergence: fades in seamlessly over the exact text location at lift-off
  const opacity = useTransform(progress, [0.44, 0.50], [0, 1]);

  // Interpolate normalized position from document to graph
  const normX = useTransform(progress, [0.54, 0.74], [startX, concept.graphX]);
  const normY = useTransform(progress, [0.54, 0.74], [startY, concept.graphY]);

  // Convert to stage pixels
  const left = useTransform(normX, (nx) => `${nx * stageDims.width}px`);
  const top = useTransform(normY, (ny) => `${ny * stageDims.height}px`);

  return (
    <motion.div
      className={['graph-node-anchor', isDimmed ? 'dimmed' : ''].join(' ')}
      style={{
        left,
        top,
        opacity
      }}
      onMouseEnter={() => onHover(concept.id)}
      role="button"
      tabIndex={0}
      aria-label={`Concept: ${concept.name}`}
    >
      <div
        className={[
          'graph-node-token',
          concept.isPrimary ? 'primary' : '',
          isFocal ? 'selected' : ''
        ].join(' ')}
      >
        <span className="graph-token-text">{concept.name}</span>
      </div>
    </motion.div>
  );
});
AnimatedConceptNode.displayName = 'AnimatedConceptNode';

/* ==========================================================================
   Subcomponent: PipelineProgressTrack (Bottom Bar)
   Continuous progress bar and milestone indicators
   ========================================================================== */

const PipelineProgressTrack: React.FC<{
  progress: MotionValue<number>;
  activeIndex: number;
}> = ({ progress, activeIndex }) => {
  const scaleX = useTransform(progress, [0, 1], [0, 1]);

  return (
    <div className="transformation-pipeline-track" aria-hidden="true">
      <motion.div
        className="transformation-pipeline-fill"
        style={{ scaleX, transformOrigin: '0% 50%' }}
      />
      {EDITORIAL_STAGES.map((s, i) => (
        <div
          key={s.code}
          className={`transformation-pipeline-pip ${i <= activeIndex ? 'reached' : ''}`}
          style={{ left: `${(i / (EDITORIAL_STAGES.length - 1)) * 100}%` }}
        />
      ))}
    </div>
  );
};
