import React, { useState, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, ArrowLeft, CheckCircle2, Circle } from 'lucide-react';
import type { LearningPath } from '../../types';
import type { KnowledgeSource } from '../../types/knowledgeGraph';

interface LearningPathsViewProps {
  paths: LearningPath[];
  onSelectPath: (pathId: string) => void;
  onOpenUpload?: () => void;
  isLoading?: boolean;
  loadingMessage?: string;
  totalConceptsInGraph?: number;
  totalRelationshipsInGraph?: number;
  onToggleCompleteConcept?: (conceptId: string) => void;
  onExploreConceptInGraph?: (conceptId: string) => void;
  sources?: KnowledgeSource[];
}

// Gold-standard editorial deceleration curve: crisp release, velvety asymptotic stop
const REVEAL_EASE = [0.16, 1, 0.3, 1] as const;

export const LearningPathsView: React.FC<LearningPathsViewProps> = ({
  paths,
  onSelectPath,
  onOpenUpload,
  isLoading = false,
  loadingMessage,
  totalConceptsInGraph = 0,
  onToggleCompleteConcept,
  onExploreConceptInGraph,
  sources = []
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);

  // Active path for hero visual level
  const activePathId = useMemo(() => {
    const inProgress = paths.find((p) => p.progress > 0 && p.progress < 100);
    if (inProgress) return inProgress.id;
    const anyProgress = paths.find((p) => p.progress > 0);
    return anyProgress?.id || paths[0]?.id || null;
  }, [paths]);

  const currentSelectedPath = useMemo(() => {
    if (!selectedPathId) return null;
    return paths.find((p) => p.id === selectedPathId) || null;
  }, [selectedPathId, paths]);

  // Formatted count: "03 PATHS"
  const formattedCount = String(paths.length).padStart(2, '0');

  // Split title for editorial hierarchy
  const parseTitleConcepts = (rawTitle: string) => {
    const arrowRegex = /\s+(?:to|→)\s+/i;
    if (arrowRegex.test(rawTitle)) {
      const parts = rawTitle.split(arrowRegex);
      return {
        origin: parts[0],
        destination: parts.slice(1).join(' → ')
      };
    }
    return { origin: rawTitle, destination: null };
  };

  // Helper to find source provenance display name
  const getProvenanceSourceName = (sourceIds?: string[]): string | null => {
    if (!sourceIds || sourceIds.length === 0) return null;
    const firstSourceId = sourceIds[0];
    const match = sources.find((s) => s.id === firstSourceId);
    if (match) {
      return match.name || match.fileName || firstSourceId;
    }
    return firstSourceId.replace(/^src-/, '');
  };

  // -------------------------------------------------------------------------
  // RENDER: Learning Experience / Path Curriculum Sequence View
  // -------------------------------------------------------------------------
  if (currentSelectedPath) {
    const { origin, destination } = parseTitleConcepts(currentSelectedPath.title);
    const completedSet = new Set(currentSelectedPath.completedConceptIds || []);
    const isCompleted = currentSelectedPath.progress === 100;
    const isPlanned = currentSelectedPath.progress === 0;

    return (
      <div className="paths-page-container">
        <div className="paths-curriculum-container">
          {/* Back button */}
          <button
            type="button"
            className="paths-back-btn"
            onClick={() => setSelectedPathId(null)}
            aria-label="Back to all learning paths"
          >
            <ArrowLeft size={13} aria-hidden="true" />
            <span>All Learning Paths</span>
          </button>

          {/* Curriculum Header */}
          <header className="paths-curriculum-header">
            <span className="paths-curriculum-kicker">Curriculum Route</span>
            <h1 className="paths-curriculum-title">
              <span>{origin}</span>
              {destination && (
                <>
                  <span className="paths-title-arrow" aria-hidden="true">→</span>
                  <span>{destination}</span>
                </>
              )}
            </h1>

            <div className="paths-curriculum-meta-row">
              <span>{currentSelectedPath.nodeCount} concepts</span>
              <span className="paths-meta-dot" aria-hidden="true">·</span>
              <span>{currentSelectedPath.estimatedHours}</span>
              <span className="paths-meta-dot" aria-hidden="true">·</span>
              {isCompleted ? (
                <span className="paths-meta-status is-complete">COMPLETE</span>
              ) : isPlanned ? (
                <span className="paths-meta-status is-planned">NOT STARTED</span>
              ) : (
                <span>{currentSelectedPath.progress}% complete</span>
              )}
            </div>

            {/* Progress track */}
            <div className="paths-progress-track" style={{ maxWidth: '400px', marginTop: '10px' }}>
              <div
                className="paths-progress-fill"
                style={{
                  width: `${Math.min(100, Math.max(0, currentSelectedPath.progress))}%`
                }}
              />
            </div>
          </header>

          {/* Ordered Concept Stepper */}
          <div className="paths-curriculum-stepper" role="list">
            {currentSelectedPath.concepts.map((concept, idx) => {
              const isConceptCompleted = completedSet.has(concept.id);
              const stepNumber = String(idx + 1).padStart(2, '0');
              const sourceName = getProvenanceSourceName(concept.sourceIds);

              return (
                <article
                  key={concept.id}
                  className={['paths-step-card', isConceptCompleted ? 'is-completed' : ''].join(' ')}
                  role="listitem"
                >
                  {/* Step rail */}
                  <div className="paths-step-rail">
                    <div className="paths-step-marker">
                      {isConceptCompleted ? (
                        <CheckCircle2 size={14} strokeWidth={2.2} />
                      ) : (
                        <span>{stepNumber}</span>
                      )}
                    </div>
                    {idx < currentSelectedPath.concepts.length - 1 && (
                      <div className="paths-step-line" />
                    )}
                  </div>

                  {/* Step body */}
                  <div className="paths-step-body">
                    <div className="paths-step-header">
                      <h2 className="paths-step-title">{concept.name}</h2>
                      {concept.type && (
                        <span className="paths-step-badge">
                          {concept.type}
                        </span>
                      )}
                    </div>

                    {concept.description && (
                      <p className="paths-step-desc">{concept.description}</p>
                    )}

                    {sourceName && (
                      <div className="paths-step-provenance">
                        <span>Introduced in:</span>
                        <span>{sourceName}</span>
                      </div>
                    )}

                    <div className="paths-step-actions">
                      {onExploreConceptInGraph ? (
                        <button
                          type="button"
                          className="paths-step-btn-graph"
                          onClick={() => onExploreConceptInGraph(concept.id)}
                          aria-label={`View ${concept.name} in knowledge graph`}
                        >
                          <span>Open in graph</span>
                          <ArrowUpRight size={12} strokeWidth={1.8} aria-hidden="true" />
                        </button>
                      ) : (
                        <div />
                      )}

                      {onToggleCompleteConcept && (
                        <button
                          type="button"
                          className={[
                            'paths-step-btn-complete',
                            isConceptCompleted ? 'is-active' : ''
                          ].join(' ')}
                          onClick={() => onToggleCompleteConcept(concept.id)}
                          aria-label={isConceptCompleted ? `Mark ${concept.name} as uncompleted` : `Mark ${concept.name} as completed`}
                        >
                          {isConceptCompleted ? (
                            <>
                              <CheckCircle2 size={13} strokeWidth={2} />
                              <span>Completed</span>
                            </>
                          ) : (
                            <>
                              <Circle size={13} strokeWidth={1.8} />
                              <span>Mark complete</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // RENDER: Main Curriculum Routes List
  // -------------------------------------------------------------------------
  return (
    <div className="paths-page-container">
      {/* 1. Architectural Editorial Page Header */}
      <header className="paths-header">
        <div className="paths-header-intro">
          <div className="paths-header-main">
            {/* Small uppercase technical label: CURRICULUM */}
            <motion.span
              className="paths-eyebrow"
              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.50, delay: 0.06, ease: REVEAL_EASE }}
            >
              Curriculum
            </motion.span>

            {/* Large two-line editorial heading */}
            <h1 className="paths-title" aria-label="Learning paths">
              <span className="paths-title-clip">
                <motion.span
                  className="paths-title-line"
                  initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: '100%' }}
                  animate={{ opacity: 1, y: '0%' }}
                  transition={{ duration: 0.70, delay: 0.10, ease: REVEAL_EASE }}
                >
                  Learning
                </motion.span>
              </span>
              <span className="paths-title-clip">
                <motion.span
                  className="paths-title-line"
                  initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: '100%' }}
                  animate={{ opacity: 1, y: '0%' }}
                  transition={{ duration: 0.70, delay: 0.18, ease: REVEAL_EASE }}
                >
                  paths
                </motion.span>
              </span>
            </h1>

            {/* Supporting editorial subtext with intentional gap */}
            <motion.p
              className="paths-subtext"
              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.26, ease: REVEAL_EASE }}
            >
              Generated from the relationships in your knowledge graph.
            </motion.p>
          </div>

          {/* Quiet header metadata: 03 PATHS */}
          <motion.div
            className="paths-header-meta"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.18, ease: REVEAL_EASE }}
          >
            <span className="paths-meta-count">{formattedCount} PATHS</span>
          </motion.div>
        </div>

        {/* 1px Hairline divider rule */}
        <motion.div
          className="paths-header-divider"
          initial={shouldReduceMotion ? { opacity: 1, scaleX: 1 } : { opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.70, delay: 0.30, ease: REVEAL_EASE }}
          style={{ transformOrigin: '0% 50%' }}
        />
      </header>

      {/* 2. Loading State */}
      {isLoading ? (
        <div className="paths-empty-state">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent)',
                display: 'inline-block'
              }}
            />
            <span className="paths-empty-label" style={{ margin: 0 }}>PROCESSING</span>
          </div>
          <p className="paths-empty-desc" style={{ color: '#F0F0F0', fontSize: '16px', fontWeight: 500 }}>
            Building learning paths…
          </p>
          <p className="paths-empty-desc" style={{ marginTop: '-12px', fontSize: '13.5px' }}>
            {loadingMessage || 'Analyzing relationships and structuring your curriculum.'}
          </p>
        </div>
      ) : paths.length > 0 ? (
        /* 3. Curriculum Routes List (Differentiated Hierarchy) */
        <div className="paths-list" role="list">
          {paths.map((path, idx) => {
            const isHero = idx === 0 || path.id === activePathId;
            const isSecondary = idx === 1 && !isHero;
            const levelClass = isHero ? 'level-hero' : isSecondary ? 'level-secondary' : 'level-tertiary';

            const isCompleted = path.progress === 100;
            const isPlanned = path.progress === 0;
            const rowNumber = String(idx + 1).padStart(2, '0');
            const { origin, destination } = parseTitleConcepts(path.title);

            // Staggered base delays for typesetting assembly
            const baseDelay = isHero ? 0.38 : isSecondary ? 0.68 : 0.84;

            const handleRowClick = () => {
              setSelectedPathId(path.id);
              onSelectPath(path.id);
            };

            return (
              <motion.article
                key={path.id}
                className={['paths-row', levelClass, isHero ? 'is-active' : ''].join(' ')}
                role="button"
                tabIndex={0}
                aria-label={`${path.progress > 0 ? 'Continue' : 'Start'} learning path ${rowNumber}: ${path.title}`}
                onClick={handleRowClick}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleRowClick();
                  }
                }}
                initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.60, delay: baseDelay, ease: REVEAL_EASE }}
              >
                {/* ── Left Rail: Number Column + Architectural Route Marker ── */}
                <div className="paths-row-rail">
                  <div className="paths-rail-header">
                    <motion.span
                      className="paths-row-number"
                      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.45, delay: baseDelay, ease: REVEAL_EASE }}
                    >
                      {rowNumber}
                    </motion.span>
                    <motion.span
                      className="paths-rail-marker"
                      aria-hidden="true"
                      initial={shouldReduceMotion ? { opacity: 1, scaleY: 1 } : { opacity: 0, scaleY: 0 }}
                      animate={{ opacity: 1, scaleY: 1 }}
                      transition={{ duration: 0.50, delay: baseDelay + 0.04, ease: REVEAL_EASE }}
                      style={{ transformOrigin: '0% 0%' }}
                    />
                  </div>

                  {/* Hero active route guide line extending down alongside the route */}
                  {isHero && (
                    <motion.span
                      className="paths-rail-route-guide"
                      aria-hidden="true"
                      initial={shouldReduceMotion ? { opacity: 1, scaleY: 1 } : { opacity: 0, scaleY: 0 }}
                      animate={{ opacity: 1, scaleY: 1 }}
                      transition={{ duration: 0.60, delay: baseDelay + 0.08, ease: REVEAL_EASE }}
                      style={{ transformOrigin: '0% 0%' }}
                    />
                  )}
                </div>

                {/* ── Center Column: Title, Metadata, Progress Line ── */}
                <div className="paths-row-center">
                  {/* Title with intentional hierarchy per level */}
                  {isHero ? (
                    <motion.h2
                      className="paths-hero-title"
                      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.50, delay: baseDelay + 0.05, ease: REVEAL_EASE }}
                    >
                      <span className="paths-hero-title-line">{origin}</span>
                      {destination && (
                        <span className="paths-hero-title-line destination">
                          <span className="paths-title-arrow" aria-hidden="true">→</span>
                          {destination}
                        </span>
                      )}
                    </motion.h2>
                  ) : isSecondary ? (
                    <motion.h2
                      className="paths-secondary-title"
                      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.50, delay: baseDelay + 0.05, ease: REVEAL_EASE }}
                    >
                      <span>{origin}</span>
                      {destination && (
                        <>
                          <span className="paths-title-arrow" aria-hidden="true">→</span>
                          <span>{destination}</span>
                        </>
                      )}
                    </motion.h2>
                  ) : (
                    <motion.h2
                      className="paths-tertiary-title"
                      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.50, delay: baseDelay + 0.05, ease: REVEAL_EASE }}
                    >
                      <span>{path.title.replace(/\s+(?:to|→)\s+/i, ' → ')}</span>
                    </motion.h2>
                  )}

                  {/* Metadata line */}
                  <motion.div
                    className="paths-row-meta"
                    initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.45, delay: baseDelay + 0.08, ease: REVEAL_EASE }}
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

                  {/* Progress Line */}
                  <motion.div
                    className="paths-progress-track"
                    aria-hidden="true"
                    initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.45, delay: baseDelay + 0.10, ease: REVEAL_EASE }}
                  >
                    {!isPlanned && (
                      <motion.div
                        className="paths-progress-fill"
                        style={{
                          width: `${Math.min(100, Math.max(0, path.progress))}%`,
                          transformOrigin: '0% 50%'
                        }}
                        initial={shouldReduceMotion ? { scaleX: 1 } : { scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        transition={{ duration: 0.70, delay: baseDelay + 0.12, ease: REVEAL_EASE }}
                      />
                    )}
                  </motion.div>
                </div>

                {/* ── Right Column: Typographic Action (CONTINUE ↗ / START ↗) ── */}
                <motion.div
                  className="paths-row-action"
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.45, delay: baseDelay + 0.12, ease: REVEAL_EASE }}
                >
                  <span className="paths-action-link">
                    <span>{path.progress > 0 ? 'CONTINUE' : 'START'}</span>
                    <ArrowUpRight size={12} strokeWidth={1.8} className="paths-action-arrow" aria-hidden="true" />
                  </span>
                </motion.div>

                {/* Bottom Hairline Rule between rows */}
                <motion.div
                  className="paths-row-divider"
                  aria-hidden="true"
                  initial={shouldReduceMotion ? { opacity: 1, scaleX: 1 } : { opacity: 0, scaleX: 0 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ duration: 0.65, delay: baseDelay + 0.04, ease: REVEAL_EASE }}
                  style={{ transformOrigin: '0% 50%' }}
                />
              </motion.article>
            );
          })}
        </div>
      ) : totalConceptsInGraph > 0 ? (
        /* 4. Insufficient Relationships State (Requirement 13) */
        <div className="paths-empty-state">
          <span className="paths-empty-label">INSUFFICIENT RELATIONSHIPS</span>
          <p className="paths-empty-desc">
            Learning paths will appear as your graph grows.
            <br />
            Your graph currently contains {totalConceptsInGraph} concepts, but there are not
            enough connected relationships to form a useful learning sequence yet.
          </p>
          <button
            type="button"
            className="paths-empty-action"
            onClick={onOpenUpload || (() => onSelectPath(''))}
            aria-label="Upload material"
          >
            <span>Upload material</span>
            <ArrowUpRight size={12} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      ) : (
        /* 5. Minimal Editorial Empty State (Requirement 12) */
        <div className="paths-empty-state">
          <span className="paths-empty-label">NO LEARNING PATHS YET</span>
          <p className="paths-empty-desc">
            Add study material and GraphMind will build learning paths from the
            relationships in your knowledge graph.
          </p>
          <button
            type="button"
            className="paths-empty-action"
            onClick={onOpenUpload || (() => onSelectPath(''))}
            aria-label="Upload material"
          >
            <span>Upload material</span>
            <ArrowUpRight size={12} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};
