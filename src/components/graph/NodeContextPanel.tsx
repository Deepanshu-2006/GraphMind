import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowUpRight, ArrowLeft, ArrowRight, Check, RotateCcw } from 'lucide-react';
import type { GraphConceptData, SelectedRelationshipData } from '../../types/graph';
import type { 
  PracticeStatus, 
  QuestionGenerationContext,
  ActiveRecallQuestion,
  ActiveRecallOption,
  ActiveRecallTestSession
} from '../../types/practice';
import { 
  getActiveRecallQuestionForConcept,
  generateActiveRecallTestSession
} from '../../services/practiceQuestionGenerator';

export interface NodeContextPanelProps {
  concept: GraphConceptData | null;
  selectedRelationship?: SelectedRelationshipData | null;
  previousConceptName?: string | null;
  onGoBack?: () => void;
  onClose: () => void;
  onSelectConcept: (conceptId: string) => void;
  onFocusNode?: (conceptId: string) => void;
  onSelectSource?: (sourceNameOrId?: string, page?: number) => void;
  isCollapsed?: boolean;
  allGraphConcepts?: Array<{ id: string; name: string; category?: string; description?: string }>;
  onUpdatePracticeState?: (conceptId: string, status: PracticeStatus) => void;
  isTestMode?: boolean;
  onToggleTestMode?: (isTest: boolean) => void;
  onRecordSessionRecalled?: (conceptId: string) => void;
  onRecordSessionReview?: (conceptId: string) => void;
  onNextConcept?: () => void;
  nextConceptName?: string | null;
  onTestStateUpdate?: (state: {
    activeQuestion: ActiveRecallQuestion | null;
    concealedNodeId: string | null;
    isMaterializing: boolean;
    progress: { current: number; total: number } | null;
  }) => void;
  // Phase 5: Revision Mode
  isRevisionMode?: boolean;
  onToggleRevisionMode?: (active?: boolean) => void;
  revisionProgress?: { current: number; total: number } | null;
  onPrevRevisionConcept?: () => void;
  onNextRevisionConcept?: () => void;
  hasPrevRevisionConcept?: boolean;
  hasNextRevisionConcept?: boolean;
  onMarkRevisionKnowIt?: (conceptId: string) => void;
  onMarkRevisionReviewAgain?: (conceptId: string) => void;
  onStartCoreRevision?: () => void;
}

/**
 * Cleans an excerpt of raw markdown artifacts and extracts 2–3 sentences.
 */
function cleanExcerpt(raw: string): string {
  if (!raw) return '';
  let cleaned = raw.replace(/^#+\s+[^\n]+\n*/gm, '').trim();
  cleaned = cleaned.replace(/^[-*•]\s+/gm, '').trim();
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');

  const sentences = cleaned.match(/[^.!?]+[.!?]+(\s|$)/g);
  if (sentences && sentences.length > 0) {
    return sentences.slice(0, 3).join('').trim();
  }
  return cleaned.slice(0, 260).trim();
}

/**
 * Derives a source-grounded passage from available concept evidence.
 */
function getGroundedPassage(concept: GraphConceptData): {
  text: string;
  sourceName: string;
  page?: number;
} | null {
  if (concept.evidenceItems && concept.evidenceItems.length > 0) {
    const item = concept.evidenceItems[0];
    if (item.text && item.text.trim()) {
      const clean = cleanExcerpt(item.text);
      if (clean) {
        return {
          text: clean,
          sourceName: concept.sources?.[0]?.name || concept.source || 'Uploaded Material',
          page: item.page ?? concept.page
        };
      }
    }
  }

  if (concept.evidence && concept.evidence.trim()) {
    const clean = cleanExcerpt(concept.evidence);
    if (clean) {
      return {
        text: clean,
        sourceName: concept.sources?.[0]?.name || concept.source || 'Uploaded Material',
        page: concept.page ?? concept.sources?.[0]?.page
      };
    }
  }

  return null;
}

/**
 * Derives the concept explanation strictly grounded in source material.
 */
function getConceptExplanation(concept: GraphConceptData): string {
  if (concept.description && concept.description.trim()) {
    return concept.description.trim();
  }

  const passage = getGroundedPassage(concept);
  if (passage && passage.text) {
    const sentences = passage.text.match(/[^.!?]+[.!?]+(\s|$)/g);
    if (sentences && sentences.length > 0) {
      return sentences.slice(0, 2).join('').trim();
    }
    return passage.text;
  }

  return "GraphMind couldn't find enough source material to explain this concept.";
}

/**
 * Derives key ideas bullet points without empty placeholders.
 */
function getKeyIdeas(concept: GraphConceptData): string[] {
  if (concept.keyIdeas && concept.keyIdeas.length > 0) {
    return concept.keyIdeas.filter(Boolean);
  }

  if (concept.prerequisites && concept.prerequisites.length > 0) {
    return concept.prerequisites.slice(0, 4);
  }

  return [];
}

export const NodeContextPanel: React.FC<NodeContextPanelProps> = ({
  concept,
  selectedRelationship,
  previousConceptName,
  onGoBack,
  onClose,
  onSelectConcept,
  onSelectSource,
  isCollapsed = false,
  allGraphConcepts = [],
  onUpdatePracticeState,
  isTestMode = false,
  onToggleTestMode,
  onTestStateUpdate,
  onRecordSessionRecalled,
  onRecordSessionReview,
  onNextConcept,
  nextConceptName: _nextConceptName,
  isRevisionMode = false,
  onToggleRevisionMode,
  revisionProgress,
  onPrevRevisionConcept,
  onNextRevisionConcept,
  hasPrevRevisionConcept = false,
  hasNextRevisionConcept = false,
  onMarkRevisionKnowIt,
  onMarkRevisionReviewAgain,
  onStartCoreRevision
}) => {
  // Mode state: 'learn' | 'recall' | 'revision' (Phase 4 & Phase 5)
  const [panelMode, setPanelMode] = useState<'learn' | 'recall' | 'revision'>(
    isTestMode ? 'recall' : isRevisionMode ? 'revision' : 'learn'
  );

  // Synchronize panelMode with isTestMode & isRevisionMode external props
  useEffect(() => {
    if (isTestMode && panelMode !== 'recall') {
      setPanelMode('recall');
    } else if (isRevisionMode && panelMode !== 'recall' && panelMode !== 'revision') {
      setPanelMode('revision');
    } else if (!isTestMode && !isRevisionMode && panelMode !== 'learn') {
      setPanelMode('learn');
    }
  }, [isTestMode, isRevisionMode]);

  // Active Recall interaction state
  const [sessionNonce, setSessionNonce] = useState<number>(0);
  const [currentTestIndex, setCurrentTestIndex] = useState<number>(0);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [questionFeedback, setQuestionFeedback] = useState<'unanswered' | 'correct' | 'incorrect' | 'revealed'>('unanswered');
  const [sessionAnswers, setSessionAnswers] = useState<Record<string, { selectedOptionId: string; isCorrect: boolean; isRevealed: boolean }>>({});
  const [sessionMissedConcepts, setSessionMissedConcepts] = useState<Array<{ conceptId: string; conceptName: string; relationshipLabel?: string }>>([]);
  const [isTestSessionComplete, setIsTestSessionComplete] = useState<boolean>(false);

  // Backward compatibility state
  const [answeredQuestionIds] = useState<Set<string>>(new Set());

  const revealButtonRef = useRef<HTMLButtonElement>(null);
  const nextButtonRef = useRef<HTMLButtonElement>(null);

  // Reset interaction state when concept changes
  useEffect(() => {
    setCurrentTestIndex(0);
    setSelectedOptionId(null);
    setQuestionFeedback('unanswered');
    setSessionAnswers({});
    setSessionMissedConcepts([]);
    setIsTestSessionComplete(false);

    // Meaningful study interaction transitions unseen -> learning
    if (concept?.id && (!concept.practiceStatus || concept.practiceStatus === 'unseen')) {
      onUpdatePracticeState?.(concept.id, 'learning');
    }
  }, [concept?.id, sessionNonce]);

  // Build question context
  const questionContext: QuestionGenerationContext | null = useMemo(() => {
    if (!concept) return null;
    const primarySource = concept.sources?.[0]?.name || concept.source || 'Uploaded Material';
    const primaryPage = concept.sources?.[0]?.page ?? concept.page;

    return {
      conceptId: concept.id,
      conceptName: concept.name || concept.label,
      category: concept.category,
      description: concept.description,
      evidence: concept.evidence,
      keyIdeas: concept.keyIdeas,
      page: primaryPage,
      sourceName: primarySource,
      sourceIds: (concept.sourceIds as string[] | undefined),
      sourceChunkIds: (concept.sourceChunkIds as string[] | undefined),
      relationships: concept.relationships,
      neighborConcepts: concept.relationships?.map(r => ({
        id: r.targetId,
        name: r.targetName,
        description: r.description
      })),
      allGraphConcepts: allGraphConcepts.length > 0
        ? allGraphConcepts
        : (concept.relationships || []).map(r => ({ id: r.targetId, name: r.targetName }))
    };
  }, [concept, allGraphConcepts]);

  // Grounded Active Recall Session (5-Question Test)
  const testSession: ActiveRecallTestSession | null = useMemo(() => {
    if (!questionContext) return null;
    return generateActiveRecallTestSession(questionContext, allGraphConcepts);
  }, [questionContext, allGraphConcepts, sessionNonce]);

  // Fallback single question for legacy testing
  const activeRecallQuestion: ActiveRecallQuestion | null = useMemo(() => {
    if (!questionContext) return null;
    return getActiveRecallQuestionForConcept(questionContext, answeredQuestionIds);
  }, [questionContext, answeredQuestionIds]);

  const currentQuestion: ActiveRecallQuestion | null = useMemo(() => {
    if (testSession && testSession.questions.length > 0) {
      return testSession.questions[currentTestIndex] || null;
    }
    return activeRecallQuestion;
  }, [testSession, currentTestIndex, activeRecallQuestion]);

  // Sync test state with Workspace (highlighting, mystery placeholder concealment, materialization)
  useEffect(() => {
    if (panelMode === 'recall' && currentQuestion) {
      const isMaterializing = questionFeedback === 'correct' || questionFeedback === 'revealed';
      const concealedNodeId = isMaterializing ? null : (currentQuestion.concealedNodeId || null);
      const total = testSession ? testSession.questions.length : 1;
      onTestStateUpdate?.({
        activeQuestion: currentQuestion,
        concealedNodeId,
        isMaterializing,
        progress: { current: currentTestIndex + 1, total }
      });
    } else {
      onTestStateUpdate?.({
        activeQuestion: null,
        concealedNodeId: null,
        isMaterializing: false,
        progress: null
      });
    }
  }, [panelMode, currentQuestion, questionFeedback, currentTestIndex, testSession, onTestStateUpdate]);

  // Handlers for Active Recall (Phase 4 Sections 5-9, 15)
  const handleSelectOption = useCallback((option: ActiveRecallOption) => {
    if (questionFeedback === 'correct' || questionFeedback === 'revealed' || !concept?.id) return;
    setSelectedOptionId(option.id);

    if (option.isCorrect) {
      setQuestionFeedback('correct');
      setSessionAnswers(prev => ({
        ...prev,
        [currentQuestion?.id || '']: { selectedOptionId: option.id, isCorrect: true, isRevealed: false }
      }));
      onRecordSessionRecalled?.(concept.id);
      onUpdatePracticeState?.(concept.id, 'understood');
    } else {
      setQuestionFeedback('incorrect');
      setSessionAnswers(prev => ({
        ...prev,
        [currentQuestion?.id || '']: { selectedOptionId: option.id, isCorrect: false, isRevealed: false }
      }));
      if (concept && !sessionMissedConcepts.some(m => m.conceptId === concept.id)) {
        setSessionMissedConcepts(prev => [
          ...prev,
          {
            conceptId: concept.id,
            conceptName: concept.name || concept.label,
            relationshipLabel: currentQuestion?.relationshipType
          }
        ]);
      }
      onRecordSessionReview?.(concept.id);
      onUpdatePracticeState?.(concept.id, 'needs-review');
    }
  }, [concept, currentQuestion, questionFeedback, onRecordSessionRecalled, onRecordSessionReview, onUpdatePracticeState, sessionMissedConcepts]);

  const handleTryAgain = useCallback(() => {
    setQuestionFeedback('unanswered');
    setSelectedOptionId(null);
  }, []);

  const handleRevealAnswer = useCallback(() => {
    setQuestionFeedback('revealed');
    if (currentQuestion?.correctOptionId) {
      setSelectedOptionId(currentQuestion.correctOptionId);
    }
    setSessionAnswers(prev => ({
      ...prev,
      [currentQuestion?.id || '']: {
        selectedOptionId: currentQuestion?.correctOptionId || '',
        isCorrect: false,
        isRevealed: true
      }
    }));
    if (concept && !sessionMissedConcepts.some(m => m.conceptId === concept.id)) {
      setSessionMissedConcepts(prev => [
        ...prev,
        {
          conceptId: concept.id,
          conceptName: concept.name || concept.label,
          relationshipLabel: currentQuestion?.relationshipType
        }
      ]);
    }
    if (concept?.id) {
      onRecordSessionReview?.(concept.id);
      onUpdatePracticeState?.(concept.id, 'needs-review');
    }
  }, [concept, currentQuestion, onRecordSessionReview, onUpdatePracticeState, sessionMissedConcepts]);

  const handleNextQuestion = useCallback(() => {
    if (!testSession) {
      if (onNextConcept) onNextConcept();
      return;
    }

    if (currentTestIndex < testSession.questions.length - 1) {
      setCurrentTestIndex(prev => prev + 1);
      setSelectedOptionId(null);
      setQuestionFeedback('unanswered');
    } else {
      setIsTestSessionComplete(true);
    }
  }, [testSession, currentTestIndex, onNextConcept]);

  const handleRetestConcept = useCallback(() => {
    setSessionNonce(prev => prev + 1);
  }, []);

  const handleExitTest = useCallback(() => {
    if (isRevisionMode) {
      setPanelMode('revision');
    } else {
      setPanelMode('learn');
      onToggleTestMode?.(false);
    }
  }, [isRevisionMode, onToggleTestMode]);

  // Keyboard navigation and shortcuts (Phase 4 & Phase 5)
  useEffect(() => {
    if (panelMode !== 'recall' && panelMode !== 'revision') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: Return to concept view or exit revision naturally
      if (e.key === 'Escape') {
        e.preventDefault();
        if (panelMode === 'recall') {
          handleExitTest();
        } else if (panelMode === 'revision') {
          onToggleRevisionMode?.(false);
        }
        return;
      }

      // Ignore when typing in an input or textarea
      const target = e.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') {
        return;
      }

      if (panelMode === 'revision' && concept) {
        if (e.key.toLowerCase() === 'k') {
          e.preventDefault();
          onMarkRevisionKnowIt?.(concept.id);
          return;
        }
        if (e.key.toLowerCase() === 'r') {
          e.preventDefault();
          onMarkRevisionReviewAgain?.(concept.id);
          return;
        }
        if (e.key.toLowerCase() === 'p' && hasPrevRevisionConcept) {
          e.preventDefault();
          onPrevRevisionConcept?.();
          return;
        }
        if (e.key.toLowerCase() === 'n' && hasNextRevisionConcept) {
          e.preventDefault();
          onNextRevisionConcept?.();
          return;
        }
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          setPanelMode('recall');
          return;
        }
        return;
      }

      // Number keys 1-4: Select options
      if (['1', '2', '3', '4'].includes(e.key) && currentQuestion?.options) {
        const idx = parseInt(e.key, 10) - 1;
        if (currentQuestion.options[idx] && questionFeedback === 'unanswered') {
          e.preventDefault();
          handleSelectOption(currentQuestion.options[idx]);
          return;
        }
      }

      // Enter or N: Next question if answered
      if ((e.key === 'Enter' || e.key.toLowerCase() === 'n') && (questionFeedback === 'correct' || questionFeedback === 'revealed')) {
        e.preventDefault();
        handleNextQuestion();
        return;
      }

      // R: Reveal answer if unanswered
      if (e.key.toLowerCase() === 'r' && questionFeedback === 'unanswered') {
        e.preventDefault();
        handleRevealAnswer();
        return;
      }

      // Space or Enter: Reveal answer if not revealed (legacy)
      if ((e.key === ' ' || e.key === 'Enter') && questionFeedback === 'unanswered') {
        e.preventDefault();
        handleRevealAnswer();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    panelMode,
    concept,
    currentQuestion,
    questionFeedback,
    handleSelectOption,
    handleNextQuestion,
    handleRevealAnswer,
    handleExitTest,
    onToggleRevisionMode,
    onMarkRevisionKnowIt,
    onMarkRevisionReviewAgain,
    onPrevRevisionConcept,
    onNextRevisionConcept,
    hasPrevRevisionConcept,
    hasNextRevisionConcept
  ]);

  if (isCollapsed || (!concept && !selectedRelationship && !isRevisionMode)) {
    return null;
  }

  // Phase 5 Section 18: Empty Revision State (when revision mode is active but queue is empty or no concept)
  if (isRevisionMode && (!concept || revisionProgress?.total === 0)) {
    return (
      <motion.aside
        className="floating-node-inspector study-panel"
        aria-label="Revision mode: Nothing needs review yet"
        role="region"
        initial={{ opacity: 0, x: 26 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 26 }}
        transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="inspector-drag-handle" aria-hidden="true" />
        <div className="study-panel-scroll-container">
          <div className="study-panel-content revision-empty-workspace">
            <header className="inspector-header study-header">
              <div className="inspector-title-wrap">
                <span className="study-section-label study-category-tag">
                  REVISION
                </span>
                <h2 className="inspector-name study-concept-title">
                  Nothing needs review yet.
                </h2>
                <span className="study-subtitle">
                  No concepts are currently marked for review. You can explore the graph or start a guided study session.
                </span>
              </div>
              <button
                type="button"
                className="inspector-close-btn"
                onClick={() => onToggleRevisionMode?.(false)}
                aria-label="Exit revision mode"
                title="Exit revision"
              >
                <X size={14} />
              </button>
            </header>

            <div className="revision-empty-actions">
              {onStartCoreRevision && (
                <button
                  type="button"
                  className="study-practice-cta-btn revision-empty-start-btn"
                  onClick={onStartCoreRevision}
                  title="Start guided study with core concepts"
                >
                  <span className="practice-cta-text">START STUDY</span>
                  <ArrowRight size={13} className="practice-cta-arrow" />
                </button>
              )}
              <button
                type="button"
                className="practice-back-to-learn-btn"
                onClick={() => onToggleRevisionMode?.(false)}
              >
                ← EXPLORE THE GRAPH
              </button>
            </div>
          </div>
        </div>
      </motion.aside>
    );
  }

  // 1. Relationship Source Traceability View
  if (selectedRelationship) {
    const hasMultipleSources = selectedRelationship.sourceNames && selectedRelationship.sourceNames.length > 1;

    return (
      <motion.aside
        className="floating-node-inspector study-panel"
        aria-label="Relationship details"
        initial={{ opacity: 0, x: 26 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 26 }}
        transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="inspector-drag-handle" aria-hidden="true" />

        <div className="inspector-header">
          <div className="inspector-title-wrap">
            <span className="inspector-category">Relationship</span>
            <h2 className="inspector-name" style={{ fontSize: '15px' }}>
              {selectedRelationship.sourceName} <span style={{ color: 'var(--accent)' }}>→</span> {selectedRelationship.targetName}
            </h2>
          </div>
          <button
            type="button"
            className="inspector-close-btn"
            onClick={onClose}
            aria-label="Close relationship details"
            title="Close panel"
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ marginTop: '2px', marginBottom: '8px' }}>
          <span
            className="edge-semantic-badge active"
            style={{ position: 'static', transform: 'none', display: 'inline-block' }}
          >
            {selectedRelationship.type.replace(/-/g, ' ')}
          </span>
        </div>

        {selectedRelationship.description && (
          <p className="inspector-desc">
            {selectedRelationship.description}
          </p>
        )}

        <div className="study-section">
          <div className="inspector-section-header">
            <span className="study-section-label">Connected concepts</span>
            <span className="inspector-section-count">2</span>
          </div>
          <div className="inspector-connections-list">
            <button
              type="button"
              className="inspector-conn-card"
              onClick={() => onSelectConcept(selectedRelationship.sourceId)}
              title={`Study ${selectedRelationship.sourceName}`}
            >
              <div className="inspector-conn-rel-indicator">
                <span className="inspector-conn-rel-symbol">↰</span>
                <span className="inspector-conn-rel-label">source concept</span>
              </div>
              <div className="inspector-conn-main-row">
                <span className="inspector-conn-target-dot" />
                <span className="inspector-conn-name">{selectedRelationship.sourceName}</span>
                <ArrowUpRight size={12} className="inspector-conn-arrow" />
              </div>
            </button>
            <button
              type="button"
              className="inspector-conn-card"
              onClick={() => onSelectConcept(selectedRelationship.targetId)}
              title={`Study ${selectedRelationship.targetName}`}
            >
              <div className="inspector-conn-rel-indicator">
                <span className="inspector-conn-rel-symbol">↳</span>
                <span className="inspector-conn-rel-label">target concept</span>
              </div>
              <div className="inspector-conn-main-row">
                <span className="inspector-conn-target-dot" />
                <span className="inspector-conn-name">{selectedRelationship.targetName}</span>
                <ArrowUpRight size={12} className="inspector-conn-arrow" />
              </div>
            </button>
          </div>
        </div>

        {hasMultipleSources ? (
          <div className="study-section">
            <span className="study-section-label">Sources</span>
            <div className="inspector-sources-compact-list">
              {selectedRelationship.sourceNames!.map((name, idx) => (
                <button
                  key={idx}
                  type="button"
                  className="inspector-source-item clickable"
                  onClick={() => onSelectSource?.(name)}
                  title={`View ${name} in Sources`}
                >
                  <span className="inspector-source-bullet">•</span>
                  <span className="inspector-source-value">{name}</span>
                  <ArrowUpRight size={10} className="inspector-source-link-icon" />
                </button>
              ))}
            </div>
          </div>
        ) : selectedRelationship.sourceNames && selectedRelationship.sourceNames.length === 1 ? (
          <div className="study-section" style={{ borderTop: 'none', paddingTop: 0 }}>
            <span className="study-section-label">Source</span>
            <button
              type="button"
              className="study-source-box"
              onClick={() => onSelectSource?.(selectedRelationship.sourceNames![0])}
              title={`View ${selectedRelationship.sourceNames[0]} in Sources`}
            >
              <span className="inspector-source-value">{selectedRelationship.sourceNames[0]}</span>
              <ArrowUpRight size={11} className="study-source-icon" />
            </button>
          </div>
        ) : null}
      </motion.aside>
    );
  }

  // 2. Canonical Concept View: LEARN (Phase 1) vs PRACTICE (Phase 2)
  const canonicalName = concept!.name || concept!.label;
  const explanation = getConceptExplanation(concept!);
  const keyIdeas = getKeyIdeas(concept!);
  const passage = getGroundedPassage(concept!);
  const relationships = concept!.relationships || [];
  const primarySource = concept!.sources?.[0]?.name || concept!.source;
  const primaryPage = concept!.sources?.[0]?.page ?? concept!.page;

  return (
    <motion.aside
      className="floating-node-inspector study-panel"
      aria-label={`${panelMode === 'recall' ? 'Active recall' : 'Study'} concept: ${canonicalName}`}
      role="region"
      initial={{ opacity: 0, x: 26 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 26 }}
      transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Mobile bottom sheet drag handle */}
      <div className="inspector-drag-handle" aria-hidden="true" />

      {/* Subtle Return Navigation to previous concept */}
      {previousConceptName && onGoBack && (
        <button
          type="button"
          className="inspector-back-btn"
          onClick={onGoBack}
          title={`Back to ${previousConceptName}`}
        >
          <ArrowLeft size={11} className="inspector-back-arrow" />
          <span className="inspector-back-label">Previous:</span>
          <span className="inspector-back-name">{previousConceptName}</span>
        </button>
      )}

      {/* Scrollable container with editorial mode transition */}
      <div className="study-panel-scroll-container">
        <AnimatePresence mode="wait" initial={false}>
          {panelMode === 'revision' ? (
            /* ==========================================================
               PHASE 5: REVISION MODE WORKSPACE
               ========================================================== */
            <motion.div
              key={`revision-${concept!.id}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="study-panel-content revision-panel-content"
            >
              {/* Header: Editorial Progress (e.g. REVISION · 04 OF 12) + Exit */}
              <header className="inspector-header study-header revision-header">
                <div className="inspector-title-wrap">
                  <div className="revision-header-meta">
                    <span className="study-section-label study-category-tag revision-progress-tag">
                      {revisionProgress
                        ? `REVISION · ${String(revisionProgress.current).padStart(2, '0')} OF ${String(revisionProgress.total).padStart(2, '0')}`
                        : 'REVISION'}
                    </span>
                    <button
                      type="button"
                      className="recall-back-link-btn revision-exit-btn"
                      onClick={() => {
                        onToggleRevisionMode?.(false);
                        setPanelMode('learn');
                      }}
                      title="Exit revision mode"
                      aria-label="Exit revision"
                    >
                      <X size={11} />
                      <span>Exit revision</span>
                    </button>
                  </div>
                  <span className="revision-concept-meta-label">CONCEPT</span>
                  <h2 className="inspector-name study-concept-title revision-concept-title">
                    {canonicalName}
                  </h2>
                </div>
                <button
                  type="button"
                  className="inspector-close-btn"
                  onClick={onClose}
                  aria-label="Close revision panel"
                  title="Close panel"
                >
                  <X size={14} />
                </button>
              </header>

              {/* WHAT IT MEANS */}
              <section className="study-section revision-section">
                <h3 className="study-section-label">WHAT IT MEANS</h3>
                <p className="study-explanation revision-explanation">
                  {explanation}
                </p>
              </section>

              {/* CONNECTED IDEAS */}
              {relationships.length > 0 && (
                <section className="study-section revision-section">
                  <h3 className="study-section-label">CONNECTED IDEAS</h3>
                  <div className="revision-connected-list">
                    {relationships.map((rel, idx) => (
                      <button
                        key={`${rel.targetId}-${idx}`}
                        type="button"
                        className="revision-connected-chip"
                        onClick={() => onSelectConcept(rel.targetId)}
                        title={`Focus ${rel.targetName}${rel.type ? ` (${rel.type.replace(/-/g, ' ')})` : ''}`}
                      >
                        <span className="revision-connected-name">{rel.targetName}</span>
                        {rel.type && (
                          <span className="revision-connected-label">{rel.type.replace(/-/g, ' ')}</span>
                        )}
                        <ArrowRight size={10} className="revision-connected-arrow" />
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* FROM YOUR MATERIAL (Source provenance with excerpt and clickable source) */}
              <section className="study-section revision-section">
                <h3 className="study-section-label">FROM YOUR MATERIAL</h3>
                {passage && (
                  <blockquote className="study-passage-quote revision-quote">
                    "{passage.text}"
                  </blockquote>
                )}
                {concept!.sources && concept!.sources.length > 1 ? (
                  <div className="inspector-sources-compact-list revision-sources-list">
                    {concept!.sources.map((s, idx) => (
                      <button
                        key={`${s.id}-${idx}`}
                        type="button"
                        className="inspector-source-item clickable"
                        onClick={() => onSelectSource?.(s.name, s.page)}
                        title={`View ${s.name}${s.page ? ` (p. ${s.page})` : ''} in Sources`}
                      >
                        <span className="inspector-source-bullet">•</span>
                        <span className="inspector-source-value">{s.name}</span>
                        {s.page && <span className="study-source-page">· p. {s.page}</span>}
                        <ArrowUpRight size={10} className="inspector-source-link-icon" />
                      </button>
                    ))}
                  </div>
                ) : primarySource ? (
                  <button
                    type="button"
                    className="study-source-box revision-source-box"
                    onClick={() => onSelectSource?.(primarySource, primaryPage)}
                    title={`View ${primarySource}${primaryPage ? ` (p. ${primaryPage})` : ''} in Sources`}
                  >
                    <div className="study-source-box-meta">
                      <span className="study-source-box-name">{primarySource}</span>
                      {primaryPage && (
                        <span className="study-source-page">Page {primaryPage}</span>
                      )}
                    </div>
                    <ArrowUpRight size={12} className="study-source-icon" />
                  </button>
                ) : null}
              </section>

              {/* QUICK RECALL CTA: RECALL → (Reuses Phase 4 Active Recall!) */}
              <div className="revision-recall-cta-wrap">
                <button
                  type="button"
                  className="study-practice-cta-btn revision-recall-btn"
                  onClick={() => {
                    setPanelMode('recall');
                  }}
                  title={`Active recall for ${canonicalName}`}
                >
                  <span className="practice-cta-text">RECALL</span>
                  <ArrowRight size={13} className="practice-cta-arrow" />
                </button>
              </div>

              {/* KNOW IT / REVIEW AGAIN ASSESSMENT (Prompt Section 10) */}
              <section className="revision-assess-section">
                <div className="revision-assess-grid">
                  <button
                    type="button"
                    className="revision-btn-know"
                    onClick={() => onMarkRevisionKnowIt?.(concept!.id)}
                    title="Mark as known and proceed (Press K)"
                  >
                    <Check size={13} />
                    <span>KNOW IT</span>
                  </button>
                  <button
                    type="button"
                    className="revision-btn-review"
                    onClick={() => onMarkRevisionReviewAgain?.(concept!.id)}
                    title="Mark for further review and keep in queue (Press R)"
                  >
                    <RotateCcw size={13} />
                    <span>REVIEW AGAIN</span>
                  </button>
                </div>
              </section>

              {/* NAVIGATION: ← PREVIOUS / NEXT → (Prompt Section 8 & 9) */}
              <footer className="revision-nav-bar">
                <button
                  type="button"
                  className="revision-nav-btn revision-prev-btn"
                  onClick={onPrevRevisionConcept}
                  disabled={!hasPrevRevisionConcept}
                  title="Previous revision concept (Press P)"
                >
                  <ArrowLeft size={12} />
                  <span>PREVIOUS</span>
                </button>

                <span className="revision-nav-counter">
                  {revisionProgress
                    ? `${String(revisionProgress.current).padStart(2, '0')} OF ${String(revisionProgress.total).padStart(2, '0')}`
                    : 'REVISION'}
                </span>

                <button
                  type="button"
                  className="revision-nav-btn revision-next-btn"
                  onClick={onNextRevisionConcept}
                  disabled={!hasNextRevisionConcept}
                  title="Next revision concept (Press N)"
                >
                  <span>NEXT</span>
                  <ArrowRight size={12} />
                </button>
              </footer>
            </motion.div>
          ) : panelMode === 'learn' ? (
            /* ==========================================================
               PHASE 1: LEARN MODE
               ========================================================== */
            <motion.div
              key={`learn-${concept!.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="study-panel-content"
            >
              {/* Header: Exact canonical concept name + Category + Close button */}
              <header className="inspector-header study-header">
                <div className="inspector-title-wrap">
                  <span className="study-section-label study-category-tag">
                    CONCEPT · {concept!.category}
                  </span>
                  <h2 className="inspector-name study-concept-title">
                    {canonicalName}
                  </h2>
                  <span className="study-subtitle">
                    How the concept is understood from your material.
                  </span>
                </div>
                <button
                  type="button"
                  className="inspector-close-btn"
                  onClick={onClose}
                  aria-label="Close study panel"
                  title="Close panel"
                >
                  <X size={14} />
                </button>
              </header>

              {/* WHAT IT MEANS */}
              <section className="study-section">
                <h3 className="study-section-label">WHAT IT MEANS</h3>
                <p className="study-explanation">
                  {explanation}
                </p>
              </section>

              {/* KEY IDEAS (Only displayed when data is actually available) */}
              {keyIdeas.length > 0 && (
                <section className="study-section">
                  <h3 className="study-section-label">KEY IDEAS</h3>
                  <ul className="study-key-ideas-list">
                    {keyIdeas.map((idea, idx) => (
                      <li key={idx} className="study-key-idea-item">
                        <span className="study-key-idea-bullet">•</span>
                        <span>{idea}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {/* FROM YOUR MATERIAL (Short source-grounded excerpt) */}
              {passage && (
                <section className="study-section">
                  <h3 className="study-section-label">FROM YOUR MATERIAL</h3>
                  <div className="study-passage-box">
                    <blockquote className="study-passage-quote">
                      “{passage.text}”
                    </blockquote>
                    <div className="study-passage-meta">
                      <button
                        type="button"
                        className="study-source-chip"
                        onClick={() => onSelectSource?.(passage.sourceName, passage.page)}
                        title={`View ${passage.sourceName}${passage.page ? ` (p. ${passage.page})` : ''} in Sources`}
                      >
                        <span className="study-source-chip-name">{passage.sourceName}</span>
                        {passage.page && (
                          <span className="study-source-chip-page">· p. {passage.page}</span>
                        )}
                        <ArrowUpRight size={10} className="study-source-link-icon" />
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {/* CONNECTED CONCEPTS */}
              {relationships.length > 0 && (
                <section className="study-section">
                  <div className="inspector-section-header">
                    <h3 className="study-section-label">CONNECTED CONCEPTS</h3>
                    <span className="inspector-section-count">{relationships.length}</span>
                  </div>
                  <div className="inspector-connections-list">
                    {relationships.map((rel, idx) => {
                      const isOutgoing = rel.direction !== 'incoming';
                      const relLabel = rel.type ? rel.type.replace(/-/g, ' ') : 'connected to';
                      return (
                        <button
                          key={`${rel.targetId}-${idx}`}
                          type="button"
                          className="inspector-conn-card"
                          onClick={() => onSelectConcept(rel.targetId)}
                          title={`Study ${rel.targetName}`}
                        >
                          <div className="inspector-conn-rel-indicator">
                            <span className="inspector-conn-rel-label">
                              {isOutgoing ? `${relLabel} →` : `← ${relLabel}`}
                            </span>
                          </div>
                          <div className="inspector-conn-main-row">
                            <span className="inspector-conn-target-dot" />
                            <span className="inspector-conn-name">{rel.targetName}</span>
                            <ArrowUpRight size={12} className="inspector-conn-arrow" />
                          </div>
                          {rel.description && (
                            <span className="inspector-conn-desc">
                              {rel.description}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* SOURCE CITATION */}
              {concept!.sources && concept!.sources.length > 1 ? (
                <section className="study-section">
                  <h3 className="study-section-label">SOURCES</h3>
                  <div className="inspector-sources-compact-list">
                    {concept!.sources.map((s, idx) => (
                      <button
                        key={`${s.id}-${idx}`}
                        type="button"
                        className="inspector-source-item clickable"
                        onClick={() => onSelectSource?.(s.name, s.page)}
                        title={`View ${s.name}${s.page ? ` (p. ${s.page})` : ''} in Sources`}
                      >
                        <span className="inspector-source-bullet">•</span>
                        <span className="inspector-source-value">{s.name}</span>
                        {s.page && <span className="study-source-page">· p. {s.page}</span>}
                        <ArrowUpRight size={10} className="inspector-source-link-icon" />
                      </button>
                    ))}
                  </div>
                </section>
              ) : primarySource ? (
                <section className="study-section">
                  <h3 className="study-section-label">SOURCE</h3>
                  <button
                    type="button"
                    className="study-source-box"
                    onClick={() => onSelectSource?.(primarySource, primaryPage)}
                    title={`View ${primarySource}${primaryPage ? ` (p. ${primaryPage})` : ''} in Sources`}
                  >
                    <div className="study-source-box-meta">
                      <span className="study-source-box-name">{primarySource}</span>
                      {primaryPage && (
                        <span className="study-source-page">Page {primaryPage}</span>
                      )}
                    </div>
                    <ArrowUpRight size={12} className="study-source-icon" />
                  </button>
                </section>
              ) : null}

              {/* STUDY STATE: Marked for review note (Phase 3 Section 15) */}
              {concept!.practiceStatus === 'needs-review' && (
                <section className="study-section study-review-status-section">
                  <h3 className="study-section-label">STUDY STATE</h3>
                  <div className="study-review-note">
                    <span className="practice-status-pip practice-pip-needs-review" aria-hidden="true" />
                    <span className="study-review-text">Marked for review.</span>
                  </div>
                </section>
              )}

              {/* EDITORIAL LEARNING ACTIONS AREA (Polish: Test Yourself & Review This Concept) */}
              <motion.div
                className="concept-panel-actions-area"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.26, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="concept-panel-actions-divider" aria-hidden="true" />

                <div className="concept-panel-actions-stack">
                  {/* PRIMARY ACTION: TEST YOURSELF */}
                  <motion.button
                    type="button"
                    className="editorial-action-row action-primary"
                    whileTap={{ scale: 0.99 }}
                    transition={{ duration: 0.12 }}
                    onClick={() => {
                      setPanelMode('recall');
                      onToggleTestMode?.(true);
                    }}
                    title={concept!.practiceStatus === 'needs-review' ? `Review ${canonicalName} again` : `Test yourself on ${canonicalName}`}
                    aria-label={concept!.practiceStatus === 'needs-review' ? `Review ${canonicalName} again` : `Test yourself on ${canonicalName}`}
                  >
                    <div className="action-row-content">
                      <span className="action-primary-indicator" aria-hidden="true" />
                      <span className="action-row-title">
                        {concept!.practiceStatus === 'needs-review' ? 'REVIEW AGAIN' : 'TEST YOURSELF'}
                      </span>
                    </div>
                    <ArrowUpRight size={13} className="action-row-arrow" aria-hidden="true" />
                    <span className="action-row-underline primary-underline" aria-hidden="true" />
                  </motion.button>

                  {/* SECONDARY ACTION: REVIEW THIS CONCEPT */}
                  {onToggleRevisionMode && (
                    <motion.button
                      type="button"
                      className="editorial-action-row action-secondary"
                      whileTap={{ scale: 0.99 }}
                      transition={{ duration: 0.12 }}
                      onClick={() => {
                        onToggleRevisionMode(true);
                        setPanelMode('revision');
                      }}
                      title={`Review connected curriculum around ${canonicalName}`}
                      aria-label="Review this concept in revision mode"
                    >
                      <div className="action-row-content">
                        <span className="action-row-title">REVIEW THIS CONCEPT</span>
                      </div>
                      <ArrowUpRight size={13} className="action-row-arrow" aria-hidden="true" />
                      <span className="action-row-underline secondary-underline" aria-hidden="true" />
                    </motion.button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          ) : (
            /* ==========================================================
               PHASE 4: ACTIVE RECALL / TEST YOURSELF (GRAPH-GROUNDED)
               ========================================================== */
            <motion.div
              key={`recall-${concept!.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="study-panel-content recall-panel-content"
            >
              {/* Header: TEST YOURSELF tag + session counter + Back to concept + Close */}
              <header className="inspector-header study-header">
                <div className="inspector-title-wrap">
                  <div className="recall-header-meta">
                    <div className="recall-header-left-meta">
                      <span className="study-section-label study-category-tag recall-header-tag">
                        TEST YOURSELF
                      </span>
                      {testSession && !isTestSessionComplete && (
                        <span className="recall-header-counter" aria-live="polite">
                          {String(currentTestIndex + 1).padStart(2, '0')} / {String(testSession.questions.length).padStart(2, '0')}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="recall-back-link-btn"
                      onClick={handleExitTest}
                      title={isRevisionMode ? "Return to revision" : "Return to concept details"}
                      aria-label={isRevisionMode ? "Back to revision" : "Back to concept"}
                    >
                      <ArrowLeft size={11} />
                      <span>{isRevisionMode ? "Back to revision" : "Back to concept"}</span>
                    </button>
                  </div>
                  <h2 className="inspector-name study-concept-title">
                    {canonicalName}
                  </h2>
                </div>
                <button
                  type="button"
                  className="inspector-close-btn"
                  onClick={onClose}
                  aria-label="Close panel"
                  title="Close panel"
                >
                  <X size={14} />
                </button>
              </header>

              {!currentQuestion ? (
                /* INSUFFICIENT MATERIAL VIEW (Section 22) */
                <section className="study-section recall-insufficient-section">
                  <h3 className="study-section-label">TEST YOURSELF</h3>
                  <p className="study-explanation recall-insufficient-text">
                    Not enough connected material to test this concept yet.
                  </p>
                  <div className="recall-insufficient-actions">
                    <button
                      type="button"
                      className="practice-back-to-learn-btn"
                      onClick={handleExitTest}
                    >
                      ← BACK TO CONCEPT
                    </button>
                  </div>
                </section>
              ) : isTestSessionComplete ? (
                /* TEST COMPLETE SUMMARY VIEW (Section 17 & 18) */
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                  className="recall-test-summary"
                >
                  <div className="recall-summary-header-block">
                    <span className="recall-summary-sublabel">SESSION RESULTS</span>
                    <h3 className="recall-summary-headline">TEST COMPLETE</h3>
                    <div className="recall-summary-score-callout">
                      <span className="recall-score-number">
                        {Object.values(sessionAnswers).filter(a => a.isCorrect && !a.isRevealed).length}
                      </span>
                      <span className="recall-score-divider">/</span>
                      <span className="recall-score-total">
                        {testSession?.questions.length || 1}
                      </span>
                      <span className="recall-score-text">understood</span>
                    </div>
                  </div>

                  <div className="recall-summary-details">
                    {/* Strong areas */}
                    <div className="recall-summary-group">
                      <span className="recall-summary-group-title">STRONG</span>
                      <div className="recall-strong-tags">
                        <span className="recall-strong-chip">
                          <Check size={11} className="strong-check-icon" />
                          <span>Relationships</span>
                        </span>
                        <span className="recall-strong-chip">
                          <Check size={11} className="strong-check-icon" />
                          <span>Concept understanding</span>
                        </span>
                      </div>
                    </div>

                    {/* Missed / To-review concepts */}
                    {sessionMissedConcepts.length > 0 ? (
                      <div className="recall-summary-group">
                        <span className="recall-summary-group-title">MISSED CONCEPTS</span>
                        <div className="recall-missed-list">
                          {sessionMissedConcepts.map((item, idx) => (
                            <div key={idx} className="recall-missed-row">
                              <div className="missed-row-text">
                                <span className="missed-concept-name">{item.conceptName}</span>
                                {item.relationshipLabel && (
                                  <span className="missed-rel-text"> · {item.relationshipLabel}</span>
                                )}
                              </div>
                              <button
                                type="button"
                                className="missed-review-action-btn"
                                onClick={() => {
                                  onSelectConcept(item.conceptId);
                                  setPanelMode('learn');
                                }}
                                title={`Review ${item.conceptName} on the graph`}
                              >
                                <span>REVIEW CONCEPT</span>
                                <ArrowRight size={10} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="recall-flawless-text">
                        All tested relationships and concepts were verified directly from memory.
                      </p>
                    )}
                  </div>

                  <div className="recall-summary-footer-actions">
                    <button
                      type="button"
                      className="recall-retest-btn"
                      onClick={handleRetestConcept}
                    >
                      <RotateCcw size={12} />
                      <span>RETEST THIS CONCEPT</span>
                    </button>
                    <button
                      type="button"
                      className="recall-summary-back-btn"
                      onClick={handleExitTest}
                    >
                      <span>BACK TO CONCEPT</span>
                    </button>
                  </div>
                </motion.div>
              ) : (
                /* ACTIVE RECALL QUESTION CARD VIEW (Section 5-10, 14, 16) */
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`q-${currentQuestion.id}`}
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
                    className="recall-card"
                  >
                    {/* QUESTION SECTION */}
                    <section className="study-section recall-question-section">
                      <div className="recall-question-meta">
                        <span className="recall-question-type-badge">
                          {currentQuestion.questionType === 'fill-connection'
                            ? 'COMPLETE THE CONNECTION'
                            : currentQuestion.questionType === 'relationship'
                            ? 'RELATIONSHIP TEST'
                            : currentQuestion.questionType === 'connection'
                            ? 'CONNECTION TEST'
                            : currentQuestion.questionType === 'concept-understanding'
                            ? 'CONCEPT UNDERSTANDING'
                            : currentQuestion.questionType === 'two-concept'
                            ? 'TWO-CONCEPT REASONING'
                            : currentQuestion.questionType === 'source-based'
                            ? 'SOURCE-BASED TEST'
                            : 'ACTIVE RECALL'}
                        </span>
                      </div>

                      {/* DIAGRAM DISPLAY (Section 2 Types B & D, Section 16) */}
                      {currentQuestion.diagram && (
                        <div className="recall-diagram-container" aria-label="Connection diagram">
                          <div className="recall-diagram-source">
                            <span className="diagram-node-name">{currentQuestion.diagram.sourceName}</span>
                          </div>
                          <div className="recall-diagram-connection">
                            <span className="diagram-pipe">│</span>
                            <div className="diagram-branch-row">
                              <span className="diagram-branch-char">└──</span>
                              <span className="diagram-rel-text">{currentQuestion.diagram.relationshipLabel}</span>
                              <span className="diagram-arrow-sign">──</span>
                              <span className={`diagram-target-slot ${questionFeedback === 'correct' || questionFeedback === 'revealed' ? 'revealed' : 'concealed'}`}>
                                {questionFeedback === 'correct' || questionFeedback === 'revealed' ? currentQuestion.answer : '[ ? ]'}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      <h3 className="recall-question-text">
                        {currentQuestion.question}
                      </h3>
                    </section>

                    {/* COMPACT EDITORIAL ANSWER OPTIONS STACK (Section 7) */}
                    {currentQuestion.options && currentQuestion.options.length > 0 && (
                      <section className="study-section recall-options-section">
                        <div className="recall-editorial-options-stack" role="radiogroup" aria-label="Answer options">
                          {currentQuestion.options.map((opt, idx) => {
                            const isSelected = selectedOptionId === opt.id;
                            const isCorrectOpt = opt.isCorrect;
                            const showCorrect = (questionFeedback === 'correct' && isSelected) || (questionFeedback === 'revealed' && isCorrectOpt);
                            const showIncorrect = questionFeedback === 'incorrect' && isSelected;

                            const optionClasses = [
                              'recall-editorial-option-row',
                              isSelected ? 'selected' : '',
                              showCorrect ? 'option-correct' : '',
                              showIncorrect ? 'option-incorrect' : '',
                              questionFeedback === 'correct' || questionFeedback === 'revealed' ? 'disabled' : ''
                            ].filter(Boolean).join(' ');

                            return (
                              <button
                                key={opt.id}
                                type="button"
                                className={optionClasses}
                                onClick={() => handleSelectOption(opt)}
                                disabled={questionFeedback === 'correct' || questionFeedback === 'revealed'}
                                aria-checked={isSelected}
                                role="radio"
                              >
                                <div className="recall-option-left">
                                  <span className="recall-option-num">{String(idx + 1).padStart(2, '0')}</span>
                                  <span className="recall-option-title">{opt.label}</span>
                                </div>
                                <ArrowUpRight size={13} className="recall-option-arrow" aria-hidden="true" />
                                <span className="recall-option-underline" aria-hidden="true" />
                              </button>
                            );
                          })}
                        </div>
                      </section>
                    )}

                    {/* INTERACTION RESPONSES (Section 8, 9, 10, 19) */}
                    <AnimatePresence>
                      {questionFeedback === 'correct' && (
                        <motion.div
                          key="feedback-correct"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.24 }}
                          className="recall-feedback-area feedback-correct"
                        >
                          <div className="recall-feedback-status">
                            <span className="recall-feedback-dot correct-dot" aria-hidden="true" />
                            <span className="recall-feedback-text">
                              Connected. That's the relationship in your material.
                            </span>
                          </div>

                          {/* SOURCE GROUNDING EXCERPT (Section 19) */}
                          {currentQuestion.sourceEvidence && (
                            <div className="recall-provenance-box">
                              <span className="recall-provenance-label">FROM YOUR MATERIAL</span>
                              <blockquote className="recall-provenance-quote">
                                “{currentQuestion.sourceEvidence}”
                              </blockquote>
                              {currentQuestion.sourceName && (
                                <button
                                  type="button"
                                  className="study-source-chip"
                                  onClick={() => onSelectSource?.(currentQuestion.sourceName, currentQuestion.page)}
                                  title={`View ${currentQuestion.sourceName}${currentQuestion.page ? ` (p. ${currentQuestion.page})` : ''} in Sources`}
                                >
                                  <span className="study-source-chip-name">{currentQuestion.sourceName}</span>
                                  {currentQuestion.page && (
                                    <span className="study-source-chip-page">· p. {currentQuestion.page}</span>
                                  )}
                                  <ArrowUpRight size={10} className="study-source-link-icon" />
                                </button>
                              )}
                            </div>
                          )}

                          <div className="recall-next-action-wrap">
                            <button
                              type="button"
                              ref={nextButtonRef}
                              className="recall-next-step-btn"
                              onClick={handleNextQuestion}
                              title="Advance to next question (Press Enter or N)"
                            >
                              <span>{currentTestIndex < (testSession?.questions.length || 1) - 1 ? 'NEXT' : 'COMPLETE TEST'}</span>
                              <ArrowRight size={12} />
                            </button>
                          </div>
                        </motion.div>
                      )}

                      {questionFeedback === 'incorrect' && (
                        <motion.div
                          key="feedback-incorrect"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.24 }}
                          className="recall-feedback-area feedback-incorrect"
                        >
                          <div className="recall-feedback-status">
                            <span className="recall-feedback-dot incorrect-dot" aria-hidden="true" />
                            <span className="recall-feedback-text">
                              This connection doesn't match your material.
                            </span>
                          </div>

                          <div className="recall-incorrect-actions-row">
                            <button
                              type="button"
                              className="recall-try-again-btn"
                              onClick={handleTryAgain}
                              title="Try selecting another option"
                            >
                              <RotateCcw size={11} />
                              <span>TRY AGAIN</span>
                            </button>
                            <button
                              type="button"
                              className="recall-reveal-alt-btn"
                              onClick={handleRevealAnswer}
                              title="Reveal the correct concept"
                            >
                              <span>REVEAL</span>
                            </button>
                          </div>
                        </motion.div>
                      )}

                      {questionFeedback === 'revealed' && (
                        <motion.div
                          key="feedback-revealed"
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.24 }}
                          className="recall-feedback-area feedback-revealed"
                        >
                          <div className="recall-feedback-status">
                            <span className="recall-feedback-dot revealed-dot" aria-hidden="true" />
                            <span className="recall-feedback-text">
                              Answer revealed: {currentQuestion.answer}
                            </span>
                          </div>

                          {currentQuestion.sourceEvidence && (
                            <div className="recall-provenance-box">
                              <span className="recall-provenance-label">FROM YOUR MATERIAL</span>
                              <blockquote className="recall-provenance-quote">
                                “{currentQuestion.sourceEvidence}”
                              </blockquote>
                            </div>
                          )}

                          <div className="recall-next-action-wrap">
                            <button
                              type="button"
                              className="recall-next-step-btn"
                              onClick={handleNextQuestion}
                            >
                              <span>{currentTestIndex < (testSession?.questions.length || 1) - 1 ? 'NEXT' : 'COMPLETE TEST'}</span>
                              <ArrowRight size={12} />
                            </button>
                          </div>
                        </motion.div>
                      )}

                      {questionFeedback === 'unanswered' && (
                        <div className="recall-unanswered-footer">
                          <button
                            type="button"
                            ref={revealButtonRef}
                            className="recall-reveal-subtle-link"
                            onClick={handleRevealAnswer}
                            title="Reveal answer from source material (Press R)"
                          >
                            <span>Reveal answer</span>
                          </button>
                        </div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </AnimatePresence>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
};
