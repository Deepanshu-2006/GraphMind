import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import type { KnowledgeGraph } from '../../types/knowledgeGraph';
import type { 
  KnowledgeTest, 
  TestResultsSummary 
} from '../../types/test';
import { generateKnowledgeTest } from '../../services/knowledgeTestGenerator';
import { recordKnowledgeTestCompletion } from '../../services/storage';

import { BigTimer } from './BigTimer';
import { TestIntroScreen } from './TestIntroScreen';
import { TestQuestionView } from './TestQuestionView';
import { QuestionNavigator } from './QuestionNavigator';
import { SubmitConfirmationModal } from './SubmitConfirmationModal';
import { LeaveConfirmationModal } from './LeaveConfirmationModal';
import { TimeUpScreen } from './TimeUpScreen';
import { TestResultsView } from './TestResultsView';
import { TestReviewView } from './TestReviewView';
import { MissedConceptsReview } from './MissedConceptsReview';

export interface TestWorkspaceProps {
  graph: KnowledgeGraph | null | undefined;
  onClose: () => void;
  onFocusConceptInGraph?: (conceptId: string) => void;
  onPracticeStatesUpdated?: () => void;
  targetQuestionCount?: number;
}

type TestWorkspaceMode = 
  | 'intro'
  | 'testing'
  | 'timeup'
  | 'results'
  | 'review-answers'
  | 'review-missed';

export type TimeTransitionPhase = 'idle' | 'anticipation' | 'receding' | 'centering' | 'hold' | 'dissolve' | 'done';

export function TestWorkspace({
  graph,
  onClose,
  onFocusConceptInGraph,
  onPracticeStatesUpdated,
  targetQuestionCount = 10
}: TestWorkspaceProps) {
  // Test generation on mount or graph change (10 seconds for testing purpose)
  const testGenResult = useMemo(() => {
    return generateKnowledgeTest(graph, {
      questionCount: targetQuestionCount,
      title: graph?.name || 'Knowledge Graph Assessment',
      timeLimitSeconds: 10 // testing purpose: 10 seconds (changed from 10 minutes)
    });
  }, [graph, targetQuestionCount]);

  const [mode, setMode] = useState<TestWorkspaceMode>('intro');
  const [test] = useState<KnowledgeTest | null>(testGenResult.test || null);
  const [conceptsCovered] = useState<string[]>(testGenResult.conceptsCovered || []);
  const [isInsufficientMaterial] = useState<boolean>(!testGenResult.success);

  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [flaggedIds, setFlaggedIds] = useState<Set<string>>(new Set());

  const [remainingSeconds, setRemainingSeconds] = useState<number>(
    testGenResult.test?.timeLimitSeconds || 10
  );
  const [isTimerActive, setIsTimerActive] = useState<boolean>(false);

  // Cinematic timer-transition state & coordinate tracking
  const [timeTransitionPhase, setTimeTransitionPhase] = useState<TimeTransitionPhase>('idle');
  const [timerStartOffset, setTimerStartOffset] = useState<{ x: number; y: number }>({ x: -280, y: -220 });
  const timerAnchorRef = useRef<HTMLDivElement>(null);
  const hasSubmittedRef = useRef(false);
  const isTransitionTriggeredRef = useRef(false);
  const transitionTimeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const shouldReduceMotion = useReducedMotion();

  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(false);

  const [resultsSummary, setResultsSummary] = useState<TestResultsSummary | null>(null);

  // Ref for root container to manage scroll position
  const workspaceRootRef = useRef<HTMLDivElement>(null);
  const startTimeRef = useRef<number>(Date.now());

  const clearTransitionTimeouts = useCallback(() => {
    transitionTimeoutsRef.current.forEach(t => clearTimeout(t));
    transitionTimeoutsRef.current = [];
  }, []);

  useEffect(() => {
    return () => {
      clearTransitionTimeouts();
    };
  }, [clearTransitionTimeouts]);

  // Ensure workspace is always scrolled to the top when mode changes (especially to 'results')
  useEffect(() => {
    if (workspaceRootRef.current) {
      workspaceRootRef.current.scrollTop = 0;
    }
    window.scrollTo(0, 0);
  }, [mode]);

  // Handle Time Expired with Mathematical Centering & Unified Cinematic Transition
  const handleTimeExpired = useCallback(() => {
    if (!test || hasSubmittedRef.current || isTransitionTriggeredRef.current) return;
    hasSubmittedRef.current = true;
    isTransitionTriggeredRef.current = true;

    // Halt countdown and ensure 00:00 display
    setIsTimerActive(false);
    setRemainingSeconds(0);

    // Functional correctness: submit once, save answers & score, and persist attempt
    const timeSpent = Math.max(1, test.timeLimitSeconds);
    const summary = recordKnowledgeTestCompletion(test, answers, timeSpent);
    setResultsSummary(summary);
    onPracticeStatesUpdated?.();

    // If reduced motion is requested, bypass large motion and start directly at center
    if (shouldReduceMotion) {
      setTimerStartOffset({ x: 0, y: 0 });
      setTimeTransitionPhase('done');
      setMode('timeup');
      return;
    }

    // 01 — CREATE ANTICIPATION (0.0s – 0.5s):
    // Hold existing timer in original topbar position, settle digits into stable 00:00
    setTimeTransitionPhase('anticipation');

    // 01b — RECEDING INTERFACE (0.5s – 1.2s):
    // Gradually reduce the prominence of the surrounding assessment interface
    const tReceding = setTimeout(() => {
      setTimeTransitionPhase('receding');
    }, 500);
    transitionTimeoutsRef.current.push(tReceding);

    // 02 — MAKE THE CLOCK THE HERO (1.2s):
    // Measure actual DOM bounds and mount TimeUpScreen with calculated offset
    const tHero = setTimeout(() => {
      let initialOffset = { x: -280, y: -220 };
      if (workspaceRootRef.current && timerAnchorRef.current) {
        workspaceRootRef.current.scrollTop = 0;
        const rootRect = workspaceRootRef.current.getBoundingClientRect();
        const timerRect = timerAnchorRef.current.getBoundingClientRect();

        // Mathematically exact center of the main content area (excluding sidebar and topbar)
        const contentCenterX = rootRect.width / 2;
        const contentCenterY = rootRect.height / 2;

        // Center of topbar timer in main content area coordinates
        const timerCenterX = (timerRect.left + timerRect.width / 2) - rootRect.left;
        const timerCenterY = (timerRect.top + timerRect.height / 2) - rootRect.top;

        initialOffset = {
          x: timerCenterX - contentCenterX,
          y: timerCenterY - contentCenterY
        };
      }

      setTimerStartOffset(initialOffset);
      setTimeTransitionPhase('done');
      setMode('timeup');
    }, 1200);
    transitionTimeoutsRef.current.push(tHero);
  }, [test, answers, onPracticeStatesUpdated, shouldReduceMotion]);

  // Timer Tick & Wall-Clock Synchronization (remains accurate across background tab throttling)
  useEffect(() => {
    if (!isTimerActive || mode !== 'testing' || !test) return;

    const syncCountdown = () => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      const remaining = Math.max(0, test.timeLimitSeconds - elapsed);
      setRemainingSeconds(remaining);

      if (remaining <= 0) {
        setIsTimerActive(false);
        handleTimeExpired();
      }
    };

    const timer = setInterval(syncCountdown, 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncCountdown();
      }
    };
    const handleFocus = () => {
      syncCountdown();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isTimerActive, mode, test, handleTimeExpired]);

  // Start Test Action
  const handleStartTest = useCallback(() => {
    if (!test) return;
    startTimeRef.current = Date.now();
    hasSubmittedRef.current = false;
    isTransitionTriggeredRef.current = false;
    setTimeTransitionPhase('idle');
    setTimerStartOffset({ x: -280, y: -220 });
    clearTransitionTimeouts();
    setIsTimerActive(true);
    setMode('testing');
    setCurrentIndex(0);
  }, [test, clearTransitionTimeouts]);

  // Submit Test Action
  const handleConfirmSubmit = useCallback(() => {
    if (!test || hasSubmittedRef.current) return;
    hasSubmittedRef.current = true;
    clearTransitionTimeouts();
    setIsSubmitModalOpen(false);
    setIsTimerActive(false);

    const elapsedSeconds = Math.max(
      1,
      Math.round((Date.now() - startTimeRef.current) / 1000)
    );
    const timeSpent = Math.min(test.timeLimitSeconds, elapsedSeconds);

    const summary = recordKnowledgeTestCompletion(test, answers, timeSpent, {
      completionReason: 'submission',
      graphName: graph?.name
    });
    setResultsSummary(summary);
    onPracticeStatesUpdated?.();
    setMode('results');
  }, [test, answers, graph?.name, onPracticeStatesUpdated, clearTransitionTimeouts]);

  // Retry saving assessment attempt if persistence failed
  const handleRetrySaveAttempt = useCallback(() => {
    if (!resultsSummary || !test) return;
    const retrySummary = recordKnowledgeTestCompletion(
      test,
      answers,
      resultsSummary.timeSpentSeconds,
      {
        completionReason: 'submission',
        graphName: graph?.name,
        attemptId: resultsSummary.attemptId
      }
    );
    setResultsSummary(retrySummary);
  }, [resultsSummary, test, answers, graph?.name]);

  // Answer selection
  const handleSelectOption = useCallback((optionId: string) => {
    if (!test) return;
    const currentQ = test.questions[currentIndex];
    if (!currentQ) return;

    setAnswers(prev => ({
      ...prev,
      [currentQ.id]: optionId
    }));
  }, [test, currentIndex]);

  // Flag toggle
  const handleToggleFlag = useCallback(() => {
    if (!test) return;
    const currentQ = test.questions[currentIndex];
    if (!currentQ) return;

    setFlaggedIds(prev => {
      const next = new Set(prev);
      if (next.has(currentQ.id)) {
        next.delete(currentQ.id);
      } else {
        next.add(currentQ.id);
      }
      return next;
    });
  }, [test, currentIndex]);

  // Question navigation
  const handlePrevQuestion = useCallback(() => {
    setCurrentIndex(prev => Math.max(0, prev - 1));
  }, []);

  const handleNextQuestion = useCallback(() => {
    if (!test) return;
    setCurrentIndex(prev => Math.min(test.questions.length - 1, prev + 1));
  }, [test]);

  // Keyboard support (Section 34)
  useEffect(() => {
    if (mode !== 'testing' || !test) return;
    if (isSubmitModalOpen || isLeaveModalOpen || isNavigatorOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is somehow typing in an input
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
        return;
      }

      const currentQ = test.questions[currentIndex];
      if (!currentQ) return;

      // 1-4 selection
      if (['1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const slot = e.key.padStart(2, '0');
        const matched = currentQ.options.find(o => o.id === slot);
        if (matched) {
          handleSelectOption(matched.id);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentIndex > 0) {
          handlePrevQuestion();
        }
      } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        const canAdvance = Boolean(answers[currentQ.id]);
        if (canAdvance) {
          e.preventDefault();
          if (currentIndex < test.questions.length - 1) {
            handleNextQuestion();
          } else {
            setIsSubmitModalOpen(true);
          }
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setIsLeaveModalOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    mode, 
    test, 
    currentIndex, 
    answers, 
    isSubmitModalOpen, 
    isLeaveModalOpen, 
    isNavigatorOpen, 
    handleSelectOption, 
    handlePrevQuestion, 
    handleNextQuestion
  ]);

  const currentQuestion = test?.questions[currentIndex];

  return (
    <motion.div
      ref={workspaceRootRef}
      className="test-workspace-root"
      data-transition-phase={timeTransitionPhase}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      role="region"
      aria-label="GraphMind Dedicated Test Workspace"
    >
      {/* Top persistent control bar for testing mode — emerges from top (Section 21) */}
      {mode === 'testing' && test && (
        <motion.div
          className="test-workspace-topbar"
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <div ref={timerAnchorRef} className="topbar-timer-anchor">
            <BigTimer
              remainingSeconds={remainingSeconds}
              totalSeconds={test.timeLimitSeconds}
              isPaused={!isTimerActive}
              isTransitioning={timeTransitionPhase === 'anticipation' || timeTransitionPhase === 'receding'}
            />
          </div>

          <div className="topbar-exit-anchor">
            <button
              type="button"
              className="test-exit-action-btn"
              onClick={() => setIsLeaveModalOpen(true)}
              title="Leave test (Escape)"
            >
              <X size={14} aria-hidden="true" />
              <span>EXIT TEST</span>
            </button>
          </div>
        </motion.div>
      )}

      {/* Main Mode View */}
      {mode !== 'timeup' && (
        <div className="test-workspace-content-canvas">
          <AnimatePresence mode="wait">
            {mode === 'intro' && (
              <TestIntroScreen
                key="intro"
                test={test}
                conceptsCovered={conceptsCovered}
                isInsufficientMaterial={isInsufficientMaterial}
                onStartTest={handleStartTest}
                onExitTest={onClose}
              />
            )}

            {mode === 'testing' && test && currentQuestion && (
              <TestQuestionView
                key="active-test-question-workspace"
                question={currentQuestion}
                currentIndex={currentIndex}
                totalQuestions={test.questions.length}
                selectedOptionId={answers[currentQuestion.id]}
                isFlagged={flaggedIds.has(currentQuestion.id)}
                onSelectOption={handleSelectOption}
                onToggleFlag={handleToggleFlag}
                onPrev={handlePrevQuestion}
                onNext={handleNextQuestion}
                onSubmit={() => setIsSubmitModalOpen(true)}
                isFirst={currentIndex === 0}
                isLast={currentIndex === test.questions.length - 1}
                onToggleNavigator={() => setIsNavigatorOpen(prev => !prev)}
              />
            )}

            {mode === 'results' && resultsSummary && (
              <TestResultsView
                key="results"
                results={resultsSummary}
                test={test}
                graph={graph}
                onReviewAnswers={() => setMode('review-answers')}
                onReviewMissedConcepts={() => setMode('review-missed')}
                onBackToGraph={onClose}
                onSelectConceptToReview={(conceptId) => {
                  onClose();
                  onFocusConceptInGraph?.(conceptId);
                }}
                onRetrySave={handleRetrySaveAttempt}
              />
            )}

            {mode === 'review-answers' && test && (
              <TestReviewView
                key="review-answers"
                test={test}
                userAnswers={answers}
                onBackToResults={() => setMode('results')}
                onSelectConceptToReview={(conceptId) => {
                  onClose();
                  onFocusConceptInGraph?.(conceptId);
                }}
              />
            )}

            {mode === 'review-missed' && resultsSummary && (
              <MissedConceptsReview
                key="review-missed"
                missedConcepts={resultsSummary.reviewRecommendedConcepts}
                onBackToResults={() => setMode('results')}
                onReviewConceptInGraph={(conceptId) => {
                  onClose();
                  onFocusConceptInGraph?.(conceptId);
                }}
              />
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Dedicated Transition Layer & TIME'S UP Experience */}
      {mode === 'timeup' && (
        <TimeUpScreen
          key="timeup"
          onViewResults={() => setMode('results')}
          assessmentName={test?.title || graph?.name || 'ASSESSMENT'}
          totalQuestions={test?.questions.length || 0}
          answeredCount={Object.keys(answers).length}
          initialTimerOffset={timerStartOffset}
        />
      )}

      {/* Question Navigator Popover */}
      {mode === 'testing' && test && (
        <QuestionNavigator
          isOpen={isNavigatorOpen}
          onClose={() => setIsNavigatorOpen(false)}
          questions={test.questions}
          currentIndex={currentIndex}
          answers={answers}
          flaggedIds={flaggedIds}
          onSelectIndex={(idx) => setCurrentIndex(idx)}
        />
      )}

      {/* Submit Confirmation Dialog */}
      <SubmitConfirmationModal
        isOpen={isSubmitModalOpen}
        answeredCount={Object.keys(answers).length}
        totalCount={test?.questions.length || 0}
        onConfirm={handleConfirmSubmit}
        onCancel={() => setIsSubmitModalOpen(false)}
      />

      {/* Leave Confirmation Dialog (Section 7: Live Test Context) */}
      <LeaveConfirmationModal
        isOpen={isLeaveModalOpen}
        answeredCount={Object.keys(answers).length}
        totalCount={test?.questions.length || 0}
        remainingSeconds={remainingSeconds}
        testLabel="TEST 01"
        onConfirm={() => {
          setIsLeaveModalOpen(false);
          setIsTimerActive(false);
          onClose();
        }}
        onCancel={() => setIsLeaveModalOpen(false)}
      />
    </motion.div>
  );
}
