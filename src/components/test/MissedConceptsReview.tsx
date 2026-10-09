import { useState, useCallback, useLayoutEffect, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { MissedConceptItem } from '../../types/test';
import type { KnowledgeGraph } from '../../types/knowledgeGraph';

export interface MissedConceptsReviewProps {
  missedConcepts: MissedConceptItem[];
  graph?: KnowledgeGraph | null;
  onBackToResults: () => void;
  onReviewConceptInGraph: (conceptId: string) => void;
}

export function MissedConceptsReview({
  missedConcepts,
  graph,
  onBackToResults,
  onReviewConceptInGraph
}: MissedConceptsReviewProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [exitDirection, setExitDirection] = useState<'back' | 'graph' | null>(null);
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [hoveredConceptId, setHoveredConceptId] = useState<string | null>(null);

  // SCROLL FIX: Ensure page opens scrolled to the very top (0, 0)
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    const rootEl = document.querySelector('.test-workspace-root');
    if (rootEl) {
      rootEl.scrollTop = 0;
    }
  }, []);

  // Deduplicate missed items by conceptId so each unique concept is listed once with authentic data
  const uniqueConcepts = useMemo(() => {
    const map = new Map<string, MissedConceptItem>();
    for (const item of missedConcepts) {
      const key = item.conceptId || item.conceptName;
      if (!map.has(key)) {
        map.set(key, item);
      }
    }
    return Array.from(map.values());
  }, [missedConcepts]);

  // Reversible back transition (Section 14 & 15)
  const handleBackToResults = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);
    setExitDirection('back');
    // Rows retract upward in reverse stagger (~400ms) before navigating back
    setTimeout(() => {
      onBackToResults();
    }, 420);
  }, [isExiting, onBackToResults]);

  // Concept availability in graph
  const isConceptAvailableInGraph = useCallback((conceptId?: string, conceptName?: string): boolean => {
    if (!graph || !graph.nodes || graph.nodes.length === 0) return false;
    if (!conceptId && !conceptName) return false;
    return graph.nodes.some(
      n => (conceptId && n.id === conceptId) || (conceptName && n.name?.toLowerCase() === conceptName.toLowerCase())
    );
  }, [graph]);

  // Concept review interaction (Section 16): selected row anchors, others recede
  const handleSelectConcept = useCallback((conceptId: string, conceptName?: string) => {
    if (isExiting) return;
    if (!isConceptAvailableInGraph(conceptId, conceptName)) return;
    setIsExiting(true);
    setExitDirection('graph');
    setSelectedConceptId(conceptId);
    // Selected concept row becomes visual anchor (~360ms) before transitioning to graph
    setTimeout(() => {
      onReviewConceptInGraph(conceptId);
    }, 360);
  }, [isExiting, onReviewConceptInGraph, isConceptAvailableInGraph]);

  // Keyboard escape handler for back navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleBackToResults();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleBackToResults]);

  return (
    <div className={`missed-concepts-editorial-wrap ${isExiting ? 'missed-exiting' : ''}`}>
      {/* ==============================================================
          TOP CONTEXTUAL NAVIGATION (Section 14)
          Subtle, editorial ← BACK TO RESULTS at the top
          ============================================================== */}
      <div className="missed-top-nav-row">
        <motion.button
          type="button"
          className="missed-top-back-btn"
          onClick={handleBackToResults}
          disabled={isExiting}
          title="Return to test results (Escape)"
          initial={{ opacity: 0, x: -6 }}
          animate={
            isExiting && exitDirection === 'back'
              ? { opacity: 0, x: -8, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } }
              : { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } }
          }
        >
          <span className="back-arrow" aria-hidden="true">←</span>
          <span>BACK TO RESULTS</span>
        </motion.button>
      </div>

      {/* ==============================================================
          EDITORIAL HEADER (Section 4 & 5)
          Eyebrow: REVIEW / MISSED CONCEPTS
          Title: MISSED CONCEPTS (clamp(64px, 7vw, 112px))
          Intro Copy: "Strengthen the concepts you missed..."
          ============================================================== */}
      <header className="missed-editorial-header">
        <motion.div
          className="missed-editorial-eyebrow"
          initial={{ opacity: 0, y: -8 }}
          animate={
            isExiting && exitDirection === 'back'
              ? { opacity: 0, y: -6, transition: { duration: 0.2, delay: 0.2, ease: [0.16, 1, 0.3, 1] } }
              : { opacity: 1, y: 0, transition: { duration: 0.36, delay: 0.05, ease: [0.16, 1, 0.3, 1] } }
          }
        >
          <span className="missed-eyebrow-marker" aria-hidden="true" />
          <span>REVIEW / MISSED CONCEPTS</span>
        </motion.div>

        <h1 className="missed-editorial-title">
          <span className="missed-title-line-mask">
            <motion.span
              className="missed-title-line"
              initial={{ y: '110%', opacity: 0 }}
              animate={
                isExiting && exitDirection === 'back'
                  ? { y: '-100%', opacity: 0, transition: { duration: 0.32, delay: 0.12, ease: [0.16, 1, 0.3, 1] } }
                  : { y: '0%', opacity: 1, transition: { duration: 0.55, delay: 0.1, ease: [0.16, 1, 0.3, 1] } }
              }
            >
              MISSED CONCEPTS
            </motion.span>
          </span>
        </h1>

        <motion.p
          className="missed-editorial-intro"
          initial={{ opacity: 0, y: 12 }}
          animate={
            isExiting && exitDirection === 'back'
              ? { opacity: 0, y: -10, transition: { duration: 0.25, delay: 0.08, ease: [0.16, 1, 0.3, 1] } }
              : { opacity: 1, y: 0, transition: { duration: 0.45, delay: 0.24, ease: [0.16, 1, 0.3, 1] } }
          }
        >
          Strengthen the concepts you missed and reconnect them to the material behind your graph.
        </motion.p>
      </header>

      {/* ==============================================================
          EDITORIAL INDEXED LIST (Section 6, 7, 8, 9, 10, 11, 12)
          Publication-style single-column list with 01, 02, 03...
          Subtle horizontal dividers, generous vertical height (120–160px),
          sophisticated hover state and focused anchor transition.
          ============================================================== */}
      {uniqueConcepts.length === 0 ? (
        <motion.div
          className="missed-empty-state"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <p className="missed-empty-text">
            No missed concepts to review. You demonstrated full mastery across all assessed topics.
          </p>
          <button
            type="button"
            className="missed-empty-back-btn"
            onClick={handleBackToResults}
          >
            ← RETURN TO RESULTS
          </button>
        </motion.div>
      ) : (
        <div className="missed-concepts-index-list" role="list">
          {uniqueConcepts.map((item, idx) => {
            const indexStr = String(idx + 1).padStart(2, '0');
            const isHovered = hoveredConceptId === item.conceptId;
            const isSelected = selectedConceptId === item.conceptId;
            const isOtherDimmed = isExiting && exitDirection === 'graph' && !isSelected;
            const isAvailable = isConceptAvailableInGraph(item.conceptId, item.conceptName);

            return (
              <motion.div
                key={item.conceptId || item.conceptName}
                className={`missed-concept-row ${isHovered ? 'is-hovered' : ''} ${
                  isSelected ? 'is-selected' : ''
                } ${isOtherDimmed ? 'is-dimmed' : ''} ${!isAvailable ? 'row-unavailable' : ''}`}
                onMouseEnter={() => setHoveredConceptId(item.conceptId)}
                onMouseLeave={() => setHoveredConceptId(null)}
                onClick={() => {
                  if (isAvailable) {
                    handleSelectConcept(item.conceptId, item.conceptName);
                  }
                }}
                role={isAvailable ? "button" : "region"}
                tabIndex={isAvailable ? 0 : -1}
                onKeyDown={(e) => {
                  if (isAvailable && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    handleSelectConcept(item.conceptId, item.conceptName);
                  }
                }}
                aria-label={
                  isAvailable
                    ? `Review ${item.conceptName} in knowledge graph`
                    : `${item.conceptName} (concept not in current graph)`
                }
                initial={{ opacity: 0, y: 24 }}
                animate={
                  isExiting && exitDirection === 'back'
                    ? {
                        opacity: 0,
                        y: -22,
                        transition: {
                          duration: 0.28,
                          delay: (uniqueConcepts.length - 1 - idx) * 0.045,
                          ease: [0.16, 1, 0.3, 1]
                        }
                      }
                    : isExiting && exitDirection === 'graph'
                    ? isSelected
                      ? {
                          scale: 1.01,
                          opacity: 1,
                          transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] }
                        }
                      : {
                          opacity: 0,
                          y: -8,
                          transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] }
                        }
                    : {
                        opacity: 1,
                        y: 0,
                        transition: {
                          duration: 0.52,
                          delay: 0.28 + idx * 0.075,
                          ease: [0.16, 1, 0.3, 1]
                        }
                      }
                }
              >
                {/* Left: Row Edge Green Line Indicator (Section 10 & 11) */}
                <div className="missed-row-edge-accent" aria-hidden="true" />

                {/* Left Column: 2-digit index (01, 02...) (Section 7) */}
                <div className="missed-row-index-col">
                  <span className="missed-row-index">{indexStr}</span>
                </div>

                {/* Center Column: Concept title, explanation, source metadata (Section 7) */}
                <div className="missed-row-content-col">
                  <h2 className="missed-row-concept-title">
                    {item.conceptName}
                  </h2>
                  {item.explanation && (
                    <p className="missed-row-explanation">
                      {item.explanation}
                    </p>
                  )}
                  {item.sourceName && (
                    <div className="missed-row-source-meta">
                      <span className="missed-source-label">SOURCE</span>
                      <span className="missed-source-separator">·</span>
                      <span className="missed-source-name">{item.sourceName}</span>
                      {item.page && (
                        <span className="missed-source-page">P. {item.page}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Column: REVIEW → typography-driven action (Section 7) or Unavailable Message */}
                <div className="missed-row-action-col">
                  {isAvailable ? (
                    <div className="missed-row-action-link">
                      <span className="missed-action-text">REVIEW</span>
                      <span className="missed-action-arrow" aria-hidden="true">→</span>
                      <span className="missed-action-underline" aria-hidden="true" />
                    </div>
                  ) : (
                    <div className="missed-row-unavailable-badge" title="This concept is no longer present in the active knowledge graph">
                      <span>Concept not in current graph</span>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
