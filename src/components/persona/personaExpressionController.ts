import * as THREE from 'three';
import {
  type PersonaExpression,
  type ExpressionPhase,
  type EmotionBehaviorProfile,
  type ExpressionStateInfo,
  EMOTION_BEHAVIOR_PROFILES,
  getEmotionProfile,
  pickNextNaturalEmotion
} from './personaEmotionProfiles';

export {
  type PersonaExpression,
  type ExpressionPhase,
  type EmotionBehaviorProfile,
  type ExpressionStateInfo,
  EMOTION_BEHAVIOR_PROFILES,
  getEmotionProfile,
  pickNextNaturalEmotion
};

export interface FacialMorphWeights {
  head: Record<number, number>;
  teethDown: Record<number, number>;
}

/**
 * Predefined anatomical morph target weights for all Persona expressions.
 * Head indices map to H_DDS_HighRes (65 morph targets).
 * TeethDown indices map to h_TeethDown (31 morph targets).
 */
export const PERSONA_EXPRESSION_PRESETS: Record<PersonaExpression, FacialMorphWeights> = {
  neutral: {
    head: {
      26: 0.22, // MouthOpen_h
      30: 0.20, // RsmileOpen_h
      31: 0.20, // LsmileOpen_h
      47: 0.32, // ReyeOpen_h
      48: 0.32, // LeyeOpen_h
      13: 0.06, // RlipUp_h
      14: 0.06, // LlipUp_h
      15: 0.06, // RlipDown_h
      16: 0.06  // LlipDown_h
    },
    teethDown: {
      29: 0.22  // t_MouthOpen_h
    }
  },

  happy: {
    head: {
      26: 0.28, // MouthOpen_h
      30: 0.58, // RsmileOpen_h
      31: 0.58, // LsmileOpen_h
      19: 0.22, // RlipCorner_h
      20: 0.22, // LlipCorner_h
      13: 0.14, // RlipUp_h
      14: 0.14, // LlipUp_h
      15: 0.12, // RlipDown_h
      16: 0.12, // LlipDown_h
      47: 0.22, // ReyeOpen_h
      48: 0.22, // LeyeOpen_h
      49: 0.26, // Rsquint_h
      50: 0.26, // Lsquint_h
      51: 0.18, // RlowLid_h
      52: 0.18, // LlowLid_h
      57: 0.08, // RRbrowUp_h
      60: 0.08, // LLbrowUp_h
      39: 0.10  // Chin_h
    },
    teethDown: {
      29: 0.28  // t_MouthOpen_h
    }
  },

  curious: {
    head: {
      26: 0.08, // MouthOpen_h
      17: 0.18, // RlipSide_h
      28: 0.14, // RsmileClose_h
      29: 0.04, // LsmileClose_h
      47: 0.36, // ReyeOpen_h
      48: 0.28, // LeyeOpen_h
      49: 0.08, // Rsquint_h
      50: 0.18, // Lsquint_h
      58: 0.44, // RbrowUp_h (inquisitive right brow lift)
      57: 0.34, // RRbrowUp_h
      63: 0.20, // LbrowDown_h (subtle thoughtful left brow drop)
      64: 0.14, // LLbrowDown_h
      39: 0.12  // Chin_h
    },
    teethDown: {
      29: 0.08  // t_MouthOpen_h
    }
  },

  thinking: {
    head: {
      26: 0.08, // MouthOpen_h
      17: 0.18, // RlipSide_h
      28: 0.14, // RsmileClose_h
      29: 0.04, // LsmileClose_h
      47: 0.36, // ReyeOpen_h
      48: 0.28, // LeyeOpen_h
      49: 0.08, // Rsquint_h
      50: 0.18, // Lsquint_h
      58: 0.44, // RbrowUp_h
      57: 0.34, // RRbrowUp_h
      63: 0.20, // LbrowDown_h
      64: 0.14, // LLbrowDown_h
      39: 0.12  // Chin_h
    },
    teethDown: {
      29: 0.08  // t_MouthOpen_h
    }
  },

  sad: {
    head: {
      26: 0.08, // MouthOpen_h
      32: 0.50, // RmouthSad_h
      33: 0.50, // LmouthSad_h
      15: 0.08, // RlipDown_h
      16: 0.08, // LlipDown_h
      47: 0.16, // ReyeOpen_h
      48: 0.16, // LeyeOpen_h
      53: 0.40, // Rsad_h
      54: 0.40, // Lsad_h
      55: 0.32, // Rpityful_h
      56: 0.32, // Lpityful_h
      58: 0.46, // RbrowUp_h (inner brow raised)
      59: 0.46, // LbrowUp_h
      61: 0.22, // RRbrowDown_h (outer brow dipped)
      64: 0.22, // LLbrowDown_h
      39: 0.18  // Chin_h
    },
    teethDown: {
      29: 0.08  // t_MouthOpen_h
    }
  },

  angry: {
    head: {
      21: 0.32, // JawCompress_h
      26: 0.04, // MouthOpen_h
      47: 0.12, // ReyeOpen_h
      48: 0.12, // LeyeOpen_h
      49: 0.42, // Rsquint_h
      50: 0.42, // Lsquint_h
      51: 0.26, // RlowLid_h
      52: 0.26, // LlowLid_h
      62: 0.64, // RbrowDown_h (intense inner brow furrow)
      63: 0.64, // LbrowDown_h
      61: 0.30, // RRbrowDown_h
      64: 0.30, // LLbrowDown_h
      43: 0.22, // Rnostril_h
      44: 0.22, // Lnostril_h
      41: 0.16, // RneckTension_h
      42: 0.16  // LneckTension_h
    },
    teethDown: {
      24: 0.32, // t_JawCompress_h
      29: 0.04  // t_MouthOpen_h
    }
  },

  surprised: {
    head: {
      26: 0.50, // MouthOpen_h
      1: 0.24,  // AO_a_h
      13: 0.12, // RlipUp_h
      14: 0.12, // LlipUp_h
      15: 0.20, // RlipDown_h
      16: 0.20, // LlipDown_h
      47: 0.60, // ReyeOpen_h (wide alert eyes)
      48: 0.60, // LeyeOpen_h
      58: 0.68, // RbrowUp_h (high raised eyebrows)
      59: 0.68, // LbrowUp_h
      57: 0.56, // RRbrowUp_h
      60: 0.56  // LLbrowUp_h
    },
    teethDown: {
      29: 0.50, // t_MouthOpen_h
      13: 0.24  // t_AO_a_h
    }
  },

  worried: {
    head: {
      8: 0.62,  // S_h (bared teeth grimace with horizontal lip retraction)
      13: 0.56, // RlipUp_h (upper lip retracted high, baring upper teeth row)
      14: 0.56, // LlipUp_h
      15: 0.58, // RlipDown_h (lower lip pulled down, baring lower teeth row)
      16: 0.58, // LlipDown_h
      17: 0.36, // RlipSide_h (stretches mouth corners wide horizontally)
      18: 0.36, // LlipSide_h
      32: 0.48, // RmouthSad_h (pulls mouth corners down into anxious grimace)
      33: 0.48, // LmouthSad_h
      21: 0.35, // JawCompress_h (keeps teeth firmly clenched/gritted together)
      26: 0.08, // MouthOpen_h (slight separation so lips part over clenched teeth)
      39: 0.32, // Chin_h (chin tension under strained lower lip)
      47: 0.65, // ReyeOpen_h (wide anxious, apprehensive eyes)
      48: 0.65, // LeyeOpen_h
      53: 0.26, // Rsad_h (apprehensive brow curve)
      54: 0.26, // Lsad_h
      58: 0.78, // RbrowUp_h (high inner brow lift with intense worry/cringe)
      59: 0.78, // LbrowUp_h
      57: 0.50, // RRbrowUp_h (mid-outer brow arch)
      60: 0.50, // LLbrowUp_h
      61: 0.18, // RRbrowDown_h (outer brow tension)
      64: 0.18, // LLbrowDown_h
      41: 0.28, // RneckTension_h
      42: 0.28, // LneckTension_h
      43: 0.18, // Rnostril_h
      44: 0.18  // Lnostril_h
    },
    teethDown: {
      24: 0.35, // t_JawCompress_h (clenched dental bite)
      20: 0.45, // t_S_h (phonetic alignment for clenched teeth)
      29: 0.06  // t_MouthOpen_h (minimal jaw opening to keep teeth touching)
    }
  }
};

/**
 * Standard progression sequence for backwards compatibility with tests.
 */
export const AUTOMATIC_EXPRESSION_SEQUENCE: PersonaExpression[] = [
  'neutral',
  'happy',
  'neutral',
  'thinking',
  'neutral',
  'surprised',
  'neutral',
  'worried',
  'neutral',
  'sad',
  'neutral',
  'angry'
];

export interface ExpressionControllerConfig {
  forcedExpression?: PersonaExpression | null;
  reducedMotion?: boolean;
}

export class PersonaExpressionController {
  private currentExpr: PersonaExpression = 'neutral';
  private targetExpr: PersonaExpression = 'neutral';
  private lastNonNeutralExpr: PersonaExpression = 'neutral';

  private fromWeightsHead: number[] = new Array(65).fill(0);
  private toWeightsHead: number[] = new Array(65).fill(0);
  private currentWeightsHead: number[] = new Array(65).fill(0);

  private fromWeightsTeeth: number[] = new Array(31).fill(0);
  private toWeightsTeeth: number[] = new Array(31).fill(0);
  private currentWeightsTeeth: number[] = new Array(31).fill(0);

  // Transition Phase State Machine
  private phase: ExpressionPhase = 'HOLDING';
  private phaseTimer = 0;
  private anticipationDuration = 0;
  private transitionProgress = 1.0;
  private transitionDuration = 1.0;
  private settlingDuration = 0;
  private holdTimer = 0;
  private holdDuration = 4.0;

  // Emotion-Specific Head Posture for Current Occurrence
  private activeTiltRoll = 0;
  private activeTiltPitch = 0;

  // Config & Flags
  private forcedExpression: PersonaExpression | null = null;
  private reducedMotion = false;

  constructor(config?: ExpressionControllerConfig) {
    this.forcedExpression = config?.forcedExpression || null;
    this.reducedMotion = config?.reducedMotion || false;

    const initial = this.forcedExpression || 'neutral';
    this.currentExpr = initial;
    this.targetExpr = initial;
    this.copyPresetToTarget(initial);
    this.currentWeightsHead = [...this.toWeightsHead];
    this.currentWeightsTeeth = [...this.toWeightsTeeth];
    this.fromWeightsHead = [...this.toWeightsHead];
    this.fromWeightsTeeth = [...this.toWeightsTeeth];

    this.phase = 'HOLDING';
    this.holdDuration = this.getHoldDuration(initial);
  }

  private copyPresetToTarget(expr: PersonaExpression) {
    const preset = PERSONA_EXPRESSION_PRESETS[expr] || PERSONA_EXPRESSION_PRESETS.neutral;
    this.toWeightsHead.fill(0);
    this.toWeightsTeeth.fill(0);

    for (const [idxStr, val] of Object.entries(preset.head)) {
      const idx = Number(idxStr);
      if (idx >= 0 && idx < 65) {
        this.toWeightsHead[idx] = val;
      }
    }
    for (const [idxStr, val] of Object.entries(preset.teethDown)) {
      const idx = Number(idxStr);
      if (idx >= 0 && idx < 31) {
        this.toWeightsTeeth[idx] = val;
      }
    }
  }

  public getHoldDuration(expr: PersonaExpression): number {
    const profile = getEmotionProfile(expr);
    const range = profile.holdDurationMax - profile.holdDurationMin;
    return profile.holdDurationMin + Math.random() * Math.max(0, range);
  }

  public getTransitionDuration(toExpr: PersonaExpression): number {
    const profile = getEmotionProfile(toExpr);
    const range = profile.transitionDurationMax - profile.transitionDurationMin;
    return profile.transitionDurationMin + Math.random() * Math.max(0, range);
  }

  /**
   * Set target expression with optional explicit transition duration.
   * Gracefully blends from wherever the face currently is without snapping.
   */
  public setExpression(expr: PersonaExpression, duration?: number) {
    // Alias thinking to curious or vice-versa
    const normalizedExpr: PersonaExpression = expr === 'curious' ? 'thinking' : expr;
    const currentNormalized = this.targetExpr === 'curious' ? 'thinking' : this.targetExpr;

    if (normalizedExpr === currentNormalized && this.phase === 'HOLDING') return;

    this.fromWeightsHead = [...this.currentWeightsHead];
    this.fromWeightsTeeth = [...this.currentWeightsTeeth];
    this.currentExpr = this.targetExpr;
    this.targetExpr = normalizedExpr;
    this.copyPresetToTarget(normalizedExpr);

    const profile = getEmotionProfile(normalizedExpr);
    const hasExplicitDuration = duration !== undefined;
    this.transitionDuration = Math.max(0.1, duration ?? this.getTransitionDuration(normalizedExpr));

    // Anticipation applies during natural transitions without explicit override duration
    this.anticipationDuration = (hasExplicitDuration || normalizedExpr === 'neutral' || this.reducedMotion || this.forcedExpression)
      ? 0.0
      : profile.anticipationDuration;
    this.settlingDuration = hasExplicitDuration ? 0.0 : profile.settlingDuration;

    // Evaluate head tilt probability for this specific occurrence (Section 2 & 7)
    const rollTilt = Math.random() < profile.headTiltChance;
    this.activeTiltRoll = rollTilt ? profile.headTiltRoll : 0;
    this.activeTiltPitch = rollTilt ? profile.headTiltPitch : 0;

    // Start with anticipation if applicable, otherwise transition directly
    if (this.anticipationDuration > 0.05) {
      this.phase = 'ANTICIPATING';
      this.phaseTimer = 0;
      this.transitionProgress = 0.0;
    } else {
      this.phase = 'TRANSITIONING';
      this.phaseTimer = 0;
      this.transitionProgress = 0.0;
    }
  }

  public getCurrentExpression(): PersonaExpression {
    return this.targetExpr;
  }

  public getPhase(): ExpressionPhase {
    return this.phase;
  }

  /**
   * Returns complete expression state for coordinated gaze, head posture, and timing.
   */
  public getStateInfo(): ExpressionStateInfo {
    const profile = getEmotionProfile(this.targetExpr);
    let expressionWeight = 0;
    let anticipationWeight = 0;
    let settlingWeight = 0;

    if (this.phase === 'ANTICIPATING') {
      anticipationWeight = this.anticipationDuration > 0
        ? Math.min(1.0, this.phaseTimer / this.anticipationDuration)
        : 0;
      expressionWeight = anticipationWeight * 0.12;
    } else if (this.phase === 'TRANSITIONING') {
      const p = Math.max(0, Math.min(1, this.transitionProgress));
      expressionWeight = p * p * (3 - 2 * p);
    } else if (this.phase === 'SETTLING') {
      expressionWeight = 1.0;
      settlingWeight = this.settlingDuration > 0
        ? 1.0 - Math.min(1.0, this.phaseTimer / this.settlingDuration)
        : 0;
    } else {
      expressionWeight = 1.0;
    }

    return {
      currentExpr: this.currentExpr,
      targetExpr: this.targetExpr,
      activeExpr: this.targetExpr,
      phase: this.phase,
      phaseProgress: this.phase === 'ANTICIPATING'
        ? (this.anticipationDuration > 0 ? this.phaseTimer / this.anticipationDuration : 1)
        : this.phase === 'TRANSITIONING'
        ? this.transitionProgress
        : this.phase === 'SETTLING'
        ? (this.settlingDuration > 0 ? this.phaseTimer / this.settlingDuration : 1)
        : 1,
      transitionProgress: this.transitionProgress,
      expressionWeight,
      anticipationWeight,
      settlingWeight,
      isNeutral: this.targetExpr === 'neutral' && this.phase === 'HOLDING',
      headTiltRoll: this.activeTiltRoll,
      headTiltPitch: this.activeTiltPitch,
      profile
    };
  }

  public update(dt: number) {
    if (this.reducedMotion) {
      this.currentWeightsHead = [...this.toWeightsHead];
      this.currentWeightsTeeth = [...this.toWeightsTeeth];
      this.phase = 'HOLDING';
      return;
    }

    if (this.forcedExpression) {
      if (this.targetExpr !== this.forcedExpression) {
        this.setExpression(this.forcedExpression, 0.4);
      }
    }

    // 1. Advance Phase State Machine
    if (this.phase === 'ANTICIPATING') {
      this.phaseTimer += dt;
      if (this.phaseTimer >= this.anticipationDuration) {
        this.phase = 'TRANSITIONING';
        this.phaseTimer = 0;
        this.transitionProgress = 0.0;
      }
    } else if (this.phase === 'TRANSITIONING') {
      this.transitionProgress += dt / this.transitionDuration;
      if (this.transitionProgress >= 1.0) {
        this.transitionProgress = 1.0;
        this.currentExpr = this.targetExpr;

        if (this.targetExpr === 'neutral' || this.settlingDuration <= 0.05) {
          this.phase = 'HOLDING';
          this.holdTimer = 0;
          this.holdDuration = this.getHoldDuration(this.targetExpr);
        } else {
          this.phase = 'SETTLING';
          this.phaseTimer = 0;
        }
      }
    } else if (this.phase === 'SETTLING') {
      this.phaseTimer += dt;
      if (this.phaseTimer >= this.settlingDuration) {
        this.phase = 'HOLDING';
        this.holdTimer = 0;
        this.holdDuration = this.getHoldDuration(this.targetExpr);
      }
    } else if (this.phase === 'HOLDING' && !this.forcedExpression) {
      this.holdTimer += dt;
      if (this.holdTimer >= this.holdDuration) {
        if (this.targetExpr !== 'neutral') {
          // Emotion complete: return naturally to neutral resting state (Section 3 & 4)
          this.lastNonNeutralExpr = this.targetExpr;
          const transDur = this.getTransitionDuration('neutral');
          this.setExpression('neutral', transDur);
        } else {
          // Neutral resting interval complete: pick next natural non-repeating emotion (Section 4 & 9)
          const next = pickNextNaturalEmotion(this.lastNonNeutralExpr);
          const transDur = this.getTransitionDuration(next);
          this.setExpression(next, transDur);
        }
      }
    }

    // 2. Interpolate Morph Target Weights
    if (this.phase === 'ANTICIPATING') {
      // Subtle lead-in: eyebrow and slight eyelid adjustment before mouth movement
      const leadT = Math.min(1.0, this.phaseTimer / Math.max(0.01, this.anticipationDuration));
      const smoothLead = leadT * leadT * (3 - 2 * leadT) * 0.18; // Restrained 18% anticipatory lead

      for (let i = 0; i < 65; i++) {
        // Only allow brow and lid indices to lead slightly during anticipation
        if (i === 57 || i === 58 || i === 59 || i === 60 || i === 62 || i === 63) {
          this.currentWeightsHead[i] = THREE.MathUtils.lerp(this.fromWeightsHead[i], this.toWeightsHead[i], smoothLead);
        } else {
          this.currentWeightsHead[i] = this.fromWeightsHead[i];
        }
      }
      for (let i = 0; i < 31; i++) {
        this.currentWeightsTeeth[i] = this.fromWeightsTeeth[i];
      }
    } else if (this.phase === 'TRANSITIONING') {
      // Smooth cubic Hermite interpolation (smoothstep)
      const p = Math.max(0, Math.min(1, this.transitionProgress));
      const smoothT = p * p * (3 - 2 * p);

      for (let i = 0; i < 65; i++) {
        this.currentWeightsHead[i] = THREE.MathUtils.lerp(this.fromWeightsHead[i], this.toWeightsHead[i], smoothT);
      }
      for (let i = 0; i < 31; i++) {
        this.currentWeightsTeeth[i] = THREE.MathUtils.lerp(this.fromWeightsTeeth[i], this.toWeightsTeeth[i], smoothT);
      }
    } else {
      // SETTLING and HOLDING: exactly at target weights
      for (let i = 0; i < 65; i++) {
        this.currentWeightsHead[i] = this.toWeightsHead[i];
      }
      for (let i = 0; i < 31; i++) {
        this.currentWeightsTeeth[i] = this.toWeightsTeeth[i];
      }
    }
  }

  public applyToMeshes(
    headMesh: THREE.Mesh | null,
    teethDownMesh: THREE.Mesh | null,
    options?: {
      blinkFactor?: number;
      gazeNormY?: number;
      clickEngagement?: number;
      eyeOpenBonus?: number;
      squintBonus?: number;
    }
  ) {
    const blinkFactor = options?.blinkFactor ?? 0;
    const gazeNormY = options?.gazeNormY ?? 0;
    const clickEngagement = options?.clickEngagement ?? 0;
    const eyeOpenBonus = options?.eyeOpenBonus ?? 0;
    const squintBonus = options?.squintBonus ?? 0;

    // Apply lower teeth morphs
    if (teethDownMesh && teethDownMesh.morphTargetInfluences) {
      const tMorphs = teethDownMesh.morphTargetInfluences;
      for (let i = 0; i < 31 && i < tMorphs.length; i++) {
        tMorphs[i] = this.currentWeightsTeeth[i];
      }
    }

    // Apply head morphs with coordinated eyelids, blinks, and gaze
    if (headMesh && headMesh.morphTargetInfluences) {
      const hMorphs = headMesh.morphTargetInfluences;
      for (let i = 0; i < 65 && i < hMorphs.length; i++) {
        // Skip eye aperture/closure/squint which are blended dynamically with blink & gaze
        if (i === 45 || i === 46 || i === 47 || i === 48 || i === 49 || i === 50 || i === 51 || i === 52 || i === 58 || i === 59) {
          continue;
        }
        hMorphs[i] = this.currentWeightsHead[i];
      }

      // Base eye aperture from the current evaluated expression
      const baseEyeOpen = (this.currentWeightsHead[47] || 0.32) + eyeOpenBonus;
      const baseBrowUpR = this.currentWeightsHead[58] || 0.0;
      const baseBrowUpL = this.currentWeightsHead[59] || 0.0;

      // Eyelid tracking with vertical gaze pitch
      const lidPitchOffset = gazeNormY > 0 ? gazeNormY * 0.10 : gazeNormY * 0.16;
      const clickAperture = clickEngagement * 0.05;

      const dynamicOpen = Math.max(0.06, Math.min(0.70, baseEyeOpen + lidPitchOffset + clickAperture)) * (1.0 - blinkFactor);
      const downLidClose = gazeNormY < -0.15 ? (-gazeNormY - 0.15) * 0.26 : 0.0;
      const dynamicClose = Math.min(1.0, blinkFactor + downLidClose * (1.0 - blinkFactor));
      const dynamicLowLid = (this.currentWeightsHead[51] || 0.0) + (gazeNormY < -0.10 ? (-gazeNormY - 0.10) * 0.14 : 0.0);
      const dynamicSquintR = Math.min(1.0, (this.currentWeightsHead[49] || 0.0) + squintBonus);
      const dynamicSquintL = Math.min(1.0, (this.currentWeightsHead[50] || 0.0) + squintBonus);

      const dynamicBrowUpR = baseBrowUpR + (gazeNormY > 0.25 ? (gazeNormY - 0.25) * 0.08 : 0.0) + clickEngagement * 0.08;
      const dynamicBrowUpL = baseBrowUpL + (gazeNormY > 0.25 ? (gazeNormY - 0.25) * 0.08 : 0.0) + clickEngagement * 0.08;

      hMorphs[45] = dynamicClose;   // ReyeClose_h
      hMorphs[46] = dynamicClose;   // LeyeClose_h
      hMorphs[47] = dynamicOpen;    // ReyeOpen_h
      hMorphs[48] = dynamicOpen;    // LeyeOpen_h
      hMorphs[49] = dynamicSquintR; // Rsquint_h
      hMorphs[50] = dynamicSquintL; // Lsquint_h
      hMorphs[51] = Math.min(1.0, dynamicLowLid); // RlowLid_h
      hMorphs[52] = Math.min(1.0, dynamicLowLid); // LlowLid_h
      hMorphs[58] = Math.min(1.0, dynamicBrowUpR); // RbrowUp_h
      hMorphs[59] = Math.min(1.0, dynamicBrowUpL); // LbrowUp_h
    }
  }
}
