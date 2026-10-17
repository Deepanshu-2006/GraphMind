/**
 * GraphMind Persona — usePersonaSpeech (Silent Presentation Adapter)
 *
 * Provides backward-compatible interface for legacy speech calls,
 * routing all communication through the silent visual presentation controller.
 * Strictly audio-free: zero SpeechSynthesis API calls, zero audio playback.
 */

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  personaPresentationController,
  type PresentationState
} from './personaPresentationController';
import {
  GRAPHMIN_VOICE_CONFIG,
  PERSONA_TEST_SENTENCES,
  PERSONA_GREETING_TEXT,
  type PersonaVoiceConfig,
  type PersonaTestSentenceIndex
} from './personaVoiceConfig';

export type SpeechPlaybackStatus =
  | 'unsupported'
  | 'idle'
  | 'loading'
  | 'speaking'
  | 'paused'
  | 'completed'
  | 'failed';

export type PersonaSpeakingState = 'idle' | 'speaking' | 'completed' | 'error';

export interface PersonaSpeakingInterface {
  speak: (text: string, options?: any) => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  playTestSentence: (index: PersonaTestSentenceIndex) => Promise<void>;
  playGreeting: () => Promise<void>;
  speakingState: PersonaSpeakingState;
  status: SpeechPlaybackStatus;
  isLoading: boolean;
  isSpeaking: boolean;
  isPaused: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  isError: boolean;
  isIdle: boolean;
  isSupported: boolean;
  currentText: string | null;
  error: string | null;
  voices: SpeechSynthesisVoice[];
  resolvedVoice: SpeechSynthesisVoice | null;
  voiceConfig: PersonaVoiceConfig;
}

export type UsePersonaSpeechReturn = PersonaSpeakingInterface;

export function usePersonaSpeech(): UsePersonaSpeechReturn {
  const [presentationState, setPresentationState] = useState<PresentationState>(() =>
    personaPresentationController.getState()
  );

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    const unsubscribe = personaPresentationController.subscribe((state) => {
      if (isMountedRef.current) {
        setPresentationState(state);
      }
    });

    return () => {
      isMountedRef.current = false;
      personaPresentationController.cancel();
      unsubscribe();
    };
  }, []);

  const speak = useCallback(async (text: string) => {
    await personaPresentationController.present(text, { withMouthArticulation: true });
  }, []);

  const stop = useCallback(() => {
    personaPresentationController.cancel();
  }, []);

  const pause = useCallback(() => {
    personaPresentationController.pause();
  }, []);

  const resume = useCallback(() => {
    personaPresentationController.resume();
  }, []);

  const playTestSentence = useCallback(async (index: PersonaTestSentenceIndex) => {
    const sentence = PERSONA_TEST_SENTENCES[index - 1];
    if (sentence) {
      await personaPresentationController.present(sentence, { withMouthArticulation: true });
    }
  }, []);

  const playGreeting = useCallback(async () => {
    await personaPresentationController.present(PERSONA_GREETING_TEXT, {
      withMouthArticulation: true
    });
  }, []);

  const pStatus = presentationState.status;

  const status: SpeechPlaybackStatus = useMemo(() => {
    if (pStatus === 'presenting') return 'speaking';
    if (pStatus === 'paused') return 'paused';
    if (pStatus === 'completed') return 'completed';
    return 'idle';
  }, [pStatus]);

  const speakingState: PersonaSpeakingState = useMemo(() => {
    if (pStatus === 'presenting') return 'speaking';
    if (pStatus === 'completed') return 'completed';
    return 'idle';
  }, [pStatus]);

  return {
    speak,
    stop,
    pause,
    resume,
    playTestSentence,
    playGreeting,
    speakingState,
    status,
    isLoading: false,
    isSpeaking: pStatus === 'presenting',
    isPaused: pStatus === 'paused',
    isCompleted: pStatus === 'completed',
    isFailed: false,
    isError: false,
    isIdle: pStatus === 'idle',
    isSupported: true,
    currentText: presentationState.text,
    error: null,
    voices: [],
    resolvedVoice: null,
    voiceConfig: GRAPHMIN_VOICE_CONFIG
  };
}
