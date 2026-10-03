import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight } from 'lucide-react';
import type { RecentMaterial } from '../../types';

interface SourcesViewProps {
  sources: RecentMaterial[];
  onAddSource: () => void;
  onRemoveSource?: (sourceId: string) => void;
}

// Gold-standard editorial deceleration curve: crisp start, velvety asymptotic stop
const REVEAL_EASE = [0.16, 1, 0.3, 1] as const;

export const SourcesView: React.FC<SourcesViewProps> = ({
  sources,
  onAddSource,
  onRemoveSource
}) => {
  const shouldReduceMotion = useReducedMotion();

  // State for inline deletion confirmation & deletion exit choreography
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showRemovedNotice, setShowRemovedNotice] = useState(false);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keyboard shortcut: Escape cancels active confirmation
  useEffect(() => {
    if (!confirmingId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setConfirmingId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmingId]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const handleStartRemove = (sourceId: string) => {
    setConfirmingId(sourceId);
  };

  const handleCancelRemove = () => {
    setConfirmingId(null);
  };

  const handleConfirmRemove = (sourceId: string) => {
    setDeletingId(sourceId);
    setConfirmingId(null);

    // 500ms smooth contraction animation before removing from parent state
    setTimeout(() => {
      onRemoveSource?.(sourceId);
      setDeletingId(null);
      setShowRemovedNotice(true);

      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = setTimeout(() => {
        setShowRemovedNotice(false);
      }, 2600);
    }, 500);
  };

  // Aggregate real stats
  const totalConcepts = useMemo(() => {
    return sources.reduce((acc, s) => acc + (s.conceptsExtracted || 0), 0);
  }, [sources]);

  const formattedSourceCount = String(sources.length).padStart(2, '0');

  // Format metadata line: PDF · 1.4 MB · ADDED JUST NOW
  const formatMetadata = (source: RecentMaterial) => {
    const parts: string[] = [];
    if (source.format) parts.push(source.format.toUpperCase());
    if (source.size) parts.push(source.size);
    if (source.timestamp) {
      const cleanTs = source.timestamp.replace(/^Added\s+/i, '');
      parts.push(`ADDED ${cleanTs.toUpperCase()}`);
    }
    return parts;
  };

  // Render state indicator: • INDEXED / • PROCESSING / • NEEDS ATTENTION
  const renderState = (status: string) => {
    const norm = status.toLowerCase();

    if (norm.includes('read')) {
      return (
        <div className="source-state-col">
          <span className="source-state-point processing" aria-hidden="true" />
          <span className="source-state-label">READING MATERIAL</span>
        </div>
      );
    }

    if (norm.includes('concept')) {
      return (
        <div className="source-state-col">
          <span className="source-state-point processing" aria-hidden="true" />
          <span className="source-state-label">FINDING CONCEPTS</span>
        </div>
      );
    }

    if (norm.includes('connect') || norm.includes('idea')) {
      return (
        <div className="source-state-col">
          <span className="source-state-point processing" aria-hidden="true" />
          <span className="source-state-label">CONNECTING IDEAS</span>
        </div>
      );
    }

    if (norm === 'ready' || norm === 'synced' || norm === 'indexed') {
      return (
        <div className="source-state-col">
          <span className="source-state-point indexed" aria-hidden="true" />
          <span className="source-state-label">INDEXED</span>
        </div>
      );
    }

    if (norm === 'processing' || norm === 'indexing') {
      return (
        <div className="source-state-col">
          <span className="source-state-point processing" aria-hidden="true" />
          <span className="source-state-label">PROCESSING</span>
        </div>
      );
    }

    if (norm === 'failed' || norm === 'error') {
      return (
        <div className="source-state-col">
          <span className="source-state-point failed" aria-hidden="true" />
          <span className="source-state-label failed">NEEDS ATTENTION</span>
        </div>
      );
    }

    return (
      <div className="source-state-col">
        <span className="source-state-point indexed" aria-hidden="true" />
        <span className="source-state-label">{status.toUpperCase()}</span>
      </div>
    );
  };

  return (
    <div className="sources-page-container">
      {/* 1. Asymmetric Editorial Page Header */}
      <header className="sources-header">
        <div className="sources-header-intro">
          <div className="sources-header-left">
            {/* Uppercase technical eyebrow: LIBRARY */}
            <motion.span
              className="sources-eyebrow"
              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.50, delay: 0.06, ease: REVEAL_EASE }}
            >
              Library
            </motion.span>

            {/* Editorial section title: Sources */}
            <h1 className="sources-title" aria-label="Sources">
              <span className="sources-title-clip">
                <motion.span
                  className="sources-title-line"
                  initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: '105%' }}
                  animate={{ opacity: 1, y: '0%' }}
                  transition={{ duration: 0.70, delay: 0.10, ease: REVEAL_EASE }}
                >
                  Sources
                </motion.span>
              </span>
            </h1>

            {/* Short supporting editorial statement */}
            <motion.p
              className="sources-subtext"
              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.22, ease: REVEAL_EASE }}
            >
              Your study material, organized and connected.
            </motion.p>
          </div>

          {/* Right side quiet utility area: metadata + upload action */}
          <motion.div
            className="sources-header-right"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.50, delay: 0.18, ease: REVEAL_EASE }}
          >
            <div className="sources-header-stats">
              <span className="sources-stat-item">{formattedSourceCount} SOURCES</span>
              <span className="sources-stat-item">{totalConcepts} CONCEPTS</span>
            </div>

            <button
              type="button"
              className="sources-upload-action"
              onClick={onAddSource}
              id="btn-sources-add-source"
              aria-label="Upload material"
            >
              <span>UPLOAD MATERIAL</span>
              <ArrowUpRight size={12} strokeWidth={1.8} className="sources-upload-arrow" aria-hidden="true" />
            </button>
          </motion.div>
        </div>

        {/* 2. Source Index Metadata Label & Hairline Divider */}
        <div className="sources-index-meta">
          <div className="sources-index-meta-left">
            <motion.span
              className="sources-index-label"
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.45, delay: 0.28, ease: REVEAL_EASE }}
            >
              Source Index
            </motion.span>

            <AnimatePresence>
              {showRemovedNotice && (
                <motion.span
                  className="sources-removed-pill"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.24, ease: REVEAL_EASE }}
                  aria-live="polite"
                >
                  <span className="source-state-point indexed" aria-hidden="true" />
                  <span>SOURCE REMOVED</span>
                </motion.span>
              )}
            </AnimatePresence>
          </div>

          <motion.span
            className="sources-index-count"
            initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.28, ease: REVEAL_EASE }}
          >
            {formattedSourceCount}
          </motion.span>
        </div>

        <motion.div
          className="sources-index-divider"
          initial={shouldReduceMotion ? { opacity: 1, scaleX: 1 } : { opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.70, delay: 0.32, ease: REVEAL_EASE }}
          style={{ transformOrigin: '0% 50%' }}
        />
      </header>

      {/* 3. Horizontal Editorial Archival List */}
      {sources.length > 0 ? (
        <div className="sources-list" role="list">
          {sources.map((source, idx) => {
            const isFirst = idx === 0;
            const rowNumber = String(idx + 1).padStart(2, '0');
            const metaParts = formatMetadata(source);
            const rowBaseDelay = 0.38 + idx * 0.07;
            const isConfirming = confirmingId === source.id;
            const isDeleting = deletingId === source.id;

            return (
              <motion.article
                key={source.id}
                className={[
                  'source-row',
                  isFirst ? 'is-first' : '',
                  isConfirming ? 'is-confirming' : '',
                  isDeleting ? 'is-deleting' : ''
                ].filter(Boolean).join(' ')}
                role="listitem"
                aria-label={`Source ${rowNumber}: ${source.title}`}
                initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
                animate={
                  isDeleting
                    ? {
                        height: 0,
                        minHeight: 0,
                        paddingTop: 0,
                        paddingBottom: 0,
                        opacity: 0,
                        overflow: 'hidden',
                        transition: {
                          duration: 0.50,
                          ease: REVEAL_EASE,
                          height: { delay: 0.12, duration: 0.38, ease: REVEAL_EASE },
                          paddingTop: { delay: 0.12, duration: 0.38, ease: REVEAL_EASE },
                          paddingBottom: { delay: 0.12, duration: 0.38, ease: REVEAL_EASE },
                          minHeight: { delay: 0.12, duration: 0.38, ease: REVEAL_EASE },
                        }
                      }
                    : { opacity: 1, y: 0 }
                }
                transition={{ duration: 0.55, delay: rowBaseDelay, ease: REVEAL_EASE }}
              >
                {/* Zone 1: Technical Number + Hover Green Indicator Line */}
                <div className="source-rail">
                  <motion.span
                    className="source-number"
                    initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                    animate={isDeleting ? { opacity: 0, x: -6 } : { opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, ease: REVEAL_EASE }}
                  >
                    {rowNumber}
                  </motion.span>
                  <span className="source-indicator-line" aria-hidden="true" />
                </div>

                {/* Main Body: Switches smoothly between Normal and Inline Confirmation */}
                <AnimatePresence mode="wait" initial={false}>
                  {!isConfirming ? (
                    <motion.div
                      key="normal"
                      className="source-row-body"
                      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -8 }}
                      animate={
                        isDeleting
                          ? { opacity: 0, x: -14, transition: { duration: 0.35, ease: REVEAL_EASE } }
                          : { opacity: 1, x: 0 }
                      }
                      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -8 }}
                      transition={{ duration: 0.28, ease: REVEAL_EASE }}
                    >
                      {/* Zone 2: Dominant Filename + Quiet File Metadata */}
                      <div className="source-content-col">
                        <span className="source-filename-clip">
                          <motion.h2
                            className="source-filename"
                            title={source.title}
                            initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: '105%' }}
                            animate={{ opacity: 1, y: '0%' }}
                            transition={{ duration: 0.60, delay: rowBaseDelay + 0.04, ease: REVEAL_EASE }}
                          >
                            {source.title}
                          </motion.h2>
                        </span>

                        <motion.div
                          className="source-meta-row"
                          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ duration: 0.45, delay: rowBaseDelay + 0.08, ease: REVEAL_EASE }}
                        >
                          {metaParts.map((item, mIdx) => (
                            <React.Fragment key={mIdx}>
                              {mIdx > 0 && <span className="source-meta-dot" aria-hidden="true">·</span>}
                              <span>{item}</span>
                            </React.Fragment>
                          ))}
                        </motion.div>
                      </div>

                      {/* Zone 3: Concept Count */}
                      <motion.div
                        className="source-concepts-col"
                        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.45, delay: rowBaseDelay + 0.10, ease: REVEAL_EASE }}
                      >
                        {source.conceptsExtracted !== undefined ? (
                          <span>{source.conceptsExtracted} CONCEPTS</span>
                        ) : (
                          <span className="source-concepts-pending">—</span>
                        )}
                      </motion.div>

                      {/* Zone 4: Source State (• INDEXED) */}
                      <motion.div
                        className="source-state-cell"
                        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.45, delay: rowBaseDelay + 0.12, ease: REVEAL_EASE }}
                      >
                        {renderState(source.status)}
                      </motion.div>

                      {/* Zone 5: Fixed Width Action Zone: REMOVE ↗ */}
                      <motion.div
                        className="source-action-zone"
                        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.45, delay: rowBaseDelay + 0.14, ease: REVEAL_EASE }}
                      >
                        {onRemoveSource && (
                          <button
                            type="button"
                            className="source-remove-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartRemove(source.id);
                            }}
                            aria-label={`Remove ${source.title}`}
                          >
                            REMOVE
                          </button>
                        )}

                        <ArrowUpRight
                          size={13}
                          strokeWidth={1.8}
                          className="source-link-arrow"
                          aria-hidden="true"
                        />
                      </motion.div>
                    </motion.div>
                  ) : (
                    /* Inline Confirmation State: occupying the same row */
                    <motion.div
                      key="confirm"
                      className="source-row-confirm-body"
                      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: 8 }}
                      animate={
                        isDeleting
                          ? { opacity: 0, x: -14, transition: { duration: 0.35, ease: REVEAL_EASE } }
                          : { opacity: 1, x: 0 }
                      }
                      exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: 8 }}
                      transition={{ duration: 0.28, ease: REVEAL_EASE }}
                    >
                      <div className="source-confirm-content">
                        <span className="source-confirm-title">Remove this source?</span>
                        <span className="source-confirm-filename">{source.title}</span>
                      </div>

                      <div className="source-confirm-actions">
                        <button
                          type="button"
                          className="source-confirm-btn cancel"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelRemove();
                          }}
                          aria-label={`Cancel removal of ${source.title}`}
                        >
                          CANCEL
                        </button>
                        <button
                          type="button"
                          className="source-confirm-btn remove"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleConfirmRemove(source.id);
                          }}
                          aria-label={`Confirm remove ${source.title}`}
                          autoFocus
                        >
                          REMOVE
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Bottom Hairline Rule between rows */}
                <motion.div
                  className="source-row-divider"
                  aria-hidden="true"
                  initial={shouldReduceMotion ? { opacity: 1, scaleX: 1 } : { opacity: 0, scaleX: 0 }}
                  animate={
                    isDeleting
                      ? { scaleX: 0, opacity: 0, transition: { duration: 0.35, ease: REVEAL_EASE } }
                      : { opacity: 1, scaleX: 1 }
                  }
                  transition={{ duration: 0.65, delay: rowBaseDelay + 0.04, ease: REVEAL_EASE }}
                  style={{ transformOrigin: '0% 50%' }}
                />
              </motion.article>
            );
          })}
        </div>
      ) : (
        /* Minimal Editorial Empty State */
        <div className="sources-empty-state">
          <span className="sources-empty-label">NO MATERIAL YET</span>
          <p className="sources-empty-desc">
            Your knowledge graph begins with study material.
          </p>
          <button
            type="button"
            className="sources-empty-action"
            onClick={onAddSource}
            aria-label="Upload material"
          >
            <span>UPLOAD MATERIAL</span>
            <ArrowUpRight size={12} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
};
