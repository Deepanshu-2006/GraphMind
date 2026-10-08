import { useState, useEffect, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { TestResultsSummary, KnowledgeTest } from '../../types/test';
import {
  CircularPerformanceVisual,
  type QuestionResultItem
} from './CircularPerformanceVisual';

interface TestResultsViewProps {
  results: TestResultsSummary;
  test?: KnowledgeTest | null;
  onReviewAnswers: () => void;
  onReviewMissedConcepts: () => void;
  onBackToGraph: () => void;
}

interface ScoreInterpretation {
  headline: string;
  narrative: string;
  tone: 'positive' | 'warning';
}

function getScoreInterpretation(percentage: number): ScoreInterpretation {
  if (percentage >= 80) {
    return {
      headline: 'STRONG UNDERSTANDING',
      narrative: 'You demonstrated deep conceptual clarity across the material. Your knowledge graph connections are solidly retained.',
      tone: 'positive'
    };
  }
  if (percentage >= 60) {
    return {
      headline: 'SOLID UNDERSTANDING',
      narrative: 'You have a firm grasp of the primary concepts and principles. Reviewing the highlighted relationships will solidify complete mastery.',
      tone: 'positive'
    };
  }
  if (percentage >= 40) {
    return {
      headline: 'BUILDING UNDERSTANDING',
      narrative: "You're beginning to connect the core ideas. A focused review of the highlighted concepts will strengthen your knowledge graph.",
      tone: 'warning'
    };
  }
  return {
    headline: 'NEEDS REVIEW',
    narrative: 'Several foundational concepts require reinforcement. A targeted review of the highlighted material will help bridge key conceptual gaps.',
    tone: 'warning'
  };
}

export const TestResultsView = memo(function TestResultsView({
  results,
  test,
  onReviewAnswers,
  onReviewMissedConcepts,
  onBackToGraph
}: TestResultsViewProps) {
  // Exit transition states (Section 18)
  const [isExiting, setIsExiting] = useState(false);
  const [exitTarget, setExitTarget] = useState<'missed' | 'graph' | null>(null);

  // Score count-up numerical reveal
  const [displayScore, setDisplayScore] = useState(0);
  const [hasSettled, setHasSettled] = useState(false);

  useEffect(() => {
    const target = results.score;
    if (target === 0) {
      setDisplayScore(0);
      setHasSettled(true);
      return;
    }

    const duration = 580; // ms
    const startTime = performance.now();

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentVal = Math.round(eased * target);
      setDisplayScore(currentVal);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayScore(target);
        setHasSettled(true);
      }
    };

    const frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [results.score]);

  // Formatted numbers
  const scoreFormatted = displayScore.toString().padStart(2, '0');
  const totalFormatted = results.totalQuestions.toString().padStart(2, '0');

  // Elapsed time format
  const mins = Math.floor(results.timeSpentSeconds / 60);
  const secs = results.timeSpentSeconds % 60;
  const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  // Score interpretation
  const interpretation = useMemo(() => {
    return getScoreInterpretation(results.percentage);
  }, [results.percentage]);

  // Derive per-question results for circular performance visualization
  const questionItems: QuestionResultItem[] = useMemo(() => {
    if (test?.questions && test.questions.length > 0) {
      return test.questions.map((q, idx) => {
        const isMissed = results.reviewRecommendedConcepts.some(m => m.questionId === q.id);
        return {
          questionNumber: idx + 1,
          questionId: q.id,
          isCorrect: !isMissed,
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

  // Deduplicated concept lists for knowledge report
  const uniqueStrongConcepts = useMemo(() => {
    return Array.from(new Set(results.strongConceptNames));
  }, [results.strongConceptNames]);

  const uniqueReviewConcepts = useMemo(() => {
    const seen = new Set<string>();
    const list: { id: string; name: string }[] = [];
    for (const item of results.reviewRecommendedConcepts) {
      if (!seen.has(item.conceptName)) {
        seen.add(item.conceptName);
        list.push({ id: item.conceptId, name: item.conceptName });
      }
    }
    return list;
  }, [results.reviewRecommendedConcepts]);

  const hasMissed = uniqueReviewConcepts.length > 0;

  // Choreographed transitions (Section 18)
  const handleReviewMissed = () => {
    if (isExiting) return;
    setIsExiting(true);
    setExitTarget('missed');
    setTimeout(() => {
      onReviewMissedConcepts();
    }, 280);
  };

  const handleBackToGraph = () => {
    if (isExiting) return;
    setIsExiting(true);
    setExitTarget('graph');
    setTimeout(() => {
      onBackToGraph();
    }, 280);
  };

  return (
    <div className={`test-results-editorial-wrap ${isExiting ? 'results-exiting' : ''}`}>
      {/* ==============================================================
          TWO-COLUMN HERO COMPOSITION (Section 12 & 17)
          Left: Narrative, Title, Score, Interpretation (55-60%)
          Right: Circular Knowledge Performance Visualization (40-45%)
          ============================================================== */}
      <div className="results-hero-two-column-grid">
        {/* LEFT COLUMN: Narrative & Core Metric */}
        <div className="results-hero-left-column">
          {/* Eyebrow */}
          <motion.div
            className="results-eyebrow"
            initial={{ opacity: 0, y: -8 }}
            animate={isExiting ? { opacity: 0, y: -4 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="results-eyebrow-marker" aria-hidden="true" />
            <span>TEST / RESULTS</span>
          </motion.div>

          {/* Title */}
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
                transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
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
                transition={{ duration: 0.65, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              >
                COMPLETE
              </motion.span>
            </span>
          </h1>

          {/* Hero Score Row */}
          <div className="results-score-hero-block">
            <div className="results-score-primary-row">
              <motion.span
                className={`results-hero-number ${hasSettled ? 'settled' : ''}`}
                initial={{ y: 24, opacity: 0 }}
                animate={isExiting ? { y: -24, opacity: 0 } : { y: 0, opacity: 1 }}
                transition={{ duration: 0.48, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
              >
                {scoreFormatted}
              </motion.span>
              <motion.span
                className="results-total-denominator"
                initial={{ y: 16, opacity: 0 }}
                animate={isExiting ? { y: -16, opacity: 0 } : { y: 0, opacity: 1 }}
                transition={{ duration: 0.45, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
              >
                / {totalFormatted}
              </motion.span>
            </div>

            <motion.div
              className="results-secondary-meta"
              initial={{ opacity: 0, y: 8 }}
              animate={isExiting ? { opacity: 0 } : { opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <span>{results.percentage}% correct</span>
              <span className="results-meta-separator" aria-hidden="true">·</span>
              <span>{timeFormatted} elapsed</span>
            </motion.div>
          </div>

          {/* Score Interpretation */}
          <motion.div
            className="results-interpretation-block"
            initial={{ opacity: 0, y: 12 }}
            animate={isExiting ? { opacity: 0, y: -8 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: 0.36, ease: [0.16, 1, 0.3, 1] }}
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

        {/* RIGHT COLUMN: Circular Knowledge Performance Visualization */}
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
          EDITORIAL KNOWLEDGE REPORT (Section 10, 13, 14)
          ============================================================== */}
      <motion.div
        className="results-knowledge-report-section"
        initial={{ opacity: 0, y: 14 }}
        animate={
          isExiting
            ? exitTarget === 'missed'
              ? { opacity: 0.3, scale: 0.98 }
              : { opacity: 0, y: 14 }
            : { opacity: 1, scale: 1, y: 0 }
        }
        transition={{ duration: 0.45, delay: 0.44, ease: [0.16, 1, 0.3, 1] }}
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
                uniqueStrongConcepts.map((name, idx) => (
                  <div key={name} className="knowledge-concept-row-wrap" role="listitem">
                    <div className="knowledge-concept-row">
                      <div className="concept-row-left">
                        <span className="concept-index-num">
                          {(idx + 1).toString().padStart(2, '0')}
                        </span>
                        <span className="concept-row-name" title={name}>
                          {name}
                        </span>
                      </div>
                      <span className="concept-status-sign sign-positive" aria-hidden="true">
                        +
                      </span>
                    </div>
                    <div className="knowledge-row-divider" />
                  </div>
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
                  <div key={item.name} className="knowledge-concept-row-wrap" role="listitem">
                    <div className="knowledge-concept-row">
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
                    </div>
                    <div className="knowledge-row-divider" />
                  </div>
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
          EDITORIAL NEXT ACTIONS (Section 16, 17, 18, 19)
          ============================================================== */}
      <motion.div
        className="results-actions-group"
        initial={{ opacity: 0, y: 12 }}
        animate={isExiting ? { opacity: 0, y: 16 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.38, delay: 0.54, ease: [0.16, 1, 0.3, 1] }}
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

        {/* Quiet Back to Graph Link */}
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
