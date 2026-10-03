import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion';
import { ArrowUp, ArrowUpRight } from 'lucide-react';
import type { RecentMaterial } from '../../types';
import type { KnowledgeSource, KnowledgeGraph } from '../../types/knowledgeGraph';
import { getFileType, formatFileSize, formatRelativeTime } from '../../services/sourceIngestion';

interface SourcesViewProps {
  sources: (KnowledgeSource | RecentMaterial)[];
  activeGraph?: KnowledgeGraph | null;
  isLoading?: boolean;
  onAddSource: () => void;
  onRemoveSource?: (sourceId: string) => void;
}

// Gold-standard editorial deceleration curve: crisp start, velvety asymptotic stop
const REVEAL_EASE = [0.16, 1, 0.3, 1] as const;

export const SourcesView: React.FC<SourcesViewProps> = ({
  sources,
  activeGraph,
  isLoading = false,
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

  // Sort real sources: newest first (createdAt DESC)
  const sortedSources = useMemo(() => {
    return [...sources].sort((a, b) => {
      const timeA = typeof a.createdAt === 'number' 
        ? a.createdAt 
        : a.createdAt 
        ? new Date(a.createdAt).getTime() 
        : 0;
      const timeB = typeof b.createdAt === 'number' 
        ? b.createdAt 
        : b.createdAt 
        ? new Date(b.createdAt).getTime() 
        : 0;
      return timeB - timeA;
    });
  }, [sources]);

  // Calculate total unique concepts in the active knowledge graph
  const totalConcepts = useMemo(() => {
    if (activeGraph && activeGraph.nodes && activeGraph.nodes.length > 0) {
      return activeGraph.nodes.length;
    }
    // Fallback: sum of unique concepts extracted across sources
    return sources.reduce((acc, s) => acc + (s.conceptsExtracted || 0), 0);
  }, [sources, activeGraph]);

  const formattedSourceCount = String(sources.length).padStart(2, '0');

  // Format metadata line from real file attributes: PDF · 1.4 MB · ADDED JUST NOW
  const formatMetadata = (source: KnowledgeSource | RecentMaterial) => {
    const parts: string[] = [];

    // 1. Real file type (derived from file name, extension, mimeType, or type)
    const fileType = getFileType(source);
    if (fileType) parts.push(fileType);

    // 2. Real file size
    const rawSize = source.size || (source.sizeBytes ? formatFileSize(source.sizeBytes) : '');
    if (rawSize && rawSize !== 'Unknown size' && rawSize !== 'SIZE UNAVAILABLE') {
      parts.push(rawSize);
    }

    // 3. Real upload timestamp
    const relTime = formatRelativeTime(source.createdAt || (source as any).timestamp);
    if (relTime) {
      parts.push(relTime);
    }

    return parts;
  };

  // Check if a source is currently undergoing processing in the pipeline
  const isSourceProcessing = (status?: string) => {
    if (!status) return false;
    const norm = status.toLowerCase();
    return (
      norm.includes('read') ||
      norm.includes('concept') ||
      norm.includes('connect') ||
      norm.includes('idea') ||
      norm.includes('normaliz') ||
      norm.includes('build') ||
      norm.includes('graph') ||
      norm === 'pending' ||
      norm === 'waiting' ||
      norm === 'processing' ||
      norm === 'indexing'
    );
  };

  // Provenance calculation: count of unique concepts attributed to this source
  const getConceptCount = (source: KnowledgeSource | RecentMaterial) => {
    // 1. Check activeGraph nodes whose sourceIds include this source ID
    if (activeGraph && activeGraph.nodes && activeGraph.nodes.length > 0) {
      const matching = activeGraph.nodes.filter(n => n.sourceIds && n.sourceIds.includes(source.id));
      if (matching.length > 0) {
        return matching.length;
      }
    }

    // 2. Direct property on source if available
    if (source.conceptsExtracted !== undefined && source.conceptsExtracted !== null) {
      return source.conceptsExtracted;
    }

    if (source.conceptIds && Array.isArray(source.conceptIds)) {
      return source.conceptIds.length;
    }

    return undefined;
  };

  // Render concept count column: shows "— CONCEPTS" during processing
  const renderConceptCount = (source: KnowledgeSource | RecentMaterial) => {
    if (isSourceProcessing(source.status)) {
      return <span>— CONCEPTS</span>;
    }

    const count = getConceptCount(source);
    if (count !== undefined) {
      return <span>{count} CONCEPTS</span>;
    }

    return <span className="source-concepts-pending">—</span>;
  };

  // Render state indicator: follows the real GraphMind pipeline stages
  const renderState = (status?: string) => {
    const norm = (status || 'ready').toLowerCase();

    if (norm === 'pending' || norm === 'waiting') {
      return (
        <div className="source-state-col">
          <span className="source-state-point processing" aria-hidden="true" />
          <span className="source-state-label">WAITING</span>
        </div>
      );
    }

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

    if (norm.includes('connect') || norm.includes('idea') || norm.includes('normaliz')) {
      return (
        <div className="source-state-col">
          <span className="source-state-point processing" aria-hidden="true" />
          <span className="source-state-label">CONNECTING IDEAS</span>
        </div>
      );
    }

    if (norm.includes('build') || norm.includes('graph')) {
      return (
        <div className="source-state-col">
          <span className="source-state-point processing" aria-hidden="true" />
          <span className="source-state-label">BUILDING GRAPH</span>
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
          <span className="source-state-label failed">FAILED</span>
        </div>
      );
    }

    return (
      <div className="source-state-col">
        <span className="source-state-point indexed" aria-hidden="true" />
        <span className="source-state-label">INDEXED</span>
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

            <motion.button
              type="button"
              className="hero-action-primary hero-btn-primary"
              onClick={onAddSource}
              id="btn-sources-add-source"
              aria-label="Upload material"
              initial="initial"
              whileHover="hover"
              whileTap={{ scale: 0.985 }}
              variants={{
                initial: {},
                hover: {}
              }}
            >
              <span className="hero-action-primary-inner">
                <span className="hero-action-text">Upload material</span>
                <motion.span
                  className="hero-action-arrow-wrap"
                  variants={{
                    initial: { y: 0 },
                    hover: { y: -3.5, transition: { duration: 0.2, ease: [0.22, 1, 0.36, 1] } }
                  }}
                >
                  <ArrowUp size={15} strokeWidth={2.2} className="hero-action-arrow" />
                </motion.span>
              </span>
              <span className="hero-action-line" aria-hidden="true" />
            </motion.button>
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

      {/* 3. Loading State: Subtle Hairline Placeholders */}
      {isLoading ? (
        <div className="sources-loading-container" aria-busy="true" aria-label="Loading library sources">
          {[1, 2, 3].map((n) => (
            <div key={n} className="source-loading-row">
              <div className="source-loading-line" />
            </div>
          ))}
        </div>
      ) : sortedSources.length > 0 ? (
        /* 4. Horizontal Editorial Archival List */
        <div className="sources-list" role="list">
          {sortedSources.map((source, idx) => {
            const isFirst = idx === 0;
            const rowNumber = String(idx + 1).padStart(2, '0');
            const metaParts = formatMetadata(source);
            const rowBaseDelay = 0.38 + idx * 0.07;
            const isConfirming = confirmingId === source.id;
            const isDeleting = deletingId === source.id;
            const displayName = source.fileName || source.name || (source as any).title || 'Untitled Source';

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
                aria-label={`Source ${rowNumber}: ${displayName}`}
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
                            title={displayName}
                            initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: '105%' }}
                            animate={{ opacity: 1, y: '0%' }}
                            transition={{ duration: 0.60, delay: rowBaseDelay + 0.04, ease: REVEAL_EASE }}
                          >
                            {displayName}
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

                      {/* Zone 3: Concept Count (Real provenance from graph) */}
                      <motion.div
                        className="source-concepts-col"
                        initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.45, delay: rowBaseDelay + 0.10, ease: REVEAL_EASE }}
                      >
                        {renderConceptCount(source)}
                      </motion.div>

                      {/* Zone 4: Source State (Follows real pipeline stages) */}
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
                            aria-label={`Remove ${displayName}`}
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
                        <span className="source-confirm-filename">{displayName}</span>
                      </div>

                      <div className="source-confirm-actions">
                        <button
                          type="button"
                          className="source-confirm-btn cancel"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelRemove();
                          }}
                          aria-label={`Cancel removal of ${displayName}`}
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
                          aria-label={`Confirm remove ${displayName}`}
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
        /* Minimal Editorial Empty State: Connected directly below Source Index */
        <div className="sources-empty-state">
          <div className="sources-empty-left">
            <motion.span
              className="sources-empty-label"
              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.50, delay: 0.00, ease: REVEAL_EASE }}
            >
              NO MATERIAL YET
            </motion.span>

            <motion.p
              className="sources-empty-desc"
              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.52, delay: 0.06, ease: REVEAL_EASE }}
            >
              Your knowledge graph begins with study material.
            </motion.p>

            <motion.div
              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.54, delay: 0.12, ease: REVEAL_EASE }}
            >
              <button
                type="button"
                className="sources-empty-action"
                onClick={onAddSource}
                aria-label="Upload material"
              >
                <span>Upload material</span>
                <span className="sources-empty-action-arrow" aria-hidden="true">↗</span>
              </button>
            </motion.div>
          </div>

          <motion.div
            className="sources-empty-right"
            initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.56, delay: 0.10, ease: REVEAL_EASE }}
            aria-hidden="true"
          >
            <svg 
              className="sources-empty-visual-svg" 
              width="180" 
              height="110" 
              viewBox="0 0 180 110" 
              fill="none" 
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Vertical indexing line */}
              <line x1="28" y1="10" x2="28" y2="100" stroke="#222222" strokeWidth="1" />

              {/* Slot 01: Tiny green dot + quiet horizontal lines */}
              <line x1="12" y1="26" x2="168" y2="26" stroke="#262626" strokeWidth="1" />
              <circle cx="28" cy="26" r="2" fill="#22C55E" opacity="0.8" />
              <line x1="38" y1="26" x2="96" y2="26" stroke="#333333" strokeWidth="1" />
              <line x1="136" y1="26" x2="162" y2="26" stroke="#262626" strokeWidth="1" strokeDasharray="3 3" />
              <text x="13" y="28" fill="#383838" fontSize="7.5" fontFamily="monospace">01</text>

              {/* Slot 02 */}
              <line x1="12" y1="56" x2="168" y2="56" stroke="#1E1E1E" strokeWidth="1" />
              <circle cx="28" cy="56" r="1.5" fill="#303030" />
              <line x1="38" y1="56" x2="76" y2="56" stroke="#262626" strokeWidth="1" strokeDasharray="2 3" />
              <line x1="142" y1="56" x2="162" y2="56" stroke="#1E1E1E" strokeWidth="1" strokeDasharray="3 3" />
              <text x="13" y="58" fill="#2A2A2A" fontSize="7.5" fontFamily="monospace">02</text>

              {/* Slot 03 */}
              <line x1="12" y1="86" x2="168" y2="86" stroke="#181818" strokeWidth="1" />
              <circle cx="28" cy="86" r="1.5" fill="#262626" />
              <line x1="38" y1="86" x2="64" y2="86" stroke="#222222" strokeWidth="1" strokeDasharray="2 3" />
              <text x="13" y="88" fill="#222222" fontSize="7.5" fontFamily="monospace">03</text>
            </svg>
          </motion.div>
        </div>
      )}
    </div>
  );
};
