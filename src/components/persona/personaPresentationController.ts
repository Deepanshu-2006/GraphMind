/**
 * GraphMind Persona — Reusable Silent Presentation Interface
 *
 * Coordinates silent, text-driven Persona visual communication:
 * - Emits timed visual text reveals for on-screen companion subtitles/captions.
 * - Coordinates subtle text-driven mouth viseme articulation on the 3D character without audio.
 * - Manages presentation lifecycle (idle, presenting, paused, completed, cancelled).
 * - Ensures cancellation cleanly halts presentation and returns the mouth to rest.
 * - Strictly zero voice playback, zero SpeechSynthesis calls, zero audio dependencies.
 */

import type { PersonaLipSyncController } from './personaLipSyncController';

export type PresentationStatus =
  | 'idle'
  | 'presenting'
  | 'paused'
  | 'completed'
  | 'cancelled';

export interface PresentationState {
  status: PresentationStatus;
  text: string | null;
  revealedText: string | null;
  currentWord: string | null;
  currentWordIndex: number;
  totalWords: number;
  progress: number; // 0.0 to 1.0
  isArticulating: boolean;
}

export type PresentationListener = (state: PresentationState) => void;

export interface PresentationOptions {
  /**
   * Whether to drive subtle 3D mouth articulation during text display.
   * Default: true.
   */
  withMouthArticulation?: boolean;

  /**
   * Reading pacing in approximate words per minute.
   * Default: 170 WPM (comfortable visual reading speed).
   */
  wordsPerMinute?: number;

  /**
   * Text reveal mode:
   * - 'progressive': Smooth animated text reveal coordinated with articulation.
   * - 'instant': Full text revealed immediately, mouth articulates through the sentence.
   * Default: 'progressive'.
   */
  revealMode?: 'progressive' | 'instant';

  /**
   * Optional callback when each word is revealed.
   */
  onWordReveal?: (word: string, index: number) => void;

  /**
   * Optional callback on presentation progress.
   */
  onProgress?: (progress: number, revealedText: string) => void;

  /**
   * Optional callback when visual presentation completes.
   */
  onComplete?: () => void;
}

export class PersonaPresentationController {
  private status: PresentationStatus = 'idle';
  private text: string | null = null;
  private revealedText: string | null = null;
  private currentWord: string | null = null;
  private currentWordIndex = -1;
  private totalWords = 0;
  private progress = 0;
  private isArticulating = false;

  private lipSyncController: PersonaLipSyncController | null = null;
  private listeners = new Set<PresentationListener>();

  // Timer & lifecycle management
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private activeResolve: (() => void) | null = null;
  private isPaused = false;
  private pauseRemainingMs = 0;
  private resumeAction: (() => void) | null = null;

  /**
   * Binds the active 3D character's lip-sync / articulation controller.
   */
  public bindLipSync(controller: PersonaLipSyncController | null): void {
    this.lipSyncController = controller;
  }

  /**
   * Unbinds the lip-sync controller safely on character unmount.
   */
  public unbindLipSync(): void {
    this.lipSyncController = null;
  }

  /**
   * Presents a text message visually with optional coordinated mouth articulation.
   * Automatically cancels any active presentation to prevent overlapping visual text.
   */
  public present(text: string, options: PresentationOptions = {}): Promise<void> {
    const cleanText = (text || '').trim();

    return new Promise((resolve) => {
      // Clean up previous presentation before starting a new one
      this.cancel();

      if (!cleanText) {
        this.updateState('idle', null, null, null, -1, 0, 0, false);
        resolve();
        return;
      }

      this.activeResolve = resolve;
      this.status = 'presenting';
      this.text = cleanText;
      this.progress = 0;

      // Word decomposition and duration estimation
      const wordRegex = /([a-zA-Z0-9'’-]+)([,.?!:;]*)/g;
      const tokens: Array<{ word: string; trailing: string; fullToken: string; durationMs: number }> = [];
      let match: RegExpExecArray | null;

      while ((match = wordRegex.exec(cleanText)) !== null) {
        const fullToken = match[0];
        const word = match[1];
        const punctuation = match[2] || '';
        const isSentenceEnd = /[.?!]/.test(punctuation);
        const hasPause = /[,.?!:;]/.test(punctuation);

        // Natural reading pace: ~240ms–550ms per word + punctuation pause
        const baseMs = Math.max(220, Math.min(500, 180 + word.length * 35));
        const pauseMs = isSentenceEnd ? 180 : hasPause ? 100 : 0;
        tokens.push({
          word,
          trailing: punctuation,
          fullToken,
          durationMs: baseMs + pauseMs
        });
      }

      if (tokens.length === 0) {
        tokens.push({ word: cleanText, trailing: '', fullToken: cleanText, durationMs: 1200 });
      }

      this.totalWords = tokens.length;
      const withArticulation = options.withMouthArticulation !== false;

      // Trigger subtle mouth articulation on 3D character if bound
      if (withArticulation && this.lipSyncController) {
        this.isArticulating = true;
        this.lipSyncController.startArticulation(cleanText);
      } else {
        this.isArticulating = false;
      }

      const revealMode = options.revealMode || 'progressive';

      if (revealMode === 'instant') {
        this.revealedText = cleanText;
        this.currentWord = tokens[0].word;
        this.currentWordIndex = 0;
        this.progress = 0;
        this.emitState();

        const totalDurationMs = tokens.reduce((acc, t) => acc + t.durationMs, 0);

        this.scheduleStep(totalDurationMs, () => {
          this.completePresentation(options);
        });
        return;
      }

      // Progressive presentation word-by-word reveal
      let currentIdx = 0;
      let accumulatedRevealed = '';

      const stepWord = () => {
        if (this.status !== 'presenting' || this.isPaused) return;

        if (currentIdx >= tokens.length) {
          this.completePresentation(options);
          return;
        }

        const token = tokens[currentIdx];
        this.currentWordIndex = currentIdx;
        this.currentWord = token.word;
        accumulatedRevealed += (currentIdx > 0 ? ' ' : '') + token.fullToken;
        this.revealedText = accumulatedRevealed;
        this.progress = Math.min(1.0, (currentIdx + 1) / tokens.length);

        options.onWordReveal?.(token.word, currentIdx);
        options.onProgress?.(this.progress, this.revealedText);
        this.emitState();

        currentIdx++;
        this.scheduleStep(token.durationMs, stepWord);
      };

      stepWord();
    });
  }

  /**
   * Internal scheduler supporting pause and cancellation.
   */
  private scheduleStep(durationMs: number, action: () => void): void {
    this.clearTimer();
    this.pauseRemainingMs = durationMs;
    this.resumeAction = action;

    this.timerId = setTimeout(() => {
      this.timerId = null;
      this.resumeAction = null;
      action();
    }, durationMs);
  }

  private clearTimer(): void {
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Completes visual presentation and returns mouth to rest position smoothly.
   */
  private completePresentation(options: PresentationOptions): void {
    this.clearTimer();
    this.resumeAction = null;
    this.isArticulating = false;

    // Return mouth to resting expression immediately
    if (this.lipSyncController) {
      this.lipSyncController.stopArticulation(false);
    }

    this.status = 'completed';
    this.progress = 1.0;
    this.emitState();

    options.onComplete?.();

    if (this.activeResolve) {
      const res = this.activeResolve;
      this.activeResolve = null;
      res();
    }
  }

  /**
   * Cancels active presentation immediately and returns mouth to resting expression.
   */
  public cancel(): void {
    this.clearTimer();
    this.resumeAction = null;
    this.isPaused = false;
    this.isArticulating = false;

    // Return mouth to resting expression immediately
    if (this.lipSyncController) {
      this.lipSyncController.stopArticulation(true);
    }

    const wasActive = this.status === 'presenting' || this.status === 'paused';
    this.status = wasActive ? 'cancelled' : 'idle';
    this.progress = 0;
    this.emitState();

    if (this.status === 'cancelled') {
      this.status = 'idle';
      this.emitState();
    }

    if (this.activeResolve) {
      const res = this.activeResolve;
      this.activeResolve = null;
      res();
    }
  }

  /**
   * Pauses the presentation.
   */
  public pause(): void {
    if (this.status === 'presenting' && !this.isPaused) {
      this.isPaused = true;
      this.clearTimer();
      this.status = 'paused';

      if (this.lipSyncController) {
        this.lipSyncController.pauseArticulation();
      }
      this.emitState();
    }
  }

  /**
   * Resumes a paused presentation.
   */
  public resume(): void {
    if (this.status === 'paused' && this.isPaused) {
      this.isPaused = false;
      this.status = 'presenting';

      if (this.lipSyncController) {
        this.lipSyncController.resumeArticulation();
      }
      this.emitState();

      if (this.resumeAction && this.pauseRemainingMs > 0) {
        this.scheduleStep(this.pauseRemainingMs, this.resumeAction);
      }
    }
  }

  /**
   * State snapshot getter.
   */
  public getState(): PresentationState {
    return {
      status: this.status,
      text: this.text,
      revealedText: this.revealedText,
      currentWord: this.currentWord,
      currentWordIndex: this.currentWordIndex,
      totalWords: this.totalWords,
      progress: this.progress,
      isArticulating: this.isArticulating
    };
  }

  private updateState(
    status: PresentationStatus,
    text: string | null,
    revealedText: string | null,
    currentWord: string | null,
    currentWordIndex: number,
    totalWords: number,
    progress: number,
    isArticulating: boolean
  ): void {
    this.status = status;
    this.text = text;
    this.revealedText = revealedText;
    this.currentWord = currentWord;
    this.currentWordIndex = currentWordIndex;
    this.totalWords = totalWords;
    this.progress = progress;
    this.isArticulating = isArticulating;
    this.emitState();
  }

  private emitState(): void {
    const snapshot = this.getState();
    this.listeners.forEach((listener) => {
      try {
        listener(snapshot);
      } catch {}
    });
  }

  /**
   * Subscribes to presentation state changes.
   */
  public subscribe(listener: PresentationListener): () => void {
    this.listeners.add(listener);
    try {
      listener(this.getState());
    } catch {}

    return () => {
      this.listeners.delete(listener);
    };
  }
}

/**
 * Shared singleton presentation controller for the Persona experience.
 */
export const personaPresentationController = new PersonaPresentationController();
