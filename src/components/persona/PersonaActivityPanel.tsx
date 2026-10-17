import React, { useMemo } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { usePersonaStats } from './usePersonaStats';
import { PersonaAnimatedNumber } from './PersonaAnimatedNumber';
import type { RecentGraphActivity } from '../../types/personaStats';

export interface PersonaActivityPanelProps {
  onSelectGraph?: (graphId: string) => void;
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

export const PersonaActivityPanel: React.FC<PersonaActivityPanelProps> = ({
  onSelectGraph,
  className = ''
}) => {
  const { stats, isLoading, error, refresh } = usePersonaStats();
  const shouldReduceMotion = useReducedMotion();

  // Animation variants for editorial staggered entrance with subtle horizontal motion
  const containerVariants: Variants = {
    hidden: {
      opacity: 0,
      x: shouldReduceMotion ? 0 : -10
    },
    visible: {
      opacity: 1,
      x: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.5,
        ease: [0.16, 1, 0.3, 1],
        staggerChildren: shouldReduceMotion ? 0 : 0.08,
        delayChildren: shouldReduceMotion ? 0 : 0.1
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

  return (
    <motion.aside
      className={`persona-activity-panel ${className}`}
      aria-label="Learning Activity Statistics"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      id="persona-activity-panel"
    >
      {/* A. Section Heading */}
      <motion.div className="persona-activity-header" variants={itemVariants}>
        <div className="persona-activity-tag">
          <span className="persona-activity-tag-bullet" aria-hidden="true" />
          <span>YOUR LEARNING</span>
        </div>
        <p className="persona-activity-subtitle">Your activity across GraphMind</p>
      </motion.div>

      {/* B. Knowledge Graph Count */}
      <motion.div className="persona-stat-block" variants={itemVariants}>
        <span className="persona-stat-label">YOUR GRAPHS</span>
        <div className="persona-stat-value" data-testid="persona-total-graphs">
          <PersonaAnimatedNumber
            value={totalGraphs}
            format={formatTabularCount}
            min={0}
          />
        </div>
        <span className="persona-stat-subtext">
          {totalGraphs === 0
            ? 'No knowledge graphs created yet'
            : totalGraphs === 1
            ? 'Knowledge graph created'
            : 'Knowledge graphs created'}
        </span>
      </motion.div>

      {/* C. Demonstrated Learning Progress */}
      <motion.div className="persona-stat-block" variants={itemVariants}>
        <span className="persona-stat-label">LEARNING PROGRESS</span>
        <div className="persona-stat-value" data-testid="persona-demonstrated-percentage">
          {totalConcepts === 0 ? (
            '—%'
          ) : (
            <PersonaAnimatedNumber
              value={demonstratedPercentage}
              suffix="%"
              min={0}
              max={100}
            />
          )}
        </div>
        <span className="persona-stat-subtext">
          {totalConcepts === 0
            ? 'Progress will appear as you study concepts'
            : demonstratedConcepts === 0
            ? 'Concepts studied — review in progress'
            : `${demonstratedConcepts} of ${totalConcepts} concepts understood`}
        </span>

        {/* Thin horizontal progress indicator bar */}
        <div
          className="persona-progress-track"
          role="progressbar"
          aria-valuenow={totalConcepts === 0 ? 0 : demonstratedPercentage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Demonstrated understanding progress"
        >
          <motion.div
            className="persona-progress-fill"
            initial={{ width: 0 }}
            animate={{ width: `${totalConcepts === 0 ? 0 : demonstratedPercentage}%` }}
            transition={{
              duration: shouldReduceMotion ? 0 : 0.65,
              ease: [0.16, 1, 0.3, 1]
            }}
          />
        </div>
      </motion.div>

      {/* D. Recent Graph Activity */}
      <motion.div className="persona-stat-block persona-stat-block--activity" variants={itemVariants}>
        <span className="persona-stat-label">RECENT ACTIVITY</span>

        {recentList.length === 0 ? (
          <p className="persona-activity-empty-message">
            Your graphs will appear here as you create and develop them.
          </p>
        ) : (
          <motion.ul
            className="persona-activity-list"
            role="list"
            layout={!shouldReduceMotion}
          >
            {recentList.map((graph) => {
              const isClickable = Boolean(onSelectGraph && graph.graphId);
              return (
                <motion.li
                  key={graph.graphId}
                  className="persona-activity-item-wrapper"
                  layout={!shouldReduceMotion}
                  initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <button
                    type="button"
                    onClick={() => isClickable && onSelectGraph?.(graph.graphId)}
                    disabled={!isClickable}
                    className={`persona-activity-item ${isClickable ? 'persona-activity-item--interactive' : ''}`}
                    title={isClickable ? `Open graph: ${graph.graphName}` : graph.graphName}
                    aria-label={`Open knowledge graph: ${graph.graphName}, updated ${formatRelativeTime(graph.updatedAt || graph.createdAt)}`}
                  >
                    <span className="persona-activity-dot" aria-hidden="true" />
                    <span className="persona-activity-name">{graph.graphName}</span>
                    <time
                      className="persona-activity-time"
                      dateTime={graph.updatedAt || graph.createdAt}
                    >
                      {formatRelativeTime(graph.updatedAt || graph.createdAt)}
                    </time>
                  </button>
                </motion.li>
              );
            })}
          </motion.ul>
        )}
      </motion.div>
    </motion.aside>
  );
};
