import { useState, useCallback, useLayoutEffect, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { KnowledgeTest } from '../../types/test';

export interface TestReviewViewProps {
  test: KnowledgeTest;
  userAnswers: Record<string, string>;
  onBackToResults: () => void;
  onSelectConceptToReview?: (conceptId: string) => void;
}

export function TestReviewView({
  test,
  userAnswers,
  onBackToResults,
  onSelectConceptToReview
}: TestReviewViewProps) {
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(
    test.questions[0]?.id || null
  );
  const [isExiting, setIsExiting] = useState(false);
  const [exitDirection, setExitDirection] = useState<'back' | 'graph' | null>(null);
  const [selectedConceptId, setSelectedConceptId] = useState<string | null>(null);
  const [hoveredQuestionId, setHoveredQuestionId] = useState<string | null>(null);

  // SCROLL FIX: Ensure review page always opens scrolled to the very top (0, 0)
  useLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
    const rootEl = document.querySelector('.test-workspace-root');
    if (rootEl) {
      rootEl.scrollTop = 0;
    }
  }, []);

  // Reversible back transition (Section 14 & 21)
  const handleBackToResults = useCallback(() => {
    if (isExiting) return;
    setIsExiting(true);
    setExitDirection('back');
    // Rows retract upward in reverse stagger (~420ms)
    setTimeout(() => {
      onBackToResults();
    }, 420);
  }, [isExiting, onBackToResults]);

  // Concept review in graph transition (Section 19)
  const handleReviewConceptInGraph = useCallback((conceptId: string) => {
    if (isExiting || !onSelectConceptToReview) return;
    setIsExiting(true);
    setExitDirection('graph');
    setSelectedConceptId(conceptId);
    // Row remains visual anchor, other elements recede (~360ms)
    setTimeout(() => {
      onSelectConceptToReview(conceptId);
    }, 360);
  }, [isExiting, onSelectConceptToReview]);

  // Keyboard Escape navigation
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

  const totalQuestions = test.questions.length;

  return (
    <div className={`test-review-editorial-wrap ${isExiting ? 'review-exiting' : ''}`}>
      {/* ==============================================================
          TOP CONTEXTUAL NAVIGATION (Section 3, 21, 22)
          Left: ← BACK TO RESULTS (subtle, editorial)
          Right: EXAMINATION REVIEW
          ============================================================== */}
      <div className="review-top-nav-row">
        <motion.button
          type="button"
          className="review-top-back-btn"
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

        <motion.div
          className="review-top-context-label"
          initial={{ opacity: 0, y: -6 }}
          animate={
            isExiting && exitDirection === 'back'
              ? { opacity: 0, y: -4, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }
              : { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } }
          }
        >
          <span>EXAMINATION REVIEW</span>
        </motion.div>
      </div>

      {/* ==============================================================
          EDITORIAL HEADER (Section 3, 4, 5)
          Eyebrow: REVIEW / EXAMINATION with tiny green marker
          Title: REVIEW ALL ANSWERS (clamp(64px, 7vw, 112px))
          Intro copy: max-width 560px
          ============================================================== */}
      <header className="review-editorial-header">
        <motion.div
          className="review-editorial-eyebrow"
          initial={{ opacity: 0, y: -8 }}
          animate={
            isExiting && exitDirection === 'back'
              ? { opacity: 0, y: -6, transition: { duration: 0.2, delay: 0.16, ease: [0.16, 1, 0.3, 1] } }
              : { opacity: 1, y: 0, transition: { duration: 0.36, delay: 0.05, ease: [0.16, 1, 0.3, 1] } }
          }
        >
          <span className="review-eyebrow-marker" aria-hidden="true" />
          <span>REVIEW / EXAMINATION</span>
        </motion.div>

        <h1 className="review-editorial-title">
          <span className="review-title-line-mask">
            <motion.span
              className="review-title-line"
              initial={{ y: '110%', opacity: 0 }}
              animate={
                isExiting && exitDirection === 'back'
                  ? { y: '-100%', opacity: 0, transition: { duration: 0.32, delay: 0.10, ease: [0.16, 1, 0.3, 1] } }
                  : { y: '0%', opacity: 1, transition: { duration: 0.55, delay: 0.10, ease: [0.16, 1, 0.3, 1] } }
              }
            >
              REVIEW
            </motion.span>
          </span>
          <span className="review-title-line-mask">
            <motion.span
              className="review-title-line"
              initial={{ y: '110%', opacity: 0 }}
              animate={
                isExiting && exitDirection === 'back'
                  ? { y: '-100%', opacity: 0, transition: { duration: 0.32, delay: 0.14, ease: [0.16, 1, 0.3, 1] } }
                  : { y: '0%', opacity: 1, transition: { duration: 0.55, delay: 0.14, ease: [0.16, 1, 0.3, 1] } }
              }
            >
              ALL
            </motion.span>
          </span>
          <span className="review-title-line-mask">
            <motion.span
              className="review-title-line"
              initial={{ y: '110%', opacity: 0 }}
              animate={
                isExiting && exitDirection === 'back'
                  ? { y: '-100%', opacity: 0, transition: { duration: 0.32, delay: 0.18, ease: [0.16, 1, 0.3, 1] } }
                  : { y: '0%', opacity: 1, transition: { duration: 0.55, delay: 0.18, ease: [0.16, 1, 0.3, 1] } }
              }
            >
              ANSWERS
            </motion.span>
          </span>
        </h1>

        <motion.p
          className="review-editorial-intro"
          initial={{ opacity: 0, y: 12 }}
          animate={
            isExiting && exitDirection === 'back'
              ? { opacity: 0, y: -10, transition: { duration: 0.25, delay: 0.08, ease: [0.16, 1, 0.3, 1] } }
              : { opacity: 1, y: 0, transition: { duration: 0.45, delay: 0.24, ease: [0.16, 1, 0.3, 1] } }
          }
        >
          Review every question, understand why the answer was correct or incorrect, and reconnect each concept to your knowledge graph.
        </motion.p>
      </header>

      {/* ==============================================================
          ANSWER INDEX HEADER (Section 7)
          Minimal rule: ANSWERS • {count} QUESTIONS
          ============================================================== */}
      <motion.div
        className="review-index-header-row"
        initial={{ opacity: 0, y: 10 }}
        animate={
          isExiting && exitDirection === 'back'
            ? { opacity: 0, y: -8, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } }
            : { opacity: 1, y: 0, transition: { duration: 0.35, delay: 0.28, ease: [0.16, 1, 0.3, 1] } }
        }
      >
        <span className="review-index-label">ANSWERS</span>
        <span className="review-index-count">{totalQuestions} QUESTIONS</span>
      </motion.div>

      {/* ==============================================================
          STRUCTURED EDITORIAL ANSWER INDEX (Section 6, 8, 9, 10, 11, 12, 13, 14, 15)
          No rounded cards, no nested card boxes, no borders around individual cards.
          Subtle horizontal rules, tiny status dots, natural document flow.
          ============================================================== */}
      <div className="review-questions-index" role="list">
        {test.questions.map((q, idx) => {
          const numStr = (idx + 1).toString().padStart(2, '0');
          const selectedId = userAnswers[q.id];
          const isCorrect = selectedId === q.correctOptionId;
          const isExpanded = expandedQuestionId === q.id;

          const selectedOption = q.options.find(o => o.id === selectedId);
          const correctOption = q.options.find(o => o.id === q.correctOptionId);

          const primaryConceptId = q.conceptIds?.[0];
          const primaryConceptName = q.conceptNames?.[0] || 'Concept';

          const isHovered = hoveredQuestionId === q.id;
          const isSelected = selectedConceptId === primaryConceptId;
          const isDimmed = isExiting && exitDirection === 'graph' && !isSelected;

          return (
            <motion.div
              key={q.id}
              className={`review-question-row ${isCorrect ? 'row-correct' : 'row-incorrect'} ${
                isExpanded ? 'row-expanded' : ''
              } ${isHovered ? 'is-hovered' : ''} ${isSelected ? 'is-selected' : ''} ${
                isDimmed ? 'is-dimmed' : ''
              }`}
              onMouseEnter={() => setHoveredQuestionId(q.id)}
              onMouseLeave={() => setHoveredQuestionId(null)}
              role="listitem"
              initial={{ opacity: 0, y: 22 }}
              animate={
                isExiting && exitDirection === 'back'
                  ? {
                      opacity: 0,
                      y: -20,
                      transition: {
                        duration: 0.28,
                        delay: (totalQuestions - 1 - idx) * 0.04,
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
                        delay: 0.32 + idx * 0.065,
                        ease: [0.16, 1, 0.3, 1]
                      }
                    }
              }
            >
              {/* Left Edge Green Accent Indicator on hover (Section 13) */}
              <div className="review-row-edge-accent" aria-hidden="true" />

              {/* Clickable Row Header (Question, Answer Summary, Status) */}
              <button
                type="button"
                className="review-row-header-grid"
                onClick={() => setExpandedQuestionId(isExpanded ? null : q.id)}
                aria-expanded={isExpanded}
                aria-label={`Question ${numStr}: ${q.question}`}
              >
                {/* LEFT: 2-digit number + tiny status dot (Section 14 & 15) */}
                <div className="review-row-index-group">
                  <span className="review-row-num">{numStr}</span>
                  <span
                    className={`review-status-dot ${isCorrect ? 'dot-correct' : 'dot-incorrect'}`}
                    aria-hidden="true"
                  />
                </div>

                {/* CENTER: Question text + answer state subordinate below (Section 8, 9, 10, 16, 17) */}
                <div className="review-row-content-col">
                  <div className="review-row-question-text">{q.question}</div>

                  {isCorrect ? (
                    <div className="review-row-result-summary correct">
                      <span className="summary-symbol" aria-hidden="true">✓</span>
                      <span className="summary-answer-text">{correctOption?.text}</span>
                      <span className="summary-status-tag">CORRECT</span>
                    </div>
                  ) : (
                    <div className="review-row-result-summary incorrect">
                      <div className="summary-choice-group wrong">
                        <span className="summary-choice-label">YOUR ANSWER</span>
                        <span className="summary-symbol-wrong" aria-hidden="true">×</span>
                        <span className="summary-wrong-text">
                          {selectedOption?.text || 'Unanswered'}
                        </span>
                      </div>
                      <div className="summary-choice-group correct">
                        <span className="summary-choice-label">CORRECT</span>
                        <span className="summary-symbol-correct" aria-hidden="true">✓</span>
                        <span className="summary-correct-text">{correctOption?.text}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* RIGHT: Status Tag & Smooth Toggle Chevron (Section 8) */}
                <div className="review-row-right-action">
                  <span className={`review-row-badge ${isCorrect ? 'badge-correct' : 'badge-incorrect'}`}>
                    {isCorrect ? 'CORRECT' : 'INCORRECT'}
                  </span>
                  <span
                    className={`review-row-toggle-icon ${isExpanded ? 'is-expanded' : ''}`}
                    aria-hidden="true"
                  >
                    ↓
                  </span>
                </div>
              </button>

              {/* ==============================================================
                  EXPANDED QUESTION DETAILS (Section 11 & 12)
                  Sits naturally in the document flow with NO nested cards.
                  Reveals answer lines, WHY section, material provenance, and graph review link.
                  ============================================================== */}
              <AnimatePresence initial={false}>
                {isExpanded && (
                  <motion.div
                    className="review-row-expanded-flow"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <div className="review-expanded-inner">
                      {/* Editorial Options Breakdown (Section 11) */}
                      <div className="review-expanded-options-list">
                        {q.options.map((opt) => {
                          const isThisCorrect = opt.id === q.correctOptionId;
                          const isThisChosen = opt.id === selectedId;

                          return (
                            <div
                              key={opt.id}
                              className={`review-expanded-option-line ${
                                isThisCorrect
                                  ? 'opt-correct'
                                  : isThisChosen
                                  ? 'opt-chosen-incorrect'
                                  : 'opt-normal'
                              }`}
                            >
                              <span className="opt-letter">{opt.id}</span>
                              <span className="opt-text">{opt.text}</span>
                              {isThisCorrect && (
                                <span className="opt-annotation-correct">
                                  <span className="annotation-icon" aria-hidden="true">✓</span>
                                  <span>CORRECT</span>
                                </span>
                              )}
                              {isThisChosen && !isThisCorrect && (
                                <span className="opt-annotation-incorrect">
                                  <span className="annotation-icon" aria-hidden="true">×</span>
                                  <span>YOUR ANSWER</span>
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* WHY: Explanation based strictly on source material (Section 11) */}
                      {q.explanation && (
                        <div className="review-expanded-section">
                          <span className="review-section-kicker">WHY</span>
                          <p className="review-why-paragraph">{q.explanation}</p>
                        </div>
                      )}

                      {/* FROM YOUR MATERIAL: Provenance quote (Section 11 & 18) */}
                      {q.sourceEvidence && (
                        <div className="review-expanded-section">
                          <span className="review-section-kicker">
                            FROM YOUR MATERIAL
                            {q.sourceName ? ` · ${q.sourceName}` : ''}
                            {q.page ? ` (P. ${q.page})` : ''}
                          </span>
                          <blockquote className="review-provenance-quote">
                            "{q.sourceEvidence}"
                          </blockquote>
                        </div>
                      )}

                      {/* REVIEW IN GRAPH Action: Editorial typography link (Section 19) */}
                      {primaryConceptId && onSelectConceptToReview && (
                        <div className="review-expanded-footer-action">
                          <button
                            type="button"
                            className="review-graph-editorial-link"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReviewConceptInGraph(primaryConceptId);
                            }}
                          >
                            <span className="review-graph-link-text">
                              REVIEW {primaryConceptName.toUpperCase()} IN GRAPH
                            </span>
                            <span className="review-graph-arrow" aria-hidden="true">→</span>
                            <span className="review-graph-underline" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
