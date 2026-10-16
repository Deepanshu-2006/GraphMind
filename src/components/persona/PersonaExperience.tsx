import React, { useEffect, useRef, useCallback } from 'react';
import { motion, useReducedMotion, type Variants } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { PersonaAtmosphere } from './PersonaAtmosphere';

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
        onClose();
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

  const contentVariants: Variants = {
    hidden: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : 12
    },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.45,
        ease: [0.16, 1, 0.3, 1],
        delay: shouldReduceMotion ? 0 : 0.08
      }
    },
    exit: {
      opacity: 0,
      y: shouldReduceMotion ? 0 : -8,
      transition: {
        duration: shouldReduceMotion ? 0 : 0.2,
        ease: [0.16, 1, 0.3, 1]
      }
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
          onClick={onClose}
          aria-label="Exit GraphMind Persona and return to workspace"
          id="btn-persona-exit"
        >
          <ArrowLeft size={14} strokeWidth={1.5} className="persona-exit-arrow" aria-hidden="true" />
          <span className="persona-exit-text">Return to workspace</span>
          <kbd className="persona-exit-shortcut" aria-hidden="true">Esc</kbd>
        </button>

        <div className="persona-status-indicator" title="System Ready">
          <span className="persona-status-dot" aria-hidden="true" />
          <span className="persona-status-label">READY</span>
        </div>
      </header>

      {/* Main Experience Viewport */}
      <main className="persona-main-content">
        {/* Reserved 3D Character Stage (Prompt 02 Integration Anchor) */}
        <div
          className="persona-character-stage"
          id="persona-character-stage"
          data-character-stage="true"
          aria-hidden="true"
        >
          {characterSlot || (
            <div className="persona-stage-placeholder" data-integration-point="prompt-02-humanoid" />
          )}
        </div>

        {/* Editorial Narrative Typography */}
        <motion.div className="persona-typography-block" variants={contentVariants}>
          <div className="persona-identity-tag">
            <span className="persona-identity-dot" aria-hidden="true" />
            <span>GRAPHMIND PERSONA</span>
          </div>

          <h1 className="persona-headline">Your learning, brought to life.</h1>

          <p className="persona-supporting">
            A personal space for exploring your knowledge journey.
          </p>
        </motion.div>
      </main>
    </motion.div>
  );
};
