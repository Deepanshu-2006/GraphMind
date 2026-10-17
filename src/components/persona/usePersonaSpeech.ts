import { useEffect, useState, useCallback, useRef } from 'react';
import {
  speechSynthesisService,
  type SpeechOptions,
  type SpeechPlaybackState,
  type SpeechPlaybackStatus
} from '../../services/speechSynthesisService';
import {
  GRAPHMIN_VOICE_CONFIG,
  PERSONA_TEST_SENTENCES,
  type PersonaVoiceConfig,
  type PersonaTestSentenceIndex
} from './personaVoiceConfig';

export interface UsePersonaSpeechReturn {
  speak: (text: string, options?: SpeechOptions) => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  playTestSentence: (index: PersonaTestSentenceIndex) => Promise<void>;
  status: SpeechPlaybackStatus;
  isLoading: boolean;
  isSpeaking: boolean;
  isCompleted: boolean;
  isFailed: boolean;
  isIdle: boolean;
  isSupported: boolean;
  currentText: string | null;
  error: string | null;
  voices: SpeechSynthesisVoice[];
  resolvedVoice: SpeechSynthesisVoice | null;
  voiceConfig: PersonaVoiceConfig;
}

/**
 * usePersonaSpeech
 *
 * Reusable React hook for Persona character voice playback.
 * Automatically synchronizes playback state, cleans up audio resources on unmount,
 * and exposes development test hooks without adding UI clutter.
 */
export function usePersonaSpeech(): UsePersonaSpeechReturn {
  const [playbackState, setPlaybackState] = useState<SpeechPlaybackState>(() =>
    speechSynthesisService.getState()
  );
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>(() =>
    speechSynthesisService.getVoices()
  );

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;

    // Subscribe to speech state changes
    const unsubscribe = speechSynthesisService.subscribe((state) => {
      if (isMountedRef.current) {
        setPlaybackState(state);
      }
    });

    // Populate voices
    setVoices(speechSynthesisService.getVoices());

    // Register dev-only testing handle without affecting UI or production
    if (import.meta.env.DEV && typeof window !== 'undefined') {
      (window as any).__personaSpeech = {
        speak: (text: string, opts?: SpeechOptions) => speechSynthesisService.speak(text, opts),
        stop: () => speechSynthesisService.stop(),
        pause: () => speechSynthesisService.pause(),
        resume: () => speechSynthesisService.resume(),
        getState: () => speechSynthesisService.getState(),
        getVoices: () => speechSynthesisService.getVoices(),
        getVoiceConfig: () => speechSynthesisService.getVoiceConfig(),
        getResolvedVoice: () => speechSynthesisService.getResolvedVoice(),
        playTestSentence: (index: PersonaTestSentenceIndex) => {
          const sentence = PERSONA_TEST_SENTENCES[index - 1];
          if (sentence) return speechSynthesisService.speak(sentence);
          return Promise.reject(new Error(`Invalid sentence index: ${index}`));
        },
        testSentences: PERSONA_TEST_SENTENCES,
        isSupported: () => speechSynthesisService.isSupported()
      };
    }

    // Cleanup on unmount: stop audio immediately to prevent runaway speech
    return () => {
      isMountedRef.current = false;
      speechSynthesisService.stop();
      unsubscribe();

      if (import.meta.env.DEV && typeof window !== 'undefined') {
        delete (window as any).__personaSpeech;
      }
    };
  }, []);

  const speak = useCallback(async (text: string, options?: SpeechOptions) => {
    try {
      await speechSynthesisService.speak(text, options);
    } catch {
      // Error state is captured and dispatched reactively via speechSynthesisService listeners
    }
  }, []);

  const stop = useCallback(() => {
    speechSynthesisService.stop();
  }, []);

  const pause = useCallback(() => {
    speechSynthesisService.pause();
  }, []);

  const resume = useCallback(() => {
    speechSynthesisService.resume();
  }, []);

  const playTestSentence = useCallback(async (index: PersonaTestSentenceIndex) => {
    const sentence = PERSONA_TEST_SENTENCES[index - 1];
    if (sentence) {
      await speak(sentence);
    }
  }, [speak]);

  const status = playbackState.status;
  const resolvedVoice = speechSynthesisService.getResolvedVoice();

  return {
    speak,
    stop,
    pause,
    resume,
    playTestSentence,
    status,
    isLoading: status === 'loading',
    isSpeaking: status === 'speaking',
    isCompleted: status === 'completed',
    isFailed: status === 'failed',
    isIdle: status === 'idle',
    isSupported: status !== 'unsupported',
    currentText: playbackState.text,
    error: playbackState.error,
    voices,
    resolvedVoice,
    voiceConfig: GRAPHMIN_VOICE_CONFIG
  };
}
