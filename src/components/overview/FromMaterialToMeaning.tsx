import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import {
  motion,
  useMotionValue,
  useTransform,
  useSpring,
  AnimatePresence,
  type MotionValue
} from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';

/* ==========================================================================
   Data: Concept Nodes, Relationship Edges, Editorial Stage Copy
   ========================================================================== */

interface ConceptNodeData {
  id: string;
  name: string;
  category: string;
  docX: number;   // px offset from center — position overlaying document card
  docY: number;
  graphX: number; // px offset from center — settled knowledge graph position
  graphY: number;
}

interface RelationshipEdgeData {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
}

// 4 core concepts — positioned to visually emerge from document text, then
// settle into a balanced radial graph centered on "Neural Networks".
const NODES: ConceptNodeData[] = [
  {
    id: 'n1',
    name: 'Neural Networks',
    category: 'Architecture',
    docX: -72, docY: -52,
    graphX: 0, graphY: -90
  },
  {
    id: 'n2',
    name: 'Activation Functions',
    category: 'Function',
    docX: 68, docY: -14,
    graphX: -150, graphY: 0
  },
  {
    id: 'n3',
    name: 'Backpropagation',
    category: 'Optimization',
    docX: -68, docY: 36,
    graphX: 145, graphY: 5
  },
  {
    id: 'n4',
    name: 'Gradient Descent',
    category: 'Algorithm',
    docX: 70, docY: 72,
    graphX: 120, graphY: 105
  }
];

const EDGES: RelationshipEdgeData[] = [
  { id: 'e1', sourceId: 'n1', targetId: 'n2', label: 'uses' },
  { id: 'e2', sourceId: 'n1', targetId: 'n3', label: 'trained with' },
  { id: 'e3', sourceId: 'n3', targetId: 'n4', label: 'optimizes' }
];

// Right-column copy — exact wording from specification
const STAGES = [
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
    tagline: 'Explore what you\'ve built.',
    desc: 'Your material becomes a connected map you can navigate and understand.'
  }
];

/* ==========================================================================
   Scroll Progress → Stage Mapping
   
   The outer section is ~480vh tall. The inner sticky viewport fills the
   visible area. As the user scrolls through the 480vh, we derive a
   normalized progress value 0→1.

   Stage boundaries (used for left-nav active state):
     0.00 – 0.25  READ
     0.25 – 0.50  FIND
     0.50 – 0.75  CONNECT
     0.75 – 1.00  EXPLORE

   But all visual transforms use OVERLAPPING ranges so that no two
   stages ever hard-cut. The visual timeline:

   Progress  0.0   0.1   0.2   0.3   0.4   0.5   0.6   0.7   0.8   0.9   1.0
             |-- READ --|-- FIND ---|-- CONNECT --|--- EXPLORE --|
   Document  [visible ─────────────────── fading ──]
   Scan line [───── sweep ─────]
   Highlights          [──── revealing ────]
   Nodes                          [fade-in ─── travel ─────]
   Edges                                     [draw ──── draw ──── draw]
   Focus                                                    [emphasize]
   Exit                                                            [scale]
   ========================================================================== */

/* ==========================================================================
   Main Component
   ========================================================================== */

interface FromMaterialToMeaningProps {
  onExploreWorkspace: () => void;
  onUploadMaterial: () => void;
}

export const FromMaterialToMeaning: React.FC<FromMaterialToMeaningProps> = ({
  onExploreWorkspace
}) => {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);


  // ─── Scroll Progress Engine ────────────────────────────────────────────────
  // Raw progress drives everything. Spring-smoothed progress used for visuals
  // to prevent micro-jitter on trackpad scrolling.
  const rawProgress = useMotionValue(0);
  const smoothProgress = useSpring(rawProgress, {
    stiffness: 160,
    damping: 28,
    mass: 0.35
  });

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    // The scrollable ancestor is .workspace-viewport (overflow-y: auto).
    // Sticky positioning is relative to this container.
    const viewport =
      (el.closest('.workspace-viewport') as HTMLElement) ||
      (document.querySelector('.workspace-viewport') as HTMLElement) ||
      document.documentElement;

    let rafId: number;

    const computeProgress = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const section = sectionRef.current;
        if (!section) return;

        // section.offsetTop is relative to the offsetParent, which
        // is .workspace-viewport (position: relative). This is
        // exactly the coordinate space of viewport.scrollTop.
        const scrollTop = viewport.scrollTop;
        const sectionTop = section.offsetTop;
        const sectionHeight = section.offsetHeight;
        const vpHeight = viewport.clientHeight;

        const totalScrollable = sectionHeight - vpHeight;
        if (totalScrollable <= 0) return;

        const scrolled = scrollTop - sectionTop;
        const p = Math.min(1.0, Math.max(0.0, scrolled / totalScrollable));
        rawProgress.set(p);
      });
    };

    computeProgress();
    viewport.addEventListener('scroll', computeProgress, { passive: true });
    window.addEventListener('resize', computeProgress, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      viewport.removeEventListener('scroll', computeProgress);
      window.removeEventListener('resize', computeProgress);
    };
  }, [rawProgress]);

  // ─── Stage Index (for discrete UI: left nav, right copy, bottom counter) ──
  useEffect(() => {
    const unsub = smoothProgress.on('change', (p) => {
      const next = p >= 0.75 ? 3 : p >= 0.50 ? 2 : p >= 0.25 ? 1 : 0;
      setActiveStageIndex((prev) => (prev !== next ? next : prev));
    });
    return unsub;
  }, [smoothProgress]);

  // ─── Click-to-scroll navigation ───────────────────────────────────────────
  const scrollToStage = useCallback((idx: number) => {
    const el = sectionRef.current;
    if (!el) return;
    const viewport =
      (el.closest('.workspace-viewport') as HTMLElement) ||
      (document.querySelector('.workspace-viewport') as HTMLElement) ||
      document.documentElement;

    const vpH = viewport.clientHeight;
    const total = el.offsetHeight - vpH;
    const targets = [0.06, 0.37, 0.62, 0.87];
    const scrollTarget = el.offsetTop + total * targets[idx];
    viewport.scrollTo({ top: scrollTarget, behavior: 'smooth' });
  }, []);

  // ─── Document Layer Transforms ─────────────────────────────────────────────
  //
  // READ (0.00–0.25): Document fully visible, scan line sweeps, slight arrival.
  // FIND (0.25–0.50): Terms highlight sequentially; doc still visible.
  // CONNECT start: Doc fades out & scales down. Nodes emerge.
  //
  // The doc remains on-screen well into stage 02 so highlights have visual
  // context. It only begins fading once concepts start detaching.
  const docOpacity = useTransform(smoothProgress, [0.0, 0.04, 0.42, 0.58], [0.4, 1, 1, 0]);
  const docScale = useTransform(smoothProgress, [0.0, 0.04, 0.42, 0.58], [0.97, 1.0, 1.0, 0.92]);
  const docY = useTransform(smoothProgress, [0.42, 0.58], [0, -20]);

  // Stage 01: Scan line sweeps the document like a "reading" indicator
  const scanLineTop = useTransform(smoothProgress, [0.02, 0.22], [0, 100]);
  const scanLineOpacity = useTransform(smoothProgress, [0.0, 0.04, 0.20, 0.26], [0, 0.55, 0.55, 0]);

  // Stage 02: Staggered concept highlighting (overlapping into CONNECT)
  const term1HL = useTransform(smoothProgress, [0.16, 0.28], [0, 1]);
  const term2HL = useTransform(smoothProgress, [0.21, 0.33], [0, 1]);
  const term3HL = useTransform(smoothProgress, [0.26, 0.38], [0, 1]);
  const term4HL = useTransform(smoothProgress, [0.31, 0.42], [0, 1]);

  // Non-highlighted paragraph text fades slightly during FIND to increase contrast
  const bodyDimming = useTransform(smoothProgress, [0.18, 0.38], [1, 0.45]);

  // Stage 04: Subtle exit as section finishes
  const exitScale = useTransform(smoothProgress, [0.93, 1.0], [1.0, 0.97]);
  const exitY = useTransform(smoothProgress, [0.93, 1.0], [0, -14]);

  // ─── Explore-stage focus highlight ─────────────────────────────────────────
  const activeConceptId = hoveredNodeId || (activeStageIndex === 3 ? 'n1' : null);
  const activeNeighbors = useMemo(() => {
    if (!activeConceptId) return new Set<string>();
    const s = new Set<string>([activeConceptId]);
    EDGES.forEach((e) => {
      if (e.sourceId === activeConceptId) s.add(e.targetId);
      if (e.targetId === activeConceptId) s.add(e.sourceId);
    });
    return s;
  }, [activeConceptId]);

  const stage = STAGES[activeStageIndex];

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <section
      ref={sectionRef}
      className="material-to-meaning-section"
      aria-label="From Material to Meaning — Interactive Transformation"
    >
      <div className="material-to-meaning-sticky">
        {/* Ambient dot-grid background */}
        <div className="meaning-ambience-canvas" aria-hidden="true" />

        {/* ── Header ─────────────────────────────────────────────────── */}
        <header className="meaning-header-block">
          <div className="meaning-eyebrow">
            <span className="meaning-eyebrow-dot" aria-hidden="true" />
            <span>From Material to Meaning</span>
          </div>
          <h2 className="meaning-title">
            See how your material becomes connected knowledge.
          </h2>
        </header>

        {/* ── 3-Column Stage Layout ──────────────────────────────────── */}
        <div className="meaning-stage-layout">

          {/* A. Left Process Navigation */}
          <nav className="meaning-left-nav" aria-label="Process stages">
            <ul className="meaning-nav-list" role="list">
              {STAGES.map((s, i) => (
                <li
                  key={s.code}
                  className={[
                    'meaning-nav-item',
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
                  <div className="meaning-nav-indicator-wrap" aria-hidden="true">
                    <span className="meaning-nav-indicator" />
                  </div>
                  <span className="meaning-nav-code">{s.code}</span>
                  <span className="meaning-nav-label">{s.name}</span>
                </li>
              ))}
            </ul>
          </nav>

          {/* B. Center — The Stage ────────────────────────────────────── */}
          <motion.div
            className="meaning-workspace-center"
            style={{ scale: exitScale, y: exitY }}
          >
            {/* ── Layer 1: Study Document Card (READ + FIND) ────────── */}
            <motion.div
              className="meaning-document"
              style={{ opacity: docOpacity, scale: docScale, y: docY }}
            >
              {/* Scan Line — sweeps the document during READ */}
              <motion.div
                className="meaning-doc-scanline"
                style={{
                  top: useTransform(scanLineTop, (v) => `${v}%`),
                  opacity: scanLineOpacity
                }}
                aria-hidden="true"
              />

              <div className="meaning-doc-header">
                <span className="meaning-doc-tag">Source Material</span>
                <span className="meaning-doc-filename">Neural_Networks_CS229.md</span>
              </div>

              <div className="meaning-doc-body">
                <h3 className="meaning-doc-title">
                  Representation Learning &amp; Optimization
                </h3>
                <motion.p className="meaning-doc-paragraph" style={{ opacity: bodyDimming }}>
                  <AnimatedDocTerm text="Neural Networks" highlight={term1HL} />{' '}
                  consist of stacked parameter layers transforming inputs through non-linear{' '}
                  <AnimatedDocTerm text="Activation Functions" highlight={term2HL} />{' '}
                  to isolate continuous features.
                </motion.p>
                <motion.p className="meaning-doc-paragraph" style={{ opacity: bodyDimming }}>
                  During learning, error gradients flow backward via{' '}
                  <AnimatedDocTerm text="Backpropagation" highlight={term3HL} />
                  . The objective loss is iteratively minimized by{' '}
                  <AnimatedDocTerm text="Gradient Descent" highlight={term4HL} />{' '}
                  across parameter space.
                </motion.p>
              </div>
            </motion.div>

            {/* ── Layer 2: SVG Relationship Edges (CONNECT + EXPLORE) ── */}
            <svg
              className="meaning-graph-edges-svg"
              viewBox="-280 -180 560 360"
              aria-hidden="true"
            >
              <defs>
                <linearGradient id="mtm-edgeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#A3FF12" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#A3FF12" stopOpacity="0.5" />
                </linearGradient>
              </defs>
              {EDGES.map((edge, i) => (
                <AnimatedEdge
                  key={edge.id}
                  edge={edge}
                  index={i}
                  nodes={NODES}
                  progress={smoothProgress}
                  activeConceptId={activeConceptId}
                />
              ))}
            </svg>

            {/* ── Layer 3: Floating Concept Nodes (CONNECT + EXPLORE) ── */}
            <div className="meaning-nodes-container" aria-label="Extracted concept nodes">
              {NODES.map((node) => (
                <AnimatedNode
                  key={node.id}
                  node={node}
                  progress={smoothProgress}
                  activeConceptId={activeConceptId}
                  activeNeighbors={activeNeighbors}
                  onHover={setHoveredNodeId}
                  onLeave={() => setHoveredNodeId(null)}
                />
              ))}
            </div>
          </motion.div>

          {/* C. Right Context Column */}
          <aside className="meaning-right-context" aria-live="polite">
            <AnimatePresence mode="wait">
              <motion.div
                key={stage.code}
                className="meaning-context-block"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="meaning-context-step-row">
                  <span className="meaning-context-step">{stage.step}</span>
                  <span className="meaning-context-step-name">{stage.name}</span>
                </div>
                <h3 className="meaning-context-tagline">{stage.tagline}</h3>
                <p className="meaning-context-desc">{stage.desc}</p>

                {activeStageIndex === 3 && (
                  <motion.button
                    type="button"
                    className="meaning-cta-link"
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

        {/* ── Bottom Pipeline Bar ────────────────────────────────────── */}
        <footer className="meaning-bottom-bar" aria-hidden="true">
          <span className="meaning-bottom-tag">GraphMind Pipeline</span>
          <ProgressTrack progress={smoothProgress} activeIndex={activeStageIndex} />
          <span className="meaning-bottom-counter">{stage.step}</span>
        </footer>
      </div>
    </section>
  );
};

/* ==========================================================================
   Sub-Components — all driven by MotionValues, no per-frame setState
   ========================================================================== */

// ─── Progress Track (bottom bar) ─────────────────────────────────────────────
const ProgressTrack: React.FC<{ progress: MotionValue<number>; activeIndex: number }> = ({
  progress,
  activeIndex
}) => {
  const scaleX = useTransform(progress, [0, 1], [0, 1]);
  return (
    <div className="meaning-progress-track" aria-hidden="true">
      <motion.div
        className="meaning-progress-fill"
        style={{ scaleX, transformOrigin: '0% 50%' }}
      />
      {STAGES.map((s, i) => (
        <div
          key={s.code}
          className={`meaning-progress-pip ${i <= activeIndex ? 'reached' : ''}`}
          style={{ left: `${(i / (STAGES.length - 1)) * 100}%` }}
        />
      ))}
    </div>
  );
};

// ─── Animated Document Term ──────────────────────────────────────────────────
// Progressively highlights a term inside the study document.
// highlight is a MotionValue 0→1.
const AnimatedDocTerm: React.FC<{ text: string; highlight: MotionValue<number> }> = ({
  text,
  highlight
}) => {
  const color = useTransform(highlight, [0, 1], ['#8A8A8A', '#FFFFFF']);
  const bg = useTransform(
    highlight,
    [0, 1],
    ['rgba(163,255,18,0)', 'rgba(163,255,18,0.10)']
  );
  const underlineScale = useTransform(highlight, [0, 1], [0, 1]);

  return (
    <motion.span className="meaning-doc-term" style={{ color, backgroundColor: bg }}>
      {text}
      <motion.span
        className="meaning-doc-underline"
        style={{ scaleX: underlineScale, transformOrigin: '0% 50%' }}
      />
    </motion.span>
  );
};

// ─── Animated Concept Node ───────────────────────────────────────────────────
// Emerges from its document-text position and physically travels to its settled
// graph position. All driven by the global scroll progress MotionValue.
interface AnimatedNodeProps {
  node: ConceptNodeData;
  progress: MotionValue<number>;
  activeConceptId: string | null;
  activeNeighbors: Set<string>;
  onHover: (id: string) => void;
  onLeave: () => void;
}

const AnimatedNode: React.FC<AnimatedNodeProps> = ({
  node,
  progress,
  activeConceptId,
  activeNeighbors,
  onHover,
  onLeave
}) => {
  // Nodes fade in during late FIND → early CONNECT, travel throughout CONNECT
  const x = useTransform(progress, [0.36, 0.64], [node.docX, node.graphX]);
  const y = useTransform(progress, [0.36, 0.64], [node.docY, node.graphY]);
  const opacity = useTransform(progress, [0.30, 0.42], [0, 1]);

  const isSelected = activeConceptId === node.id;
  const isDimmed = activeConceptId !== null && !activeNeighbors.has(node.id);

  return (
    <motion.div
      className={[
        'meaning-concept-node',
        isSelected ? 'active' : '',
        isDimmed ? 'dimmed' : ''
      ].join(' ')}
      style={{ x, y, opacity: isDimmed ? 0.3 : opacity }}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={onLeave}
      role="button"
      tabIndex={0}
      aria-label={`Concept: ${node.name}`}
    >
      <div className="meaning-node-inner">
        <span
          className="meaning-node-indicator"
          style={{
            backgroundColor: isSelected ? 'var(--accent)' : 'rgba(255,255,255,0.28)'
          }}
          aria-hidden="true"
        />
        <div className="meaning-node-meta">
          <span className="meaning-node-name">{node.name}</span>
          <span className="meaning-node-tag">{node.category}</span>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Animated SVG Edge ───────────────────────────────────────────────────────
// Lines draw themselves progressively during CONNECT stage. Edge endpoints
// follow the same doc→graph interpolation as nodes.
interface AnimatedEdgeProps {
  edge: RelationshipEdgeData;
  index: number;
  nodes: ConceptNodeData[];
  progress: MotionValue<number>;
  activeConceptId: string | null;
}

const AnimatedEdge: React.FC<AnimatedEdgeProps> = ({
  edge,
  index,
  nodes,
  progress,
  activeConceptId
}) => {
  const src = nodes.find((n) => n.id === edge.sourceId);
  const tgt = nodes.find((n) => n.id === edge.targetId);
  if (!src || !tgt) return null;

  // Staggered draw timing: each edge draws sequentially across CONNECT stage
  const drawStart = 0.52 + index * 0.06; // 0.52, 0.58, 0.64
  const drawEnd = drawStart + 0.12;       // 0.64, 0.70, 0.76
  const labelStart = drawStart + 0.06;
  const labelEnd = drawEnd + 0.04;

  // Node coordinates follow the same doc→graph interpolation
  const srcX = useTransform(progress, [0.36, 0.64], [src.docX, src.graphX]);
  const srcY = useTransform(progress, [0.36, 0.64], [src.docY, src.graphY]);
  const tgtX = useTransform(progress, [0.36, 0.64], [tgt.docX, tgt.graphX]);
  const tgtY = useTransform(progress, [0.36, 0.64], [tgt.docY, tgt.graphY]);

  const pathLength = useTransform(progress, [drawStart, drawEnd], [0, 1]);
  const labelOpacity = useTransform(progress, [labelStart, labelEnd], [0, 1]);

  const midX = (src.graphX + tgt.graphX) * 0.5;
  const midY = (src.graphY + tgt.graphY) * 0.5;

  const isActive =
    activeConceptId !== null &&
    (edge.sourceId === activeConceptId || edge.targetId === activeConceptId);

  return (
    <g className="meaning-edge-group">
      <motion.line
        x1={srcX}
        y1={srcY}
        x2={tgtX}
        y2={tgtY}
        stroke={isActive ? 'url(#mtm-edgeGrad)' : 'rgba(255,255,255,0.12)'}
        strokeWidth={isActive ? 1.8 : 1}
        strokeDasharray={isActive ? undefined : '3 4'}
        style={{ pathLength }}
      />
      <foreignObject
        x={midX - 44}
        y={midY - 11}
        width={88}
        height={22}
        className="meaning-edge-label-wrap"
      >
        <motion.div
          className={`meaning-edge-label ${isActive ? 'active' : ''}`}
          style={{ opacity: labelOpacity }}
          title={edge.label}
        >
          {edge.label}
        </motion.div>
      </foreignObject>
    </g>
  );
};
