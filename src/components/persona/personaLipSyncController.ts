import * as THREE from 'three';
import {
  type SpeechBoundaryEvent,
  type SpeechPlaybackState,
  speechSynthesisService
} from '../../services/speechSynthesisService';

/**
 * Phonetic Viseme Categories matching the 12 blend shapes on H_DDS_HighRes and h_TeethDown.
 */
export type VisemeName =
  | 'AE_AA'     // /ɑ/, /æ/, /ʌ/ — Open vowels (bat, father, cup)
  | 'AO_A'      // /ɔ/, /ɒ/ — Back rounded vowels (all, caught, hot)
  | 'Ax_E'      // /ɛ/, /ə/ — Mid front unrounded vowels (bed, schwa)
  | 'TD_I'      // /t/, /d/, /n/, /ɪ/ — Alveolar dental stops, front vowel (tin, sit)
  | 'UH_OO'     // /ʊ/, /oʊ/ — Near-close back rounded (book, boat)
  | 'UW_U'      // /u/, /w/ — Close back rounded vowel, glide (you, boot, win)
  | 'H_EST'     // /h/ — Aspirated open transition (hello, test)
  | 'FV'        // /f/, /v/ — Labiodental fricatives (fox, voice)
  | 'S'         // /s/, /z/ — Alveolar sibilants (sun, zero)
  | 'SH_CH'     // /ʃ/, /tʃ/, /dʒ/ — Postalveolar fricatives/affricates (ship, cheer, joy)
  | 'MPB'       // /m/, /p/, /b/ — Bilabial closure (map, pat, bat)
  | 'KG'        // /k/, /g/, /ŋ/ — Velar stops (kite, go, sing)
  | 'REST';     // Neutral resting mouth

export type TongueShape = 'L' | 'R' | null;

export interface VisemeFrame {
  viseme: VisemeName;
  durationFraction: number; // Fraction of word duration (sum approx 1.0)
  targetIntensity: number;  // 0.0 to 1.0
  tongue?: TongueShape;
}

export interface WordVisemeSequence {
  word: string;
  cleanWord: string;
  charIndex: number;
  charLength: number;
  hasPunctuationPause: boolean;
  frames: VisemeFrame[];
  estimatedDuration: number; // in seconds
}

export interface LipSyncWeights {
  visemes: Record<VisemeName, number>;
  mouthOpen: number;
  kiss: number;
  lipSide: number;
  lipUp: number;
  lipDown: number;
  tongueL: number;
  tongueR: number;
  bilabialFactor: number; // 0 to 1, clamps jaw opening during /m/, /p/, /b/
}

export interface PersonaLipSyncConfig {
  prefersReducedMotion?: boolean;
  speakingRate?: number;
}

/**
 * High-performance Grapheme-to-Viseme (G2V) mapping rules for English text.
 * Sorted by descending length so multi-letter digraphs/trigraphs match first.
 */
interface G2VRule {
  pattern: RegExp;
  visemes: Array<{ viseme: VisemeName; weight: number; tongue?: TongueShape }>;
}

const G2V_RULES: G2VRule[] = [
  // Trigraphs / Quadgraphs
  { pattern: /^tion/i, visemes: [{ viseme: 'SH_CH', weight: 0.5 }, { viseme: 'Ax_E', weight: 0.35 }, { viseme: 'TD_I', weight: 0.4 }] },
  { pattern: /^sion/i, visemes: [{ viseme: 'SH_CH', weight: 0.5 }, { viseme: 'Ax_E', weight: 0.35 }, { viseme: 'TD_I', weight: 0.4 }] },
  { pattern: /^tch/i, visemes: [{ viseme: 'SH_CH', weight: 0.55 }] },
  { pattern: /^ight/i, visemes: [{ viseme: 'AE_AA', weight: 0.5 }, { viseme: 'TD_I', weight: 0.45 }] },
  { pattern: /^ough/i, visemes: [{ viseme: 'AO_A', weight: 0.5 }] },
  { pattern: /^augh/i, visemes: [{ viseme: 'AO_A', weight: 0.5 }] },

  // Digraphs
  { pattern: /^sh/i, visemes: [{ viseme: 'SH_CH', weight: 0.55 }] },
  { pattern: /^ch/i, visemes: [{ viseme: 'SH_CH', weight: 0.55 }] },
  { pattern: /^th/i, visemes: [{ viseme: 'TD_I', weight: 0.48 }] },
  { pattern: /^ph/i, visemes: [{ viseme: 'FV', weight: 0.55 }] },
  { pattern: /^wh/i, visemes: [{ viseme: 'UW_U', weight: 0.52 }] },
  { pattern: /^ck/i, visemes: [{ viseme: 'KG', weight: 0.48 }] },
  { pattern: /^ng/i, visemes: [{ viseme: 'KG', weight: 0.45 }] },
  { pattern: /^qu/i, visemes: [{ viseme: 'KG', weight: 0.45 }, { viseme: 'UW_U', weight: 0.48 }] },
  { pattern: /^ee/i, visemes: [{ viseme: 'TD_I', weight: 0.5 }] },
  { pattern: /^ea/i, visemes: [{ viseme: 'TD_I', weight: 0.48 }] },
  { pattern: /^oo/i, visemes: [{ viseme: 'UH_OO', weight: 0.55 }] },
  { pattern: /^ou/i, visemes: [{ viseme: 'UH_OO', weight: 0.5 }] },
  { pattern: /^ow/i, visemes: [{ viseme: 'AO_A', weight: 0.42 }, { viseme: 'UH_OO', weight: 0.45 }] },
  { pattern: /^ai/i, visemes: [{ viseme: 'Ax_E', weight: 0.48 }] },
  { pattern: /^ay/i, visemes: [{ viseme: 'Ax_E', weight: 0.48 }] },
  { pattern: /^ey/i, visemes: [{ viseme: 'Ax_E', weight: 0.48 }, { viseme: 'TD_I', weight: 0.35 }] },
  { pattern: /^ei/i, visemes: [{ viseme: 'Ax_E', weight: 0.48 }] },
  { pattern: /^oa/i, visemes: [{ viseme: 'UH_OO', weight: 0.5 }] },
  { pattern: /^oi/i, visemes: [{ viseme: 'AO_A', weight: 0.45 }, { viseme: 'TD_I', weight: 0.4 }] },
  { pattern: /^oy/i, visemes: [{ viseme: 'AO_A', weight: 0.45 }, { viseme: 'TD_I', weight: 0.4 }] },
  { pattern: /^au/i, visemes: [{ viseme: 'AO_A', weight: 0.5 }] },
  { pattern: /^aw/i, visemes: [{ viseme: 'AO_A', weight: 0.5 }] },
  { pattern: /^ew/i, visemes: [{ viseme: 'UW_U', weight: 0.52 }] },
  { pattern: /^er/i, visemes: [{ viseme: 'Ax_E', weight: 0.45, tongue: 'R' }] },
  { pattern: /^ar/i, visemes: [{ viseme: 'AO_A', weight: 0.45, tongue: 'R' }] },
  { pattern: /^or/i, visemes: [{ viseme: 'AO_A', weight: 0.48, tongue: 'R' }] },
  { pattern: /^ir/i, visemes: [{ viseme: 'Ax_E', weight: 0.45, tongue: 'R' }] },
  { pattern: /^ur/i, visemes: [{ viseme: 'Ax_E', weight: 0.45, tongue: 'R' }] },
  { pattern: /^mp/i, visemes: [{ viseme: 'MPB', weight: 0.65 }] },
  { pattern: /^mb/i, visemes: [{ viseme: 'MPB', weight: 0.65 }] },

  // Consonant Blends with Tongue Articulation (L, R)
  { pattern: /^pl/i, visemes: [{ viseme: 'MPB', weight: 0.65 }, { viseme: 'TD_I', weight: 0.42, tongue: 'L' }] },
  { pattern: /^pr/i, visemes: [{ viseme: 'MPB', weight: 0.65 }, { viseme: 'Ax_E', weight: 0.40, tongue: 'R' }] },
  { pattern: /^bl/i, visemes: [{ viseme: 'MPB', weight: 0.65 }, { viseme: 'TD_I', weight: 0.42, tongue: 'L' }] },
  { pattern: /^br/i, visemes: [{ viseme: 'MPB', weight: 0.65 }, { viseme: 'Ax_E', weight: 0.40, tongue: 'R' }] },
  { pattern: /^cl/i, visemes: [{ viseme: 'KG', weight: 0.48 }, { viseme: 'TD_I', weight: 0.42, tongue: 'L' }] },
  { pattern: /^cr/i, visemes: [{ viseme: 'KG', weight: 0.48 }, { viseme: 'Ax_E', weight: 0.40, tongue: 'R' }] },
  { pattern: /^gl/i, visemes: [{ viseme: 'KG', weight: 0.48 }, { viseme: 'TD_I', weight: 0.42, tongue: 'L' }] },
  { pattern: /^gr/i, visemes: [{ viseme: 'KG', weight: 0.48 }, { viseme: 'Ax_E', weight: 0.40, tongue: 'R' }] },
  { pattern: /^fl/i, visemes: [{ viseme: 'FV', weight: 0.55 }, { viseme: 'TD_I', weight: 0.42, tongue: 'L' }] },
  { pattern: /^fr/i, visemes: [{ viseme: 'FV', weight: 0.55 }, { viseme: 'Ax_E', weight: 0.40, tongue: 'R' }] },
  { pattern: /^sl/i, visemes: [{ viseme: 'S', weight: 0.46 }, { viseme: 'TD_I', weight: 0.42, tongue: 'L' }] },
  { pattern: /^st/i, visemes: [{ viseme: 'S', weight: 0.46 }, { viseme: 'TD_I', weight: 0.44 }] },
  { pattern: /^sp/i, visemes: [{ viseme: 'S', weight: 0.46 }, { viseme: 'MPB', weight: 0.60 }] },
  { pattern: /^sm/i, visemes: [{ viseme: 'S', weight: 0.46 }, { viseme: 'MPB', weight: 0.60 }] },
  { pattern: /^sn/i, visemes: [{ viseme: 'S', weight: 0.46 }, { viseme: 'TD_I', weight: 0.44 }] },
  { pattern: /^sk/i, visemes: [{ viseme: 'S', weight: 0.46 }, { viseme: 'KG', weight: 0.46 }] },

  // Context-Sensitive Consonants (Soft C and Soft G)
  { pattern: /^c[eiy]/i, visemes: [{ viseme: 'S', weight: 0.46 }] },
  { pattern: /^g[eiy]/i, visemes: [{ viseme: 'SH_CH', weight: 0.50 }] },

  // Single Consonants & Vowels
  { pattern: /^a/i, visemes: [{ viseme: 'AE_AA', weight: 0.52 }] },
  { pattern: /^b/i, visemes: [{ viseme: 'MPB', weight: 0.65 }] },
  { pattern: /^c/i, visemes: [{ viseme: 'KG', weight: 0.48 }] },
  { pattern: /^d/i, visemes: [{ viseme: 'TD_I', weight: 0.46 }] },
  { pattern: /^e/i, visemes: [{ viseme: 'Ax_E', weight: 0.44 }] },
  { pattern: /^f/i, visemes: [{ viseme: 'FV', weight: 0.55 }] },
  { pattern: /^g/i, visemes: [{ viseme: 'KG', weight: 0.48 }] },
  { pattern: /^h/i, visemes: [{ viseme: 'H_EST', weight: 0.42 }] },
  { pattern: /^i/i, visemes: [{ viseme: 'TD_I', weight: 0.45 }] },
  { pattern: /^j/i, visemes: [{ viseme: 'SH_CH', weight: 0.52 }] },
  { pattern: /^k/i, visemes: [{ viseme: 'KG', weight: 0.5 }] },
  { pattern: /^l/i, visemes: [{ viseme: 'TD_I', weight: 0.42, tongue: 'L' }] },
  { pattern: /^m/i, visemes: [{ viseme: 'MPB', weight: 0.65 }] },
  { pattern: /^n/i, visemes: [{ viseme: 'TD_I', weight: 0.44 }] },
  { pattern: /^o/i, visemes: [{ viseme: 'AO_A', weight: 0.48 }] },
  { pattern: /^p/i, visemes: [{ viseme: 'MPB', weight: 0.65 }] },
  { pattern: /^q/i, visemes: [{ viseme: 'KG', weight: 0.48 }] },
  { pattern: /^r/i, visemes: [{ viseme: 'Ax_E', weight: 0.4, tongue: 'R' }] },
  { pattern: /^s/i, visemes: [{ viseme: 'S', weight: 0.46 }] },
  { pattern: /^t/i, visemes: [{ viseme: 'TD_I', weight: 0.46 }] },
  { pattern: /^u/i, visemes: [{ viseme: 'UH_OO', weight: 0.48 }] },
  { pattern: /^v/i, visemes: [{ viseme: 'FV', weight: 0.55 }] },
  { pattern: /^w/i, visemes: [{ viseme: 'UW_U', weight: 0.52 }] },
  { pattern: /^x/i, visemes: [{ viseme: 'KG', weight: 0.4 }, { viseme: 'S', weight: 0.4 }] },
  { pattern: /^y/i, visemes: [{ viseme: 'TD_I', weight: 0.42 }] },
  { pattern: /^z/i, visemes: [{ viseme: 'S', weight: 0.46 }] }
];

/**
 * PersonaLipSyncController
 *
 * Dedicated real-time lip-sync engine for GraphMind Persona:
 * 1. Converts English spoken text into viseme sequences with linguistic digraph support.
 * 2. Synchronizes with real-time word boundary events (`SpeechSynthesisUtterance.onboundary`).
 * 3. Gracefully estimates boundary progress for browsers where boundaries are delayed or unavailable.
 * 4. Smoothly interpolates blend shapes using co-articulation easing.
 * 5. Coordinates with `PersonaExpressionController` without clobbering warm smiles or natural blinking.
 * 6. Ensures complete lip closure on bilabial sounds (/m/, /p/, /b/) and returns cleanly to resting expression.
 */
export class PersonaLipSyncController {
  private prefersReducedMotion = false;
  private speakingRate = 0.95;

  // Active Utterance State
  private isSpeaking = false;
  private isPaused = false;
  private fullUtteranceText = '';
  private words: WordVisemeSequence[] = [];
  private currentWordIndex = -1;
  private currentFrameIndex = -1;
  private wordElapsedTime = 0;
  private activeWordDuration = 0.35;

  // Real boundary tracking & fallback pacing
  private lastBoundaryTime = 0;
  private boundaryReceived = false;

  public hasReceivedBoundary(): boolean {
    return this.boundaryReceived;
  }

  // Current Evaluated Morph Weights (Smoothly lerped)
  private currentWeights: LipSyncWeights = this.createEmptyWeights();
  private targetWeights: LipSyncWeights = this.createEmptyWeights();

  // Resolved Morph Target Dictionaries on Three.js Meshes
  private headDictResolved = false;
  private teethDictResolved = false;
  private headIndexMap: Record<string, number> = {};
  private teethIndexMap: Record<string, number> = {};

  // Speech subscription unbind handles
  private unsubscribeSpeechState: (() => void) | null = null;
  private unsubscribeBoundary: (() => void) | null = null;

  constructor(config?: PersonaLipSyncConfig) {
    this.prefersReducedMotion = !!config?.prefersReducedMotion;
    this.speakingRate = config?.speakingRate || 0.95;

    this.bindSpeechService();
  }

  private createEmptyWeights(): LipSyncWeights {
    return {
      visemes: {
        AE_AA: 0,
        AO_A: 0,
        Ax_E: 0,
        TD_I: 0,
        UH_OO: 0,
        UW_U: 0,
        H_EST: 0,
        FV: 0,
        S: 0,
        SH_CH: 0,
        MPB: 0,
        KG: 0,
        REST: 0
      },
      mouthOpen: 0,
      kiss: 0,
      lipSide: 0,
      lipUp: 0,
      lipDown: 0,
      tongueL: 0,
      tongueR: 0,
      bilabialFactor: 0
    };
  }

  /**
   * Binds to the centralized speech synthesis service.
   */
  private bindSpeechService(): void {
    this.unsubscribeSpeechState = speechSynthesisService.subscribe((state: SpeechPlaybackState) => {
      if (state.status === 'speaking' && state.text) {
        if (!this.isSpeaking || this.fullUtteranceText !== state.text) {
          this.startSpeech(state.text);
        } else if (this.isPaused) {
          this.resumeSpeech();
        }
      } else if (state.status === 'paused') {
        this.pauseSpeech();
      } else if (state.status === 'completed' || state.status === 'idle' || state.status === 'failed') {
        if (this.isSpeaking) {
          this.stopSpeech();
        }
      }
    });

    this.unsubscribeBoundary = speechSynthesisService.onBoundary((event: SpeechBoundaryEvent) => {
      this.handleBoundary(event);
    });
  }

  /**
   * Parse text into words and visemes.
   */
  public parseTextToVisemes(text: string): WordVisemeSequence[] {
    const rawTokens = text.trim().split(/\s+/);
    const sequences: WordVisemeSequence[] = [];
    let runningCharIndex = 0;

    for (let i = 0; i < rawTokens.length; i++) {
      const rawWord = rawTokens[i];
      const matchIndex = text.indexOf(rawWord, runningCharIndex);
      const charIndex = matchIndex >= 0 ? matchIndex : runningCharIndex;
      runningCharIndex = charIndex + rawWord.length;

      const cleanWord = rawWord.replace(/[^a-zA-Z]/g, '').toLowerCase();
      const hasPause = /[,.?!;:]$/.test(rawWord);

      if (!cleanWord) continue;

      const frames = this.mapWordToVisemes(cleanWord, hasPause);

      // Estimate base duration: approx 65-90ms per character / speakingRate, bounded [0.24s, 0.75s]
      const charBasedDuration = (cleanWord.length * 0.075) / Math.max(0.5, this.speakingRate);
      const estimatedDuration = Math.max(0.24, Math.min(0.75, charBasedDuration + (hasPause ? 0.15 : 0)));

      sequences.push({
        word: rawWord,
        cleanWord,
        charIndex,
        charLength: rawWord.length,
        hasPunctuationPause: hasPause,
        frames,
        estimatedDuration
      });
    }

    return sequences;
  }

  /**
   * Decomposes a single English word into an ordered sequence of viseme frames.
   */
  private mapWordToVisemes(cleanWord: string, hasPause: boolean): VisemeFrame[] {
    const rawVisemes: Array<{ viseme: VisemeName; weight: number; tongue?: TongueShape }> = [];
    let idx = 0;
    const len = cleanWord.length;

    // Special exact mappings for common high-frequency greeting and conversational words
    const exactWordMap: Record<string, Array<{ viseme: VisemeName; weight: number; tongue?: TongueShape }>> = {
      hey: [
        { viseme: 'H_EST', weight: 0.42 },
        { viseme: 'Ax_E', weight: 0.48 },
        { viseme: 'TD_I', weight: 0.32 }
      ],
      welcome: [
        { viseme: 'UW_U', weight: 0.50 },
        { viseme: 'Ax_E', weight: 0.44 },
        { viseme: 'TD_I', weight: 0.38, tongue: 'L' },
        { viseme: 'KG', weight: 0.42 },
        { viseme: 'AO_A', weight: 0.40 },
        { viseme: 'MPB', weight: 0.65 }
      ],
      to: [
        { viseme: 'TD_I', weight: 0.46 },
        { viseme: 'UW_U', weight: 0.52 }
      ],
      graph: [
        { viseme: 'KG', weight: 0.46, tongue: 'R' },
        { viseme: 'AE_AA', weight: 0.54 },
        { viseme: 'FV', weight: 0.55 }
      ],
      mind: [
        { viseme: 'MPB', weight: 0.65 },
        { viseme: 'AE_AA', weight: 0.48 },
        { viseme: 'TD_I', weight: 0.44 }
      ],
      graphmind: [
        { viseme: 'KG', weight: 0.46, tongue: 'R' },
        { viseme: 'AE_AA', weight: 0.52 },
        { viseme: 'FV', weight: 0.55 },
        { viseme: 'MPB', weight: 0.65 },
        { viseme: 'AE_AA', weight: 0.48 },
        { viseme: 'TD_I', weight: 0.44 }
      ],
      please: [
        { viseme: 'MPB', weight: 0.65 },
        { viseme: 'TD_I', weight: 0.42, tongue: 'L' },
        { viseme: 'Ax_E', weight: 0.45 },
        { viseme: 'S', weight: 0.46 }
      ],
      revise: [
        { viseme: 'Ax_E', weight: 0.42, tongue: 'R' },
        { viseme: 'FV', weight: 0.55 },
        { viseme: 'AE_AA', weight: 0.48 },
        { viseme: 'S', weight: 0.46 }
      ],
      operating: [
        { viseme: 'AO_A', weight: 0.48 },
        { viseme: 'MPB', weight: 0.65 },
        { viseme: 'Ax_E', weight: 0.42, tongue: 'R' },
        { viseme: 'TD_I', weight: 0.44 },
        { viseme: 'KG', weight: 0.45 }
      ],
      systems: [
        { viseme: 'S', weight: 0.46 },
        { viseme: 'TD_I', weight: 0.42 },
        { viseme: 'S', weight: 0.44 },
        { viseme: 'TD_I', weight: 0.42 },
        { viseme: 'MPB', weight: 0.65 },
        { viseme: 'S', weight: 0.44 }
      ],
      concepts: [
        { viseme: 'KG', weight: 0.48 },
        { viseme: 'AO_A', weight: 0.45 },
        { viseme: 'TD_I', weight: 0.42 },
        { viseme: 'S', weight: 0.46 },
        { viseme: 'Ax_E', weight: 0.42 },
        { viseme: 'MPB', weight: 0.65 },
        { viseme: 'TD_I', weight: 0.42 },
        { viseme: 'S', weight: 0.44 }
      ],
      practice: [
        { viseme: 'MPB', weight: 0.65 },
        { viseme: 'Ax_E', weight: 0.42, tongue: 'R' },
        { viseme: 'AE_AA', weight: 0.52 },
        { viseme: 'KG', weight: 0.46 },
        { viseme: 'TD_I', weight: 0.42 },
        { viseme: 'S', weight: 0.46 }
      ],
      makes: [
        { viseme: 'MPB', weight: 0.65 },
        { viseme: 'Ax_E', weight: 0.48 },
        { viseme: 'KG', weight: 0.46 },
        { viseme: 'S', weight: 0.46 }
      ],
      progress: [
        { viseme: 'MPB', weight: 0.65 },
        { viseme: 'Ax_E', weight: 0.42, tongue: 'R' },
        { viseme: 'AO_A', weight: 0.46 },
        { viseme: 'KG', weight: 0.46 },
        { viseme: 'Ax_E', weight: 0.42, tongue: 'R' },
        { viseme: 'S', weight: 0.46 }
      ],
      helps: [
        { viseme: 'H_EST', weight: 0.42 },
        { viseme: 'Ax_E', weight: 0.44 },
        { viseme: 'TD_I', weight: 0.38, tongue: 'L' },
        { viseme: 'MPB', weight: 0.65 },
        { viseme: 'S', weight: 0.44 }
      ],
      understand: [
        { viseme: 'AE_AA', weight: 0.48 },
        { viseme: 'TD_I', weight: 0.42 },
        { viseme: 'Ax_E', weight: 0.42, tongue: 'R' },
        { viseme: 'S', weight: 0.44 },
        { viseme: 'TD_I', weight: 0.42 },
        { viseme: 'AE_AA', weight: 0.48 },
        { viseme: 'TD_I', weight: 0.42 }
      ],
      learn: [
        { viseme: 'TD_I', weight: 0.45, tongue: 'L' },
        { viseme: 'Ax_E', weight: 0.48, tongue: 'R' },
        { viseme: 'TD_I', weight: 0.42 }
      ]
    };

    if (exactWordMap[cleanWord]) {
      rawVisemes.push(...exactWordMap[cleanWord]);
    } else {
      // General phonetic G2V rule evaluation
      while (idx < len) {
        const sub = cleanWord.slice(idx);
        let matched = false;

        for (const rule of G2V_RULES) {
          const m = sub.match(rule.pattern);
          if (m && m[0]) {
            rawVisemes.push(...rule.visemes);
            idx += m[0].length;
            matched = true;
            break;
          }
        }

        if (!matched) {
          // Unknown character fallback: gentle mid front vowel
          rawVisemes.push({ viseme: 'Ax_E', weight: 0.35 });
          idx++;
        }
      }
    }

    if (rawVisemes.length === 0) {
      rawVisemes.push({ viseme: 'Ax_E', weight: 0.35 });
    }

    // Allocate proportional time across visemes
    // Vowels are held ~1.3x longer than quick consonant stops
    const totalWeights = rawVisemes.reduce((sum, v) => {
      const isVowel = v.viseme === 'AE_AA' || v.viseme === 'AO_A' || v.viseme === 'Ax_E' || v.viseme === 'UH_OO' || v.viseme === 'UW_U';
      return sum + (isVowel ? 1.3 : 1.0);
    }, 0);

    const pauseFraction = hasPause ? 0.22 : 0.0;
    const activeFraction = 1.0 - pauseFraction;

    const frames: VisemeFrame[] = rawVisemes.map((v) => {
      const isVowel = v.viseme === 'AE_AA' || v.viseme === 'AO_A' || v.viseme === 'Ax_E' || v.viseme === 'UH_OO' || v.viseme === 'UW_U';
      const weightUnit = (isVowel ? 1.3 : 1.0) / Math.max(0.1, totalWeights);
      return {
        viseme: v.viseme,
        durationFraction: weightUnit * activeFraction,
        targetIntensity: v.weight,
        tongue: v.tongue || null
      };
    });

    if (hasPause) {
      frames.push({
        viseme: 'REST',
        durationFraction: pauseFraction,
        targetIntensity: 0,
        tongue: null
      });
    }

    return frames;
  }

  /**
   * Start speech playback animation.
   */
  public startSpeech(text: string): void {
    this.isSpeaking = true;
    this.fullUtteranceText = text;
    this.words = this.parseTextToVisemes(text);
    this.currentWordIndex = 0;
    this.currentFrameIndex = 0;
    this.wordElapsedTime = 0;
    this.boundaryReceived = false;
    this.lastBoundaryTime = performance.now();

    if (this.words.length > 0) {
      this.activeWordDuration = this.words[0].estimatedDuration;
      this.applyFrameTargets(this.words[0].frames[0]);
    }
  }

  /**
   * Word boundary event callback from speech synthesis.
   */
  public handleBoundary(event: SpeechBoundaryEvent): void {
    if (!this.isSpeaking || this.words.length === 0) return;

    this.boundaryReceived = true;
    const now = performance.now();
    const elapsedSinceLastBoundary = (now - this.lastBoundaryTime) * 0.001;
    this.lastBoundaryTime = now;

    // Match word by character index
    let matchedWordIndex = -1;
    for (let i = 0; i < this.words.length; i++) {
      const w = this.words[i];
      if (event.charIndex >= w.charIndex && event.charIndex < w.charIndex + w.charLength + 1) {
        matchedWordIndex = i;
        break;
      }
    }

    // Fallback: match by word text
    if (matchedWordIndex === -1 && event.word) {
      const cleanEventWord = event.word.replace(/[^a-zA-Z]/g, '').toLowerCase();
      matchedWordIndex = this.words.findIndex((w) => w.cleanWord === cleanEventWord);
    }

    if (matchedWordIndex >= 0) {
      this.currentWordIndex = matchedWordIndex;
      this.currentFrameIndex = 0;
      this.wordElapsedTime = 0;

      // Dynamically refine active word duration if measurable
      if (elapsedSinceLastBoundary > 0.15 && elapsedSinceLastBoundary < 1.2) {
        this.activeWordDuration = Math.max(0.20, Math.min(0.85, elapsedSinceLastBoundary * 0.95));
      } else {
        this.activeWordDuration = this.words[matchedWordIndex].estimatedDuration;
      }

      const activeWord = this.words[matchedWordIndex];
      if (activeWord && activeWord.frames.length > 0) {
        this.applyFrameTargets(activeWord.frames[0]);
      }
    }
  }

  /**
   * Stop speech and transition mouth smoothly back to resting state.
   */
  public stopSpeech(): void {
    this.isSpeaking = false;
    this.isPaused = false;
    this.currentWordIndex = -1;
    this.currentFrameIndex = -1;
    this.wordElapsedTime = 0;
    this.resetTargetsToRest();
  }

  /**
   * Pause ongoing speech animation without jumping or resetting mouth shape abruptly.
   */
  public pauseSpeech(): void {
    if (this.isSpeaking) {
      this.isPaused = true;
    }
  }

  /**
   * Resume speech animation seamlessly from the held frame.
   */
  public resumeSpeech(): void {
    if (this.isSpeaking && this.isPaused) {
      this.isPaused = false;
      this.lastBoundaryTime = performance.now();
    }
  }

  /**
   * Reset targets immediately to neutral rest.
   */
  public resetTargetsToRest(): void {
    this.isPaused = false;
    for (const k in this.targetWeights.visemes) {
      this.targetWeights.visemes[k as VisemeName] = 0;
    }
    this.targetWeights.mouthOpen = 0;
    this.targetWeights.kiss = 0;
    this.targetWeights.lipSide = 0;
    this.targetWeights.lipUp = 0;
    this.targetWeights.lipDown = 0;
    this.targetWeights.tongueL = 0;
    this.targetWeights.tongueR = 0;
    this.targetWeights.bilabialFactor = 0;
  }

  /**
   * Map target weights from active viseme frame.
   */
  private applyFrameTargets(frame?: VisemeFrame): void {
    this.resetTargetsToRest();
    if (!frame || frame.viseme === 'REST') return;

    const motionScale = this.prefersReducedMotion ? 0.60 : 1.0;
    const intensity = frame.targetIntensity * motionScale;

    // Reset all visemes to 0, then set target
    this.targetWeights.visemes[frame.viseme] = intensity;

    switch (frame.viseme) {
      case 'AE_AA':
        this.targetWeights.mouthOpen = 0.22 * motionScale;
        this.targetWeights.lipDown = 0.12 * motionScale;
        break;
      case 'AO_A':
        this.targetWeights.mouthOpen = 0.24 * motionScale;
        this.targetWeights.kiss = 0.14 * motionScale;
        break;
      case 'Ax_E':
        this.targetWeights.mouthOpen = 0.14 * motionScale;
        this.targetWeights.lipSide = 0.10 * motionScale;
        break;
      case 'TD_I':
        this.targetWeights.mouthOpen = 0.10 * motionScale;
        this.targetWeights.lipSide = 0.08 * motionScale;
        break;
      case 'UH_OO':
        this.targetWeights.mouthOpen = 0.12 * motionScale;
        this.targetWeights.kiss = 0.22 * motionScale;
        break;
      case 'UW_U':
        this.targetWeights.mouthOpen = 0.08 * motionScale;
        this.targetWeights.kiss = 0.32 * motionScale;
        break;
      case 'H_EST':
        this.targetWeights.mouthOpen = 0.18 * motionScale;
        break;
      case 'FV':
        this.targetWeights.mouthOpen = 0.06 * motionScale;
        this.targetWeights.lipDown = 0.14 * motionScale;
        break;
      case 'S':
        this.targetWeights.mouthOpen = 0.06 * motionScale;
        this.targetWeights.lipSide = 0.12 * motionScale;
        break;
      case 'SH_CH':
        this.targetWeights.mouthOpen = 0.12 * motionScale;
        this.targetWeights.kiss = 0.18 * motionScale;
        break;
      case 'MPB':
        this.targetWeights.mouthOpen = 0.0;
        this.targetWeights.bilabialFactor = 0.92; // Clamp jaw open shut
        break;
      case 'KG':
        this.targetWeights.mouthOpen = 0.14 * motionScale;
        break;
    }

    if (frame.tongue === 'L') {
      this.targetWeights.tongueL = 0.35 * motionScale;
    } else if (frame.tongue === 'R') {
      this.targetWeights.tongueR = 0.35 * motionScale;
    }
  }

  /**
   * Advances the lip-sync controller animation by delta time dt.
   */
  public update(dt: number): void {
    if (!this.isSpeaking) {
      this.resetTargetsToRest();
    } else if (!this.isPaused && this.words.length > 0 && this.currentWordIndex >= 0) {
      this.wordElapsedTime += dt;

      const activeWord = this.words[this.currentWordIndex];
      if (activeWord) {
        // Calculate cumulative frame timelines
        let accumulatedTime = 0;
        let selectedFrameIdx = activeWord.frames.length - 1;

        for (let i = 0; i < activeWord.frames.length; i++) {
          const fDuration = activeWord.frames[i].durationFraction * this.activeWordDuration;
          if (this.wordElapsedTime < accumulatedTime + fDuration) {
            selectedFrameIdx = i;
            break;
          }
          accumulatedTime += fDuration;
        }

        if (selectedFrameIdx !== this.currentFrameIndex) {
          this.currentFrameIndex = selectedFrameIdx;
          this.applyFrameTargets(activeWord.frames[selectedFrameIdx]);
        }

        // Advance to next word if fallback progress completes
        if (this.wordElapsedTime >= this.activeWordDuration) {
          if (this.currentWordIndex < this.words.length - 1) {
            this.currentWordIndex++;
            this.currentFrameIndex = 0;
            this.wordElapsedTime = 0;
            this.activeWordDuration = this.words[this.currentWordIndex].estimatedDuration;
            this.applyFrameTargets(this.words[this.currentWordIndex].frames[0]);
          } else {
            // End of utterance reached
            this.resetTargetsToRest();
          }
        }
      }
    }

    // Co-articulation smoothing: lerp current weights toward target weights
    // dt * 18.0 provides responsive ~55ms transition time with natural organic blending
    const lerpAlpha = Math.min(1.0, dt * (this.prefersReducedMotion ? 12.0 : 18.0));

    for (const vName in this.targetWeights.visemes) {
      const key = vName as VisemeName;
      this.currentWeights.visemes[key] = THREE.MathUtils.lerp(
        this.currentWeights.visemes[key],
        this.targetWeights.visemes[key],
        lerpAlpha
      );
    }

    this.currentWeights.mouthOpen = THREE.MathUtils.lerp(this.currentWeights.mouthOpen, this.targetWeights.mouthOpen, lerpAlpha);
    this.currentWeights.kiss = THREE.MathUtils.lerp(this.currentWeights.kiss, this.targetWeights.kiss, lerpAlpha);
    this.currentWeights.lipSide = THREE.MathUtils.lerp(this.currentWeights.lipSide, this.targetWeights.lipSide, lerpAlpha);
    this.currentWeights.lipUp = THREE.MathUtils.lerp(this.currentWeights.lipUp, this.targetWeights.lipUp, lerpAlpha);
    this.currentWeights.lipDown = THREE.MathUtils.lerp(this.currentWeights.lipDown, this.targetWeights.lipDown, lerpAlpha);
    this.currentWeights.tongueL = THREE.MathUtils.lerp(this.currentWeights.tongueL, this.targetWeights.tongueL, lerpAlpha);
    this.currentWeights.tongueR = THREE.MathUtils.lerp(this.currentWeights.tongueR, this.targetWeights.tongueR, lerpAlpha);
    this.currentWeights.bilabialFactor = THREE.MathUtils.lerp(this.currentWeights.bilabialFactor, this.targetWeights.bilabialFactor, lerpAlpha);
  }

  /**
   * Resolves runtime mesh morph target dictionaries safely.
   */
  private resolveMeshDictionaries(headMesh: THREE.Mesh | null, teethDownMesh: THREE.Mesh | null): void {
    if (headMesh && headMesh.morphTargetDictionary && !this.headDictResolved) {
      const dict = headMesh.morphTargetDictionary;
      const findKey = (target: string, fallback: number): number => {
        if (typeof dict[target] === 'number') return dict[target];
        for (const k of Object.keys(dict)) {
          if (k.endsWith('.' + target) || k.toLowerCase().endsWith(target.toLowerCase())) {
            return dict[k];
          }
        }
        return fallback;
      };

      this.headIndexMap = {
        AE_AA: findKey('AE_AA_h', 0),
        AO_A: findKey('AO_a_h', 1),
        Ax_E: findKey('Ax_E_h', 2),
        TD_I: findKey('TD_I_h', 3),
        UH_OO: findKey('UH_OO_h', 4),
        UW_U: findKey('UW_U_h', 5),
        H_EST: findKey('H_EST_h', 6),
        FV: findKey('FV_h', 7),
        S: findKey('S_h', 8),
        SH_CH: findKey('SH_CH_h', 9),
        MPB_Up: findKey('MPB_Up_h', 10),
        MPB_Down: findKey('MPB_Down_h', 11),
        KG: findKey('KG_h', 12),
        MouthOpen: findKey('MouthOpen_h', 26),
        Kiss: findKey('Kiss_h', 36),
        RlipUp: findKey('RlipUp_h', 13),
        LlipUp: findKey('LlipUp_h', 14),
        RlipDown: findKey('RlipDown_h', 15),
        LlipDown: findKey('LlipDown_h', 16),
        RlipSide: findKey('RlipSide_h', 17),
        LlipSide: findKey('LlipSide_h', 18)
      };
      this.headDictResolved = true;
    }

    if (teethDownMesh && teethDownMesh.morphTargetDictionary && !this.teethDictResolved) {
      const dict = teethDownMesh.morphTargetDictionary;
      const findKey = (target: string, fallback: number): number => {
        if (typeof dict[target] === 'number') return dict[target];
        for (const k of Object.keys(dict)) {
          if (k.endsWith('.' + target) || k.toLowerCase().endsWith(target.toLowerCase())) {
            return dict[k];
          }
        }
        return fallback;
      };

      this.teethIndexMap = {
        t_AE_AA: findKey('t_AE_AA_h', 12),
        t_AO_a: findKey('t_AO_a_h', 13),
        t_Ax_E: findKey('t_Ax_E_h', 14),
        t_TD_I: findKey('t_TD_I_h', 15),
        t_UH_OO: findKey('t_UH_OO_h', 16),
        t_UW_U: findKey('t_UW_U_h', 17),
        t_H_EST: findKey('t_H_EST_h', 18),
        t_FV: findKey('t_FV_h', 19),
        t_S: findKey('t_S_h', 20),
        t_SH_CH: findKey('t_SH_CH_h', 21),
        t_MPB: findKey('t_MPB_h', 22),
        t_KG: findKey('t_KG_h', 23),
        t_MouthOpen: findKey('t_MouthOpen_h', 29),
        LLL_In: findKey('LLL_In_tg_h', 11),
        RRR_In: findKey('RRR_In_tg_h', 10)
      };
      this.teethDictResolved = true;
    }
  }

  /**
   * Applies composited lip-sync morphs additively on top of the character's facial expressions.
   *
   * @param headMesh - H_DDS_HighRes skinned mesh
   * @param teethDownMesh - h_TeethDown skinned mesh
   * @param expressionBaseMouthOpen - Existing mouth opening from PersonaExpressionController
   */
  public applyToMeshes(
    headMesh: THREE.Mesh | null,
    teethDownMesh: THREE.Mesh | null,
    expressionBaseMouthOpen = 0.22
  ): void {
    this.resolveMeshDictionaries(headMesh, teethDownMesh);

    const w = this.currentWeights;

    // Bilabial suppression: When /m/, /p/, /b/ occurs, lips must touch
    const bilabialDamp = Math.max(0.0, 1.0 - w.bilabialFactor * 0.92);

    // Composite net jaw open: blend expression smile mouth open with phonetic jaw opening, clamped physiologically
    const netMouthOpen = Math.min(
      0.44,
      Math.max(0.0, (expressionBaseMouthOpen * 0.65 + w.mouthOpen) * bilabialDamp)
    );

    // Apply to Head Mesh (H_DDS_HighRes)
    if (headMesh && headMesh.morphTargetInfluences) {
      const morphs = headMesh.morphTargetInfluences;
      const map = this.headIndexMap;

      // Primary Viseme Blend Shapes
      if (map.AE_AA !== undefined) morphs[map.AE_AA] = w.visemes.AE_AA;
      if (map.AO_A !== undefined) morphs[map.AO_A] = w.visemes.AO_A;
      if (map.Ax_E !== undefined) morphs[map.Ax_E] = w.visemes.Ax_E;
      if (map.TD_I !== undefined) morphs[map.TD_I] = w.visemes.TD_I;
      if (map.UH_OO !== undefined) morphs[map.UH_OO] = w.visemes.UH_OO;
      if (map.UW_U !== undefined) morphs[map.UW_U] = w.visemes.UW_U;
      if (map.H_EST !== undefined) morphs[map.H_EST] = w.visemes.H_EST;
      if (map.FV !== undefined) morphs[map.FV] = w.visemes.FV;
      if (map.S !== undefined) morphs[map.S] = w.visemes.S;
      if (map.SH_CH !== undefined) morphs[map.SH_CH] = w.visemes.SH_CH;
      if (map.MPB_Up !== undefined) morphs[map.MPB_Up] = w.visemes.MPB;
      if (map.MPB_Down !== undefined) morphs[map.MPB_Down] = w.visemes.MPB;
      if (map.KG !== undefined) morphs[map.KG] = w.visemes.KG;

      // Net Mouth Open (additive, clamped)
      if (map.MouthOpen !== undefined) morphs[map.MouthOpen] = netMouthOpen;

      // Lip Rounding / Pucker for rounded vowels
      if (map.Kiss !== undefined) morphs[map.Kiss] = Math.min(1.0, (morphs[map.Kiss] || 0) + w.kiss);

      // Subtle lip contouring
      if (map.RlipSide !== undefined) morphs[map.RlipSide] = Math.min(1.0, (morphs[map.RlipSide] || 0) + w.lipSide);
      if (map.LlipSide !== undefined) morphs[map.LlipSide] = Math.min(1.0, (morphs[map.LlipSide] || 0) + w.lipSide);
      if (map.RlipDown !== undefined) morphs[map.RlipDown] = Math.min(1.0, (morphs[map.RlipDown] || 0) + w.lipDown);
      if (map.LlipDown !== undefined) morphs[map.LlipDown] = Math.min(1.0, (morphs[map.LlipDown] || 0) + w.lipDown);
    }

    // Apply to Lower Teeth & Tongue Mesh (h_TeethDown)
    if (teethDownMesh && teethDownMesh.morphTargetInfluences) {
      const morphs = teethDownMesh.morphTargetInfluences;
      const map = this.teethIndexMap;

      // Synchronize lower teeth drop with exact head jaw drop so teeth stay aligned
      if (map.t_MouthOpen !== undefined) morphs[map.t_MouthOpen] = netMouthOpen;

      // Lower Teeth Visemes
      if (map.t_AE_AA !== undefined) morphs[map.t_AE_AA] = w.visemes.AE_AA;
      if (map.t_AO_a !== undefined) morphs[map.t_AO_a] = w.visemes.AO_A;
      if (map.t_Ax_E !== undefined) morphs[map.t_Ax_E] = w.visemes.Ax_E;
      if (map.t_TD_I !== undefined) morphs[map.t_TD_I] = w.visemes.TD_I;
      if (map.t_UH_OO !== undefined) morphs[map.t_UH_OO] = w.visemes.UH_OO;
      if (map.t_UW_U !== undefined) morphs[map.t_UW_U] = w.visemes.UW_U;
      if (map.t_H_EST !== undefined) morphs[map.t_H_EST] = w.visemes.H_EST;
      if (map.t_FV !== undefined) morphs[map.t_FV] = w.visemes.FV;
      if (map.t_S !== undefined) morphs[map.t_S] = w.visemes.S;
      if (map.t_SH_CH !== undefined) morphs[map.t_SH_CH] = w.visemes.SH_CH;
      if (map.t_MPB !== undefined) morphs[map.t_MPB] = w.visemes.MPB;
      if (map.t_KG !== undefined) morphs[map.t_KG] = w.visemes.KG;

      // Tongue Morphs
      if (map.LLL_In !== undefined) morphs[map.LLL_In] = w.tongueL;
      if (map.RRR_In !== undefined) morphs[map.RRR_In] = w.tongueR;
    }
  }

  /**
   * Current weights getter (for inspection and unit testing).
   */
  public getCurrentWeights(): LipSyncWeights {
    return { ...this.currentWeights, visemes: { ...this.currentWeights.visemes } };
  }

  /**
   * Active state info getter.
   */
  public getState() {
    return {
      isSpeaking: this.isSpeaking,
      isPaused: this.isPaused,
      currentWordIndex: this.currentWordIndex,
      currentWord: this.words[this.currentWordIndex]?.word || null,
      totalWords: this.words.length,
      fullText: this.fullUtteranceText
    };
  }

  /**
   * Dispose subscriptions and reset state safely.
   */
  public dispose(): void {
    this.stopSpeech();
    if (this.unsubscribeSpeechState) {
      this.unsubscribeSpeechState();
      this.unsubscribeSpeechState = null;
    }
    if (this.unsubscribeBoundary) {
      this.unsubscribeBoundary();
      this.unsubscribeBoundary = null;
    }
  }
}
