import React, { useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion, type Variants } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { PersonaAtmosphere } from './PersonaAtmosphere';
import {
  PersonaHumanoidCanvas,
  type PersonaAnimationState,
  type PersonaGreetingStage
} from './PersonaHumanoidCanvas';
import { personaTransitionController } from './personaTransition';
import { usePersonaPresentation } from './usePersonaPresentation';
import { PERSONA_GREETING_TEXT } from './personaVoiceConfig';
import { PersonaActivityPanel } from './PersonaActivityPanel';
import { PersonaPerformancePanel } from './PersonaPerformancePanel';
import { usePersonaStats } from './usePersonaStats';
import { useOptionalGraph } from '../../context/GraphContext';

export interface PersonaExperienceProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectGraph?: (graphId: string) => void;
  onSelectAssessment?: (attemptId: string, graphId?: string) => void;
  onResumeRevision?: (graphId: string) => void;
  /** Integration slot for Prompt 02: 3D Humanoid character */
  characterSlot?: React.ReactNode;
}

export const PersonaExperience: React.FC<PersonaExperienceProps> = ({
  isOpen,
  onClose,
  onSelectGraph,
  onSelectAssessment,
  onResumeRevision,
  characterSlot
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const exitButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const [animationState, setAnimationState] = useState<PersonaAnimationState>('INITIALIZING');
  const [greetingCaptionVisible, setGreetingCaptionVisible] = useState(false);
  const [isLeftPanelVisible, setIsLeftPanelVisible] = useState(false);
  const [isRightPanelVisible, setIsRightPanelVisible] = useState(false);
  const hasTriggeredGreetingRef = useRef(false);

  // Reusable silent visual presentation infrastructure
  const presentation = usePersonaPresentation();
  const leftTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Coordinated visual greeting handler: manages subtitle visibility and timing
  const handleGreetingChange = useCallback((stage: PersonaGreetingStage) => {
    if (stage === 'greeting') {
      if (!hasTriggeredGreetingRef.current) {
        hasTriggeredGreetingRef.current = true;
        setGreetingCaptionVisible(true);
      }
    } else if (stage === 'complete') {
      // 1. Greeting text fades out
      setGreetingCaptionVisible(false);

      // 2. Character begins turning head and eyes left to introduce the left stats.
      // Render left stats 350ms later right as character's gaze lands on the left area.
      if (leftTimerRef.current) clearTimeout(leftTimerRef.current);
      leftTimerRef.current = setTimeout(() => {
        setIsLeftPanelVisible(true);
      }, shouldReduceMotion ? 0 : 350);

      // 3. Safety fallback: ensure right panel appears after left panel is completely rendered (~3.05s) even if canvas event is delayed
      if (rightTimerRef.current) clearTimeout(rightTimerRef.current);
      rightTimerRef.current = setTimeout(() => {
        setIsRightPanelVisible(true);
      }, shouldReduceMotion ? 0 : 3600);
    } else if (stage === 'glance-right') {
      // 4. Character has introduced left stats and now turns head and eyes right.
      // Render right performance panel 350ms later right as character's gaze lands on the right area.
      if (rightTimerRef.current) clearTimeout(rightTimerRef.current);
      rightTimerRef.current = setTimeout(() => {
        setIsRightPanelVisible(true);
      }, shouldReduceMotion ? 0 : 350);
    }
  }, [shouldReduceMotion]);

  // If characterSlot is provided externally (e.g. test harness without 3D canvas), reveal stats
  useEffect(() => {
    if (characterSlot) {
      setIsLeftPanelVisible(true);
      setIsRightPanelVisible(true);
    }
    return () => {
      if (leftTimerRef.current) clearTimeout(leftTimerRef.current);
      if (rightTimerRef.current) clearTimeout(rightTimerRef.current);
    };
  }, [characterSlot]);

  const graphContext = useOptionalGraph();
  const { stats } = usePersonaStats();
  const averageScore = stats?.performance?.averageScore ?? null;

  const handleExit = useCallback(() => {
    if (leftTimerRef.current) clearTimeout(leftTimerRef.current);
    if (rightTimerRef.current) clearTimeout(rightTimerRef.current);
    presentation.cancel();
    onClose();
  }, [presentation, onClose]);

  const handleSelectGraph = useCallback((graphId: string) => {
    if (leftTimerRef.current) clearTimeout(leftTimerRef.current);
    if (rightTimerRef.current) clearTimeout(rightTimerRef.current);
    presentation.cancel();
    if (onSelectGraph) {
      onSelectGraph(graphId);
    } else {
      if (graphContext?.switchGraph) {
        graphContext.switchGraph(graphId);
      }
      onClose();
    }
  }, [onSelectGraph, graphContext, onClose, presentation]);

  const handleSelectAssessment = useCallback((attemptId: string, graphId?: string) => {
    if (leftTimerRef.current) clearTimeout(leftTimerRef.current);
    if (rightTimerRef.current) clearTimeout(rightTimerRef.current);
    presentation.cancel();
    if (onSelectAssessment) {
      onSelectAssessment(attemptId, graphId);
    } else {
      if (graphId && graphContext?.switchGraph) {
        graphContext.switchGraph(graphId);
      }
      onClose();
    }
  }, [onSelectAssessment, graphContext, onClose, presentation]);

  const handleResumeRevision = useCallback((graphId: string) => {
    if (leftTimerRef.current) clearTimeout(leftTimerRef.current);
    if (rightTimerRef.current) clearTimeout(rightTimerRef.current);
    presentation.cancel();
    if (onResumeRevision) {
      onResumeRevision(graphId);
    } else {
      if (graphContext?.switchGraph) {
        graphContext.switchGraph(graphId);
      }
      onClose();
    }
  }, [onResumeRevision, graphContext, onClose, presentation]);

  // Synchronize status indicator with the shared persona transition controller
  useEffect(() => {
    return personaTransitionController.subscribe((state) => {
      if (state === 'ORB_TO_HUMAN') {
        setAnimationState('FORMING_HUMANOID');
      } else if (state === 'HUMAN_FORMED' || state === 'PERSONA_READY') {
        setAnimationState('IDLE');
      } else {
        setAnimationState('INITIALIZING');
      }
    });
  }, []);

  // Always clean up panel timers on unmount to prevent state updates on unmounted component
  useEffect(() => {
    return () => {
      if (leftTimerRef.current) clearTimeout(leftTimerRef.current);
      if (rightTimerRef.current) clearTimeout(rightTimerRef.current);
    };
  }, []);

  // Focus management: cache last active element and restore on unmount
  useEffect(() => {
    if (isOpen) {
      if (typeof document !== 'undefined') {
        previousFocusRef.current = document.activeElement as HTMLElement | null;
      }

      return () => {
        if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
          previousFocusRef.current.focus();
        }
      };
    }
  }, [isOpen]);

  // Keyboard navigation: Escape to exit + Focus trapping
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleExit();
        return;
      }

      if (e.key === 'Tab' && containerRef.current) {
        const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"]), [href], input:not([disabled])'
        );

        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    },
    [handleExit]
  );

  // Prevent background scroll while Persona is mounted
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // Framer Motion animation variants
  const backdropVariants: Variants = {
    hidden: {
      opacity: 0
    },
    visible: {
      opacity: 1,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.35,
        ease: [0.16, 1, 0.3, 1]
      }
    },
    exit: {
      opacity: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.25,
        ease: [0.16, 1, 0.3, 1]
      }
    }
  };

  const getStatusLabel = (state: PersonaAnimationState): string => {
    switch (state) {
      case 'INITIALIZING':
        return 'INITIALIZING';
      case 'SPHERE':
        return 'KNOWLEDGE SPHERE';
      case 'FORMING_HUMANOID':
        return 'RECONSTRUCTING';
      case 'HUMANOID_SETTLING':
        return 'STABILIZING';
      case 'PARTIAL_SOLIDIFICATION':
        return 'MATERIALIZING';
      case 'FULLY_SOLID':
        return 'STABILIZED';
      case 'IDLE':
        return 'READY';
      default:
        return 'READY';
    }
  };

  return (
    <motion.div
      ref={containerRef}
      className="persona-experience-root"
      role="dialog"
      aria-modal="true"
      aria-label="GraphMind Persona"
      id="persona-experience"
      onKeyDown={handleKeyDown}
      variants={backdropVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
    >
      {/* Background Atmosphere */}
      <PersonaAtmosphere />

      {/* Persona Header: Minimal editorial exit control */}
      <header className="persona-header" role="banner">
        <button
          ref={exitButtonRef}
          type="button"
          className="persona-exit-btn"
          onClick={handleExit}
          aria-label="Exit GraphMind Persona and return to workspace"
          id="btn-persona-exit"
        >
          <ArrowLeft size={14} strokeWidth={1.5} className="persona-exit-arrow" aria-hidden="true" />
          <span className="persona-exit-text">Return to workspace</span>
          <kbd className="persona-exit-shortcut" aria-hidden="true">Esc</kbd>
        </button>

        <div className="persona-status-indicator" title={`System Status: ${getStatusLabel(animationState)}`}>
          <span className="persona-status-dot" aria-hidden="true" />
          <span className="persona-status-label">{getStatusLabel(animationState)}</span>
        </div>
      </header>

      {/* Main Experience Viewport (Full-bleed cinematic character stage) */}
      <main className="persona-main-content">
        {/* 3D Humanoid Character Stage — Emerging from the bottom edge */}
        <div
          className="persona-character-stage"
          id="persona-character-stage"
          data-character-stage="true"
          aria-hidden="true"
        >
          {characterSlot || (
            <PersonaHumanoidCanvas
              onStateChange={setAnimationState}
              onGreetingChange={handleGreetingChange}
              assessmentScore={averageScore}
            />
          )}
        </div>

        {/* Dashboard 3-Column Overlay — Left: Learning Activity, Center: Clear for Character, Right: Learning Performance */}
        <AnimatePresence>
          {isLeftPanelVisible && (
            <motion.div
              className="persona-dashboard-overlay"
              id="persona-dashboard-overlay"
              role="region"
              aria-label="Learning Statistics Dashboard"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: shouldReduceMotion ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="persona-dashboard-left">
                <PersonaActivityPanel onSelectGraph={handleSelectGraph} />
              </div>
              <div className="persona-dashboard-center" aria-hidden="true" />
              <div className="persona-dashboard-right">
                <AnimatePresence>
                  {isRightPanelVisible && (
                    <PersonaPerformancePanel
                      onSelectGraph={handleSelectGraph}
                      onSelectAssessment={handleSelectAssessment}
                      onResumeRevision={handleResumeRevision}
                    />
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Minimal, elegant visual subtitle capsule (silent presentation) */}
        {greetingCaptionVisible && (
          <div
            className="persona-speech-caption-container"
            aria-live="polite"
            data-speech-caption="true"
          >
            <div className="persona-speech-caption">
              {presentation.revealedText || PERSONA_GREETING_TEXT}
            </div>
          </div>
        )}
      </main>
    </motion.div>
  );
};
