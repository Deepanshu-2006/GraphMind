import React from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { usePersonaStats } from './usePersonaStats';
import { PersonaAnimatedNumber } from './PersonaAnimatedNumber';
import { formatRelativeTime, formatTabularCount } from './PersonaActivityPanel';

export interface PersonaPerformancePanelProps {
  onSelectGraph?: (graphId: string) => void;
  onSelectAssessment?: (attemptId: string, graphId?: string) => void;
  onResumeRevision?: (graphId: string) => void;
  onOpenAssessments?: () => void;
  onOpenRevision?: (conceptName?: string) => void;
  className?: string;
}

/**
 * PersonaPerformancePanel
 *
 * Right-side learning performance overview within GraphMind Persona.
 * Features a refined Swiss-editorial typography hierarchy matching the left panel,
 * with an independent, cinematic 4-phase entrance animation sequence.
 */
export const PersonaPerformancePanel: React.FC<PersonaPerformancePanelProps> = React.memo(({
  onSelectGraph,
  onSelectAssessment,
  onResumeRevision,
  onOpenAssessments,
  onOpenRevision,
  className = ''
}) => {
  const { stats, isLoading, error, refresh } = usePersonaStats();
  const shouldReduceMotion = useReducedMotion();

  // Container entrance with subtle horizontal movement from right (+10px -> 0px)
  const containerVariants: Variants = {
    hidden: {
      opacity: 0,
      x: shouldReduceMotion ? 0 : 10
    },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.6,
        ease: [0.16, 1, 0.3, 1],
        staggerChildren: shouldReduceMotion ? 0 : 0.09,
        delayChildren: shouldReduceMotion ? 0 : 0.06
      }
    }
  };

  // Group container entrance
  const itemVariants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 8
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.45,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  // Phase A: Section Identity & Supporting Headline (0–450 ms)
  const eyebrowDotVariants: Variants = {
    hidden: {
      opacity: 0,
      scale: shouldReduceMotion ? 1 : 0.65
    },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.35,
        delay: shouldReduceMotion ? 0 : 0.05,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  const eyebrowTextVariants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 6
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.35,
        delay: shouldReduceMotion ? 0 : 0.14,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  const headlineVariants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 10
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.40,
        delay: shouldReduceMotion ? 0 : 0.22,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  // Phase B: Assessment Performance (350–1,250 ms)
  const metric1LabelVariants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 6
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.35,
        delay: shouldReduceMotion ? 0 : 0.38,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  const metric1ValueVariants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : '100%'
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.65,
        delay: shouldReduceMotion ? 0 : 0.44,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  const metric1SubtextVariants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 6
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.38,
        delay: shouldReduceMotion ? 0 : 0.72,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  const scoresListContainerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: shouldReduceMotion ? 0 : 0.82,
        staggerChildren: shouldReduceMotion ? 0 : 0.10
      }
    }
  };

  const scoresListItemVariants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 6
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.35,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  const rowBadgeVariants: Variants = {
    hidden: {
      opacity: 0,
      scale: shouldReduceMotion ? 1 : 0.85
    },
    visible: {
      opacity: 1,
      scale: 1,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.28,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  const rowNameVariants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 4
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.32,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  const rowTimeVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.32,
        delay: shouldReduceMotion ? 0 : 0.08,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  // Phase C: Active Revision Session (1,000–1,950 ms)
  const metric2LabelVariants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 6
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.35,
        delay: shouldReduceMotion ? 0 : 0.95,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  const metric2ValueVariants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : '100%'
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.68,
        delay: shouldReduceMotion ? 0 : 1.02,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  const metric2SubtextVariants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 6
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.38,
        delay: shouldReduceMotion ? 0 : 1.25,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  const progressTrackVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.45,
        delay: shouldReduceMotion ? 0 : 1.15,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  const resumeBtnVariants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 6
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.35,
        delay: shouldReduceMotion ? 0 : 1.40,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  // Phase D: Concepts to Revisit (1,750–2,500 ms)
  const revisitLabelVariants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 6
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.35,
        delay: shouldReduceMotion ? 0 : 1.75,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  const revisitValueVariants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : '100%'
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.65,
        delay: shouldReduceMotion ? 0 : 1.82,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  const revisitSubtextVariants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 6
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.38,
        delay: shouldReduceMotion ? 0 : 2.00,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  const chipsContainerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: shouldReduceMotion ? 0 : 2.10,
        staggerChildren: shouldReduceMotion ? 0 : 0.06
      }
    }
  };

  const chipItemVariants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 4
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.30,
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

  const revisionProgressRatio = revisionProgress
    ? Math.max(0, Math.min(100, revisionProgress.progressPercent)) / 100
    : 0;

  return (
    <motion.aside
      className={`persona-performance-panel ${className}`}
      aria-label="Learning Performance Statistics"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      id="persona-performance-panel"
    >
      {/* Group A — Introduction (Phase A: Section Identity & Supporting Headline) */}
      <motion.div className="persona-performance-group persona-performance-group--intro persona-activity-header" variants={itemVariants}>
        <div className="persona-activity-tag">
          <motion.span
            className="persona-activity-tag-bullet"
            aria-hidden="true"
            variants={eyebrowDotVariants}
          />
          <motion.span variants={eyebrowTextVariants}>YOUR PERFORMANCE</motion.span>
        </div>
        <motion.p className="persona-activity-subtitle" variants={headlineVariants}>
          Progress, practice, and mastery.
        </motion.p>
      </motion.div>

      {/* Group B — Performance & Revision Metrics */}
      <motion.div className="persona-performance-group persona-performance-group--metrics" variants={itemVariants}>
        {/* Metric 1: Assessment Performance (Phase B) */}
        <div className="persona-stat-block">
          <button
            type="button"
            onClick={onOpenAssessments}
            disabled={!onOpenAssessments}
            className={`persona-stat-trigger ${onOpenAssessments ? 'persona-stat-trigger--interactive' : ''}`}
            aria-label={`Open assessment history (Average score: ${averageScore !== null && averageScore !== undefined ? `${averageScore}%` : 'no completed tests yet'})`}
          >
            <motion.span className="persona-stat-label" variants={metric1LabelVariants}>
              ASSESSMENT PERFORMANCE
            </motion.span>
            <span className="persona-stat-value persona-stat-value-clip" data-testid="persona-average-score">
              <motion.span className="persona-stat-value-inner" variants={metric1ValueVariants}>
                {averageScore !== null && averageScore !== undefined ? (
                  <PersonaAnimatedNumber
                    value={averageScore}
                    suffix="%"
                    duration={850}
                    delay={shouldReduceMotion ? 0 : 420}
                    min={0}
                    max={100}
                  />
                ) : (
                  '—%'
                )}
              </motion.span>
            </span>
          </button>
          <motion.span className="persona-stat-subtext" variants={metric1SubtextVariants}>
            {totalAttempts === 0
              ? 'No completed tests yet'
              : totalAttempts === 1
              ? 'Average score across 1 completed test'
              : `Average score across ${totalAttempts} completed tests`}
          </motion.span>

          {/* Recent Assessment Attempts List (up to 3, newest first) */}
          {recentAssessments.length > 0 && (
            <motion.ul
              className="persona-activity-list persona-performance-scores-list"
              role="list"
              variants={scoresListContainerVariants}
              initial="hidden"
              animate="visible"
            >
              {recentAssessments.map((attempt) => {
                const hasAction = Boolean(onSelectAssessment || (onSelectGraph && attempt.graphId));
                const isClickable = Boolean(hasAction && attempt.id);
                return (
                  <motion.li
                    key={attempt.id}
                    className="persona-activity-item-wrapper"
                    variants={scoresListItemVariants}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (onSelectAssessment) {
                          onSelectAssessment(attempt.id, attempt.graphId);
                        } else if (attempt.graphId && onSelectGraph) {
                          onSelectGraph(attempt.graphId);
                        }
                      }}
                      disabled={!isClickable}
                      className={`persona-activity-item persona-performance-item ${isClickable ? 'persona-activity-item--interactive' : ''}`}
                      title={isClickable ? `Review test results: ${attempt.scorePercentage}% in ${attempt.graphName}` : attempt.graphName}
                      aria-label={`Review assessment result: ${attempt.scorePercentage}% in ${attempt.graphName}, completed ${formatRelativeTime(attempt.completedAt)}`}
                    >
                      <motion.span className="persona-score-badge" aria-hidden="true" variants={rowBadgeVariants}>
                        {attempt.scorePercentage}%
                      </motion.span>
                      <motion.span className="persona-activity-name" variants={rowNameVariants}>
                        {attempt.graphName}
                      </motion.span>
                      <motion.time
                        className="persona-activity-time"
                        dateTime={attempt.completedAt}
                        variants={rowTimeVariants}
                      >
                        {formatRelativeTime(attempt.completedAt)}
                      </motion.time>
                    </button>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </div>

        {/* Metric 2: Active Revision Session (Phase C) */}
        <div className="persona-stat-block">
          <button
            type="button"
            onClick={() => revisionProgress && onResumeRevision?.(revisionProgress.graphId)}
            disabled={!revisionProgress || !onResumeRevision}
            className={`persona-stat-trigger ${revisionProgress && onResumeRevision ? 'persona-stat-trigger--interactive' : ''}`}
            aria-label={revisionProgress ? `Resume active revision session in ${revisionProgress.graphName} (${revisionProgress.progressPercent}% completed)` : 'No active revision session'}
          >
            <motion.span className="persona-stat-label" variants={metric2LabelVariants}>
              {revisionProgress ? 'ACTIVE REVISION SESSION' : 'REVISION PROGRESS'}
            </motion.span>
            <span className="persona-stat-value persona-stat-value-clip" data-testid="persona-revision-progress">
              <motion.span className="persona-stat-value-inner" variants={metric2ValueVariants}>
                {revisionProgress ? (
                  <PersonaAnimatedNumber
                    value={revisionProgress.progressPercent}
                    suffix="%"
                    duration={850}
                    delay={shouldReduceMotion ? 0 : 1000}
                    min={0}
                    max={100}
                  />
                ) : (
                  '—%'
                )}
              </motion.span>
            </span>
          </button>
          <motion.span className="persona-stat-subtext" variants={metric2SubtextVariants}>
            {revisionProgress
              ? `${revisionProgress.reviewedCount} of ${revisionProgress.totalConcepts} concepts in ${revisionProgress.graphName}`
              : 'No active revision session'}
          </motion.span>

          {/* Thin horizontal progress indicator bar */}
          <motion.div
            className={`persona-progress-track ${revisionProgress && onResumeRevision ? 'persona-progress-track--interactive' : ''}`}
            role="progressbar"
            aria-valuenow={revisionProgress ? revisionProgress.progressPercent : 0}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Active revision session progress"
            variants={progressTrackVariants}
            onClick={() => revisionProgress && onResumeRevision?.(revisionProgress.graphId)}
            tabIndex={revisionProgress && onResumeRevision ? 0 : undefined}
            onKeyDown={(e) => {
              if (revisionProgress && onResumeRevision && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onResumeRevision(revisionProgress.graphId);
              }
            }}
          >
            <motion.div
              className="persona-progress-fill"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: revisionProgressRatio }}
              style={{ transformOrigin: 'left' }}
              transition={{
                duration: shouldReduceMotion ? 0 : 1.0,
                delay: shouldReduceMotion ? 0 : 1.20,
                ease: [0.16, 1, 0.3, 1]
              }}
            />
          </motion.div>

          {/* Resume button for active revision session */}
          {revisionProgress && onResumeRevision && (
            <motion.button
              type="button"
              onClick={() => onResumeRevision(revisionProgress.graphId)}
              className="persona-revision-resume-btn"
              title={`Resume revision session in ${revisionProgress.graphName}`}
              aria-label={`Resume active revision session in ${revisionProgress.graphName}`}
              variants={resumeBtnVariants}
            >
              <span>Resume session</span>
              <ArrowRight size={11} className="persona-resume-arrow" aria-hidden="true" />
            </motion.button>
          )}
        </div>
      </motion.div>

      {/* Group C — Concepts to Revisit (Phase D) */}
      <motion.div className="persona-performance-group persona-performance-group--revisit persona-stat-block persona-stat-block--revisit" variants={itemVariants}>
        <button
          type="button"
          onClick={() => needsRevisionCount > 0 && onOpenRevision?.()}
          disabled={needsRevisionCount === 0 || !onOpenRevision}
          className={`persona-stat-trigger ${needsRevisionCount > 0 && onOpenRevision ? 'persona-stat-trigger--interactive' : ''}`}
          aria-label={needsRevisionCount > 0 ? `Open revision workspace (${needsRevisionCount} concepts require attention)` : 'No concepts require attention'}
        >
          <motion.span className="persona-stat-label" variants={revisitLabelVariants}>
            CONCEPTS TO REVISIT
          </motion.span>
          <span className="persona-stat-value persona-stat-value-clip" data-testid="persona-concepts-needing-revision">
            <motion.span className="persona-stat-value-inner" variants={revisitValueVariants}>
              <PersonaAnimatedNumber
                value={needsRevisionCount}
                format={formatTabularCount}
                duration={750}
                delay={shouldReduceMotion ? 0 : 1800}
                min={0}
              />
            </motion.span>
          </span>
        </button>
        <motion.span className="persona-stat-subtext" variants={revisitSubtextVariants}>
          {needsRevisionCount === 0
            ? "You're clear for now"
            : needsRevisionCount === 1
            ? '1 concept requires attention'
            : `${needsRevisionCount} concepts require attention`}
        </motion.span>

        {/* Example concepts needing revision (up to 2) */}
        {needsRevisionCount > 0 && exampleConcepts.length > 0 ? (
          <motion.div
            className="persona-concepts-chips-container"
            role="list"
            aria-label="Example concepts requiring revision"
            variants={chipsContainerVariants}
            initial="hidden"
            animate="visible"
          >
            {exampleConcepts.map((conceptName) => (
              <motion.button
                key={conceptName}
                type="button"
                className="persona-concept-chip persona-concept-chip--interactive"
                title={`Revise concept: ${conceptName}`}
                aria-label={`Revise concept: ${conceptName} in revision workspace`}
                onClick={() => onOpenRevision?.(conceptName)}
                variants={chipItemVariants}
              >
                {conceptName}
              </motion.button>
            ))}
          </motion.div>
        ) : null}
      </motion.div>
    </motion.aside>
  );
});

PersonaPerformancePanel.displayName = 'PersonaPerformancePanel';
