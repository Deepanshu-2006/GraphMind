import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowUpRight, ArrowLeft, ArrowRight } from 'lucide-react';
import type { GraphConceptData, SelectedRelationshipData } from '../../types/graph';
import type { PracticeQuestion, PracticeStatus, QuestionGenerationContext } from '../../types/practice';
import { 
  getPracticeQuestionForConcept, 
  evaluateAnswer,
  hasSufficientMaterial
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
  onUpdatePracticeState
}) => {
  // Mode state: 'learn' (Phase 1) | 'practice' (Phase 2)
  const [panelMode, setPanelMode] = useState<'learn' | 'practice'>('learn');

  // Practice session state
  const [studentAnswer, setStudentAnswer] = useState<string>('');
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [evaluation, setEvaluation] = useState<{ isCorrect: boolean; feedback: string } | null>(null);
  const [selfAssessed, setSelfAssessed] = useState<'again' | 'got-it' | null>(null);
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<Set<string>>(new Set());

  // Reset practice interaction state when concept changes
  useEffect(() => {
    setStudentAnswer('');
    setIsSubmitted(false);
    setEvaluation(null);
    setSelfAssessed(null);
  }, [concept?.id]);

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

  const currentQuestion: PracticeQuestion | null = useMemo(() => {
    if (!questionContext) return null;
    return getPracticeQuestionForConcept(questionContext, answeredQuestionIds);
  }, [questionContext, answeredQuestionIds]);

  const canPractice = useMemo(() => {
    if (!questionContext) return false;
    return hasSufficientMaterial(questionContext);
  }, [questionContext]);

  // Submission handler
  const handleCheckAnswer = useCallback(() => {
    if (!currentQuestion || !studentAnswer.trim() || isSubmitted) return;
    const result = evaluateAnswer(currentQuestion, studentAnswer);
    setEvaluation(result);
    setIsSubmitted(true);
    setAnsweredQuestionIds(prev => new Set(prev).add(currentQuestion.id));

    // Initial transition to 'learning' upon answering
    if (concept?.id && (!concept.practiceStatus || concept.practiceStatus === 'unseen')) {
      onUpdatePracticeState?.(concept.id, 'learning');
    }
  }, [currentQuestion, studentAnswer, isSubmitted, concept, onUpdatePracticeState]);

  // Reveal answer handler (for short-answer questions when evaluation is uncertain)
  const handleRevealAnswer = useCallback(() => {
    if (!currentQuestion || isSubmitted) return;
    setStudentAnswer(currentQuestion.correctAnswer);
    setEvaluation({ isCorrect: true, feedback: 'Revealed' });
    setIsSubmitted(true);
    setAnsweredQuestionIds(prev => new Set(prev).add(currentQuestion.id));

    if (concept?.id && (!concept.practiceStatus || concept.practiceStatus === 'unseen')) {
      onUpdatePracticeState?.(concept.id, 'learning');
    }
  }, [currentQuestion, isSubmitted, concept, onUpdatePracticeState]);

  // Self-assessment handler
  const handleSelfAssess = useCallback((assessment: 'again' | 'got-it') => {
    if (!concept?.id) return;
    setSelfAssessed(assessment);
    const newStatus: PracticeStatus = assessment === 'got-it' ? 'understood' : 'needs-review';
    onUpdatePracticeState?.(concept.id, newStatus);
  }, [concept?.id, onUpdatePracticeState]);

  // Keyboard support for Practice Mode (A/B/C/D option shortcuts & Enter to submit)
  useEffect(() => {
    if (panelMode !== 'practice' || !currentQuestion) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in text input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Enter' && !isSubmitted && studentAnswer.trim()) {
          e.preventDefault();
          handleCheckAnswer();
        }
        return;
      }

      if (e.key === 'Enter' && !isSubmitted && studentAnswer.trim()) {
        e.preventDefault();
        handleCheckAnswer();
        return;
      }

      if (!isSubmitted && currentQuestion.options && currentQuestion.options.length > 0) {
        const key = e.key.toUpperCase();
        if (key === 'A' && currentQuestion.options[0]) setStudentAnswer(currentQuestion.options[0]);
        if (key === 'B' && currentQuestion.options[1]) setStudentAnswer(currentQuestion.options[1]);
        if (key === 'C' && currentQuestion.options[2]) setStudentAnswer(currentQuestion.options[2]);
        if (key === 'D' && currentQuestion.options[3]) setStudentAnswer(currentQuestion.options[3]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [panelMode, currentQuestion, isSubmitted, studentAnswer, handleCheckAnswer]);

  if (isCollapsed || (!concept && !selectedRelationship)) {
    return null;
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
  const nextConnectedConcept = relationships[0];

  return (
    <motion.aside
      className="floating-node-inspector study-panel"
      aria-label={`${panelMode === 'practice' ? 'Practice' : 'Study'} concept: ${canonicalName}`}
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
          {panelMode === 'learn' ? (
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

              {/* SECONDARY ACTION: TEST YOURSELF → (Phase 2 Entry Point) */}
              <div className="study-practice-cta-section">
                <button
                  type="button"
                  className="study-practice-cta-btn"
                  onClick={() => setPanelMode('practice')}
                  title={`Test yourself on ${canonicalName}`}
                >
                  <span className="practice-cta-text">TEST YOURSELF</span>
                  <ArrowRight size={13} className="practice-cta-arrow" />
                </button>
              </div>
            </motion.div>
          ) : (
            /* ==========================================================
               PHASE 2: PRACTICE MODE
               ========================================================== */
            <motion.div
              key={`practice-${concept!.id}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
              className="study-panel-content practice-panel-content"
            >
              {/* Header: PRACTICE title + canonical concept name */}
              <header className="inspector-header study-header">
                <div className="inspector-title-wrap">
                  <span className="study-section-label study-category-tag practice-header-tag">
                    PRACTICE · {concept!.category}
                  </span>
                  <h2 className="inspector-name study-concept-title">
                    {canonicalName}
                  </h2>
                </div>
                <button
                  type="button"
                  className="inspector-close-btn"
                  onClick={onClose}
                  aria-label="Close practice panel"
                  title="Close panel"
                >
                  <X size={14} />
                </button>
              </header>

              {!canPractice || !currentQuestion ? (
                /* INSUFFICIENT MATERIAL VIEW (Section 3 & 29) */
                <section className="study-section practice-unavailable-section">
                  <h3 className="study-section-label">NOT ENOUGH MATERIAL</h3>
                  <p className="study-explanation practice-insufficient-text">
                    GraphMind couldn't create a reliable question from the available material.
                  </p>
                  <div style={{ marginTop: '14px' }}>
                    <button
                      type="button"
                      className="practice-back-to-learn-btn"
                      onClick={() => setPanelMode('learn')}
                    >
                      ← BACK TO CONCEPT
                    </button>
                  </div>
                </section>
              ) : (
                /* ACTIVE PRACTICE QUESTION VIEW */
                <>
                  <section className="study-section practice-question-section">
                    <h3 className="study-section-label">QUESTION</h3>
                    <p className="practice-question-text">
                      {currentQuestion.question}
                    </p>

                    {/* Answer Controls: Multiple Choice / Options */}
                    {currentQuestion.options && currentQuestion.options.length > 0 ? (
                      <div className="practice-options-list" role="radiogroup" aria-label="Answer options">
                        {currentQuestion.options.map((option, idx) => {
                          const optionLetter = String.fromCharCode(65 + idx); // A, B, C, D
                          const isSelected = studentAnswer === option;
                          const isCorrectOption = currentQuestion.correctAnswer === option;
                          const isWrongSelection = isSubmitted && isSelected && !evaluation?.isCorrect;

                          let rowClass = 'practice-option-row';
                          if (isSelected) rowClass += ' selected';
                          if (isSubmitted && isCorrectOption) rowClass += ' is-correct-target';
                          if (isWrongSelection) rowClass += ' is-wrong';

                          return (
                            <button
                              key={idx}
                              type="button"
                              role="radio"
                              aria-checked={isSelected}
                              className={rowClass}
                              onClick={() => !isSubmitted && setStudentAnswer(option)}
                              disabled={isSubmitted}
                            >
                              <span className="practice-option-letter">{optionLetter}</span>
                              <span className="practice-option-text">{option}</span>
                              {isSelected && <span className="practice-option-pip" aria-hidden="true" />}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      /* Short Answer text input */
                      <div className="practice-input-group">
                        <input
                          type="text"
                          className="practice-short-input"
                          placeholder="Type your explanation..."
                          value={studentAnswer}
                          onChange={(e) => !isSubmitted && setStudentAnswer(e.target.value)}
                          disabled={isSubmitted}
                          aria-label="Your answer"
                        />
                        {!isSubmitted && (
                          <button
                            type="button"
                            className="practice-reveal-btn"
                            onClick={handleRevealAnswer}
                            title="Reveal answer from source material"
                          >
                            REVEAL ANSWER
                          </button>
                        )}
                      </div>
                    )}
                  </section>

                  {/* Submission Action */}
                  {!isSubmitted && (
                    <div className="practice-submit-wrap">
                      <button
                        type="button"
                        className="practice-submit-btn"
                        disabled={!studentAnswer.trim()}
                        onClick={handleCheckAnswer}
                      >
                        CHECK ANSWER →
                      </button>
                    </div>
                  )}

                  {/* Feedback, Grounded Explanation & Self-Assessment (Revealed after check) */}
                  {isSubmitted && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22 }}
                      className="practice-feedback-flow"
                    >
                      {/* Status Banner */}
                      <div className={`practice-feedback-banner ${evaluation?.isCorrect ? 'correct' : 'incorrect'}`}>
                        <span className="practice-feedback-status">
                          {evaluation?.isCorrect ? 'CORRECT' : 'NOT QUITE'}
                        </span>
                        {!evaluation?.isCorrect && (
                          <div className="practice-correct-reveal">
                            <span className="practice-reveal-prefix">The correct answer is:</span>
                            <span className="practice-reveal-correct-name">{currentQuestion.correctAnswer}</span>
                          </div>
                        )}
                      </div>

                      {/* Explanation */}
                      <section className="study-section" style={{ borderTop: 'none', paddingTop: 0 }}>
                        <p className="study-explanation practice-explanation">
                          {currentQuestion.explanation}
                        </p>
                      </section>

                      {/* Provenance: From Your Material */}
                      {currentQuestion.passage && (
                        <section className="study-section">
                          <h3 className="study-section-label">FROM YOUR MATERIAL</h3>
                          <div className="study-passage-box">
                            <blockquote className="study-passage-quote">
                              “{currentQuestion.passage}”
                            </blockquote>
                            <div className="study-passage-meta">
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
                            </div>
                          </div>
                        </section>
                      )}

                      {/* Self-Assessment: How well did you know this? */}
                      <section className="study-section practice-self-assess-section">
                        <h3 className="study-section-label">HOW WELL DID YOU KNOW THIS?</h3>
                        <div className="practice-self-assess-row" role="group" aria-label="Self assessment">
                          <button
                            type="button"
                            className={`practice-assess-btn ${selfAssessed === 'again' ? 'active-again' : ''}`}
                            onClick={() => handleSelfAssess('again')}
                            title="Mark as needing review"
                          >
                            AGAIN
                          </button>
                          <button
                            type="button"
                            className={`practice-assess-btn ${selfAssessed === 'got-it' ? 'active-got-it' : ''}`}
                            onClick={() => handleSelfAssess('got-it')}
                            title="Mark as understood"
                          >
                            GOT IT
                          </button>
                        </div>
                      </section>

                      {/* Navigation Actions */}
                      <div className="practice-footer-actions">
                        {nextConnectedConcept && (
                          <button
                            type="button"
                            className="practice-next-concept-btn"
                            onClick={() => onSelectConcept(nextConnectedConcept.targetId)}
                            title={`Practice connected concept: ${nextConnectedConcept.targetName}`}
                          >
                            <span>NEXT CONCEPT → {nextConnectedConcept.targetName}</span>
                          </button>
                        )}
                        <button
                          type="button"
                          className="practice-back-to-learn-btn"
                          onClick={() => setPanelMode('learn')}
                        >
                          ← BACK TO CONCEPT
                        </button>
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  );
};
