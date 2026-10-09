import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { KnowledgeGraph } from '../../types/knowledgeGraph';
import type { KnowledgeTest, AssessmentAttempt } from '../../types/test';
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

const REVEAL_EASE = [0.16, 1, 0.3, 1] as const;

function pad(n: number): string {
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
      setViewMode(viewParam === 'missed' ? 'review-missed' : 'historical-results');
    }
  }, [loadAttempts, initialAttemptId]);

  // Handle browser popstate for back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const attemptParam = urlParams.get('attempt');
      const viewParam = urlParams.get('view');

      if (attemptParam) {
        setSelectedAttemptId(attemptParam);
        setViewMode(viewParam === 'missed' ? 'review-missed' : 'historical-results');
      } else {
        setSelectedAttemptId(null);
        setViewMode('list');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
      } else {
        url.searchParams.delete('view');
      }
      window.history.pushState({}, '', url.toString());
    } catch {
      // In non-browser/test environments, window.history may be restricted
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
      // Sort ascending by completedAt date to determine historical order
      const sorted = [...byGraph[key]].sort((a, b) => {
        return new Date(a.completedAt).getTime() - new Date(b.completedAt).getTime();
      });
      sorted.forEach((a, idx) => {
        map.set(a.id, pad(idx + 1));
      });
    }
    return map;
  }, [attempts]);

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

  // Top/latest attempt for "Continue learning" section
  const latestAttempt = attempts.length > 0 ? attempts[0] : null;
  const latestDateInfo = latestAttempt ? formatAttemptDate(latestAttempt.completedAt) : null;
  const missedCount = latestAttempt?.resultsSummary?.reviewRecommendedConcepts?.length || 0;

  // =========================================================================
  // SUB-VIEW: Historical Assessment Results, Answers Review, Missed Concepts
  // =========================================================================
  if (selectedAttemptId) {
    if (!selectedAttempt || !historicalTest) {
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
            onBackToResults={() => setViewMode('historical-results')}
            onSelectConceptToReview={(conceptId) => onNavigateToConcept?.(conceptId)}
          />
        </div>
      );
    }

    if (viewMode === 'review-missed' && selectedAttempt.resultsSummary) {
      return (
        <div className="study-historical-results-wrap">
          <MissedConceptsReview
            missedConcepts={selectedAttempt.resultsSummary.reviewRecommendedConcepts}
            onBackToResults={() => setViewMode('historical-results')}
            onReviewConceptInGraph={(conceptId) => onNavigateToConcept?.(conceptId)}
          />
        </div>
      );
    }

    // Default historical results view
    return (
      <div className="study-historical-results-wrap">
        <TestResultsView
          results={selectedAttempt.resultsSummary}
          test={historicalTest}
          graph={activeGraph}
          backButtonLabel="BACK TO STUDY SPACE"
          onReviewAnswers={() => setViewMode('review-answers')}
          onReviewMissedConcepts={() => setViewMode('review-missed')}
          onBackToGraph={handleBackToList}
          onSelectConceptToReview={(conceptId) => onNavigateToConcept?.(conceptId)}
        />
      </div>
    );
  }

  // =========================================================================
  // MAIN VIEW: Study Space List
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

      {/* 2. Empty State (when user has no assessment history) */}
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

          {/* 4. Assessment History Section (Editorial Aligned Grid) */}
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
            </div>

            <div className="study-table-container">
              <table className="study-table">
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
                  {attempts.map((attempt) => {
                    const { dateStr, timeStr } = formatAttemptDate(attempt.completedAt);
                    const attemptNumber = attemptNumberMap.get(attempt.id) || '01';

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
                        aria-label={`View assessment attempt for ${attempt.graphName}`}
                      >
                        {/* ATTEMPT */}
                        <td className="study-td">
                          <div className="study-attempt-name">{attempt.graphName}</div>
                          <div className="study-attempt-sub">
                            <span>Assessment · Attempt {attemptNumber}</span>
                            {attempt.completionReason === 'time_expired' && (
                              <span className="study-badge-expired">Time expired</span>
                            )}
                          </div>
                        </td>

                        {/* COMPLETED */}
                        <td className="study-td">
                          <div className="study-date-text">{dateStr}</div>
                          {timeStr && <div className="study-time-text">{timeStr}</div>}
                        </td>

                        {/* RESULT */}
                        <td className="study-td">
                          <div className="study-result-score">
                            {pad(attempt.correctAnswers)} / {pad(attempt.totalQuestions)} correct
                          </div>
                          <div className="study-result-pct">{attempt.scorePercentage}%</div>
                        </td>

                        {/* QUESTIONS */}
                        <td className="study-td">
                          <div className="study-questions-count">
                            {attempt.totalQuestions} questions
                          </div>
                          <div className="study-questions-time">
                            {formatDuration(attempt.timeSpentSeconds)}
                          </div>
                        </td>

                        {/* ACTION */}
                        <td className="study-td study-td-action">
                          <button
                            type="button"
                            className="study-editorial-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenAttempt(attempt.id);
                            }}
                            aria-label={`View results for ${attempt.graphName}`}
                          >
                            <span className="study-btn-content">
                              <span>View results</span>
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
          </motion.section>
        </>
      )}
    </div>
  );
}
