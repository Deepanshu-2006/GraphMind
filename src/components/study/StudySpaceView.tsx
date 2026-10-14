import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion, useInView, animate } from 'framer-motion';
import { Search, X } from 'lucide-react';
import type { KnowledgeGraph } from '../../types/knowledgeGraph';
import type { 
  KnowledgeTest, 
  AssessmentAttempt, 
  TestResultsSummary, 
  MissedConceptItem,
  AssessmentCompletionReason
} from '../../types/test';
import { 
  getAssessmentAttempts, 
  getAssessmentAttemptById 
} from '../../services/assessmentHistory';
import { loadGraphs, loadActiveGraphId, loadGraphData } from '../../services/storage';
import { useOptionalGraph } from '../../context/GraphContext';
import { TestResultsView } from '../test/TestResultsView';
import { TestReviewView } from '../test/TestReviewView';
import { MissedConceptsReview } from '../test/MissedConceptsReview';
import { getArcEndpoint } from './CircularScore';
import { SlotDigit } from '../common/SlotDigit';
import { KnowledgeGapSection } from './KnowledgeGapSection';
import { RevisionRecommendationsSection } from './RevisionRecommendationsSection';
import { UnifiedLearningOverview } from './UnifiedLearningOverview';

export interface StudySpaceViewProps {
  onNavigateToGraph: () => void;
  onNavigateToConcept?: (conceptId: string) => void;
  onNavigateToRevision?: (conceptId: string, actionType?: string, targetSectionId?: string) => void;
  activeGraph?: KnowledgeGraph | null;
  initialAttemptId?: string | null;
}

type StudyViewMode = 'list' | 'historical-results' | 'review-answers' | 'review-missed';
type StudyFilterMode = 'all' | 'needs-review';

const REVEAL_EASE = [0.16, 1, 0.3, 1] as const;
const EDITORIAL_EASE = [0.22, 1, 0.36, 1] as const;
const CIRCLE_RADIUS = 82;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_RADIUS;

export function pad(n: number): string {
  return String(Math.max(0, n)).padStart(2, '0');
}

export function formatAttemptDate(isoString: string): { dateStr: string; timeStr: string } {
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return { dateStr: 'Recent', timeStr: '' };
    
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getUTCMonth()];
    const day = String(d.getUTCDate()).padStart(2, '0');
    const year = d.getUTCFullYear();
    
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    
    return {
      dateStr: `${month} ${day}, ${year}`,
      timeStr: `${hours}:${minutes}`
    };
  } catch {
    return { dateStr: 'Recent', timeStr: '' };
  }
}

export function formatDuration(seconds: number): string {
  const safeSec = Math.max(0, Math.floor(seconds || 0));
  const mins = Math.floor(safeSec / 60);
  const secs = safeSec % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

export interface ScoreComparison {
  latestScore: number;
  previousScore: number;
  diffPoints: number;
  status: 'improved' | 'declined' | 'unchanged' | 'incompatible';
  message: string;
}

/**
 * Calculates score progress across attempts on the same graph in percentage points.
 * Handles different question counts cleanly via normalized score percentage.
 */
export function computeProgressComparison(
  latest: AssessmentAttempt,
  previous: AssessmentAttempt
): ScoreComparison {
  const latestScore = latest.scorePercentage;
  const previousScore = previous.scorePercentage;

  if (
    typeof latestScore !== 'number' ||
    typeof previousScore !== 'number' ||
    isNaN(latestScore) ||
    isNaN(previousScore) ||
    latestScore < 0 ||
    previousScore < 0
  ) {
    return {
      latestScore: typeof latestScore === 'number' && !isNaN(latestScore) ? latestScore : 0,
      previousScore: typeof previousScore === 'number' && !isNaN(previousScore) ? previousScore : 0,
      diffPoints: 0,
      status: 'incompatible',
      message: 'Score comparison unavailable (incompatible scoring)'
    };
  }

  if (latest.graphId && previous.graphId && latest.graphId !== previous.graphId) {
    return {
      latestScore,
      previousScore,
      diffPoints: 0,
      status: 'incompatible',
      message: 'Comparison unavailable: attempts belong to different graphs'
    };
  }

  const diffPoints = latestScore - previousScore;

  if (diffPoints > 0) {
    return {
      latestScore,
      previousScore,
      diffPoints,
      status: 'improved',
      message: `Improved by ${diffPoints} percentage points`
    };
  }

  if (diffPoints < 0) {
    return {
      latestScore,
      previousScore,
      diffPoints: Math.abs(diffPoints),
      status: 'declined',
      message: `Decreased by ${Math.abs(diffPoints)} percentage points`
    };
  }

  return {
    latestScore,
    previousScore,
    diffPoints: 0,
    status: 'unchanged',
    message: 'Unchanged (same score as previous attempt)'
  };
}

export interface ChronologicalScorePoint {
  attemptId: string;
  attemptNumber: string; // e.g. "Attempt 01"
  scorePercentage: number;
  completedAt: string;
  dateStr: string;
  timeStr: string;
  totalQuestions: number;
  correctAnswers: number;
  completionReason?: AssessmentCompletionReason;
}

export interface GraphLearningProgress {
  graphId: string;
  graphName: string;
  totalAttempts: number;
  latestScore: number;
  previousScore?: number;
  diffPoints?: number;
  scoreChangeFormatted?: string; // "+20 percentage points", "−15 percentage points", "0 percentage points"
  comparisonStatus?: 'improved' | 'declined' | 'unchanged' | 'incompatible';
  comparisonMessage?: string;
  latestAttempt: AssessmentAttempt;
  previousAttempt?: AssessmentAttempt;
  chronologicalAttempts: ChronologicalScorePoint[];
  hasComparison: boolean;
}

/**
 * Computes chronological learning progress for a specific knowledge graph.
 * Ensures strict grouping by graph ID, real timestamps, and percentage-point comparisons.
 */
export function computeGraphLearningProgress(
  graphId: string,
  attempts: AssessmentAttempt[]
): GraphLearningProgress | null {
  if (!graphId || !Array.isArray(attempts)) return null;

  // Filter attempts strictly by stable graphId
  const graphAttempts = attempts.filter(a => {
    const gid = a.graphId || `unassigned-${a.id}`;
    return gid === graphId;
  });

  if (graphAttempts.length === 0) return null;

  // Sort ascending by completedAt date to establish strict chronological timeline
  const sortedAsc = [...graphAttempts].sort((a, b) => {
    const timeA = new Date(a.completedAt).getTime() || 0;
    const timeB = new Date(b.completedAt).getTime() || 0;
    if (timeA !== timeB) return timeA - timeB;
    // Tie-breaker: preserve relative insertion order (items earlier in graphAttempts are newer)
    return graphAttempts.indexOf(b) - graphAttempts.indexOf(a);
  });

  const totalAttempts = sortedAsc.length;
  const latestAttempt = sortedAsc[sortedAsc.length - 1];
  const graphName = latestAttempt.graphName || 'Assessment';
  const latestScore = latestAttempt.scorePercentage;

  // Map chronological attempt points
  const chronologicalAttempts: ChronologicalScorePoint[] = sortedAsc.map((a, idx) => {
    const dateInfo = formatAttemptDate(a.completedAt);
    return {
      attemptId: a.id,
      attemptNumber: `Attempt ${pad(idx + 1)}`,
      scorePercentage: a.scorePercentage,
      completedAt: a.completedAt,
      dateStr: dateInfo.dateStr,
      timeStr: dateInfo.timeStr,
      totalQuestions: a.totalQuestions,
      correctAnswers: a.correctAnswers,
      completionReason: a.completionReason
    };
  });

  if (totalAttempts === 1) {
    return {
      graphId,
      graphName,
      totalAttempts: 1,
      latestScore,
      latestAttempt,
      chronologicalAttempts,
      hasComparison: false,
      comparisonMessage: 'Comparison unavailable: complete another assessment on this graph to track progress.'
    };
  }

  // Two or more attempts: compare latest with immediately preceding attempt
  const previousAttempt = sortedAsc[sortedAsc.length - 2];
  const comparison = computeProgressComparison(latestAttempt, previousAttempt);

  let scoreChangeFormatted = '0 percentage points';
  if (comparison.status === 'improved') {
    scoreChangeFormatted = `+${comparison.diffPoints} percentage points`;
  } else if (comparison.status === 'declined') {
    scoreChangeFormatted = `−${comparison.diffPoints} percentage points`;
  }

  return {
    graphId,
    graphName,
    totalAttempts,
    latestScore,
    previousScore: previousAttempt.scorePercentage,
    diffPoints: comparison.diffPoints,
    scoreChangeFormatted,
    comparisonStatus: comparison.status,
    comparisonMessage: comparison.message,
    latestAttempt,
    previousAttempt,
    chronologicalAttempts,
    hasComparison: true
  };
}

export interface ConceptRevisitItem {
  conceptId: string;
  conceptName: string;
  graphId: string;
  graphName: string;
  totalTimesTested: number;
  timesIncorrect: number;
  timesUnanswered: number;
  missedInLatest: boolean;
  unansweredInLatest: boolean;
  correctInLatest: boolean;
  previouslyMissed: boolean;
  statusMessage: string;
  availableInGraph: boolean;
}

/**
 * Derives concepts worth revisiting across historical assessment attempts.
 * Preserves strict factual accuracy without inferring mastery.
 */
export function deriveConceptsWorthRevisiting(
  attempts: AssessmentAttempt[],
  activeGraph?: KnowledgeGraph | null
): ConceptRevisitItem[] {
  if (!Array.isArray(attempts) || attempts.length === 0) return [];

  // Sort attempts chronological ascending (oldest first)
  const sortedAttempts = [...attempts].sort((a, b) => {
    const timeA = new Date(a.completedAt).getTime() || 0;
    const timeB = new Date(b.completedAt).getTime() || 0;
    return timeA - timeB;
  });

  // Track each concept's appearance across attempts
  interface ConceptTracking {
    conceptId: string;
    conceptName: string;
    graphId: string;
    graphName: string;
    totalTimesTested: number;
    timesIncorrect: number;
    timesUnanswered: number;
    history: {
      attemptId: string;
      completedAt: string;
      isCorrect: boolean;
      isIncorrect: boolean;
      isUnanswered: boolean;
    }[];
  }

  const map = new Map<string, ConceptTracking>();

  for (const att of sortedAttempts) {
    const questions = att.questions || [];
    for (const q of questions) {
      const selectedId = att.userAnswers?.[q.id];
      const isUnanswered = !selectedId || selectedId === '';
      const isCorrect = Boolean(!isUnanswered && selectedId === q.correctOptionId);
      const isIncorrect = Boolean(!isUnanswered && selectedId !== q.correctOptionId);

      const conceptIds = q.conceptIds || [];
      const conceptNames = q.conceptNames || [];

      conceptIds.forEach((cId, idx) => {
        if (!cId) return;
        const cName = conceptNames[idx] || conceptNames[0] || 'Concept';
        const key = cId;

        if (!map.has(key)) {
          map.set(key, {
            conceptId: cId,
            conceptName: cName,
            graphId: att.graphId || '',
            graphName: att.graphName || '',
            totalTimesTested: 0,
            timesIncorrect: 0,
            timesUnanswered: 0,
            history: []
          });
        }

        const entry = map.get(key)!;
        entry.totalTimesTested += 1;
        if (isIncorrect) entry.timesIncorrect += 1;
        if (isUnanswered) entry.timesUnanswered += 1;

        entry.history.push({
          attemptId: att.id,
          completedAt: att.completedAt,
          isCorrect,
          isIncorrect,
          isUnanswered
        });
      });
    }
  }

  const results: ConceptRevisitItem[] = [];

  for (const item of map.values()) {
    // Only concepts with at least one incorrect or unanswered question qualify
    if (item.timesIncorrect === 0 && item.timesUnanswered === 0) {
      continue;
    }

    const history = item.history;
    const latestEvent = history[history.length - 1];
    const previousEvents = history.slice(0, history.length - 1);

    const unansweredInLatest = latestEvent.isUnanswered;
    const missedInLatest = latestEvent.isIncorrect || latestEvent.isUnanswered;
    const correctInLatest = latestEvent.isCorrect;
    const previouslyMissed = previousEvents.some(e => e.isIncorrect || e.isUnanswered);

    let statusMessage: string;
    if (unansweredInLatest) {
      statusMessage = 'Unanswered in the latest assessment.';
    } else if (missedInLatest && item.timesIncorrect > 1) {
      statusMessage = `Answered incorrectly in ${item.timesIncorrect} assessments.`;
    } else if (missedInLatest) {
      statusMessage = 'Missed in the latest assessment.';
    } else if (correctInLatest && previouslyMissed) {
      statusMessage = 'Previously missed; answered correctly in the latest assessment.';
    } else if (item.timesIncorrect > 1) {
      statusMessage = `Answered incorrectly in ${item.timesIncorrect} assessments.`;
    } else if (item.timesUnanswered > 0) {
      statusMessage = `Unanswered in ${item.timesUnanswered} assessment${item.timesUnanswered === 1 ? '' : 's'}.`;
    } else {
      statusMessage = 'Missed in previous assessment.';
    }

    const availableInGraph = Boolean(
      activeGraph?.nodes && Array.isArray(activeGraph.nodes) &&
      activeGraph.nodes.some(node => node.id === item.conceptId || (node.name && node.name.toLowerCase() === item.conceptName.toLowerCase()))
    );

    results.push({
      conceptId: item.conceptId,
      conceptName: item.conceptName,
      graphId: item.graphId,
      graphName: item.graphName,
      totalTimesTested: item.totalTimesTested,
      timesIncorrect: item.timesIncorrect,
      timesUnanswered: item.timesUnanswered,
      missedInLatest,
      unansweredInLatest,
      correctInLatest,
      previouslyMissed,
      statusMessage,
      availableInGraph
    });
  }

  // Sort: missed in latest first, then by times incorrect descending
  return results.sort((a, b) => {
    if (a.missedInLatest && !b.missedInLatest) return -1;
    if (!a.missedInLatest && b.missedInLatest) return 1;
    return b.timesIncorrect - a.timesIncorrect;
  });
}

/**
 * Guarantees a complete TestResultsSummary from an immutable AssessmentAttempt snapshot,
 * reconstructing missed concepts and scores if the original record omitted them.
 */
export function ensureResultsSummary(attempt: AssessmentAttempt): TestResultsSummary {
  if (attempt.resultsSummary && Array.isArray(attempt.resultsSummary.reviewRecommendedConcepts)) {
    return attempt.resultsSummary;
  }

  const questions = attempt.questions || [];
  const missedItems: MissedConceptItem[] = [];
  const strongConceptNamesSet = new Set<string>();

  for (const q of questions) {
    const selectedId = attempt.userAnswers?.[q.id];
    const isCorrect = Boolean(selectedId && selectedId === q.correctOptionId);
    const selectedOption = q.options?.find(o => o.id === selectedId);
    const correctOption = q.options?.find(o => o.id === q.correctOptionId);

    if (isCorrect) {
      for (const name of q.conceptNames || []) {
        strongConceptNamesSet.add(name);
      }
    } else {
      missedItems.push({
        conceptId: q.conceptIds?.[0] || '',
        conceptName: q.conceptNames?.[0] || 'Concept',
        questionId: q.id,
        questionText: q.question,
        selectedOptionText: selectedOption?.text || (selectedId ? selectedId : 'Unanswered'),
        correctOptionText: correctOption?.text || q.correctOptionId || '',
        explanation: q.explanation,
        sourceName: q.sourceName,
        sourceEvidence: q.sourceEvidence,
        page: q.page
      });
    }
  }

  for (const item of missedItems) {
    strongConceptNamesSet.delete(item.conceptName);
  }

  return {
    testId: attempt.testId || attempt.id,
    attemptId: attempt.id,
    score: attempt.correctAnswers,
    totalQuestions: attempt.totalQuestions || questions.length,
    percentage: attempt.scorePercentage,
    timeSpentSeconds: attempt.timeSpentSeconds || 0,
    strongConceptNames: Array.from(strongConceptNamesSet),
    reviewRecommendedConcepts: missedItems,
    persistenceStatus: 'saved'
  };
}

export interface GraphAttemptGroup {
  graphId: string;
  graphName: string;
  totalAttempts: number;
  attempts: AssessmentAttempt[];
  latestAttempt: AssessmentAttempt;
  previousAttempts: AssessmentAttempt[];
  progressComparison?: ScoreComparison;
}

export interface LearningTrajectoryRowProps {
  prog: GraphLearningProgress;
  hoveredPointAttemptId: string | null;
  setHoveredPointAttemptId: (id: string | null) => void;
  selectedAttemptId?: string | null;
  handleOpenAttempt: (attemptId: string) => void;
  shouldReduceMotion: boolean;
  isFirst: boolean;
}

export function LearningTrajectoryRow({
  prog,
  hoveredPointAttemptId,
  setHoveredPointAttemptId,
  selectedAttemptId,
  handleOpenAttempt,
  shouldReduceMotion,
  isFirst
}: LearningTrajectoryRowProps) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const inViewRaw = useInView(rowRef, { once: true, amount: 0.15 });
  void inViewRaw;
  const [rowInView, setRowInView] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof IntersectionObserver === 'undefined' || shouldReduceMotion) {
      setRowInView(true);
      return;
    }

    const scrollContainer = (rowRef.current?.closest('.workspace-viewport') as HTMLElement | null)
      || (document.querySelector('.workspace-viewport') as HTMLElement | null)
      || window;

    const checkVisibility = () => {
      if (!rowRef.current) return false;
      const rect = rowRef.current.getBoundingClientRect();
      // Non-layout test environments
      if (rect.top === 0 && rect.bottom === 0 && rect.height === 0) {
        setRowInView(true);
        return true;
      }

      const containerHeight = scrollContainer instanceof HTMLElement
        ? scrollContainer.clientHeight
        : window.innerHeight;
      const containerTop = scrollContainer instanceof HTMLElement
        ? scrollContainer.getBoundingClientRect().top
        : 0;

      const relativeTop = rect.top - containerTop;
      const scrollTop = scrollContainer instanceof HTMLElement
        ? scrollContainer.scrollTop
        : (window.scrollY || document.documentElement.scrollTop || 0);

      // Check chart visualization block specifically so drawing triggers when the graph is in view
      const chartEl = (rowRef.current.querySelector('.study-trajectory-viz-block') as HTMLElement | null)
        || (rowRef.current.querySelector('.study-trajectory-svg') as HTMLElement | null);
      const chartRect = chartEl ? chartEl.getBoundingClientRect() : rect;
      const chartRelTop = chartRect.top - containerTop;
      const chartRelBottom = chartRect.bottom - containerTop;

      const isMeaningfullyVisible = (chartRelTop < containerHeight * 0.85 && chartRelBottom > 40)
        || (relativeTop < containerHeight * 0.50 && relativeTop > -rect.height + 40);

      if (isMeaningfullyVisible) {
        setRowInView(true);
        return true;
      } else if (scrollTop < 40 || chartRelTop > containerHeight * 1.15) {
        // Reset when user scrolls back to top so it draws itself again on scroll
        setRowInView(false);
        hasAnimatedScoreRef.current = false;
      }
      return false;
    };

    checkVisibility();

    const handleScroll = () => {
      checkVisibility();
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    let observer: IntersectionObserver | null = null;
    try {
      const rootEl = scrollContainer instanceof HTMLElement ? scrollContainer : null;
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (checkVisibility()) {
              observer?.disconnect();
            }
          }
        }
      }, {
        root: rootEl,
        threshold: 0.15
      });
      if (rowRef.current) {
        observer.observe(rowRef.current);
      }
    } catch {
      // Ignore
    }

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
      observer?.disconnect();
    };
  }, [shouldReduceMotion]);

  const [displayedScore, setDisplayedScore] = useState<number>(() => {
    return shouldReduceMotion ? prog.latestScore : 0;
  });
  const hasAnimatedScoreRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);
  const prevTargetScoreRef = useRef(prog.latestScore);

  useEffect(() => {
    if (shouldReduceMotion) {
      setDisplayedScore(prog.latestScore);
      return;
    }

    if (!rowInView) {
      setDisplayedScore(0);
      return;
    }

    // Dynamic data update after initial scroll animation
    if (hasAnimatedScoreRef.current) {
      if (prevTargetScoreRef.current !== prog.latestScore) {
        prevTargetScoreRef.current = prog.latestScore;
        setDisplayedScore(prog.latestScore);
      }
      return;
    }

    hasAnimatedScoreRef.current = true;
    prevTargetScoreRef.current = prog.latestScore;

    // Zero score displays directly without an artificial counting sequence
    if (prog.latestScore === 0) {
      setDisplayedScore(0);
      return;
    }

    const targetScore = prog.latestScore;
    const duration = 1850; // Synchronized with deliberate cinematic trajectory line drawing
    let startTime: number | null = null;

    // Cubic ease-out deceleration curve: accelerates naturally and settles smoothly
    const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

    // Smoothly animate(0, prog.latestScore) via requestAnimationFrame with cubic ease-out deceleration
    const step = (timestamp: number) => {
      if (startTime === null) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(progress);
      const current = Math.min(targetScore, Math.round(eased * targetScore));

      setDisplayedScore(current);

      if (progress < 1) {
        rafIdRef.current = requestAnimationFrame(step);
      } else {
        setDisplayedScore(targetScore);
        rafIdRef.current = null;
      }
    };

    rafIdRef.current = requestAnimationFrame(step);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [rowInView, prog.latestScore, shouldReduceMotion]);

  const [timelineSettled, setTimelineSettled] = useState(false);

  useEffect(() => {
    if (!rowInView) {
      setTimelineSettled(false);
      return;
    }
    const settleTimer = setTimeout(() => {
      setTimelineSettled(true);
    }, 2200);
    return () => clearTimeout(settleTimer);
  }, [rowInView]);

  const isUnchangedOrZero = prog.comparisonStatus === 'unchanged' || (prog.hasComparison && prog.latestScore === 0 && prog.previousScore === 0);
  const scoreDiff = prog.hasComparison && prog.previousScore !== undefined
    ? prog.latestScore - prog.previousScore
    : 0;
  const isImproved = scoreDiff > 0 && !isUnchangedOrZero;
  const isDeclined = scoreDiff < 0;
  const diffStatus = isImproved ? 'improved' : isDeclined ? 'declined' : 'unchanged';
  const diffSymbol = isImproved ? '↑ ' : isDeclined ? '↓ ' : '— ';
  const diffValueFormatted = isImproved
    ? `+${scoreDiff} pp`
    : isDeclined
      ? `−${Math.abs(scoreDiff)} pp`
      : '0 pp';



  const pts = prog.chronologicalAttempts;
  const N = pts.length;
  const X_MIN = 44;
  const X_MAX = 720;
  const Y_MIN = 28;
  const Y_MID = 88;
  const Y_MAX = 148;
  const H = Y_MAX - Y_MIN; // 120

  const availableWidth = X_MAX - X_MIN;
  const step = N <= 1 ? 0 : Math.min(180, availableWidth / (N - 1));
  const coords = useMemo(() => {
    return pts.map((pt, i) => {
      const x = N === 1 ? 76 : X_MIN + i * step;
      const clampedScore = Math.max(0, Math.min(100, Number(pt.scorePercentage) || 0));
      const y = Y_MAX - (clampedScore / 100) * H;
      return {
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        pt,
        index: i
      };
    });
  }, [pts, N, step, H]);

  const pathD = N >= 2 ? coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ') : '';

  // Cinematic trajectory line drawing curve:
  // Deliberate, breathing take-off, steady graceful travel across data points,
  // and an ultra-silky, gradual deceleration into the final resting point.
  const TRAJECTORY_LINE_EASE = [0.32, 0.08, 0.24, 1.0] as const;
  const LINE_DELAY = 0.25;
  const LINE_DURATION = 1.85;

  const { pointArrivalDelays } = useMemo(() => {
    if (coords.length <= 1) {
      return { totalPathLength: 0, pointArrivalDelays: [LINE_DELAY] };
    }

    const dists: number[] = [0];
    let totalLen = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      const dx = coords[i + 1].x - coords[i].x;
      const dy = coords[i + 1].y - coords[i].y;
      const d = Math.hypot(dx, dy);
      totalLen += d;
      dists.push(totalLen);
    }

    // Inverts cubic-bezier(x1, y1, x2, y2) to find normalized time fraction `t` for a given path progress
    const solveBezierTime = (progressFrac: number, x1 = 0.32, y1 = 0.08, x2 = 0.24, y2 = 1.0) => {
      if (progressFrac <= 0) return 0;
      if (progressFrac >= 1) return 1;
      let low = 0;
      let high = 1;
      for (let it = 0; it < 20; it++) {
        const mid = (low + high) / 2;
        const y = 3 * (1 - mid) * (1 - mid) * mid * y1 + 3 * (1 - mid) * mid * mid * y2 + mid * mid * mid;
        if (y < progressFrac) low = mid; else high = mid;
      }
      const u = (low + high) / 2;
      return 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u;
    };

    const delays = dists.map((dist) => {
      const rawFrac = totalLen > 0 ? dist / totalLen : 0;
      const timeFrac = solveBezierTime(rawFrac);
      return Math.round((LINE_DELAY + timeFrac * LINE_DURATION) * 1000) / 1000;
    });

    return { totalPathLength: Math.round(totalLen * 10) / 10, pointArrivalDelays: delays };
  }, [coords]);

  // Deterministic collision avoidance for score labels (stable across hover interactions)
  const visibleLabels = useMemo(() => {
    const visible = new Set<string>();
    if (N === 0) return visible;

    const latest = coords[N - 1];
    if (latest) {
      visible.add(latest.pt.attemptId);
    }

    if (N <= 6) {
      coords.forEach(c => visible.add(c.pt.attemptId));
      return visible;
    }

    const first = coords[0];
    if (first) {
      visible.add(first.pt.attemptId);
    }

    const MIN_DIST = 52;
    const placedX: number[] = [];
    coords.forEach(c => {
      if (visible.has(c.pt.attemptId)) placedX.push(c.x);
    });

    coords.forEach(c => {
      if (visible.has(c.pt.attemptId)) return;
      const isColliding = placedX.some(px => Math.abs(px - c.x) < MIN_DIST);
      if (!isColliding) {
        visible.add(c.pt.attemptId);
        placedX.push(c.x);
      }
    });

    return visible;
  }, [coords, N]);

  const activePointCoord = useMemo(() => {
    return hoveredPointAttemptId ? coords.find(c => c.pt.attemptId === hoveredPointAttemptId) : null;
  }, [coords, hoveredPointAttemptId]);

  // Persistent reference to the last inspected coordinate for smooth gliding transitions without unmounting
  const [displayedTooltipPoint, setDisplayedTooltipPoint] = useState<typeof coords[0] | null>(() => {
    return coords.length > 0 ? coords[coords.length - 1] : null;
  });

  const [isTooltipActive, setIsTooltipActive] = useState(false);
  const activeDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (activePointCoord) {
      if (activeDebounceTimerRef.current) {
        clearTimeout(activeDebounceTimerRef.current);
        activeDebounceTimerRef.current = null;
      }
      setDisplayedTooltipPoint(activePointCoord);
      setIsTooltipActive(true);
    } else {
      activeDebounceTimerRef.current = setTimeout(() => {
        setIsTooltipActive(false);
      }, 75);
    }
    return () => {
      if (activeDebounceTimerRef.current) {
        clearTimeout(activeDebounceTimerRef.current);
      }
    };
  }, [activePointCoord]);

  const chartShellRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const isFirstEntryRef = useRef(true);
  const [isFirstEntry, setIsFirstEntry] = useState(true);
  const hoveredPointAttemptIdRef = useRef<string | null>(hoveredPointAttemptId);
  const leaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    hoveredPointAttemptIdRef.current = hoveredPointAttemptId;
  }, [hoveredPointAttemptId]);

  useEffect(() => {
    return () => {
      if (leaveTimerRef.current) {
        clearTimeout(leaveTimerRef.current);
      }
    };
  }, []);

  const [shellDims, setShellDims] = useState<{ width: number; height: number }>({ width: 760, height: 180 });
  const [tooltipDims, setTooltipDims] = useState<{ width: number; height: number }>({ width: 126, height: 46 });

  useEffect(() => {
    const el = chartShellRef.current;
    if (!el) return;
    const updateDims = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setShellDims({ width: rect.width, height: rect.height });
      }
    };
    updateDims();
    const ro = new ResizeObserver(updateDims);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const tip = tooltipRef.current;
    if (!tip) return;
    const rect = tip.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      setTooltipDims({ width: rect.width, height: rect.height });
    }
  }, [displayedTooltipPoint]);

  useEffect(() => {
    if (isTooltipActive) {
      if (isFirstEntryRef.current) {
        const frame = requestAnimationFrame(() => {
          isFirstEntryRef.current = false;
          setIsFirstEntry(false);
        });
        return () => cancelAnimationFrame(frame);
      }
    } else {
      const timer = setTimeout(() => {
        isFirstEntryRef.current = true;
        setIsFirstEntry(true);
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [isTooltipActive]);

  const targetPos = useMemo(() => {
    if (!displayedTooltipPoint) {
      return { x: 0, y: 0 };
    }
    const shellWidth = shellDims.width;
    const shellHeight = shellDims.height;
    const tipWidth = tooltipDims.width;
    const tipHeight = tooltipDims.height;

    // Convert SVG coordinates (0..760, 0..180) to pixel position within chart shell
    const px = (displayedTooltipPoint.x / 760) * shellWidth;
    const py = (displayedTooltipPoint.y / 180) * shellHeight;

    const PADDING_X = 8;
    const PADDING_Y = 6;
    const GAP = 12;

    // Center horizontally over point and clamp to avoid chart edge clipping
    const idealX = px - tipWidth / 2;
    const clampedX = Math.max(PADDING_X, Math.min(shellWidth - tipWidth - PADDING_X, idealX));

    // Determine vertical placement: above by default, or below if near top boundary
    const idealY = py - tipHeight - GAP;
    let clampedY: number;
    if (idealY < PADDING_Y) {
      clampedY = py + GAP;
    } else {
      clampedY = idealY;
    }
    clampedY = Math.max(PADDING_Y, Math.min(shellHeight - tipHeight - PADDING_Y, clampedY));

    return {
      x: Math.round(clampedX * 10) / 10,
      y: Math.round(clampedY * 10) / 10
    };
  }, [displayedTooltipPoint, shellDims, tooltipDims]);

  const handleChartPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement | SVGSVGElement>) => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    if (coords.length === 0) return;
    const shellEl = chartShellRef.current;
    if (!shellEl) return;

    const rect = shellEl.getBoundingClientRect();
    if (rect.width <= 0) return;

    // Convert mouse clientX to SVG viewBox coordinate system (0..760)
    const relX = e.clientX - rect.left;
    const svgX = (relX / rect.width) * 760;

    const currentId = hoveredPointAttemptIdRef.current;
    const currentIdx = currentId ? coords.findIndex(c => c.pt.attemptId === currentId) : -1;

    // Find mathematically closest point to svgX
    let closestIdx = 0;
    let minDiff = Math.abs(coords[0].x - svgX);
    for (let i = 1; i < coords.length; i++) {
      const diff = Math.abs(coords[i].x - svgX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }

    if (currentIdx === -1) {
      // First pointer entry into the chart interaction region
      const targetPoint = coords[closestIdx];
      hoveredPointAttemptIdRef.current = targetPoint.pt.attemptId;
      setHoveredPointAttemptId(targetPoint.pt.attemptId);
      setDisplayedTooltipPoint(targetPoint);
      setIsTooltipActive(true);
      return;
    }

    if (closestIdx === currentIdx) {
      return;
    }

    // Apply hysteresis deadband around the boundary between adjacent points
    // to prevent rapid flickering / toggling when pointer pauses near midpoints.
    const currentPt = coords[currentIdx];

    if (closestIdx > currentIdx) {
      const nextPt = coords[currentIdx + 1];
      const dist = nextPt.x - currentPt.x;
      const hysteresis = Math.min(12, dist * 0.15);
      const midpoint = (currentPt.x + nextPt.x) / 2;

      if (svgX > midpoint + hysteresis) {
        const targetPoint = coords[closestIdx];
        hoveredPointAttemptIdRef.current = targetPoint.pt.attemptId;
        setHoveredPointAttemptId(targetPoint.pt.attemptId);
        setDisplayedTooltipPoint(targetPoint);
        setIsTooltipActive(true);
      }
    } else if (closestIdx < currentIdx) {
      const prevPt = coords[currentIdx - 1];
      const dist = currentPt.x - prevPt.x;
      const hysteresis = Math.min(12, dist * 0.15);
      const midpoint = (prevPt.x + currentPt.x) / 2;

      if (svgX < midpoint - hysteresis) {
        const targetPoint = coords[closestIdx];
        hoveredPointAttemptIdRef.current = targetPoint.pt.attemptId;
        setHoveredPointAttemptId(targetPoint.pt.attemptId);
        setDisplayedTooltipPoint(targetPoint);
        setIsTooltipActive(true);
      }
    }
  }, [coords, setHoveredPointAttemptId]);

  const handleChartPointerLeave = useCallback(() => {
    if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
    leaveTimerRef.current = setTimeout(() => {
      hoveredPointAttemptIdRef.current = null;
      setHoveredPointAttemptId(null);
    }, 75);
  }, [setHoveredPointAttemptId]);

  const handleTimelinePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (leaveTimerRef.current) {
      clearTimeout(leaveTimerRef.current);
      leaveTimerRef.current = null;
    }
    const container = e.currentTarget;
    const buttons = container.querySelectorAll<HTMLButtonElement>('.study-trajectory-timeline-col');
    if (!buttons.length) return;

    const mouseX = e.clientX;
    let closestIdx = 0;
    let minDiff = Infinity;

    buttons.forEach((btn, idx) => {
      const rect = btn.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const diff = Math.abs(centerX - mouseX);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });

    const targetPt = prog.chronologicalAttempts[closestIdx];
    if (targetPt && targetPt.attemptId !== hoveredPointAttemptIdRef.current) {
      hoveredPointAttemptIdRef.current = targetPt.attemptId;
      setHoveredPointAttemptId(targetPt.attemptId);
      const targetCoord = coords.find(c => c.pt.attemptId === targetPt.attemptId);
      if (targetCoord) {
        setDisplayedTooltipPoint(targetCoord);
      }
      setIsTooltipActive(true);
    }
  }, [coords, prog.chronologicalAttempts, setHoveredPointAttemptId]);

  return (
    <motion.div
      ref={rowRef}
      className={`study-progress-card study-trajectory-row ${isFirst ? 'study-trajectory-primary' : ''}`}
      initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
      animate={rowInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.45, ease: REVEAL_EASE }}
    >
      {/* AREA A — Graph Identity & Current Performance */}
      <div className="study-progress-card-header study-trajectory-header">
        <div className="study-progress-card-title-wrap study-trajectory-identity">
          <span className="study-progress-kicker study-trajectory-kicker">KNOWLEDGE GRAPH</span>
          <h3 className="study-progress-graph-name study-trajectory-graph-name">{prog.graphName}</h3>
          <motion.span
            className="study-progress-attempts-count study-trajectory-attempts-count"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
            animate={rowInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.36, delay: 0.16, ease: REVEAL_EASE }}
          >
            {prog.totalAttempts} completed {prog.totalAttempts === 1 ? 'attempt' : 'attempts'}
          </motion.span>
        </div>

        <div className="study-trajectory-perf">
          <div className="study-trajectory-latest-stat">
            <span className="study-trajectory-perf-lbl">Latest result</span>
            <div className="study-trajectory-score-row">
              <span className="study-progress-metric-val study-trajectory-score-val">{displayedScore}%</span>
            </div>
            {prog.hasComparison && prog.previousScore !== undefined ? (
              <motion.div
                className={`study-trajectory-inline-diff study-progress-badge study-progress-comparison ${diffStatus}`}
                title={isUnchangedOrZero ? '0 percentage points' : prog.scoreChangeFormatted}
                aria-label={`${diffValueFormatted} vs. previous attempt`}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                animate={rowInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.38, delay: LINE_DELAY + LINE_DURATION * 0.9, ease: REVEAL_EASE }}
              >
                <span className="study-trajectory-diff-val">
                  <span className="study-progress-badge-symbol study-trajectory-diff-arrow" aria-hidden="true">
                    {diffSymbol}
                  </span>
                  <span>{diffValueFormatted}</span>
                </span>
                <span className="study-trajectory-diff-context">vs. previous attempt</span>
              </motion.div>
            ) : (
              <span className="study-trajectory-single-hint">
                Complete another assessment to see your progress.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* AREA B — Score Trajectory Visualization */}
      <div className="study-trajectory-viz-block">
        <div
          ref={chartShellRef}
          className="study-progress-svg-wrap study-trajectory-chart-shell"
          onPointerMove={handleChartPointerMove}
          onPointerLeave={handleChartPointerLeave}
        >
          {/* Enhanced from legacy viewBox="0 0 540 80" strokeDasharray="3 3" to responsive 760 180 solid hairline scale */}
          <svg
            viewBox="0 0 760 180"
            className="study-progress-svg study-trajectory-svg"
            preserveAspectRatio="none"
            aria-label={`Score trajectory chart for ${prog.graphName}`}
          >
            {/* PHASE 2 — Reference grid lines at 100%, 50%, 0% */}
            <motion.g
              className="study-trajectory-reference-grid"
              initial={shouldReduceMotion ? false : { opacity: 0 }}
              animate={rowInView ? { opacity: 1 } : { opacity: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.35, delay: 0.12, ease: REVEAL_EASE }}
            >
              <line
                x1={X_MIN}
                y1={Y_MIN}
                x2={X_MAX}
                y2={Y_MIN}
                className="study-trajectory-grid-line line-100"
                stroke="rgba(255, 255, 255, 0.035)"
                strokeWidth="1"
              />
              <text
                x={X_MIN - 10}
                y={Y_MIN + 3}
                textAnchor="end"
                fill="#555555"
                fontSize="9"
                fontFamily="var(--font-mono, monospace)"
                className="study-trajectory-axis-lbl"
              >
                100%
              </text>

              <line
                x1={X_MIN}
                y1={Y_MID}
                x2={X_MAX}
                y2={Y_MID}
                className="study-trajectory-grid-line line-50"
                stroke="rgba(255, 255, 255, 0.025)"
                strokeWidth="1"
              />
              <text
                x={X_MIN - 10}
                y={Y_MID + 3}
                textAnchor="end"
                fill="#444444"
                fontSize="9"
                fontFamily="var(--font-mono, monospace)"
                className="study-trajectory-axis-lbl"
              >
                50%
              </text>

              <line
                x1={X_MIN}
                y1={Y_MAX}
                x2={X_MAX}
                y2={Y_MAX}
                className="study-trajectory-grid-line line-0"
                stroke="rgba(255, 255, 255, 0.07)"
                strokeWidth="1.25"
              />
              <text
                x={X_MIN - 10}
                y={Y_MAX + 3}
                textAnchor="end"
                fill="#555555"
                fontSize="9"
                fontFamily="var(--font-mono, monospace)"
                className="study-trajectory-axis-lbl"
              >
                0%
              </text>
            </motion.g>

            {/* PHASE 3 — Trajectory Drawing Line & Ambient Glow */}
            {N >= 2 && pathD && (
              <>
                {/* Cinematic ambient glow trail that traces and illuminates the curve */}
                <motion.path
                  key={`glow-${pathD}`}
                  d={pathD}
                  fill="none"
                  className="study-trajectory-line-glow"
                  stroke="var(--accent, #A3FF12)"
                  strokeWidth="5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={shouldReduceMotion ? { pathLength: 1, opacity: 0.16 } : { pathLength: 0, opacity: 0 }}
                  animate={rowInView ? { pathLength: 1, opacity: 0.16 } : { pathLength: 0, opacity: 0 }}
                  transition={shouldReduceMotion ? { duration: 0 } : {
                    pathLength: { duration: LINE_DURATION, delay: LINE_DELAY, ease: TRAJECTORY_LINE_EASE },
                    opacity: { duration: 0.25, delay: LINE_DELAY }
                  }}
                />
                {/* Crisp hairline trajectory stroke */}
                <motion.path
                  key={pathD}
                  d={pathD}
                  fill="none"
                  className="study-trajectory-line"
                  stroke="var(--accent, #A3FF12)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={shouldReduceMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                  animate={rowInView ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                  transition={shouldReduceMotion ? { duration: 0 } : {
                    pathLength: { duration: LINE_DURATION, delay: LINE_DELAY, ease: TRAJECTORY_LINE_EASE },
                    opacity: { duration: 0.15, delay: LINE_DELAY }
                  }}
                />
              </>
            )}

            {/* Transparent shared interaction layer covering full plotting area */}
            <rect
              x={0}
              y={0}
              width={760}
              height={180}
              fill="transparent"
              className="study-trajectory-interaction-layer"
              style={{ pointerEvents: 'all', cursor: 'pointer' }}
              onClick={() => {
                if (activePointCoord) {
                  handleOpenAttempt(activePointCoord.pt.attemptId);
                }
              }}
            />

            {/* PHASE 4 & 5 — Interactive Data Points and Score Labels */}
            {coords.map((c, idx) => {
              const isHovered = hoveredPointAttemptId === c.pt.attemptId;
              const isLatest = idx === N - 1;
              const hasAnyHovered = hoveredPointAttemptId !== null;
              const isDimmed = hasAnyHovered && !isHovered;
              const showLabel = visibleLabels.has(c.pt.attemptId) || isHovered;
              const arrivalDelay = pointArrivalDelays[idx] ?? (LINE_DELAY + idx * 0.1);
              const labelDelay = arrivalDelay;
              void labelDelay;

              return (
                <motion.g
                  key={c.pt.attemptId}
                  className={`study-svg-point-node study-trajectory-node ${isHovered ? 'hovered active' : ''} ${isLatest ? 'latest' : ''} ${isDimmed ? 'dimmed' : ''}`}
                  tabIndex={0}
                  role="button"
                  aria-label={`${c.pt.attemptNumber}: ${c.pt.scorePercentage}% on ${c.pt.dateStr}`}
                  onClick={() => handleOpenAttempt(c.pt.attemptId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleOpenAttempt(c.pt.attemptId);
                    }
                  }}
                  onMouseEnter={() => setHoveredPointAttemptId(c.pt.attemptId)}
                  onFocus={() => setHoveredPointAttemptId(c.pt.attemptId)}
                  onBlur={() => setHoveredPointAttemptId(null)}
                  initial={shouldReduceMotion ? false : { scale: 0.35, opacity: 0 }}
                  animate={rowInView ? { scale: 1, opacity: 1 } : { scale: 0.35, opacity: 0 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.28, delay: arrivalDelay, ease: [0.16, 1, 0.3, 1] }}
                >
                  {/* Generous invisible hit target for effortless pointer and touch interaction */}
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r="16"
                    fill="transparent"
                    stroke="none"
                    className="study-trajectory-hit-target"
                  />

                  {/* Subtle outer halo on hovered point */}
                  {isHovered && (
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r="9.5"
                      fill="none"
                      stroke="var(--accent, #A3FF12)"
                      strokeWidth="1"
                      strokeOpacity="0.32"
                      className="study-trajectory-point-halo"
                    />
                  )}

                  {/* Refined static concentric indicator on latest point (coexists when not hovered) */}
                  {isLatest && !isHovered && (
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r="8"
                      fill="none"
                      stroke="var(--accent, #A3FF12)"
                      strokeWidth="1"
                      strokeOpacity="0.28"
                      className="study-trajectory-latest-ring"
                    />
                  )}

                  {/* Clean circular point marker */}
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={isHovered ? 5 : isLatest ? 4.5 : 3.5}
                    fill="#0D0D0D"
                    stroke={isHovered || isLatest ? 'var(--accent, #A3FF12)' : 'rgba(163, 255, 18, 0.65)'}
                    strokeWidth={isHovered ? 2 : isLatest ? 1.75 : 1.25}
                    className="study-trajectory-point"
                  />

                  {showLabel && (
                    <text
                      x={c.x}
                      y={c.y < 42 ? c.y + 14 : c.y - 9}
                      textAnchor={c.x < X_MIN + 20 ? 'start' : c.x > X_MAX - 20 ? 'end' : 'middle'}
                      fill={isHovered ? '#FFFFFF' : isLatest ? 'var(--text-primary, #F5F5F5)' : '#888888'}
                      fontSize={isHovered ? '10' : isLatest ? '9.5' : '9'}
                      fontWeight={isHovered ? '600' : '500'}
                      fontFamily="var(--font-mono, monospace)"
                      className={`study-trajectory-point-lbl ${isHovered ? 'highlight' : ''}`}
                    >
                      {c.pt.scorePercentage}%
                    </text>
                  )}
                </motion.g>
              );
            })}
          </svg>

          {/* Continuous floating tooltip with smooth gliding spring motion */}
          {displayedTooltipPoint && (
            <motion.div
              ref={tooltipRef}
              className={`study-trajectory-tooltip ${isTooltipActive ? 'visible' : ''}`}
              role="tooltip"
              aria-hidden={!isTooltipActive}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                zIndex: 20,
                pointerEvents: 'none',
                willChange: 'transform, opacity'
              }}
              transformTemplate={({ x, y }) => `translate3d(${x}, ${y}, 0)`}
              animate={{
                x: targetPos.x,
                y: targetPos.y + (isTooltipActive ? 0 : 4),
                opacity: isTooltipActive ? 1 : 0
              }}
              transition={{
                x: shouldReduceMotion
                  ? { duration: 0 }
                  : isFirstEntry
                    ? { duration: 0 }
                    : { type: 'spring', stiffness: 320, damping: 32, mass: 0.8 },
                y: shouldReduceMotion
                  ? { duration: 0 }
                  : isFirstEntry
                    ? { duration: 0.22, ease: [0.16, 1, 0.3, 1] }
                    : { type: 'spring', stiffness: 320, damping: 32, mass: 0.8 },
                opacity: shouldReduceMotion
                  ? { duration: 0 }
                  : isTooltipActive
                    ? { duration: 0.18, ease: 'easeOut' }
                    : { duration: 0.14, ease: 'easeIn' }
              }}
            >
              <div className="study-trajectory-tooltip-header study-trajectory-tooltip-row">
                <span className="study-trajectory-tooltip-num study-trajectory-tooltip-attempt">
                  {displayedTooltipPoint.pt.attemptNumber}
                </span>
                <span className="study-trajectory-tooltip-score">
                  {displayedTooltipPoint.pt.scorePercentage}%
                </span>
              </div>
              {displayedTooltipPoint.pt.dateStr && (
                <div className="study-trajectory-tooltip-date">
                  {displayedTooltipPoint.pt.dateStr}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </div>

      {/* AREA C — Minimalist Historical Attempt Timeline */}
      <div className="study-progress-history-strip study-trajectory-strip">
        <span className="sr-only study-progress-strip-label">Score history:</span>
        <div
          className={`study-progress-chips-wrap study-trajectory-chips-wrap study-trajectory-timeline ${
            hoveredPointAttemptId !== null ? 'has-hover' : ''
          } ${timelineSettled ? 'settled' : ''}`}
          role="list"
          aria-label="Chronological assessment attempt timeline"
          onPointerMove={handleTimelinePointerMove}
          onMouseLeave={() => setHoveredPointAttemptId(null)}
        >
          {prog.chronologicalAttempts.map((pt, pIdx) => {
            const isInspected = hoveredPointAttemptId === pt.attemptId;
            const isSelected = selectedAttemptId === pt.attemptId;
            const hasAnyHovered = hoveredPointAttemptId !== null;
            const isDimmed = hasAnyHovered && !isInspected;
            const isLatest = pIdx === N - 1;
            const timelineStart = Math.round((LINE_DELAY + (N <= 1 ? 0.08 : LINE_DURATION * 0.72)) * 100) / 100;
            const arrivalDelay = pointArrivalDelays[pIdx] ?? (LINE_DELAY + pIdx * 0.1);
            void arrivalDelay;
            const colDelay = shouldReduceMotion
              ? 0
              : Math.round((timelineStart + pIdx * 0.045) * 1000) / 1000;

            return (
              <motion.button
                key={pt.attemptId}
                type="button"
                className={`study-progress-chip study-trajectory-chip study-trajectory-timeline-col ${
                  isInspected ? 'inspected active' : ''
                } ${isSelected ? 'selected' : ''} ${isDimmed ? 'dimmed' : ''} ${isLatest ? 'latest' : ''}`}
                onClick={() => handleOpenAttempt(pt.attemptId)}
                onMouseEnter={() => setHoveredPointAttemptId(pt.attemptId)}
                onFocus={() => setHoveredPointAttemptId(pt.attemptId)}
                onBlur={() => setHoveredPointAttemptId(null)}
                aria-label={`Attempt ${pad(pIdx + 1)}: ${pt.scorePercentage}% on ${pt.dateStr}. Select to review historical results.`}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                animate={rowInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.28, delay: colDelay, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="study-trajectory-col-top">
                  <span className="study-progress-chip-name study-trajectory-chip-num study-trajectory-col-num">
                    {pad(pIdx + 1)}
                  </span>
                  <span className="study-progress-chip-arrow study-trajectory-chip-arrow sr-only" aria-hidden="true">→</span>
                </div>
                <span className="study-progress-chip-score study-trajectory-chip-score study-trajectory-col-score">
                  {pt.scorePercentage}%
                </span>
                <span className="study-progress-chip-date study-trajectory-chip-date study-trajectory-col-date">
                  {pt.dateStr}
                </span>
                {(isSelected || isInspected) && (
                  <span className={`study-trajectory-active-pip ${isSelected ? 'selected' : 'inspected'}`} aria-hidden="true" />
                )}
              </motion.button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

export interface KnowledgeGraphOption {
  id: string;
  name: string;
  totalAssessments: number;
  latestScore: number | null;
  latestCompletedAt?: string;
}

export interface StudyGraphSelectorProps {
  availableGraphs: KnowledgeGraphOption[];
  selectedGraphId: string | null;
  onSelectGraph: (graphId: string) => void;
  onNavigateToAllGraphs?: () => void;
  shouldReduceMotion?: boolean;
}

function SelectorChevronDown({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="10"
      height="6"
      viewBox="0 0 10 6"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M1 1.25L5 4.75L9 1.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function StudyGraphSelector({
  availableGraphs,
  selectedGraphId,
  onSelectGraph,
  onNavigateToAllGraphs,
  shouldReduceMotion = false
}: StudyGraphSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedGraph = useMemo(() => {
    return availableGraphs.find(g => g.id === selectedGraphId) || availableGraphs[0] || null;
  }, [availableGraphs, selectedGraphId]);

  // Filter graphs by name
  const filteredGraphs = useMemo(() => {
    if (!searchQuery.trim()) return availableGraphs;
    const q = searchQuery.toLowerCase().trim();
    return availableGraphs.filter(g => g.name.toLowerCase().includes(q));
  }, [availableGraphs, searchQuery]);

  // Reset highlight index when filtered list changes
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredGraphs]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setSearchQuery('');
      setIsSearchFocused(false);
    }
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isOpen]);

  // Close on Escape & keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      return;
    }

    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % Math.max(1, filteredGraphs.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + filteredGraphs.length) % Math.max(1, filteredGraphs.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredGraphs[highlightedIndex]) {
        onSelectGraph(filteredGraphs[highlightedIndex].id);
        setIsOpen(false);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="study-graph-selector-container"
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        id="study-graph-selector-trigger"
        className={`study-graph-selector-trigger ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen(prev => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls="study-graph-selector-listbox"
        aria-label={`Knowledge graph: ${selectedGraph?.name || 'Select graph'}. Click to choose knowledge graph.`}
      >
        <span className="study-graph-selector-pip-slot" aria-hidden="true">
          <span key={selectedGraph?.id || 'none'} className="study-graph-selector-pip" />
        </span>
        <span className="study-graph-selector-name">
          {selectedGraph?.name || 'Select knowledge graph'}
        </span>
        <span className="study-graph-selector-chevron-slot" aria-hidden="true">
          <SelectorChevronDown
            className={`study-graph-selector-chevron ${isOpen ? 'open' : ''}`}
          />
        </span>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="study-graph-selector-popover"
            className="study-graph-selector-popover"
            role="dialog"
            aria-label="Select knowledge graph"
            initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
            animate={{ 
              opacity: 1, 
              y: 0,
              transition: shouldReduceMotion ? { duration: 0 } : { duration: 0.20, ease: REVEAL_EASE }
            }}
            exit={shouldReduceMotion ? undefined : { 
              opacity: 0, 
              y: -4,
              transition: { duration: 0.15, ease: 'easeOut' }
            }}
          >
            <div className="study-graph-selector-popover-header">
              <span className="study-graph-selector-popover-kicker">KNOWLEDGE GRAPHS</span>
              <span className="study-graph-selector-popover-count">
                {availableGraphs.length} {availableGraphs.length === 1 ? 'GRAPH' : 'GRAPHS'}
              </span>
            </div>

            <motion.div 
              className="study-graph-selector-search-box"
              initial={shouldReduceMotion ? false : { opacity: 0, y: -2 }}
              animate={{ opacity: 1, y: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.20, delay: 0.04, ease: REVEAL_EASE }}
            >
              <div
                className={`study-graph-selector-search-control ${isSearchFocused ? 'focused' : ''} ${searchQuery ? 'has-query' : ''}`}
                onClick={() => searchInputRef.current?.focus()}
              >
                <Search
                  size={13}
                  strokeWidth={1.4}
                  className="study-graph-selector-search-icon"
                  aria-hidden="true"
                />
                <input
                  ref={searchInputRef}
                  type="text"
                  className="study-graph-selector-search-input"
                  placeholder="Search knowledge graphs…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  aria-label="Filter knowledge graphs by name"
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="study-graph-selector-search-clear"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    aria-label="Clear search"
                  >
                    <X size={12} />
                  </button>
                )}
                <div className="study-graph-selector-search-focus-line" aria-hidden="true" />
              </div>
            </motion.div>

            <div
              id="study-graph-selector-listbox"
              role="listbox"
              className="study-graph-selector-list"
              aria-label="Available knowledge graphs"
            >
              {filteredGraphs.map((g, idx) => {
                const isSelected = g.id === selectedGraph?.id;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <motion.button
                    key={g.id}
                    type="button"
                    role="option"
                    id={`graph-opt-${g.id}`}
                    aria-selected={isSelected}
                    className={`study-graph-selector-option ${isSelected ? 'is-selected' : ''} ${isHighlighted ? 'is-highlighted' : ''}`}
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={shouldReduceMotion ? { duration: 0 } : { 
                      duration: 0.20, 
                      delay: Math.min(0.18, 0.05 + idx * 0.03), 
                      ease: REVEAL_EASE 
                    }}
                    onClick={() => {
                      onSelectGraph(g.id);
                      setIsOpen(false);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                  >
                    <div className="study-graph-selector-option-main">
                      <span className="study-graph-selector-option-pip-wrap" aria-hidden="true">
                        {isSelected ? (
                          <span className="study-graph-selector-option-pip" />
                        ) : (
                          <span className="study-graph-selector-option-pip-placeholder" />
                        )}
                      </span>
                      <div className="study-graph-selector-option-info">
                        <span className="study-graph-selector-option-title">{g.name}</span>
                        <span className="study-graph-selector-option-meta">
                          {g.totalAssessments > 0
                            ? `${g.totalAssessments} ${g.totalAssessments === 1 ? 'assessment' : 'assessments'}`
                            : 'No assessments yet'}
                        </span>
                      </div>
                    </div>
                    {g.latestScore !== null && (
                      <span className={`study-graph-selector-option-score ${isSelected ? 'is-selected' : ''}`}>
                        {g.latestScore}%
                      </span>
                    )}
                  </motion.button>
                );
              })}

              {availableGraphs.length === 0 ? (
                <motion.div
                  className="study-graph-selector-empty-search"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.20, ease: REVEAL_EASE }}
                >
                  <span className="study-graph-selector-empty-title">No graphs yet</span>
                  <span className="study-graph-selector-empty-subtitle">Create a knowledge graph to start learning.</span>
                </motion.div>
              ) : filteredGraphs.length === 0 ? (
                <motion.div
                  className="study-graph-selector-empty-search"
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.20, ease: REVEAL_EASE }}
                >
                  <span className="study-graph-selector-empty-title">No graphs found</span>
                  <span className="study-graph-selector-empty-subtitle">Try another search.</span>
                  <button
                    type="button"
                    className="study-graph-selector-empty-clear"
                    onClick={() => {
                      setSearchQuery('');
                      searchInputRef.current?.focus();
                    }}
                    aria-label="Clear search"
                  >
                    <span>Clear search</span>
                    <span className="study-graph-selector-empty-arrow" aria-hidden="true">→</span>
                  </button>
                </motion.div>
              ) : null}
            </div>

            {onNavigateToAllGraphs && (
              <div className="study-graph-selector-footer">
                <button
                  type="button"
                  className="study-graph-selector-footer-action"
                  onClick={() => {
                    setIsOpen(false);
                    onNavigateToAllGraphs();
                  }}
                  aria-label="Explore knowledge graphs"
                >
                  <span>EXPLORE ALL GRAPHS</span>
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function StudySpaceView({
  onNavigateToGraph,
  onNavigateToConcept,
  onNavigateToRevision,
  activeGraph,
  initialAttemptId
}: StudySpaceViewProps) {
  const shouldReduceMotion = useReducedMotion();

  const [attempts, setAttempts] = useState<AssessmentAttempt[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search & Filtering controls
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<StudyFilterMode>('all');


  // View state: 'list' | 'historical-results' | 'review-answers' | 'review-missed'
  const [viewMode, setViewMode] = useState<StudyViewMode>('list');
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);

  // Context-aware and storage-aware knowledge graph options
  const graphContext = useOptionalGraph();
  const contextGraphs = graphContext?.graphs;

  // Build complete list of available knowledge graphs
  const availableGraphs = useMemo<KnowledgeGraphOption[]>(() => {
    const map = new Map<string, { id: string; name: string }>();

    if (contextGraphs && contextGraphs.length > 0) {
      contextGraphs.forEach(g => {
        map.set(g.id, { id: g.id, name: g.name });
      });
    }

    if (map.size === 0) {
      try {
        const stored = loadGraphs();
        if (stored && stored.length > 0) {
          stored.forEach(g => {
            map.set(g.id, { id: g.id, name: g.name });
          });
        }
      } catch {
        // In unit test or non-browser environment
      }
    }

    if (activeGraph?.id && !map.has(activeGraph.id)) {
      map.set(activeGraph.id, { id: activeGraph.id, name: activeGraph.name || 'Knowledge Graph' });
    }

    for (const a of attempts) {
      const gid = a.graphId || `unassigned-${a.id}`;
      if (!map.has(gid)) {
        map.set(gid, { id: gid, name: a.graphName || 'Assessment' });
      }
    }

    if (map.size === 0) return [];

    const list: KnowledgeGraphOption[] = [];
    for (const [id, meta] of map.entries()) {
      const gAttempts = attempts.filter(a => (a.graphId || `unassigned-${a.id}`) === id);
      const totalAssessments = gAttempts.length;

      let latestScore: number | null = null;
      let latestCompletedAt: string | undefined = undefined;

      if (totalAssessments > 0) {
        const sorted = [...gAttempts].sort((a, b) => {
          return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
        });
        latestScore = sorted[0].scorePercentage;
        latestCompletedAt = sorted[0].completedAt;
      }

      list.push({
        id,
        name: meta.name,
        totalAssessments,
        latestScore,
        latestCompletedAt
      });
    }

    return list.sort((a, b) => {
      if (a.latestCompletedAt && b.latestCompletedAt) {
        return new Date(b.latestCompletedAt).getTime() - new Date(a.latestCompletedAt).getTime();
      }
      if (a.latestCompletedAt) return -1;
      if (b.latestCompletedAt) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [contextGraphs, activeGraph, attempts]);

  const [selectedGraphId, setSelectedGraphId] = useState<string | null>(() => {
    if (activeGraph?.id) return activeGraph.id;
    if (graphContext?.activeGraphId) return graphContext.activeGraphId;
    try {
      const stored = loadActiveGraphId();
      if (stored) return stored;
    } catch {}
    return null;
  });

  // Effective selected graph ID (self-healing if selected graph is deleted or not in list)
  const effectiveSelectedGraphId = useMemo<string | null>(() => {
    if (availableGraphs.length === 0) return null;
    if (selectedGraphId && availableGraphs.some(g => g.id === selectedGraphId)) {
      return selectedGraphId;
    }
    if (activeGraph?.id && availableGraphs.some(g => g.id === activeGraph.id)) {
      return activeGraph.id;
    }
    if (graphContext?.activeGraphId && availableGraphs.some(g => g.id === graphContext.activeGraphId)) {
      return graphContext.activeGraphId;
    }
    return availableGraphs[0].id;
  }, [availableGraphs, selectedGraphId, activeGraph?.id, graphContext?.activeGraphId]);

  const handleSelectGraph = useCallback((graphId: string) => {
    setSelectedGraphId(graphId);
    if (graphContext?.switchGraph) {
      try {
        graphContext.switchGraph(graphId);
      } catch (err) {
        console.warn('[StudySpace] Error switching graph in context:', err);
      }
    }
  }, [graphContext]);

  // Keep internal selectedGraphId synchronized if activeGraph changes externally
  useEffect(() => {
    const externalActiveId = activeGraph?.id || graphContext?.activeGraphId;
    if (externalActiveId && availableGraphs.some(g => g.id === externalActiveId)) {
      setSelectedGraphId(externalActiveId);
    }
  }, [activeGraph?.id, graphContext?.activeGraphId, availableGraphs]);

  const selectedGraphMeta = useMemo(() => {
    if (!effectiveSelectedGraphId) return null;
    return availableGraphs.find(g => g.id === effectiveSelectedGraphId) || null;
  }, [availableGraphs, effectiveSelectedGraphId]);

  const selectedGraphProgress = useMemo<GraphLearningProgress | null>(() => {
    if (!effectiveSelectedGraphId) return null;
    return computeGraphLearningProgress(effectiveSelectedGraphId, attempts);
  }, [effectiveSelectedGraphId, attempts]);

  // Assessment History search focus & input ref
  const [isHistorySearchFocused, setIsHistorySearchFocused] = useState(false);
  const historySearchInputRef = useRef<HTMLInputElement>(null);

  const activeFilterKey = filterMode === 'needs-review' ? 'needs-review' : 'all';

  // Assessment History filter tabs moving pill bounds & measurement
  const [filterTabBounds, setFilterTabBounds] = useState<{ left: number; width: number }>(() => ({
    left: activeFilterKey === 'all' ? 3 : 138,
    width: activeFilterKey === 'all' ? 134 : 116,
  }));
  const filterTabsRef = useRef<HTMLDivElement>(null);
  const [filterTabsNode, setFilterTabsNode] = useState<HTMLDivElement | null>(null);

  const setFilterTabsRef = useCallback((node: HTMLDivElement | null) => {
    filterTabsRef.current = node;
    setFilterTabsNode(node);
  }, []);

  const updateFilterPillPosition = useCallback(() => {
    const container = filterTabsRef.current;
    if (!container) return;
    const activeBtn = container.querySelector<HTMLButtonElement>(
      `.study-filter-tab[data-tab-key="${activeFilterKey}"]`
    );
    if (activeBtn) {
      const left = activeBtn.offsetLeft;
      const width = activeBtn.offsetWidth;
      if (width > 0) {
        setFilterTabBounds({ left, width });
      } else {
        requestAnimationFrame(() => {
          if (activeBtn && activeBtn.offsetWidth > 0) {
            setFilterTabBounds({
              left: activeBtn.offsetLeft,
              width: activeBtn.offsetWidth,
            });
          }
        });
      }
    }
  }, [activeFilterKey]);

  useEffect(() => {
    updateFilterPillPosition();
  }, [updateFilterPillPosition, filterTabsNode, isLoading, attempts.length, effectiveSelectedGraphId]);

  useEffect(() => {
    const container = filterTabsRef.current;
    if (!container) return;

    updateFilterPillPosition();

    window.addEventListener('resize', updateFilterPillPosition);
    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        updateFilterPillPosition();
      });
      resizeObserver.observe(container);
    }

    return () => {
      window.removeEventListener('resize', updateFilterPillPosition);
      if (resizeObserver) resizeObserver.disconnect();
    };
  }, [updateFilterPillPosition, filterTabsNode, isLoading]);

  const handleFilterTabKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!filterTabsRef.current) return;
    const tabs = Array.from(
      filterTabsRef.current.querySelectorAll<HTMLButtonElement>('.study-filter-tab')
    );
    const activeIndex = tabs.findIndex(tab => tab.getAttribute('aria-selected') === 'true');
    if (activeIndex === -1) return;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextIndex = (activeIndex + 1) % tabs.length;
      tabs[nextIndex].focus();
      tabs[nextIndex].click();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevIndex = (activeIndex - 1 + tabs.length) % tabs.length;
      tabs[prevIndex].focus();
      tabs[prevIndex].click();
    }
  }, []);

  // Load persistent assessment attempts
  const loadAttempts = useCallback(() => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const list = getAssessmentAttempts();
      setAttempts(list);
    } catch (err) {
      console.error('[StudySpace] Failed to load assessment attempts:', err);
      setErrorMessage('Failed to load assessment history.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and route sync
  useEffect(() => {
    loadAttempts();

    // Check query params for direct attempt deep-linking
    const urlParams = new URLSearchParams(window.location.search);
    const attemptParam = initialAttemptId || urlParams.get('attempt');
    const viewParam = urlParams.get('view');

    if (attemptParam) {
      setSelectedAttemptId(attemptParam);
      if (viewParam === 'missed') {
        setViewMode('review-missed');
      } else if (viewParam === 'answers') {
        setViewMode('review-answers');
      } else {
        setViewMode('historical-results');
      }
    }
  }, [loadAttempts, initialAttemptId]);

  // Handle browser popstate for back/forward navigation between views
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const attemptParam = urlParams.get('attempt');
      const viewParam = urlParams.get('view');

      if (attemptParam) {
        setSelectedAttemptId(attemptParam);
        if (viewParam === 'missed') {
          setViewMode('review-missed');
        } else if (viewParam === 'answers') {
          setViewMode('review-answers');
        } else {
          setViewMode('historical-results');
        }
      } else {
        setSelectedAttemptId(null);
        setViewMode('list');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);


  // Navigate between historical sub-views (results, answers, missed) preserving attempt ID in URL
  const handleNavigateSubView = useCallback((targetView: StudyViewMode) => {
    setViewMode(targetView);
    if (!selectedAttemptId) return;

    try {
      const url = new URL(window.location.href);
      url.searchParams.set('attempt', selectedAttemptId);
      if (targetView === 'review-missed') {
        url.searchParams.set('view', 'missed');
      } else if (targetView === 'review-answers') {
        url.searchParams.set('view', 'answers');
      } else {
        url.searchParams.delete('view');
      }
      window.history.pushState({}, '', url.toString());
    } catch {
      // In test/SSR environments
    }
  }, [selectedAttemptId]);

  // Open an attempt in historical results mode
  const handleOpenAttempt = useCallback((
    attemptId: string, 
    targetView: StudyViewMode = 'historical-results'
  ) => {
    setSelectedAttemptId(attemptId);
    setViewMode(targetView);

    try {
      const url = new URL(window.location.href);
      url.searchParams.set('attempt', attemptId);
      if (targetView === 'review-missed') {
        url.searchParams.set('view', 'missed');
      } else if (targetView === 'review-answers') {
        url.searchParams.set('view', 'answers');
      } else {
        url.searchParams.delete('view');
      }
      window.history.pushState({}, '', url.toString());
    } catch {
      // In test/SSR environments
    }
  }, []);

  // Back to Study Space list
  const handleBackToList = useCallback(() => {
    setViewMode('list');
    setSelectedAttemptId(null);

    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('attempt');
      url.searchParams.delete('view');
      window.history.pushState({}, '', url.toString());
    } catch {
      // Ignore
    }

    loadAttempts();
  }, [loadAttempts]);

  // Selected graph attempts: strictly filtered by effectiveSelectedGraphId
  const selectedGraphAttempts = useMemo<AssessmentAttempt[]>(() => {
    if (!effectiveSelectedGraphId || !Array.isArray(attempts)) return [];
    return attempts.filter(a => {
      const gid = a.graphId || `unassigned-${a.id}`;
      return gid === effectiveSelectedGraphId;
    });
  }, [effectiveSelectedGraphId, attempts]);

  // Compute attempt numbers per graph chronologically (Attempt 01, 02...)
  const attemptNumberMap = useMemo(() => {
    const byGraph: Record<string, AssessmentAttempt[]> = {};
    for (const a of selectedGraphAttempts) {
      const key = a.graphId || a.graphName || 'default';
      if (!byGraph[key]) byGraph[key] = [];
      byGraph[key].push(a);
    }

    const map = new Map<string, string>();
    for (const key of Object.keys(byGraph)) {
      // Sort ascending by completedAt date to assign chronological attempt numbers
      const sorted = [...byGraph[key]].sort((a, b) => {
        return new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime();
      });
      sorted.forEach((a, idx) => {
        map.set(a.id, pad(idx + 1));
      });
    }
    return map;
  }, [selectedGraphAttempts]);

  // Organize attempts into Graph Groups strictly scoped to effectiveSelectedGraphId
  const graphGroups = useMemo<GraphAttemptGroup[]>(() => {
    if (!effectiveSelectedGraphId || selectedGraphAttempts.length === 0) return [];

    const groupsMap: Record<string, { graphName: string; list: AssessmentAttempt[] }> = {};

    for (const a of selectedGraphAttempts) {
      // Use stable graph identifier, fallback to graph name or attempt id if missing
      const key = a.graphId || a.graphName || `unassigned-${a.id}`;
      if (!groupsMap[key]) {
        groupsMap[key] = {
          graphName: selectedGraphMeta?.name || a.graphName || 'Assessment',
          list: []
        };
      }
      groupsMap[key].list.push(a);
    }

    const result: GraphAttemptGroup[] = [];

    for (const [graphId, data] of Object.entries(groupsMap)) {
      // Sort attempts within group descending (newest first)
      const sorted = [...data.list].sort((a, b) => {
        return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
      });

      const latestAttempt = sorted[0];
      const previousAttempts = sorted.slice(1);

      let progressComparison: ScoreComparison | undefined;
      if (previousAttempts.length > 0) {
        progressComparison = computeProgressComparison(latestAttempt, previousAttempts[0]);
      }

      result.push({
        graphId,
        graphName: data.graphName,
        totalAttempts: sorted.length,
        attempts: sorted,
        latestAttempt,
        previousAttempts,
        progressComparison
      });
    }

    // Order graph groups by most recent activity descending (newest latestAttempt first)
    return result.sort((a, b) => {
      return new Date(b.latestAttempt.completedAt).getTime() - new Date(a.latestAttempt.completedAt).getTime();
    });
  }, [effectiveSelectedGraphId, selectedGraphAttempts, selectedGraphMeta?.name]);

  // Filtered graph groups based on search query and review filter
  const filteredGroups = useMemo<GraphAttemptGroup[]>(() => {
    return graphGroups
      .map(group => {
        const matchingAttempts = group.attempts.filter(attempt => {
          // Search matching: match graph name OR attempt concepts
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const matchesName = group.graphName.toLowerCase().includes(q);
            const matchesConcepts = attempt.conceptNames?.some(c => c.toLowerCase().includes(q));
            if (!matchesName && !matchesConcepts) {
              return false;
            }
          }

          // Filter: needs review
          if (filterMode === 'needs-review') {
            const score = attempt.scorePercentage;
            const missed = attempt.resultsSummary?.reviewRecommendedConcepts?.length || 0;
            if (score >= 80 && missed === 0) {
              return false;
            }
          }

          return true;
        });

        if (matchingAttempts.length === 0) return null;

        return {
          ...group,
          totalAttempts: matchingAttempts.length,
          attempts: matchingAttempts,
          latestAttempt: matchingAttempts[0],
          previousAttempts: matchingAttempts.slice(1)
        };
      })
      .filter((g): g is GraphAttemptGroup => g !== null);
  }, [graphGroups, searchQuery, filterMode]);

  // Retrieve selected attempt from persistence service
  const selectedAttempt = useMemo<AssessmentAttempt | null>(() => {
    if (!selectedAttemptId) return null;
    try {
      return getAssessmentAttemptById(selectedAttemptId);
    } catch (err) {
      console.warn('[StudySpace] Error fetching attempt by id:', err);
      return null;
    }
  }, [selectedAttemptId]);

  // Reconstruct KnowledgeTest from the immutable attempt snapshot
  const historicalTest = useMemo<KnowledgeTest | null>(() => {
    if (!selectedAttempt) return null;
    return {
      id: selectedAttempt.testId || selectedAttempt.id,
      graphId: selectedAttempt.graphId,
      title: selectedAttempt.graphName,
      questions: selectedAttempt.questions,
      flaggedQuestionIds: [],
      timeLimitSeconds: selectedAttempt.timeSpentSeconds,
      startedAt: selectedAttempt.createdAt,
      submittedAt: selectedAttempt.completedAt,
      answers: selectedAttempt.userAnswers,
      score: selectedAttempt.correctAnswers,
      timeSpentSeconds: selectedAttempt.timeSpentSeconds
    };
  }, [selectedAttempt]);

  // Effective results summary (guaranteed complete even if legacy record omitted resultsSummary)
  const effectiveResultsSummary = useMemo<TestResultsSummary | null>(() => {
    if (!selectedAttempt) return null;
    return ensureResultsSummary(selectedAttempt);
  }, [selectedAttempt]);


  // Top/latest attempt for selected knowledge graph
  const latestAttempt = useMemo<AssessmentAttempt | null>(() => {
    if (selectedGraphAttempts.length === 0) return null;
    return [...selectedGraphAttempts].sort((a, b) => {
      const timeA = new Date(a.completedAt).getTime() || 0;
      const timeB = new Date(b.completedAt).getTime() || 0;
      if (timeA !== timeB) return timeB - timeA;
      return selectedGraphAttempts.indexOf(a) - selectedGraphAttempts.indexOf(b);
    })[0];
  }, [selectedGraphAttempts]);

  const latestDateInfo = latestAttempt ? formatAttemptDate(latestAttempt.completedAt) : null;
  const missedCount = latestAttempt?.resultsSummary?.reviewRecommendedConcepts?.length || 0;

  // Continue Learning: Math-precise clamped score & viewport-aware entry
  const clampedScore = useMemo(() => {
    if (!latestAttempt) return 0;
    const raw = Number(latestAttempt.scorePercentage);
    if (isNaN(raw)) return 0;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }, [latestAttempt?.scorePercentage]);

  const scoreDigits = useMemo(() => {
    if (!latestAttempt) return [];
    return String(clampedScore).split('').map(Number);
  }, [latestAttempt, clampedScore]);

  const continueSectionRef = useRef<HTMLElement | null>(null);
  const inViewRaw = useInView(continueSectionRef, { once: true, amount: 0.2 });
  const [hasContinueEnteredView, setHasContinueEnteredView] = useState(false);

  useEffect(() => {
    if (inViewRaw || typeof window === 'undefined' || typeof IntersectionObserver === 'undefined') {
      setHasContinueEnteredView(true);
      return;
    }
    // Boundary check: immediately trigger if already within viewport bounds on mount
    if (continueSectionRef.current) {
      const rect = continueSectionRef.current.getBoundingClientRect();
      if (rect.top < window.innerHeight && rect.bottom > 0) {
        setHasContinueEnteredView(true);
        return;
      }
    }
    // Safety guard timer: ensure entrance sequence triggers smoothly without delay
    const timer = setTimeout(() => {
      setHasContinueEnteredView(true);
    }, 120);
    return () => clearTimeout(timer);
  }, [inViewRaw]);

  const progressSectionRef = useRef<HTMLElement | null>(null);
  const progressInViewRaw = useInView(progressSectionRef, { once: true, amount: 0.15 });
  const [hasProgressEnteredView, setHasProgressEnteredView] = useState(false);

  useEffect(() => {
    if (progressInViewRaw || typeof window === 'undefined' || typeof IntersectionObserver === 'undefined' || shouldReduceMotion) {
      setHasProgressEnteredView(true);
      return;
    }

    const checkVisibility = () => {
      if (progressSectionRef.current) {
        const rect = progressSectionRef.current.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.95 && rect.bottom > 0) {
          setHasProgressEnteredView(true);
          return true;
        }
      }
      return false;
    };

    if (checkVisibility()) return;

    const scrollContainer = document.querySelector('.workspace-viewport') || window;
    const handleScroll = () => {
      if (checkVisibility()) {
        scrollContainer.removeEventListener('scroll', handleScroll);
        window.removeEventListener('scroll', handleScroll);
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    let observer: IntersectionObserver | null = null;
    try {
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setHasProgressEnteredView(true);
            observer?.disconnect();
          }
        }
      }, { threshold: 0.1 });
      if (progressSectionRef.current) {
        observer.observe(progressSectionRef.current);
      }
    } catch {
      // Ignore
    }

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
      observer?.disconnect();
    };
  }, [progressInViewRaw, shouldReduceMotion]);

  const historySectionRef = useRef<HTMLElement | null>(null);
  const historyInViewRaw = useInView(historySectionRef, { once: true, amount: 0.1 });
  const [hasHistoryEnteredView, setHasHistoryEnteredView] = useState(false);

  useEffect(() => {
    if (historyInViewRaw || typeof window === 'undefined' || typeof IntersectionObserver === 'undefined' || shouldReduceMotion) {
      setHasHistoryEnteredView(true);
      return;
    }

    const checkVisibility = () => {
      if (historySectionRef.current) {
        const rect = historySectionRef.current.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.95 && rect.bottom > 0) {
          setHasHistoryEnteredView(true);
          return true;
        }
      }
      return false;
    };

    if (checkVisibility()) return;

    const scrollContainer = document.querySelector('.workspace-viewport') || window;
    const handleScroll = () => {
      if (checkVisibility()) {
        scrollContainer.removeEventListener('scroll', handleScroll);
        window.removeEventListener('scroll', handleScroll);
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    let observer: IntersectionObserver | null = null;
    try {
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setHasHistoryEnteredView(true);
            observer?.disconnect();
          }
        }
      }, { threshold: 0.1 });
      if (historySectionRef.current) {
        observer.observe(historySectionRef.current);
      }
    } catch {
      // Ignore
    }

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
      observer?.disconnect();
    };
  }, [historyInViewRaw, shouldReduceMotion]);

  const revisitSectionRef = useRef<HTMLElement | null>(null);
  const revisitInViewRaw = useInView(revisitSectionRef, { once: true, amount: 0.1 });
  const [hasRevisitEnteredView, setHasRevisitEnteredView] = useState(false);

  useEffect(() => {
    if (revisitInViewRaw || typeof window === 'undefined' || typeof IntersectionObserver === 'undefined' || shouldReduceMotion) {
      setHasRevisitEnteredView(true);
      return;
    }

    const checkVisibility = () => {
      if (revisitSectionRef.current) {
        const rect = revisitSectionRef.current.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.95 && rect.bottom > 0) {
          setHasRevisitEnteredView(true);
          return true;
        }
      }
      return false;
    };

    if (checkVisibility()) return;

    const scrollContainer = document.querySelector('.workspace-viewport') || window;
    const handleScroll = () => {
      if (checkVisibility()) {
        scrollContainer.removeEventListener('scroll', handleScroll);
        window.removeEventListener('scroll', handleScroll);
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true });

    let observer: IntersectionObserver | null = null;
    try {
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setHasRevisitEnteredView(true);
            observer?.disconnect();
          }
        }
      }, { threshold: 0.1 });
      if (revisitSectionRef.current) {
        observer.observe(revisitSectionRef.current);
      }
    } catch {
      // Ignore
    }

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      window.removeEventListener('scroll', handleScroll);
      observer?.disconnect();
    };
  }, [revisitInViewRaw, shouldReduceMotion]);

  const lastAnimatedGraphIdRef = useRef<string | null>(null);
  const hasAnimatedRef = useRef(false);
  const endpointRef = useRef<SVGCircleElement | null>(null);
  const [displayedScore, setDisplayedScore] = useState<number>(() => {
    return shouldReduceMotion ? clampedScore : 0;
  });

  // Show all concepts toggle for Concepts Worth Revisiting
  const [isAllConceptsExpanded, setIsAllConceptsExpanded] = useState(false);

  // Show all attempts toggle for Assessment History (defaults to 3 most recent)
  const [isAttemptsExpanded, setIsAttemptsExpanded] = useState(false);

  // Dedicated animation generation counter and visibility tracking for assessment attempts
  const [attemptsAnimGen, setAttemptsAnimGen] = useState(0);
  const [animatedAttemptIds, setAnimatedAttemptIds] = useState<Set<string>>(new Set());
  const [settledAttemptIds, setSettledAttemptIds] = useState<Set<string>>(new Set());
  const [isExpandControlAnimated, setIsExpandControlAnimated] = useState(false);
  const [isExpandControlSettled, setIsExpandControlSettled] = useState(false);

  const animatedAttemptIdsRef = useRef<Set<string>>(new Set());
  const settledAttemptIdsRef = useRef<Set<string>>(new Set());
  const isExpandControlAnimatedRef = useRef<boolean>(false);
  const isExpandControlSettledRef = useRef<boolean>(false);
  const attemptRowElementsRef = useRef<Map<string, HTMLElement>>(new Map());
  const expandControlElementRef = useRef<HTMLElement | null>(null);
  const attemptsTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  // Track graph selection change to immediately reset score during render
  const [prevSelectedGraphId, setPrevSelectedGraphId] = useState(effectiveSelectedGraphId);
  if (prevSelectedGraphId !== effectiveSelectedGraphId) {
    setPrevSelectedGraphId(effectiveSelectedGraphId);
    setDisplayedScore(shouldReduceMotion ? clampedScore : 0);
    setSearchQuery('');
    setFilterMode('all');
    setSelectedAttemptId(null);
    setViewMode('list');
    setIsAllConceptsExpanded(false);
    setIsAttemptsExpanded(false);
    setAttemptsAnimGen((g) => g + 1);
    animatedAttemptIdsRef.current = new Set();
    settledAttemptIdsRef.current = new Set();
    isExpandControlAnimatedRef.current = false;
    isExpandControlSettledRef.current = false;
    setAnimatedAttemptIds(new Set());
    setSettledAttemptIds(new Set());
    setIsExpandControlAnimated(false);
    setIsExpandControlSettled(false);
  }

  // Reset attempt expansion whenever filter mode or search query changes
  const [prevFilterKey, setPrevFilterKey] = useState(`${filterMode}:${searchQuery}`);
  const currentFilterKey = `${filterMode}:${searchQuery}`;
  if (prevFilterKey !== currentFilterKey) {
    setPrevFilterKey(currentFilterKey);
    setIsAttemptsExpanded(false);
    setAttemptsAnimGen((g) => g + 1);
    animatedAttemptIdsRef.current = new Set();
    settledAttemptIdsRef.current = new Set();
    isExpandControlAnimatedRef.current = false;
    isExpandControlSettledRef.current = false;

    // Immediately queue entrance animation for in-view rows on filter switch
    const targetAttemptIds = new Set<string>();
    filteredGroups.forEach((g) => {
      g.attempts.slice(0, 3).forEach((a) => targetAttemptIds.add(a.id));
    });

    if (hasHistoryEnteredView && !shouldReduceMotion) {
      animatedAttemptIdsRef.current = new Set(targetAttemptIds);
      setAnimatedAttemptIds(new Set(targetAttemptIds));
      if (filteredGroups.some((g) => g.attempts.length > 3)) {
        isExpandControlAnimatedRef.current = true;
        setIsExpandControlAnimated(true);
      } else {
        setIsExpandControlAnimated(false);
      }
    } else {
      setAnimatedAttemptIds(new Set());
      setIsExpandControlAnimated(false);
    }
    setSettledAttemptIds(new Set());
    setIsExpandControlSettled(false);
  }

  useEffect(() => {
    if (!hasContinueEnteredView) return;

    // Reset animation state when user switches to a different knowledge graph
    if (lastAnimatedGraphIdRef.current !== effectiveSelectedGraphId) {
      lastAnimatedGraphIdRef.current = effectiveSelectedGraphId;
      hasAnimatedRef.current = false;
      if (!shouldReduceMotion) {
        setDisplayedScore(0);
        if (endpointRef.current) {
          endpointRef.current.style.opacity = '0';
        }
      }
    }

    if (shouldReduceMotion) {
      setDisplayedScore(clampedScore);
      if (endpointRef.current && clampedScore > 0) {
        const pt = getArcEndpoint(clampedScore, CIRCLE_RADIUS, 100, 100);
        endpointRef.current.setAttribute('cx', String(pt.x));
        endpointRef.current.setAttribute('cy', String(pt.y));
        endpointRef.current.style.opacity = '1';
      }
      return;
    }

    if (hasAnimatedRef.current) {
      setDisplayedScore(clampedScore);
      if (endpointRef.current && clampedScore > 0) {
        const pt = getArcEndpoint(clampedScore, CIRCLE_RADIUS, 100, 100);
        endpointRef.current.setAttribute('cx', String(pt.x));
        endpointRef.current.setAttribute('cy', String(pt.y));
        endpointRef.current.style.opacity = '1';
      }
      return;
    }
    hasAnimatedRef.current = true;

    // Coordinated entrance: counter animates in lockstep with the SVG arc drawing
    // Arc delay is 450ms and runs for 1200ms with REVEAL_EASE.
    // Counter timeout starts at 450ms and runs for 1200ms with REVEAL_EASE.
    // Both finish simultaneously at 1650ms.
    let controls: { stop: () => void } | null = null;
    const timer = setTimeout(() => {
      if (endpointRef.current && clampedScore > 0) {
        endpointRef.current.style.opacity = '1';
      }
      controls = animate(0, clampedScore, {
        duration: 1.2,
        ease: REVEAL_EASE,
        onUpdate: (latest) => {
          if (endpointRef.current && clampedScore > 0) {
            const pt = getArcEndpoint(latest, CIRCLE_RADIUS, 100, 100);
            endpointRef.current.setAttribute('cx', String(pt.x));
            endpointRef.current.setAttribute('cy', String(pt.y));
          }
        },
        onComplete: () => {
          setDisplayedScore(clampedScore);
          if (endpointRef.current && clampedScore > 0) {
            const pt = getArcEndpoint(clampedScore, CIRCLE_RADIUS, 100, 100);
            endpointRef.current.setAttribute('cx', String(pt.x));
            endpointRef.current.setAttribute('cy', String(pt.y));
          }
        }
      });
    }, 450);

    return () => {
      clearTimeout(timer);
      if (controls) {
        controls.stop();
      }
    };
  }, [hasContinueEnteredView, clampedScore, shouldReduceMotion, effectiveSelectedGraphId]);


  // Full KnowledgeGraph object for the selected graph if available
  const currentKnowledgeGraph = useMemo<KnowledgeGraph | null>(() => {
    if (!effectiveSelectedGraphId) return null;
    if (activeGraph?.id === effectiveSelectedGraphId) return activeGraph;
    if (graphContext?.activeGraph?.id === effectiveSelectedGraphId) return graphContext.activeGraph;
    try {
      return loadGraphData(effectiveSelectedGraphId);
    } catch {
      return null;
    }
  }, [effectiveSelectedGraphId, activeGraph, graphContext?.activeGraph]);

  // Derive concepts worth revisiting across historical attempts for the selected graph
  const conceptsWorthRevisiting = useMemo<ConceptRevisitItem[]>(() => {
    return deriveConceptsWorthRevisiting(selectedGraphAttempts, currentKnowledgeGraph || activeGraph);
  }, [selectedGraphAttempts, currentKnowledgeGraph, activeGraph]);

  // Hovered attempt point for chart inspection
  const [hoveredPointAttemptId, setHoveredPointAttemptId] = useState<string | null>(null);

  // Displayed concepts slice (first 5 by default if more than 5 exist)
  const displayedConcepts = useMemo(() => {
    if (isAllConceptsExpanded || conceptsWorthRevisiting.length <= 5) {
      return conceptsWorthRevisiting;
    }
    return conceptsWorthRevisiting.slice(0, 5);
  }, [conceptsWorthRevisiting, isAllConceptsExpanded]);

  // Replay & scroll-triggered entrance animations for assessment attempts
  useEffect(() => {
    // Clear all pending timers from previous runs
    attemptsTimersRef.current.forEach((t) => clearTimeout(t));
    attemptsTimersRef.current.clear();

    const isBrowser = typeof window !== 'undefined';
    if (!isBrowser) return;

    // Determine current visible attempts
    const visibleAttempts: { id: string; index: number }[] = [];
    filteredGroups.forEach((group) => {
      group.attempts.forEach((attempt, idx) => {
        if (isAttemptsExpanded || idx < 3) {
          visibleAttempts.push({ id: attempt.id, index: idx });
        }
      });
    });

    const hasExpandControl = filteredGroups.some((g) => g.attempts.length > 3);

    // If reduced motion is requested, immediately mark everything as settled without animation
    if (shouldReduceMotion) {
      const allIds = new Set(visibleAttempts.map((a) => a.id));
      animatedAttemptIdsRef.current = allIds;
      settledAttemptIdsRef.current = allIds;
      isExpandControlAnimatedRef.current = true;
      isExpandControlSettledRef.current = true;
      setAnimatedAttemptIds(allIds);
      setSettledAttemptIds(allIds);
      setIsExpandControlAnimated(true);
      setIsExpandControlSettled(true);
      return;
    }

    // If IntersectionObserver is unavailable, immediately settle
    if (typeof IntersectionObserver === 'undefined') {
      const allIds = new Set(visibleAttempts.map((a) => a.id));
      animatedAttemptIdsRef.current = allIds;
      settledAttemptIdsRef.current = allIds;
      isExpandControlAnimatedRef.current = true;
      isExpandControlSettledRef.current = true;
      setAnimatedAttemptIds(allIds);
      setSettledAttemptIds(allIds);
      if (hasExpandControl) {
        setIsExpandControlAnimated(true);
        setIsExpandControlSettled(true);
      }
      return;
    }

    const triggerAttempt = (id: string, index: number) => {
      if (animatedAttemptIdsRef.current.has(id)) return;
      animatedAttemptIdsRef.current.add(id);
      setAnimatedAttemptIds(new Set(animatedAttemptIdsRef.current));

      const staggerIndex = index >= 3 ? index - 3 : index;
      const delayMs = staggerIndex * 70;
      const settleMs = delayMs + 540;

      const timer = setTimeout(() => {
        attemptsTimersRef.current.delete(timer);
        settledAttemptIdsRef.current.add(id);
        setSettledAttemptIds(new Set(settledAttemptIdsRef.current));
      }, settleMs);

      attemptsTimersRef.current.add(timer);
    };

    const triggerExpandControl = (attemptsCount: number) => {
      if (isExpandControlAnimatedRef.current) return;
      isExpandControlAnimatedRef.current = true;
      setIsExpandControlAnimated(true);

      const delayMs = Math.min(attemptsCount, 3) * 70;
      const settleMs = delayMs + 540;

      const timer = setTimeout(() => {
        attemptsTimersRef.current.delete(timer);
        isExpandControlSettledRef.current = true;
        setIsExpandControlSettled(true);
      }, settleMs);

      attemptsTimersRef.current.add(timer);
    };

    const isElementInView = (el: HTMLElement) => {
      const rect = el.getBoundingClientRect();
      // Support headless/unit test runners where geometry is 0x0
      if (rect.top === 0 && rect.bottom === 0 && rect.height === 0) {
        return true;
      }
      return rect.top < window.innerHeight && rect.bottom > 0;
    };

    // Ensure rows animated immediately on filter switch begin their settle timers
    visibleAttempts.forEach(({ id, index }) => {
      if (animatedAttemptIdsRef.current.has(id) && !settledAttemptIdsRef.current.has(id)) {
        const staggerIndex = index >= 3 ? index - 3 : index;
        const delayMs = staggerIndex * 70;
        const settleMs = delayMs + 540;

        const timer = setTimeout(() => {
          attemptsTimersRef.current.delete(timer);
          settledAttemptIdsRef.current.add(id);
          setSettledAttemptIds(new Set(settledAttemptIdsRef.current));
        }, settleMs);

        attemptsTimersRef.current.add(timer);
      }
    });

    if (hasExpandControl && isExpandControlAnimatedRef.current && !isExpandControlSettledRef.current) {
      const maxAttempts = filteredGroups[0]?.attempts?.length || 4;
      const delayMs = Math.min(maxAttempts, 3) * 70;
      const settleMs = delayMs + 540;

      const timer = setTimeout(() => {
        attemptsTimersRef.current.delete(timer);
        isExpandControlSettledRef.current = true;
        setIsExpandControlSettled(true);
      }, settleMs);

      attemptsTimersRef.current.add(timer);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting || entry.intersectionRatio > 0) {
            const target = entry.target as HTMLElement;
            const attemptId = target.getAttribute('data-attempt-id');
            if (attemptId) {
              const item = visibleAttempts.find((a) => a.id === attemptId);
              if (item) {
                triggerAttempt(item.id, item.index);
                observer.unobserve(target);
              }
            } else if (target === expandControlElementRef.current) {
              const maxAttempts = filteredGroups[0]?.attempts?.length || 4;
              triggerExpandControl(maxAttempts);
              observer.unobserve(target);
            }
          }
        });
      },
      {
        root: null,
        rootMargin: '0px 0px -20px 0px',
        threshold: 0.05
      }
    );

    // Observe un-animated attempt rows
    visibleAttempts.forEach(({ id, index }) => {
      if (!animatedAttemptIdsRef.current.has(id)) {
        const el = attemptRowElementsRef.current.get(id);
        if (el) {
          if (isElementInView(el)) {
            triggerAttempt(id, index);
          } else {
            observer.observe(el);
          }
        }
      }
    });

    // Observe un-animated expand control
    if (hasExpandControl && !isExpandControlAnimatedRef.current && expandControlElementRef.current) {
      if (isElementInView(expandControlElementRef.current)) {
        const maxAttempts = filteredGroups[0]?.attempts?.length || 4;
        triggerExpandControl(maxAttempts);
      } else {
        observer.observe(expandControlElementRef.current);
      }
    }

    // Scroll listener fallback for fast scrolling
    const handleScroll = () => {
      visibleAttempts.forEach(({ id, index }) => {
        if (!animatedAttemptIdsRef.current.has(id)) {
          const el = attemptRowElementsRef.current.get(id);
          if (el && isElementInView(el)) {
            triggerAttempt(id, index);
            observer.unobserve(el);
          }
        }
      });

      if (hasExpandControl && !isExpandControlAnimatedRef.current && expandControlElementRef.current) {
        if (isElementInView(expandControlElementRef.current)) {
          const maxAttempts = filteredGroups[0]?.attempts?.length || 4;
          triggerExpandControl(maxAttempts);
          observer.unobserve(expandControlElementRef.current);
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    const scrollContainer = document.querySelector('.study-scrollable-container') || document.querySelector('.study-editorial-canvas');
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    }

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, [attemptsAnimGen, isAttemptsExpanded, shouldReduceMotion, filteredGroups]);

  // =========================================================================
  // SUB-VIEW: Historical Assessment Results, Answers Review, Missed Concepts
  // =========================================================================
  if (selectedAttemptId) {
    if (!selectedAttempt || !historicalTest || !effectiveResultsSummary) {
      return (
        <div className="study-space-container">
          <div className="study-error-banner" role="alert">
            <span className="study-error-text">
              Assessment attempt could not be found or access was denied.
            </span>
            <button
              type="button"
              className="study-retry-btn"
              onClick={handleBackToList}
            >
              Back to Study Space
            </button>
          </div>
        </div>
      );
    }

    if (viewMode === 'review-answers') {
      return (
        <div className="study-historical-results-wrap">
          <TestReviewView
            test={historicalTest}
            userAnswers={selectedAttempt.userAnswers}
            graph={activeGraph}
            onBackToResults={() => handleNavigateSubView('historical-results')}
            onSelectConceptToReview={(conceptId) => onNavigateToConcept?.(conceptId)}
          />
        </div>
      );
    }

    if (viewMode === 'review-missed') {
      return (
        <div className="study-historical-results-wrap">
          <MissedConceptsReview
            missedConcepts={effectiveResultsSummary.reviewRecommendedConcepts}
            graph={activeGraph}
            onBackToResults={() => handleNavigateSubView('historical-results')}
            onReviewConceptInGraph={(conceptId) => onNavigateToConcept?.(conceptId)}
          />
        </div>
      );
    }

    // Default historical results view
    return (
      <div className="study-historical-results-wrap">
        <TestResultsView
          results={effectiveResultsSummary}
          test={historicalTest}
          graph={activeGraph}
          isHistorical={true}
          completionDate={formatAttemptDate(selectedAttempt.completedAt).dateStr}
          graphName={selectedAttempt.graphName}
          completionReason={selectedAttempt.completionReason}
          backButtonLabel="BACK TO STUDY SPACE"
          onReviewAnswers={() => handleNavigateSubView('review-answers')}
          onReviewMissedConcepts={() => handleNavigateSubView('review-missed')}
          onBackToGraph={handleBackToList}
          onSelectConceptToReview={(conceptId) => onNavigateToConcept?.(conceptId)}
        />
      </div>
    );
  }

  // =========================================================================
  // MAIN VIEW: Study Space List & Graph Groups
  // =========================================================================
  return (
    <div className="study-space-container">
      {/* 1. Page Header (Editorial header matching Sources page typography & entry motion) */}
      <header className="study-header">
        <div className="study-header-main-row">
          <div className="study-header-left">
            {/* Uppercase technical eyebrow: YOUR LEARNING */}
            <motion.span
              className="study-eyebrow"
              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.50, delay: 0.06, ease: REVEAL_EASE }}
            >
              YOUR LEARNING
            </motion.span>

            {/* Editorial section title: Study Space with masked clip line reveal */}
            <h1 className="study-title" aria-label="Study Space">
              <span className="study-title-clip">
                <motion.span
                  className="study-title-line"
                  initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: '115%' }}
                  animate={{ opacity: 1, y: '0%' }}
                  transition={{ duration: 0.70, delay: 0.10, ease: REVEAL_EASE }}
                >
                  Study Space
                </motion.span>
              </span>
            </h1>

            {/* Short supporting editorial statement */}
            <motion.p
              className="study-subtitle"
              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.22, ease: REVEAL_EASE }}
            >
              Your assessments, progress, and concepts worth revisiting.
            </motion.p>
          </div>

          {availableGraphs.length > 0 && (
            <motion.div
              className="study-header-right"
              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.50, delay: 0.25, ease: REVEAL_EASE }}
            >
              <StudyGraphSelector
                availableGraphs={availableGraphs}
                selectedGraphId={effectiveSelectedGraphId}
                onSelectGraph={handleSelectGraph}
                onNavigateToAllGraphs={onNavigateToGraph}
                shouldReduceMotion={Boolean(shouldReduceMotion)}
              />
            </motion.div>
          )}
        </div>

        {/* Hairline divider with scaleX reveal */}
        <motion.div
          className="study-header-divider"
          initial={shouldReduceMotion ? { opacity: 1, scaleX: 1 } : { opacity: 0, scaleX: 0 }}
          animate={{ opacity: 1, scaleX: 1 }}
          transition={{ duration: 0.70, delay: 0.32, ease: REVEAL_EASE }}
          style={{ transformOrigin: '0% 50%' }}
          aria-hidden="true"
        />
      </header>

      {/* Error state if fetch failed */}
      {errorMessage && (
        <div className="study-error-banner" role="alert">
          <span className="study-error-text">{errorMessage}</span>
          <button type="button" className="study-retry-btn" onClick={loadAttempts}>
            Retry loading
          </button>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="study-loading-state" role="status" aria-live="polite">
          <span>Loading assessment history…</span>
        </div>
      )}

      {/* Unified Learning Overview (Phase 4 — Prompt 19) */}
      {!isLoading && !errorMessage && (currentKnowledgeGraph || activeGraph) && (currentKnowledgeGraph?.nodes?.length || activeGraph?.nodes?.length || 0) > 0 && (
        <UnifiedLearningOverview
          graph={(currentKnowledgeGraph || activeGraph)!}
          onNavigateToRevision={onNavigateToRevision}
          onNavigateToConcept={onNavigateToConcept}
          onNavigateToGraph={onNavigateToGraph}
        />
      )}

      {/* 2. Empty State (when user has zero assessment history) */}
      {!isLoading && !errorMessage && attempts.length === 0 && (
        <motion.section 
          className="study-empty-state" 
          aria-label="No assessments completed"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08, ease: REVEAL_EASE }}
        >
          <span className="study-eyebrow">YOUR LEARNING</span>
          <h2 className="study-empty-heading">No assessments yet.</h2>
          <p className="study-empty-text">
            Complete an assessment from your knowledge graph to build your learning history.
          </p>
          <button
            type="button"
            className="study-editorial-btn study-empty-action"
            onClick={onNavigateToGraph}
            aria-label="Explore your knowledge graph"
          >
            <span className="study-btn-content">
              <span>Explore your graph</span>
              <span className="study-btn-arrow" aria-hidden="true">→</span>
            </span>
            <span className="study-btn-underline" aria-hidden="true" />
          </button>
        </motion.section>
      )}

      {/* Personalized Revision Recommendations for graphs with zero assessments */}
      {!isLoading && !errorMessage && attempts.length === 0 && (currentKnowledgeGraph || activeGraph) && (currentKnowledgeGraph?.nodes?.length || activeGraph?.nodes?.length || 0) > 0 && (
        <RevisionRecommendationsSection
          graph={(currentKnowledgeGraph || activeGraph)!}
          onNavigateToRevision={onNavigateToRevision}
          onNavigateToConcept={onNavigateToConcept}
          onNavigateToGraph={onNavigateToGraph}
        />
      )}

      {/* Populated State with Real Attempts */}
      {!isLoading && !errorMessage && attempts.length > 0 && (
        <>
          {/* 3. Continue Learning Section (Asymmetric Editorial Composition) */}
          {selectedGraphMeta && (
            <motion.section 
              ref={continueSectionRef}
              className="study-continue-section" 
              aria-label="Continue learning"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={hasContinueEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: 0.35, delay: 0.04, ease: REVEAL_EASE }}
            >
              <div className="study-continue-box">
                {/* Asymmetric Editorial Grid: Left Narrative + Right Score Visualization */}
                <div 
                  key={effectiveSelectedGraphId || 'none'}
                  className="study-continue-grid"
                >
                  {/* LEFT: Complete Assessment Narrative & Performance Hierarchy */}
                  <div className="study-continue-info">
                    {/* AREA A — Section Context & Prominent Graph Title (Upper-Left) */}
                    <div className="study-continue-context-layer">
                      <div className="study-continue-eyebrow-row">
                        <span className="study-continue-kicker-clip">
                          <motion.span 
                            className="study-continue-kicker"
                            initial={shouldReduceMotion ? { opacity: 1, clipPath: 'inset(0 0% 0 0)', x: 0 } : { opacity: 0, clipPath: 'inset(0 100% 0 0)', x: -6 }}
                            animate={hasContinueEnteredView ? { opacity: 1, clipPath: 'inset(0 0% 0 0)', x: 0 } : { opacity: 0, clipPath: 'inset(0 100% 0 0)', x: -6 }}
                            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.48, delay: 0.04, ease: REVEAL_EASE }}
                          >
                            CONTINUE LEARNING
                          </motion.span>
                        </span>
                      </div>

                      <div className="study-continue-identity-row">
                        <motion.h2 
                          className="study-continue-title" 
                          title="Your learning, in progress."
                          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                          animate={hasContinueEnteredView ? { opacity: 1 } : { opacity: 0 }}
                          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.28, delay: 0.10 }}
                        >
                          <span className="study-continue-title-clip">
                            <motion.span 
                              className="study-continue-title-line"
                              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: '105%' }}
                              animate={hasContinueEnteredView ? { opacity: 1, y: '0%' } : { opacity: 0, y: '105%' }}
                              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.62, delay: 0.12, ease: REVEAL_EASE }}
                            >
                              Your learning, in progress.
                            </motion.span>
                          </span>
                        </motion.h2>

                        <div className="study-continue-meta-stack">
                          {latestAttempt ? (
                            <motion.span 
                              className="study-continue-graph-name"
                              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                              animate={hasContinueEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.46, delay: 0.34, ease: REVEAL_EASE }}
                            >
                              {latestAttempt.graphName}
                            </motion.span>
                          ) : (
                            <motion.span 
                              className="study-continue-graph-name"
                              initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                              animate={hasContinueEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.46, delay: 0.34, ease: REVEAL_EASE }}
                            >
                              {selectedGraphMeta.name}
                            </motion.span>
                          )}
                          <motion.div 
                            className="study-continue-context-line"
                            initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
                            animate={hasContinueEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
                            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.42, delay: 0.44, ease: REVEAL_EASE }}
                          >
                            {latestAttempt && latestDateInfo ? (
                              <>
                                <span>{latestDateInfo.dateStr}</span>
                                <span className="study-meta-dot" aria-hidden="true">·</span>
                                <span>{latestAttempt.totalQuestions} questions</span>
                              </>
                            ) : (
                              <span>No assessments yet</span>
                            )}
                          </motion.div>
                        </div>
                      </div>
                    </div>

                    {/* AREA C — Results Summary & Connected Next Action */}
                    <div className="study-continue-summary-block">
                      {latestAttempt ? (
                        /* Three-Column Horizontal Results Distribution: Left (Score) - Middle (Insight) - Right (Action) */
                        <div className="study-continue-results-action-group">
                          {/* LEFT: Correct-Answer Statistic */}
                          <motion.div 
                            className="study-continue-ratio-row"
                            initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                            animate={hasContinueEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.46, delay: 0.54, ease: REVEAL_EASE }}
                          >
                            <div className="study-continue-ratio-num">
                              <span className="study-ratio-numerator">{pad(latestAttempt.correctAnswers)}</span>
                              <span className="study-continue-ratio-slash">/</span>
                              <span className="study-ratio-denominator">{pad(latestAttempt.totalQuestions)}</span>
                            </div>
                            <span className="study-continue-ratio-lbl">CORRECT ANSWERS</span>
                          </motion.div>

                          {/* MIDDLE: Missed-Concept Count */}
                          <motion.div 
                            className="study-continue-meta"
                            initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 5 }}
                            animate={hasContinueEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 5 }}
                            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.44, delay: 0.64, ease: REVEAL_EASE }}
                          >
                            <span 
                              className={`study-meta-indicator ${missedCount > 0 ? 'study-meta-indicator-warm' : 'study-meta-indicator-lime'}`} 
                              aria-hidden="true" 
                            />
                            {missedCount > 0 ? (
                              <span className="study-meta-insight-text study-meta-warm">
                                {missedCount} concept{missedCount === 1 ? '' : 's'} to revisit
                              </span>
                            ) : (
                              <span className="study-meta-insight-text study-meta-highlight">
                                All concepts mastered · complete comprehension
                              </span>
                            )}
                          </motion.div>

                          {/* RIGHT: Connected Next Action */}
                          <motion.div 
                            className="study-continue-action-row"
                            initial={shouldReduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
                            animate={hasContinueEnteredView ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
                            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.46, delay: 0.72, ease: REVEAL_EASE }}
                          >
                            <button
                              type="button"
                              className="study-editorial-btn study-continue-action-btn"
                              onClick={() => handleOpenAttempt(
                                latestAttempt.id, 
                                missedCount > 0 ? 'review-missed' : 'historical-results'
                              )}
                              aria-label={
                                missedCount > 0 
                                  ? `Review missed concepts for ${latestAttempt.graphName}` 
                                  : `Review results for ${latestAttempt.graphName}`
                              }
                            >
                              <span className="study-btn-content">
                                <span>{missedCount > 0 ? 'REVIEW MISSED CONCEPTS' : 'REVIEW RESULTS'}</span>
                                <span className="study-btn-arrow" aria-hidden="true">→</span>
                              </span>
                              <span className="study-btn-underline" aria-hidden="true" />
                            </button>
                          </motion.div>
                        </div>
                      ) : (
                        /* Empty state when selected knowledge graph has no assessment attempts yet */
                        <motion.div 
                          className="study-continue-empty-body"
                          initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                          animate={hasContinueEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.46, delay: 0.50, ease: REVEAL_EASE }}
                        >
                          <p className="study-continue-empty-msg">
                            Start your first assessment for this knowledge graph to track your understanding and identify concepts to revisit.
                          </p>
                          <motion.div 
                            className="study-continue-action-row"
                            initial={shouldReduceMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
                            animate={hasContinueEnteredView ? { opacity: 1, x: 0 } : { opacity: 0, x: -8 }}
                            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.46, delay: 0.64, ease: REVEAL_EASE }}
                          >
                            <button
                              type="button"
                              className="study-editorial-btn study-continue-action-btn"
                              onClick={onNavigateToGraph}
                              aria-label={`Start assessment for ${selectedGraphMeta.name}`}
                            >
                              <span className="study-btn-content">
                                <span>START ASSESSMENT</span>
                                <span className="study-btn-arrow" aria-hidden="true">→</span>
                              </span>
                              <span className="study-btn-underline" aria-hidden="true" />
                            </button>
                          </motion.div>
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {/* AREA B — Performance Visualization (Focal Circular Score) */}
                  <motion.div 
                    className="study-continue-action-wrap"
                    initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                    animate={hasContinueEnteredView ? { opacity: 1 } : { opacity: 0 }}
                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.46, delay: 0.22, ease: REVEAL_EASE }}
                  >
                    <div className="study-continue-score-block">
                      <div className="study-continue-circle-wrap">
                        <svg 
                          className="study-continue-circle-svg" 
                          width="320" 
                          height="320" 
                          viewBox="0 0 200 200" 
                          role="progressbar" 
                          aria-valuenow={latestAttempt ? clampedScore : 0} 
                          aria-valuemin={0} 
                          aria-valuemax={100} 
                          aria-label={latestAttempt ? `Assessment score: ${clampedScore}%` : `No assessments yet for ${selectedGraphMeta.name}`}
                        >
                          {latestAttempt ? (
                            <circle 
                              cx="100" 
                              cy="100" 
                              r={CIRCLE_RADIUS} 
                              className="study-continue-circle-track" 
                            />
                          ) : (
                            <circle 
                              cx="100" 
                              cy="100" 
                              r={CIRCLE_RADIUS} 
                              className="study-continue-circle-track study-continue-circle-track-empty" 
                            />
                          )}
                          {latestAttempt && (
                            <motion.circle 
                              key={`circle-arc-${effectiveSelectedGraphId || 'none'}-${latestAttempt.id}`}
                              cx="100" 
                              cy="100" 
                              r={CIRCLE_RADIUS} 
                              className="study-continue-circle-arc"
                              transform="rotate(-90 100 100)"
                              strokeDasharray={CIRCLE_CIRCUMFERENCE}
                              strokeLinecap={clampedScore === 0 ? 'butt' : 'round'}
                              initial={shouldReduceMotion ? false : { 
                                strokeDashoffset: CIRCLE_CIRCUMFERENCE, 
                                opacity: clampedScore === 0 ? 0 : 1 
                              }}
                              animate={hasContinueEnteredView ? {
                                strokeDashoffset: CIRCLE_CIRCUMFERENCE * (1 - clampedScore / 100),
                                opacity: clampedScore === 0 ? 0 : 1
                              } : { strokeDashoffset: CIRCLE_CIRCUMFERENCE, opacity: 0 }}
                              transition={shouldReduceMotion ? { duration: 0 } : { 
                                strokeDashoffset: { duration: 1.2, delay: 0.45, ease: REVEAL_EASE },
                                opacity: { duration: 0 }
                              }}
                            />
                          )}
                          {latestAttempt && clampedScore > 0 && (
                            <circle 
                              ref={endpointRef}
                              cx={getArcEndpoint(shouldReduceMotion ? clampedScore : 0, CIRCLE_RADIUS, 100, 100).x} 
                              cy={getArcEndpoint(shouldReduceMotion ? clampedScore : 0, CIRCLE_RADIUS, 100, 100).y} 
                              r="3.2" 
                              className="study-continue-circle-endpoint" 
                              style={{ opacity: shouldReduceMotion ? 1 : 0 }}
                            />
                          )}
                        </svg>
                        <div className="study-continue-circle-content" aria-hidden="true">
                          {latestAttempt ? (
                            <>
                              <span className="study-continue-score-pct" aria-label={`${clampedScore}%`}>
                                <span className="study-continue-score-digits">
                                  {scoreDigits.map((digit, idx) => (
                                    <SlotDigit
                                      key={`slot-digit-${effectiveSelectedGraphId || 'none'}-${latestAttempt.id}-${clampedScore}-${idx}`}
                                      targetDigit={digit}
                                      delay={shouldReduceMotion ? 0 : 0.45 + idx * 0.08}
                                      duration={shouldReduceMotion ? 0 : 1.20 + idx * 0.08}
                                      ease={EDITORIAL_EASE}
                                      shouldReduceMotion={Boolean(shouldReduceMotion)}
                                      hasEnteredView={hasContinueEnteredView}
                                      spinIfZero={clampedScore > 0 && digit === 0}
                                    />
                                  ))}
                                </span>
                                <span className="study-continue-pct-symbol">%</span>
                                <span className="sr-only">{displayedScore}%</span>
                              </span>
                              <span className="study-continue-circle-lbl">SCORE</span>
                            </>
                          ) : (
                            <>
                              <span className="study-continue-score-pct study-continue-empty-dash">—</span>
                              <span className="study-continue-circle-lbl">NO ASSESSMENTS</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </div>
              </div>
            </motion.section>
          )}

          {/* 4. Learning Progress Section Filtered to Selected Knowledge Graph (Section 5) */}
          {selectedGraphMeta && (
            <motion.section 
              ref={progressSectionRef}
              className="study-progress-section" 
              aria-label="Learning progress"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
              animate={hasProgressEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.42, delay: 0.05, ease: REVEAL_EASE }}
            >
              <div className="study-section-header-block study-trajectory-section-header">
                <span className="study-trajectory-eyebrow-clip">
                  <motion.span 
                    className="study-eyebrow study-trajectory-eyebrow"
                    initial={shouldReduceMotion ? { opacity: 1, clipPath: 'inset(0 0% 0 0)', x: 0 } : { opacity: 0, clipPath: 'inset(0 100% 0 0)', x: -6 }}
                    animate={hasProgressEnteredView ? { opacity: 1, clipPath: 'inset(0 0% 0 0)', x: 0 } : { opacity: 0, clipPath: 'inset(0 100% 0 0)', x: -6 }}
                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.48, delay: 0.04, ease: REVEAL_EASE }}
                  >
                    LEARNING PROGRESS
                  </motion.span>
                </span>

                <motion.h2 
                  className="study-section-title study-trajectory-section-title"
                  title="Your learning, over time."
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                  animate={hasProgressEnteredView ? { opacity: 1 } : { opacity: 0 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.28, delay: 0.10 }}
                >
                  <span className="study-trajectory-title-clip">
                    <motion.span 
                      className="study-trajectory-title-line"
                      initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: '105%' }}
                      animate={hasProgressEnteredView ? { opacity: 1, y: '0%' } : { opacity: 0, y: '105%' }}
                      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.62, delay: 0.12, ease: REVEAL_EASE }}
                    >
                      Your learning, over time.
                    </motion.span>
                  </span>
                </motion.h2>

                <motion.p 
                  className="study-section-desc study-trajectory-section-desc"
                  initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                  animate={hasProgressEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.46, delay: 0.24, ease: REVEAL_EASE }}
                >
                  See how your understanding changes with every assessment.
                </motion.p>
              </div>

              <div className="study-progress-cards-list study-trajectory-list">
                {selectedGraphProgress ? (
                  <LearningTrajectoryRow
                    key={selectedGraphProgress.graphId}
                    prog={selectedGraphProgress}
                    hoveredPointAttemptId={hoveredPointAttemptId}
                    setHoveredPointAttemptId={setHoveredPointAttemptId}
                    selectedAttemptId={selectedAttemptId}
                    handleOpenAttempt={handleOpenAttempt}
                    shouldReduceMotion={Boolean(shouldReduceMotion)}
                    isFirst={true}
                  />
                ) : (
                  <div
                    className="study-progress-empty-card"
                    role="region"
                    aria-label={`No assessments yet for ${selectedGraphMeta.name}`}
                  >
                    <div className="study-progress-empty-header">
                      <div className="study-trajectory-identity">
                        <span className="study-trajectory-dot" aria-hidden="true" />
                        <span className="study-trajectory-graph-title">{selectedGraphMeta.name}</span>
                      </div>
                      <span className="study-trajectory-count">0 assessments</span>
                    </div>
                    <div className="study-progress-empty-body">
                      <p className="study-progress-empty-msg">
                        No assessments yet for this knowledge graph.
                      </p>
                      <p className="study-progress-empty-sub">
                        Complete an assessment to start tracking your score trajectory, historical attempts, and learning progress over time.
                      </p>
                      {onNavigateToGraph && (
                        <button
                          type="button"
                          className="study-editorial-btn study-progress-empty-action"
                          onClick={onNavigateToGraph}
                          aria-label={`Explore knowledge graph ${selectedGraphMeta.name}`}
                        >
                          <span className="study-btn-content">
                            <span>Explore this graph</span>
                            <span className="study-btn-arrow" aria-hidden="true">→</span>
                          </span>
                          <span className="study-btn-underline" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.section>
          )}

          {/* 5. Assessment History Section Organized by Graph (Prompt 3 & 8) */}
          <motion.section 
            ref={historySectionRef}
            className="study-history-section" 
            aria-label="Assessment history"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
            animate={hasHistoryEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
            transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.42, delay: 0.05, ease: REVEAL_EASE }}
          >
            <div className="study-history-header-block">
              <motion.h2 
                className="study-section-title"
                title="Assessment history"
                initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                animate={hasHistoryEnteredView ? { opacity: 1 } : { opacity: 0 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.28, delay: 0.10 }}
              >
                <span className="study-history-title-clip">
                  <motion.span 
                    className="study-history-title-line"
                    initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: '105%' }}
                    animate={hasHistoryEnteredView ? { opacity: 1, y: '0%' } : { opacity: 0, y: '105%' }}
                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.62, delay: 0.12, ease: REVEAL_EASE }}
                  >
                    Assessment history
                  </motion.span>
                </span>
              </motion.h2>

              <motion.p 
                className="study-section-desc"
                initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                animate={hasHistoryEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.46, delay: 0.24, ease: REVEAL_EASE }}
              >
                Every completed assessment, ready to revisit.
              </motion.p>

              {/* Refined Search & Segmented Filter Toolbar */}
              {selectedGraphAttempts.length > 0 && (
                <div className="study-controls-bar">
                  <div 
                    className={`study-search-wrap ${isHistorySearchFocused ? 'focused' : ''} ${searchQuery.trim() ? 'has-query' : ''}`}
                    onClick={() => historySearchInputRef.current?.focus()}
                  >
                    <Search size={14} strokeWidth={1.4} className="study-search-icon" aria-hidden="true" />
                    <input
                      ref={historySearchInputRef}
                      type="text"
                      className="study-search-input"
                      placeholder="Search by graph or concept…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onFocus={() => setIsHistorySearchFocused(true)}
                      onBlur={() => setIsHistorySearchFocused(false)}
                      aria-label="Search assessment history by graph or concept"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        className="study-search-clear"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSearchQuery('');
                          historySearchInputRef.current?.focus();
                        }}
                        aria-label="Clear search query"
                      >
                        <X size={13} />
                      </button>
                    )}
                    {/* Focus accent: 1px GraphMind green line along bottom edge */}
                    <div className="study-search-focus-line" aria-hidden="true" />
                  </div>

                  <div 
                    ref={setFilterTabsRef}
                    className="study-filter-tabs" 
                    role="tablist" 
                    aria-label="Assessment filter"
                    onKeyDown={handleFilterTabKeyDown}
                  >
                    {/* Moving active green-tinted selection pill */}
                    {filterTabBounds && (
                      <motion.div
                        className="study-filter-active-pill"
                        initial={false}
                        animate={{
                        x: filterTabBounds.left,
                        width: filterTabBounds.width,
                        opacity: filterTabBounds.width > 0 ? 1 : 0
                      }}
                        transition={
                          shouldReduceMotion 
                            ? { duration: 0 } 
                            : { 
                                duration: 0.54, // cinematic 540ms glide (upgraded from legacy duration: 0.24)
                                ease: [0.22, 1, 0.36, 1] 
                              }
                        }
                        aria-hidden="true"
                      />
                    )}

                    <button
                      type="button"
                      role="tab"
                      data-tab-key="all"
                      aria-selected={activeFilterKey === 'all'}
                      className={`study-filter-tab ${activeFilterKey === 'all' ? 'active' : ''}`}
                      onClick={() => setFilterMode('all')}
                    >
                      <span className="study-filter-tab-label">All assessments</span>
                    </button>

                    <button
                      type="button"
                      role="tab"
                      data-tab-key="needs-review"
                      aria-selected={activeFilterKey === 'needs-review'}
                      className={`study-filter-tab ${activeFilterKey === 'needs-review' ? 'active' : ''}`}
                      onClick={() => setFilterMode('needs-review')}
                    >
                      <span className="study-filter-tab-label">Needs review</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Search/Filter or No History Empty State */}
            {selectedGraphAttempts.length === 0 ? (
              <div className="study-search-empty">
                <span className="study-search-empty-title">
                  No assessment history yet.
                </span>
                <p className="study-search-empty-sub">
                  Completed assessments will appear here.
                </p>
                {onNavigateToGraph && (
                  <div className="study-search-empty-actions">
                    <button
                      type="button"
                      className="study-editorial-btn"
                      onClick={onNavigateToGraph}
                      aria-label={selectedGraphMeta ? `Start assessment for ${selectedGraphMeta.name}` : 'Start assessment'}
                    >
                      <span className="study-btn-content">
                        <span>Start assessment</span>
                        <span className="study-btn-arrow" aria-hidden="true">→</span>
                      </span>
                      <span className="study-btn-underline" aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>
            ) : filteredGroups.length === 0 ? (
              <motion.div 
                key={`empty-${filterMode}-${searchQuery}`}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="study-search-empty"
              >
                <span className="study-search-empty-title">
                  {searchQuery.trim()
                    ? `No assessments found matching "${searchQuery}"`
                    : filterMode === 'needs-review'
                    ? 'No assessments need review'
                    : 'No assessments found for the selected filter.'}
                </span>
                <p className="study-search-empty-sub">
                  {searchQuery.trim()
                    ? 'Check the spelling or try searching for another concept or knowledge graph.'
                    : filterMode === 'needs-review'
                    ? 'All completed assessments scored 80% or higher with zero missed concepts.'
                    : 'Try searching for another keyword or reset active filters.'}
                </p>
                <div className="study-search-empty-actions">
                  {searchQuery.trim() && (
                    <button
                      type="button"
                      className="study-editorial-btn"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search query"
                    >
                      <span className="study-btn-content">
                        <span>Clear search query</span>
                        <span className="study-btn-arrow" aria-hidden="true">→</span>
                      </span>
                      <span className="study-btn-underline" aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="study-editorial-btn"
                    onClick={() => { setSearchQuery(''); setFilterMode('all'); }}
                    aria-label="Reset all search filters"
                  >
                    <span className="study-btn-content">
                      <span>Clear search filters</span>
                      <span className="study-btn-arrow" aria-hidden="true">→</span>
                    </span>
                    <span className="study-btn-underline" aria-hidden="true" />
                  </button>
                </div>
              </motion.div>
            ) : null}

            {/* Graph Groups List */}
            {filteredGroups.length > 0 && (
              <motion.div 
                key={`${activeFilterKey}-${searchQuery ? 'search' : 'nosearch'}`}
                initial={shouldReduceMotion ? false : { opacity: 0.88 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="study-groups-list"
              >
                {filteredGroups.map((group) => {
                  return (
                    <section key={group.graphId} className="study-graph-group" aria-label={`${group.graphName} assessments`}>
                      {/* Group Header: Graph Name on Left, Assessment Count on Right */}
                      <div className="study-group-header">
                        <h3 className="study-group-name">{group.graphName}</h3>
                        <span className="study-group-count study-group-meta">
                          {group.totalAttempts} {group.totalAttempts === 1 ? 'assessment' : 'assessments'}
                        </span>
                      </div>

                      {/* Direct List of Assessment Records */}
                      <div className="study-records-list">
                        {group.attempts.map((attempt) => {
                          const attemptIndex = group.attempts.indexOf(attempt);
                          if (!isAttemptsExpanded && attemptIndex >= 3) {
                            return null;
                          }

                          const dateInfo = formatAttemptDate(attempt.completedAt);
                          const attemptNumber = attemptNumberMap.get(attempt.id) || '01';
                          const missedConcepts = attempt.resultsSummary?.reviewRecommendedConcepts?.length || 0;
                          const isExpired = attempt.completionReason === 'time_expired';

                          return (
                            <article
                              key={attempt.id}
                              ref={(el) => {
                                if (el) {
                                  attemptRowElementsRef.current.set(attempt.id, el);
                                } else {
                                  attemptRowElementsRef.current.delete(attempt.id);
                                }
                              }}
                              className="study-record-item"
                              data-attempt-id={attempt.id}
                              data-entry-state={
                                shouldReduceMotion || settledAttemptIds.has(attempt.id)
                                  ? 'settled'
                                  : animatedAttemptIds.has(attempt.id)
                                  ? 'animate'
                                  : 'initial'
                              }
                              style={{
                                '--study-row-delay': `${(attemptIndex >= 3 ? attemptIndex - 3 : attemptIndex) * 70}ms`
                              } as React.CSSProperties}
                            >
                              {/* Left Area: Attempt Identity & Numerical Score */}
                              <div className="study-record-left">
                                <span className="study-record-identity">Attempt {attemptNumber}</span>
                                <div className="study-record-score-block">
                                  <span className="study-record-val study-record-val-primary">
                                    {pad(attempt.correctAnswers)} / {pad(attempt.totalQuestions)}
                                  </span>
                                  <span className="study-record-lbl">CORRECT ANSWERS</span>
                                </div>
                              </div>

                              {/* Center Area: Assessment Details (Date & Review Count) */}
                              <div className="study-record-metrics">
                                <div className="study-record-center-row">
                                  <span className="study-record-val study-record-val-date">
                                    {dateInfo.dateStr}
                                  </span>
                                  <span className="study-record-lbl">COMPLETED</span>
                                </div>

                                <div className="study-record-center-row">
                                  <span className={`study-record-val study-record-val-review ${missedConcepts > 0 ? 'study-meta-warm' : 'study-meta-neutral'}`}>
                                    {missedConcepts} {missedConcepts === 1 ? 'concept' : 'concepts'}
                                  </span>
                                  <span className="study-record-lbl">TO REVIEW</span>
                                </div>
                              </div>

                              {/* Right Area: Status & Action */}
                              <div className="study-record-right">
                                <div className="study-record-status-wrap">
                                  {isExpired && (
                                    <span className="study-status-expired" role="status" aria-label="Assessment expired">
                                      Expired
                                    </span>
                                  )}
                                </div>

                                <button
                                  type="button"
                                  className="study-editorial-btn study-record-action-btn"
                                  onClick={() => handleOpenAttempt(attempt.id)}
                                  aria-label={`View results for ${group.graphName} Attempt ${attemptNumber}`}
                                >
                                  <span className="study-btn-content">
                                    <span>View results</span>
                                    <span className="study-btn-arrow" aria-hidden="true">→</span>
                                  </span>
                                  <span className="study-btn-underline" aria-hidden="true" />
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>

                      {/* Collapsible Assessment History Control */}
                      {group.attempts.length > 3 && (
                        <div
                          ref={(el) => {
                            expandControlElementRef.current = el;
                          }}
                          className="study-records-expand-wrap"
                          data-entry-state={
                            shouldReduceMotion || isExpandControlSettled
                              ? 'settled'
                              : isExpandControlAnimated
                              ? 'animate'
                              : 'initial'
                          }
                          style={{
                            '--study-row-delay': `${Math.min(group.attempts.length, 3) * 70}ms`
                          } as React.CSSProperties}
                        >
                          <button
                            type="button"
                            className="study-records-expand-btn"
                            onClick={() => setIsAttemptsExpanded(!isAttemptsExpanded)}
                            aria-expanded={isAttemptsExpanded}
                            aria-label={
                              isAttemptsExpanded
                                ? 'Show fewer attempts'
                                : `Show all ${group.attempts.length - 3} remaining attempts`
                            }
                          >
                            <span className="study-records-expand-text">
                              {isAttemptsExpanded
                                ? 'Show fewer'
                                : `Show all ${group.attempts.length - 3} remaining ${group.attempts.length - 3 === 1 ? 'attempt' : 'attempts'}`}
                            </span>
                            <span className="study-records-expand-chevron" aria-hidden="true">
                              {isAttemptsExpanded ? '↑' : '↓'}
                            </span>
                          </button>
                        </div>
                      )}
                    </section>
                  );
                })}
              </motion.div>
            )}
          </motion.section>

          {/* Personalized Revision Recommendations (Phase 4 — Prompt 18) */}
          {(currentKnowledgeGraph || activeGraph) && (currentKnowledgeGraph?.nodes?.length || activeGraph?.nodes?.length || 0) > 0 && (
            <RevisionRecommendationsSection
              graph={(currentKnowledgeGraph || activeGraph)!}
              onNavigateToRevision={onNavigateToRevision}
              onNavigateToConcept={onNavigateToConcept}
              onNavigateToGraph={onNavigateToGraph}
            />
          )}

          {/* Evidence-Based Knowledge Gap Detection (Phase 4 — Prompt 16) */}
          {(currentKnowledgeGraph || activeGraph) && (currentKnowledgeGraph?.nodes?.length || activeGraph?.nodes?.length || 0) > 0 && (
            <KnowledgeGapSection
              graph={(currentKnowledgeGraph || activeGraph)!}
              onNavigateToConcept={onNavigateToConcept}
              onNavigateToRevision={onNavigateToRevision}
              onNavigateToGraph={onNavigateToGraph}
            />
          )}

          {/* 6. Concepts Worth Revisiting Section (Redesigned Editorial Layout) */}
          {conceptsWorthRevisiting.length > 0 && (
            <motion.section 
              ref={revisitSectionRef}
              className="study-revisit-section" 
              aria-label="Concepts worth revisiting"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 16 }}
              animate={hasRevisitEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.42, delay: 0.05, ease: EDITORIAL_EASE }}
            >
              <div className="study-revisit-header-block">
                <span className="study-revisit-eyebrow-clip">
                  <motion.span 
                    className="study-eyebrow study-revisit-eyebrow"
                    initial={shouldReduceMotion ? { opacity: 1, clipPath: 'inset(0 0% 0 0)', x: 0 } : { opacity: 0, clipPath: 'inset(0 100% 0 0)', x: -6 }}
                    animate={hasRevisitEnteredView ? { opacity: 1, clipPath: 'inset(0 0% 0 0)', x: 0 } : { opacity: 0, clipPath: 'inset(0 100% 0 0)', x: -6 }}
                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.48, delay: 0.04, ease: EDITORIAL_EASE }}
                  >
                    WORTH ANOTHER LOOK
                  </motion.span>
                </span>

                <motion.h2 
                  className="study-section-title"
                  title="Concepts worth revisiting"
                  initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
                  animate={hasRevisitEnteredView ? { opacity: 1 } : { opacity: 0 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.28, delay: 0.10 }}
                >
                  <span className="study-revisit-title-clip">
                    <motion.span 
                      className="study-revisit-title-line"
                      initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: '105%' }}
                      animate={hasRevisitEnteredView ? { opacity: 1, y: '0%' } : { opacity: 0, y: '105%' }}
                      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.62, delay: 0.12, ease: EDITORIAL_EASE }}
                    >
                      Concepts worth revisiting
                    </motion.span>
                  </span>
                </motion.h2>

                <motion.p 
                  className="study-section-desc"
                  initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                  animate={hasRevisitEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.46, delay: 0.24, ease: EDITORIAL_EASE }}
                >
                  Identified from questions answered incorrectly or left unanswered in your assessment history.
                </motion.p>
              </div>

              <div className="study-revisit-list">
                {displayedConcepts.map((item, idx) => (
                  <motion.div 
                    key={`${item.graphId}-${item.conceptId}`} 
                    className="study-revisit-row study-revisit-card"
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                    animate={hasRevisitEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
                    transition={shouldReduceMotion ? { duration: 0 } : {
                      duration: 0.46,
                      delay: 0.14 + idx * 0.05,
                      ease: EDITORIAL_EASE
                    }}
                  >
                    <span className="study-revisit-num" aria-hidden="true">{pad(idx + 1)}</span>
                    <div className="study-revisit-info">
                      <div className="study-revisit-top">
                        <h3 className="study-revisit-name">{item.conceptName}</h3>
                        {item.graphName && (
                          <div className="study-revisit-graph-wrap">
                            <span className="study-revisit-meta-sep" aria-hidden="true">•</span>
                            <span className="study-revisit-graph-tag" aria-label={`Knowledge graph: ${item.graphName}`}>
                              {item.graphName}
                            </span>
                          </div>
                        )}
                      </div>
                      <p className="study-revisit-status">{item.statusMessage}</p>
                    </div>

                    <div className="study-revisit-action-wrap">
                      {item.availableInGraph ? (
                        <button
                          type="button"
                          className="study-editorial-btn study-revisit-action-btn"
                          onClick={() => onNavigateToConcept?.(item.conceptId)}
                          aria-label={`Review ${item.conceptName} in knowledge graph`}
                        >
                          <span className="study-btn-content">
                            <span>REVIEW IN GRAPH</span>
                            <span className="study-btn-arrow study-revisit-arrow" aria-hidden="true">→</span>
                          </span>
                          <span className="study-btn-underline" aria-hidden="true" />
                        </button>
                      ) : (
                        <span className="study-revisit-unavailable-badge">
                          Concept not in current graph
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Show All / Show Less pagination toggle when > 5 concepts */}
              {conceptsWorthRevisiting.length > 5 && (
                <div className="study-concepts-toggle-wrap">
                  <button
                    type="button"
                    className="study-editorial-btn study-concepts-expand-btn"
                    onClick={() => setIsAllConceptsExpanded(prev => !prev)}
                    aria-expanded={isAllConceptsExpanded}
                  >
                    <span className="study-btn-content">
                      <span>
                        {isAllConceptsExpanded 
                          ? 'Show fewer concepts' 
                          : `Show all ${conceptsWorthRevisiting.length} concepts worth revisiting`}
                      </span>
                      <span className={`study-btn-arrow study-concepts-expand-arrow ${isAllConceptsExpanded ? 'expanded' : ''}`} aria-hidden="true">
                        {isAllConceptsExpanded ? '↑' : '↓'}
                      </span>
                    </span>
                    <span className="study-btn-underline" aria-hidden="true" />
                  </button>
                </div>
              )}
            </motion.section>
          )}
        </>
      )}
    </div>
  );
}
