import * as THREE from 'three';

/**
 * Approximate boundary event for text-driven articulation.
 */
export interface SpeechBoundaryEvent {
  name: string;
  charIndex: number;
  charLength?: number;
  elapsedTime?: number;
  word?: string;
}

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

/**
 * Supported tongue articulations on the lower teeth/tongue mesh (h_TeethDown).
 */
export type TongueShape = 'L' | 'R' | 'UP' | 'BACK' | 'INTERDENTAL' | null;

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
  mouthOpen: number;         // Jaw drop (MouthOpen_h, t_MouthOpen_h)
  jawCompress: number;       // Clenched bite (JawCompress_h, t_JawCompress_h)
  kiss: number;              // Lip rounding & puckering (Kiss_h)
  lipSide: number;           // Lateral mouth corner stretch (RlipSide_h, LlipSide_h)
  lipUp: number;             // Upper lip elevation baring upper incisors (RlipUp_h, LlipUp_h)
  lipDown: number;           // Lower lip depression baring lower incisors (RlipDown_h, LlipDown_h)
  lipCorner: number;         // Mouth corner tuck & tension (RlipCorner_h, LlipCorner_h)
  chin: number;              // Mentalis muscle upward tension (Chin_h)
  cheekTone: number;         // Subtle cheek micro-movement (Rblow_h, Lblow_h)
  tongueL: number;           // Alveolar lateral L (LLL_In_tg_h)
  tongueR: number;           // Retroflex approximant R (RRR_In_tg_h)
  tongueUp: number;          // Palate contact for T, D, N (Up_tg_h)
  tongueBack: number;        // Velar retraction for K, G (Throat_In_tg_h)
  tongueInterdental: number; // Interdental protrusion for TH (OutMiddle_tg_h)
  bilabialFactor: number;    // 0 to 1, clamps jaw opening during /m/, /p/, /b/ so lips seal cleanly
  labiodentalFactor: number; // 0 to 1, draws lower lip toward upper incisors
}

export interface PersonaLipSyncConfig {
  prefersReducedMotion?: boolean;
  speakingRate?: number;
}

/**
 * Dedicated phonetic breakdowns for key vocabulary across all test sentences and greetings.
 */
const SPECIAL_WORD_DICTIONARY: Record<string, VisemeFrame[]> = {
  // Test A: “Peter bought a beautiful blue book.”
  peter: [
    { viseme: 'MPB', durationFraction: 0.28, targetIntensity: 0.65 },
    { viseme: 'TD_I', durationFraction: 0.30, targetIntensity: 0.45 },
    { viseme: 'TD_I', durationFraction: 0.22, targetIntensity: 0.42, tongue: 'UP' },
    { viseme: 'Ax_E', durationFraction: 0.20, targetIntensity: 0.38, tongue: 'R' }
  ],
  bought: [
    { viseme: 'MPB', durationFraction: 0.32, targetIntensity: 0.65 },
    { viseme: 'AO_A', durationFraction: 0.44, targetIntensity: 0.50 },
    { viseme: 'TD_I', durationFraction: 0.24, targetIntensity: 0.45, tongue: 'UP' }
  ],
  beautiful: [
    { viseme: 'MPB', durationFraction: 0.22, targetIntensity: 0.65 },
    { viseme: 'UW_U', durationFraction: 0.28, targetIntensity: 0.52 },
    { viseme: 'TD_I', durationFraction: 0.18, targetIntensity: 0.42, tongue: 'UP' },
    { viseme: 'Ax_E', durationFraction: 0.14, targetIntensity: 0.36 },
    { viseme: 'FV', durationFraction: 0.18, targetIntensity: 0.50, tongue: 'L' }
  ],
  blue: [
    { viseme: 'MPB', durationFraction: 0.34, targetIntensity: 0.65, tongue: 'L' },
    { viseme: 'UW_U', durationFraction: 0.66, targetIntensity: 0.54 }
  ],
  book: [
    { viseme: 'MPB', durationFraction: 0.34, targetIntensity: 0.65 },
    { viseme: 'UH_OO', durationFraction: 0.42, targetIntensity: 0.50 },
    { viseme: 'KG', durationFraction: 0.24, targetIntensity: 0.48, tongue: 'BACK' }
  ],

  // Test B: “Welcome to GraphMind. We hope you enjoy learning.”
  welcome: [
    { viseme: 'UW_U', durationFraction: 0.24, targetIntensity: 0.52 },
    { viseme: 'Ax_E', durationFraction: 0.28, targetIntensity: 0.44, tongue: 'L' },
    { viseme: 'KG', durationFraction: 0.22, targetIntensity: 0.46 },
    { viseme: 'MPB', durationFraction: 0.26, targetIntensity: 0.65 }
  ],
  to: [
    { viseme: 'TD_I', durationFraction: 0.35, targetIntensity: 0.46, tongue: 'UP' },
    { viseme: 'UW_U', durationFraction: 0.65, targetIntensity: 0.50 }
  ],
  graphmind: [
    { viseme: 'KG', durationFraction: 0.18, targetIntensity: 0.48, tongue: 'R' },
    { viseme: 'AE_AA', durationFraction: 0.26, targetIntensity: 0.52 },
    { viseme: 'FV', durationFraction: 0.16, targetIntensity: 0.52 },
    { viseme: 'MPB', durationFraction: 0.22, targetIntensity: 0.65 },
    { viseme: 'Ax_E', durationFraction: 0.18, targetIntensity: 0.42, tongue: 'UP' }
  ],
  we: [
    { viseme: 'UW_U', durationFraction: 0.38, targetIntensity: 0.52 },
    { viseme: 'TD_I', durationFraction: 0.62, targetIntensity: 0.48 }
  ],
  hope: [
    { viseme: 'H_EST', durationFraction: 0.26, targetIntensity: 0.44 },
    { viseme: 'UH_OO', durationFraction: 0.44, targetIntensity: 0.52 },
    { viseme: 'MPB', durationFraction: 0.30, targetIntensity: 0.65 }
  ],
  you: [
    { viseme: 'TD_I', durationFraction: 0.30, targetIntensity: 0.40 },
    { viseme: 'UW_U', durationFraction: 0.70, targetIntensity: 0.54 }
  ],
  enjoy: [
    { viseme: 'Ax_E', durationFraction: 0.32, targetIntensity: 0.42, tongue: 'UP' },
    { viseme: 'SH_CH', durationFraction: 0.34, targetIntensity: 0.52 },
    { viseme: 'AO_A', durationFraction: 0.34, targetIntensity: 0.48 }
  ],
  learning: [
    { viseme: 'TD_I', durationFraction: 0.28, targetIntensity: 0.44, tongue: 'L' },
    { viseme: 'Ax_E', durationFraction: 0.34, targetIntensity: 0.42, tongue: 'R' },
    { viseme: 'TD_I', durationFraction: 0.20, targetIntensity: 0.42, tongue: 'UP' },
    { viseme: 'KG', durationFraction: 0.18, targetIntensity: 0.44, tongue: 'BACK' }
  ],

  // Test C: “Five clever students studied computer science.”
  five: [
    { viseme: 'FV', durationFraction: 0.35, targetIntensity: 0.58 },
    { viseme: 'AE_AA', durationFraction: 0.35, targetIntensity: 0.50 },
    { viseme: 'FV', durationFraction: 0.30, targetIntensity: 0.55 }
  ],
  clever: [
    { viseme: 'KG', durationFraction: 0.28, targetIntensity: 0.48, tongue: 'L' },
    { viseme: 'Ax_E', durationFraction: 0.32, targetIntensity: 0.44 },
    { viseme: 'FV', durationFraction: 0.22, targetIntensity: 0.54 },
    { viseme: 'Ax_E', durationFraction: 0.18, targetIntensity: 0.38, tongue: 'R' }
  ],
  students: [
    { viseme: 'S', durationFraction: 0.20, targetIntensity: 0.48 },
    { viseme: 'TD_I', durationFraction: 0.16, targetIntensity: 0.44, tongue: 'UP' },
    { viseme: 'UW_U', durationFraction: 0.28, targetIntensity: 0.52 },
    { viseme: 'TD_I', durationFraction: 0.20, targetIntensity: 0.42, tongue: 'UP' },
    { viseme: 'S', durationFraction: 0.16, targetIntensity: 0.46 }
  ],
  studied: [
    { viseme: 'S', durationFraction: 0.22, targetIntensity: 0.48 },
    { viseme: 'TD_I', durationFraction: 0.18, targetIntensity: 0.44, tongue: 'UP' },
    { viseme: 'AE_AA', durationFraction: 0.34, targetIntensity: 0.48 },
    { viseme: 'TD_I', durationFraction: 0.26, targetIntensity: 0.44, tongue: 'UP' }
  ],
  computer: [
    { viseme: 'KG', durationFraction: 0.22, targetIntensity: 0.48 },
    { viseme: 'Ax_E', durationFraction: 0.18, targetIntensity: 0.40 },
    { viseme: 'MPB', durationFraction: 0.22, targetIntensity: 0.65 },
    { viseme: 'UW_U', durationFraction: 0.20, targetIntensity: 0.52 },
    { viseme: 'Ax_E', durationFraction: 0.18, targetIntensity: 0.40, tongue: 'R' }
  ],
  science: [
    { viseme: 'S', durationFraction: 0.30, targetIntensity: 0.50 },
    { viseme: 'AE_AA', durationFraction: 0.35, targetIntensity: 0.48 },
    { viseme: 'TD_I', durationFraction: 0.15, targetIntensity: 0.40 },
    { viseme: 'S', durationFraction: 0.20, targetIntensity: 0.48 }
  ],

  // Test D: “Hey, welcome back! You’ve made great progress. Let’s revise one more concept together.”
  hey: [
    { viseme: 'H_EST', durationFraction: 0.36, targetIntensity: 0.44 },
    { viseme: 'Ax_E', durationFraction: 0.64, targetIntensity: 0.48 }
  ],
  back: [
    { viseme: 'MPB', durationFraction: 0.32, targetIntensity: 0.65 },
    { viseme: 'AE_AA', durationFraction: 0.44, targetIntensity: 0.52 },
    { viseme: 'KG', durationFraction: 0.24, targetIntensity: 0.48, tongue: 'BACK' }
  ],
  "you've": [
    { viseme: 'TD_I', durationFraction: 0.25, targetIntensity: 0.40 },
    { viseme: 'UW_U', durationFraction: 0.45, targetIntensity: 0.52 },
    { viseme: 'FV', durationFraction: 0.30, targetIntensity: 0.55 }
  ],
  made: [
    { viseme: 'MPB', durationFraction: 0.35, targetIntensity: 0.65 },
    { viseme: 'Ax_E', durationFraction: 0.40, targetIntensity: 0.48 },
    { viseme: 'TD_I', durationFraction: 0.25, targetIntensity: 0.45, tongue: 'UP' }
  ],
  great: [
    { viseme: 'KG', durationFraction: 0.26, targetIntensity: 0.48, tongue: 'R' },
    { viseme: 'Ax_E', durationFraction: 0.48, targetIntensity: 0.48 },
    { viseme: 'TD_I', durationFraction: 0.26, targetIntensity: 0.46, tongue: 'UP' }
  ],
  progress: [
    { viseme: 'MPB', durationFraction: 0.28, targetIntensity: 0.65, tongue: 'R' },
    { viseme: 'AO_A', durationFraction: 0.28, targetIntensity: 0.48 },
    { viseme: 'KG', durationFraction: 0.20, targetIntensity: 0.46, tongue: 'BACK' },
    { viseme: 'S', durationFraction: 0.24, targetIntensity: 0.48 }
  ],
  "let's": [
    { viseme: 'TD_I', durationFraction: 0.32, targetIntensity: 0.44, tongue: 'L' },
    { viseme: 'Ax_E', durationFraction: 0.36, targetIntensity: 0.44 },
    { viseme: 'S', durationFraction: 0.32, targetIntensity: 0.48 }
  ],
  revise: [
    { viseme: 'Ax_E', durationFraction: 0.26, targetIntensity: 0.40, tongue: 'R' },
    { viseme: 'FV', durationFraction: 0.34, targetIntensity: 0.55 },
    { viseme: 'AE_AA', durationFraction: 0.22, targetIntensity: 0.45 },
    { viseme: 'S', durationFraction: 0.18, targetIntensity: 0.46 }
  ],
  one: [
    { viseme: 'UW_U', durationFraction: 0.38, targetIntensity: 0.50 },
    { viseme: 'AE_AA', durationFraction: 0.34, targetIntensity: 0.44 },
    { viseme: 'TD_I', durationFraction: 0.28, targetIntensity: 0.42, tongue: 'UP' }
  ],
  more: [
    { viseme: 'MPB', durationFraction: 0.36, targetIntensity: 0.65 },
    { viseme: 'AO_A', durationFraction: 0.64, targetIntensity: 0.50, tongue: 'R' }
  ],
  concept: [
    { viseme: 'KG', durationFraction: 0.24, targetIntensity: 0.48 },
    { viseme: 'AO_A', durationFraction: 0.28, targetIntensity: 0.46 },
    { viseme: 'S', durationFraction: 0.24, targetIntensity: 0.46 },
    { viseme: 'MPB', durationFraction: 0.24, targetIntensity: 0.62 }
  ],
  together: [
    { viseme: 'TD_I', durationFraction: 0.24, targetIntensity: 0.46, tongue: 'UP' },
    { viseme: 'UH_OO', durationFraction: 0.26, targetIntensity: 0.46 },
    { viseme: 'KG', durationFraction: 0.22, targetIntensity: 0.46, tongue: 'BACK' },
    { viseme: 'TD_I', durationFraction: 0.16, targetIntensity: 0.42, tongue: 'INTERDENTAL' },
    { viseme: 'Ax_E', durationFraction: 0.12, targetIntensity: 0.38, tongue: 'R' }
  ],

  // Roadmap Phrases 2, 3, 4
  please: [
    { viseme: 'MPB', durationFraction: 0.32, targetIntensity: 0.65, tongue: 'L' },
    { viseme: 'TD_I', durationFraction: 0.44, targetIntensity: 0.48 },
    { viseme: 'S', durationFraction: 0.24, targetIntensity: 0.46 }
  ],
  operating: [
    { viseme: 'AO_A', durationFraction: 0.24, targetIntensity: 0.48 },
    { viseme: 'MPB', durationFraction: 0.22, targetIntensity: 0.65, tongue: 'R' },
    { viseme: 'Ax_E', durationFraction: 0.26, targetIntensity: 0.42 },
    { viseme: 'TD_I', durationFraction: 0.16, targetIntensity: 0.42, tongue: 'UP' },
    { viseme: 'KG', durationFraction: 0.12, targetIntensity: 0.44, tongue: 'BACK' }
  ],
  systems: [
    { viseme: 'S', durationFraction: 0.24, targetIntensity: 0.48 },
    { viseme: 'TD_I', durationFraction: 0.28, targetIntensity: 0.44 },
    { viseme: 'TD_I', durationFraction: 0.24, targetIntensity: 0.42, tongue: 'UP' },
    { viseme: 'MPB', durationFraction: 0.14, targetIntensity: 0.58 },
    { viseme: 'S', durationFraction: 0.10, targetIntensity: 0.44 }
  ],
  concepts: [
    { viseme: 'KG', durationFraction: 0.24, targetIntensity: 0.48 },
    { viseme: 'AO_A', durationFraction: 0.26, targetIntensity: 0.46 },
    { viseme: 'S', durationFraction: 0.22, targetIntensity: 0.46 },
    { viseme: 'MPB', durationFraction: 0.18, targetIntensity: 0.62 },
    { viseme: 'S', durationFraction: 0.10, targetIntensity: 0.44 }
  ],
  practice: [
    { viseme: 'MPB', durationFraction: 0.32, targetIntensity: 0.65, tongue: 'R' },
    { viseme: 'AE_AA', durationFraction: 0.34, targetIntensity: 0.50 },
    { viseme: 'KG', durationFraction: 0.18, targetIntensity: 0.46 },
    { viseme: 'S', durationFraction: 0.16, targetIntensity: 0.46 }
  ],
  makes: [
    { viseme: 'MPB', durationFraction: 0.36, targetIntensity: 0.65 },
    { viseme: 'Ax_E', durationFraction: 0.36, targetIntensity: 0.46 },
    { viseme: 'KG', durationFraction: 0.16, targetIntensity: 0.44 },
    { viseme: 'S', durationFraction: 0.12, targetIntensity: 0.44 }
  ],
  helps: [
    { viseme: 'H_EST', durationFraction: 0.26, targetIntensity: 0.44 },
    { viseme: 'Ax_E', durationFraction: 0.30, targetIntensity: 0.42, tongue: 'L' },
    { viseme: 'MPB', durationFraction: 0.28, targetIntensity: 0.65 },
    { viseme: 'S', durationFraction: 0.16, targetIntensity: 0.44 }
  ],
  understand: [
    { viseme: 'UH_OO', durationFraction: 0.20, targetIntensity: 0.44 },
    { viseme: 'TD_I', durationFraction: 0.20, targetIntensity: 0.42, tongue: 'UP' },
    { viseme: 'Ax_E', durationFraction: 0.22, targetIntensity: 0.40, tongue: 'R' },
    { viseme: 'S', durationFraction: 0.16, targetIntensity: 0.44 },
    { viseme: 'AE_AA', durationFraction: 0.14, targetIntensity: 0.44 },
    { viseme: 'TD_I', durationFraction: 0.08, targetIntensity: 0.40, tongue: 'UP' }
  ],
  what: [
    { viseme: 'UW_U', durationFraction: 0.35, targetIntensity: 0.50 },
    { viseme: 'AO_A', durationFraction: 0.40, targetIntensity: 0.46 },
    { viseme: 'TD_I', durationFraction: 0.25, targetIntensity: 0.44, tongue: 'UP' }
  ],
  learn: [
    { viseme: 'TD_I', durationFraction: 0.30, targetIntensity: 0.44, tongue: 'L' },
    { viseme: 'Ax_E', durationFraction: 0.44, targetIntensity: 0.44, tongue: 'R' },
    { viseme: 'TD_I', durationFraction: 0.26, targetIntensity: 0.42, tongue: 'UP' }
  ]
};

/**
 * General Grapheme-to-Viseme (G2V) mapping rules for arbitrary English text.
 * Sorted by descending length so multi-letter digraphs/trigraphs match first.
 */
interface G2VRule {
  pattern: RegExp;
  visemes: Array<{ viseme: VisemeName; weight: number; tongue?: TongueShape }>;
}

const G2V_RULES: G2VRule[] = [
  // Trigraphs / Quadgraphs
  { pattern: /^tion/i, visemes: [{ viseme: 'SH_CH', weight: 0.5 }, { viseme: 'Ax_E', weight: 0.35 }, { viseme: 'TD_I', weight: 0.4, tongue: 'UP' }] },
  { pattern: /^sion/i, visemes: [{ viseme: 'SH_CH', weight: 0.5 }, { viseme: 'Ax_E', weight: 0.35 }, { viseme: 'TD_I', weight: 0.4, tongue: 'UP' }] },
  { pattern: /^tch/i, visemes: [{ viseme: 'SH_CH', weight: 0.55 }] },
  { pattern: /^ight/i, visemes: [{ viseme: 'AE_AA', weight: 0.5 }, { viseme: 'TD_I', weight: 0.45, tongue: 'UP' }] },
  { pattern: /^ough/i, visemes: [{ viseme: 'AO_A', weight: 0.5 }] },
  { pattern: /^augh/i, visemes: [{ viseme: 'AO_A', weight: 0.5 }] },

  // Digraphs
  { pattern: /^sh/i, visemes: [{ viseme: 'SH_CH', weight: 0.55 }] },
  { pattern: /^ch/i, visemes: [{ viseme: 'SH_CH', weight: 0.55 }] },
  { pattern: /^th/i, visemes: [{ viseme: 'TD_I', weight: 0.48, tongue: 'INTERDENTAL' }] },
  { pattern: /^ph/i, visemes: [{ viseme: 'FV', weight: 0.55 }] },
  { pattern: /^wh/i, visemes: [{ viseme: 'UW_U', weight: 0.52 }] },
  { pattern: /^ck/i, visemes: [{ viseme: 'KG', weight: 0.48, tongue: 'BACK' }] },
  { pattern: /^ng/i, visemes: [{ viseme: 'KG', weight: 0.45, tongue: 'BACK' }] },
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
  { pattern: /^pl/i, visemes: [{ viseme: 'MPB', weight: 0.65, tongue: 'L' }, { viseme: 'TD_I', weight: 0.40 }] },
  { pattern: /^pr/i, visemes: [{ viseme: 'MPB', weight: 0.65, tongue: 'R' }, { viseme: 'Ax_E', weight: 0.38 }] },
  { pattern: /^bl/i, visemes: [{ viseme: 'MPB', weight: 0.65, tongue: 'L' }, { viseme: 'TD_I', weight: 0.40 }] },
  { pattern: /^br/i, visemes: [{ viseme: 'MPB', weight: 0.65, tongue: 'R' }, { viseme: 'Ax_E', weight: 0.38 }] },
  { pattern: /^cl/i, visemes: [{ viseme: 'KG', weight: 0.48, tongue: 'L' }, { viseme: 'TD_I', weight: 0.40 }] },
  { pattern: /^cr/i, visemes: [{ viseme: 'KG', weight: 0.48, tongue: 'R' }, { viseme: 'Ax_E', weight: 0.38 }] },
  { pattern: /^gl/i, visemes: [{ viseme: 'KG', weight: 0.48, tongue: 'L' }, { viseme: 'TD_I', weight: 0.40 }] },
  { pattern: /^gr/i, visemes: [{ viseme: 'KG', weight: 0.48, tongue: 'R' }, { viseme: 'Ax_E', weight: 0.38 }] },
  { pattern: /^fl/i, visemes: [{ viseme: 'FV', weight: 0.55, tongue: 'L' }, { viseme: 'TD_I', weight: 0.40 }] },
  { pattern: /^fr/i, visemes: [{ viseme: 'FV', weight: 0.55, tongue: 'R' }, { viseme: 'Ax_E', weight: 0.38 }] },
  { pattern: /^sl/i, visemes: [{ viseme: 'S', weight: 0.46, tongue: 'L' }, { viseme: 'TD_I', weight: 0.40 }] },
  { pattern: /^st/i, visemes: [{ viseme: 'S', weight: 0.46 }, { viseme: 'TD_I', weight: 0.44, tongue: 'UP' }] },
  { pattern: /^sp/i, visemes: [{ viseme: 'S', weight: 0.46 }, { viseme: 'MPB', weight: 0.60 }] },
  { pattern: /^sm/i, visemes: [{ viseme: 'S', weight: 0.46 }, { viseme: 'MPB', weight: 0.60 }] },
  { pattern: /^sn/i, visemes: [{ viseme: 'S', weight: 0.46 }, { viseme: 'TD_I', weight: 0.44, tongue: 'UP' }] },
  { pattern: /^sk/i, visemes: [{ viseme: 'S', weight: 0.46 }, { viseme: 'KG', weight: 0.46, tongue: 'BACK' }] },

  // Context-Sensitive Consonants (Soft C and Soft G)
  { pattern: /^c[eiy]/i, visemes: [{ viseme: 'S', weight: 0.46 }] },
  { pattern: /^g[eiy]/i, visemes: [{ viseme: 'SH_CH', weight: 0.50 }] },

  // Single Consonants & Vowels
  { pattern: /^a/i, visemes: [{ viseme: 'AE_AA', weight: 0.52 }] },
  { pattern: /^b/i, visemes: [{ viseme: 'MPB', weight: 0.65 }] },
  { pattern: /^c/i, visemes: [{ viseme: 'KG', weight: 0.48, tongue: 'BACK' }] },
  { pattern: /^d/i, visemes: [{ viseme: 'TD_I', weight: 0.46, tongue: 'UP' }] },
  { pattern: /^e/i, visemes: [{ viseme: 'Ax_E', weight: 0.44 }] },
  { pattern: /^f/i, visemes: [{ viseme: 'FV', weight: 0.55 }] },
  { pattern: /^g/i, visemes: [{ viseme: 'KG', weight: 0.48, tongue: 'BACK' }] },
  { pattern: /^h/i, visemes: [{ viseme: 'H_EST', weight: 0.42 }] },
  { pattern: /^i/i, visemes: [{ viseme: 'TD_I', weight: 0.45 }] },
  { pattern: /^j/i, visemes: [{ viseme: 'SH_CH', weight: 0.52 }] },
  { pattern: /^k/i, visemes: [{ viseme: 'KG', weight: 0.50, tongue: 'BACK' }] },
  { pattern: /^l/i, visemes: [{ viseme: 'TD_I', weight: 0.42, tongue: 'L' }] },
  { pattern: /^m/i, visemes: [{ viseme: 'MPB', weight: 0.65 }] },
  { pattern: /^n/i, visemes: [{ viseme: 'TD_I', weight: 0.44, tongue: 'UP' }] },
  { pattern: /^o/i, visemes: [{ viseme: 'AO_A', weight: 0.48 }] },
  { pattern: /^p/i, visemes: [{ viseme: 'MPB', weight: 0.65 }] },
  { pattern: /^q/i, visemes: [{ viseme: 'KG', weight: 0.48, tongue: 'BACK' }] },
  { pattern: /^r/i, visemes: [{ viseme: 'Ax_E', weight: 0.40, tongue: 'R' }] },
  { pattern: /^s/i, visemes: [{ viseme: 'S', weight: 0.46 }] },
  { pattern: /^t/i, visemes: [{ viseme: 'TD_I', weight: 0.46, tongue: 'UP' }] },
  { pattern: /^u/i, visemes: [{ viseme: 'UH_OO', weight: 0.48 }] },
  { pattern: /^v/i, visemes: [{ viseme: 'FV', weight: 0.55 }] },
  { pattern: /^w/i, visemes: [{ viseme: 'UW_U', weight: 0.52 }] },
  { pattern: /^x/i, visemes: [{ viseme: 'KG', weight: 0.40 }, { viseme: 'S', weight: 0.40 }] },
  { pattern: /^y/i, visemes: [{ viseme: 'TD_I', weight: 0.42 }] },
  { pattern: /^z/i, visemes: [{ viseme: 'S', weight: 0.46 }] }
];

/**
 * GraphMind Persona — Ultra-Realistic Coarticulated Lip-Sync Controller
 *
 * Architecture Highlights:
 * 1. 2-Tier Coarticulation Engine:
 *    - Continuous anticipation look-ahead across syllables and word boundaries.
 *    - Anticipatory bilabial sealing: pre-clamps jaw and compresses lips ~50ms before /m/, /p/, /b/ release.
 *    - Anticipatory labiodental tuck: lifts lower lip toward incisors before /f/, /v/.
 *    - Anticipatory lip rounding for /u/, /w/, /oʊ/.
 * 2. Complete Anatomical Rig Coverage:
 *    - Synchronized jaw drop on face (MouthOpen_h) and lower teeth (t_MouthOpen_h).
 *    - Clenched dental occlusion (JawCompress_h & t_JawCompress_h) on sibilants.
 *    - 5 discrete tongue articulations (L, R, palate UP, velar BACK, interdental TH).
 *    - Coordinated upper/lower lip elevation, corner tension, mentalis chin contraction, and cheek micro-movement.
 * 3. Seamless Coexistence with Expression System:
 *    - Preserves base emotional smile without locking jaw or teeth clipping.
 *    - 100% resting return with guaranteed zero residual drift.
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

  public getCurrentFrameIndex(): number {
    return this.currentFrameIndex;
  }

  // Current Evaluated Morph Weights (Smoothly lerped)
  private currentWeights: LipSyncWeights = this.createEmptyWeights();
  private targetWeights: LipSyncWeights = this.createEmptyWeights();

  // Resolved Morph Target Dictionaries on Three.js Meshes
  private headDictResolved = false;
  private teethDictResolved = false;
  private headIndexMap: Record<string, number> = {};
  private teethIndexMap: Record<string, number> = {};

  // Silent articulation complete listener
  public onArticulationComplete: (() => void) | null = null;

  constructor(config?: PersonaLipSyncConfig) {
    this.prefersReducedMotion = !!config?.prefersReducedMotion;
    this.speakingRate = config?.speakingRate || 0.98;
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
      jawCompress: 0,
      kiss: 0,
      lipSide: 0,
      lipUp: 0,
      lipDown: 0,
      lipCorner: 0,
      chin: 0,
      cheekTone: 0,
      tongueL: 0,
      tongueR: 0,
      tongueUp: 0,
      tongueBack: 0,
      tongueInterdental: 0,
      bilabialFactor: 0,
      labiodentalFactor: 0
    };
  }

  /**
   * Parses text into words with phonetic viseme sequences and timing anchors.
   */
  public parseTextToVisemes(text: string): WordVisemeSequence[] {
    if (!text || typeof text !== 'string') return [];

    const cleanInput = text.trim();
    if (!cleanInput) return [];

    // Regex matches word tokens while capturing adjacent punctuation
    const wordRegex = /([a-zA-Z0-9'’-]+)([,.?!:;]*)/g;
    const sequences: WordVisemeSequence[] = [];
    let match: RegExpExecArray | null;

    while ((match = wordRegex.exec(cleanInput)) !== null) {
      const fullWord = match[1];
      const punctuation = match[2] || '';
      const charIndex = match.index;
      const charLength = match[0].length;
      const cleanWord = fullWord.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

      if (!cleanWord) continue;

      const hasPause = /[,.?!:;]/.test(punctuation);
      const isSentenceEnd = /[.?!]/.test(punctuation);

      const frames = this.decomposeWordToFrames(cleanWord, hasPause, isSentenceEnd);

      // Estimate realistic word duration based on syllables and phonetic weight
      const syllableCount = Math.max(1, (cleanWord.match(/[aeiouy]+/g) || []).length);
      const baseDuration = Math.max(0.24, Math.min(0.55, 0.18 + syllableCount * 0.08));
      const pauseDuration = isSentenceEnd ? 0.14 : hasPause ? 0.08 : 0.0;
      const estimatedDuration = Math.max(0.24, Math.min(0.74, (baseDuration + pauseDuration) / this.speakingRate));

      sequences.push({
        word: fullWord + punctuation,
        cleanWord,
        charIndex,
        charLength,
        hasPunctuationPause: hasPause,
        frames,
        estimatedDuration
      });
    }

    return sequences;
  }

  /**
   * Decomposes a single clean word into a sequence of viseme frames with durations and intensity.
   */
  private decomposeWordToFrames(cleanWord: string, hasPause: boolean, isSentenceEnd: boolean): VisemeFrame[] {
    // 1. Check special dictionary for exact phonetic breakdown
    if (SPECIAL_WORD_DICTIONARY[cleanWord]) {
      const template = SPECIAL_WORD_DICTIONARY[cleanWord];
      const frames: VisemeFrame[] = template.map((f) => ({ ...f }));
      if (hasPause) {
        const pauseFraction = isSentenceEnd ? 0.32 : 0.22;
        frames.forEach((f) => {
          f.durationFraction *= (1.0 - pauseFraction);
        });
        frames.push({
          viseme: 'REST',
          durationFraction: pauseFraction,
          targetIntensity: 0,
          tongue: null
        });
      }
      return frames;
    }

    // 2. Rule-based G2V decomposition
    const rawVisemes: Array<{ viseme: VisemeName; weight: number; tongue?: TongueShape }> = [];
    let idx = 0;
    const len = cleanWord.length;

    while (idx < len) {
      const sub = cleanWord.substring(idx);
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

    if (rawVisemes.length === 0) {
      rawVisemes.push({ viseme: 'Ax_E', weight: 0.35 });
    }

    // Proportional time allocation: vowels hold ~1.35x longer than stops
    const totalWeights = rawVisemes.reduce((sum, v) => {
      const isVowel = v.viseme === 'AE_AA' || v.viseme === 'AO_A' || v.viseme === 'Ax_E' || v.viseme === 'UH_OO' || v.viseme === 'UW_U';
      return sum + (isVowel ? 1.35 : 1.0);
    }, 0);

    const pauseFraction = isSentenceEnd ? 0.30 : hasPause ? 0.20 : 0.0;
    const activeFraction = 1.0 - pauseFraction;

    const frames: VisemeFrame[] = rawVisemes.map((v) => {
      const isVowel = v.viseme === 'AE_AA' || v.viseme === 'AO_A' || v.viseme === 'Ax_E' || v.viseme === 'UH_OO' || v.viseme === 'UW_U';
      const weightUnit = (isVowel ? 1.35 : 1.0) / Math.max(0.1, totalWeights);
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
   * Starts visual, silent mouth articulation for a given text message.
   * Autonomous frame and word progression drives mouth shapes without audio.
   */
  public startArticulation(text: string, onComplete?: () => void): void {
    if (onComplete) {
      this.onArticulationComplete = onComplete;
    }
    this.startSpeech(text);
  }

  /**
   * Start speech / articulation animation.
   */
  public startSpeech(text: string): void {
    this.isSpeaking = true;
    this.isPaused = false;
    this.fullUtteranceText = text;
    this.words = this.parseTextToVisemes(text);
    this.currentWordIndex = 0;
    this.currentFrameIndex = 0;
    this.wordElapsedTime = 0;
    this.boundaryReceived = false;
    this.lastBoundaryTime = performance.now();

    if (this.words.length > 0) {
      this.activeWordDuration = this.words[0].estimatedDuration;
      this.targetWeights = this.computeFrameWeights(this.words[0].frames[0]);
    }
  }

  /**
   * Word boundary event callback from speech synthesis or presentation timing.
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
        this.targetWeights = this.computeFrameWeights(activeWord.frames[0]);
      }
    }
  }

  /**
   * Stop silent articulation immediately and return mouth to natural rest position.
   */
  public stopArticulation(immediate = true): void {
    this.stopSpeech(immediate);
  }

  /**
   * Stop speech and clear all temporary viseme weights immediately.
   */
  public stopSpeech(immediate = true): void {
    this.isSpeaking = false;
    this.isPaused = false;
    this.currentWordIndex = -1;
    this.currentFrameIndex = -1;
    this.wordElapsedTime = 0;
    this.resetTargetsToRest();
    if (immediate) {
      this.currentWeights = this.createEmptyWeights();
    }
  }

  /**
   * Pause silent mouth articulation.
   */
  public pauseArticulation(): void {
    this.pauseSpeech();
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
   * Resume silent mouth articulation.
   */
  public resumeArticulation(): void {
    this.resumeSpeech();
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

  public get isArticulating(): boolean {
    return this.isSpeaking;
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
    this.targetWeights.jawCompress = 0;
    this.targetWeights.kiss = 0;
    this.targetWeights.lipSide = 0;
    this.targetWeights.lipUp = 0;
    this.targetWeights.lipDown = 0;
    this.targetWeights.lipCorner = 0;
    this.targetWeights.chin = 0;
    this.targetWeights.cheekTone = 0;
    this.targetWeights.tongueL = 0;
    this.targetWeights.tongueR = 0;
    this.targetWeights.tongueUp = 0;
    this.targetWeights.tongueBack = 0;
    this.targetWeights.tongueInterdental = 0;
    this.targetWeights.bilabialFactor = 0;
    this.targetWeights.labiodentalFactor = 0;
  }

  /**
   * Computes anatomical target weights for an individual viseme frame.
   */
  public computeFrameWeights(frame?: VisemeFrame): LipSyncWeights {
    const weights = this.createEmptyWeights();
    if (!frame || frame.viseme === 'REST') return weights;

    const motionScale = this.prefersReducedMotion ? 0.60 : 1.0;
    const intensity = frame.targetIntensity * motionScale;

    weights.visemes[frame.viseme] = intensity;

    switch (frame.viseme) {
      case 'AE_AA':
        weights.mouthOpen = 0.26 * motionScale;
        weights.lipDown = 0.16 * motionScale;
        weights.lipUp = 0.08 * motionScale;
        weights.lipSide = 0.08 * motionScale;
        weights.chin = 0.04 * motionScale;
        weights.tongueBack = 0.15 * motionScale;
        break;

      case 'AO_A':
        weights.mouthOpen = 0.28 * motionScale;
        weights.kiss = 0.16 * motionScale;
        weights.lipDown = 0.12 * motionScale;
        weights.tongueBack = 0.25 * motionScale;
        break;

      case 'Ax_E':
        weights.mouthOpen = 0.16 * motionScale;
        weights.lipSide = 0.14 * motionScale;
        weights.lipUp = 0.08 * motionScale;
        weights.lipDown = 0.08 * motionScale;
        weights.cheekTone = 0.04 * motionScale;
        break;

      case 'TD_I':
        weights.mouthOpen = 0.11 * motionScale;
        weights.jawCompress = 0.15 * motionScale;
        weights.lipSide = 0.12 * motionScale;
        weights.tongueUp = 0.40 * motionScale;
        break;

      case 'UH_OO':
        weights.mouthOpen = 0.14 * motionScale;
        weights.kiss = 0.26 * motionScale;
        weights.lipCorner = 0.12 * motionScale;
        weights.lipDown = 0.06 * motionScale;
        weights.tongueBack = 0.20 * motionScale;
        break;

      case 'UW_U':
        weights.mouthOpen = 0.09 * motionScale;
        weights.kiss = 0.36 * motionScale;
        weights.lipCorner = 0.16 * motionScale;
        weights.tongueBack = 0.30 * motionScale;
        break;

      case 'H_EST':
        weights.mouthOpen = 0.14 * motionScale;
        weights.lipSide = 0.06 * motionScale;
        break;

      case 'FV':
        weights.mouthOpen = 0.09 * motionScale;
        weights.lipDown = 0.22 * motionScale;
        weights.lipUp = 0.14 * motionScale;
        weights.chin = 0.16 * motionScale;
        weights.labiodentalFactor = 0.85 * motionScale;
        break;

      case 'S':
        weights.mouthOpen = 0.07 * motionScale;
        weights.jawCompress = 0.30 * motionScale;
        weights.lipSide = 0.18 * motionScale;
        weights.lipUp = 0.10 * motionScale;
        weights.lipDown = 0.10 * motionScale;
        weights.tongueUp = 0.35 * motionScale;
        break;

      case 'SH_CH':
        weights.mouthOpen = 0.12 * motionScale;
        weights.kiss = 0.22 * motionScale;
        weights.lipCorner = 0.12 * motionScale;
        weights.tongueUp = 0.25 * motionScale;
        break;

      case 'MPB':
        weights.mouthOpen = 0.02 * motionScale;
        weights.bilabialFactor = 1.0 * motionScale;
        weights.chin = 0.22 * motionScale;
        weights.lipCorner = 0.14 * motionScale;
        weights.lipSide = 0.04 * motionScale;
        break;

      case 'KG':
        weights.mouthOpen = 0.16 * motionScale;
        weights.tongueBack = 0.45 * motionScale;
        weights.lipSide = 0.06 * motionScale;
        break;
    }

    // Apply explicit tongue shape modifications
    if (frame.tongue) {
      switch (frame.tongue) {
        case 'L':
          weights.tongueL = 0.50 * motionScale;
          break;
        case 'R':
          weights.tongueR = 0.45 * motionScale;
          break;
        case 'UP':
          weights.tongueUp = 0.45 * motionScale;
          break;
        case 'BACK':
          weights.tongueBack = 0.45 * motionScale;
          break;
        case 'INTERDENTAL':
          weights.tongueInterdental = 0.35 * motionScale;
          break;
      }
    }

    return weights;
  }

  /**
   * Linearly blends two LipSyncWeights objects for seamless coarticulation.
   */
  private blendWeights(wA: LipSyncWeights, wB: LipSyncWeights, alpha: number): LipSyncWeights {
    const t = Math.max(0, Math.min(1, alpha));
    const result = this.createEmptyWeights();

    for (const k in result.visemes) {
      const vKey = k as VisemeName;
      result.visemes[vKey] = THREE.MathUtils.lerp(wA.visemes[vKey], wB.visemes[vKey], t);
    }

    result.mouthOpen = THREE.MathUtils.lerp(wA.mouthOpen, wB.mouthOpen, t);
    result.jawCompress = THREE.MathUtils.lerp(wA.jawCompress, wB.jawCompress, t);
    result.kiss = THREE.MathUtils.lerp(wA.kiss, wB.kiss, t);
    result.lipSide = THREE.MathUtils.lerp(wA.lipSide, wB.lipSide, t);
    result.lipUp = THREE.MathUtils.lerp(wA.lipUp, wB.lipUp, t);
    result.lipDown = THREE.MathUtils.lerp(wA.lipDown, wB.lipDown, t);
    result.lipCorner = THREE.MathUtils.lerp(wA.lipCorner, wB.lipCorner, t);
    result.chin = THREE.MathUtils.lerp(wA.chin, wB.chin, t);
    result.cheekTone = THREE.MathUtils.lerp(wA.cheekTone, wB.cheekTone, t);
    result.tongueL = THREE.MathUtils.lerp(wA.tongueL, wB.tongueL, t);
    result.tongueR = THREE.MathUtils.lerp(wA.tongueR, wB.tongueR, t);
    result.tongueUp = THREE.MathUtils.lerp(wA.tongueUp, wB.tongueUp, t);
    result.tongueBack = THREE.MathUtils.lerp(wA.tongueBack, wB.tongueBack, t);
    result.tongueInterdental = THREE.MathUtils.lerp(wA.tongueInterdental, wB.tongueInterdental, t);
    result.bilabialFactor = THREE.MathUtils.lerp(wA.bilabialFactor, wB.bilabialFactor, t);
    result.labiodentalFactor = THREE.MathUtils.lerp(wA.labiodentalFactor, wB.labiodentalFactor, t);

    return result;
  }

  /**
   * Advances the lip-sync controller animation by delta time dt with anticipatory coarticulation.
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
        let frameDuration = 0.1;
        let frameStartTime = 0;

        for (let i = 0; i < activeWord.frames.length; i++) {
          const fDuration = activeWord.frames[i].durationFraction * this.activeWordDuration;
          if (this.wordElapsedTime < accumulatedTime + fDuration) {
            selectedFrameIdx = i;
            frameDuration = fDuration;
            frameStartTime = accumulatedTime;
            break;
          }
          accumulatedTime += fDuration;
        }

        this.currentFrameIndex = selectedFrameIdx;

        // Current and upcoming frame target calculation
        const currentFrame = activeWord.frames[selectedFrameIdx];
        const currentFrameWeights = this.computeFrameWeights(currentFrame);

        // Determine next upcoming frame (across syllable or word boundary)
        let nextFrame: VisemeFrame | undefined;
        if (selectedFrameIdx < activeWord.frames.length - 1) {
          nextFrame = activeWord.frames[selectedFrameIdx + 1];
        } else if (this.currentWordIndex < this.words.length - 1) {
          nextFrame = this.words[this.currentWordIndex + 1].frames[0];
        } else {
          nextFrame = { viseme: 'REST', durationFraction: 1, targetIntensity: 0 };
        }
        const nextFrameWeights = this.computeFrameWeights(nextFrame);

        // Anticipatory Coarticulation Blend:
        // When progress within the current frame exceeds threshold, begin blending into next target
        const timeInFrame = this.wordElapsedTime - frameStartTime;
        const progressInFrame = Math.max(0, Math.min(1.0, timeInFrame / Math.max(0.01, frameDuration)));

        // Plosive & bilabial anticipation begins earlier (~40% through frame) to seal lips ahead of burst
        const isNextBilabial = nextFrame?.viseme === 'MPB';
        const isNextLabiodental = nextFrame?.viseme === 'FV';
        const anticipationThreshold = isNextBilabial ? 0.40 : isNextLabiodental ? 0.45 : 0.55;

        let anticipatoryAlpha = 0;
        if (progressInFrame > anticipationThreshold) {
          anticipatoryAlpha = (progressInFrame - anticipationThreshold) / (1.0 - anticipationThreshold);
          // Apply smooth organic ease-in for anticipatory muscle activation
          anticipatoryAlpha = Math.sin((anticipatoryAlpha * Math.PI) / 2);
        }

        this.targetWeights = this.blendWeights(currentFrameWeights, nextFrameWeights, anticipatoryAlpha);

        // Advance to next word if fallback progress completes
        if (this.wordElapsedTime >= this.activeWordDuration) {
          if (this.currentWordIndex < this.words.length - 1) {
            this.currentWordIndex++;
            this.currentFrameIndex = 0;
            this.wordElapsedTime = 0;
            this.activeWordDuration = this.words[this.currentWordIndex].estimatedDuration;
          } else {
            // End of utterance reached
            this.resetTargetsToRest();
            this.isSpeaking = false;
            if (this.onArticulationComplete) {
              const cb = this.onArticulationComplete;
              this.onArticulationComplete = null;
              cb();
            }
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
    this.currentWeights.jawCompress = THREE.MathUtils.lerp(this.currentWeights.jawCompress, this.targetWeights.jawCompress, lerpAlpha);
    this.currentWeights.kiss = THREE.MathUtils.lerp(this.currentWeights.kiss, this.targetWeights.kiss, lerpAlpha);
    this.currentWeights.lipSide = THREE.MathUtils.lerp(this.currentWeights.lipSide, this.targetWeights.lipSide, lerpAlpha);
    this.currentWeights.lipUp = THREE.MathUtils.lerp(this.currentWeights.lipUp, this.targetWeights.lipUp, lerpAlpha);
    this.currentWeights.lipDown = THREE.MathUtils.lerp(this.currentWeights.lipDown, this.targetWeights.lipDown, lerpAlpha);
    this.currentWeights.lipCorner = THREE.MathUtils.lerp(this.currentWeights.lipCorner, this.targetWeights.lipCorner, lerpAlpha);
    this.currentWeights.chin = THREE.MathUtils.lerp(this.currentWeights.chin, this.targetWeights.chin, lerpAlpha);
    this.currentWeights.cheekTone = THREE.MathUtils.lerp(this.currentWeights.cheekTone, this.targetWeights.cheekTone, lerpAlpha);
    this.currentWeights.tongueL = THREE.MathUtils.lerp(this.currentWeights.tongueL, this.targetWeights.tongueL, lerpAlpha);
    this.currentWeights.tongueR = THREE.MathUtils.lerp(this.currentWeights.tongueR, this.targetWeights.tongueR, lerpAlpha);
    this.currentWeights.tongueUp = THREE.MathUtils.lerp(this.currentWeights.tongueUp, this.targetWeights.tongueUp, lerpAlpha);
    this.currentWeights.tongueBack = THREE.MathUtils.lerp(this.currentWeights.tongueBack, this.targetWeights.tongueBack, lerpAlpha);
    this.currentWeights.tongueInterdental = THREE.MathUtils.lerp(this.currentWeights.tongueInterdental, this.targetWeights.tongueInterdental, lerpAlpha);
    this.currentWeights.bilabialFactor = THREE.MathUtils.lerp(this.currentWeights.bilabialFactor, this.targetWeights.bilabialFactor, lerpAlpha);
    this.currentWeights.labiodentalFactor = THREE.MathUtils.lerp(this.currentWeights.labiodentalFactor, this.targetWeights.labiodentalFactor, lerpAlpha);

    // Snap tiny asymptotic residuals to exactly 0 when resting to guarantee zero drift
    if (!this.isSpeaking) {
      if (this.currentWeights.mouthOpen < 0.001) this.currentWeights.mouthOpen = 0;
      if (this.currentWeights.jawCompress < 0.001) this.currentWeights.jawCompress = 0;
      if (this.currentWeights.kiss < 0.001) this.currentWeights.kiss = 0;
      if (this.currentWeights.lipSide < 0.001) this.currentWeights.lipSide = 0;
      if (this.currentWeights.lipUp < 0.001) this.currentWeights.lipUp = 0;
      if (this.currentWeights.lipDown < 0.001) this.currentWeights.lipDown = 0;
      if (this.currentWeights.lipCorner < 0.001) this.currentWeights.lipCorner = 0;
      if (this.currentWeights.chin < 0.001) this.currentWeights.chin = 0;
      if (this.currentWeights.cheekTone < 0.001) this.currentWeights.cheekTone = 0;
      if (this.currentWeights.tongueL < 0.001) this.currentWeights.tongueL = 0;
      if (this.currentWeights.tongueR < 0.001) this.currentWeights.tongueR = 0;
      if (this.currentWeights.tongueUp < 0.001) this.currentWeights.tongueUp = 0;
      if (this.currentWeights.tongueBack < 0.001) this.currentWeights.tongueBack = 0;
      if (this.currentWeights.tongueInterdental < 0.001) this.currentWeights.tongueInterdental = 0;
      if (this.currentWeights.bilabialFactor < 0.001) this.currentWeights.bilabialFactor = 0;
      if (this.currentWeights.labiodentalFactor < 0.001) this.currentWeights.labiodentalFactor = 0;
      for (const k in this.currentWeights.visemes) {
        if (this.currentWeights.visemes[k as VisemeName] < 0.001) {
          this.currentWeights.visemes[k as VisemeName] = 0;
        }
      }
    }
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
        RlipUp: findKey('RlipUp_h', 13),
        LlipUp: findKey('LlipUp_h', 14),
        RlipDown: findKey('RlipDown_h', 15),
        LlipDown: findKey('LlipDown_h', 16),
        RlipSide: findKey('RlipSide_h', 17),
        LlipSide: findKey('LlipSide_h', 18),
        RlipCorner: findKey('RlipCorner_h', 19),
        LlipCorner: findKey('LlipCorner_h', 20),
        JawCompress: findKey('JawCompress_h', 21),
        MouthOpen: findKey('MouthOpen_h', 26),
        Kiss: findKey('Kiss_h', 36),
        Rblow: findKey('Rblow_h', 37),
        Lblow: findKey('Lblow_h', 38),
        Chin: findKey('Chin_h', 39)
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
        OutMiddle_tg: findKey('OutMiddle_tg_h', 0),
        Up_tg: findKey('Up_tg_h', 6),
        Throat_In_tg: findKey('Throat_In_tg_h', 9),
        RRR_In: findKey('RRR_In_tg_h', 10),
        LLL_In: findKey('LLL_In_tg_h', 11),
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
        t_JawCompress: findKey('t_JawCompress_h', 24),
        t_MouthOpen: findKey('t_MouthOpen_h', 29)
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
    const bilabialDamp = Math.max(0.0, 1.0 - w.bilabialFactor * 0.94);

    // Calculate active speech intensity for seamless blend with expression
    let totalVisemeWeight = 0;
    for (const k in w.visemes) {
      totalVisemeWeight += w.visemes[k as VisemeName];
    }
    const speechActiveBlend = Math.min(1.0, (w.mouthOpen + w.bilabialFactor + totalVisemeWeight) * 2.5);

    // Smoothly scale base smile jaw opening during active speech so phonetic jaw opening takes precedence
    const effectiveBaseSmile = THREE.MathUtils.lerp(
      expressionBaseMouthOpen,
      expressionBaseMouthOpen * 0.65,
      speechActiveBlend
    );

    // Composite net jaw open clamped physiologically to prevent excessive stretching
    const netMouthOpen = Math.min(
      0.40,
      Math.max(0.0, (effectiveBaseSmile + w.mouthOpen) * bilabialDamp)
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
      if (map.MPB_Up !== undefined) morphs[map.MPB_Up] = w.visemes.MPB * 0.85;
      if (map.MPB_Down !== undefined) morphs[map.MPB_Down] = w.visemes.MPB * 0.85;
      if (map.KG !== undefined) morphs[map.KG] = w.visemes.KG;

      // Anatomical Jaw & Compression
      if (map.MouthOpen !== undefined) morphs[map.MouthOpen] = netMouthOpen;
      if (map.JawCompress !== undefined) morphs[map.JawCompress] = w.jawCompress;

      // Lip Rounding / Pucker for rounded vowels & postalveolars
      if (map.Kiss !== undefined) morphs[map.Kiss] = Math.min(1.0, w.kiss);

      // Fine Upper and Lower Lip Elevation / Depression
      if (map.RlipUp !== undefined) morphs[map.RlipUp] = w.lipUp;
      if (map.LlipUp !== undefined) morphs[map.LlipUp] = w.lipUp;
      if (map.RlipDown !== undefined) morphs[map.RlipDown] = w.lipDown;
      if (map.LlipDown !== undefined) morphs[map.LlipDown] = w.lipDown;

      // Subtle Lip Contouring & Corner Tension
      if (map.RlipSide !== undefined) morphs[map.RlipSide] = Math.max(0, w.lipSide);
      if (map.LlipSide !== undefined) morphs[map.LlipSide] = Math.max(0, w.lipSide);
      if (map.RlipCorner !== undefined) morphs[map.RlipCorner] = w.lipCorner;
      if (map.LlipCorner !== undefined) morphs[map.LlipCorner] = w.lipCorner;

      // Chin tension during bilabial / labiodental contact
      if (map.Chin !== undefined) morphs[map.Chin] = w.chin;

      // Cheek tone micro-movement
      if (map.Rblow !== undefined) morphs[map.Rblow] = w.cheekTone;
      if (map.Lblow !== undefined) morphs[map.Lblow] = w.cheekTone;
    }

    // Apply to Lower Teeth & Tongue Mesh (h_TeethDown)
    if (teethDownMesh && teethDownMesh.morphTargetInfluences) {
      const morphs = teethDownMesh.morphTargetInfluences;
      const map = this.teethIndexMap;

      // Lower Teeth Jaw Drop strictly follows net jaw opening
      if (map.t_MouthOpen !== undefined) morphs[map.t_MouthOpen] = netMouthOpen;
      if (map.t_JawCompress !== undefined) morphs[map.t_JawCompress] = w.jawCompress;

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
      if (map.t_MPB !== undefined) morphs[map.t_MPB] = w.visemes.MPB * 0.85;
      if (map.t_KG !== undefined) morphs[map.t_KG] = w.visemes.KG;

      // Discrete Tongue Articulation
      if (map.LLL_In !== undefined) morphs[map.LLL_In] = w.tongueL;
      if (map.RRR_In !== undefined) morphs[map.RRR_In] = w.tongueR;
      if (map.Up_tg !== undefined) morphs[map.Up_tg] = w.tongueUp;
      if (map.Throat_In_tg !== undefined) morphs[map.Throat_In_tg] = w.tongueBack;
      if (map.OutMiddle_tg !== undefined) morphs[map.OutMiddle_tg] = w.tongueInterdental;
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
    this.stopArticulation(true);
    this.words = [];
    this.onArticulationComplete = null;
  }
}
