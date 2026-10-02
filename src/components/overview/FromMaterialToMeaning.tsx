import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  AnimatePresence,
  type MotionValue
} from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

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
    halfWidth: 105,
    halfHeight: 19
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
    halfWidth: 95,
    halfHeight: 17
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
    halfWidth: 92,
    halfHeight: 17
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
    halfWidth: 86,
    halfHeight: 17
  }
];

export const KNOWLEDGE_RELATIONSHIPS: RelationshipDefinition[] = [
  {
    id: 'r1',
    sourceId: 'c1',
    targetId: 'c2',
    label: 'uses',
    drawStart: 0.50,
    drawEnd: 0.62
  },
  {
    id: 'r2',
    sourceId: 'c1',
    targetId: 'c3',
    label: 'trained with',
    drawStart: 0.56,
    drawEnd: 0.68
  },
  {
    id: 'r3',
    sourceId: 'c3',
    targetId: 'c4',
    label: 'optimizes',
    drawStart: 0.62,
    drawEnd: 0.74
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
  const [hoveredConceptId, setHoveredConceptId] = useState<string | null>(null);

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

          const nextIndex = p >= 0.75 ? 3 : p >= 0.50 ? 2 : p >= 0.25 ? 1 : 0;
          setActiveStageIndex((prev) => (prev !== nextIndex ? nextIndex : prev));
        }
      });
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    handleScroll();

    return () => {
      cancelAnimationFrame(rafId);
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

    const targets = [0.06, 0.36, 0.62, 0.88];
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
  // Default to central root concept ('c1': Neural Networks) during EXPLORE stage
  const effectiveFocalId = hoveredConceptId || (activeStageIndex === 3 ? 'c1' : null);

  const activeNeighbors = useMemo(() => {
    if (!effectiveFocalId) return new Set<string>();
    const neighbors = new Set<string>([effectiveFocalId]);
    KNOWLEDGE_RELATIONSHIPS.forEach((rel) => {
      if (rel.sourceId === effectiveFocalId) neighbors.add(rel.targetId);
      if (rel.targetId === effectiveFocalId) neighbors.add(rel.sourceId);
    });
    return neighbors;
  }, [effectiveFocalId]);

  const currentStage = EDITORIAL_STAGES[activeStageIndex];

  return (
    <section
      ref={sectionRef}
      className="transformation-scroll"
      aria-label="From Material to Meaning — Interactive Transformation"
    >
      <div className="transformation-sticky">
        {/* Subtle background ambient dot grid */}
        <div className="transformation-ambience-canvas" aria-hidden="true" />

        {/* 1. Header: Eyebrow + Editorial Statement */}
        <header className="transformation-header">
          <div className="transformation-eyebrow">
            <span className="transformation-eyebrow-dot" aria-hidden="true" />
            <span>From Material to Meaning</span>
          </div>
          <h2 className="transformation-title">
            See how your material becomes connected knowledge.
          </h2>
        </header>

        {/* 2. Main 3-Column Composition */}
        <div className="transformation-body">
          {/* Left Navigation: Process Index */}
          <nav className="transformation-nav" aria-label="Process stages">
            <ul className="transformation-nav-list" role="list">
              {EDITORIAL_STAGES.map((s, i) => (
                <li
                  key={s.code}
                  className={[
                    'transformation-nav-item',
                    activeStageIndex === i ? 'active' : '',
                    activeStageIndex > i ? 'passed' : ''
                  ].join(' ')}
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
                    <span className="transformation-nav-dot" />
                  </span>
                  <span className="transformation-nav-code">{s.code}</span>
                  <span className="transformation-nav-label">{s.name}</span>
                </li>
              ))}
            </ul>
          </nav>

          {/* Center Stage: The Single Persistent Transforming Visual System */}
          <KnowledgeTransformationVisual
            progress={scrollProgress}
            effectiveFocalId={effectiveFocalId}
            activeNeighbors={activeNeighbors}
            hoveredConceptId={hoveredConceptId}
            onHoverConcept={setHoveredConceptId}
            onLeaveConcept={() => setHoveredConceptId(null)}
          />

          {/* Right Column: Contextual Stage Explanation */}
          <aside className="transformation-context" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStage.code}
                className="transformation-context-card"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="transformation-context-step-row">
                  <span className="transformation-context-step">{currentStage.code}</span>
                  <span className="transformation-context-divider">/</span>
                  <span className="transformation-context-total">04</span>
                  <span className="transformation-context-name">{currentStage.name}</span>
                </div>
                <h3 className="transformation-context-tagline">{currentStage.tagline}</h3>
                <p className="transformation-context-desc">{currentStage.desc}</p>

                {activeStageIndex === 3 && (
                  <motion.button
                    type="button"
                    className="transformation-cta-link"
                    onClick={onExploreWorkspace}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.1 }}
                  >
                    <span>Open workspace</span>
                    <ArrowUpRight size={13} aria-hidden="true" />
                  </motion.button>
                )}
              </motion.div>
            </AnimatePresence>
          </aside>
        </div>

        {/* 3. Bottom Bar: GraphMind Pipeline Progress */}
        <footer className="transformation-pipeline" aria-hidden="true">
          <span className="transformation-pipeline-tag">GraphMind Pipeline</span>
          <PipelineProgressTrack progress={scrollProgress} activeIndex={activeStageIndex} />
          <span className="transformation-pipeline-counter">{currentStage.step}</span>
        </footer>
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
  hoveredConceptId: string | null;
  onHoverConcept: (id: string) => void;
  onLeaveConcept: () => void;
}

const KnowledgeTransformationVisual: React.FC<KnowledgeTransformationVisualProps> = ({
  progress,
  effectiveFocalId,
  activeNeighbors,
  hoveredConceptId,
  onHoverConcept,
  onLeaveConcept
}) => {
  // ─── Layer 1 & 2: Document Transforms ──────────────────────────────────────
  // Reduced progressively according to Section 17:
  // READ (0.00-0.25): 100%
  // FIND (0.25-0.50): 80%
  // CONNECT (0.50-0.75): 35%
  // EXPLORE (0.75-1.00): 10% -> 8%
  const docOpacity = useTransform(
    progress,
    [0.0, 0.04, 0.25, 0.50, 0.75, 1.0],
    [0.6, 1.0, 0.80, 0.35, 0.10, 0.08]
  );
  const docScale = useTransform(
    progress,
    [0.0, 0.04, 0.45, 0.70, 0.90],
    [0.98, 1.0, 1.0, 0.90, 0.86]
  );
  const docTranslateZ = useTransform(progress, [0.45, 0.70, 0.90], [0, -28, -44]);
  const docBlur = useTransform(progress, [0.50, 0.75, 0.90], ['blur(0px)', 'blur(1.5px)', 'blur(2px)']);

  // Graph expands subtly as document recedes (Section 18):
  const graphScale = useTransform(progress, [0.35, 0.65, 1.0], [0.90, 1.0, 1.06]);

  // Document body text dimming during FIND & CONNECT
  const bodyTextDim = useTransform(progress, [0.22, 0.42], [1.0, 0.38]);

  // Scanline sweeping during READ
  const scanlineTop = useTransform(progress, [0.03, 0.20], [0, 100]);
  const scanlineOpacity = useTransform(progress, [0.0, 0.03, 0.18, 0.24], [0, 0.6, 0.6, 0]);

  // Highlighting of terms inside document text
  const hlTerm1 = useTransform(progress, [0.20, 0.28], [0, 1]);
  const hlTerm2 = useTransform(progress, [0.24, 0.32], [0, 1]);
  const hlTerm3 = useTransform(progress, [0.28, 0.36], [0, 1]);
  const hlTerm4 = useTransform(progress, [0.32, 0.40], [0, 1]);

  const stageRef = useRef<HTMLDivElement>(null);
  const [stageDims, setStageDims] = useState({ width: 680, height: 460 });

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const updateDims = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setStageDims({ width: rect.width, height: rect.height });
      }
    };
    updateDims();
    const ro = new ResizeObserver(updateDims);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="ktv-viewport">
      <div className="ktv-scene">
        {/* Layer 1: Tactile Depth Underplate (Shadow / Thickness Slab) */}
        <motion.div
          className="ktv-underplate"
          style={{
            opacity: docOpacity,
            scale: docScale
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
              <InlineHighlightTerm text="Neural Networks" highlight={hlTerm1} /> consist of
              stacked parameter layers transforming inputs through non-linear{' '}
              <InlineHighlightTerm text="Activation Functions" highlight={hlTerm2} /> to isolate
              continuous representations across high-dimensional manifolds.
            </motion.p>
            <motion.p className="ktv-doc-paragraph secondary" style={{ opacity: bodyTextDim }}>
              During learning, error gradients flow backward via{' '}
              <InlineHighlightTerm text="Backpropagation" highlight={hlTerm3} />. The objective loss
              is iteratively minimized by{' '}
              <InlineHighlightTerm text="Gradient Descent" highlight={hlTerm4} /> across parameter
              space.
            </motion.p>
          </div>
        </motion.div>

        {/* Central Graph Canvas: Unified system (EdgeLayer -> LabelLayer -> NodeLayer) */}
        <motion.div
          ref={stageRef}
          className="graph-stage"
          style={{ scale: graphScale }}
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
                  hoveredConceptId !== null && !activeNeighbors.has(concept.id)
                }
                onHover={onHoverConcept}
                onLeave={onLeaveConcept}
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
   ========================================================================== */

const InlineHighlightTerm: React.FC<{
  text: string;
  highlight: MotionValue<number>;
}> = ({ text, highlight }) => {
  const color = useTransform(highlight, [0, 1], ['#8A8A8A', '#FFFFFF']);
  const bg = useTransform(
    highlight,
    [0, 1],
    ['rgba(163,255,18,0)', 'rgba(163,255,18,0.12)']
  );
  const underlineScale = useTransform(highlight, [0, 1], [0, 1]);

  return (
    <motion.span className="ktv-inline-term" style={{ color, backgroundColor: bg }}>
      {text}
      <motion.span
        className="ktv-inline-underline"
        style={{ scaleX: underlineScale, transformOrigin: '0% 50%' }}
      />
    </motion.span>
  );
};

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
}

const AnimatedRelationshipEdge: React.FC<AnimatedRelationshipEdgeProps> = ({
  relationship,
  concepts,
  progress,
  stageDims,
  effectiveFocalId
}) => {
  const src = concepts.find((c) => c.id === relationship.sourceId) || concepts[0];
  const tgt = concepts.find((c) => c.id === relationship.targetId) || concepts[1];

  const srcNormX = useTransform(progress, [0.36, 0.65], [src.docX, src.graphX]);
  const srcNormY = useTransform(progress, [0.36, 0.65], [src.docY, src.graphY]);
  const tgtNormX = useTransform(progress, [0.36, 0.65], [tgt.docX, tgt.graphX]);
  const tgtNormY = useTransform(progress, [0.36, 0.65], [tgt.docY, tgt.graphY]);

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
};

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
}

const AnimatedRelationshipLabel: React.FC<AnimatedRelationshipLabelProps> = ({
  relationship,
  concepts,
  progress,
  stageDims,
  effectiveFocalId
}) => {
  const src = concepts.find((c) => c.id === relationship.sourceId) || concepts[0];
  const tgt = concepts.find((c) => c.id === relationship.targetId) || concepts[1];

  const srcNormX = useTransform(progress, [0.36, 0.65], [src.docX, src.graphX]);
  const srcNormY = useTransform(progress, [0.36, 0.65], [src.docY, src.graphY]);
  const tgtNormX = useTransform(progress, [0.36, 0.65], [tgt.docX, tgt.graphX]);
  const tgtNormY = useTransform(progress, [0.36, 0.65], [tgt.docY, tgt.graphY]);

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
};

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
  onLeave: () => void;
}

const AnimatedConceptNode: React.FC<AnimatedConceptNodeProps> = ({
  concept,
  progress,
  stageDims,
  isFocal,
  isDimmed,
  onHover,
  onLeave
}) => {
  // Emergence: fades in as terms highlight in FIND stage
  const opacity = useTransform(progress, [0.22, 0.36], [0, 1]);

  // Interpolate normalized position from document to graph
  const normX = useTransform(progress, [0.36, 0.65], [concept.docX, concept.graphX]);
  const normY = useTransform(progress, [0.36, 0.65], [concept.docY, concept.graphY]);

  // Convert to stage pixels
  const left = useTransform(normX, (nx) => `${nx * stageDims.width}px`);
  const top = useTransform(normY, (ny) => `${ny * stageDims.height}px`);

  return (
    <motion.div
      className={['graph-node-anchor', isDimmed ? 'dimmed' : ''].join(' ')}
      style={{
        left,
        top,
        opacity: isDimmed ? 0.40 : opacity
      }}
      onMouseEnter={() => onHover(concept.id)}
      onMouseLeave={onLeave}
      role="button"
      tabIndex={0}
      aria-label={`Concept: ${concept.name}`}
    >
      <div
        className={[
          'graph-node-card',
          concept.isPrimary ? 'primary' : '',
          isFocal ? 'selected' : ''
        ].join(' ')}
      >
        <span className="graph-node-dot" aria-hidden="true" />
        <span className="graph-node-title">{concept.name}</span>
        <span className="graph-node-category">{concept.category}</span>
      </div>
    </motion.div>
  );
};

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
