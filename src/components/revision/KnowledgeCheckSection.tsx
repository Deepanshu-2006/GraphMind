import React, { useState, useEffect, useCallback, useMemo, useId } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { KnowledgeGraph } from '../../types/knowledgeGraph';
import type { ConceptExplanation } from '../../types/explanation';
import type { RevisionSessionState } from '../../types/practice';
import type {
  ConceptKnowledgeCheckState,
  KnowledgeCheckQuestion,
  KnowledgeCheckAttempt
} from '../../types/knowledgeCheck';
import {
  generateKnowledgeCheckQuestions,
  evaluateKnowledgeCheckAnswer,
  loadStoredKnowledgeCheck,
  saveStoredKnowledgeCheck
} from '../../services/knowledgeCheck';
import {
  deriveConceptPerformanceState,
  generateAdaptiveRecommendation,
  saveAdaptiveRecommendation
} from '../../services/adaptiveRevision';
import { AdaptiveNextStep } from './AdaptiveNextStep';

// Preserve React in scope for tsx runner environments
void React;

interface KnowledgeCheckSectionProps {
  graph?: KnowledgeGraph | null;
  conceptId: string;
  conceptName: string;
  explanation?: ConceptExplanation | null;
  sectionNum?: string;
  onNavigateToSection?: (sectionId: string) => void;
  session?: RevisionSessionState | null;
  onNavigateToConcept?: (conceptId: string) => void;
  onContinueNext?: () => void;
  onAttemptSubmitted?: (attempt: KnowledgeCheckAttempt, nextState: ConceptKnowledgeCheckState) => void;
}

export const KnowledgeCheckSection: React.FC<KnowledgeCheckSectionProps> = ({
  graph,
  conceptId,
  conceptName,
  explanation,
  sectionNum,
  onNavigateToSection,
  session,
  onNavigateToConcept,
  onContinueNext,
  onAttemptSubmitted
}) => {
  const radioGroupId = useId();

  // Knowledge check state per graph + concept
  const [checkState, setCheckState] = useState<ConceptKnowledgeCheckState>(() => {
    const graphId = graph?.id || 'default_graph';
    const cached = loadStoredKnowledgeCheck(graphId, conceptId);
    if (cached) {
      return cached;
    }
    const safeGraph: KnowledgeGraph = graph || ({
      id: graphId,
      name: 'Default Graph',
      nodes: [],
      edges: []
    } as unknown as KnowledgeGraph);
    const genResult = generateKnowledgeCheckQuestions({ graph: safeGraph, conceptId, explanation });
    if (genResult.status === 'insufficient') {
      return {
        graphId,
        conceptId,
        status: 'insufficient',
        insufficientReason: genResult.reason,
        questions: [],
        activeQuestionIndex: 0,
        attempts: {},
        updatedAt: new Date().toISOString()
      };
    }
    const newState: ConceptKnowledgeCheckState = {
      graphId,
      conceptId,
      status: 'ready',
      questions: genResult.questions,
      activeQuestionIndex: 0,
      attempts: {},
      updatedAt: new Date().toISOString()
    };
    saveStoredKnowledgeCheck(newState);
    return newState;
  });

  // Local answering interaction state for the current active question
  const [selectedOptionId, setSelectedOptionId] = useState<string>('');
  const [textAnswer, setTextAnswer] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [retryMode, setRetryMode] = useState<boolean>(false);

  // Sync state when concept changes
  useEffect(() => {
    const graphId = graph?.id || 'default_graph';
    const cached = loadStoredKnowledgeCheck(graphId, conceptId);
    if (cached) {
      setCheckState(cached);
      setSelectedOptionId('');
      setTextAnswer('');
      setRetryMode(false);
      return;
    }

    const safeGraph: KnowledgeGraph = graph || ({
      id: graphId,
      name: 'Default Graph',
      nodes: [],
      edges: []
    } as unknown as KnowledgeGraph);

    const genResult = generateKnowledgeCheckQuestions({ graph: safeGraph, conceptId, explanation });
    if (genResult.status === 'insufficient') {
      const insState: ConceptKnowledgeCheckState = {
        graphId,
        conceptId,
        status: 'insufficient',
        insufficientReason: genResult.reason,
        questions: [],
        activeQuestionIndex: 0,
        attempts: {},
        updatedAt: new Date().toISOString()
      };
      setCheckState(insState);
      saveStoredKnowledgeCheck(insState);
    } else {
      const readyState: ConceptKnowledgeCheckState = {
        graphId,
        conceptId,
        status: 'ready',
        questions: genResult.questions,
        activeQuestionIndex: 0,
        attempts: {},
        updatedAt: new Date().toISOString()
      };
      setCheckState(readyState);
      saveStoredKnowledgeCheck(readyState);
    }

    setSelectedOptionId('');
    setTextAnswer('');
    setRetryMode(false);
  }, [graph, conceptId, explanation]);

  const activeQuestion: KnowledgeCheckQuestion | undefined =
    checkState.questions[checkState.activeQuestionIndex];

  const currentAttempt: KnowledgeCheckAttempt | undefined = activeQuestion
    ? checkState.attempts[activeQuestion.id]
    : undefined;

  const hasAttempted = Boolean(currentAttempt) && !retryMode;

  const handleSelectOption = (optId: string) => {
    if (hasAttempted || isSubmitting) return;
    setSelectedOptionId(optId);
  };

  const handleSubmit = useCallback(() => {
    if (!activeQuestion || isSubmitting || hasAttempted) return;

    const answer = activeQuestion.type === 'short-answer'
      ? textAnswer.trim()
      : selectedOptionId;

    if (!answer) return;

    setIsSubmitting(true);

    try {
      const evaluation = evaluateKnowledgeCheckAnswer(activeQuestion, answer);
      const attempt: KnowledgeCheckAttempt = {
        questionId: activeQuestion.id,
        submittedAnswer: answer,
        evaluation,
        attemptedAt: new Date().toISOString()
      };

      const updatedAttempts = {
        ...checkState.attempts,
        [activeQuestion.id]: attempt
      };

      const nextState: ConceptKnowledgeCheckState = {
        ...checkState,
        attempts: updatedAttempts,
        updatedAt: new Date().toISOString()
      };

      setCheckState(nextState);
      saveStoredKnowledgeCheck(nextState);
      onAttemptSubmitted?.(attempt, nextState);
      setRetryMode(false);
    } finally {
      setIsSubmitting(false);
    }
  }, [activeQuestion, isSubmitting, hasAttempted, textAnswer, selectedOptionId, checkState, onAttemptSubmitted]);

  const handleRetry = () => {
    setSelectedOptionId('');
    setTextAnswer('');
    setRetryMode(true);
  };

  const handleNextQuestion = () => {
    if (checkState.activeQuestionIndex < checkState.questions.length - 1) {
      const nextIndex = checkState.activeQuestionIndex + 1;
      const nextState: ConceptKnowledgeCheckState = {
        ...checkState,
        activeQuestionIndex: nextIndex
      };
      setCheckState(nextState);
      saveStoredKnowledgeCheck(nextState);
      setSelectedOptionId('');
      setTextAnswer('');
      setRetryMode(false);
    }
  };

  const handlePrevQuestion = () => {
    if (checkState.activeQuestionIndex > 0) {
      const prevIndex = checkState.activeQuestionIndex - 1;
      const nextState: ConceptKnowledgeCheckState = {
        ...checkState,
        activeQuestionIndex: prevIndex
      };
      setCheckState(nextState);
      saveStoredKnowledgeCheck(nextState);
      setSelectedOptionId('');
      setTextAnswer('');
      setRetryMode(false);
    }
  };

  const handleJumpToSection = (targetSecId?: string) => {
    if (!targetSecId) return;
    if (onNavigateToSection) {
      onNavigateToSection(targetSecId);
    } else {
      const el = document.getElementById(targetSecId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  // Derive adaptive recommendation strictly based on recorded student evidence
  const adaptiveRec = useMemo(() => {
    const graphId = graph?.id || 'default_graph';
    const performance = deriveConceptPerformanceState({
      graphId,
      conceptId,
      conceptName,
      isReviewedInSession: true,
      knowledgeCheckState: checkState
    });

    const rec = generateAdaptiveRecommendation({
      graphId,
      currentConceptId: conceptId,
      currentConceptName: conceptName,
      performance,
      explanation,
      graph,
      session,
      allGraphConcepts: graph?.nodes
    });

    saveAdaptiveRecommendation(rec);
    return rec;
  }, [graph, conceptId, conceptName, checkState, explanation, session]);

  // 1. Insufficient Material State
  if (checkState.status === 'insufficient') {
    return (
      <div className="revision-section revision-section-knowledge-check" id="section-knowledge-check">
        <h2 className="revision-section-heading">
          {sectionNum && <span className="revision-section-num">{sectionNum}</span>}
          <span>Knowledge Check</span>
        </h2>
        <div className="revision-kc-insufficient" role="status">
          <div className="revision-kc-insufficient-kicker">INTERACTIVE CHECK / UNAVAILABLE</div>
          <h3 className="revision-kc-insufficient-title">Formative check unavailable</h3>
          <p className="revision-kc-insufficient-desc">
            {checkState.insufficientReason ||
              `The uploaded source material does not contain sufficient verified definitions or mechanisms for "${conceptName}" to formulate an authentic knowledge check.`}
          </p>
        </div>

        {adaptiveRec && (
          <AdaptiveNextStep
            recommendation={adaptiveRec}
            onNavigateToSection={handleJumpToSection}
            onNavigateToConcept={onNavigateToConcept}
            onContinuePlanned={() => onContinueNext?.()}
            onRetryKnowledgeCheck={handleRetry}
          />
        )}
      </div>
    );
  }

  // 2. No questions found fallback
  if (!activeQuestion || checkState.questions.length === 0) {
    return null;
  }

  const isOptionType = activeQuestion.type === 'multiple-choice' ||
    (activeQuestion.type === 'conceptual-reasoning' && Boolean(activeQuestion.options));

  const totalQuestions = checkState.questions.length;
  const currentQNum = checkState.activeQuestionIndex + 1;

  const canSubmit = isOptionType
    ? Boolean(selectedOptionId)
    : textAnswer.trim().length > 0;

  return (
    <div
      className="revision-section revision-section-knowledge-check"
      id="section-knowledge-check"
      role="region"
      aria-label="Interactive Knowledge Check"
    >
      <h2 className="revision-section-heading">
        {sectionNum && <span className="revision-section-num">{sectionNum}</span>}
        <span>Knowledge Check</span>
      </h2>

      <div className="revision-kc-container">
        {/* Header Bar: Type Badge & Pagination */}
        <div className="revision-kc-header">
          <div className="revision-kc-type-wrapper">
            <span className="revision-kc-type-tag">
              {activeQuestion.type === 'multiple-choice'
                ? 'MULTIPLE CHOICE'
                : activeQuestion.type === 'short-answer'
                  ? 'SHORT ANSWER'
                  : 'CONCEPTUAL REASONING'}
            </span>
          </div>

          {totalQuestions > 1 && (
            <div className="revision-kc-progress" aria-label={`Question ${currentQNum} of ${totalQuestions}`}>
              <span className="revision-kc-progress-text">
                {`Question ${currentQNum} of ${totalQuestions}`}
              </span>
              <div className="revision-kc-dots" aria-hidden="true">
                {checkState.questions.map((q, idx) => {
                  const isAnswered = Boolean(checkState.attempts[q.id]);
                  const isCurrent = idx === checkState.activeQuestionIndex;
                  return (
                    <span
                      key={q.id}
                      className={`revision-kc-dot ${isCurrent ? 'current' : ''} ${isAnswered ? 'answered' : ''}`}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Question Prompt */}
        <h3 className="revision-kc-prompt">{activeQuestion.prompt}</h3>

        {/* Question Input Form / Options */}
        {!hasAttempted && (
          <div className="revision-kc-interactive-area">
            {isOptionType && activeQuestion.options && (
              <div
                className="revision-kc-options"
                role="radiogroup"
                aria-labelledby={radioGroupId}
              >
                {activeQuestion.options.map((opt, optIdx) => {
                  const isSelected = selectedOptionId === opt.id;
                  const letterSlot = String.fromCharCode(65 + optIdx); // A, B, C, D

                  return (
                    <button
                      key={opt.id}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`revision-kc-option ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectOption(opt.id)}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          handleSelectOption(opt.id);
                        }
                      }}
                    >
                      <span className="revision-kc-option-slot" aria-hidden="true">
                        {letterSlot}
                      </span>
                      <span className="revision-kc-option-text">{opt.text}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {!isOptionType && (
              <div className="revision-kc-text-area-wrapper">
                <textarea
                  className="revision-kc-textarea"
                  value={textAnswer}
                  onChange={(e) => setTextAnswer(e.target.value)}
                  placeholder="Explain the core mechanism in your own words..."
                  rows={3}
                  aria-label="Your answer"
                  disabled={isSubmitting}
                />
                <span className="revision-kc-textarea-hint">
                  Focus on key principles and the operational mechanism.
                </span>
              </div>
            )}

            {/* Submit Action */}
            <div className="revision-kc-actions">
              <button
                type="button"
                className="revision-kc-submit-btn"
                disabled={!canSubmit || isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? 'Evaluating...' : 'Check understanding'}
              </button>
            </div>
          </div>
        )}

        {/* Submitted Answer & Formative Feedback Card */}
        {hasAttempted && currentAttempt && (
          <AnimatePresence mode="wait">
            <motion.div
              key="feedback"
              className={`revision-kc-feedback ${
                currentAttempt.evaluation.isCorrect
                  ? 'correct'
                  : currentAttempt.evaluation.evaluationConfidence === 'uncertain'
                    ? 'uncertain'
                    : 'incorrect'
              }`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              {/* Feedback Status Header */}
              <div className="revision-kc-feedback-header">
                <div className="revision-kc-status-tag">
                  <span className="revision-kc-status-dot" aria-hidden="true" />
                  <span>
                    {currentAttempt.evaluation.isCorrect
                      ? (currentAttempt.evaluation.score >= 1 ? 'UNDERSTOOD' : 'PARTIALLY UNDERSTOOD')
                      : currentAttempt.evaluation.evaluationConfidence === 'uncertain'
                        ? 'EVALUATION APPROXIMATE'
                        : 'REVIEW RECOMMENDED'}
                  </span>
                </div>

                <div className="revision-kc-feedback-actions">
                  <button
                    type="button"
                    className="revision-kc-retry-btn"
                    onClick={handleRetry}
                    title="Revise your answer"
                  >
                    Try again
                  </button>
                </div>
              </div>

              {/* Feedback Explanation */}
              <div className="revision-kc-feedback-body">
                <p className="revision-kc-feedback-message">
                  {currentAttempt.evaluation.feedback}
                </p>

                {/* Misconception Rationale if provided */}
                {currentAttempt.evaluation.misconceptionGuidance && (
                  <div className="revision-kc-misconception">
                    <span className="revision-kc-subhead">Misconception Note</span>
                    <p>{currentAttempt.evaluation.misconceptionGuidance}</p>
                  </div>
                )}

                {/* Verified Reference Answer */}
                <div className="revision-kc-correct-answer-box">
                  <span className="revision-kc-subhead">Verified Reference from Material</span>
                  <p className="revision-kc-correct-text">
                    {currentAttempt.evaluation.correctAnswer}
                  </p>
                </div>

                {/* Grounded Source Passage if available */}
                {activeQuestion.sourcePassage && (
                  <blockquote className="revision-kc-quote">
                    "{activeQuestion.sourcePassage}"
                    {activeQuestion.sourceTitle && (
                      <cite className="revision-kc-cite">
                        — {activeQuestion.sourceTitle}
                        {activeQuestion.page ? `, Page ${activeQuestion.page}` : ''}
                      </cite>
                    )}
                  </blockquote>
                )}
              </div>

              {/* Footer Controls: Review in Explanation + Question Paging */}
              <div className="revision-kc-feedback-footer">
                {currentAttempt.evaluation.reviewSectionId && (
                  <button
                    type="button"
                    className="revision-kc-review-link"
                    onClick={() => handleJumpToSection(currentAttempt.evaluation.reviewSectionId)}
                  >
                    <span>
                      {`Review in ${currentAttempt.evaluation.reviewSectionTitle || 'explanation'} ↑`}
                    </span>
                  </button>
                )}

                {totalQuestions > 1 && (
                  <div className="revision-kc-nav-controls">
                    <button
                      type="button"
                      className="revision-kc-nav-btn"
                      disabled={checkState.activeQuestionIndex === 0}
                      onClick={handlePrevQuestion}
                      aria-label="Previous question"
                    >
                      ← Previous
                    </button>
                    <button
                      type="button"
                      className="revision-kc-nav-btn"
                      disabled={checkState.activeQuestionIndex >= totalQuestions - 1}
                      onClick={handleNextQuestion}
                      aria-label="Next question"
                    >
                      Next question →
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </AnimatePresence>
        )}

        {/* Adaptive Next-Step Guidance based on recorded student performance */}
        {hasAttempted && adaptiveRec && (
          <AdaptiveNextStep
            recommendation={adaptiveRec}
            onNavigateToSection={handleJumpToSection}
            onNavigateToConcept={onNavigateToConcept}
            onContinuePlanned={() => onContinueNext?.()}
            onRetryKnowledgeCheck={handleRetry}
          />
        )}
      </div>
    </div>
  );
}
