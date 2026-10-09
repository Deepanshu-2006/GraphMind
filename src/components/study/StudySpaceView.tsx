import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Search, X, ChevronDown } from 'lucide-react';
import type { KnowledgeGraph } from '../../types/knowledgeGraph';
import type { KnowledgeTest, AssessmentAttempt, TestResultsSummary, MissedConceptItem } from '../../types/test';
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
  status: 'improved' | 'declined' | 'unchanged';
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
      {/* 1. Page Header */}
      <motion.header 
        className="study-header"
        initial={shouldReduceMotion ? false : { opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: REVEAL_EASE }}
      >
        <span className="study-eyebrow">YOUR LEARNING</span>
        <h1 className="study-title">Study Space</h1>
        <p className="study-subtitle">
          Your assessments, progress, and concepts worth revisiting.
        </p>
        <div className="study-header-divider" aria-hidden="true" />
      </motion.header>

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
          {/* 3. Continue Learning Section (Highlighted latest relevant attempt) */}
          {latestAttempt && latestDateInfo && (
            <motion.section 
              className="study-continue-section" 
              aria-label="Continue learning"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.06, ease: REVEAL_EASE }}
            >
              <div className="study-continue-box">
                <div className="study-continue-info">
                  <span className="study-continue-kicker">CONTINUE LEARNING</span>
                  <h2 className="study-continue-title" title={latestAttempt.graphName}>
                    {latestAttempt.graphName}
                  </h2>
                  <div className="study-continue-meta">
                    <span>Completed {latestDateInfo.dateStr}</span>
                    <span className="study-meta-dot" aria-hidden="true" />
                    <span>
                      {pad(latestAttempt.correctAnswers)} / {pad(latestAttempt.totalQuestions)} correct ({latestAttempt.scorePercentage}%)
                    </span>
                    <span className="study-meta-dot" aria-hidden="true" />
                    <span>{latestAttempt.totalQuestions} questions</span>
                    {missedCount > 0 && (
                      <>
                        <span className="study-meta-dot" aria-hidden="true" />
                        <span className="study-meta-warm">
                          {missedCount} concept{missedCount === 1 ? '' : 's'} worth revisiting
                        </span>
                      </>
                    )}
                  </div>
                </div>

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
                    <span>{missedCount > 0 ? 'Review missed concepts' : 'Review results'}</span>
                    <span className="study-btn-arrow" aria-hidden="true">→</span>
                  </span>
                  <span className="study-btn-underline" aria-hidden="true" />
                </button>
              </div>
            </motion.section>
          )}

          {/* 4. Assessment History Section Organized by Graph (Prompt 3) */}
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
        </>
      )}
    </div>
  );
}
