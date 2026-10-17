/**
 * GraphMind Persona — Reusable Speech Synthesis Service
 *
 * Provides a clean, resilient abstraction over the browser SpeechSynthesis API.
 * Supports:
 * - Playback state tracking (idle, loading, speaking, completed, failed, unsupported)
 * - Preventing overlapping speech requests
 * - Dynamic, cross-platform voice discovery and natural voice prioritization
 * - Safe cancellation, completion, and error lifecycle management
 * - Decoupled observer subscriptions for UI and animation controllers
 */

import {
  GRAPHMIN_VOICE_CONFIG,
  prepareTextForSpeech,
  type PersonaVoiceConfig
} from '../components/persona/personaVoiceConfig';

export type SpeechPlaybackStatus =
  | 'unsupported'
  | 'idle'
  | 'loading'
  | 'speaking'
  | 'completed'
  | 'failed';

export interface SpeechBoundaryEvent {
  name: string;        // 'word' or 'sentence'
  charIndex: number;
  charLength?: number;
  elapsedTime?: number;
  word?: string;
}

export type SpeechBoundaryListener = (event: SpeechBoundaryEvent) => void;

export interface SpeechOptions {
  rate?: number;       // Speed: 0.1 to 10 (defaults to GRAPHMIN_VOICE_CONFIG.speakingRate)
  pitch?: number;      // Pitch: 0 to 2 (defaults to GRAPHMIN_VOICE_CONFIG.pitch)
  volume?: number;     // Volume: 0 to 1 (defaults to GRAPHMIN_VOICE_CONFIG.volume)
  lang?: string;       // BCP 47 language tag (defaults to GRAPHMIN_VOICE_CONFIG.lang)
  voiceName?: string;  // Preferred specific voice name
  onBoundary?: (event: SpeechBoundaryEvent) => void;
}

export interface SpeechPlaybackState {
  status: SpeechPlaybackStatus;
  text: string | null;
  error: string | null;
}

export type SpeechStateListener = (state: SpeechPlaybackState) => void;

export class SpeechSynthesisService {
  private status: SpeechPlaybackStatus = 'idle';
  private currentText: string | null = null;
  private currentError: string | null = null;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private isExplicitlyStopped = false;
  private listeners = new Set<SpeechStateListener>();
  private boundaryListeners = new Set<SpeechBoundaryListener>();
  private voices: SpeechSynthesisVoice[] = [];
  private voicesLoaded = false;
  private onVoicesChangedBound: (() => void) | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    if (!this.isSupported()) {
      this.status = 'unsupported';
      return;
    }

    this.status = 'idle';
    this.loadVoices();

    if (typeof window !== 'undefined' && window.speechSynthesis) {
      this.onVoicesChangedBound = () => this.loadVoices();
      window.speechSynthesis.addEventListener('voiceschanged', this.onVoicesChangedBound);
    }
  }

  /**
   * Check whether SpeechSynthesis is available in the current runtime environment.
   */
  public isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      typeof window.speechSynthesis !== 'undefined' &&
      typeof (window as any).SpeechSynthesisUtterance !== 'undefined'
    );
  }

  /**
   * Load and cache available synthesis voices.
   */
  private loadVoices(): void {
    if (!this.isSupported()) return;
    try {
      const v = window.speechSynthesis.getVoices();
      if (v && v.length > 0) {
        this.voices = v;
        this.voicesLoaded = true;
      }
    } catch {
      this.voices = [];
    }
  }

  /**
   * Get all currently available synthesis voices.
   */
  public getVoices(): SpeechSynthesisVoice[] {
    if (!this.voicesLoaded) {
      this.loadVoices();
    }
    return [...this.voices];
  }

  /**
   * Returns the centralized voice configuration for GraphMind Persona.
   */
  public getVoiceConfig(): PersonaVoiceConfig {
    return GRAPHMIN_VOICE_CONFIG;
  }

  /**
   * Returns the currently resolved voice for the Persona character.
   */
  public getResolvedVoice(preferredName?: string): SpeechSynthesisVoice | null {
    return this.selectBestVoice(preferredName);
  }

  /**
   * Select the best matching voice without assuming any OS-specific voice is present.
   * Multi-tiered selection strategy:
   * 1. Explicit voice name match if provided.
   * 2. High-priority configured voice list (Asian English male voices first, then calm male voices).
   * 3. Asian English male regional voices (name/lang contains asian keywords + male keywords, excluding female profiles).
   * 4. Any Asian English voice (excluding disallowed female profiles).
   * 5. Articulate calm male voices (name contains male keywords, matching target lang, excluding female profiles).
   * 6. High-quality natural / neural English voices.
   * 7. Any English voice in target language (excluding disallowed female profiles).
   * 8. System default voice.
   * 9. First available voice fallback.
   */
  public selectBestVoice(
    preferredName?: string,
    targetLang = GRAPHMIN_VOICE_CONFIG.lang
  ): SpeechSynthesisVoice | null {
    const list = this.getVoices();
    if (list.length === 0) return null;

    const isDisallowed = (v: SpeechSynthesisVoice): boolean => {
      const lower = `${v.name} ${v.lang}`.toLowerCase();
      return GRAPHMIN_VOICE_CONFIG.disallowedVoiceKeywords.some((kw) => lower.includes(kw));
    };

    // 1. Explicit voice name match if requested
    if (preferredName) {
      const exactMatch = list.find(
        (v) => v.name.toLowerCase() === preferredName.toLowerCase()
      );
      if (exactMatch) return exactMatch;
      const partialMatch = list.find((v) =>
        v.name.toLowerCase().includes(preferredName.toLowerCase())
      );
      if (partialMatch) return partialMatch;
    }

    // 2. High-priority configured voice list matching in order
    for (const name of GRAPHMIN_VOICE_CONFIG.preferredVoiceNames) {
      const found = list.find((v) => v.name.toLowerCase() === name.toLowerCase());
      if (found) return found;
      const partial = list.find((v) =>
        v.name.toLowerCase().includes(name.toLowerCase())
      );
      if (partial) return partial;
    }

    // 3. Asian English male regional voices (name/lang contains asian keywords + male keywords, not disallowed)
    const asianMaleMatch = list.find((v) => {
      if (isDisallowed(v)) return false;
      const lower = `${v.name} ${v.lang}`.toLowerCase();
      const hasAsian = GRAPHMIN_VOICE_CONFIG.preferredAsianVoiceKeywords.some((kw) =>
        lower.includes(kw)
      );
      const hasMale =
        GRAPHMIN_VOICE_CONFIG.preferredMaleKeywords.some((kw) => lower.includes(kw)) ||
        v.lang.toLowerCase().includes('en-in') ||
        v.lang.toLowerCase().includes('en-sg') ||
        v.lang.toLowerCase().includes('en-hk');
      return hasAsian && hasMale;
    });
    if (asianMaleMatch) return asianMaleMatch;

    // 4. Any Asian English voice (not disallowed)
    const asianMatch = list.find((v) => {
      if (isDisallowed(v)) return false;
      const lower = `${v.name} ${v.lang}`.toLowerCase();
      return GRAPHMIN_VOICE_CONFIG.preferredAsianVoiceKeywords.some((kw) => lower.includes(kw));
    });
    if (asianMatch) return asianMatch;

    // 5. Articulate calm male voices (matching male keywords and not disallowed)
    const langPrefix = targetLang.split('-')[0].toLowerCase();
    const calmMaleMatch = list.find((v) => {
      if (isDisallowed(v)) return false;
      const lower = `${v.name} ${v.lang}`.toLowerCase();
      const matchesLang = v.lang.toLowerCase().startsWith(langPrefix);
      const isMale = GRAPHMIN_VOICE_CONFIG.preferredMaleKeywords.some((kw) => lower.includes(kw));
      return matchesLang && isMale;
    });
    if (calmMaleMatch) return calmMaleMatch;

    // 6. High-quality natural / neural English voices (excluding disallowed female profiles)
    const naturalKeywords = ['natural', 'neural', 'enhanced', 'premium', 'google'];
    const nonFemaleNatural = list.find((v) => {
      if (isDisallowed(v)) return false;
      const lower = `${v.name} ${v.lang}`.toLowerCase();
      const matchesLang = v.lang.toLowerCase().startsWith(langPrefix);
      return matchesLang && naturalKeywords.some((kw) => lower.includes(kw));
    });
    if (nonFemaleNatural) return nonFemaleNatural;

    // 7. Any English voice in targetLang (excluding disallowed)
    const nonFemaleTargetLang = list.find((v) => {
      if (isDisallowed(v)) return false;
      return v.lang.toLowerCase() === targetLang.toLowerCase();
    });
    if (nonFemaleTargetLang) return nonFemaleTargetLang;

    // 8. Any voice matching language prefix (excluding disallowed)
    const nonFemaleLang = list.find((v) => {
      if (isDisallowed(v)) return false;
      return v.lang.toLowerCase().startsWith(langPrefix);
    });
    if (nonFemaleLang) return nonFemaleLang;

    // 9. System default voice
    const defaultVoice = list.find((v) => v.default);
    if (defaultVoice) return defaultVoice;

    // 10. First available voice
    return list[0] || null;
  }

  /**
   * Start speech playback for a given text string.
   * Automatically stops any currently playing utterance to prevent overlapping requests.
   * Preprocesses text for spoken delivery without altering original text.
   */
  public speak(text: string, options: SpeechOptions = {}): Promise<void> {
    const rawTrimmed = (text || '').trim();

    return new Promise((resolve, reject) => {
      if (!this.isSupported()) {
        const errMsg = 'Speech synthesis is not supported in this browser.';
        this.updateState('unsupported', null, errMsg);
        reject(new Error(errMsg));
        return;
      }

      if (!rawTrimmed) {
        this.stop();
        resolve();
        return;
      }

      // 1. Prevent overlapping speech: stop any ongoing utterance cleanly
      this.stop();

      this.isExplicitlyStopped = false;
      // Preserve original text for UI state and observers
      this.updateState('loading', rawTrimmed, null);

      try {
        // Prepare text for spoken delivery without changing meaning or display text
        const spokenText = prepareTextForSpeech(rawTrimmed);

        const UtteranceClass =
          typeof SpeechSynthesisUtterance !== 'undefined'
            ? SpeechSynthesisUtterance
            : (window as any).SpeechSynthesisUtterance;
        const utterance = new UtteranceClass(spokenText || rawTrimmed);
        this.currentUtterance = utterance;

        // Apply centralized voice properties: calm, intelligent, composed
        utterance.rate =
          typeof options.rate === 'number'
            ? Math.max(0.1, Math.min(10, options.rate))
            : GRAPHMIN_VOICE_CONFIG.speakingRate;

        utterance.pitch =
          typeof options.pitch === 'number'
            ? Math.max(0, Math.min(2, options.pitch))
            : GRAPHMIN_VOICE_CONFIG.pitch;

        utterance.volume =
          typeof options.volume === 'number'
            ? Math.max(0, Math.min(1, options.volume))
            : GRAPHMIN_VOICE_CONFIG.volume;

        utterance.lang = options.lang || GRAPHMIN_VOICE_CONFIG.lang;

        const voice = this.selectBestVoice(options.voiceName, utterance.lang);
        if (voice) {
          utterance.voice = voice;
        }

        utterance.onstart = () => {
          if (this.currentUtterance !== utterance) return;
          this.updateState('speaking', rawTrimmed, null);
        };

        utterance.onboundary = (event: SpeechSynthesisEvent) => {
          if (this.currentUtterance !== utterance) return;
          const charLen = (event as any).charLength || 0;
          let boundaryWord = '';
          const fullText = spokenText || rawTrimmed;
          if (charLen > 0) {
            boundaryWord = fullText.slice(event.charIndex, event.charIndex + charLen);
          } else {
            const remainder = fullText.slice(event.charIndex);
            const match = remainder.match(/^\S+/);
            boundaryWord = match ? match[0] : '';
          }

          const boundaryData: SpeechBoundaryEvent = {
            name: event.name || 'word',
            charIndex: event.charIndex,
            charLength: (event as any).charLength,
            elapsedTime: event.elapsedTime,
            word: boundaryWord
          };

          options.onBoundary?.(boundaryData);
          this.boundaryListeners.forEach((listener) => {
            try {
              listener(boundaryData);
            } catch {}
          });
        };

        utterance.onend = () => {
          if (this.currentUtterance !== utterance) return;
          this.currentUtterance = null;
          this.updateState('completed', rawTrimmed, null);
          resolve();
        };

        utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
          // If stopped intentionally, do not treat as an error
          if (this.isExplicitlyStopped || event.error === 'interrupted' || event.error === 'canceled') {
            if (this.currentUtterance === utterance) {
              this.currentUtterance = null;
            }
            resolve();
            return;
          }

          const errorDesc = `Speech playback failed: ${event.error}`;
          if (this.currentUtterance === utterance) {
            this.currentUtterance = null;
          }
          this.updateState('failed', rawTrimmed, errorDesc);
          reject(new Error(errorDesc));
        };

        // Resume if synth is in paused state (known browser quirk)
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }

        window.speechSynthesis.speak(utterance);
      } catch (err: any) {
        const errorDesc = err?.message || 'Failed to initiate speech synthesis.';
        this.currentUtterance = null;
        this.updateState('failed', rawTrimmed, errorDesc);
        reject(new Error(errorDesc));
      }
    });
  }

  /**
   * Stop ongoing speech playback immediately.
   */
  public stop(): void {
    if (!this.isSupported()) return;

    this.isExplicitlyStopped = true;

    try {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // Ignore cancellation errors
    }

    this.currentUtterance = null;
    if (this.status !== 'idle' && this.status !== 'unsupported') {
      this.updateState('idle', null, null);
    }
  }

  /**
   * Pause ongoing speech playback.
   */
  public pause(): void {
    if (this.isSupported() && window.speechSynthesis.speaking) {
      try {
        window.speechSynthesis.pause();
      } catch {}
    }
  }

  /**
   * Resume paused speech playback.
   */
  public resume(): void {
    if (this.isSupported() && window.speechSynthesis.paused) {
      try {
        window.speechSynthesis.resume();
      } catch {}
    }
  }

  /**
   * Get current state snapshot.
   */
  public getState(): SpeechPlaybackState {
    return {
      status: this.status,
      text: this.currentText,
      error: this.currentError
    };
  }

  /**
   * Subscribe to speech state changes.
   */
  public subscribe(listener: SpeechStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Subscribe to speech word-boundary events for real-time lip-sync and visual markers.
   */
  public onBoundary(listener: SpeechBoundaryListener): () => void {
    this.boundaryListeners.add(listener);
    return () => {
      this.boundaryListeners.delete(listener);
    };
  }

  private updateState(status: SpeechPlaybackStatus, text: string | null, error: string | null): void {
    this.status = status;
    this.currentText = text;
    this.currentError = error;

    const snapshot = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(snapshot);
      } catch {
        // Prevent listener failures from breaking service
      }
    });
  }

  /**
   * Disposes audio resources and event listeners.
   */
  public dispose(): void {
    this.stop();
    this.listeners.clear();
    this.boundaryListeners.clear();
    if (
      this.onVoicesChangedBound &&
      typeof window !== 'undefined' &&
      window.speechSynthesis
    ) {
      window.speechSynthesis.removeEventListener('voiceschanged', this.onVoicesChangedBound);
      this.onVoicesChangedBound = null;
    }
  }
}

/**
 * Shared singleton instance for unified voice playback across the application.
 */
export const speechSynthesisService = new SpeechSynthesisService();
