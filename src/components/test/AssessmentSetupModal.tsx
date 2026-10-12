import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ArrowRight, AlertCircle } from 'lucide-react';
import type { KnowledgeGraph } from '../../types/knowledgeGraph';
import {
  loadAssessmentSetupConfig,
  saveAssessmentSetupConfig
} from '../../services/storage';

export interface AssessmentSetupModalProps {
  isOpen: boolean;
  graph: KnowledgeGraph | null | undefined;
  maxAvailableQuestions: number;
  onCancel: () => void;
  onBeginAssessment: (config: {
    questionCount: number;
    timeLimitSeconds: number;
  }) => void;
}

export interface QuestionCountOption {
  id: string;
  value: number | 'all';
  label: string;
  actualCount: number;
}

export type TimePresetValue = 5 | 10 | 20 | 'custom';

export interface TimePresetOption {
  id: TimePresetValue;
  label: string;
  minutes: number | null;
}

export const TIME_PRESET_OPTIONS: TimePresetOption[] = [
  { id: 5, label: '5 min', minutes: 5 },
  { id: 10, label: '10 min', minutes: 10 },
  { id: 20, label: '20 min', minutes: 20 },
  { id: 'custom', label: 'Custom', minutes: null }
];

/**
 * Computes available question count presets based on the maximum candidate questions
 * available for the active knowledge graph.
 */
export function computeQuestionCountOptions(maxAvailable: number): QuestionCountOption[] {
  if (maxAvailable <= 0) return [];

  // Minimum threshold for generating valid GraphMind assessment
  if (maxAvailable < 3) {
    return [];
  }

  const options: QuestionCountOption[] = [];

  if (maxAvailable < 5) {
    // 3 or 4 available questions
    options.push({
      id: '3',
      value: 3,
      label: '3',
      actualCount: 3
    });

    options.push({
      id: 'all',
      value: 'all',
      label: 'All',
      actualCount: maxAvailable
    });

    return options;
  }

  // maxAvailable >= 5
  const standardPresets = [5, 10, 15, 20];
  const validPresets = standardPresets.filter(p => p < maxAvailable);

  if (maxAvailable < 10 && validPresets.length === 1) {
    // Provide a smaller preset if only [5] is available
    options.push({
      id: '3',
      value: 3,
      label: '3',
      actualCount: 3
    });
  }

  for (const preset of validPresets) {
    options.push({
      id: String(preset),
      value: preset,
      label: String(preset),
      actualCount: preset
    });
  }

  // Always append 'All' representing the total valid question count
  options.push({
    id: 'all',
    value: 'all',
    label: 'All',
    actualCount: maxAvailable
  });

  return options;
}

export function AssessmentSetupModal({
  isOpen,
  graph,
  maxAvailableQuestions,
  onCancel,
  onBeginAssessment
}: AssessmentSetupModalProps) {
  const shouldReduceMotion = useReducedMotion();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available question options derived from active graph capacity
  const questionOptions = useMemo(() => {
    return computeQuestionCountOptions(maxAvailableQuestions);
  }, [maxAvailableQuestions]);

  // Selected question count ('all' or number)
  const [selectedQuestionValue, setSelectedQuestionValue] = useState<number | 'all'>('all');

  // Selected time limit preset (5, 10, 20, 'custom')
  const [selectedTimePreset, setSelectedTimePreset] = useState<TimePresetValue>(10);

  // Custom time limit input in minutes
  const [customMinutesText, setCustomMinutesText] = useState<string>('15');

  // Load and revalidate persisted settings on mount or when graph/capacity changes
  useEffect(() => {
    if (!isOpen) {
      setIsSubmitting(false);
      return;
    }

    const persisted = loadAssessmentSetupConfig();

    // 1. Revalidate question count
    if (questionOptions.length > 0) {
      if (persisted?.questionCount === 'all') {
        setSelectedQuestionValue('all');
      } else if (typeof persisted?.questionCount === 'number') {
        const matchingOption = questionOptions.find(o => o.value === persisted.questionCount);
        if (matchingOption) {
          setSelectedQuestionValue(matchingOption.value);
        } else if (persisted.questionCount <= maxAvailableQuestions) {
          // Closest valid option or 'all'
          setSelectedQuestionValue('all');
        } else {
          // Stale value exceeds new graph capacity: pick valid default (10 if available, else closest)
          const defaultTen = questionOptions.find(o => o.value === 10);
          setSelectedQuestionValue(defaultTen ? defaultTen.value : questionOptions[questionOptions.length - 1].value);
        }
      } else {
        // Default when no valid persistence: 10 if available, else 'all'
        const defaultTen = questionOptions.find(o => o.value === 10);
        setSelectedQuestionValue(defaultTen ? defaultTen.value : 'all');
      }
    }

    // 2. Revalidate time limit
    if (persisted) {
      if (persisted.isCustomTime && persisted.timeLimitMinutes) {
        setSelectedTimePreset('custom');
        setCustomMinutesText(String(persisted.timeLimitMinutes));
      } else if ([5, 10, 20].includes(persisted.timeLimitMinutes)) {
        setSelectedTimePreset(persisted.timeLimitMinutes as TimePresetValue);
      } else if (persisted.timeLimitMinutes > 0 && persisted.timeLimitMinutes <= 180) {
        setSelectedTimePreset('custom');
        setCustomMinutesText(String(persisted.timeLimitMinutes));
      } else {
        setSelectedTimePreset(10);
      }
    } else {
      setSelectedTimePreset(10);
    }
  }, [isOpen, graph?.id, maxAvailableQuestions, questionOptions]);

  // Determine effective question count
  const effectiveQuestionCount = useMemo(() => {
    if (questionOptions.length === 0) return 0;
    if (selectedQuestionValue === 'all') {
      return maxAvailableQuestions;
    }
    const matched = questionOptions.find(o => o.value === selectedQuestionValue);
    return matched ? matched.actualCount : maxAvailableQuestions;
  }, [selectedQuestionValue, questionOptions, maxAvailableQuestions]);

  // Validate custom duration
  const parsedCustomMinutes = parseInt(customMinutesText.trim(), 10);
  const isCustomTimeValid = useMemo(() => {
    if (selectedTimePreset !== 'custom') return true;
    if (isNaN(parsedCustomMinutes)) return false;
    if (parsedCustomMinutes < 1 || parsedCustomMinutes > 180) return false;
    return Number.isInteger(Number(customMinutesText.trim()));
  }, [selectedTimePreset, customMinutesText, parsedCustomMinutes]);

  // Effective time limit in minutes
  const effectiveTimeMinutes = useMemo(() => {
    if (selectedTimePreset === 'custom') {
      return isCustomTimeValid ? parsedCustomMinutes : 10;
    }
    return selectedTimePreset;
  }, [selectedTimePreset, isCustomTimeValid, parsedCustomMinutes]);

  // Can assessment begin
  const canBeginAssessment = maxAvailableQuestions >= 3 && isCustomTimeValid && !isSubmitting;

  // Handle Begin assessment click with duplicate submission protection
  const handleBegin = useCallback(() => {
    if (!canBeginAssessment || isSubmitting) return;
    setIsSubmitting(true);

    // Persist validated settings
    saveAssessmentSetupConfig({
      questionCount: selectedQuestionValue,
      timeLimitMinutes: effectiveTimeMinutes,
      isCustomTime: selectedTimePreset === 'custom'
    });

    onBeginAssessment({
      questionCount: effectiveQuestionCount,
      timeLimitSeconds: effectiveTimeMinutes * 60
    });
  }, [
    canBeginAssessment,
    isSubmitting,
    selectedQuestionValue,
    effectiveTimeMinutes,
    selectedTimePreset,
    effectiveQuestionCount,
    onBeginAssessment
  ]);

  // Keyboard navigation: Escape closes modal, Enter starts if valid & not in input
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter') {
        const isInputFocused = document.activeElement === inputRef.current;
        if (!isInputFocused && canBeginAssessment) {
          e.preventDefault();
          handleBegin();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel, canBeginAssessment, handleBegin]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="assessment-setup-backdrop"
          onClick={onCancel}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          role="presentation"
        >
          <motion.div
            className="assessment-setup-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="setup-modal-heading"
            aria-describedby="setup-modal-description"
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -12 }}
            transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* 1. Eyebrow */}
            <div className="setup-modal-eyebrow">
              <span className="setup-eyebrow-marker" aria-hidden="true" />
              <span>CONFIGURE ASSESSMENT</span>
            </div>

            {/* 2. Heading */}
            <h2 id="setup-modal-heading" className="setup-modal-heading">
              Make it your own.
            </h2>

            {/* 3. Description */}
            <p id="setup-modal-description" className="setup-modal-description">
              Choose how many questions to attempt and how much time you want.
            </p>

            {/* Empty Edge Case Alert: No valid questions */}
            {maxAvailableQuestions < 3 && (
              <div className="setup-alert-insufficient" role="alert">
                <AlertCircle size={15} className="setup-alert-icon" aria-hidden="true" />
                <div className="setup-alert-content">
                  <span className="setup-alert-title">Insufficient Questions</span>
                  <span className="setup-alert-text">
                    This knowledge graph needs at least 3 candidate questions from extracted concepts to construct an assessment.
                  </span>
                </div>
              </div>
            )}

            {/* 4. Section: NUMBER OF QUESTIONS */}
            <div className="setup-section-block">
              <div className="setup-section-header">
                <span className="setup-section-title">NUMBER OF QUESTIONS</span>
                {maxAvailableQuestions >= 3 && (
                  <span className="setup-section-hint">
                    {maxAvailableQuestions} available
                  </span>
                )}
              </div>

              {questionOptions.length > 0 ? (
                <div
                  className="setup-pill-track"
                  role="radiogroup"
                  aria-label="Number of questions"
                >
                  {questionOptions.map((opt) => {
                    const isSelected = selectedQuestionValue === opt.value;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        className={`setup-pill-btn ${isSelected ? 'is-active' : ''}`}
                        onClick={() => setSelectedQuestionValue(opt.value)}
                      >
                        {isSelected && (
                          <motion.div
                            layoutId={shouldReduceMotion ? undefined : 'setupQuestionActivePill'}
                            className="setup-pill-active-bg"
                            transition={{
                              duration: 0.28,
                              ease: [0.22, 1, 0.36, 1]
                            }}
                          />
                        )}
                        <span className="setup-pill-label">{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="setup-disabled-track">
                  <span>No questions available for this graph</span>
                </div>
              )}
            </div>

            {/* 5. Section: TIME LIMIT */}
            <div className="setup-section-block">
              <div className="setup-section-header">
                <span className="setup-section-title">TIME LIMIT</span>
                <span className="setup-section-hint">Total exam duration</span>
              </div>

              <div
                className="setup-pill-track"
                role="radiogroup"
                aria-label="Time limit presets"
              >
                {TIME_PRESET_OPTIONS.map((opt) => {
                  const isSelected = selectedTimePreset === opt.id;
                  return (
                    <button
                      key={String(opt.id)}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      className={`setup-pill-btn ${isSelected ? 'is-active' : ''}`}
                      onClick={() => setSelectedTimePreset(opt.id)}
                    >
                      {isSelected && (
                        <motion.div
                          layoutId={shouldReduceMotion ? undefined : 'setupTimeActivePill'}
                          className="setup-pill-active-bg"
                          transition={{
                            duration: 0.28,
                            ease: [0.22, 1, 0.36, 1]
                          }}
                        />
                      )}
                      <span className="setup-pill-label">{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Custom Time Numeric Input */}
              {selectedTimePreset === 'custom' && (
                <div className="setup-custom-time-zone">
                  <div className="setup-custom-input-row">
                    <label htmlFor="custom-duration-input" className="setup-custom-label">
                      Duration in minutes
                    </label>
                    <div className="setup-custom-input-wrap">
                      <input
                        ref={inputRef}
                        id="custom-duration-input"
                        type="number"
                        min="1"
                        max="180"
                        step="1"
                        value={customMinutesText}
                        onChange={(e) => setCustomMinutesText(e.target.value)}
                        placeholder="10"
                        className={`setup-custom-input ${!isCustomTimeValid ? 'has-error' : ''}`}
                        aria-invalid={!isCustomTimeValid}
                        aria-describedby={!isCustomTimeValid ? 'custom-duration-error' : undefined}
                      />
                      <span className="setup-custom-unit">min</span>
                    </div>
                  </div>

                  {!isCustomTimeValid && (
                    <span id="custom-duration-error" className="setup-custom-error-text" role="alert">
                      Please enter a duration between 1 and 180 minutes.
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* 6. Section: LIVE SESSION SUMMARY */}
            <div className="setup-summary-card" role="region" aria-label="Assessment session summary">
              <div className="setup-summary-item">
                <span className="setup-summary-label">KNOWLEDGE GRAPH</span>
                <span className="setup-summary-value graph-name" title={graph?.name || 'Knowledge Graph'}>
                  {graph?.name || 'Knowledge Graph'}
                </span>
              </div>

              <div className="setup-summary-item">
                <span className="setup-summary-label">QUESTIONS</span>
                <span className="setup-summary-value">
                  {effectiveQuestionCount} {effectiveQuestionCount === 1 ? 'question' : 'questions'}
                </span>
              </div>

              <div className="setup-summary-item">
                <span className="setup-summary-label">TIME LIMIT</span>
                <span className="setup-summary-value">
                  {effectiveTimeMinutes} {effectiveTimeMinutes === 1 ? 'minute' : 'minutes'}
                </span>
              </div>

              <div className="setup-summary-item">
                <span className="setup-summary-label">FORMAT</span>
                <span className="setup-summary-value">Multiple choice</span>
              </div>
            </div>

            {/* 7. Modal Footer Actions */}
            <div className="setup-modal-actions">
              <button
                type="button"
                className="setup-cancel-btn"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </button>

              <button
                type="button"
                className={`setup-begin-btn ${isSubmitting ? 'is-submitting' : ''}`}
                onClick={handleBegin}
                disabled={!canBeginAssessment}
                aria-label="Begin assessment"
              >
                <span>{isSubmitting ? 'Initializing...' : 'Begin assessment'}</span>
                <ArrowRight size={14} className="setup-begin-arrow" aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
