import React, { useEffect, useRef, useCallback, useState } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
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

export interface PersonaExperienceProps {
  isOpen: boolean;
  onClose: () => void;
  /** Integration slot for Prompt 02: 3D Humanoid character */
  characterSlot?: React.ReactNode;
}

export const PersonaExperience: React.FC<PersonaExperienceProps> = ({
  isOpen,
  onClose,
  characterSlot
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const exitButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const [animationState, setAnimationState] = useState<PersonaAnimationState>('INITIALIZING');
  const [greetingCaptionVisible, setGreetingCaptionVisible] = useState(false);
  const hasTriggeredGreetingRef = useRef(false);

  // Reusable silent visual presentation infrastructure
  const presentation = usePersonaPresentation();

  // Coordinated visual greeting handler: manages subtitle visibility and timing
  const handleGreetingChange = useCallback((stage: PersonaGreetingStage) => {
    if (stage === 'greeting') {
      if (!hasTriggeredGreetingRef.current) {
        hasTriggeredGreetingRef.current = true;
        setGreetingCaptionVisible(true);
      }
    } else if (stage === 'complete') {
      setGreetingCaptionVisible(false);
    }
  }, []);

  const handleExit = useCallback(() => {
    presentation.cancel();
    onClose();
  }, [presentation, onClose]);

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

  // Focus management: cache last active element and focus exit button
  useEffect(() => {
    if (isOpen) {
      if (typeof document !== 'undefined') {
        previousFocusRef.current = document.activeElement as HTMLElement | null;
      }

      // Defer focus slightly for smooth mounting transition
      const timer = setTimeout(() => {
        exitButtonRef.current?.focus();
      }, 50);

      return () => {
        clearTimeout(timer);
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
    [onClose]
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
            />
          )}
        </div>

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
