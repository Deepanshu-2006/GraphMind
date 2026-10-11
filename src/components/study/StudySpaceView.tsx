import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion, useInView, animate } from 'framer-motion';
import { Search, X, ChevronDown } from 'lucide-react';
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
import { loadGraphs, loadActiveGraphId } from '../../services/storage';
import { useOptionalGraph } from '../../context/GraphContext';
import { TestResultsView } from '../test/TestResultsView';
import { TestReviewView } from '../test/TestReviewView';
import { MissedConceptsReview } from '../test/MissedConceptsReview';
import { getArcEndpoint } from './CircularScore';

export interface StudySpaceViewProps {
  onNavigateToGraph: () => void;
  onNavigateToConcept?: (conceptId: string) => void;
  activeGraph?: KnowledgeGraph | null;
  initialAttemptId?: string | null;
}

type StudyViewMode = 'list' | 'historical-results' | 'review-answers' | 'review-missed';
type StudyFilterMode = 'all' | 'needs-review';

const REVEAL_EASE = [0.16, 1, 0.3, 1] as const;
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
  latestAttempt: AssessmentAttempt;
  previousAttempts: AssessmentAttempt[];
  progressComparison?: ScoreComparison;
}

export interface LearningTrajectoryRowProps {
  prog: GraphLearningProgress;
  hoveredPointAttemptId: string | null;
  setHoveredPointAttemptId: (id: string | null) => void;
  handleOpenAttempt: (attemptId: string) => void;
  shouldReduceMotion: boolean;
  isFirst: boolean;
}

export function LearningTrajectoryRow({
  prog,
  hoveredPointAttemptId,
  setHoveredPointAttemptId,
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

      // Trigger only when user has scrolled into view or row is comfortably in mid-viewport
      const isMeaningfullyVisible = (scrollTop > 35 && relativeTop < containerHeight * 0.92 && relativeTop > -rect.height + 40)
        || (relativeTop < containerHeight * 0.62 && relativeTop > -rect.height + 40);

      if (isMeaningfullyVisible) {
        setRowInView(true);
        return true;
      }
      return false;
    };

    if (checkVisibility()) return;

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
    const duration = 1050; // 900–1200ms target duration
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

  const [isPathSettled, setIsPathSettled] = useState(Boolean(shouldReduceMotion));

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
  const coords = pts.map((pt, i) => {
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

  const pathD = N >= 2 ? coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ') : '';

  // Synchronized animation timings calculated from actual path geometry
  const LINE_DELAY = 0.25;
  const LINE_DURATION = 1.35;

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

    const delays = dists.map(dist => {
      const progressFrac = totalLen > 0 ? dist / totalLen : 0;
      // Cubic ease-out deceleration curve: p(t) = 1 - (1 - t)^3  =>  t = 1 - (1 - p)^(1/3)
      const timeFrac = progressFrac <= 0
        ? 0
        : progressFrac >= 1
          ? 1
          : 1 - Math.pow(1 - progressFrac, 1 / 3);
      return Math.round((LINE_DELAY + timeFrac * LINE_DURATION) * 1000) / 1000;
    });

    return { totalPathLength: Math.round(totalLen * 10) / 10, pointArrivalDelays: delays };
  }, [coords]);

  // Deterministic collision avoidance for score labels
  const visibleLabels = useMemo(() => {
    const visible = new Set<string>();
    if (N === 0) return visible;

    if (hoveredPointAttemptId) {
      visible.add(hoveredPointAttemptId);
    }

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
  }, [coords, N, hoveredPointAttemptId]);

  const activePointCoord = useMemo(() => {
    return hoveredPointAttemptId ? coords.find(c => c.pt.attemptId === hoveredPointAttemptId) : null;
  }, [coords, hoveredPointAttemptId]);

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
          <span className="study-progress-attempts-count study-trajectory-attempts-count">
            {prog.totalAttempts} completed {prog.totalAttempts === 1 ? 'attempt' : 'attempts'}
          </span>
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
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.38, delay: 0.45, ease: REVEAL_EASE }}
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
        <div className="study-progress-svg-wrap study-trajectory-chart-shell">
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

            {/* PHASE 3 — Trajectory Drawing Line */}
            {N >= 2 && pathD && (
              <motion.path
                d={pathD}
                fill="none"
                className="study-trajectory-line"
                stroke="var(--accent, #A3FF12)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={isPathSettled ? { strokeDasharray: 'none' } : undefined}
                initial={shouldReduceMotion ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                animate={rowInView ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
                transition={shouldReduceMotion ? { duration: 0 } : {
                  pathLength: { duration: LINE_DURATION, delay: LINE_DELAY, ease: REVEAL_EASE },
                  opacity: { duration: 0.2, delay: LINE_DELAY }
                }}
                onAnimationComplete={() => setIsPathSettled(true)}
              />
            )}

            {/* PHASE 4 & 5 — Interactive Data Points and Score Labels */}
            {coords.map((c, idx) => {
              const isSelected = hoveredPointAttemptId === c.pt.attemptId;
              const isLatest = idx === N - 1;
              const isHighlighted = isSelected;
              const showLabel = visibleLabels.has(c.pt.attemptId);
              const arrivalDelay = pointArrivalDelays[idx] ?? (LINE_DELAY + idx * 0.1);
              const labelDelay = arrivalDelay + 0.08;

              return (
                <motion.g
                  key={c.pt.attemptId}
                  className={`study-svg-point-node study-trajectory-node ${isHighlighted ? 'hovered active' : ''} ${isLatest ? 'latest' : ''}`}
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
                  onMouseLeave={() => setHoveredPointAttemptId(null)}
                  onMouseOver={() => setHoveredPointAttemptId(c.pt.attemptId)}
                  onFocus={() => setHoveredPointAttemptId(c.pt.attemptId)}
                  onBlur={() => setHoveredPointAttemptId(null)}
                  initial={shouldReduceMotion ? false : { scale: 0.4, opacity: 0 }}
                  animate={rowInView ? { scale: 1, opacity: 1 } : { scale: 0.4, opacity: 0 }}
                  transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.22, delay: arrivalDelay, ease: REVEAL_EASE }}
                >
                  {isHighlighted && (
                    <circle
                      cx={c.x}
                      cy={c.y}
                      r="10"
                      fill="none"
                      stroke="var(--accent, #A3FF12)"
                      strokeWidth="1"
                      strokeOpacity="0.3"
                    />
                  )}
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r={isHighlighted ? 5.5 : isLatest ? 4.5 : 3.5}
                    fill={isHighlighted ? 'var(--accent, #A3FF12)' : '#0A0A0A'}
                    stroke={isHighlighted ? '#FFFFFF' : isLatest ? 'var(--accent, #A3FF12)' : 'rgba(163, 255, 18, 0.45)'}
                    strokeWidth={isHighlighted ? 2 : isLatest ? 1.75 : 1.25}
                    className="study-trajectory-point"
                  />
                  {showLabel && (
                    <motion.text
                      x={c.x}
                      y={c.y < 42 ? c.y + 14 : c.y - 9}
                      textAnchor={c.x < X_MIN + 20 ? 'start' : c.x > X_MAX - 20 ? 'end' : 'middle'}
                      fill={isHighlighted ? '#FFFFFF' : isLatest ? 'var(--text-primary, #F5F5F5)' : '#7A7A7A'}
                      fontSize={isHighlighted ? '10.5' : isLatest ? '9.5' : '9'}
                      fontWeight={isHighlighted ? '600' : '500'}
                      fontFamily="var(--font-mono, monospace)"
                      className={`study-trajectory-point-lbl ${isHighlighted ? 'highlight' : ''}`}
                      initial={shouldReduceMotion ? false : { opacity: 0, y: c.y < 42 ? -3 : 3 }}
                      animate={rowInView ? { opacity: 1, y: 0 } : { opacity: 0, y: c.y < 42 ? -3 : 3 }}
                      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.25, delay: labelDelay, ease: REVEAL_EASE }}
                    >
                      {c.pt.scorePercentage}%
                    </motion.text>
                  )}
                </motion.g>
              );
            })}
          </svg>

          {/* Interactive Tooltip (HTML overlay, positioned over active/hovered node) */}
          {activePointCoord && (
            <div
              className="study-trajectory-tooltip"
              role="tooltip"
              style={{
                left: `${(activePointCoord.x / 760) * 100}%`,
                top: `${(activePointCoord.y / 180) * 100}%`,
                transform: activePointCoord.y < 50
                  ? 'translate(-50%, 14px)'
                  : 'translate(-50%, -100%)',
                marginTop: activePointCoord.y < 50 ? 0 : -10
              }}
            >
              <div className="study-trajectory-tooltip-row">
                <span className="study-trajectory-tooltip-num">
                  {activePointCoord.pt.attemptNumber}
                </span>
                <span className="study-trajectory-tooltip-score">
                  {activePointCoord.pt.scorePercentage}%
                </span>
              </div>
              {activePointCoord.pt.dateStr && (
                <div className="study-trajectory-tooltip-date">
                  {activePointCoord.pt.dateStr}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AREA C — Minimalist Historical Attempt Timeline */}
      <div className="study-progress-history-strip study-trajectory-strip">
        <span className="sr-only study-progress-strip-label">Score history:</span>
        <div
          className="study-progress-chips-wrap study-trajectory-chips-wrap study-trajectory-timeline"
          role="list"
          aria-label="Chronological assessment attempt timeline"
        >
          {prog.chronologicalAttempts.map((pt, pIdx) => {
            const isSelected = hoveredPointAttemptId === pt.attemptId;
            const isLatest = pIdx === N - 1;
            const timelineStart = N <= 1 ? 0.35 : LINE_DELAY + LINE_DURATION * 0.75;
            const colDelay = timelineStart + pIdx * 0.035;

            return (
              <motion.button
                key={pt.attemptId}
                type="button"
                className={`study-progress-chip study-trajectory-chip study-trajectory-timeline-col ${isSelected ? 'active' : ''} ${isLatest ? 'latest' : ''}`}
                onClick={() => handleOpenAttempt(pt.attemptId)}
                onMouseEnter={() => setHoveredPointAttemptId(pt.attemptId)}
                onMouseLeave={() => setHoveredPointAttemptId(null)}
                onMouseOver={() => setHoveredPointAttemptId(pt.attemptId)}
                onFocus={() => setHoveredPointAttemptId(pt.attemptId)}
                onBlur={() => setHoveredPointAttemptId(null)}
                aria-label={`Attempt ${pad(pIdx + 1)}: ${pt.scorePercentage}% on ${pt.dateStr}. Select to review historical results.`}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                animate={rowInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.28, delay: colDelay, ease: REVEAL_EASE }}
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
                {isSelected && (
                  <span className="study-trajectory-active-pip" aria-hidden="true" />
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

export function StudyGraphSelector({
  availableGraphs,
  selectedGraphId,
  onSelectGraph,
  onNavigateToAllGraphs,
  shouldReduceMotion = false
}: StudyGraphSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
        <span className="study-graph-selector-pip" aria-hidden="true" />
        <span className="study-graph-selector-name">
          {selectedGraph?.name || 'Select knowledge graph'}
        </span>
        <ChevronDown
          size={14}
          className={`study-graph-selector-chevron ${isOpen ? 'open' : ''}`}
          aria-hidden="true"
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            id="study-graph-selector-popover"
            className="study-graph-selector-popover"
            role="dialog"
            aria-label="Select knowledge graph"
            initial={shouldReduceMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? undefined : { opacity: 0, y: -4 }}
            transition={{ duration: 0.18, ease: REVEAL_EASE }}
          >
            <div className="study-graph-selector-popover-header">
              <span className="study-graph-selector-popover-kicker">KNOWLEDGE GRAPHS</span>
              <span className="study-graph-selector-popover-count">
                {availableGraphs.length} {availableGraphs.length === 1 ? 'graph' : 'graphs'}
              </span>
            </div>

            <div className="study-graph-selector-search-box">
              <Search size={13} className="study-graph-selector-search-icon" aria-hidden="true" />
              <input
                ref={searchInputRef}
                type="text"
                className="study-graph-selector-search-input"
                placeholder="Search knowledge graphs…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Filter knowledge graphs by name"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="study-graph-selector-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>

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
                  <button
                    key={g.id}
                    type="button"
                    role="option"
                    id={`graph-opt-${g.id}`}
                    aria-selected={isSelected}
                    className={`study-graph-selector-option ${isSelected ? 'is-selected' : ''} ${isHighlighted ? 'is-highlighted' : ''}`}
                    onClick={() => {
                      onSelectGraph(g.id);
                      setIsOpen(false);
                    }}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                  >
                    <div className="study-graph-selector-option-main">
                      {isSelected && <span className="study-graph-selector-option-pip" aria-hidden="true" />}
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
                      <span className="study-graph-selector-option-score">
                        {g.latestScore}%
                      </span>
                    )}
                  </button>
                );
              })}

              {filteredGraphs.length === 0 && (
                <div className="study-graph-selector-empty-search">
                  <span className="study-graph-selector-empty-text">
                    No knowledge graphs match "{searchQuery}"
                  </span>
                  <button
                    type="button"
                    className="study-graph-selector-empty-clear"
                    onClick={() => setSearchQuery('')}
                  >
                    Clear search
                  </button>
                </div>
              )}
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

  // Expanded graph groups map for previous attempts disclosure
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<string>>(new Set());

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

  const selectedGraphMeta = useMemo(() => {
    if (!effectiveSelectedGraphId) return null;
    return availableGraphs.find(g => g.id === effectiveSelectedGraphId) || null;
  }, [availableGraphs, effectiveSelectedGraphId]);

  const selectedGraphProgress = useMemo<GraphLearningProgress | null>(() => {
    if (!effectiveSelectedGraphId) return null;
    return computeGraphLearningProgress(effectiveSelectedGraphId, attempts);
  }, [effectiveSelectedGraphId, attempts]);

  // Assessment History scope filter: 'all' or 'selected'
  const [historyScope, setHistoryScope] = useState<'all' | 'selected'>('all');

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

  // Toggle expanded state for a graph group
  const toggleGroupExpanded = useCallback((groupId: string) => {
    setExpandedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
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

  // Compute attempt numbers per graph chronologically (Attempt 01, 02...)
  const attemptNumberMap = useMemo(() => {
    const byGraph: Record<string, AssessmentAttempt[]> = {};
    for (const a of attempts) {
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
  }, [attempts]);

  // Organize attempts into Graph Groups (Section 2, 3, 4, 5)
  const graphGroups = useMemo<GraphAttemptGroup[]>(() => {
    const groupsMap: Record<string, { graphName: string; list: AssessmentAttempt[] }> = {};

    for (const a of attempts) {
      // Use stable graph identifier, fallback to graph name or attempt id if missing
      const key = a.graphId || a.graphName || `unassigned-${a.id}`;
      if (!groupsMap[key]) {
        groupsMap[key] = {
          graphName: a.graphName || 'Assessment',
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
        latestAttempt,
        previousAttempts,
        progressComparison
      });
    }

    // Order graph groups by most recent activity descending (newest latestAttempt first)
    return result.sort((a, b) => {
      return new Date(b.latestAttempt.completedAt).getTime() - new Date(a.latestAttempt.completedAt).getTime();
    });
  }, [attempts]);

  // Filtered graph groups based on search query, review filter, and selected graph scope (Section 6 & 8)
  const filteredGroups = useMemo<GraphAttemptGroup[]>(() => {
    return graphGroups.filter(group => {
      // Filter by selected graph if historyScope is 'selected'
      if (historyScope === 'selected' && effectiveSelectedGraphId && group.graphId !== effectiveSelectedGraphId) {
        return false;
      }

      // Search matching
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = group.graphName.toLowerCase().includes(q);
        const matchesConcepts = group.latestAttempt.conceptNames?.some(c => c.toLowerCase().includes(q));
        if (!matchesName && !matchesConcepts) {
          return false;
        }
      }

      // Filter: needs review
      if (filterMode === 'needs-review') {
        const score = group.latestAttempt.scorePercentage;
        const missed = group.latestAttempt.resultsSummary?.reviewRecommendedConcepts?.length || 0;
        if (score >= 80 && missed === 0) {
          return false;
        }
      }

      return true;
    });
  }, [graphGroups, searchQuery, filterMode, historyScope, effectiveSelectedGraphId]);

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

  // Selected graph attempts: strictly filtered by effectiveSelectedGraphId
  const selectedGraphAttempts = useMemo<AssessmentAttempt[]>(() => {
    if (!effectiveSelectedGraphId || !Array.isArray(attempts)) return [];
    return attempts.filter(a => {
      const gid = a.graphId || `unassigned-${a.id}`;
      return gid === effectiveSelectedGraphId;
    });
  }, [effectiveSelectedGraphId, attempts]);

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

  const lastAnimatedGraphIdRef = useRef<string | null>(null);
  const hasAnimatedRef = useRef(false);
  const endpointRef = useRef<SVGCircleElement | null>(null);
  const [displayedScore, setDisplayedScore] = useState<number>(() => {
    return shouldReduceMotion ? clampedScore : 0;
  });

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
    // Arc delay is 320ms and runs for 1200ms with REVEAL_EASE.
    // Counter timeout starts at 320ms and runs for 1200ms with REVEAL_EASE.
    // Both finish simultaneously at 1520ms.
    let controls: { stop: () => void } | null = null;
    const timer = setTimeout(() => {
      if (endpointRef.current && clampedScore > 0) {
        endpointRef.current.style.opacity = '1';
      }
      controls = animate(0, clampedScore, {
        duration: 1.2,
        ease: REVEAL_EASE,
        onUpdate: (latest) => {
          const rounded = Math.round(latest);
          setDisplayedScore(prev => (prev !== rounded ? rounded : prev));
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
    }, 320);

    return () => {
      clearTimeout(timer);
      if (controls) {
        controls.stop();
      }
    };
  }, [hasContinueEnteredView, clampedScore, shouldReduceMotion, effectiveSelectedGraphId]);


  // Derive concepts worth revisiting across historical attempts (Prompt 5 Phase 5)
  const conceptsWorthRevisiting = useMemo<ConceptRevisitItem[]>(() => {
    return deriveConceptsWorthRevisiting(attempts, activeGraph);
  }, [attempts, activeGraph]);

  // Hovered attempt point for chart inspection
  const [hoveredPointAttemptId, setHoveredPointAttemptId] = useState<string | null>(null);

  // Show all concepts toggle for Concepts Worth Revisiting
  const [isAllConceptsExpanded, setIsAllConceptsExpanded] = useState(false);

  // Displayed concepts slice (first 5 by default if more than 5 exist)
  const displayedConcepts = useMemo(() => {
    if (isAllConceptsExpanded || conceptsWorthRevisiting.length <= 5) {
      return conceptsWorthRevisiting;
    }
    return conceptsWorthRevisiting.slice(0, 5);
  }, [conceptsWorthRevisiting, isAllConceptsExpanded]);

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
                <div className="study-continue-grid">
                  {/* LEFT: Complete Assessment Narrative & Performance Hierarchy */}
                  <div className="study-continue-info">
                    {/* AREA A — Section Context & Prominent Graph Title (Upper-Left) */}
                    <div className="study-continue-context-layer">
                      <div className="study-continue-eyebrow-row">
                        <motion.span 
                          className="study-continue-kicker"
                          initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                          animate={hasContinueEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
                          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.30, delay: 0.04, ease: REVEAL_EASE }}
                        >
                          CONTINUE LEARNING
                        </motion.span>
                      </div>

                      <div className="study-continue-identity-row">
                        <motion.h2 
                          className="study-continue-title" 
                          title="Your learning, in progress."
                          initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                          animate={hasContinueEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.35, delay: 0.08, ease: REVEAL_EASE }}
                        >
                          Your learning, in progress.
                        </motion.h2>

                        <motion.div 
                          className="study-continue-meta-stack"
                          initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                          animate={hasContinueEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
                          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.30, delay: 0.12, ease: REVEAL_EASE }}
                        >
                          {latestAttempt ? (
                            <span className="study-continue-graph-name">{latestAttempt.graphName}</span>
                          ) : (
                            <span className="study-continue-graph-name">{selectedGraphMeta.name}</span>
                          )}
                          <div className="study-continue-context-line">
                            {latestAttempt && latestDateInfo ? (
                              <>
                                <span>{latestDateInfo.dateStr}</span>
                                <span className="study-meta-dot" aria-hidden="true">·</span>
                                <span>{latestAttempt.totalQuestions} questions</span>
                              </>
                            ) : (
                              <span>No assessments yet</span>
                            )}
                          </div>
                        </motion.div>
                      </div>
                    </div>

                    {/* AREA C — Results Summary & Connected Next Action */}
                    <motion.div 
                      className="study-continue-summary-block"
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                      animate={hasContinueEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.35, delay: 0.18, ease: REVEAL_EASE }}
                    >
                      {latestAttempt ? (
                        /* Three-Column Horizontal Results Distribution: Left (Score) - Middle (Insight) - Right (Action) */
                        <div className="study-continue-results-action-group">
                          {/* LEFT: Correct-Answer Statistic */}
                          <div className="study-continue-ratio-row">
                            <div className="study-continue-ratio-num">
                              <span className="study-ratio-numerator">{pad(latestAttempt.correctAnswers)}</span>
                              <span className="study-continue-ratio-slash">/</span>
                              <span className="study-ratio-denominator">{pad(latestAttempt.totalQuestions)}</span>
                            </div>
                            <span className="study-continue-ratio-lbl">CORRECT ANSWERS</span>
                          </div>

                          {/* MIDDLE: Missed-Concept Count */}
                          <div className="study-continue-meta">
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
                          </div>

                          {/* RIGHT: Connected Next Action */}
                          <div className="study-continue-action-row">
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
                          </div>
                        </div>
                      ) : (
                        /* Empty state when selected knowledge graph has no assessment attempts yet */
                        <div className="study-continue-empty-body">
                          <p className="study-continue-empty-msg">
                            Start your first assessment for this knowledge graph to track your understanding and identify concepts to revisit.
                          </p>
                          <div className="study-continue-action-row">
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
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </div>

                  {/* AREA B — Performance Visualization (Focal Circular Score) */}
                  <motion.div 
                    className="study-continue-action-wrap"
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={hasContinueEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.40, delay: 0.22, ease: REVEAL_EASE }}
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
                                strokeDashoffset: { duration: 1.2, delay: 0.32, ease: REVEAL_EASE },
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
                              <span className="study-continue-score-pct">{displayedScore}%</span>
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
                <span className="study-eyebrow study-trajectory-eyebrow">LEARNING PROGRESS</span>
                <h2 className="study-section-title study-trajectory-section-title">Your learning, over time.</h2>
                <p className="study-section-desc study-trajectory-section-desc">
                  See how your understanding changes with every assessment.
                </p>
              </div>

              <div className="study-progress-cards-list study-trajectory-list">
                {selectedGraphProgress ? (
                  <LearningTrajectoryRow
                    key={selectedGraphProgress.graphId}
                    prog={selectedGraphProgress}
                    hoveredPointAttemptId={hoveredPointAttemptId}
                    setHoveredPointAttemptId={setHoveredPointAttemptId}
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
            className="study-history-section" 
            aria-label="Assessment history"
            initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.12, ease: REVEAL_EASE }}
          >
            <div className="study-history-header-block">
              <h2 className="study-section-title">Assessment history</h2>
              <p className="study-section-desc">Every completed assessment, ready to revisit.</p>

              {/* Compact Search & Filter Toolbar (Section 6 & 8) */}
              <div className="study-controls-bar">
                <div className="study-search-wrap">
                  <Search size={14} className="study-search-icon" aria-hidden="true" />
                  <input
                    type="text"
                    className="study-search-input"
                    placeholder="Search by graph or concept…"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    aria-label="Search assessment history by graph or concept"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      className="study-search-clear"
                      onClick={() => setSearchQuery('')}
                      aria-label="Clear search query"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>

                <div className="study-filter-tabs" role="tablist" aria-label="Assessment filter">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={filterMode === 'all' && historyScope === 'all'}
                    className={`study-filter-tab ${filterMode === 'all' && historyScope === 'all' ? 'active' : ''}`}
                    onClick={() => { setFilterMode('all'); setHistoryScope('all'); }}
                  >
                    All assessments
                  </button>
                  {selectedGraphMeta && (
                    <button
                      type="button"
                      role="tab"
                      aria-selected={historyScope === 'selected'}
                      className={`study-filter-tab study-filter-tab-graph ${historyScope === 'selected' ? 'active' : ''}`}
                      onClick={() => setHistoryScope(prev => prev === 'selected' ? 'all' : 'selected')}
                      title={`Filter history to ${selectedGraphMeta.name}`}
                    >
                      <span className="study-filter-tag-dot" aria-hidden="true" />
                      <span>{selectedGraphMeta.name}</span>
                      {historyScope === 'selected' && (
                        <span
                          className="study-filter-tag-clear"
                          role="button"
                          aria-label="Clear graph filter and show all graphs"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHistoryScope('all');
                          }}
                        >
                          ×
                        </span>
                      )}
                    </button>
                  )}
                  <button
                    type="button"
                    role="tab"
                    aria-selected={filterMode === 'needs-review'}
                    className={`study-filter-tab ${filterMode === 'needs-review' ? 'active' : ''}`}
                    onClick={() => setFilterMode('needs-review')}
                  >
                    Needs review
                  </button>
                </div>
              </div>
            </div>

            {/* Search/Filter Empty State */}
            {filteredGroups.length === 0 && (
              <div className="study-search-empty">
                <span className="study-search-empty-title">
                  {historyScope === 'selected'
                    ? `No assessments found for "${selectedGraphMeta?.name || 'this graph'}"`
                    : searchQuery.trim()
                    ? `No assessments found matching "${searchQuery}"`
                    : 'No assessments found for the selected filter.'}
                </span>
                <p className="study-search-empty-sub">
                  {historyScope === 'selected'
                    ? 'This knowledge graph has no assessment attempts matching the current filter.'
                    : 'Try searching for another keyword or reset active filters.'}
                </p>
                <button
                  type="button"
                  className="study-editorial-btn"
                  onClick={() => { setSearchQuery(''); setFilterMode('all'); setHistoryScope('all'); }}
                >
                  <span className="study-btn-content">
                    <span>{historyScope === 'selected' ? 'View all knowledge graphs' : 'Clear search filters'}</span>
                    <span className="study-btn-arrow" aria-hidden="true">→</span>
                  </span>
                  <span className="study-btn-underline" aria-hidden="true" />
                </button>
              </div>
            )}

            {/* Graph Groups List */}
            {filteredGroups.length > 0 && (
              <div className="study-groups-list">
                {filteredGroups.map((group) => {
                  const latest = group.latestAttempt;
                  const latestDate = formatAttemptDate(latest.completedAt);
                  const isExpanded = expandedGroupIds.has(group.graphId);
                  const latestAttemptNumber = attemptNumberMap.get(latest.id) || '01';
                  const missedInLatest = latest.resultsSummary?.reviewRecommendedConcepts?.length || 0;

                  return (
                    <div key={group.graphId} className="study-graph-group">
                      {/* Group Header (Section 2) */}
                      <div className="study-group-header">
                        <div className="study-group-title-block">
                          <h3 className="study-group-name">{group.graphName}</h3>
                          <div className="study-group-meta">
                            Knowledge graph · {group.totalAttempts} {group.totalAttempts === 1 ? 'attempt' : 'attempts'}
                          </div>
                        </div>

                        {/* Learning Progress Comparison (Section 5) */}
                        {group.progressComparison && (
                          <div 
                            className={`study-progress-comparison ${group.progressComparison.status}`}
                            title={`Previous: ${group.progressComparison.previousScore}% | Latest: ${group.progressComparison.latestScore}%`}
                          >
                            <span>PREVIOUS {group.progressComparison.previousScore}% → LATEST {group.progressComparison.latestScore}%</span>
                            <span className="study-meta-dot" aria-hidden="true" />
                            <span>{group.progressComparison.message}</span>
                          </div>
                        )}
                      </div>

                      {/* Latest Result Card (Section 3) */}
                      <div className="study-latest-card">
                        <div className="study-latest-kicker">
                          <span>Latest attempt · Attempt {latestAttemptNumber}</span>
                          {latest.completionReason === 'time_expired' && (
                            <span className="study-badge-expired">Time expired</span>
                          )}
                        </div>

                        <div className="study-metrics-grid">
                          <div className="study-metric-item">
                            <span className="study-metric-val">
                              {pad(latest.correctAnswers)} / {pad(latest.totalQuestions)}
                            </span>
                            <span className="study-metric-lbl">Correct answers</span>
                          </div>

                          <div className="study-metric-item">
                            <span className="study-metric-val">
                              {latest.scorePercentage}%
                            </span>
                            <span className="study-metric-lbl">Score</span>
                          </div>

                          <div className="study-metric-item">
                            <span className="study-metric-val">
                              {latestDate.dateStr}
                            </span>
                            <span className="study-metric-lbl">Completed</span>
                          </div>

                          {missedInLatest > 0 && (
                            <div className="study-metric-item">
                              <span className="study-metric-val study-meta-warm">
                                {missedInLatest}
                              </span>
                              <span className="study-metric-lbl">Concepts to review</span>
                            </div>
                          )}

                          <div className="study-metric-item action-col">
                            <button
                              type="button"
                              className="study-editorial-btn"
                              onClick={() => handleOpenAttempt(latest.id)}
                              aria-label={`View latest results for ${group.graphName}`}
                            >
                              <span className="study-btn-content">
                                <span>VIEW RESULTS</span>
                                <span className="study-btn-arrow" aria-hidden="true">→</span>
                              </span>
                              <span className="study-btn-underline" aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Previous Attempts Disclosure (Section 4) */}
                      {group.previousAttempts.length > 0 && (
                        <div className="study-previous-section">
                          <button
                            type="button"
                            className="study-disclosure-btn"
                            onClick={() => toggleGroupExpanded(group.graphId)}
                            aria-expanded={isExpanded}
                            aria-controls={`prev-attempts-${group.graphId}`}
                          >
                            <span className="study-disclosure-kicker">
                              PREVIOUS ATTEMPTS · {group.previousAttempts.length}
                            </span>
                            <span className="study-disclosure-action">
                              <span>{isExpanded ? 'HIDE HISTORY' : 'VIEW HISTORY'}</span>
                              <ChevronDown 
                                size={14} 
                                className={`study-disclosure-arrow ${isExpanded ? 'open' : ''}`}
                                aria-hidden="true"
                              />
                            </span>
                          </button>

                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                id={`prev-attempts-${group.graphId}`}
                                key={`panel-${group.graphId}`}
                                initial={shouldReduceMotion ? false : { height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={shouldReduceMotion ? undefined : { height: 0, opacity: 0 }}
                                transition={{ duration: 0.28, ease: REVEAL_EASE }}
                                className="study-previous-panel"
                              >
                                <div className="study-table-container">
                                  <table className="study-table" role="table">
                                    <thead className="study-table-head">
                                      <tr>
                                        <th scope="col" className="study-th">ATTEMPT</th>
                                        <th scope="col" className="study-th">COMPLETED</th>
                                        <th scope="col" className="study-th">RESULT</th>
                                        <th scope="col" className="study-th">QUESTIONS</th>
                                        <th scope="col" className="study-th study-th-action">ACTION</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {group.previousAttempts.map((attempt) => {
                                        const dateInfo = formatAttemptDate(attempt.completedAt);
                                        const attemptNum = attemptNumberMap.get(attempt.id) || '01';

                                        return (
                                          <tr
                                            key={attempt.id}
                                            className="study-row"
                                            tabIndex={0}
                                            onClick={() => handleOpenAttempt(attempt.id)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                handleOpenAttempt(attempt.id);
                                              }
                                            }}
                                            aria-label={`View attempt ${attemptNum} for ${group.graphName}`}
                                          >
                                            <td className="study-td">
                                              <div className="study-attempt-name">
                                                ATTEMPT {attemptNum}
                                              </div>
                                              {attempt.completionReason === 'time_expired' && (
                                                <span className="study-badge-expired">Time expired</span>
                                              )}
                                            </td>

                                            <td className="study-td">
                                              <div className="study-date-text">{dateInfo.dateStr}</div>
                                              {dateInfo.timeStr && (
                                                <div className="study-time-text">{dateInfo.timeStr}</div>
                                              )}
                                            </td>

                                            <td className="study-td">
                                              <div className="study-result-score">
                                                {pad(attempt.correctAnswers)} / {pad(attempt.totalQuestions)} correct
                                              </div>
                                              <div className="study-result-pct">
                                                {attempt.scorePercentage}%
                                              </div>
                                            </td>

                                            <td className="study-td">
                                              <div className="study-questions-count">
                                                {attempt.totalQuestions} questions
                                              </div>
                                              <div className="study-questions-time">
                                                {formatDuration(attempt.timeSpentSeconds)}
                                              </div>
                                            </td>

                                            <td className="study-td study-td-action">
                                              <button
                                                type="button"
                                                className="study-editorial-btn"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  handleOpenAttempt(attempt.id);
                                                }}
                                                aria-label={`View results for attempt ${attemptNum}`}
                                              >
                                                <span className="study-btn-content">
                                                  <span>VIEW RESULTS</span>
                                                  <span className="study-btn-arrow" aria-hidden="true">→</span>
                                                </span>
                                                <span className="study-btn-underline" aria-hidden="true" />
                                              </button>
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.section>

          {/* 6. Concepts Worth Revisiting Section (Prompt 5 Phase 5) */}
          {conceptsWorthRevisiting.length > 0 && (
            <motion.section 
              className="study-revisit-section" 
              aria-label="Concepts worth revisiting"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.16, ease: REVEAL_EASE }}
            >
              <div className="study-revisit-header-block">
                <span className="study-eyebrow">WORTH ANOTHER LOOK</span>
                <h2 className="study-section-title">Concepts worth revisiting</h2>
                <p className="study-section-desc">
                  Identified from questions answered incorrectly or left unanswered in your assessment history.
                </p>
              </div>

              <div className="study-revisit-list">
                {displayedConcepts.map((item, idx) => (
                  <div key={`${item.graphId}-${item.conceptId}`} className="study-revisit-card">
                    <span className="study-revisit-num" aria-hidden="true">{pad(idx + 1)}</span>
                    <div className="study-revisit-info">
                      <div className="study-revisit-top">
                        <h3 className="study-revisit-name">{item.conceptName}</h3>
                        {item.graphName && (
                          <span className="study-revisit-graph-tag">
                            {item.graphName}
                          </span>
                        )}
                      </div>
                      <p className="study-revisit-status">{item.statusMessage}</p>
                    </div>

                    <div className="study-revisit-action-wrap">
                      {item.availableInGraph ? (
                        <button
                          type="button"
                          className="study-editorial-btn"
                          onClick={() => onNavigateToConcept?.(item.conceptId)}
                          aria-label={`Review ${item.conceptName} in knowledge graph`}
                        >
                          <span className="study-btn-content">
                            <span>REVIEW IN GRAPH</span>
                            <span className="study-btn-arrow" aria-hidden="true">→</span>
                          </span>
                          <span className="study-btn-underline" aria-hidden="true" />
                        </button>
                      ) : (
                        <span className="study-revisit-unavailable-badge">
                          Concept not in current graph
                        </span>
                      )}
                    </div>
                  </div>
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
                      <span className="study-btn-arrow" aria-hidden="true">
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
