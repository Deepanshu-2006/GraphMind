import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import type { LearningPath } from '../../types';

interface LearningPathsViewProps {
  paths: LearningPath[];
  onSelectPath: (pathId: string) => void;
}

// Gold-standard editorial deceleration curve: crisp start, velvety asymptotic stop
const REVEAL_EASE = [0.16, 1, 0.3, 1] as const;

export const LearningPathsView: React.FC<LearningPathsViewProps> = ({
  paths,
  onSelectPath
}) => {
  const shouldReduceMotion = useReducedMotion();

  // Find the primary active path (meaningful progress > 0 and < 100, or first path with progress)
  const activePathId = useMemo(() => {
    const inProgress = paths.find((p) => p.progress > 0 && p.progress < 100);
    if (inProgress) return inProgress.id;
    const anyProgress = paths.find((p) => p.progress > 0);
    return anyProgress?.id || paths[0]?.id || null;
  }, [paths]);

  // Formatted count: "03 PATHS"
  const formattedCount = String(paths.length).padStart(2, '0');

  // Format title with editorial directional arrow
  const renderFormattedTitle = (rawTitle: string) => {
    const arrowRegex = /\s+(?:to|→)\s+/i;
    if (arrowRegex.test(rawTitle)) {
      const parts = rawTitle.split(arrowRegex);
      return (
        <>
          <span>{parts[0]}</span>
          <span className="paths-title-arrow" aria-hidden="true">→</span>
          <span>{parts.slice(1).join(' → ')}</span>
        </>
      );
    }
    return <span>{rawTitle}</span>;
  };

  return (
    <div className="paths-page-container">
      {/* Editorial Page Header */}
      <header className="paths-header">
        <div className="paths-header-intro">
          <div className="paths-header-main">
            {/* Small uppercase technical eyebrow */}
            <motion.span
              className="paths-eyebrow"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, letterSpacing: '0.24em' }}
              animate={{ opacity: 1, letterSpacing: '0.18em' }}
              transition={{ duration: 0.55, delay: 0.06, ease: REVEAL_EASE }}
            >
              Curriculum
            </motion.span>

            {/* Large two-line editorial heading */}
            <h1 className="paths-title" aria-label="Learning paths">
              <span className="paths-title-clip">
                <motion.span
                  className="paths-title-line"
                  initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: '105%' }}
                  animate={{ opacity: 1, y: '0%' }}
                  transition={{ duration: 0.75, delay: 0.12, ease: REVEAL_EASE }}
                >
                  Learning
                </motion.span>
              </span>
              <span className="paths-title-clip">
                <motion.span
                  className="paths-title-line"
                  initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: '105%' }}
                  animate={{ opacity: 1, y: '0%' }}
                  transition={{ duration: 0.75, delay: 0.22, ease: REVEAL_EASE }}
                >
                  paths
                </motion.span>
              </span>
            </h1>

            {/* Supporting editorial subtext */}
            <motion.p
              className="paths-subtext"
              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.60, delay: 0.32, ease: REVEAL_EASE }}
            >
              Generated from the relationships in your knowledge graph.
            </motion.p>
          </div>

          {/* Quiet header metadata: actual path count */}
          <motion.div
            className="paths-header-meta"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.50, delay: 0.20, ease: REVEAL_EASE }}
          >
            <span className="paths-meta-count">{formattedCount} PATHS</span>
          </motion.div>
        </div>

        {/* 1px Hairline divider rule */}
        <motion.div
          className="paths-header-divider"
          initial={shouldReduceMotion ? { opacity: 1, scaleX: 1 } : { opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.75, delay: 0.36, ease: REVEAL_EASE }}
        />
      </header>

      {/* Curriculum Path Entries */}
      {paths.length > 0 ? (
        <div className="paths-list" role="list">
          {paths.map((path, idx) => {
            const isActive = path.id === activePathId;
            const isCompleted = path.progress === 100;
            const isPlanned = path.progress === 0;
            const rowNumber = String(idx + 1).padStart(2, '0');
            const rowDelay = 0.42 + idx * 0.08;

            return (
              <motion.article
                key={path.id}
                className={['paths-row', isActive ? 'is-active' : ''].join(' ')}
                role="button"
                tabIndex={0}
                aria-label={`${path.progress > 0 ? 'Continue' : 'Start'} learning path ${rowNumber}: ${path.title}`}
                onClick={() => onSelectPath(path.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectPath(path.id);
                  }
                }}
                initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: rowDelay, ease: REVEAL_EASE }}
              >
                {/* 1. Left Column: Monospace Number with vertical navigation marker (│) */}
                <motion.div
                  className="paths-row-number-col"
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.50, delay: rowDelay + 0.03, ease: REVEAL_EASE }}
                >
                  <span className="paths-row-number">{rowNumber}</span>
                  <span
                    className="paths-vertical-marker"
                    aria-hidden="true"
                    title={isActive ? 'Active path' : undefined}
                  />
                </motion.div>

                {/* 2. Center Column: Title, Metadata, Progress Track */}
                <div className="paths-row-center">
                  <motion.div
                    className="paths-row-title-wrap"
                    initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.60, delay: rowDelay + 0.05, ease: REVEAL_EASE }}
                  >
                    <h2 className="paths-row-title">
                      {renderFormattedTitle(path.title)}
                    </h2>
                  </motion.div>

                  {/* Clean metadata line */}
                  <motion.div
                    className="paths-row-meta"
                    initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.55, delay: rowDelay + 0.07, ease: REVEAL_EASE }}
                  >
                    <span>{path.nodeCount} concepts</span>
                    <span className="paths-meta-dot" aria-hidden="true">·</span>
                    <span>{path.estimatedHours}</span>
                    <span className="paths-meta-dot" aria-hidden="true">·</span>
                    {isCompleted ? (
                      <span className="paths-meta-status is-complete">COMPLETE</span>
                    ) : isPlanned ? (
                      <span className="paths-meta-status is-planned">NOT STARTED</span>
                    ) : (
                      <span>{path.progress}% complete</span>
                    )}
                  </motion.div>

                  {/* Editorial thin progress line (with faint track for unstarted) */}
                  <motion.div
                    className="paths-progress-track"
                    aria-hidden="true"
                    initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.50, delay: rowDelay + 0.08, ease: REVEAL_EASE }}
                  >
                    {!isPlanned && (
                      <motion.div
                        className="paths-progress-fill"
                        style={{ width: `${Math.min(100, Math.max(0, path.progress))}%` }}
                        initial={shouldReduceMotion ? { scaleX: 1 } : { scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.70, delay: rowDelay + 0.10, ease: REVEAL_EASE }}
                      />
                    )}
                  </motion.div>
                </div>

                {/* 3. Right Column: Quiet Text Action */}
                <motion.div
                  className="paths-row-action"
                  initial={shouldReduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.50, delay: rowDelay + 0.08, ease: REVEAL_EASE }}
                >
                  <span className="paths-action-link">
                    <span>{path.progress > 0 ? 'Continue' : 'Start'}</span>
                    <ArrowRight size={13} strokeWidth={1.5} className="paths-action-arrow" aria-hidden="true" />
                  </span>
                </motion.div>

                {/* Bottom Hairline Rule between rows */}
                <motion.div
                  className="paths-row-divider"
                  aria-hidden="true"
                  initial={shouldReduceMotion ? { opacity: 1, scaleX: 1 } : { opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ duration: 0.70, delay: rowDelay + 0.02, ease: REVEAL_EASE }}
                />
              </motion.article>
            );
          })}
        </div>
      ) : (
        /* Editorial Empty State */
        <div className="paths-empty-state">
          <span className="paths-empty-label">NO LEARNING PATHS</span>
          <p className="paths-empty-desc">
            Your knowledge graph does not contain enough connected concepts
            to generate a curriculum yet.
          </p>
          <button
            type="button"
            className="paths-empty-action"
            onClick={() => onSelectPath('')}
            aria-label="Explore knowledge graph"
          >
            <span>Explore knowledge graph</span>
            <ArrowRight size={13} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};
