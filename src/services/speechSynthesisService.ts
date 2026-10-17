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

export type SpeechPlaybackStatus =
  | 'unsupported'
  | 'idle'
  | 'loading'
  | 'speaking'
  | 'completed'
  | 'failed';

export interface SpeechOptions {
  rate?: number;       // Speed: 0.1 to 10 (default 0.95 for calm, articulate cadence)
  pitch?: number;      // Pitch: 0 to 2 (default 1.0)
  volume?: number;     // Volume: 0 to 1 (default 1.0)
  lang?: string;       // BCP 47 language tag (default 'en-US')
  voiceName?: string;  // Preferred specific voice name
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
   * Select the best matching voice without assuming any OS-specific voice is present.
   * Prioritizes natural/neural English voices, falls back to generic English,
   * then system default.
   */
  public selectBestVoice(preferredName?: string, targetLang = 'en-US'): SpeechSynthesisVoice | null {
    const list = this.getVoices();
    if (list.length === 0) return null;

    // 1. Explicit voice name match if requested
    if (preferredName) {
      const match = list.find(v => v.name.toLowerCase() === preferredName.toLowerCase());
      if (match) return match;
    }

    // 2. High-quality natural / enhanced voices in matching language
    const langPrefix = targetLang.split('-')[0].toLowerCase();
    const naturalKeywords = ['natural', 'neural', 'enhanced', 'premium', 'google', 'siri'];

    const naturalMatch = list.find(v => {
      const isTargetLang = v.lang.toLowerCase().startsWith(langPrefix);
      if (!isTargetLang) return false;
      const lowerName = v.name.toLowerCase();
      return naturalKeywords.some(kw => lowerName.includes(kw));
    });
    if (naturalMatch) return naturalMatch;

    // 3. Exact language match (e.g. 'en-US')
    const exactLangMatch = list.find(v => v.lang.toLowerCase() === targetLang.toLowerCase());
    if (exactLangMatch) return exactLangMatch;

    // 4. Any English / target language prefix match
    const langMatch = list.find(v => v.lang.toLowerCase().startsWith(langPrefix));
    if (langMatch) return langMatch;

    // 5. System default voice
    const defaultVoice = list.find(v => v.default);
    if (defaultVoice) return defaultVoice;

    // 6. First available voice
    return list[0] || null;
  }

  /**
   * Start speech playback for a given text string.
   * Automatically stops any currently playing utterance to prevent overlapping requests.
   */
  public speak(text: string, options: SpeechOptions = {}): Promise<void> {
    const trimmed = (text || '').trim();

    return new Promise((resolve, reject) => {
      if (!this.isSupported()) {
        const errMsg = 'Speech synthesis is not supported in this browser.';
        this.updateState('unsupported', null, errMsg);
        reject(new Error(errMsg));
        return;
      }

      if (!trimmed) {
        this.stop();
        resolve();
        return;
      }

      // 1. Prevent overlapping speech: stop any ongoing utterance cleanly
      this.stop();

      this.isExplicitlyStopped = false;
      this.updateState('loading', trimmed, null);

      try {
        const UtteranceClass =
          typeof SpeechSynthesisUtterance !== 'undefined'
            ? SpeechSynthesisUtterance
            : (window as any).SpeechSynthesisUtterance;
        const utterance = new UtteranceClass(trimmed);
        this.currentUtterance = utterance;

        // Apply playback properties with calm, articulate defaults
        utterance.rate = typeof options.rate === 'number' ? Math.max(0.1, Math.min(10, options.rate)) : 0.95;
        utterance.pitch = typeof options.pitch === 'number' ? Math.max(0, Math.min(2, options.pitch)) : 1.0;
        utterance.volume = typeof options.volume === 'number' ? Math.max(0, Math.min(1, options.volume)) : 1.0;
        utterance.lang = options.lang || 'en-US';

        const voice = this.selectBestVoice(options.voiceName, utterance.lang);
        if (voice) {
          utterance.voice = voice;
        }

        utterance.onstart = () => {
          if (this.currentUtterance !== utterance) return;
          this.updateState('speaking', trimmed, null);
        };

        utterance.onend = () => {
          if (this.currentUtterance !== utterance) return;
          this.currentUtterance = null;
          this.updateState('completed', trimmed, null);
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
          this.updateState('failed', trimmed, errorDesc);
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
        this.updateState('failed', trimmed, errorDesc);
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
