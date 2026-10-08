import { useState, useMemo } from 'react';
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

export function TestIntroScreen({
  test,
  conceptsCovered,
  isInsufficientMaterial,
  onStartTest,
  onExitTest
}: TestIntroScreenProps) {
  // State for coordinated assessment transition (Section 14)
  const [isTransitioningOut, setIsTransitioningOut] = useState(false);

  // Intentional line wrapping for dominant hero title (Section 1 & 2)
  // Keeps desktop composition strictly as:
  // Knowledge
  // Graph
  // Assessment.
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
            <div className="test-eyebrow-graph-datum">
              <span className="test-eyebrow-marker" aria-hidden="true" />
              <span className="test-eyebrow-datum-rule" aria-hidden="true" />
            </div>
            <span className="test-eyebrow-text">TEST / 01</span>
          </div>

          <h1 className="test-editorial-hero-title">
            <span className="test-hero-title-line-mask">
              <span className="test-hero-title-line">Insufficient</span>
            </span>
            <span className="test-hero-title-line-mask">
              <span className="test-hero-title-line">Material.</span>
            </span>
          </h1>

          <p className="test-editorial-description">
            GraphMind requires sufficient concept definitions and relationships extracted from your uploaded study material to construct a grounded, authentic examination.
          </p>

          <button
            type="button"
            className="test-editorial-back-link test-insufficient-back"
            onClick={onExitTest}
            autoFocus
          >
            <span className="test-back-arrow" aria-hidden="true">
              <ArrowLeft size={13} />
            </span>
            <span className="test-back-label">Back to graph</span>
          </button>
        </div>
      </motion.div>
    );
  }

  const questionCount = test.questions.length;
  const minutes = Math.round(test.timeLimitSeconds / 60);

  // Three equal-width editorial columns (Section 4 & 6)
  const assessmentMetrics = [
    {
      index: '01',
      value: questionCount.toString().padStart(2, '0'),
      label: 'QUESTIONS',
      isAccent: true
    },
    {
      index: '02',
      value: `${minutes} MIN`,
      label: 'TIME LIMIT',
      isAccent: false
    },
    {
      index: '03',
      value: 'MCQ',
      label: 'FORMAT',
      isAccent: false
    }
  ];

  return (
    <div className={`test-intro-editorial-wrap ${isTransitioningOut ? 'transitioning-to-exam' : ''}`}>
      {/* Editorial Two-Zone Continuous Layout */}
      <div className="test-intro-two-zone-grid">
        {/* ==============================================================
            LEFT ZONE: Eyebrow, Hero Title, Description, Primary Action
            ============================================================== */}
        <div className="test-intro-left-zone">
          {/* STEP 1: Eyebrow Detail: ●──────────── TEST / 01 (Section 14: A, B, C) */}
          <motion.div
            className="test-intro-eyebrow"
            initial={{ opacity: 0, y: -6 }}
            animate={isTransitioningOut ? { opacity: 0, y: -4 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="test-eyebrow-graph-datum">
              <motion.span
                className="test-eyebrow-marker"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.28, delay: 0.02, ease: [0.16, 1, 0.3, 1] }}
                aria-hidden="true"
              />
              <motion.span
                className="test-eyebrow-datum-rule"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.36, delay: 0.06, ease: [0.16, 1, 0.3, 1] }}
                aria-hidden="true"
              />
            </div>
            <span className="test-eyebrow-text">TEST / 01</span>
          </motion.div>

          {/* STEP 2: Mask-Revealed Dominant Hero Title with Knowledge Mapping Marker (Section 1, 2, 14: D, 15) */}
          <h1
            className="test-editorial-hero-title"
            aria-label={test.title || 'Knowledge Graph Assessment'}
          >
            {titleLines.map((line, idx) => {
              const isGraphLine = line.toLowerCase().trim() === 'graph' || (titleLines.length === 3 && idx === 1);
              return (
                <span key={idx} className="test-hero-title-line-mask">
                  <motion.span
                    className="test-hero-title-line"
                    initial={{ y: '110%' }}
                    animate={
                      isTransitioningOut
                        ? { y: '-100%', opacity: 0 }
                        : { y: '0%', opacity: 1 }
                    }
                    transition={{
                      duration: isTransitioningOut ? 0.25 : 0.48,
                      delay: isTransitioningOut
                        ? 0
                        : 0.12 + idx * 0.07,
                      ease: [0.16, 1, 0.3, 1]
                    }}
                  >
                    <span className="test-hero-title-text">{line}</span>

                    {/* Subtle Knowledge Mapping Marker: •──── aligned near "Graph" (Section 1) */}
                    {isGraphLine && (
                      <span className="test-hero-mapping-marker" aria-hidden="true">
                        <motion.span
                          className="test-mapping-node"
                          initial={{ scale: 0 }}
                          animate={isTransitioningOut ? { scale: 0 } : { scale: 1 }}
                          transition={{ duration: 0.24, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
                        />
                        <motion.span
                          className="test-mapping-connector"
                          initial={{ scaleX: 0 }}
                          animate={isTransitioningOut ? { scaleX: 0 } : { scaleX: 1 }}
                          transition={{ duration: 0.3, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
                        />
                      </span>
                    )}
                  </motion.span>
                </span>
              );
            })}
          </h1>

          {/* STEP 3: Editorial Description */}
          <motion.p
            className="test-editorial-description"
            initial={{ opacity: 0, y: 14 }}
            animate={isTransitioningOut ? { opacity: 0, y: -10 } : { opacity: 1, y: 0 }}
            transition={{
              duration: isTransitioningOut ? 0.25 : 0.45,
              delay: isTransitioningOut ? 0 : 0.36,
              ease: [0.16, 1, 0.3, 1]
            }}
          >
            Measure how well you've understood the material behind this graph.
          </motion.p>

          {/* STEP 4 & Primary Action: Start Test Text-Link with Thin Rule Micro-Interaction (Section 10 & 14: H) */}
          <motion.div
            className="test-editorial-action-container"
            initial={{ opacity: 0, y: 12 }}
            animate={isTransitioningOut ? { opacity: 0, y: -6 } : { opacity: 1, y: 0 }}
            transition={{
              duration: isTransitioningOut ? 0.2 : 0.42,
              delay: isTransitioningOut ? 0 : 0.54,
              ease: [0.16, 1, 0.3, 1]
            }}
          >
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
              </div>
            </button>
          </motion.div>
        </div>

        {/* ==============================================================
            RIGHT ZONE: Editorial Assessment Index & Concepts (Section 4, 5, 8, 9, 13)
            ============================================================== */}
        <div className="test-intro-right-zone">
          {/* Top Contextual Navigation (Section 1 & 2): ← Back to graph */}
          <button
            type="button"
            className="test-editorial-back-link"
            onClick={onExitTest}
            disabled={isTransitioningOut}
            aria-label="Return to knowledge graph"
          >
            <span className="test-back-arrow" aria-hidden="true">
              <ArrowLeft size={13} />
            </span>
            <span className="test-back-label">Back to graph</span>
          </button>

          {/* STEP 5: Editorial Assessment Statistics Index with 3 Columns & Vertical Dividers (Section 4, 5, 6, 14: E, 16) */}
          <div className="test-editorial-assessment-block" role="region" aria-label="Assessment specifications">
            <div className="test-assessment-header">
              <span>ASSESSMENT</span>
            </div>

            <div className="test-editorial-stats-row">
              {assessmentMetrics.map((item, idx) => (
                <div key={item.label} className="test-stats-col-cell">
                  {/* Subtle vertical divider between statistics (Section 5) */}
                  {idx > 0 && (
                    <motion.div
                      className="test-stats-divider-line"
                      initial={{ scaleY: 0 }}
                      animate={isTransitioningOut ? { scaleY: 0 } : { scaleY: 1 }}
                      transition={{
                        duration: 0.38,
                        delay: isTransitioningOut ? 0 : 0.24 + idx * 0.05,
                        ease: [0.16, 1, 0.3, 1]
                      }}
                      aria-hidden="true"
                    />
                  )}

                  <div className="test-stats-col-content">
                    {/* Index number: 01 in green accent, 02 and 03 in muted gray (Section 4 & 6) */}
                    <div className="test-stats-index-num">
                      <span className={item.isAccent ? 'test-index-accent-green' : 'test-index-muted'}>
                        {item.index}
                      </span>
                    </div>

                    {/* Metric Value: Unclipped 42-54px typography (Section 4 & 16) */}
                    <div className="test-stats-value-wrap">
                      <motion.span
                        className="test-stats-value"
                        initial={{ y: 18, opacity: 0 }}
                        animate={
                          isTransitioningOut
                            ? { y: -12, opacity: 0 }
                            : { y: 0, opacity: 1 }
                        }
                        transition={{
                          duration: 0.42,
                          delay: isTransitioningOut ? 0 : 0.28 + idx * 0.06,
                          ease: [0.16, 1, 0.3, 1]
                        }}
                      >
                        {item.value}
                      </motion.span>
                    </div>

                    {/* Metric Label: 9-10px uppercase #777777 */}
                    <span className="test-stats-label">{item.label}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Horizontal divider rule separating Assessment metrics from Concepts (Section 9) */}
            <div className="test-assessment-horizontal-divider" />
          </div>

          {/* STEP 6: Editorial Numbered Concept Index (Section 8 & 9) */}
          <div className="test-editorial-concepts-section">
            <div className="test-concepts-header">CONCEPTS COVERED</div>

            <div className="test-concept-index-grid" role="list">
              {visibleConcepts.map((conceptName, idx) => {
                const rowNum = (idx + 1).toString().padStart(2, '0');
                return (
                  <div key={conceptName} className="test-concept-row-wrap" role="listitem">
                    <div className="test-concept-row">
                      <div className="test-concept-left">
                        <span className="test-concept-num">
                          {rowNum}
                        </span>
                        <span className="test-concept-name-mask">
                          <motion.span
                            className="test-concept-name"
                            initial={{ y: '100%', opacity: 0 }}
                            animate={
                              isTransitioningOut
                                ? { y: '-100%', opacity: 0 }
                                : { y: '0%', opacity: 1 }
                            }
                            transition={{
                              duration: 0.36,
                              delay: isTransitioningOut ? 0 : 0.36 + idx * 0.03,
                              ease: [0.16, 1, 0.3, 1]
                            }}
                          >
                            {conceptName}
                          </motion.span>
                        </span>
                      </div>
                    </div>

                    <motion.div
                      className="test-concept-row-divider"
                      initial={{ scaleX: 0 }}
                      animate={isTransitioningOut ? { scaleX: 0 } : { scaleX: 1 }}
                      transition={{
                        duration: 0.32,
                        delay: isTransitioningOut ? 0 : 0.32 + idx * 0.03,
                        ease: [0.16, 1, 0.3, 1]
                      }}
                      style={{ transformOrigin: 'left' }}
                    >
                      <div className="test-concept-row-divider-accent" aria-hidden="true" />
                    </motion.div>
                  </div>
                );
              })}
            </div>

            {/* Remainder indicator: + 6 MORE CONCEPTS (Section 8 & 9) */}
            {remainingConceptsCount > 0 && (
              <motion.div
                className="test-concepts-more-indicator"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35, delay: 0.5 }}
              >
                + {remainingConceptsCount} MORE CONCEPTS
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
