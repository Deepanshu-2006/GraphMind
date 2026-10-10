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
import { TestResultsView } from '../test/TestResultsView';
import { TestReviewView } from '../test/TestReviewView';
import { MissedConceptsReview } from '../test/MissedConceptsReview';

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

  // Filtered graph groups based on search query and review filter (Section 6)
  const filteredGroups = useMemo<GraphAttemptGroup[]>(() => {
    return graphGroups.filter(group => {
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

  // Top/latest attempt for "Continue learning" section
  const latestAttempt = attempts.length > 0 ? attempts[0] : null;
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

  const [displayedScore, setDisplayedScore] = useState<number>(() => {
    return shouldReduceMotion ? clampedScore : 0;
  });

  useEffect(() => {
    if (!hasContinueEnteredView) return;
    if (shouldReduceMotion) {
      setDisplayedScore(clampedScore);
      return;
    }

    // Coordinated entrance: counter animates in lockstep with the SVG arc drawing
    // Arc delay is 320ms and runs for 1200ms with REVEAL_EASE.
    // Counter timeout starts at 320ms and runs for 1200ms with REVEAL_EASE.
    // Both finish simultaneously at 1520ms.
    const timer = setTimeout(() => {
      const controls = animate(0, clampedScore, {
        duration: 1.2,
        ease: REVEAL_EASE,
        onUpdate: (latest) => {
          setDisplayedScore(Math.round(latest));
        }
      });
      return () => controls.stop();
    }, 320);

    return () => clearTimeout(timer);
  }, [hasContinueEnteredView, clampedScore, shouldReduceMotion]);

  // Compute learning progress across attempts grouped strictly by stable graphId (Prompt 5)
  const allGraphProgress = useMemo<GraphLearningProgress[]>(() => {
    const graphIds: string[] = [];
    for (const a of attempts) {
      const gid = a.graphId || `unassigned-${a.id}`;
      if (!graphIds.includes(gid)) {
        graphIds.push(gid);
      }
    }

    const list: GraphLearningProgress[] = [];
    for (const gid of graphIds) {
      const prog = computeGraphLearningProgress(gid, attempts);
      if (prog) {
        list.push(prog);
      }
    }

    // Sort: active graph first if matching, otherwise latest attempt completion descending
    return list.sort((a, b) => {
      if (activeGraph && a.graphId === activeGraph.id) return -1;
      if (activeGraph && b.graphId === activeGraph.id) return 1;
      const timeA = new Date(a.latestAttempt.completedAt).getTime() || 0;
      const timeB = new Date(b.latestAttempt.completedAt).getTime() || 0;
      return timeB - timeA;
    });
  }, [attempts, activeGraph]);

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
          {/* 3. Continue Learning Section (V6 Open Editorial Composition) */}
          {latestAttempt && latestDateInfo && (
            <motion.section 
              ref={continueSectionRef}
              className="study-continue-section" 
              aria-label="Continue learning"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={hasContinueEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
              transition={{ duration: 0.35, delay: 0.04, ease: REVEAL_EASE }}
            >
              <div className="study-continue-box">
                {/* LAYER A & LAYER B: Section Context & Graph Identity */}
                <div className="study-continue-context-layer">
                  {/* Layer A — Section Context */}
                  <div className="study-continue-eyebrow-row">
                    <motion.span 
                      className="study-continue-kicker"
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                      animate={hasContinueEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
                      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.30, delay: 0.04, ease: REVEAL_EASE }}
                    >
                      CONTINUE LEARNING
                    </motion.span>
                    <motion.span 
                      className="study-continue-eyebrow-tag"
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                      animate={hasContinueEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
                      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.30, delay: 0.06, ease: REVEAL_EASE }}
                    >
                      LATEST ASSESSMENT
                    </motion.span>
                  </div>

                  {/* Layer B — Graph Identity */}
                  <div className="study-continue-identity-row">
                    <motion.h2 
                      className="study-continue-title" 
                      title={latestAttempt.graphName}
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                      animate={hasContinueEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.35, delay: 0.08, ease: REVEAL_EASE }}
                    >
                      {latestAttempt.graphName}
                    </motion.h2>

                    <motion.div 
                      className="study-continue-context-line"
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                      animate={hasContinueEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
                      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.30, delay: 0.14, ease: REVEAL_EASE }}
                    >
                      <span>{latestDateInfo.dateStr}</span>
                    </motion.div>
                  </div>
                </div>

                {/* LAYER C: Asymmetric Performance Grid (Left Story + Right Circular Counterweight) */}
                <div className="study-continue-grid">
                  {/* Left Region — Performance Summary */}
                  <div className="study-continue-info">
                    <motion.div 
                      className="study-continue-summary-block"
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                      animate={hasContinueEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.35, delay: 0.20, ease: REVEAL_EASE }}
                    >
                      <div className="study-continue-ratio-row">
                        <div className="study-continue-ratio-num">
                          <span>{pad(latestAttempt.correctAnswers)}</span>
                          <span className="study-continue-ratio-slash">/</span>
                          <span>{pad(latestAttempt.totalQuestions)}</span>
                        </div>
                        <span className="study-continue-ratio-lbl">CORRECT ANSWERS</span>
                      </div>

                      <div className="study-continue-meta">
                        <span>{latestAttempt.totalQuestions} questions</span>
                        {missedCount > 0 ? (
                          <>
                            <span className="study-meta-dot" aria-hidden="true" />
                            <span className="study-meta-warm">
                              {missedCount} concept{missedCount === 1 ? '' : 's'} to revisit
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="study-meta-dot" aria-hidden="true" />
                            <span className="study-meta-highlight">
                              All concepts mastered
                            </span>
                          </>
                        )}
                      </div>
                    </motion.div>
                  </div>

                  {/* Right Region — Score Visualization & Action */}
                  <motion.div 
                    className="study-continue-action-wrap"
                    initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                    animate={hasContinueEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
                    transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.40, delay: 0.24, ease: REVEAL_EASE }}
                  >
                    <div className="study-continue-score-block">
                      <div className="study-continue-circle-wrap">
                        <svg 
                          className="study-continue-circle-svg" 
                          width="200" 
                          height="200" 
                          viewBox="0 0 200 200" 
                          role="progressbar" 
                          aria-valuenow={clampedScore} 
                          aria-valuemin={0} 
                          aria-valuemax={100} 
                          aria-label={`Assessment score: ${clampedScore}%`}
                        >
                          <circle 
                            cx="100" 
                            cy="100" 
                            r={CIRCLE_RADIUS} 
                            className="study-continue-circle-track" 
                          />
                          <motion.circle 
                            cx="100" 
                            cy="100" 
                            r={CIRCLE_RADIUS} 
                            className="study-continue-circle-arc"
                            transform="rotate(-90 100 100)"
                            strokeDasharray={CIRCLE_CIRCUMFERENCE}
                            initial={shouldReduceMotion ? false : { strokeDashoffset: CIRCLE_CIRCUMFERENCE, opacity: 0 }}
                            animate={hasContinueEnteredView ? {
                              strokeDashoffset: CIRCLE_CIRCUMFERENCE * (1 - clampedScore / 100),
                              opacity: clampedScore === 0 ? 0 : 1
                            } : { strokeDashoffset: CIRCLE_CIRCUMFERENCE, opacity: 0 }}
                            transition={shouldReduceMotion ? { duration: 0 } : { duration: 1.2, delay: 0.32, ease: REVEAL_EASE }}
                          />
                        </svg>
                        <div className="study-continue-circle-content" aria-hidden="true">
                          <span className="study-continue-score-pct">{displayedScore}%</span>
                          <span className="study-continue-circle-lbl">SCORE</span>
                        </div>
                      </div>
                    </div>

                    {/* Editorial Text Action directly anchored below the circle */}
                    <motion.div
                      className="study-continue-action-row"
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 4 }}
                      animate={hasContinueEnteredView ? { opacity: 1, y: 0 } : { opacity: 0, y: 4 }}
                      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.35, delay: 0.38, ease: REVEAL_EASE }}
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
                  </motion.div>
                </div>
              </div>
            </motion.section>
          )}

          {/* 4. Learning Progress Section Across Assessment Attempts (Prompt 5) */}
          {allGraphProgress.length > 0 && (
            <motion.section 
              className="study-progress-section" 
              aria-label="Learning progress"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.42, delay: 0.08, ease: REVEAL_EASE }}
            >
              <div className="study-section-header-block">
                <span className="study-eyebrow">PROGRESS OVER TIME</span>
                <h2 className="study-section-title">Learning progress</h2>
                <p className="study-section-desc">
                  Track how your understanding of each knowledge graph evolves across attempts.
                </p>
              </div>

              <div className="study-progress-cards-list">
                {allGraphProgress.map((prog) => {
                  const latestDate = formatAttemptDate(prog.latestAttempt.completedAt);
                  const prevDate = prog.previousAttempt ? formatAttemptDate(prog.previousAttempt.completedAt) : null;
                  const isUnchangedOrZero = prog.comparisonStatus === 'unchanged' || (prog.hasComparison && prog.latestScore === 0 && prog.previousScore === 0);

                  return (
                    <div key={prog.graphId} className="study-progress-card">
                      <div className="study-progress-card-header">
                        <div className="study-progress-card-title-wrap">
                          <span className="study-progress-kicker">KNOWLEDGE GRAPH</span>
                          <h3 className="study-progress-graph-name">{prog.graphName}</h3>
                          <span className="study-progress-attempts-count">
                            {prog.totalAttempts} completed {prog.totalAttempts === 1 ? 'attempt' : 'attempts'}
                          </span>
                        </div>

                        {prog.hasComparison && prog.comparisonStatus && (
                          <div 
                            className={`study-progress-badge ${isUnchangedOrZero ? 'unchanged' : prog.comparisonStatus}`}
                            title={prog.comparisonMessage}
                          >
                            <span className="study-progress-badge-symbol">
                              {prog.comparisonStatus === 'improved' && !isUnchangedOrZero ? '+' : prog.comparisonStatus === 'declined' ? '−' : '·'}
                            </span>
                            <span>
                              {isUnchangedOrZero ? '0 percentage points' : prog.scoreChangeFormatted}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="study-progress-metrics">
                        <div className="study-progress-metric">
                          <span className="study-progress-metric-label">Latest score</span>
                          <span className="study-progress-metric-val">{prog.latestScore}%</span>
                          <span className="study-progress-metric-date">{latestDate.dateStr}</span>
                        </div>

                        {prog.hasComparison && prog.previousScore !== undefined && prevDate ? (
                          <>
                            <div className="study-progress-metric">
                              <span className="study-progress-metric-label">Previous score</span>
                              <span className="study-progress-metric-val">{prog.previousScore}%</span>
                              <span className="study-progress-metric-date">{prevDate.dateStr}</span>
                            </div>
                            <div className="study-progress-metric">
                              <span className="study-progress-metric-label">Change</span>
                              <span className={`study-progress-metric-val study-progress-diff-${isUnchangedOrZero ? 'unchanged' : prog.comparisonStatus}`}>
                                {isUnchangedOrZero ? '0 percentage points' : prog.scoreChangeFormatted}
                              </span>
                              <span className="study-progress-metric-date">
                                {isUnchangedOrZero ? 'Unchanged (same score as previous)' : 'Normalized percentage points'}
                              </span>
                            </div>
                          </>
                        ) : (
                          <div className="study-progress-metric study-progress-single-note">
                            <span className="study-progress-metric-label">Score comparison</span>
                            <span className="study-progress-metric-val study-progress-note-text">
                              Complete another assessment on this graph to track score changes.
                            </span>
                          </div>
                        )}

                        <div className="study-progress-metric">
                          <span className="study-progress-metric-label">Completed attempts</span>
                          <span className="study-progress-metric-val">{prog.totalAttempts}</span>
                          <span className="study-progress-metric-date">Total saved snapshots</span>
                        </div>
                      </div>

                      {/* Chronological Score History Visualization */}
                      <div className="study-progress-timeline-block">
                        <div className="study-progress-timeline-header">
                          <span className="study-progress-timeline-title">Score history</span>
                          <span className="study-progress-timeline-hint">
                            Select any attempt to review historical results
                          </span>
                        </div>

                        {/* SVG Chart if >= 2 attempts */}
                        {prog.chronologicalAttempts.length >= 2 && (
                          <div className="study-progress-svg-wrap">
                            <svg
                              viewBox="0 0 540 80"
                              className="study-progress-svg"
                              preserveAspectRatio="none"
                              aria-label={`Score history chart for ${prog.graphName}`}
                            >
                              {/* Reference lines at 100%, 50%, 0% */}
                              <line
                                x1="38"
                                y1="16"
                                x2="510"
                                y2="16"
                                stroke="rgba(255,255,255,0.05)"
                                strokeDasharray="3 3"
                              />
                              <text x="30" y="19" textAnchor="end" fill="#555555" fontSize="9" fontFamily="var(--font-mono, monospace)">100%</text>

                              <line
                                x1="38"
                                y1="40"
                                x2="510"
                                y2="40"
                                stroke="rgba(255,255,255,0.04)"
                                strokeDasharray="3 3"
                              />
                              <text x="30" y="43" textAnchor="end" fill="#444444" fontSize="9" fontFamily="var(--font-mono, monospace)">50%</text>

                              <line
                                x1="38"
                                y1="64"
                                x2="510"
                                y2="64"
                                stroke="rgba(255,255,255,0.05)"
                                strokeDasharray="3 3"
                              />
                              <text x="30" y="67" textAnchor="end" fill="#555555" fontSize="9" fontFamily="var(--font-mono, monospace)">0%</text>

                              {/* Calculated polyline and area path */}
                              {(() => {
                                const pts = prog.chronologicalAttempts;
                                const coords = pts.map((pt, i) => {
                                  const x = 44 + (i / (pts.length - 1)) * (510 - 44);
                                  const y = 16 + ((100 - pt.scorePercentage) / 100) * (64 - 16);
                                  return { x, y, pt };
                                });

                                const pathD = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(' ');
                                const isImproved = prog.comparisonStatus === 'improved' && !isUnchangedOrZero;
                                const strokeColor = isImproved ? 'var(--accent, #A3FF12)' : 'rgba(255, 255, 255, 0.22)';

                                return (
                                  <>
                                    <path
                                      d={pathD}
                                      fill="none"
                                      stroke={strokeColor}
                                      strokeWidth="1.75"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                    {coords.map((c, idx) => {
                                      const isHovered = hoveredPointAttemptId === c.pt.attemptId;
                                      const showLabel = pts.length <= 6 || idx === 0 || idx === pts.length - 1 || isHovered;

                                      return (
                                        <g
                                          key={c.pt.attemptId}
                                          className={`study-svg-point-node ${isHovered ? 'hovered' : ''}`}
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
                                          onFocus={() => setHoveredPointAttemptId(c.pt.attemptId)}
                                          onBlur={() => setHoveredPointAttemptId(null)}
                                        >
                                          <circle
                                            cx={c.x}
                                            cy={c.y}
                                            r={isHovered ? 5.5 : 4}
                                            fill="#101010"
                                            stroke={isHovered ? 'var(--accent, #A3FF12)' : isImproved && idx === pts.length - 1 ? 'var(--accent, #A3FF12)' : 'rgba(255, 255, 255, 0.45)'}
                                            strokeWidth={isHovered ? 2 : 1.5}
                                          />
                                          {showLabel && (
                                            <text
                                              x={c.x}
                                              y={c.y < 28 ? c.y + 13 : c.y - 7}
                                              textAnchor="middle"
                                              fill={isHovered ? 'var(--text-primary, #F5F5F5)' : '#8A8A8A'}
                                              fontSize="10"
                                              fontWeight={isHovered ? '600' : '500'}
                                              fontFamily="var(--font-mono, monospace)"
                                            >
                                              {c.pt.scorePercentage}%
                                            </text>
                                          )}
                                        </g>
                                      );
                                    })}
                                  </>
                                );
                              })()}
                            </svg>
                          </div>
                        )}

                        {/* Interactive Chronological Chips Strip */}
                        <div className="study-progress-history-strip">
                          <span className="study-progress-strip-label">Score history:</span>
                          <div className="study-progress-chips-wrap">
                            {prog.chronologicalAttempts.map((pt) => (
                              <button
                                key={pt.attemptId}
                                type="button"
                                className={`study-progress-chip ${hoveredPointAttemptId === pt.attemptId ? 'active' : ''}`}
                                onClick={() => handleOpenAttempt(pt.attemptId)}
                                onMouseEnter={() => setHoveredPointAttemptId(pt.attemptId)}
                                onMouseLeave={() => setHoveredPointAttemptId(null)}
                                aria-label={`Open historical result for ${pt.attemptNumber}: ${pt.scorePercentage}% on ${pt.dateStr}`}
                              >
                                <span className="study-progress-chip-name">{pt.attemptNumber}</span>
                                <span className="study-progress-chip-arrow" aria-hidden="true">→</span>
                                <span className="study-progress-chip-score">{pt.scorePercentage}%</span>
                                <span className="study-progress-chip-date">{pt.dateStr}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.section>
          )}

          {/* 5. Assessment History Section Organized by Graph (Prompt 3) */}
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

              {/* Compact Search & Filter Toolbar (Section 6) */}
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
                    aria-selected={filterMode === 'all'}
                    className={`study-filter-tab ${filterMode === 'all' ? 'active' : ''}`}
                    onClick={() => setFilterMode('all')}
                  >
                    All assessments
                  </button>
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
                  No assessments found matching "{searchQuery}"
                </span>
                <p className="study-search-empty-sub">
                  Try searching for another keyword or reset active filters.
                </p>
                <button
                  type="button"
                  className="study-editorial-btn"
                  onClick={() => { setSearchQuery(''); setFilterMode('all'); }}
                >
                  <span className="study-btn-content">
                    <span>Clear search filters</span>
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
