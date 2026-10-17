import { useEffect, useState, useCallback, useRef } from 'react';
import {
  speechSynthesisService,
  type SpeechOptions,
  type SpeechPlaybackState,
  type SpeechPlaybackStatus
} from '../../services/speechSynthesisService';

export interface UsePersonaSpeechReturn {
  speak: (text: string, options?: SpeechOptions) => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
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
        getState: () => speechSynthesisService.getState(),
        getVoices: () => speechSynthesisService.getVoices(),
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

  const status = playbackState.status;

  return {
    speak,
    stop,
    pause,
    resume,
    status,
    isLoading: status === 'loading',
    isSpeaking: status === 'speaking',
    isCompleted: status === 'completed',
    isFailed: status === 'failed',
    isIdle: status === 'idle',
    isSupported: status !== 'unsupported',
    currentText: playbackState.text,
    error: playbackState.error,
    voices
  };
}
