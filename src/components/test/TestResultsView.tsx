import { memo } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, RotateCcw } from 'lucide-react';
import type { TestResultsSummary } from '../../types/test';

interface TestResultsViewProps {
  results: TestResultsSummary;
  onReviewAnswers: () => void;
  onReviewMissedConcepts: () => void;
  onBackToGraph: () => void;
}

export const TestResultsView = memo(function TestResultsView({
  results,
  onReviewAnswers,
  onReviewMissedConcepts,
  onBackToGraph
}: TestResultsViewProps) {
  const mins = Math.floor(results.timeSpentSeconds / 60);
  const secs = results.timeSpentSeconds % 60;
  const timeFormatted = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

  const hasMissed = results.reviewRecommendedConcepts.length > 0;

  return (
    <div className="test-results-container">
      {/* 1. Header Reveal */}
      <motion.div
        className="results-header-block"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="results-kicker">ACADEMIC ASSESSMENT</div>
        <h1 className="results-title">TEST COMPLETE</h1>
      </motion.div>

      {/* 2. Sequential Score Reveal */}
      <div className="results-score-hero">
        <div className="results-score-primary">
          <motion.span
            className="score-num"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            {results.score}
          </motion.span>
          <motion.span
            className="score-total"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            / {results.totalQuestions}
          </motion.span>
        </div>

        <motion.div
          className="score-percentage-badge"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, delay: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          {results.percentage}%
        </motion.div>

        <motion.div
          className="score-meta-time"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.45 }}
        >
          Time taken: {timeFormatted}
        </motion.div>
      </div>

      <div className="test-results-divider" aria-hidden="true" />

      {/* 3. Sequential Analysis Reveal */}
      <motion.div
        className="results-analysis-grid"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.52, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Strong Understanding */}
        <div className="analysis-column column-strong">
          <div className="analysis-col-label">Strong understanding</div>
          {results.strongConceptNames.length > 0 ? (
            <ul className="analysis-concept-list">
              {results.strongConceptNames.map(name => (
                <li key={name} className="concept-item strong-item">
                  <span className="concept-dot dot-strong" aria-hidden="true" />
                  <span className="concept-name">{name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="analysis-empty-text">No concepts mastered fully in this attempt.</p>
          )}
        </div>

        {/* Review Recommended */}
        <div className="analysis-column column-review">
          <div className="analysis-col-label">Review recommended</div>
          {hasMissed ? (
            <ul className="analysis-concept-list">
              {results.reviewRecommendedConcepts.map(item => (
                <li key={item.questionId} className="concept-item review-item">
                  <span className="concept-dot dot-review" aria-hidden="true" />
                  <span className="concept-name">{item.conceptName}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="analysis-empty-text">No concepts missed. Complete accuracy!</p>
          )}
        </div>
      </motion.div>

      <div className="test-results-divider" aria-hidden="true" />

      {/* 4. Actions */}
      <motion.div
        className="results-actions-cluster"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.65, ease: [0.16, 1, 0.3, 1] }}
      >
        {hasMissed && (
          <button
            type="button"
            className="test-editorial-action-btn action-primary"
            onClick={onReviewMissedConcepts}
          >
            <span>REVIEW MISSED CONCEPTS</span>
            <ArrowRight size={13} aria-hidden="true" />
          </button>
        )}

        <button
          type="button"
          className="test-editorial-action-btn action-secondary"
          onClick={onReviewAnswers}
        >
          <BookOpen size={13} aria-hidden="true" />
          <span>REVIEW ALL ANSWERS</span>
        </button>

        <button
          type="button"
          className="test-editorial-action-btn action-ghost"
          onClick={onBackToGraph}
        >
          <RotateCcw size={13} aria-hidden="true" />
          <span>BACK TO GRAPH</span>
        </button>
      </motion.div>
    </div>
  );
});
