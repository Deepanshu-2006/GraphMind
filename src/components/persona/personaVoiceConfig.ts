/**
 * GraphMind Persona — Centralized Voice Configuration & Acoustic Identity
 *
 * Defines the vocal identity for the GraphMind Persona:
 * - Natural, calm, intelligent, composed, and welcoming.
 * - Masculine tone matching the Persona 3D humanoid character (Asian young man).
 * - Multi-tiered voice preference prioritizing Asian English male voices (e.g. Rishi, Ravi),
 *   falling back cleanly to articulate, calm male voices (e.g. Google UK English Male, Daniel, Aaron),
 *   and system defaults.
 * - Clean text preprocessing and natural sentence pacing without altering original text.
 */

export interface PersonaVoiceConfig {
  speakingRate: number;      // Calm, articulate cadence (0.94)
  pitch: number;             // Resonant, warm, grounded male tone (0.96)
  volume: number;            // Clear, present delivery (1.0)
  lang: string;              // Primary language code ('en-US')
  preferredVoiceNames: string[];
  preferredAsianVoiceKeywords: string[];
  preferredMaleKeywords: string[];
  disallowedVoiceKeywords: string[];
}

export const GRAPHMIN_VOICE_CONFIG: PersonaVoiceConfig = {
  // Pacing: slightly measured (0.94) — thoughtful, intellectual, never rushed or sluggish
  speakingRate: 0.94,

  // Pitch: warm, grounded masculine resonance (0.96) — avoids robotic highs and cartoon bass
  pitch: 0.96,

  // Volume: balanced, clear, unclipped delivery
  volume: 1.0,

  // Default target language
  lang: 'en-US',

  // 1. Specific preferred voice names (cross-platform prioritization)
  preferredVoiceNames: [
    // High-priority Asian English male voices (macOS, Windows Edge, Android, Chrome)
    'Rishi',                                                    // macOS / iOS (English - India, warm articulate young male)
    'Microsoft Ravi Online (Natural) - English (India)',        // Windows / Edge Natural
    'Microsoft Prabhat Online (Natural) - English (India)',     // Windows / Edge Natural
    'Microsoft Wayne Online (Natural) - English (Hong Kong)',   // Windows / Edge Natural
    'Microsoft James Online (Natural) - English (Singapore)',   // Windows / Edge Natural
    'Google English (India)',                                   // Chrome / Android
    'Google हिन्दी',

    // Calm, intelligent, articulate male voices (universal fallback)
    'Google UK English Male',                                   // Chrome desktop built-in
    'Daniel',                                                   // macOS / iOS (calm, intellectual, articulate)
    'Aaron',                                                    // macOS (young calm male)
    'Microsoft Guy Online (Natural) - English (United States)', // Windows / Edge Natural
    'Microsoft Ryan Online (Natural) - English (United Kingdom)',
    'Microsoft George',
    'Alex'                                                      // macOS classic male
  ],

  // 2. Keywords indicating Asian English regional male profiles
  preferredAsianVoiceKeywords: [
    'rishi',
    'ravi',
    'prabhat',
    'wayne',
    'james',
    'india',
    'singapore',
    'hong kong'
  ],

  // 3. Keywords indicating male vocal identity
  preferredMaleKeywords: [
    'male',
    'rishi',
    'ravi',
    'prabhat',
    'wayne',
    'james',
    'daniel',
    'aaron',
    'guy',
    'ryan',
    'george',
    'alex',
    'david',
    'mark',
    'oliver'
  ],

  // 4. Female keywords to filter out when seeking a male persona voice
  disallowedVoiceKeywords: [
    'female',
    'woman',
    'girl',
    'samantha',
    'victoria',
    'zira',
    'karen',
    'fiona',
    'moira',
    'tessa',
    'veena',
    'priya',
    'neerja',
    'catherine',
    'hazel',
    'susan',
    'jenny'
  ]
};

/**
 * Technical abbreviations that should be spoken as distinct letters rather than words.
 */
const SPOKEN_ACRONYMS = new Set([
  'CPU', 'GPU', 'RAM', 'ROM', 'API', 'OS', 'UI', 'UX', 'AI', 'ML',
  'URL', 'HTML', 'CSS', 'JSON', 'SQL', 'SDK', 'HTTP', 'HTTPS', 'REST',
  'DOM', 'AST', 'IDE', 'CLI', 'LAN', 'WAN', 'DNS', 'IP', 'TCP', 'UDP'
]);

/**
 * Prepares raw text for natural, human-paced spoken delivery.
 *
 * Rules:
 * 1. Preserves original content and meaning without arbitrary rewriting.
 * 2. Strips markdown syntax (headers, asterisks, brackets, backticks, URLs).
 * 3. Handles sentence boundaries and punctuation (em-dashes, ellipses, colons) to introduce natural vocal breath pauses.
 * 4. Preserves technical acronyms in uppercase so speech engines spell them cleanly.
 * 5. Normalizes whitespace and removes unpronounceable symbols.
 */
export function prepareTextForSpeech(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';

  let text = rawText.trim();
  if (!text) return '';

  // 1. Remove Markdown links: [display text](http://...) -> display text
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');

  // 2. Remove code blocks and inline code backticks: `code` -> code
  text = text.replace(/```[\s\S]*?```/g, '');
  text = text.replace(/`([^`]+)`/g, '$1');

  // 3. Remove Markdown bold/italic: **bold**, *italic*, __underline__, _italic_, ~~strike~~
  text = text.replace(/(\*\*|__)(.*?)\1/g, '$2');
  text = text.replace(/(\*|_)(.*?)\1/g, '$2');
  text = text.replace(/~~(.*?)~~/g, '$1');

  // 4. Handle Markdown headers (# Header -> Header.) and list bullets
  text = text.replace(/^#+\s*(.*?)$/gm, (_m, headerContent) => {
    const cleanHeader = headerContent.trim();
    if (!cleanHeader) return '';
    return /[.?!]$/.test(cleanHeader) ? cleanHeader : `${cleanHeader}.`;
  });
  text = text.replace(/^[>*\-+]\s*/gm, '');

  // 5. Replace em-dashes and en-dashes with comma pauses for natural cadence
  text = text.replace(/\s*[—–]\s*/g, ', ');

  // 6. Replace ellipses (...) with a period and space for clean sentence boundary
  text = text.replace(/\.{3,}/g, '. ');

  // 7. Replace colons and semicolons with commas to promote natural sentence rhythm
  text = text.replace(/[:;]\s*/g, ', ');

  // 8. Expand common brand/abbreviation pronunciations if helpful
  text = text.replace(/\bGraphMind\b/g, 'GraphMind');

  // 9. Capitalize recognized technical acronyms
  text = text.replace(/\b[a-zA-Z]{2,5}\b/g, (match) => {
    const upper = match.toUpperCase();
    if (SPOKEN_ACRONYMS.has(upper)) {
      return upper;
    }
    return match;
  });

  // 10. Clean up multiple spaces, duplicate commas, or orphan punctuation
  text = text.replace(/,\s*,+/g, ',');
  text = text.replace(/\s+/g, ' ');
  text = text.replace(/\s*([,.?!])\s*/g, '$1 ');

  return text.trim();
}

/**
 * Standard test sentences required for development voice quality verification.
 */
export const PERSONA_TEST_SENTENCES = [
  'Hey, welcome to GraphMind.',
  'Please revise your Operating Systems concepts.',
  'Practice makes progress.',
  'GraphMind helps you understand what you learn.',
  'Peter bought a beautiful blue book.',
  'Welcome to GraphMind. We hope you enjoy learning.',
  'Five clever students studied computer science.',
  'Hey, welcome back! You’ve made great progress. Let’s revise one more concept together.',
  'GraphMind helps you master complex computer science concepts through structured knowledge graphs. When you revise regularly, your understanding deepens and retention improves naturally over time.'
] as const;

export const PERSONA_GREETING_TEXT = PERSONA_TEST_SENTENCES[0];

export type PersonaTestSentenceIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const ULTRA_REALISTIC_TEST_SENTENCES = {
  testA_lipClosure: 'Peter bought a beautiful blue book.',
  testB_roundedVowels: 'Welcome to GraphMind. We hope you enjoy learning.',
  testC_mixedArticulation: 'Five clever students studied computer science.',
  testD_naturalSentence: 'Hey, welcome back! You’ve made great progress. Let’s revise one more concept together.',
  testE_longSpeech: 'GraphMind helps you master complex computer science concepts through structured knowledge graphs. When you revise regularly, your understanding deepens and retention improves naturally over time.'
} as const;
