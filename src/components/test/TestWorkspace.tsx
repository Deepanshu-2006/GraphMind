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

export type TimeTransitionPhase = 'idle' | 'receding' | 'centering' | 'hold' | 'dissolve' | 'done';

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
  const [timerTargetDelta, setTimerTargetDelta] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
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

  // Handle Time Expired with Cinematic Timer Transition
  const handleTimeExpired = useCallback(() => {
    if (!test || hasSubmittedRef.current || isTransitionTriggeredRef.current) return;
    hasSubmittedRef.current = true;
    isTransitionTriggeredRef.current = true;

    // Halt countdown and ensure 00:00 display
    setIsTimerActive(false);
    setRemainingSeconds(0);

    // Functional correctness: submit once, save answers & score
    const timeSpent = Math.max(1, test.timeLimitSeconds);
    const summary = recordKnowledgeTestCompletion(test, answers, timeSpent);
    setResultsSummary(summary);
    onPracticeStatesUpdated?.();

    // If user prefers reduced motion, skip cinematic motion
    if (shouldReduceMotion) {
      setTimeTransitionPhase('done');
      setMode('timeup');
      return;
    }

    // Measure exact anchor center vs viewport center
    const rect = timerAnchorRef.current?.getBoundingClientRect();
    if (rect) {
      const currentCenterX = rect.left + rect.width / 2;
      const currentCenterY = rect.top + rect.height / 2;
      const targetCenterX = window.innerWidth / 2;
      const targetCenterY = window.innerHeight * 0.44;
      setTimerTargetDelta({
        x: targetCenterX - currentCenterX,
        y: targetCenterY - currentCenterY
      });
    }

    // PHASE 1 / 2A: 0ms: Interface recedes into darkness
    setTimeTransitionPhase('receding');

    // PHASE 2B: 200ms: Timer expands and moves toward visual center
    const t1 = setTimeout(() => {
      setTimeTransitionPhase('centering');
    }, 200);

    // PHASE 2C: 900ms: Holds at center, introducing restrained lime-green accent
    const t2 = setTimeout(() => {
      setTimeTransitionPhase('hold');
    }, 900);

    // PHASE 2D: 1100ms: Clock begins to dissolve (fade out + subtle upward drift)
    const t3 = setTimeout(() => {
      setTimeTransitionPhase('dissolve');
    }, 1100);

    // PHASE 3: 1450ms: Switch to TimeUpScreen for Phase 3 reveals
    const t4 = setTimeout(() => {
      setTimeTransitionPhase('done');
      setMode('timeup');
    }, 1450);

    transitionTimeoutsRef.current = [t1, t2, t3, t4];
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
    setTimerTargetDelta({ x: 0, y: 0 });
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

    const summary = recordKnowledgeTestCompletion(test, answers, timeSpent);
    setResultsSummary(summary);
    onPracticeStatesUpdated?.();
    setMode('results');
  }, [test, answers, onPracticeStatesUpdated, clearTransitionTimeouts]);

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
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      role="region"
      aria-label="GraphMind Dedicated Test Workspace"
    >
      {/* Top persistent control bar for testing mode — emerges from top (Section 21) */}
      {/* Top persistent control bar for testing mode & transition */}
      {((mode === 'testing' && timeTransitionPhase !== 'done') || (timeTransitionPhase !== 'idle' && timeTransitionPhase !== 'done')) && test && (
        <motion.div
          className="test-workspace-topbar"
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            ref={timerAnchorRef}
            className={`topbar-timer-anchor ${
              timeTransitionPhase !== 'idle' ? 'is-transitioning-timer' : ''
            }`}
            animate={
              timeTransitionPhase === 'centering' || timeTransitionPhase === 'hold'
                ? {
                    x: timerTargetDelta.x,
                    y: timerTargetDelta.y,
                    scale: typeof window !== 'undefined' && window.innerWidth < 600 ? 1.8 : 2.2,
                    opacity: 1
                  }
                : timeTransitionPhase === 'dissolve'
                ? {
                    x: timerTargetDelta.x,
                    y: timerTargetDelta.y - 18,
                    scale: typeof window !== 'undefined' && window.innerWidth < 600 ? 1.8 : 2.2,
                    opacity: 0
                  }
                : {
                    x: 0,
                    y: 0,
                    scale: 1,
                    opacity: 1
                  }
            }
            transition={
              timeTransitionPhase === 'centering'
                ? {
                    duration: 0.7,
                    ease: [0.16, 1, 0.3, 1]
                  }
                : timeTransitionPhase === 'hold'
                ? {
                    duration: 0.2
                  }
                : timeTransitionPhase === 'dissolve'
                ? {
                    duration: 0.35,
                    ease: [0.16, 1, 0.3, 1]
                  }
                : {
                    duration: 0.2
                  }
            }
          >
            <BigTimer
              remainingSeconds={remainingSeconds}
              totalSeconds={test.timeLimitSeconds}
              isPaused={!isTimerActive}
              isTransitionAccent={timeTransitionPhase === 'hold' || timeTransitionPhase === 'dissolve'}
              isTransitioning={timeTransitionPhase !== 'idle'}
            />
          </motion.div>

          <div
            className={`topbar-exit-anchor ${
              timeTransitionPhase !== 'idle' ? 'is-transition-receding' : ''
            }`}
          >
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
      <div
        className={`test-workspace-content-canvas ${
          timeTransitionPhase !== 'idle' && mode === 'testing'
            ? 'is-transition-receding'
            : ''
        }`}
      >
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

          {mode === 'timeup' && (
            <TimeUpScreen
              key="timeup"
              onViewResults={() => setMode('results')}
              assessmentName={test?.title || graph?.name || 'ASSESSMENT'}
              totalQuestions={test?.questions.length || 0}
              answeredCount={Object.keys(answers).length}
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
