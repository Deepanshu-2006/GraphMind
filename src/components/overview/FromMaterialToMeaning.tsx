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
  docX: number;   // coordinate overlaying initial document text position
  docY: number;
  graphX: number; // settled coordinate in balanced knowledge graph
  graphY: number;
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
    docX: -105,
    docY: -42,
    graphX: 0,
    graphY: -80
  },
  {
    id: 'c2',
    name: 'Activation Functions',
    category: 'Function',
    docX: 95,
    docY: -16,
    graphX: -165,
    graphY: 10
  },
  {
    id: 'c3',
    name: 'Backpropagation',
    category: 'Optimization',
    docX: -90,
    docY: 36,
    graphX: 160,
    graphY: 15
  },
  {
    id: 'c4',
    name: 'Gradient Descent',
    category: 'Algorithm',
    docX: 90,
    docY: 66,
    graphX: 125,
    graphY: 115
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
                  <div className="transformation-nav-dot-wrap" aria-hidden="true">
                    <span className="transformation-nav-dot" />
                  </div>
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
            onHoverConcept={setHoveredConceptId}
            onLeaveConcept={() => setHoveredConceptId(null)}
          />

          {/* Right Column: Contextual Stage Explanation */}
          <aside className="transformation-context" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStage.code}
                className="transformation-context-card"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="transformation-context-step-row">
                  <span className="transformation-context-step">{currentStage.step}</span>
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
                    transition={{ duration: 0.22, delay: 0.12 }}
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
  onHoverConcept: (id: string) => void;
  onLeaveConcept: () => void;
}

const KnowledgeTransformationVisual: React.FC<KnowledgeTransformationVisualProps> = ({
  progress,
  effectiveFocalId,
  activeNeighbors,
  onHoverConcept,
  onLeaveConcept
}) => {
  // ─── Layer 1 & 2: Document Transforms ──────────────────────────────────────
  // READ (0.00 → 0.22): Document surface is fully opaque, prominent.
  // FIND (0.22 → 0.48): Document body text gently dims; concepts highlight.
  // CONNECT (0.48 → 0.74): Document recedes in depth (scales down, dims to 0.18,
  //   moves backward) but remains subtly visible underneath, matching the reference.
  const docOpacity = useTransform(progress, [0.0, 0.04, 0.44, 0.64], [0.5, 1.0, 1.0, 0.18]);
  const docScale = useTransform(progress, [0.0, 0.04, 0.44, 0.64], [0.98, 1.0, 1.0, 0.88]);
  const docTranslateZ = useTransform(progress, [0.44, 0.64], [0, -32]);
  const docBlur = useTransform(progress, [0.48, 0.68], ['blur(0px)', 'blur(1.5px)']);

  // Document body text dimming during FIND & CONNECT
  const bodyTextDim = useTransform(progress, [0.22, 0.42], [1.0, 0.38]);

  // Scanline sweeping during READ
  const scanlineTop = useTransform(progress, [0.03, 0.20], [0, 100]);
  const scanlineOpacity = useTransform(progress, [0.0, 0.03, 0.18, 0.24], [0, 0.6, 0.6, 0]);

  // Highlighting of terms inside document text
  const hlTerm1 = useTransform(progress, [0.20, 0.30], [0, 1]);
  const hlTerm2 = useTransform(progress, [0.24, 0.34], [0, 1]);
  const hlTerm3 = useTransform(progress, [0.28, 0.38], [0, 1]);
  const hlTerm4 = useTransform(progress, [0.32, 0.42], [0, 1]);

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

          {/* Document metadata bar */}
          <div className="ktv-doc-meta">
            <span className="ktv-doc-badge">Source Material</span>
            <span className="ktv-doc-filename">Neural_Networks_CS229.md</span>
          </div>

          {/* Document title & prose */}
          <div className="ktv-doc-content">
            <h3 className="ktv-doc-heading">Representation Learning &amp; Optimization</h3>
            <motion.p className="ktv-doc-paragraph" style={{ opacity: bodyTextDim }}>
              <InlineHighlightTerm text="Neural Networks" highlight={hlTerm1} /> consist of
              stacked parameter layers transforming inputs through non-linear{' '}
              <InlineHighlightTerm text="Activation Functions" highlight={hlTerm2} /> to isolate
              continuous representations.
            </motion.p>
            <motion.p className="ktv-doc-paragraph" style={{ opacity: bodyTextDim }}>
              During learning, error gradients flow backward via{' '}
              <InlineHighlightTerm text="Backpropagation" highlight={hlTerm3} />. The objective loss
              is iteratively minimized by{' '}
              <InlineHighlightTerm text="Gradient Descent" highlight={hlTerm4} /> across parameter
              space.
            </motion.p>
          </div>
        </motion.div>

        {/* Layer 3: Relationship Edges (SVG overlay) */}
        <svg className="ktv-edges-svg" viewBox="-320 -200 640 400" aria-hidden="true">
          <defs>
            <linearGradient id="ktv-edge-active" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#A3FF12" stopOpacity="0.95" />
              <stop offset="100%" stopColor="#A3FF12" stopOpacity="0.45" />
            </linearGradient>
          </defs>
          {KNOWLEDGE_RELATIONSHIPS.map((rel) => (
            <AnimatedRelationshipEdge
              key={rel.id}
              relationship={rel}
              concepts={KNOWLEDGE_CONCEPTS}
              progress={progress}
              effectiveFocalId={effectiveFocalId}
            />
          ))}
        </svg>

        {/* Layer 4: Extracted Concept Nodes (Physically travel from doc to graph) */}
        <div className="ktv-concepts-layer" aria-label="Extracted concepts">
          {KNOWLEDGE_CONCEPTS.map((concept) => (
            <AnimatedConceptNode
              key={concept.id}
              concept={concept}
              progress={progress}
              isFocal={effectiveFocalId === concept.id}
              isDimmed={
                effectiveFocalId !== null && !activeNeighbors.has(concept.id)
              }
              onHover={onHoverConcept}
              onLeave={onLeaveConcept}
            />
          ))}
        </div>
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
   Subcomponent: AnimatedConceptNode
   Continuous physical transformation:
   - Emerges at its exact document text position
   - Detaches with 3D elevation and chip background
   - Travels smoothly to settled graph coordinate
   - Shows category badge and focal glowing ring in final EXPLORE stage
   ========================================================================== */

interface AnimatedConceptNodeProps {
  concept: ConceptDefinition;
  progress: MotionValue<number>;
  isFocal: boolean;
  isDimmed: boolean;
  onHover: (id: string) => void;
  onLeave: () => void;
}

const AnimatedConceptNode: React.FC<AnimatedConceptNodeProps> = ({
  concept,
  progress,
  isFocal,
  isDimmed,
  onHover,
  onLeave
}) => {
  // Physical travel from document text position to settled graph position
  const x = useTransform(progress, [0.36, 0.65], [concept.docX, concept.graphX]);
  const y = useTransform(progress, [0.36, 0.65], [concept.docY, concept.graphY]);

  // Elevation: lifts off the document surface into 3D space
  const translateZ = useTransform(progress, [0.22, 0.40, 0.70], [2, 14, 24]);

  // Overall node opacity: emerges as terms highlight in FIND
  const opacity = useTransform(progress, [0.22, 0.36], [0, 1]);

  // Category badge visibility: reveals cleanly as concepts leave the document
  const tagOpacity = useTransform(progress, [0.46, 0.64], [0, 1]);

  return (
    <motion.div
      className={[
        'ktv-concept-node',
        isFocal ? 'focal' : '',
        isDimmed ? 'dimmed' : ''
      ].join(' ')}
      style={{
        x,
        y,
        translateZ,
        opacity: isDimmed ? 0.28 : opacity
      }}
      onMouseEnter={() => onHover(concept.id)}
      onMouseLeave={onLeave}
      role="button"
      tabIndex={0}
      aria-label={`Concept: ${concept.name}`}
    >
      <div className="ktv-node-card">
        <span
          className="ktv-node-dot"
          style={{
            backgroundColor: isFocal ? 'var(--accent)' : 'rgba(255, 255, 255, 0.35)'
          }}
          aria-hidden="true"
        />
        <div className="ktv-node-text-wrap">
          <span className="ktv-node-title">{concept.name}</span>
          <motion.span className="ktv-node-tag" style={{ opacity: tagOpacity }}>
            {concept.category}
          </motion.span>
        </div>
      </div>
    </motion.div>
  );
};

/* ==========================================================================
   Subcomponent: AnimatedRelationshipEdge
   SVG line drawing dynamically between moving nodes during CONNECT stage
   ========================================================================== */

interface AnimatedRelationshipEdgeProps {
  relationship: RelationshipDefinition;
  concepts: ConceptDefinition[];
  progress: MotionValue<number>;
  effectiveFocalId: string | null;
}

const AnimatedRelationshipEdge: React.FC<AnimatedRelationshipEdgeProps> = ({
  relationship,
  concepts,
  progress,
  effectiveFocalId
}) => {
  const src = concepts.find((c) => c.id === relationship.sourceId) || concepts[0];
  const tgt = concepts.find((c) => c.id === relationship.targetId) || concepts[1];

  // Node endpoints follow the identical physical motion interpolation
  const srcX = useTransform(progress, [0.36, 0.65], [src.docX, src.graphX]);
  const srcY = useTransform(progress, [0.36, 0.65], [src.docY, src.graphY]);
  const tgtX = useTransform(progress, [0.36, 0.65], [tgt.docX, tgt.graphX]);
  const tgtY = useTransform(progress, [0.36, 0.65], [tgt.docY, tgt.graphY]);

  // Progressive line drawing timeline
  const pathLength = useTransform(
    progress,
    [relationship.drawStart, relationship.drawEnd],
    [0, 1]
  );

  // Label badge fades in as line completes drawing
  const labelOpacity = useTransform(
    progress,
    [relationship.drawStart + 0.05, relationship.drawEnd + 0.04],
    [0, 1]
  );

  const midX = (src.graphX + tgt.graphX) * 0.5;
  const midY = (src.graphY + tgt.graphY) * 0.5;

  const isEdgeActive =
    effectiveFocalId !== null &&
    (relationship.sourceId === effectiveFocalId || relationship.targetId === effectiveFocalId);

  return (
    <g className="ktv-edge-group">
      <motion.line
        x1={srcX}
        y1={srcY}
        x2={tgtX}
        y2={tgtY}
        stroke={isEdgeActive ? 'url(#ktv-edge-active)' : 'rgba(255, 255, 255, 0.14)'}
        strokeWidth={isEdgeActive ? 1.8 : 1.1}
        strokeDasharray={isEdgeActive ? undefined : '3 4'}
        style={{ pathLength }}
      />
      <foreignObject
        x={midX - 44}
        y={midY - 11}
        width={88}
        height={22}
        className="ktv-edge-label-container"
      >
        <motion.div
          className={`ktv-edge-label-badge ${isEdgeActive ? 'active' : ''}`}
          style={{ opacity: labelOpacity }}
          title={relationship.label}
        >
          {relationship.label}
        </motion.div>
      </foreignObject>
    </g>
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
