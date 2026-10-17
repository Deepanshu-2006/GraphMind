import React from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { usePersonaStats } from './usePersonaStats';
import { formatRelativeTime, formatTabularCount } from './PersonaActivityPanel';

export interface PersonaPerformancePanelProps {
  onSelectGraph?: (graphId: string) => void;
  className?: string;
}

export const PersonaPerformancePanel: React.FC<PersonaPerformancePanelProps> = ({
  onSelectGraph,
  className = ''
}) => {
  const { stats, isLoading, error, refresh } = usePersonaStats();
  const shouldReduceMotion = useReducedMotion();

  // Animation variants for editorial staggered entrance
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: shouldReduceMotion ? 0 : 0.08,
        delayChildren: shouldReduceMotion ? 0 : 0.15
      }
    }
  };

  const itemVariants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 8
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.4,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  // Handle loading state quietly without layout shifts
  if (isLoading && !stats) {
    return (
      <aside
        className={`persona-performance-panel persona-performance-panel--loading ${className}`}
        aria-label="Learning Performance Statistics"
      >
        <div className="persona-activity-header">
          <div className="persona-activity-tag">
            <span className="persona-activity-tag-bullet" aria-hidden="true" />
            <span>YOUR PERFORMANCE</span>
          </div>
          <p className="persona-activity-subtitle">Loading performance and mastery…</p>
        </div>
      </aside>
    );
  }

  // Handle error state gracefully with retry capability
  if (error && !stats) {
    return (
      <aside
        className={`persona-performance-panel persona-performance-panel--error ${className}`}
        aria-label="Learning Performance Statistics"
      >
        <div className="persona-activity-header">
          <div className="persona-activity-tag">
            <span className="persona-activity-tag-bullet persona-activity-tag-bullet--error" aria-hidden="true" />
            <span>YOUR PERFORMANCE</span>
          </div>
          <p className="persona-activity-subtitle">Unable to load performance data.</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="persona-activity-retry-btn"
          aria-label="Retry loading performance statistics"
        >
          Retry
        </button>
      </aside>
    );
  }

  const performance = stats?.performance;
  const totalAttempts = performance?.totalAssessmentAttempts || 0;
  const recentAssessments = performance?.recentAssessments || [];
  const averageScore = performance?.averageScore;
  const revisionProgress = performance?.activeRevisionProgress;
  const needsRevisionCount = performance?.conceptsNeedingRevisionCount || 0;
  const exampleConcepts = performance?.conceptsNeedingRevisionExamples || [];

  return (
    <motion.aside
      className={`persona-performance-panel ${className}`}
      aria-label="Learning Performance Statistics"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      id="persona-performance-panel"
    >
      {/* Eyebrow and Section Heading */}
      <motion.div className="persona-activity-header" variants={itemVariants}>
        <div className="persona-activity-tag">
          <span className="persona-activity-tag-bullet" aria-hidden="true" />
          <span>YOUR PERFORMANCE</span>
        </div>
        <p className="persona-activity-subtitle">Progress, practice, and mastery.</p>
      </motion.div>

      {/* A. Recent Test Performance */}
      <motion.div className="persona-stat-block" variants={itemVariants}>
        <span className="persona-stat-label">ASSESSMENT PERFORMANCE</span>
        <div className="persona-stat-value" data-testid="persona-average-score">
          {averageScore !== null && averageScore !== undefined ? `${averageScore}%` : '—%'}
        </div>
        <span className="persona-stat-subtext">
          {totalAttempts === 0
            ? 'No completed tests yet'
            : totalAttempts === 1
            ? 'Average score across 1 completed test'
            : `Average score across ${totalAttempts} completed tests`}
        </span>

        {/* Recent Assessment Attempts List (up to 3, newest first) */}
        {recentAssessments.length > 0 && (
          <ul className="persona-activity-list persona-performance-scores-list" role="list">
            {recentAssessments.map((attempt) => {
              const isClickable = Boolean(onSelectGraph && attempt.graphId);
              return (
                <li key={attempt.id} className="persona-activity-item-wrapper">
                  <button
                    type="button"
                    onClick={() => attempt.graphId && onSelectGraph?.(attempt.graphId)}
                    disabled={!isClickable}
                    className={`persona-activity-item persona-performance-item ${isClickable ? 'persona-activity-item--interactive' : ''}`}
                    title={isClickable ? `Open graph: ${attempt.graphName}` : attempt.graphName}
                    aria-label={`Test score: ${attempt.scorePercentage}% in ${attempt.graphName}, completed ${formatRelativeTime(attempt.completedAt)}`}
                  >
                    <span className="persona-score-badge" aria-hidden="true">
                      {attempt.scorePercentage}%
                    </span>
                    <span className="persona-activity-name">{attempt.graphName}</span>
                    <time className="persona-activity-time" dateTime={attempt.completedAt}>
                      {formatRelativeTime(attempt.completedAt)}
                    </time>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </motion.div>

      {/* B. Revision Progress */}
      <motion.div className="persona-stat-block" variants={itemVariants}>
        <span className="persona-stat-label">
          {revisionProgress ? 'ACTIVE REVISION SESSION' : 'REVISION PROGRESS'}
        </span>
        <div className="persona-stat-value" data-testid="persona-revision-progress">
          {revisionProgress ? `${revisionProgress.progressPercent}%` : '—%'}
        </div>
        <span className="persona-stat-subtext">
          {revisionProgress
            ? `${revisionProgress.reviewedCount} of ${revisionProgress.totalConcepts} concepts in ${revisionProgress.graphName}`
            : 'No active revision session'}
        </span>

        {/* Thin horizontal progress indicator bar */}
        <div
          className="persona-progress-track"
          role="progressbar"
          aria-valuenow={revisionProgress ? revisionProgress.progressPercent : 0}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Active revision session progress"
        >
          <div
            className="persona-progress-fill"
            style={{ width: `${revisionProgress ? revisionProgress.progressPercent : 0}%` }}
          />
        </div>
      </motion.div>

      {/* C. Concepts to Revisit */}
      <motion.div className="persona-stat-block persona-stat-block--revisit" variants={itemVariants}>
        <span className="persona-stat-label">CONCEPTS TO REVISIT</span>
        <div className="persona-stat-value" data-testid="persona-concepts-needing-revision">
          {formatTabularCount(needsRevisionCount)}
        </div>
        <span className="persona-stat-subtext">
          {needsRevisionCount === 0
            ? "You're clear for now"
            : needsRevisionCount === 1
            ? '1 concept requires attention'
            : `${needsRevisionCount} concepts require attention`}
        </span>

        {/* Example concepts needing revision (up to 2) */}
        {needsRevisionCount > 0 && exampleConcepts.length > 0 && (
          <div className="persona-concepts-chips-container" aria-label="Example concepts requiring revision">
            {exampleConcepts.map((conceptName) => (
              <span key={conceptName} className="persona-concept-chip" title={conceptName}>
                {conceptName}
              </span>
            ))}
          </div>
        )}
      </motion.div>
    </motion.aside>
  );
};
