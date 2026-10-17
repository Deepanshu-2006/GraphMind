/**
 * GraphMind Persona — Centralized Emotion Behavior Profiles & Configuration
 *
 * Defines emotion-aware behavior profiles for all Persona expressions:
 * - NEUTRAL: Calm, attentive, resting baseline with occasional natural glances away.
 * - HAPPY: Warm, approachable, gradual smile, relaxed friendly gaze, subtle eyelid softening, occasional gentle tilt.
 * - CURIOUS: Interested, attentive, slight eye openness, gaze towards point of interest, conditional head tilt.
 * - SURPRISED: Brief reaction (1.5-3s), raised brows, widened eyes, tiny head reaction, smooth return to neutral.
 * - SAD: Quiet, subdued, lowered gaze, softer eyelids, restrained head movement, slow transition.
 * - ANGRY: Serious, focused, steady gaze with suppressed look-away, inner brow furrow, restrained posture.
 * - WORRIED: Uncertain, tense, inner brow lift, apprehensive eye openness, clenched dental alignment without lip clipping.
 */

export type PersonaExpression =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'thinking'
  | 'curious'
  | 'worried';

export type ExpressionPhase =
  | 'HOLDING'
  | 'ANTICIPATING'
  | 'TRANSITIONING'
  | 'SETTLING';

export interface EmotionBehaviorProfile {
  expression: PersonaExpression;

  // Emotional Timing (Section 4)
  holdDurationMin: number;
  holdDurationMax: number;
  transitionDurationMin: number;
  transitionDurationMax: number;

  // Subtle Anticipation & Settling Timing (Section 5)
  anticipationDuration: number; // Seconds: eyes/gaze lead before full facial morph
  settlingDuration: number;     // Seconds: posture settles into resting pose post-morph

  // Coordinated Gaze Behavior (Section 2 & 6)
  gazeEngagementMin: number;    // How long to comfortably maintain gaze before glance-away
  gazeEngagementMax: number;
  suppressAutonomousGaze: boolean; // Suppress or minimize glance-away (e.g. angry, surprised)
  gazePitchOffset: number;      // Vertical gaze bias (e.g. -0.12 for sad downward gaze)
  gazeYawOffset: number;        // Horizontal gaze bias
  gazeMicroTremorScale: number; // Tremor damping during intense focus

  // Eyelid & Morph Tuning (Section 2 & 8)
  eyeOpenBonus: number;         // Aperture modifier (+ for alert/wide, - for softened/subdued)
  squintBonus: number;          // Lower lid / Duchenne smile engagement

  // Coordinated Head Posture & Movement (Section 2 & 7)
  headTiltRoll: number;         // Roll in radians (e.g. +0.012 for happy, -0.024 for curious)
  headTiltPitch: number;        // Pitch in radians (e.g. +0.016 for sad droop, -0.015 for surprised lift)
  headTiltChance: number;       // Probability that head tilt occurs on a given occurrence
  headDriftScale: number;       // Micro-drift scale (restrained 0.35-0.38 for sad/angry, 1.0 for neutral)

  // Breathing Modulation (Section 8)
  breathingAmplitudeScale: number; // Subtly scales upper chest / shoulder excursion

  // Natural Progression Weighting (Section 4 & 9)
  selectionWeight: number;      // Relative probability when selecting next emotion from neutral
}

export const EMOTION_BEHAVIOR_PROFILES: Record<PersonaExpression, EmotionBehaviorProfile> = {
  neutral: {
    expression: 'neutral',
    holdDurationMin: 3.0,
    holdDurationMax: 6.0, // Section 4: hold 3-6s between selected expressions
    transitionDurationMin: 0.95,
    transitionDurationMax: 1.25,
    anticipationDuration: 0.0,
    settlingDuration: 0.30,

    gazeEngagementMin: 6.0,
    gazeEngagementMax: 10.0,
    suppressAutonomousGaze: false,
    gazePitchOffset: 0.0,
    gazeYawOffset: 0.0,
    gazeMicroTremorScale: 1.0,

    eyeOpenBonus: 0.0,
    squintBonus: 0.0,

    headTiltRoll: 0.0,
    headTiltPitch: 0.0,
    headTiltChance: 0.0,
    headDriftScale: 1.0, // Full natural organic baseline drift

    breathingAmplitudeScale: 1.0,
    selectionWeight: 0 // Resting state returned to between emotions
  },

  happy: {
    expression: 'happy',
    holdDurationMin: 4.0,
    holdDurationMax: 7.0, // Section 4: hold 4-7s
    transitionDurationMin: 1.10,
    transitionDurationMax: 1.45, // Section 4: smile develops gradually
    anticipationDuration: 0.28,  // Section 5: gaze settles toward viewer, mouth forms smile
    settlingDuration: 0.35,

    gazeEngagementMin: 8.0,
    gazeEngagementMax: 13.0,     // Section 2: maintain eye contact for slightly longer periods
    suppressAutonomousGaze: false,
    gazePitchOffset: 0.0,
    gazeYawOffset: 0.0,
    gazeMicroTremorScale: 0.95,

    eyeOpenBonus: -0.03,         // Section 2: slightly soften eyelids
    squintBonus: 0.14,           // Duchenne smile softness

    headTiltRoll: 0.012,         // Section 2: small, natural head tilt occasionally
    headTiltPitch: -0.006,
    headTiltChance: 0.60,        // Not every single time
    headDriftScale: 0.85,

    breathingAmplitudeScale: 1.0,
    selectionWeight: 35          // Warm and friendly, primary positive state
  },

  curious: {
    expression: 'curious',
    holdDurationMin: 3.0,
    holdDurationMax: 5.0, // Section 4: hold 3-5s
    transitionDurationMin: 0.90,
    transitionDurationMax: 1.20, // Section 4: curiosity emerges through subtle change in eyes
    anticipationDuration: 0.25,  // Section 5: eyes become attentive first, slight head tilt follows
    settlingDuration: 0.35,

    gazeEngagementMin: 7.0,
    gazeEngagementMax: 11.0,
    suppressAutonomousGaze: false,
    gazePitchOffset: 0.03,
    gazeYawOffset: 0.04,
    gazeMicroTremorScale: 0.80,

    eyeOpenBonus: 0.06,          // Section 2: slightly increase eye openness if supported
    squintBonus: 0.0,

    headTiltRoll: -0.024,        // Inquisitive head tilt
    headTiltPitch: 0.010,
    headTiltChance: 0.65,        // Section 2: head tilt should not occur every time curious appears
    headDriftScale: 0.80,

    breathingAmplitudeScale: 0.98,
    selectionWeight: 30          // Interested and attentive, primary cognitive state
  },

  thinking: {
    // Alias / cognitive variant of curious
    expression: 'thinking',
    holdDurationMin: 3.0,
    holdDurationMax: 5.0,
    transitionDurationMin: 0.90,
    transitionDurationMax: 1.20,
    anticipationDuration: 0.25,
    settlingDuration: 0.35,

    gazeEngagementMin: 7.0,
    gazeEngagementMax: 11.0,
    suppressAutonomousGaze: false,
    gazePitchOffset: 0.03,
    gazeYawOffset: 0.04,
    gazeMicroTremorScale: 0.80,

    eyeOpenBonus: 0.06,
    squintBonus: 0.0,

    headTiltRoll: -0.024,
    headTiltPitch: 0.010,
    headTiltChance: 0.65,
    headDriftScale: 0.80,

    breathingAmplitudeScale: 0.98,
    selectionWeight: 30
  },

  surprised: {
    expression: 'surprised',
    holdDurationMin: 1.5,
    holdDurationMax: 3.0, // Section 4: hold 1.5-3s (brief reaction!)
    transitionDurationMin: 0.50,
    transitionDurationMax: 0.75, // Section 4: slightly faster while remaining smooth
    anticipationDuration: 0.18,  // Section 5: eyes widen, brows rise, tiny head reaction follows
    settlingDuration: 0.25,

    gazeEngagementMin: 6.0,
    gazeEngagementMax: 9.0,
    suppressAutonomousGaze: true, // Focused brief reaction
    gazePitchOffset: 0.02,
    gazeYawOffset: 0.0,
    gazeMicroTremorScale: 1.10,

    eyeOpenBonus: 0.18,          // Section 2: widen eyes within realistic limits
    squintBonus: 0.0,

    headTiltRoll: 0.004,
    headTiltPitch: -0.015,       // Section 2: tiny head reaction lift without jerk
    headTiltChance: 0.50,
    headDriftScale: 0.90,

    breathingAmplitudeScale: 1.05,
    selectionWeight: 10          // Brief occasional reaction
  },

  sad: {
    expression: 'sad',
    holdDurationMin: 3.0,
    holdDurationMax: 5.0, // Section 4: hold 3-5s
    transitionDurationMin: 1.25,
    transitionDurationMax: 1.60, // Section 4: sadness develops slowly
    anticipationDuration: 0.32,  // Section 5: gaze lowers slightly first, expression gradually develops
    settlingDuration: 0.40,

    gazeEngagementMin: 3.5,
    gazeEngagementMax: 6.0,      // Breaks gaze sooner
    suppressAutonomousGaze: false,
    gazePitchOffset: -0.12,      // Section 2: lower gaze modestly
    gazeYawOffset: 0.0,
    gazeMicroTremorScale: 0.60,

    eyeOpenBonus: -0.06,         // Section 2: softer eyelid positioning
    squintBonus: 0.04,

    headTiltRoll: -0.005,
    headTiltPitch: 0.018,        // Slight reflective downward head droop without slumping
    headTiltChance: 0.80,
    headDriftScale: 0.38,        // Section 2 & 7: reduce unnecessary head movement (subdued)

    breathingAmplitudeScale: 0.92,
    selectionWeight: 10          // Quiet and subdued, occasional
  },

  angry: {
    expression: 'angry',
    holdDurationMin: 2.0,
    holdDurationMax: 4.0, // Section 4: hold 2-4s
    transitionDurationMin: 1.00,
    transitionDurationMax: 1.35, // Section 4: coordinated eyebrow, eye, mouth changes
    anticipationDuration: 0.26,  // Section 5: gaze becomes focused, eyebrows lower, settles without aggression
    settlingDuration: 0.35,

    gazeEngagementMin: 16.0,
    gazeEngagementMax: 26.0,     // Section 2: maintain steady gaze, reduce look-away
    suppressAutonomousGaze: true,// Suppress look-away to maintain serious focus
    gazePitchOffset: 0.0,
    gazeYawOffset: 0.0,
    gazeMicroTremorScale: 0.45,

    eyeOpenBonus: -0.06,
    squintBonus: 0.10,           // Focused furrow

    headTiltRoll: 0.0,
    headTiltPitch: -0.004,
    headTiltChance: 0.0,         // Steady posture
    headDriftScale: 0.35,        // Section 2 & 7: head movement restrained

    breathingAmplitudeScale: 0.96,
    selectionWeight: 8           // Controlled serious focus, occasional
  },

  worried: {
    expression: 'worried',
    holdDurationMin: 2.5,
    holdDurationMax: 4.0, // Section 4: hold 2.5-4s
    transitionDurationMin: 1.10,
    transitionDurationMax: 1.35,
    anticipationDuration: 0.24,  // Inner brow raises, eyes widen
    settlingDuration: 0.35,

    gazeEngagementMin: 5.0,
    gazeEngagementMax: 8.0,
    suppressAutonomousGaze: false,
    gazePitchOffset: 0.02,
    gazeYawOffset: -0.04,        // Section 2: brief, subtle gaze shift
    gazeMicroTremorScale: 1.15,

    eyeOpenBonus: 0.12,          // Section 2: widen eyes within rig's limits
    squintBonus: 0.0,

    headTiltRoll: 0.008,
    headTiltPitch: -0.008,
    headTiltChance: 0.60,
    headDriftScale: 0.60,        // Section 2: keep head movement small

    breathingAmplitudeScale: 1.02,
    selectionWeight: 7           // Occasional
  }
};

/**
 * Retrieve emotion profile safely with fallback to neutral.
 */
export function getEmotionProfile(expr: PersonaExpression): EmotionBehaviorProfile {
  return EMOTION_BEHAVIOR_PROFILES[expr] || EMOTION_BEHAVIOR_PROFILES.neutral;
}

/**
 * Weighted, natural next emotion selection from neutral resting state.
 * Avoids repeating the immediate prior emotion, ensuring lifelike presence.
 */
export function pickNextNaturalEmotion(previousEmotion?: PersonaExpression): PersonaExpression {
  const candidates: { expr: PersonaExpression; weight: number }[] = [
    { expr: 'happy', weight: EMOTION_BEHAVIOR_PROFILES.happy.selectionWeight },
    { expr: 'curious', weight: EMOTION_BEHAVIOR_PROFILES.curious.selectionWeight },
    { expr: 'surprised', weight: EMOTION_BEHAVIOR_PROFILES.surprised.selectionWeight },
    { expr: 'sad', weight: EMOTION_BEHAVIOR_PROFILES.sad.selectionWeight },
    { expr: 'angry', weight: EMOTION_BEHAVIOR_PROFILES.angry.selectionWeight },
    { expr: 'worried', weight: EMOTION_BEHAVIOR_PROFILES.worried.selectionWeight }
  ];

  // Exclude previous emotion to avoid immediate repetition
  const filtered = candidates.filter((c) => c.expr !== previousEmotion && (previousEmotion !== 'thinking' || c.expr !== 'curious'));
  const pool = filtered.length > 0 ? filtered : candidates;

  const totalWeight = pool.reduce((sum, c) => sum + c.weight, 0);
  let roll = Math.random() * totalWeight;

  for (const item of pool) {
    if (roll < item.weight) {
      return item.expr;
    }
    roll -= item.weight;
  }

  return 'happy';
}

/**
 * Complete emotion state output for downstream systems.
 */
export interface ExpressionStateInfo {
  currentExpr: PersonaExpression;
  targetExpr: PersonaExpression;
  activeExpr: PersonaExpression;
  phase: ExpressionPhase;
  phaseProgress: number;       // 0 to 1
  transitionProgress: number;  // 0 to 1 overall progress from source to target
  expressionWeight: number;    // 0 to 1 target emotion intensity
  anticipationWeight: number;  // 0 to 1 active during anticipation
  settlingWeight: number;      // 0 to 1 active during settling
  isNeutral: boolean;
  headTiltRoll: number;        // Computed roll offset in radians for current occurrence
  headTiltPitch: number;       // Computed pitch offset in radians for current occurrence
  profile: EmotionBehaviorProfile;
}
