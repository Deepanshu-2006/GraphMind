import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Plus, Minus, AlertCircle, Edit3, Check } from 'lucide-react';
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

/**
 * Format any integer to 2 digits (e.g. 5 -> '05')
 */
export function formatTwoDigits(val: number): string {
  const safe = Math.max(0, Math.floor(val));
  return safe.toString().padStart(2, '0');
}

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

/**
 * Curved Mechanical Reel Component for Minutes and Seconds
 * Uses cylindrical 3D rotation, scaling, and smooth mechanical translation.
 */
interface CurvedReelProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  onIncrement: () => void;
  onDecrement: () => void;
  label: string;
  unit: string;
  disabled?: boolean;
}

function CurvedReel({
  value,
  min,
  max,
  onChange,
  onIncrement,
  onDecrement,
  label,
  unit,
  disabled
}: CurvedReelProps) {
  const shouldReduceMotion = useReducedMotion();
  const lastWheelTimeRef = useRef<number>(0);
  const touchStartYRef = useRef<number | null>(null);

  // Visible slots around the center: -2, -1, 0, 1, 2
  const visibleOffsets = [-2, -1, 0, 1, 2];

  // Wheel / Trackpad scroll interaction
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    const now = Date.now();
    if (now - lastWheelTimeRef.current < 50) return; // Prevent runaway scrolling
    lastWheelTimeRef.current = now;

    if (e.deltaY < 0) {
      onIncrement();
    } else if (e.deltaY > 0) {
      onDecrement();
    }
  };

  // Keyboard navigation on reel container
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onIncrement();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onDecrement();
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      onChange(Math.min(max, value + 5));
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      onChange(Math.max(min, value - 5));
    }
  };

  // Touch swipe interactions
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || e.touches.length === 0) return;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled || touchStartYRef.current === null || e.touches.length === 0) return;
    const currentY = e.touches[0].clientY;
    const deltaY = currentY - touchStartYRef.current;
    if (Math.abs(deltaY) > 20) {
      if (deltaY < 0) {
        onDecrement();
      } else {
        onIncrement();
      }
      touchStartYRef.current = currentY;
    }
  };

  const handleTouchEnd = () => {
    touchStartYRef.current = null;
  };

  return (
    <div className="curved-reel-column">
      {/* Quick Plus Control */}
      <button
        type="button"
        className="curved-reel-quick-btn"
        onClick={onIncrement}
        disabled={disabled || value >= max}
        title={`Increase ${label}`}
        aria-label={`Increase ${label}`}
      >
        <Plus size={12} strokeWidth={2.4} aria-hidden="true" />
      </button>

      {/* 3D Curved Cylindrical Viewport */}
      <div
        className="curved-reel-viewport"
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        tabIndex={disabled ? -1 : 0}
        role="spinbutton"
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={min}
        aria-valuemax={max}
      >
        {/* Active Viewing Aperture Bracket */}
        <div className="curved-reel-center-bracket" aria-hidden="true" />

        {/* Cylindrical Number Ring */}
        <div className="curved-reel-slots-wrap">
          {visibleOffsets.map((offset) => {
            const slotVal = value + offset;
            const isWithinBounds = slotVal >= min && slotVal <= max;
            const absOffset = Math.abs(offset);

            // Cylindrical rotation and distance scaling
            const rotateX = offset * 24; // degrees
            const scale = absOffset === 0 ? 1 : absOffset === 1 ? 0.82 : 0.65;
            const opacity = absOffset === 0 ? 1 : absOffset === 1 ? 0.40 : 0.16;

            return (
              <div
                key={offset}
                className={`curved-reel-slot ${offset === 0 ? 'is-center' : 'is-neighbor'}`}
                style={{
                  transform: shouldReduceMotion
                    ? undefined
                    : `rotateX(${rotateX}deg) scale(${scale})`,
                  opacity: isWithinBounds ? opacity : 0,
                  pointerEvents: isWithinBounds ? 'auto' : 'none'
                }}
                onClick={() => {
                  if (isWithinBounds && offset !== 0) {
                    onChange(slotVal);
                  }
                }}
              >
                <span className="curved-reel-slot-num">
                  {isWithinBounds ? formatTwoDigits(slotVal) : '--'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Minus Control */}
      <button
        type="button"
        className="curved-reel-quick-btn"
        onClick={onDecrement}
        disabled={disabled || value <= min}
        title={`Decrease ${label}`}
        aria-label={`Decrease ${label}`}
      >
        <Minus size={12} strokeWidth={2.4} aria-hidden="true" />
      </button>

      {/* Restrained Sub-Label */}
      <span className="curved-reel-unit-label">{unit}</span>
    </div>
  );
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

  // Custom Animated Timer State: Minutes and Seconds
  const [minutes, setMinutes] = useState<number>(10);
  const [seconds, setSeconds] = useState<number>(0);

  // Direct Numeric Entry Toggle & Input States
  const [isDirectEntry, setIsDirectEntry] = useState<boolean>(false);
  const [directMinText, setDirectMinText] = useState<string>('10');
  const [directSecText, setDirectSecText] = useState<string>('00');

  // Load and revalidate persisted settings on mount or when graph/capacity changes
  useEffect(() => {
    if (!isOpen) {
      setIsSubmitting(false);
      setIsDirectEntry(false);
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
          setSelectedQuestionValue('all');
        } else {
          const defaultTen = questionOptions.find(o => o.value === 10);
          setSelectedQuestionValue(defaultTen ? defaultTen.value : questionOptions[questionOptions.length - 1].value);
        }
      } else {
        const defaultTen = questionOptions.find(o => o.value === 10);
        setSelectedQuestionValue(defaultTen ? defaultTen.value : 'all');
      }
    }

    // 2. Restore duration from persisted setting or default to 10:00
    if (persisted?.timeLimitMinutes && persisted.timeLimitMinutes > 0) {
      const initialMinutes = Math.min(180, Math.max(1, persisted.timeLimitMinutes));
      setMinutes(initialMinutes);
      setSeconds(0);
      setDirectMinText(String(initialMinutes));
      setDirectSecText('00');
    } else {
      setMinutes(10);
      setSeconds(0);
      setDirectMinText('10');
      setDirectSecText('00');
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

  // Total assessment duration in seconds
  const totalSeconds = useMemo(() => {
    return minutes * 60 + seconds;
  }, [minutes, seconds]);

  // Validation: minimum duration is 1 minute (60s), maximum is 180 minutes (10,800s)
  const isTimeValid = totalSeconds >= 60 && totalSeconds <= 180 * 60;
  const canBeginAssessment = maxAvailableQuestions >= 3 && isTimeValid && !isSubmitting;

  // Increment / Decrement handlers for Minutes
  const handleIncrementMinutes = useCallback(() => {
    setMinutes(prev => {
      const next = Math.min(180, prev + 1);
      setDirectMinText(String(next));
      return next;
    });
  }, []);

  const handleDecrementMinutes = useCallback(() => {
    setMinutes(prev => {
      const next = Math.max(0, prev - 1);
      setDirectMinText(String(next));
      return next;
    });
  }, []);

  // Increment / Decrement handlers for Seconds (15-second adjustments)
  const handleIncrementSeconds = useCallback(() => {
    setSeconds(prev => {
      let next = prev + 15;
      if (next >= 60) {
        next = 0;
        setMinutes(m => {
          const nextM = Math.min(180, m + 1);
          setDirectMinText(String(nextM));
          return nextM;
        });
      }
      setDirectSecText(formatTwoDigits(next));
      return next;
    });
  }, []);

  const handleDecrementSeconds = useCallback(() => {
    setSeconds(prev => {
      let next = prev - 15;
      if (next < 0) {
        next = 45;
        setMinutes(m => {
          const nextM = Math.max(0, m - 1);
          setDirectMinText(String(nextM));
          return nextM;
        });
      }
      setDirectSecText(formatTwoDigits(next));
      return next;
    });
  }, []);

  // Commit direct entry values
  const handleApplyDirectEntry = () => {
    const parsedMin = parseInt(directMinText.trim(), 10);
    const parsedSec = parseInt(directSecText.trim(), 10);

    const safeMin = isNaN(parsedMin) ? 10 : Math.min(180, Math.max(0, parsedMin));
    const safeSec = isNaN(parsedSec) ? 0 : Math.min(59, Math.max(0, parsedSec));

    setMinutes(safeMin);
    setSeconds(safeSec);
    setDirectMinText(String(safeMin));
    setDirectSecText(formatTwoDigits(safeSec));
    setIsDirectEntry(false);
  };

  // Format time limit for session summary
  const formattedTimeDisplay = useMemo(() => {
    return `${formatTwoDigits(minutes)}:${formatTwoDigits(seconds)}`;
  }, [minutes, seconds]);

  // Handle Begin assessment click with duplicate submission protection
  const handleBegin = useCallback(() => {
    if (!canBeginAssessment || isSubmitting) return;
    setIsSubmitting(true);

    // Persist validated settings
    const roundedMinutes = Math.max(1, Math.round(totalSeconds / 60));
    saveAssessmentSetupConfig({
      questionCount: selectedQuestionValue,
      timeLimitMinutes: roundedMinutes,
      isCustomTime: true
    });

    onBeginAssessment({
      questionCount: effectiveQuestionCount,
      timeLimitSeconds: totalSeconds
    });
  }, [
    canBeginAssessment,
    isSubmitting,
    selectedQuestionValue,
    totalSeconds,
    effectiveQuestionCount,
    onBeginAssessment
  ]);

  // Keyboard navigation: Escape closes modal, Enter starts if valid & not in input
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      } else if (e.key === 'Enter') {
        const isInputFocused = document.activeElement?.tagName === 'INPUT';
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

            {/* 2. Main Heading */}
            <h2 id="setup-modal-heading" className="setup-modal-heading">
              Make it your own.
            </h2>

            {/* 3. Description */}
            <p id="setup-modal-description" className="setup-modal-description">
              Choose your questions and set a time that works for you.
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
                <h3 className="setup-section-title">Number of questions</h3>
                {maxAvailableQuestions >= 3 && (
                  <span className="setup-section-hint">
                    {maxAvailableQuestions} available in graph
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

            {/* 5. Section: TIME LIMIT (Curved Mechanical Rotating Reels) */}
            <div className="setup-section-block">
              <div className="setup-section-header">
                <h3 className="setup-section-title">Time limit</h3>
                <button
                  type="button"
                  className="setup-direct-toggle-btn"
                  onClick={() => setIsDirectEntry(prev => !prev)}
                  title={isDirectEntry ? 'Switch to wheel picker' : 'Type duration directly'}
                  aria-label={isDirectEntry ? 'Switch to wheel picker' : 'Type duration directly'}
                >
                  {isDirectEntry ? (
                    <>
                      <Check size={11} aria-hidden="true" />
                      <span>Wheel mode</span>
                    </>
                  ) : (
                    <>
                      <Edit3 size={11} aria-hidden="true" />
                      <span>Direct entry</span>
                    </>
                  )}
                </button>
              </div>

              {/* Curved Mechanical Number Selector Instrument */}
              <div className="curved-timer-instrument" role="group" aria-label="Assessment time selector">
                <div className="curved-timer-top-label">
                  <span>TOTAL ASSESSMENT TIME</span>
                </div>

                {!isDirectEntry ? (
                  <div className="curved-timer-reels-row">
                    {/* Minutes Reel */}
                    <CurvedReel
                      value={minutes}
                      min={0}
                      max={180}
                      onChange={(m) => {
                        setMinutes(m);
                        setDirectMinText(String(m));
                      }}
                      onIncrement={handleIncrementMinutes}
                      onDecrement={handleDecrementMinutes}
                      label="Minutes"
                      unit="MINUTES"
                    />

                    {/* Central Separator Colon */}
                    <div className="curved-timer-separator-wrap" aria-hidden="true">
                      <span className="curved-timer-separator-colon">:</span>
                    </div>

                    {/* Seconds Reel */}
                    <CurvedReel
                      value={seconds}
                      min={0}
                      max={59}
                      onChange={(s) => {
                        setSeconds(s);
                        setDirectSecText(formatTwoDigits(s));
                      }}
                      onIncrement={handleIncrementSeconds}
                      onDecrement={handleDecrementSeconds}
                      label="Seconds"
                      unit="SECONDS"
                    />
                  </div>
                ) : (
                  /* Accessible Direct Numeric Entry Mode */
                  <div className="curved-timer-direct-entry-box">
                    <div className="direct-entry-fields-row">
                      <div className="direct-entry-field">
                        <label htmlFor="direct-entry-min" className="direct-entry-label">
                          Minutes
                        </label>
                        <input
                          id="direct-entry-min"
                          type="number"
                          min="0"
                          max="180"
                          value={directMinText}
                          onChange={(e) => setDirectMinText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleApplyDirectEntry();
                          }}
                          className="direct-entry-input"
                          autoFocus
                        />
                      </div>

                      <span className="direct-entry-colon" aria-hidden="true">:</span>

                      <div className="direct-entry-field">
                        <label htmlFor="direct-entry-sec" className="direct-entry-label">
                          Seconds
                        </label>
                        <input
                          id="direct-entry-sec"
                          type="number"
                          min="0"
                          max="59"
                          value={directSecText}
                          onChange={(e) => setDirectSecText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleApplyDirectEntry();
                          }}
                          className="direct-entry-input"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className="direct-entry-confirm-btn"
                      onClick={handleApplyDirectEntry}
                    >
                      Apply duration
                    </button>
                  </div>
                )}

                {/* Validation helper text if duration < 1 minute */}
                {totalSeconds < 60 && (
                  <span className="setup-timer-validation-hint" role="alert">
                    Minimum assessment duration is 1 minute (01:00).
                  </span>
                )}
              </div>
            </div>

            {/* 6. Section: REDESIGNED MINIMAL SESSION SUMMARY */}
            <div className="setup-session-summary" role="region" aria-label="Assessment session summary">
              <div className="summary-col">
                <span className="summary-meta-label">KNOWLEDGE GRAPH</span>
                <span className="summary-meta-val graph-name" title={graph?.name || 'Knowledge Graph'}>
                  {graph?.name || 'Knowledge Graph'}
                </span>
              </div>

              <div className="summary-col">
                <span className="summary-meta-label">QUESTIONS</span>
                <span className="summary-meta-val">
                  {effectiveQuestionCount} {effectiveQuestionCount === 1 ? 'question' : 'questions'}
                </span>
              </div>

              <div className="summary-col">
                <span className="summary-meta-label">TIME LIMIT</span>
                <span className="summary-meta-val">
                  {formattedTimeDisplay}
                </span>
              </div>

              <div className="summary-col">
                <span className="summary-meta-label">FORMAT</span>
                <span className="summary-meta-val">Multiple choice</span>
              </div>
            </div>

            {/* 7. Modal Footer: Minimal Text-Only Actions */}
            <div className="setup-modal-actions">
              <button
                type="button"
                className="setup-cancel-text-btn"
                onClick={onCancel}
                disabled={isSubmitting}
              >
                Cancel
              </button>

              <button
                type="button"
                className={`setup-begin-text-btn ${isSubmitting ? 'is-submitting' : ''}`}
                onClick={handleBegin}
                disabled={!canBeginAssessment}
                aria-label="Begin assessment"
              >
                <span className="setup-begin-text-content">
                  <span className="setup-begin-label">
                    {isSubmitting ? 'Initializing...' : 'Begin assessment'}
                  </span>
                  <span className="setup-begin-arrow" aria-hidden="true">
                    →
                  </span>
                </span>
                <span className="setup-begin-underline" aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
