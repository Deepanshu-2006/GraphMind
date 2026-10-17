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
 */import {
  GRAPHMIN_VOICE_CONFIG,
  prepareTextForSpeech,
  segmentIntoSentences,
  type SentenceSegment,
  type PersonaVoiceConfig
} from '../components/persona/personaVoiceConfig';

export type SpeechPlaybackStatus =
  | 'unsupported'
  | 'idle'
  | 'loading'
  | 'speaking'
  | 'paused'
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

  // Voice session caching & sentence segmentation pause state
  private cachedResolvedVoice: SpeechSynthesisVoice | null = null;
  private interSentenceTimer: ReturnType<typeof setTimeout> | null = null;
  private isPausedDuringInterSentenceGap = false;
  private continueSegmentPlayback: (() => void) | null = null;
  private currentSegments: SentenceSegment[] = [];
  private currentSegmentIndex = 0;

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
        this.cachedResolvedVoice = null;
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

  public getCurrentSegments(): SentenceSegment[] {
    return this.currentSegments;
  }

  public getCurrentSegmentIndex(): number {
    return this.currentSegmentIndex;
  }

  /**
   * Select the best matching voice without assuming any OS-specific voice is present.
   * Multi-tiered selection strategy with strict language family isolation:
   * 1. Explicit voice name match if provided.
   * 2. High-priority configured voice list matching in order within target language pool.
   * 3. Asian English male regional voices (name/lang contains asian keywords + male keywords).
   * 4. Any Asian English voice matching target language.
   * 5. Articulate calm male voices (matching male keywords in target language pool).
   * 6. High-quality natural / neural English voices.
   * 7. Any voice matching targetLang exactly.
   * 8. System default voice (if in target language pool).
   * 9. First available voice in target language pool.
   * 10. System default or first available voice fallback.
   */
  public selectBestVoice(
    preferredName?: string,
    targetLang = GRAPHMIN_VOICE_CONFIG.lang
  ): SpeechSynthesisVoice | null {
    const list = this.getVoices();
    if (list.length === 0) return null;

    // Fast return cached voice for default parameters within a session (session determinism)
    if (!preferredName && targetLang === GRAPHMIN_VOICE_CONFIG.lang && this.cachedResolvedVoice) {
      if (list.some((v) => v.name === this.cachedResolvedVoice?.name)) {
        return this.cachedResolvedVoice;
      }
    }

    const isDisallowed = (v: SpeechSynthesisVoice): boolean => {
      const lower = `${v.name} ${v.lang}`.toLowerCase();
      return GRAPHMIN_VOICE_CONFIG.disallowedVoiceKeywords.some((kw) => lower.includes(kw));
    };

    // Strict language matching rule:
    // Respect the application's configured language/locale. Never select non-English
    // voices (e.g. Hindi, German, French) for English text!
    const langPrefix = targetLang.split('-')[0].toLowerCase();
    const matchingLangVoices = list.filter((v) =>
      v.lang.toLowerCase().startsWith(langPrefix)
    );

    // Prefer candidate voices that match language and are not in the disallowed list
    const pool = matchingLangVoices.length > 0 ? matchingLangVoices : list;
    const candidates = pool.filter((v) => !isDisallowed(v));
    const searchPool = candidates.length > 0 ? candidates : pool;

    let selected: SpeechSynthesisVoice | null = null;

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

    // 2. High-priority configured voice list matching in order within searchPool
    for (const name of GRAPHMIN_VOICE_CONFIG.preferredVoiceNames) {
      const exact = searchPool.find((v) => v.name.toLowerCase() === name.toLowerCase());
      if (exact) {
        selected = exact;
        break;
      }
      const partial = searchPool.find((v) =>
        v.name.toLowerCase().includes(name.toLowerCase())
      );
      if (partial) {
        selected = partial;
        break;
      }
    }

    // 3. Asian English male regional voices (name/lang contains asian keywords + male keywords)
    if (!selected) {
      selected = searchPool.find((v) => {
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
      }) || null;
    }

    // 4. Any Asian English voice matching language
    if (!selected) {
      selected = searchPool.find((v) => {
        const lower = `${v.name} ${v.lang}`.toLowerCase();
        return GRAPHMIN_VOICE_CONFIG.preferredAsianVoiceKeywords.some((kw) => lower.includes(kw));
      }) || null;
    }

    // 5. Articulate calm male voices (matching male keywords in searchPool)
    if (!selected) {
      selected = searchPool.find((v) => {
        const lower = `${v.name} ${v.lang}`.toLowerCase();
        return GRAPHMIN_VOICE_CONFIG.preferredMaleKeywords.some((kw) => lower.includes(kw));
      }) || null;
    }

    // 6. Natural / neural English voices in searchPool
    if (!selected) {
      const naturalKeywords = ['natural', 'neural', 'enhanced', 'premium', 'google'];
      selected = searchPool.find((v) => {
        const lower = `${v.name} ${v.lang}`.toLowerCase();
        return naturalKeywords.some((kw) => lower.includes(kw));
      }) || null;
    }

    // 7. Exact targetLang match in searchPool
    if (!selected) {
      selected = searchPool.find((v) => v.lang.toLowerCase() === targetLang.toLowerCase()) || null;
    }

    // 8. System default voice if in searchPool
    if (!selected) {
      selected = searchPool.find((v) => v.default) || null;
    }

    // 9. First available voice in searchPool
    if (!selected) {
      selected = searchPool[0] || null;
    }

    // 10. Ultimate fallback to overall list
    if (!selected) {
      selected = list[0] || null;
    }

    if (!preferredName && targetLang === GRAPHMIN_VOICE_CONFIG.lang) {
      this.cachedResolvedVoice = selected;
    }

    return selected;
  }

  /**
   * Start speech playback for a given text string.
   * Automatically stops any currently playing utterance to prevent overlapping requests.
   * Segments long multi-sentence messages into sequential sentence utterances with
   * comfortable ~160ms breathing pauses while forwarding continuous character indices
   * to preserve lip-sync synchronization.
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
      this.isPausedDuringInterSentenceGap = false;
      this.continueSegmentPlayback = null;

      // Preserve original text for UI state and observers
      this.updateState('loading', rawTrimmed, null);

      try {
        // Prepare text for spoken delivery without changing meaning or display text
        const spokenText = prepareTextForSpeech(rawTrimmed);
        const segments = segmentIntoSentences(spokenText);

        if (segments.length === 0) {
          this.updateState('completed', rawTrimmed, null);
          resolve();
          return;
        }

        const UtteranceClass =
          typeof SpeechSynthesisUtterance !== 'undefined'
            ? SpeechSynthesisUtterance
            : (window as any).SpeechSynthesisUtterance;

        const voice = this.selectBestVoice(
          options.voiceName,
          options.lang || GRAPHMIN_VOICE_CONFIG.lang
        );

        const rate =
          typeof options.rate === 'number'
            ? Math.max(0.1, Math.min(10, options.rate))
            : GRAPHMIN_VOICE_CONFIG.speakingRate;

        const pitch =
          typeof options.pitch === 'number'
            ? Math.max(0, Math.min(2, options.pitch))
            : GRAPHMIN_VOICE_CONFIG.pitch;

        const volume =
          typeof options.volume === 'number'
            ? Math.max(0, Math.min(1, options.volume))
            : GRAPHMIN_VOICE_CONFIG.volume;

        const lang = options.lang || GRAPHMIN_VOICE_CONFIG.lang;

        this.currentSegments = segments;
        this.currentSegmentIndex = 0;

        const speakSegment = (index: number) => {
          if (this.isExplicitlyStopped) {
            resolve();
            return;
          }

          if (index >= segments.length) {
            this.currentUtterance = null;
            this.currentSegments = [];
            this.continueSegmentPlayback = null;
            this.updateState('completed', rawTrimmed, null);
            resolve();
            return;
          }

          this.currentSegmentIndex = index;
          const segment = segments[index];
          const utterance = new UtteranceClass(segment.text);
          this.currentUtterance = utterance;

          utterance.rate = rate;
          utterance.pitch = pitch;
          utterance.volume = volume;
          utterance.lang = lang;
          if (voice) {
            utterance.voice = voice;
          }

          utterance.onstart = () => {
            if (this.currentUtterance !== utterance) return;
            if (index === 0) {
              this.updateState('speaking', rawTrimmed, null);
            }
          };

          utterance.onboundary = (event: SpeechSynthesisEvent) => {
            if (this.currentUtterance !== utterance) return;

            const localCharIndex = event.charIndex || 0;
            const globalCharIndex = localCharIndex + segment.offset;
            const charLen = (event as any).charLength || 0;
            let boundaryWord = '';

            if (charLen > 0) {
              boundaryWord = spokenText.slice(globalCharIndex, globalCharIndex + charLen);
            } else {
              const remainder = spokenText.slice(globalCharIndex);
              const match = remainder.match(/^\S+/);
              boundaryWord = match ? match[0] : '';
            }

            const boundaryData: SpeechBoundaryEvent = {
              name: event.name || 'word',
              charIndex: globalCharIndex,
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

          utterance.onpause = () => {
            if (this.currentUtterance !== utterance) return;
            this.updateState('paused', rawTrimmed, null);
          };

          utterance.onresume = () => {
            if (this.currentUtterance !== utterance) return;
            this.updateState('speaking', rawTrimmed, null);
          };

          utterance.onend = () => {
            if (this.currentUtterance !== utterance) return;
            if (this.isExplicitlyStopped) {
              resolve();
              return;
            }

            this.currentUtterance = null;

            // If more sentences remain, schedule next segment after a natural breath pause
            if (index + 1 < segments.length) {
              const pauseMs = GRAPHMIN_VOICE_CONFIG.interSentencePauseMs || 160;
              this.continueSegmentPlayback = () => speakSegment(index + 1);
              this.interSentenceTimer = setTimeout(() => {
                this.interSentenceTimer = null;
                this.continueSegmentPlayback = null;
                if (!this.isExplicitlyStopped && this.status !== 'paused') {
                  speakSegment(index + 1);
                }
              }, pauseMs);
            } else {
              this.currentSegments = [];
              this.continueSegmentPlayback = null;
              this.updateState('completed', rawTrimmed, null);
              resolve();
            }
          };

          utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
            if (
              this.isExplicitlyStopped ||
              event.error === 'interrupted' ||
              event.error === 'canceled'
            ) {
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
            this.currentSegments = [];
            this.continueSegmentPlayback = null;
            this.updateState('failed', rawTrimmed, errorDesc);
            reject(new Error(errorDesc));
          };

          // Resume if synth is in paused state (known browser quirk)
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }

          window.speechSynthesis.speak(utterance);
        };

        speakSegment(0);
      } catch (err: any) {
        const errorDesc = err?.message || 'Failed to initiate speech synthesis.';
        this.currentUtterance = null;
        this.currentSegments = [];
        this.continueSegmentPlayback = null;
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

    if (this.interSentenceTimer !== null) {
      clearTimeout(this.interSentenceTimer);
      this.interSentenceTimer = null;
    }
    this.isPausedDuringInterSentenceGap = false;
    this.continueSegmentPlayback = null;

    try {
      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // Ignore cancellation errors
    }

    this.currentUtterance = null;
    this.currentSegments = [];
    this.currentSegmentIndex = 0;

    if (this.status !== 'idle' && this.status !== 'unsupported') {
      this.updateState('idle', null, null);
    }
  }

  /**
   * Pause ongoing speech playback.
   */
  public pause(): void {
    if (!this.isSupported()) return;

    // Handle pause during inter-sentence breath gap
    if (this.interSentenceTimer !== null) {
      clearTimeout(this.interSentenceTimer);
      this.interSentenceTimer = null;
      this.isPausedDuringInterSentenceGap = true;
      this.updateState('paused', this.currentText, null);
      return;
    }

    if (window.speechSynthesis.speaking || this.status === 'speaking') {
      try {
        window.speechSynthesis.pause();
        this.updateState('paused', this.currentText, null);
      } catch {}
    }
  }

  /**
   * Resume paused speech playback.
   */
  public resume(): void {
    if (!this.isSupported()) return;

    // Resume from inter-sentence breath gap
    if (this.isPausedDuringInterSentenceGap) {
      this.isPausedDuringInterSentenceGap = false;
      this.updateState('speaking', this.currentText, null);
      const cont = this.continueSegmentPlayback;
      this.continueSegmentPlayback = null;
      if (cont) {
        cont();
      }
      return;
    }

    if (window.speechSynthesis.paused || this.status === 'paused') {
      try {
        window.speechSynthesis.resume();
        this.updateState('speaking', this.currentText, null);
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
