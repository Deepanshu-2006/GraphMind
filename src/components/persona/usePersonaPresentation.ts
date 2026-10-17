import { useEffect, useState, useCallback, useRef } from 'react';
import {
  personaPresentationController,
  type PresentationState,
  type PresentationStatus,
  type PresentationOptions
} from './personaPresentationController';
import { PERSONA_GREETING_TEXT } from './personaVoiceConfig';

export interface PersonaPresentationInterface {
  present: (text: string, options?: PresentationOptions) => Promise<void>;
  cancel: () => void;
  pause: () => void;
  resume: () => void;
  playGreetingPresentation: () => Promise<void>;
  status: PresentationStatus;
  isPresenting: boolean;
  isIdle: boolean;
  isPaused: boolean;
  isCompleted: boolean;
  text: string | null;
  revealedText: string | null;
  currentWord: string | null;
  progress: number;
}

export type UsePersonaPresentationReturn = PersonaPresentationInterface;

/**
 * usePersonaPresentation
 *
 * Clean, reusable React hook for silent visual Persona communication.
 * Coordinates on-screen text reveal with optional subtle character mouth movements.
 * Strictly audio-free: zero speech synthesis, zero audio generation.
 */
export function usePersonaPresentation(): UsePersonaPresentationReturn {
  const [presentationState, setPresentationState] = useState<PresentationState>(() =>
    personaPresentationController.getState()
  );

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    // Subscribe to presentation state changes
    const unsubscribe = personaPresentationController.subscribe((state) => {
      if (isMountedRef.current) {
        setPresentationState(state);
      }
    });

    // Register dev-only inspection handle
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      (window as any).__personaPresentation = {
        present: (text: string, opts?: PresentationOptions) =>
          personaPresentationController.present(text, opts),
        cancel: () => personaPresentationController.cancel(),
        pause: () => personaPresentationController.pause(),
        resume: () => personaPresentationController.resume(),
        getState: () => personaPresentationController.getState(),
        playGreeting: () =>
          personaPresentationController.present(PERSONA_GREETING_TEXT, {
            withMouthArticulation: true
          })
      };
    }

    // Cleanup on unmount: halts any active presentation and returns mouth to rest
    return () => {
      isMountedRef.current = false;
      personaPresentationController.cancel();
      unsubscribe();

      if (import.meta.env.DEV && typeof window !== 'undefined') {
        delete (window as any).__personaPresentation;
      }
    };
  }, []);

  const present = useCallback(async (text: string, options?: PresentationOptions) => {
    await personaPresentationController.present(text, options);
  }, []);

  const cancel = useCallback(() => {
    personaPresentationController.cancel();
  }, []);

  const pause = useCallback(() => {
    personaPresentationController.pause();
  }, []);

  const resume = useCallback(() => {
    personaPresentationController.resume();
  }, []);

  const playGreetingPresentation = useCallback(async () => {
    await personaPresentationController.present(PERSONA_GREETING_TEXT, {
      withMouthArticulation: true
    });
  }, []);

  const status = presentationState.status;

  return {
    present,
    cancel,
    pause,
    resume,
    playGreetingPresentation,
    status,
    isPresenting: status === 'presenting',
    isIdle: status === 'idle',
    isPaused: status === 'paused',
    isCompleted: status === 'completed',
    text: presentationState.text,
    revealedText: presentationState.revealedText,
    currentWord: presentationState.currentWord,
    progress: presentationState.progress
  };
}
