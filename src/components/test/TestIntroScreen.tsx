import { useState, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ArrowLeft } from 'lucide-react';
import type { KnowledgeTest } from '../../types/test';

interface TestIntroScreenProps {
  test: KnowledgeTest | null;
  conceptsCovered: string[];
  isInsufficientMaterial: boolean;
  onStartTest: () => void;
  onExitTest: () => void;
}

const MAX_DISPLAYED_CONCEPTS = 6;

/**
 * Editorial background topology SVG element with slow breathing animation.
 * Features 5 nodes and hairline relationship edges at 0.08 opacity.
 */
const DecorativeGraphTopology = memo(function DecorativeGraphTopology({
  isTransitioningOut
}: {
  isTransitioningOut: boolean;
}) {
  return (
    <div
      className={`test-faint-graph-backdrop ${isTransitioningOut ? 'receding' : ''}`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 460 360"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="test-topology-svg"
      >
        {/* Hairline relationship edges */}
        <line x1="80" y1="80" x2="260" y2="60" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2 3" opacity="0.4" />
        <line x1="80" y1="80" x2="160" y2="190" stroke="#FFFFFF" strokeWidth="1" opacity="0.5" />
        <line x1="260" y1="60" x2="380" y2="130" stroke="#FFFFFF" strokeWidth="1" opacity="0.6" />
        <line x1="260" y1="60" x2="160" y2="190" stroke="#FFFFFF" strokeWidth="1" opacity="0.3" />
        <line x1="380" y1="130" x2="340" y2="280" stroke="#FFFFFF" strokeWidth="1" opacity="0.5" />
        <line x1="160" y1="190" x2="340" y2="280" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="3 3" opacity="0.35" />
        <line x1="160" y1="190" x2="70" y2="290" stroke="#FFFFFF" strokeWidth="1" opacity="0.45" />

        {/* Dynamic breathing nodes */}
        {/* Node 1 */}
        <circle cx="80" cy="80" r="3" fill="#A1A1A1" className="topology-node node-1" />
        {/* Node 2 — Subtle active GraphMind green accent */}
        <circle cx="260" cy="60" r="3.5" fill="#A3FF12" className="topology-node node-2" />
        <circle cx="260" cy="60" r="7" stroke="#A3FF12" strokeWidth="0.75" opacity="0.4" className="topology-halo halo-2" />
        {/* Node 3 */}
        <circle cx="380" cy="130" r="3" fill="#D4D4D4" className="topology-node node-3" />
        {/* Node 4 */}
        <circle cx="160" cy="190" r="2.5" fill="#8A8A8A" className="topology-node node-4" />
        {/* Node 5 */}
        <circle cx="340" cy="280" r="3" fill="#A1A1A1" className="topology-node node-5" />
        {/* Node 6 */}
        <circle cx="70" cy="290" r="2.5" fill="#8A8A8A" className="topology-node node-6" />
      </svg>
    </div>
  );
});

export function TestIntroScreen({
  test,
  conceptsCovered,
  isInsufficientMaterial,
  onStartTest,
  onExitTest
}: TestIntroScreenProps) {
  // State for coordinated assessment transition (Section 21)
  const [isTransitioningOut, setIsTransitioningOut] = useState(false);

  // Intentional line wrapping for dominant hero title (Section 4 & 17)
  const titleLines = useMemo(() => {
    if (!test?.title) {
      return ['Knowledge', 'Graph', 'Assessment.'];
    }
    const cleanTitle = test.title.trim();
    if (
      cleanTitle.toLowerCase() === 'knowledge graph assessment' ||
      cleanTitle.toLowerCase().includes('knowledge graph assessment')
    ) {
      return ['Knowledge', 'Graph', 'Assessment.'];
    }
    const words = cleanTitle.split(/\s+/);
    if (words.length === 1) {
      return [words[0], 'Assessment.'];
    }
    if (words.length === 2) {
      return [words[0], words[1], 'Assessment.'];
    }
    if (words.length === 3) {
      return [words[0], words[1], words[2]];
    }
    // For longer titles, break into 2 or 3 balanced editorial lines
    const half = Math.ceil(words.length / 2);
    return [
      words.slice(0, half).join(' '),
      `${words.slice(half).join(' ')}.`
    ];
  }, [test?.title]);

  // Concept coverage subset
  const visibleConcepts = useMemo(() => {
    return conceptsCovered.slice(0, MAX_DISPLAYED_CONCEPTS);
  }, [conceptsCovered]);

  const remainingConceptsCount = Math.max(
    0,
    conceptsCovered.length - MAX_DISPLAYED_CONCEPTS
  );

  // Trigger choreographed transition into the exam workspace
  const handleStartExam = () => {
    if (isTransitioningOut) return;
    setIsTransitioningOut(true);
    setTimeout(() => {
      onStartTest();
    }, 320);
  };

  // Insufficient study material state
  if (isInsufficientMaterial || !test) {
    return (
      <motion.div
        className="test-intro-editorial-wrap test-insufficient-wrap"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -16 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="test-intro-left-zone">
          <div className="test-intro-eyebrow">
            <span className="test-eyebrow-marker" aria-hidden="true" />
            <span>TEST / 01</span>
          </div>

          <h1 className="test-editorial-hero-title">
            <span className="test-hero-title-line">Insufficient</span>
            <span className="test-hero-title-line">Material.</span>
          </h1>

          <p className="test-editorial-description">
            GraphMind requires sufficient concept definitions and relationships extracted from your uploaded study material to construct a grounded, authentic examination.
          </p>

          <button
            type="button"
            className="test-editorial-back-link"
            onClick={onExitTest}
            autoFocus
          >
            <span className="test-back-arrow" aria-hidden="true">←</span>
            <span>Back to graph</span>
          </button>
        </div>
      </motion.div>
    );
  }

  const questionCount = test.questions.length;
  const minutes = Math.round(test.timeLimitSeconds / 60);

  const metadataItems = [
    { value: questionCount.toString(), label: 'QUESTIONS' },
    { value: `${minutes} MIN`, label: 'TIME LIMIT' },
    { value: 'MCQ', label: 'FORMAT' }
  ];

  return (
    <div className={`test-intro-editorial-wrap ${isTransitioningOut ? 'transitioning-to-exam' : ''}`}>
      {/* Editorial Two-Zone Continuous Layout */}
      <div className="test-intro-two-zone-grid">
        {/* ==============================================================
            LEFT ZONE: Eyebrow, Hero Title, Description, Primary Action
            ============================================================== */}
        <div className="test-intro-left-zone">
          {/* STEP 1: Quiet Eyebrow */}
          <motion.div
            className="test-intro-eyebrow"
            initial={{ opacity: 0, y: -8 }}
            animate={isTransitioningOut ? { opacity: 0, y: -4 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="test-eyebrow-marker" aria-hidden="true" />
            <span>TEST / 01</span>
          </motion.div>

          {/* STEP 2: Line-Level Masked Dominant Hero Title */}
          <h1
            className="test-editorial-hero-title"
            aria-label={test.title || 'Knowledge Graph Assessment'}
          >
            {titleLines.map((line, idx) => (
              <span key={idx} className="test-hero-title-line-mask">
                <motion.span
                  className="test-hero-title-line"
                  initial={{ y: '110%', clipPath: 'inset(0 0 100% 0)' }}
                  animate={
                    isTransitioningOut
                      ? { y: '-28px', opacity: 0, clipPath: 'inset(100% 0 0% 0)' }
                      : { y: '0%', opacity: 1, clipPath: 'inset(0 0 0% 0)' }
                  }
                  transition={{
                    duration: isTransitioningOut ? 0.3 : 0.72,
                    delay: isTransitioningOut ? 0 : 0.08 + idx * 0.085,
                    ease: [0.16, 1, 0.3, 1]
                  }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>

          {/* STEP 3: Supporting Description */}
          <motion.p
            className="test-editorial-description"
            initial={{ opacity: 0, y: 16 }}
            animate={isTransitioningOut ? { opacity: 0, y: -10 } : { opacity: 1, y: 0 }}
            transition={{
              duration: isTransitioningOut ? 0.25 : 0.48,
              delay: isTransitioningOut ? 0 : 0.24,
              ease: [0.16, 1, 0.3, 1]
            }}
          >
            Measure how well you've understood the material behind this graph.
          </motion.p>

          {/* STEP 6 & Primary Action: Start Test with Tactile Underline Micro-Animation */}
          <div className="test-editorial-action-container">
            <button
              type="button"
              className="test-start-editorial-btn"
              onClick={handleStartExam}
              disabled={isTransitioningOut}
              autoFocus
              aria-label="Start test"
            >
              <div className="test-start-label-row">
                <span>START TEST</span>
                <span className="test-start-arrow" aria-hidden="true">
                  <ArrowRight size={15} strokeWidth={2.2} />
                </span>
              </div>
              <div className="test-start-underline-track" aria-hidden="true">
                <div
                  className={`test-start-underline-fill ${isTransitioningOut ? 'active-transition' : ''}`}
                />
                <div className="test-start-underline-accent" />
              </div>
            </button>
          </div>
        </div>

        {/* ==============================================================
            RIGHT ZONE: Metadata Row, Editorial Concept Index, Back Link
            ============================================================== */}
        <div className="test-intro-right-zone">
          {/* STEP 4: Editorial Test Metadata Row */}
          <motion.div
            className="test-editorial-metadata-row"
            role="region"
            aria-label="Test specifications"
            initial={{ opacity: 0, y: 12 }}
            animate={
              isTransitioningOut
                ? { opacity: 0, scale: 0.96, y: -8 }
                : { opacity: 1, scale: 1, y: 0 }
            }
            transition={{
              duration: isTransitioningOut ? 0.25 : 0.45,
              delay: isTransitioningOut ? 0 : 0.2,
              ease: [0.16, 1, 0.3, 1]
            }}
          >
            {metadataItems.map((item, idx) => (
              <div key={item.label} className="test-meta-col">
                <div className="test-meta-num-wrap">
                  <motion.span
                    className="test-meta-number"
                    initial={{ y: 16, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{
                      duration: 0.46,
                      delay: 0.28 + idx * 0.07,
                      ease: [0.16, 1, 0.3, 1]
                    }}
                  >
                    {item.value}
                  </motion.span>
                </div>
                <span className="test-meta-label">{item.label}</span>
              </div>
            ))}
          </motion.div>

          {/* STEP 5: Editorial Numbered Concept Index (No Pills, 2 Columns) */}
          <motion.div
            className="test-editorial-concepts-section"
            initial={{ opacity: 0 }}
            animate={
              isTransitioningOut
                ? { opacity: 0, x: 20 }
                : { opacity: 1, x: 0 }
            }
            transition={{
              duration: isTransitioningOut ? 0.25 : 0.45,
              delay: isTransitioningOut ? 0 : 0.32,
              ease: [0.16, 1, 0.3, 1]
            }}
          >
            <div className="test-concepts-header">CONCEPTS COVERED</div>

            <div className="test-concept-index-grid" role="list">
              {visibleConcepts.map((conceptName, idx) => {
                const rowNum = (idx + 1).toString().padStart(2, '0');
                return (
                  <div key={conceptName} className="test-concept-row-wrap" role="listitem">
                    <div className="test-concept-row">
                      <div className="test-concept-left">
                        <motion.span
                          className="test-concept-num"
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{
                            duration: 0.35,
                            delay: 0.36 + idx * 0.045,
                            ease: [0.16, 1, 0.3, 1]
                          }}
                        >
                          {rowNum}
                        </motion.span>
                        <span className="test-concept-name" title={conceptName}>
                          {conceptName}
                        </span>
                      </div>
                      <span className="test-concept-arrow" aria-hidden="true">
                        ↗
                      </span>
                    </div>

                    {/* Divider that grows from left to right */}
                    <motion.div
                      className="test-concept-row-divider"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{
                        duration: 0.4,
                        delay: 0.34 + idx * 0.045,
                        ease: [0.16, 1, 0.3, 1]
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Remainder indicator if > 6 concepts */}
            {remainingConceptsCount > 0 && (
              <motion.div
                className="test-concepts-more-indicator"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.65 }}
              >
                + {remainingConceptsCount} more concepts
              </motion.div>
            )}
          </motion.div>

          {/* Section 13: Quiet Back to Graph Link */}
          <button
            type="button"
            className="test-editorial-back-link"
            onClick={onExitTest}
            disabled={isTransitioningOut}
            title="Return to knowledge graph"
          >
            <span className="test-back-arrow" aria-hidden="true">
              <ArrowLeft size={13} />
            </span>
            <span>Back to graph</span>
          </button>
        </div>
      </div>

      {/* Section 14 & 15: Decorative Living Graph Topology Behind Right Zone */}
      <DecorativeGraphTopology isTransitioningOut={isTransitioningOut} />
    </div>
  );
}
