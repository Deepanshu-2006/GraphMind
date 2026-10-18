import React, { useMemo } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { usePersonaStats } from './usePersonaStats';
import { PersonaAnimatedNumber } from './PersonaAnimatedNumber';
import type { RecentGraphActivity } from '../../types/personaStats';
import { getPersonaNextStepRecommendation, type PersonaNextStepRecommendation } from '../../services/personaRecommendation';
import { useOptionalGraph } from '../../context/GraphContext';

export interface PersonaActivityPanelProps {
  onSelectGraph?: (graphId: string) => void;
  onOpenOverview?: () => void;
  onOpenStudy?: () => void;
  onResumeRevision?: (graphId: string) => void;
  onOpenRevision?: (conceptName?: string) => void;
  hasExistingResumeAction?: boolean;
  activeGraphId?: string | null;
  className?: string;
}

/**
 * Pure helper to calculate concise relative timestamps from ISO date strings.
 * Operates purely on persisted timestamps without generating fake dates.
 */
export function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'Recently';
  const timestamp = new Date(dateString).getTime();
  if (isNaN(timestamp) || timestamp <= 0) return 'Recently';

  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

  const d = new Date(timestamp);
  const day = d.getDate();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${months[d.getMonth()]}`;
}

/**
 * Format numerical graph count with tasteful tabular digits (e.g. 08 vs 00)
 */
export function formatTabularCount(count: number): string {
  if (count <= 0) return '00';
  return count < 10 ? `0${count}` : `${count}`;
}

/**
 * PersonaActivityPanel
 *
 * Left-side learning activity overview within GraphMind Persona.
 * Features a refined Swiss-editorial typography hierarchy and a coordinated 5-phase
 * entrance animation sequence.
 */
export const PersonaActivityPanel: React.FC<PersonaActivityPanelProps> = React.memo(({
  onSelectGraph,
  onOpenOverview,
  onOpenStudy,
  onResumeRevision,
  onOpenRevision,
  hasExistingResumeAction,
  activeGraphId,
  className = ''
}) => {
  const { stats, isLoading, error, refresh } = usePersonaStats();
  const graphContext = useOptionalGraph();
  const shouldReduceMotion = useReducedMotion();

  // Phase 1: Coordinated panel container entrance from bottom (+12px -> 0px)
  const containerVariants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 12
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.6,
        ease: [0.16, 1, 0.3, 1],
        staggerChildren: shouldReduceMotion ? 0 : 0.09,
        delayChildren: shouldReduceMotion ? 0 : 0.06
      }
    }
  };

  // Phase 2: Editorial group container entrance
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

  // Phase A: Eyebrow green indicator dot & uppercase label (0–500ms)
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

  // Phase B: Supporting headline reveal (180–550ms)
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

  // Phase C: Graph count label, clipped vertical reveal, and description (400–1,250ms)
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
        delay: shouldReduceMotion ? 0 : 0.42,
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
        delay: shouldReduceMotion ? 0 : 0.48,
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
        delay: shouldReduceMotion ? 0 : 0.78,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  // Phase D: Learning progress label, clipped percentage reveal, track, and description (1,000–2,100ms)
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
        delay: shouldReduceMotion ? 0 : 0.98,
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
        delay: shouldReduceMotion ? 0 : 1.06,
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
        delay: shouldReduceMotion ? 0 : 1.30,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  const progressTrackVariants: Variants = {
    hidden: {
      opacity: 0
    },
    visible: {
      opacity: 1,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.45,
        delay: shouldReduceMotion ? 0 : 1.15,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  // Phase E: Recent activity heading and staggered rows (1,850–2,700ms)
  const recentHeadingVariants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 6
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.35,
        delay: shouldReduceMotion ? 0 : 1.82,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  const listContainerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        delayChildren: shouldReduceMotion ? 0 : 1.95,
        staggerChildren: shouldReduceMotion ? 0 : 0.12
      }
    }
  };

  const listItemVariants: Variants = {
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

  const rowDotVariants: Variants = {
    hidden: {
      opacity: 0,
      scale: shouldReduceMotion ? 1 : 0.6
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
    hidden: {
      opacity: 0
    },
    visible: {
      opacity: 1,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.32,
        delay: shouldReduceMotion ? 0 : 0.08,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  // Phase F: Suggested next step label and editorial content (2,300–2,800ms)
  const recommendationLabelVariants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 6
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.35,
        delay: shouldReduceMotion ? 0 : 2.30,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  const recommendationContentVariants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 6
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.38,
        delay: shouldReduceMotion ? 0 : 2.42,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  const recentList: RecentGraphActivity[] = useMemo(() => {
    if (!stats?.activity) return [];
    if (stats.activity.recentGraphs && stats.activity.recentGraphs.length > 0) {
      return stats.activity.recentGraphs.slice(0, 3);
    }
    if (stats.activity.recentGraph) {
      return [stats.activity.recentGraph];
    }
    return [];
  }, [stats?.activity]);

  // Contextual next-step recommendation calculation
  const currentActiveGraphId = activeGraphId ?? graphContext?.activeGraph?.id ?? null;
  const hasResumeActionRendered = hasExistingResumeAction ?? Boolean(stats?.performance?.activeRevisionProgress && onResumeRevision);

  const recommendation = useMemo<PersonaNextStepRecommendation | null>(() => {
    return getPersonaNextStepRecommendation(stats, {
      activeGraphId: currentActiveGraphId,
      hasExistingResumeAction: hasResumeActionRendered
    });
  }, [stats, currentActiveGraphId, hasResumeActionRendered]);

  const handleRecommendationAction = () => {
    if (!recommendation) return;

    switch (recommendation.type) {
      case 'resume-revision':
        if (recommendation.graphId && onResumeRevision) {
          onResumeRevision(recommendation.graphId);
        } else if (recommendation.graphId && onSelectGraph) {
          onSelectGraph(recommendation.graphId);
        } else if (onOpenStudy) {
          onOpenStudy();
        }
        break;

      case 'review-concepts':
        if (onOpenRevision) {
          onOpenRevision(recommendation.conceptName);
        } else if (recommendation.graphId && onSelectGraph) {
          onSelectGraph(recommendation.graphId);
        } else if (onOpenStudy) {
          onOpenStudy();
        }
        break;

      case 'take-assessment':
        if (recommendation.graphId && onSelectGraph) {
          onSelectGraph(recommendation.graphId);
        } else if (onOpenStudy) {
          onOpenStudy();
        }
        break;

      case 'continue-learning':
        if (recommendation.destination === 'overview') {
          if (onOpenOverview) {
            onOpenOverview();
          }
        } else if (recommendation.graphId && onSelectGraph) {
          onSelectGraph(recommendation.graphId);
        } else if (onOpenOverview) {
          onOpenOverview();
        }
        break;
    }
  };

  // Handle loading state quietly without layout shifts
  if (isLoading && !stats) {
    return (
      <aside
        className={`persona-activity-panel persona-activity-panel--loading ${className}`}
        aria-label="Learning Activity Statistics"
      >
        <div className="persona-activity-header">
          <div className="persona-activity-tag">
            <span className="persona-activity-tag-bullet" aria-hidden="true" />
            <span>YOUR LEARNING</span>
          </div>
          <p className="persona-activity-subtitle">Loading activity across GraphMind…</p>
        </div>
      </aside>
    );
  }

  // Handle error state gracefully with retry capability
  if (error && !stats) {
    return (
      <aside
        className={`persona-activity-panel persona-activity-panel--error ${className}`}
        aria-label="Learning Activity Statistics"
      >
        <div className="persona-activity-header">
          <div className="persona-activity-tag">
            <span className="persona-activity-tag-bullet persona-activity-tag-bullet--error" aria-hidden="true" />
            <span>YOUR LEARNING</span>
          </div>
          <p className="persona-activity-subtitle">Unable to load activity.</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="persona-activity-retry-btn"
          aria-label="Retry loading learning statistics"
        >
          Retry
        </button>
      </aside>
    );
  }

  const activity = stats?.activity;
  const totalGraphs = activity?.totalGraphs || 0;
  const totalConcepts = activity?.totalConcepts || 0;
  const demonstratedConcepts = activity?.demonstratedConcepts || 0;
  const demonstratedPercentage = activity?.demonstratedPercentage || 0;
  const progressRatio = totalConcepts === 0 ? 0 : Math.max(0, Math.min(100, demonstratedPercentage)) / 100;

  return (
    <motion.aside
      className={`persona-activity-panel ${className}`}
      aria-label="Learning Activity Statistics"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      id="persona-activity-panel"
    >
      {/* Group A — Introduction (Level 1: Section Identity & Level 2: Supporting Headline) */}
      <motion.div className="persona-activity-group persona-activity-group--intro persona-activity-header" variants={itemVariants}>
        <div className="persona-activity-tag">
          <motion.span
            className="persona-activity-tag-bullet"
            aria-hidden="true"
            variants={eyebrowDotVariants}
          />
          <motion.span variants={eyebrowTextVariants}>YOUR LEARNING</motion.span>
        </div>
        <motion.p className="persona-activity-subtitle" variants={headlineVariants}>
          Your activity across GraphMind
        </motion.p>
      </motion.div>

      {/* Group B — Learning Metrics (Level 4: Metric Labels, Level 3: Primary Statistics, Level 5: Supporting Descriptions) */}
      <motion.div className="persona-activity-group persona-activity-group--metrics" variants={itemVariants}>
        {/* Metric 1: Knowledge Graphs (Phase C) */}
        <div className="persona-stat-block">
          <button
            type="button"
            onClick={onOpenOverview}
            disabled={!onOpenOverview}
            className={`persona-stat-trigger ${onOpenOverview ? 'persona-stat-trigger--interactive' : ''}`}
            aria-label={`Open knowledge graphs overview (${totalGraphs} ${totalGraphs === 1 ? 'graph' : 'graphs'})`}
          >
            <motion.span className="persona-stat-label" variants={metric1LabelVariants}>
              YOUR GRAPHS
            </motion.span>
            <span className="persona-stat-value persona-stat-value-clip" data-testid="persona-total-graphs">
              <motion.span className="persona-stat-value-inner" variants={metric1ValueVariants}>
                <PersonaAnimatedNumber
                  value={totalGraphs}
                  format={formatTabularCount}
                  duration={850}
                  delay={shouldReduceMotion ? 0 : 460}
                  min={0}
                />
              </motion.span>
            </span>
          </button>
          <motion.span className="persona-stat-subtext" variants={metric1SubtextVariants}>
            {totalGraphs === 0
              ? 'No knowledge graphs created yet'
              : totalGraphs === 1
              ? 'Knowledge graph created'
              : 'Knowledge graphs created'}
          </motion.span>
        </div>

        {/* Metric 2: Demonstrated Learning Progress (Phase D) */}
        <div className="persona-stat-block">
          <button
            type="button"
            onClick={onOpenStudy}
            disabled={!onOpenStudy}
            className={`persona-stat-trigger ${onOpenStudy ? 'persona-stat-trigger--interactive' : ''}`}
            aria-label={`Open learning overview and concept progress (${totalConcepts === 0 ? 'no progress yet' : `${demonstratedPercentage}% demonstrated understanding`})`}
          >
            <motion.span className="persona-stat-label" variants={metric2LabelVariants}>
              LEARNING PROGRESS
            </motion.span>
            <span className="persona-stat-value persona-stat-value-clip" data-testid="persona-demonstrated-percentage">
              <motion.span className="persona-stat-value-inner" variants={metric2ValueVariants}>
                {totalConcepts === 0 ? (
                  '—%'
                ) : (
                  <PersonaAnimatedNumber
                    value={demonstratedPercentage}
                    suffix="%"
                    duration={950}
                    delay={shouldReduceMotion ? 0 : 1080}
                    min={0}
                    max={100}
                  />
                )}
              </motion.span>
            </span>
          </button>
          <motion.span className="persona-stat-subtext" variants={metric2SubtextVariants}>
            {totalConcepts === 0
              ? 'Progress will appear as you study concepts'
              : demonstratedConcepts === 0
              ? 'Concepts studied — review in progress'
              : `${demonstratedConcepts} of ${totalConcepts} concepts understood`}
          </motion.span>

          {/* Thin horizontal progress indicator bar (Starts at zero, scales to exact %) */}
          <motion.div
            className={`persona-progress-track ${onOpenStudy ? 'persona-progress-track--interactive' : ''}`}
            role="progressbar"
            aria-valuenow={totalConcepts === 0 ? 0 : Math.round(demonstratedPercentage)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Demonstrated understanding progress"
            variants={progressTrackVariants}
            onClick={onOpenStudy}
            tabIndex={onOpenStudy ? 0 : undefined}
            onKeyDown={(e) => {
              if (onOpenStudy && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onOpenStudy();
              }
            }}
          >
            <motion.div
              className="persona-progress-fill"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: progressRatio }}
              style={{ transformOrigin: 'left' }}
              transition={{
                duration: shouldReduceMotion ? 0 : 1.0,
                delay: shouldReduceMotion ? 0 : 1.20,
                ease: [0.16, 1, 0.3, 1]
              }}
            />
          </motion.div>
        </div>
      </motion.div>

      {/* Group C — Recent Activity (Phase E) */}
      <motion.div className="persona-activity-group persona-activity-group--recent persona-stat-block persona-stat-block--activity" variants={itemVariants}>
        <motion.span className="persona-stat-label" variants={recentHeadingVariants}>
          RECENT ACTIVITY
        </motion.span>

        {recentList.length === 0 ? (
          <motion.p
            className="persona-activity-empty-message"
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.38,
              delay: shouldReduceMotion ? 0 : 1.95,
              ease: [0.16, 1, 0.3, 1]
            }}
          >
            Your graphs will appear here as you create and develop them.
          </motion.p>
        ) : (
          <motion.ul
            className="persona-activity-list"
            role="list"
            variants={listContainerVariants}
            initial="hidden"
            animate="visible"
          >
            {recentList.map((graph) => {
              const isClickable = Boolean(onSelectGraph && graph.graphId);
              return (
                <motion.li
                  key={graph.graphId}
                  className="persona-activity-item-wrapper"
                  variants={listItemVariants}
                >
                  <button
                    type="button"
                    onClick={() => isClickable && onSelectGraph?.(graph.graphId)}
                    disabled={!isClickable}
                    className={`persona-activity-item ${isClickable ? 'persona-activity-item--interactive' : ''}`}
                    title={isClickable ? `Open graph: ${graph.graphName}` : graph.graphName}
                    aria-label={`Open knowledge graph: ${graph.graphName}, updated ${formatRelativeTime(graph.updatedAt || graph.createdAt)}`}
                  >
                    <motion.span className="persona-activity-dot" aria-hidden="true" variants={rowDotVariants} />
                    <motion.span className="persona-activity-name" variants={rowNameVariants}>{graph.graphName}</motion.span>
                    <motion.time
                      className="persona-activity-time"
                      dateTime={graph.updatedAt || graph.createdAt}
                      variants={rowTimeVariants}
                    >
                      {formatRelativeTime(graph.updatedAt || graph.createdAt)}
                    </motion.time>
                  </button>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </motion.div>

      {/* Group D — Suggested Next Step (Phase F) */}
      {recommendation && (
        <motion.div
          className="persona-activity-group persona-recommendation-group persona-stat-block"
          variants={itemVariants}
          data-testid="persona-suggested-next-step"
        >
          <motion.span
            className="persona-stat-label persona-recommendation-label"
            variants={recommendationLabelVariants}
          >
            SUGGESTED NEXT STEP
          </motion.span>
          <motion.div
            className="persona-recommendation-content"
            variants={recommendationContentVariants}
          >
            <h4 className="persona-recommendation-title">{recommendation.title}</h4>
            <p className="persona-recommendation-desc">{recommendation.description}</p>
            <button
              type="button"
              className="persona-recommendation-action-btn"
              onClick={handleRecommendationAction}
              aria-label={`${recommendation.actionLabel}: ${recommendation.title}`}
              data-testid="persona-recommendation-action"
            >
              <span>{recommendation.actionLabel}</span>
              <ArrowRight size={11} className="persona-recommendation-arrow" aria-hidden="true" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </motion.aside>
  );
});

PersonaActivityPanel.displayName = 'PersonaActivityPanel';
