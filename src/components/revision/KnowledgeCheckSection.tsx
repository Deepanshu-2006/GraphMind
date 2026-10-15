import React, { useState, useEffect, useCallback, useMemo, useId, useRef } from 'react';
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
  const feedbackRef = useRef<HTMLDivElement>(null);

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

      // Subtle accessible scroll without disruptive jumps
      setTimeout(() => {
        feedbackRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
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

  // Determine actions for the single feedback region
  const isCorrect = currentAttempt?.evaluation.isCorrect ?? false;
  const isLastQuestion = checkState.activeQuestionIndex >= totalQuestions - 1;
  const hasNextQuestion = checkState.activeQuestionIndex < totalQuestions - 1;
  const hasPrevQuestion = checkState.activeQuestionIndex > 0;
  const reviewSectionId = currentAttempt?.evaluation.reviewSectionId;
  const reviewSectionTitle = currentAttempt?.evaluation.reviewSectionTitle || 'explanation';

  interface ActionItem {
    label: string;
    onClick: () => void;
    className: string;
    title?: string;
  }

  let primaryAction: ActionItem | null = null;
  const secondaryActions: ActionItem[] = [];

  if (hasAttempted && currentAttempt) {
    if (isCorrect) {
      if (hasNextQuestion) {
        primaryAction = {
          label: 'Next question →',
          onClick: handleNextQuestion,
          className: 'revision-kc-action-primary correct-primary revision-kc-nav-btn',
          title: 'Advance to next knowledge check question'
        };
        if (hasPrevQuestion) {
          secondaryActions.push({
            label: '← Previous',
            onClick: handlePrevQuestion,
            className: 'revision-kc-action-secondary revision-kc-nav-btn',
            title: 'Review previous question'
          });
        }
        secondaryActions.push({
          label: 'Try again ↻',
          onClick: handleRetry,
          className: 'revision-kc-action-secondary revision-kc-retry-btn',
          title: 'Revise your answer'
        });
      } else {
        primaryAction = {
          label: onContinueNext ? 'Continue in planned order →' : 'Complete check',
          onClick: () => onContinueNext ? onContinueNext() : handleRetry(),
          className: 'revision-kc-action-primary correct-primary',
          title: 'Continue along your revision path'
        };
        if (hasPrevQuestion) {
          secondaryActions.push({
            label: '← Previous',
            onClick: handlePrevQuestion,
            className: 'revision-kc-action-secondary revision-kc-nav-btn',
            title: 'Review previous question'
          });
        }
        secondaryActions.push({
          label: 'Try again ↻',
          onClick: handleRetry,
          className: 'revision-kc-action-secondary revision-kc-retry-btn',
          title: 'Revise your answer'
        });
      }
    } else {
      // Incorrect answer
      primaryAction = {
        label: 'Review concept ↗',
        onClick: () => handleJumpToSection(reviewSectionId || 'section-understanding'),
        className: 'revision-kc-action-primary review-primary revision-kc-review-link',
        title: reviewSectionTitle ? `Review in ${reviewSectionTitle}` : 'Review concept in explanation'
      };
      secondaryActions.push({
        label: 'Try again ↻',
        onClick: handleRetry,
        className: 'revision-kc-action-secondary revision-kc-retry-btn',
        title: 'Revise your answer'
      });
      if (hasNextQuestion) {
        secondaryActions.push({
          label: 'Next question →',
          onClick: handleNextQuestion,
          className: 'revision-kc-action-secondary revision-kc-nav-btn',
          title: 'Skip to next question'
        });
      } else if (onContinueNext) {
        secondaryActions.push({
          label: 'Continue in planned order →',
          onClick: () => onContinueNext(),
          className: 'revision-kc-action-secondary',
          title: 'Continue along your revision path'
        });
      }
      if (hasPrevQuestion) {
        secondaryActions.push({
          label: '← Previous',
          onClick: handlePrevQuestion,
          className: 'revision-kc-action-secondary revision-kc-nav-btn',
          title: 'Review previous question'
        });
      }
    }
  }

  // Deduplicate: check if misconception duplicates explanation
  const substantiveExplanation = currentAttempt?.evaluation.explanation || currentAttempt?.evaluation.feedback || '';
  const misconception = currentAttempt?.evaluation.misconceptionGuidance;
  const isMisconceptionRedundant = Boolean(
    misconception &&
    substantiveExplanation &&
    (substantiveExplanation.toLowerCase().includes(misconception.toLowerCase().trim()) ||
      misconception.toLowerCase().includes(substantiveExplanation.toLowerCase().trim()))
  );

  const rawPassage = activeQuestion?.sourcePassage?.trim() || '';
  const normPassage = rawPassage.toLowerCase().replace(/["'“”]/g, '').trim();
  const normExpl = substantiveExplanation.toLowerCase().replace(/["'“”]/g, '').trim();
  const isSourceInExplanation = Boolean(
    rawPassage &&
    normExpl &&
    (normExpl.includes(normPassage) || (normPassage.length > 20 && normExpl.includes(normPassage.slice(0, 30))))
  );
  const normMisconception = misconception ? misconception.toLowerCase().replace(/["'“”]/g, '').trim() : '';
  const isSourceInMisconception = Boolean(
    rawPassage &&
    normMisconception &&
    (normMisconception.includes(normPassage) || (normPassage.length > 20 && normMisconception.includes(normPassage.slice(0, 30))))
  );
  const shouldShowSource = Boolean(rawPassage && !isSourceInExplanation && !isSourceInMisconception);

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

        {/* Options / Text Input Area */}
        <div className="revision-kc-interactive-area">
          {isOptionType && activeQuestion.options && (
            <div
              className="revision-kc-options"
              role="radiogroup"
              aria-labelledby={radioGroupId}
            >
              {activeQuestion.options.map((opt, optIdx) => {
                const isSelected = selectedOptionId === opt.id || (hasAttempted && currentAttempt?.submittedAnswer === opt.id);
                const isSubmittedChoice = hasAttempted && currentAttempt?.submittedAnswer === opt.id;
                const isVerifiedCorrect = hasAttempted && (
                  opt.id === activeQuestion.correctOptionId ||
                  opt.text.trim().toLowerCase() === currentAttempt?.evaluation.correctAnswer?.trim().toLowerCase()
                );
                const letterSlot = String.fromCharCode(65 + optIdx); // A, B, C, D

                let optionClassName = 'revision-kc-option';
                if (isSelected) optionClassName += ' selected';
                if (hasAttempted) {
                  optionClassName += ' submitted';
                  if (isSubmittedChoice) {
                    optionClassName += isCorrect ? ' submitted-correct' : ' submitted-incorrect';
                  } else if (isVerifiedCorrect && !isCorrect) {
                    optionClassName += ' was-correct';
                  }
                }

                return (
                  <button
                    key={opt.id}
                    id={`kc-opt-${opt.id}`}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    aria-label={`Option ${letterSlot}: ${opt.text}`}
                    tabIndex={
                      hasAttempted
                        ? -1
                        : selectedOptionId
                          ? (selectedOptionId === opt.id ? 0 : -1)
                          : (optIdx === 0 ? 0 : -1)
                    }
                    disabled={hasAttempted || isSubmitting}
                    className={optionClassName}
                    onClick={() => handleSelectOption(opt.id)}
                    onKeyDown={(e) => {
                      if (hasAttempted || isSubmitting) return;
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        handleSelectOption(opt.id);
                      } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                        e.preventDefault();
                        const nextIdx = (optIdx + 1) % activeQuestion.options!.length;
                        const nextOpt = activeQuestion.options![nextIdx];
                        handleSelectOption(nextOpt.id);
                        const nextBtn = document.getElementById(`kc-opt-${nextOpt.id}`);
                        nextBtn?.focus();
                      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                        e.preventDefault();
                        const prevIdx = (optIdx - 1 + activeQuestion.options!.length) % activeQuestion.options!.length;
                        const prevOpt = activeQuestion.options![prevIdx];
                        handleSelectOption(prevOpt.id);
                        const prevBtn = document.getElementById(`kc-opt-${prevOpt.id}`);
                        prevBtn?.focus();
                      }
                    }}
                  >
                    <span className="revision-kc-option-slot" aria-hidden="true">
                      {letterSlot}
                    </span>
                    <span className="revision-kc-option-text">{opt.text}</span>
                    {hasAttempted && isSubmittedChoice && !isCorrect && (
                      <span className="revision-kc-option-status-marker selected-wrong" aria-hidden="true">
                        Selected
                      </span>
                    )}
                    {hasAttempted && isVerifiedCorrect && (
                      <span className="revision-kc-option-status-marker correct" aria-hidden="true">
                        Correct
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {!isOptionType && (
            <div className="revision-kc-text-area-wrapper">
              <textarea
                className="revision-kc-textarea"
                value={hasAttempted ? (currentAttempt?.submittedAnswer || textAnswer) : textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                placeholder="Explain the core mechanism in your own words..."
                rows={3}
                aria-label="Your answer"
                disabled={isSubmitting || hasAttempted}
              />
              {!hasAttempted && (
                <span className="revision-kc-textarea-hint">
                  Focus on key principles and the operational mechanism.
                </span>
              )}
            </div>
          )}

          {/* Submit Action (shown only before submission) */}
          {!hasAttempted && (
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
          )}
        </div>

        {/* Consolidated Single Feedback Region */}
        {hasAttempted && currentAttempt && (
          <AnimatePresence mode="wait">
            <motion.div
              key={`feedback-${activeQuestion.id}`}
              ref={feedbackRef}
              className={`revision-kc-feedback ${
                isCorrect
                  ? 'correct'
                  : currentAttempt.evaluation.evaluationConfidence === 'uncertain'
                    ? 'uncertain'
                    : 'incorrect'
              }`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* A. Result Header */}
              <div className="revision-kc-feedback-header">
                <div className="revision-kc-status-tag">
                  <span className="revision-kc-status-dot" aria-hidden="true" />
                  <span>
                    {isCorrect
                      ? (currentAttempt.evaluation.score >= 1 ? 'CORRECT' : 'PARTIALLY UNDERSTOOD')
                      : currentAttempt.evaluation.evaluationConfidence === 'uncertain'
                        ? 'EVALUATION APPROXIMATE'
                        : 'REVIEW RECOMMENDED'}
                  </span>
                </div>

                {totalQuestions > 1 && (
                  <span className="revision-kc-feedback-pos" aria-hidden="true">
                    {`Question ${currentQNum} of ${totalQuestions}`}
                  </span>
                )}
              </div>

              {/* B. Explanation */}
              <div className="revision-kc-feedback-body">
                <p className="revision-kc-feedback-message">
                  {substantiveExplanation}
                </p>

                {/* C. Misconception Note (Key Distinction) */}
                {misconception && !isCorrect && !isMisconceptionRedundant && (
                  <div className="revision-kc-distinction">
                    <span className="revision-kc-distinction-label">KEY DISTINCTION</span>
                    <p className="revision-kc-distinction-text">
                      {misconception}
                    </p>
                  </div>
                )}

                {/* D. Source Evidence Quotation */}
                {shouldShowSource && (
                  <blockquote className="revision-kc-quote">
                    <span className="revision-kc-quote-attribution">
                      SOURCE{activeQuestion.sourceTitle ? ` · ${activeQuestion.sourceTitle}` : ''}
                      {activeQuestion.page ? `, Page ${activeQuestion.page}` : ''}
                    </span>
                    <p className="revision-kc-quote-text">"{rawPassage}"</p>
                  </blockquote>
                )}
              </div>

              {/* E. Action Row */}
              <div className="revision-kc-action-row">
                {primaryAction && (
                  <button
                    type="button"
                    className={primaryAction.className}
                    onClick={primaryAction.onClick}
                    title={primaryAction.title}
                  >
                    {primaryAction.label}
                  </button>
                )}

                {secondaryActions.map((sec, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className={sec.className}
                    onClick={sec.onClick}
                    title={sec.title}
                  >
                    {sec.label}
                  </button>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
};

