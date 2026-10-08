import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Check, X, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import type { KnowledgeTest } from '../../types/test';

interface TestReviewViewProps {
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

  return (
    <div className="test-review-container">
      <div className="review-header-bar">
        <button
          type="button"
          className="test-editorial-action-btn action-ghost"
          onClick={onBackToResults}
        >
          <ArrowLeft size={13} aria-hidden="true" />
          <span>BACK TO RESULTS</span>
        </button>
        <div className="review-header-title">EXAMINATION REVIEW</div>
      </div>

      <div className="review-questions-list">
        {test.questions.map((q, idx) => {
          const numStr = (idx + 1).toString().padStart(2, '0');
          const selectedId = userAnswers[q.id];
          const isCorrect = selectedId === q.correctOptionId;
          const isExpanded = expandedQuestionId === q.id;

          const selectedOption = q.options.find(o => o.id === selectedId);
          const correctOption = q.options.find(o => o.id === q.correctOptionId);

          return (
            <div
              key={q.id}
              className={`review-question-card ${isCorrect ? 'card-correct' : 'card-incorrect'} ${isExpanded ? 'card-expanded' : ''}`}
            >
              {/* Question Summary Row */}
              <button
                type="button"
                className="review-question-toggle-bar"
                onClick={() => setExpandedQuestionId(isExpanded ? null : q.id)}
                aria-expanded={isExpanded}
              >
                <div className="review-bar-left">
                  <span className="review-num-badge">{numStr}</span>
                  <div className="review-bar-qtext">
                    <span className="q-preview">{q.question}</span>
                    <div className="review-bar-answer-summary">
                      {isCorrect ? (
                        <span className="summary-correct">
                          <Check size={12} aria-hidden="true" />
                          <span>{correctOption?.text}</span>
                        </span>
                      ) : (
                        <span className="summary-incorrect">
                          <X size={12} aria-hidden="true" />
                          <span className="user-choice">{selectedOption?.text || 'Unanswered'}</span>
                          <span className="correct-pivot">Correct: {correctOption?.text}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="review-bar-right">
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>
              </button>

              {/* Expanded Question Details */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    className="review-expanded-content"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  >
                    {/* All 4 Choices */}
                    <div className="review-options-grid">
                      {q.options.map(opt => {
                        const isThisCorrect = opt.id === q.correctOptionId;
                        const isThisChosen = opt.id === selectedId;

                        return (
                          <div
                            key={opt.id}
                            className={`review-option-pill ${isThisCorrect ? 'pill-correct' : ''} ${isThisChosen && !isThisCorrect ? 'pill-chosen-incorrect' : ''}`}
                          >
                            <span className="pill-id">{opt.id}</span>
                            <span className="pill-text">{opt.text}</span>
                            {isThisCorrect && (
                              <span className="pill-badge-correct">
                                <Check size={11} aria-hidden="true" /> CORRECT
                              </span>
                            )}
                            {isThisChosen && !isThisCorrect && (
                              <span className="pill-badge-incorrect">
                                <X size={11} aria-hidden="true" /> YOUR ANSWER
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Section 23: WHY (Short explanation based ONLY on source material) */}
                    <div className="review-explanation-block">
                      <div className="explanation-kicker">WHY</div>
                      <p className="explanation-body">{q.explanation}</p>
                    </div>

                    {/* Section 23: FROM YOUR MATERIAL */}
                    {q.sourceEvidence && (
                      <div className="review-evidence-block">
                        <div className="evidence-kicker">
                          <FileText size={12} aria-hidden="true" />
                          <span>FROM YOUR MATERIAL ({q.sourceName}{q.page ? ` · Page ${q.page}` : ''})</span>
                        </div>
                        <blockquote className="evidence-quote">
                          "{q.sourceEvidence}"
                        </blockquote>
                      </div>
                    )}

                    {/* Link to study concept in graph */}
                    {q.conceptIds.length > 0 && onSelectConceptToReview && (
                      <div className="review-card-footer">
                        <button
                          type="button"
                          className="review-jump-graph-btn"
                          onClick={() => onSelectConceptToReview(q.conceptIds[0])}
                        >
                          <span>Review {q.conceptNames[0] || 'concept'} in Graph →</span>
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
