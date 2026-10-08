import { useState, useEffect, useMemo, memo } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { TestResultsSummary } from '../../types/test';

interface TestResultsViewProps {
  results: TestResultsSummary;
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

/**
 * Editorial background topology SVG element with slow breathing animation.
 * Features 8 nodes and hairline relationship edges at 0.06 opacity.
 */
const DecorativeResultsTopology = memo(function DecorativeResultsTopology({
  isExiting,
  exitTarget
}: {
  isExiting: boolean;
  exitTarget: 'missed' | 'graph' | null;
}) {
  return (
    <div
      className={`results-faint-graph-backdrop ${
        isExiting && exitTarget === 'graph'
          ? 'exiting-to-graph'
          : isExiting && exitTarget === 'missed'
          ? 'exiting-to-review'
          : ''
      }`}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 520 420"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="test-topology-svg"
      >
        {/* Hairline relationship edges */}
        <line x1="100" y1="80" x2="260" y2="70" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2 3" opacity="0.35" />
        <line x1="260" y1="70" x2="420" y2="120" stroke="#FFFFFF" strokeWidth="1" opacity="0.45" />
        <line x1="100" y1="80" x2="180" y2="200" stroke="#FFFFFF" strokeWidth="1" opacity="0.4" />
        <line x1="180" y1="200" x2="350" y2="240" stroke="#FFFFFF" strokeWidth="1" opacity="0.3" />
        <line x1="420" y1="120" x2="350" y2="240" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />
        <line x1="350" y1="240" x2="480" y2="310" stroke="#FFFFFF" strokeWidth="1" opacity="0.5" />
        <line x1="180" y1="200" x2="120" y2="340" stroke="#FFFFFF" strokeWidth="1" opacity="0.35" />
        <line x1="350" y1="240" x2="280" y2="380" stroke="#FFFFFF" strokeWidth="1" opacity="0.4" />
        <line x1="120" y1="340" x2="280" y2="380" stroke="#FFFFFF" strokeWidth="1" strokeDasharray="2 2" opacity="0.3" />

        {/* Breathing nodes */}
        <circle cx="100" cy="80" r="3" fill="#A1A1A1" className="topology-node node-1" />
        <circle cx="260" cy="70" r="3.5" fill="#A3FF12" className="topology-node node-2" />
        <circle cx="260" cy="70" r="7" stroke="#A3FF12" strokeWidth="0.75" opacity="0.35" className="topology-halo halo-2" />
        <circle cx="420" cy="120" r="3" fill="#D4D4D4" className="topology-node node-3" />
        <circle cx="180" cy="200" r="2.5" fill="#8A8A8A" className="topology-node node-4" />
        <circle cx="350" cy="240" r="3" fill="#A1A1A1" className="topology-node node-5" />
        <circle cx="480" cy="310" r="2.5" fill="#8A8A8A" className="topology-node node-6" />
        <circle cx="120" cy="340" r="3" fill="#D4D4D4" className="topology-node node-3" />
        <circle cx="280" cy="380" r="3.5" fill="#A3FF12" className="topology-node node-2" />
      </svg>
    </div>
  );
});

export const TestResultsView = memo(function TestResultsView({
  results,
  onReviewAnswers,
  onReviewMissedConcepts,
  onBackToGraph
}: TestResultsViewProps) {
  // Exit transition states (Section 20 & 21)
  const [isExiting, setIsExiting] = useState(false);
  const [exitTarget, setExitTarget] = useState<'missed' | 'graph' | null>(null);

  // Score count-up numerical reveal (Section 8)
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
      // Ease-out cubic
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

  // Deduplicated concept lists
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

  // Choreographed transitions
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
      {/* 1. Quiet Eyebrow (Section 3) */}
      <motion.div
        className="results-eyebrow"
        initial={{ opacity: 0, y: -8 }}
        animate={isExiting ? { opacity: 0, y: -4 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
      >
        <span className="results-eyebrow-marker" aria-hidden="true" />
        <span>TEST / RESULTS</span>
      </motion.div>

      {/* 2. Dominant Editorial Title with Masked Reveal (Section 4) */}
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

      {/* 3. Hero Score Composition (Section 5 & 8) */}
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

        {/* Secondary quiet metric (Section 7) */}
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

      {/* 4. Score Interpretation (Section 6) */}
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

      {/* Major Divider */}
      <div className="results-major-divider" aria-hidden="true" />

      {/* 5. Editorial Knowledge Report (Section 10, 13, 14) */}
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

      {/* 6. Editorial Next Actions (Section 16, 17, 18, 19) */}
      <motion.div
        className="results-actions-group"
        initial={{ opacity: 0, y: 12 }}
        animate={isExiting ? { opacity: 0, y: 16 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.38, delay: 0.54, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Primary Action (Section 16) */}
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

        {/* Secondary Action: plain text (Section 17) */}
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

        {/* Quiet Back to Graph Link (Section 18) */}
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

      {/* Decorative Faint Graph Topology Behind Results (Section 22) */}
      <DecorativeResultsTopology isExiting={isExiting} exitTarget={exitTarget} />
    </div>
  );
});
