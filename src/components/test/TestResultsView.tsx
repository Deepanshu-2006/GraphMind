import { useState, useEffect, useLayoutEffect, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { TestResultsSummary, KnowledgeTest } from '../../types/test';
import type { KnowledgeGraph } from '../../types/knowledgeGraph';
import {
  CircularPerformanceVisual,
  type QuestionResultItem
} from './CircularPerformanceVisual';

export interface TestResultsViewProps {
  results: TestResultsSummary;
  test?: KnowledgeTest | null;
  graph?: KnowledgeGraph | null;
  onReviewAnswers: () => void;
  onReviewMissedConcepts: () => void;
  onBackToGraph: () => void;
  onSelectConceptToReview?: (conceptId: string) => void;
}

export interface ScoreInterpretation {
  headline: string;
  statement: string;
  narrative: string;
  tone: 'positive' | 'warning';
}

/**
 * Score-derived assessment statements (Section 8)
 * 90–100%: Strong command of the material.
 * 70–89%: Solid understanding with a few gaps to revisit.
 * 50–69%: Core ideas are forming. A focused review will strengthen the connections.
 * 0–49%: Several foundational concepts need reinforcement.
 */
export function getScoreInterpretation(percentage: number): ScoreInterpretation {
  if (percentage >= 90) {
    return {
      headline: 'STRONG UNDERSTANDING',
      statement: 'Strong command of the material.',
      narrative: 'Strong command of the material. Your knowledge graph connections are solidly retained across this domain.',
      tone: 'positive'
    };
  }
  if (percentage >= 70) {
    return {
      headline: 'SOLID UNDERSTANDING',
      statement: 'Solid understanding with a few gaps to revisit.',
      narrative: 'Solid understanding with a few gaps to revisit. A focused review of the highlighted material will help solidify complete mastery.',
      tone: 'positive'
    };
  }
  if (percentage >= 50) {
    return {
      headline: 'BUILDING UNDERSTANDING',
      statement: 'Core ideas are forming. A focused review will strengthen the connections.',
      narrative: 'Core ideas are forming. A focused review will strengthen the connections across your knowledge graph.',
      tone: 'warning'
    };
  }
  return {
    headline: 'NEEDS REVIEW',
    statement: 'Several foundational concepts need reinforcement.',
    narrative: 'Several foundational concepts need reinforcement. A focused review of the concepts you missed will help strengthen the connections in your knowledge graph.',
    tone: 'warning'
  };
}

export const TestResultsView = memo(function TestResultsView({
  results,
  test,
  graph,
  onReviewAnswers,
  onReviewMissedConcepts,
  onBackToGraph,
  onSelectConceptToReview
}: TestResultsViewProps) {
  // Exit transition states (Section 22)
  const [isExiting, setIsExiting] = useState(false);
  const [exitTarget, setExitTarget] = useState<'missed' | 'graph' | null>(null);

  // SCROLL FIX: Ensure results page always opens scrolled to the very top (0, 0)
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    const rootEl = document.querySelector('.test-workspace-root');
    if (rootEl) {
      rootEl.scrollTop = 0;
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
      const rootEl = document.querySelector('.test-workspace-root');
      if (rootEl) {
        rootEl.scrollTop = 0;
      }
    }, 40);
    return () => clearTimeout(timer);
  }, []);

  // Elapsed time format (MM:SS)
  const mins = Math.floor(results.timeSpentSeconds / 60);
  const secs = results.timeSpentSeconds % 60;
  const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  // Score interpretation
  const interpretation = useMemo(() => {
    return getScoreInterpretation(results.percentage);
  }, [results.percentage]);

  // Derive per-question results with status (correct, incorrect, unanswered)
  const questionItems: QuestionResultItem[] = useMemo(() => {
    if (test?.questions && test.questions.length > 0) {
      return test.questions.map((q, idx) => {
        const missedItem = results.reviewRecommendedConcepts.find(m => m.questionId === q.id);
        const isMissed = Boolean(missedItem);
        const isCorrect = !isMissed;
        const isUnanswered = isMissed && (!missedItem?.selectedOptionText || missedItem?.selectedOptionText === '');

        return {
          questionNumber: idx + 1,
          questionId: q.id,
          isCorrect,
          status: isCorrect ? 'correct' : isUnanswered ? 'unanswered' : 'incorrect',
          conceptName: q.conceptNames?.[0] || 'Concept',
          questionText: q.question
        };
      });
    }

    // High-fidelity fallback based on results summary
    const total = results.totalQuestions;
    const correctCount = results.score;
    const missedConcepts = results.reviewRecommendedConcepts;
    const strongConcepts = results.strongConceptNames;

    return Array.from({ length: total }, (_, idx) => {
      const isCorrect = idx < correctCount;
      const conceptName = isCorrect
        ? strongConcepts[idx % Math.max(1, strongConcepts.length)] || 'Core Concept'
        : missedConcepts[(idx - correctCount) % Math.max(1, missedConcepts.length)]?.conceptName ||
          'Review Concept';

      return {
        questionNumber: idx + 1,
        questionId: `q-${idx + 1}`,
        isCorrect,
        status: isCorrect ? 'correct' : 'incorrect',
        conceptName
      };
    });
  }, [
    test?.questions,
    results.reviewRecommendedConcepts,
    results.totalQuestions,
    results.score,
    results.strongConceptNames
  ]);

  // Concept ID resolution helper
  const findConceptId = useMemo(() => {
    return (name: string): string => {
      if (test?.questions) {
        for (const q of test.questions) {
          const idx = q.conceptNames?.findIndex(cn => cn.toLowerCase() === name.toLowerCase());
          if (idx !== -1 && q.conceptIds?.[idx]) {
            return q.conceptIds[idx];
          }
        }
      }
      if (graph?.nodes) {
        const node = graph.nodes.find(n => n.name?.toLowerCase() === name.toLowerCase());
        if (node) return node.id;
      }
      return name.toLowerCase().replace(/\s+/g, '-');
    };
  }, [test?.questions, graph?.nodes]);

  // Deduplicated concept lists for knowledge report
  const uniqueStrongConcepts = useMemo(() => {
    const list: { id: string; name: string }[] = [];
    const seen = new Set<string>();
    for (const name of results.strongConceptNames) {
      if (!seen.has(name)) {
        seen.add(name);
        list.push({ id: findConceptId(name), name });
      }
    }
    return list;
  }, [results.strongConceptNames, findConceptId]);

  const uniqueReviewConcepts = useMemo(() => {
    const seen = new Set<string>();
    const list: { id: string; name: string }[] = [];
    for (const item of results.reviewRecommendedConcepts) {
      if (!seen.has(item.conceptName)) {
        seen.add(item.conceptName);
        list.push({ id: item.conceptId || findConceptId(item.conceptName), name: item.conceptName });
      }
    }
    return list;
  }, [results.reviewRecommendedConcepts, findConceptId]);

  const hasMissed = uniqueReviewConcepts.length > 0;

  // Actionable concept selection: bridges student back to knowledge graph (Section 12)
  const handleSelectConcept = (conceptId: string) => {
    if (isExiting) return;
    setIsExiting(true);
    setExitTarget('graph');
    setTimeout(() => {
      onSelectConceptToReview?.(conceptId);
    }, 480);
  };

  // Choreographed transitions (Section 14 & 22)
  const handleReviewMissed = () => {
    if (isExiting) return;
    setIsExiting(true);
    setExitTarget('missed');
    setTimeout(() => {
      onReviewMissedConcepts();
    }, 480);
  };

  const handleBackToGraph = () => {
    if (isExiting) return;
    setIsExiting(true);
    setExitTarget('graph');
    setTimeout(() => {
      onBackToGraph();
    }, 480);
  };

  return (
    <div className={`test-results-editorial-wrap ${isExiting ? 'results-exiting' : ''}`}>
      {/* ==============================================================
          TOP CONTEXTUAL NAVIGATION (Section 4)
          Left: Eyebrow • TEST / RESULTS
          Right: ← BACK TO GRAPH
          ============================================================== */}
      <div className="results-top-nav-row">
        <motion.div
          className="results-eyebrow"
          initial={{ opacity: 0, y: -6 }}
          animate={isExiting ? { opacity: 0, y: -4 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="results-eyebrow-marker" aria-hidden="true" />
          <span>TEST / RESULTS</span>
        </motion.div>

        <motion.button
          type="button"
          className="results-quiet-back-btn results-top-back-btn"
          onClick={handleBackToGraph}
          disabled={isExiting}
          title="Return to knowledge graph"
          initial={{ opacity: 0, y: -6 }}
          animate={isExiting ? { opacity: 0, y: -4 } : { opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="back-arrow" aria-hidden="true">←</span>
          <span>BACK TO GRAPH</span>
        </motion.button>
      </div>

      {/* ==============================================================
          HERO COMPOSITION (Section 1, 2, 5, 6, 7, 10, 15)
          Left: TEST COMPLETE + Concise Qualitative Interpretation
          Right: Circular Performance Hero Score + Directly Attached Review Actions
          ============================================================== */}
      <div className="results-hero-two-column-grid">
        {/* LEFT COLUMN: Narrative & Qualitative Interpretation (Section 2) */}
        <div className="results-hero-left-column">
          {/* Heading: TEST COMPLETE */}
          <h1 className="results-hero-title">
            <span className="results-title-line-mask">
              <motion.span
                className="results-title-line"
                initial={{ y: '110%', clipPath: 'inset(0 0 100% 0)' }}
                animate={
                  isExiting
                    ? { y: '-28px', opacity: 0, clipPath: 'inset(100% 0 0% 0)' }
                    : { y: '0%', opacity: 1, clipPath: 'inset(0 0 0% 0)' }
                }
                transition={{
                  duration: 0.65,
                  delay: isExiting ? 0.24 : 0.08,
                  ease: [0.16, 1, 0.3, 1]
                }}
              >
                TEST
              </motion.span>
            </span>
            <span className="results-title-line-mask">
              <motion.span
                className="results-title-line"
                initial={{ y: '110%', clipPath: 'inset(0 0 100% 0)' }}
                animate={
                  isExiting
                    ? { y: '-28px', opacity: 0, clipPath: 'inset(100% 0 0% 0)' }
                    : { y: '0%', opacity: 1, clipPath: 'inset(0 0 0% 0)' }
                }
                transition={{
                  duration: 0.65,
                  delay: isExiting ? 0.24 : 0.16,
                  ease: [0.16, 1, 0.3, 1]
                }}
              >
                COMPLETE
              </motion.span>
            </span>
          </h1>

          {/* Performance Interpretation Block (Section 2) */}
          <motion.div
            className="results-interpretation-block"
            initial={{ opacity: 0, y: 14 }}
            animate={
              isExiting
                ? { opacity: 0, y: -10, transition: { duration: 0.22, delay: 0.06, ease: [0.16, 1, 0.3, 1] } }
                : { opacity: 1, y: 0, transition: { duration: 0.45, delay: 0.26, ease: [0.16, 1, 0.3, 1] } }
            }
          >
            <div className={`results-interpretation-heading ${interpretation.tone}`}>
              <span className="interpretation-marker" aria-hidden="true" />
              <span>{interpretation.headline}</span>
            </div>
            <p className="results-interpretation-text">
              {interpretation.narrative}
            </p>
          </motion.div>
        </div>

        {/* RIGHT COLUMN: Circular Performance Visualization & Primary Actions (Section 1, 3, 5, 6, 7) */}
        <div className="results-hero-right-column">
          <div className="results-hero-right-inner">
            <CircularPerformanceVisual
              score={results.score}
              totalQuestions={results.totalQuestions}
              percentage={results.percentage}
              timeFormatted={timeFormatted}
              questionItems={questionItems}
              isExiting={isExiting}
              exitTarget={exitTarget}
              onSelectQuestion={(item) => {
                if (!item.isCorrect && hasMissed) {
                  handleReviewMissed();
                }
              }}
            />

            {/* Review actions directly below the circle (Section 6, 7 & 12) */}
            <div className="results-circle-actions">
              {hasMissed ? (
                <motion.button
                  type="button"
                  className="results-primary-action-btn results-editorial-primary-action"
                  onClick={handleReviewMissed}
                  disabled={isExiting}
                  autoFocus
                  initial={{ opacity: 0, x: -8, clipPath: 'inset(0 100% 0 0)' }}
                  animate={
                    isExiting
                      ? { opacity: 0, x: -6 }
                      : { opacity: 1, x: 0, clipPath: 'inset(0 0% 0 0)' }
                  }
                  transition={{
                    duration: 0.42,
                    delay: isExiting ? 0.05 : 0.95,
                    ease: [0.16, 1, 0.3, 1]
                  }}
                >
                  <span className="editorial-action-text">REVIEW MISSED CONCEPTS</span>
                  <ArrowRight size={14} className="editorial-action-arrow" aria-hidden="true" />
                  <span className="editorial-action-underline" aria-hidden="true" />
                </motion.button>
              ) : (
                <motion.button
                  type="button"
                  className="results-primary-action-btn results-editorial-primary-action"
                  onClick={handleBackToGraph}
                  disabled={isExiting}
                  autoFocus
                  initial={{ opacity: 0, x: -8, clipPath: 'inset(0 100% 0 0)' }}
                  animate={
                    isExiting
                      ? { opacity: 0, x: -6 }
                      : { opacity: 1, x: 0, clipPath: 'inset(0 0% 0 0)' }
                  }
                  transition={{
                    duration: 0.42,
                    delay: isExiting ? 0.05 : 0.95,
                    ease: [0.16, 1, 0.3, 1]
                  }}
                >
                  <span className="editorial-action-text">RETURN TO GRAPH</span>
                  <ArrowRight size={14} className="editorial-action-arrow" aria-hidden="true" />
                  <span className="editorial-action-underline" aria-hidden="true" />
                </motion.button>
              )}

              <motion.button
                type="button"
                className="results-secondary-text-btn results-editorial-secondary-action"
                onClick={onReviewAnswers}
                disabled={isExiting}
                initial={{ opacity: 0, x: -6, clipPath: 'inset(0 100% 0 0)' }}
                animate={
                  isExiting
                    ? { opacity: 0, x: -4 }
                    : { opacity: 1, x: 0, clipPath: 'inset(0 0% 0 0)' }
                }
                transition={{
                  duration: 0.38,
                  delay: isExiting ? 0.02 : 1.08,
                  ease: [0.16, 1, 0.3, 1]
                }}
              >
                <span className="editorial-secondary-text">REVIEW ALL ANSWERS</span>
                <span className="editorial-secondary-arrow" aria-hidden="true">→</span>
              </motion.button>
            </div>
          </div>
        </div>
      </div>

      {/* Major Divider */}
      <div className="results-major-divider" aria-hidden="true" />

      {/* ==============================================================
          EDITORIAL KNOWLEDGE INDEX (Section 9, 10, 13)
          Two-column index: WHAT YOU KNOW | WORTH REVISITING
          Simple rows with subtle dividers (no cards)
          ============================================================== */}
      <motion.div
        className="results-knowledge-report-section"
        initial={{ opacity: 0, y: 16 }}
        animate={
          isExiting
            ? { opacity: 0, y: 14, transition: { duration: 0.22, delay: 0, ease: [0.16, 1, 0.3, 1] } }
            : { opacity: 1, y: 0, transition: { duration: 0.48, delay: 0.48, ease: [0.16, 1, 0.3, 1] } }
        }
      >
        <div className="results-knowledge-columns-grid">
          {/* Column 1: WHAT YOU KNOW */}
          <div className="knowledge-column">
            <div className="knowledge-column-header">
              <span className="knowledge-header-title">WHAT YOU KNOW</span>
              <span className="knowledge-header-count">
                {uniqueStrongConcepts.length.toString().padStart(2, '0')}
              </span>
            </div>

            <div className="knowledge-concept-list" role="list">
              {uniqueStrongConcepts.length > 0 ? (
                uniqueStrongConcepts.map((item, idx) => (
                  <motion.div
                    key={item.id || item.name}
                    className="knowledge-concept-row-wrap"
                    role="listitem"
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-20px' }}
                    transition={{
                      duration: 0.28,
                      delay: Math.min(0.24, idx * 0.035),
                      ease: [0.16, 1, 0.3, 1]
                    }}
                  >
                    <button
                      type="button"
                      className="knowledge-concept-row"
                      onClick={() => handleSelectConcept(item.id)}
                      title={`Focus "${item.name}" in knowledge graph`}
                    >
                      <div className="concept-row-left">
                        <span className="concept-index-num">
                          {(idx + 1).toString().padStart(2, '0')}
                        </span>
                        <span className="concept-row-name" title={item.name}>
                          {item.name}
                        </span>
                      </div>
                      <span className="concept-status-sign sign-positive" aria-hidden="true">
                        +
                      </span>
                    </button>
                    <div className="knowledge-row-divider" />
                  </motion.div>
                ))
              ) : (
                <div className="knowledge-empty-row">
                  <span>No mastered concepts in this session.</span>
                </div>
              )}
            </div>
          </div>

          {/* Column 2: WORTH REVISITING */}
          <div className="knowledge-column">
            <div className="knowledge-column-header">
              <span className="knowledge-header-title">WORTH REVISITING</span>
              <span className="knowledge-header-count">
                {uniqueReviewConcepts.length.toString().padStart(2, '0')}
              </span>
            </div>

            <div className="knowledge-concept-list" role="list">
              {uniqueReviewConcepts.length > 0 ? (
                uniqueReviewConcepts.map((item, idx) => (
                  <motion.div
                    key={item.id || item.name}
                    className="knowledge-concept-row-wrap"
                    role="listitem"
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '-20px' }}
                    transition={{
                      duration: 0.28,
                      delay: Math.min(0.24, idx * 0.035),
                      ease: [0.16, 1, 0.3, 1]
                    }}
                  >
                    <button
                      type="button"
                      className="knowledge-concept-row actionable-concept-row"
                      onClick={() => handleSelectConcept(item.id)}
                      title={`Focus "${item.name}" in knowledge graph`}
                    >
                      <div className="concept-row-left">
                        <span className="concept-index-num">
                          {(idx + 1).toString().padStart(2, '0')}
                        </span>
                        <span className="concept-row-name" title={item.name}>
                          {item.name}
                        </span>
                      </div>
                      <span className="concept-status-sign sign-warning" aria-hidden="true">
                        →
                      </span>
                    </button>
                    <div className="knowledge-row-divider" />
                  </motion.div>
                ))
              ) : (
                <div className="knowledge-empty-row">
                  <span>All concepts mastered with full accuracy.</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
});
