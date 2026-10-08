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
    narrative: 'Several foundational concepts need reinforcement. A focused review of the highlighted material will help close the gaps.',
    tone: 'warning'
  };
}

/**
 * SlotDigit: Rolling numeral transition that rolls from 0 to targetDigit
 * Smooth, mechanical, intentional motion with cubic-bezier easing
 */
function SlotDigit({
  targetDigit,
  delay = 0.22,
  duration = 0.58
}: {
  targetDigit: number;
  delay?: number;
  duration?: number;
}) {
  return (
    <span className="editorial-slot-digit" aria-hidden="true">
      <motion.span
        className="editorial-slot-column"
        initial={{ y: '0%' }}
        animate={{ y: `-${targetDigit * 10}%` }}
        transition={{
          duration,
          delay,
          ease: [0.16, 1, 0.3, 1]
        }}
      >
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
          <span key={d} className="editorial-slot-numeral">
            {d}
          </span>
        ))}
      </motion.span>
    </span>
  );
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

  // Formatted numerical strings
  const scoreFormatted = results.score.toString().padStart(2, '0');
  const totalFormatted = results.totalQuestions.toString().padStart(2, '0');
  const tensDigit = Math.floor(results.score / 10) % 10;
  const unitsDigit = results.score % 10;

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
          HERO COMPOSITION (Section 1, 2, 3, 4, 18)
          Left: Eyebrow, TEST COMPLETE, Dominant Score, Interpretation
          Right: Circular Knowledge Performance Visualization
          ============================================================== */}
      <div className="results-hero-two-column-grid">
        {/* LEFT COLUMN: Narrative & Core Metric */}
        <div className="results-hero-left-column">
          {/* Eyebrow: • TEST / RESULTS */}
          <motion.div
            className="results-eyebrow"
            initial={{ opacity: 0, y: -8 }}
            animate={isExiting ? { opacity: 0, y: -4 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="results-eyebrow-marker" aria-hidden="true" />
            <span>TEST / RESULTS</span>
          </motion.div>

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

          {/* Dominant Score Hero Row (Section 2 & 16) */}
          <div className="results-score-hero-block">
            <div className="results-score-primary-row">
              <motion.span
                className="results-hero-number"
                aria-label={`${scoreFormatted} of ${totalFormatted}`}
                initial={{ y: 20, opacity: 0 }}
                animate={
                  isExiting
                    ? { y: -20, opacity: 0, transition: { duration: 0.24, delay: 0.18, ease: [0.16, 1, 0.3, 1] } }
                    : { y: 0, opacity: 1, transition: { duration: 0.45, delay: 0.18, ease: [0.16, 1, 0.3, 1] } }
                }
              >
                <SlotDigit targetDigit={tensDigit} delay={0.2} duration={0.52} />
                <SlotDigit targetDigit={unitsDigit} delay={0.24} duration={0.58} />
              </motion.span>

              {/* Denominator: smaller, lighter, vertically aligned toward lower portion */}
              <motion.span
                className="results-total-denominator"
                initial={{ y: 14, opacity: 0 }}
                animate={
                  isExiting
                    ? { y: -14, opacity: 0, transition: { duration: 0.22, delay: 0.18, ease: [0.16, 1, 0.3, 1] } }
                    : { y: 0, opacity: 1, transition: { duration: 0.42, delay: 0.26, ease: [0.16, 1, 0.3, 1] } }
                }
              >
                / {totalFormatted}
              </motion.span>
            </div>

            {/* Muted secondary meta: 10% correct · 00:20 elapsed (NO badge) */}
            <motion.div
              className="results-secondary-meta"
              initial={{ opacity: 0, y: 8 }}
              animate={
                isExiting
                  ? { opacity: 0, transition: { duration: 0.2 } }
                  : { opacity: 1, y: 0, transition: { duration: 0.35, delay: 0.32, ease: [0.16, 1, 0.3, 1] } }
              }
            >
              <span>{results.percentage}% correct</span>
              <span className="results-meta-separator" aria-hidden="true">·</span>
              <span>{timeFormatted} elapsed</span>
            </motion.div>
          </div>

          {/* Interpretation Section (Section 7 & 8) */}
          <motion.div
            className="results-interpretation-block"
            initial={{ opacity: 0, y: 14 }}
            animate={
              isExiting
                ? { opacity: 0, y: -10, transition: { duration: 0.22, delay: 0.06, ease: [0.16, 1, 0.3, 1] } }
                : { opacity: 1, y: 0, transition: { duration: 0.45, delay: 0.38, ease: [0.16, 1, 0.3, 1] } }
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

        {/* RIGHT COLUMN: Circular Knowledge Performance Visualization (Section 3 & 4) */}
        <div className="results-hero-right-column">
          <CircularPerformanceVisual
            score={results.score}
            totalQuestions={results.totalQuestions}
            percentage={results.percentage}
            questionItems={questionItems}
            isExiting={isExiting}
            exitTarget={exitTarget}
            onSelectQuestion={(item) => {
              if (!item.isCorrect && hasMissed) {
                handleReviewMissed();
              }
            }}
          />
        </div>
      </div>

      {/* Major Divider */}
      <div className="results-major-divider" aria-hidden="true" />

      {/* ==============================================================
          EDITORIAL KNOWLEDGE INDEX (Section 10, 11, 12)
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
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.32,
                      delay: 0.52 + idx * 0.04,
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

          {/* Column 2: WORTH REVISITING (Actionable - Section 12) */}
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
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.32,
                      delay: 0.54 + idx * 0.04,
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

      {/* Major Divider */}
      <div className="results-major-divider" aria-hidden="true" />

      {/* ==============================================================
          EDITORIAL ACTIONS HIERARCHY (Section 13 & 14)
          Primary: REVIEW MISSED CONCEPTS → (Green outline treatment)
          Secondary: REVIEW ALL ANSWERS (Neutral)
          Tertiary: ← BACK TO GRAPH (Text-only)
          ============================================================== */}
      <motion.div
        className="results-actions-group"
        initial={{ opacity: 0, y: 12 }}
        animate={isExiting ? { opacity: 0, y: 12 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.36, delay: 0.62, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Primary Action */}
        {hasMissed ? (
          <button
            type="button"
            className="results-primary-action-btn"
            onClick={handleReviewMissed}
            disabled={isExiting}
            autoFocus
          >
            <div className="action-btn-label">
              <span>REVIEW MISSED CONCEPTS</span>
              <ArrowRight size={14} className="action-arrow-icon" aria-hidden="true" />
            </div>
            <div className="action-underline-track" aria-hidden="true">
              <div className="action-underline-fill" />
            </div>
          </button>
        ) : (
          <button
            type="button"
            className="results-primary-action-btn"
            onClick={handleBackToGraph}
            disabled={isExiting}
            autoFocus
          >
            <div className="action-btn-label">
              <span>RETURN TO GRAPH</span>
              <ArrowRight size={14} className="action-arrow-icon" aria-hidden="true" />
            </div>
            <div className="action-underline-track" aria-hidden="true">
              <div className="action-underline-fill" />
            </div>
          </button>
        )}

        {/* Secondary Action */}
        <button
          type="button"
          className="results-secondary-text-btn"
          onClick={onReviewAnswers}
          disabled={isExiting}
        >
          <span>REVIEW ALL ANSWERS</span>
          <span className="secondary-arrow" aria-hidden="true">
            →
          </span>
        </button>

        {/* Tertiary Action: Text-only back link */}
        <button
          type="button"
          className="results-quiet-back-btn"
          onClick={handleBackToGraph}
          disabled={isExiting}
          title="Return to knowledge graph"
        >
          <span className="back-arrow" aria-hidden="true">
            ←
          </span>
          <span>BACK TO GRAPH</span>
        </button>
      </motion.div>
    </div>
  );
});
