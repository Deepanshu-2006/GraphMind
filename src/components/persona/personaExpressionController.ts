import * as THREE from 'three';

export type PersonaExpression =
  | 'neutral'
  | 'happy'
  | 'sad'
  | 'angry'
  | 'surprised'
  | 'thinking'
  | 'worried';

export interface FacialMorphWeights {
  head: Record<number, number>;
  teethDown: Record<number, number>;
}

/**
 * Predefined anatomical morph target weights for the 7 Persona expressions.
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

  thinking: {
    head: {
      26: 0.08, // MouthOpen_h
      17: 0.18, // RlipSide_h
      28: 0.14, // RsmileClose_h
      29: 0.04, // LsmileClose_h
      47: 0.32, // ReyeOpen_h
      48: 0.22, // LeyeOpen_h
      49: 0.08, // Rsquint_h
      50: 0.22, // Lsquint_h
      58: 0.42, // RbrowUp_h (inquisitive right brow lift)
      57: 0.32, // RRbrowUp_h
      63: 0.22, // LbrowDown_h (subtle thoughtful left brow drop)
      64: 0.16, // LLbrowDown_h
      39: 0.12  // Chin_h
    },
    teethDown: {
      29: 0.08  // t_MouthOpen_h
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
 * Natural emotional progression sequence returning to neutral between states.
 */
export const AUTOMATIC_EXPRESSION_SEQUENCE: PersonaExpression[] = [
  'neutral',
  'happy',
  'neutral',
  'thinking',
  'neutral',
  'surprised',
  'neutral',
  'worried', // Mandatory frightened / anxious expression from reference
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
  private fromWeightsHead: number[] = new Array(65).fill(0);
  private toWeightsHead: number[] = new Array(65).fill(0);
  private currentWeightsHead: number[] = new Array(65).fill(0);

  private fromWeightsTeeth: number[] = new Array(31).fill(0);
  private toWeightsTeeth: number[] = new Array(31).fill(0);
  private currentWeightsTeeth: number[] = new Array(31).fill(0);

  private transitionProgress = 1.0;
  private transitionDuration = 1.0;
  private holdTimer = 0;
  private holdDuration = 3.5;
  private isHolding = true;
  private sequenceIndex = 0;
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
    this.holdDuration = this.getHoldDuration(initial);
  }

  private copyPresetToTarget(expr: PersonaExpression) {
    const preset = PERSONA_EXPRESSION_PRESETS[expr];
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

  private getHoldDuration(expr: PersonaExpression): number {
    if (expr === 'neutral') {
      return 2.0 + Math.random() * 0.8; // 2.0s - 2.8s resting interval
    }
    if (expr === 'worried') {
      return 3.2 + Math.random() * 0.8; // 3.2s - 4.0s hold for dramatic impact
    }
    return 3.5 + Math.random() * 1.0; // 3.5s - 4.5s for normal expressions
  }

  private getTransitionDuration(toExpr: PersonaExpression): number {
    if (toExpr === 'neutral') {
      return 0.95 + Math.random() * 0.25; // 0.95s - 1.20s smooth return
    }
    if (toExpr === 'worried') {
      return 1.15 + Math.random() * 0.20; // 1.15s - 1.35s progressive build
    }
    return 1.05 + Math.random() * 0.25; // 1.05s - 1.30s entrance
  }

  public setExpression(expr: PersonaExpression, duration = 1.0) {
    if (expr === this.targetExpr && this.transitionProgress >= 1.0) return;

    this.fromWeightsHead = [...this.currentWeightsHead];
    this.fromWeightsTeeth = [...this.currentWeightsTeeth];
    this.currentExpr = this.targetExpr;
    this.targetExpr = expr;
    this.copyPresetToTarget(expr);

    this.transitionProgress = 0.0;
    this.transitionDuration = Math.max(0.1, duration);
    this.isHolding = false;
  }

  public getCurrentExpression(): PersonaExpression {
    return this.targetExpr;
  }

  public update(dt: number) {
    if (this.reducedMotion) {
      this.currentWeightsHead = [...this.toWeightsHead];
      this.currentWeightsTeeth = [...this.toWeightsTeeth];
      return;
    }

    if (this.forcedExpression) {
      if (this.targetExpr !== this.forcedExpression) {
        this.setExpression(this.forcedExpression, 0.5);
      }
    }

    if (!this.isHolding) {
      this.transitionProgress += dt / this.transitionDuration;
      if (this.transitionProgress >= 1.0) {
        this.transitionProgress = 1.0;
        this.isHolding = true;
        this.holdTimer = 0;
        this.holdDuration = this.getHoldDuration(this.targetExpr);
        this.currentExpr = this.targetExpr;
      }
    } else if (!this.forcedExpression) {
      this.holdTimer += dt;
      if (this.holdTimer >= this.holdDuration) {
        // Advance automatic sequence
        this.sequenceIndex = (this.sequenceIndex + 1) % AUTOMATIC_EXPRESSION_SEQUENCE.length;
        const nextExpr = AUTOMATIC_EXPRESSION_SEQUENCE[this.sequenceIndex];
        const transDur = this.getTransitionDuration(nextExpr);
        this.setExpression(nextExpr, transDur);
      }
    }

    // Smooth cubic hermite interpolation (smoothstep)
    const p = Math.max(0, Math.min(1, this.transitionProgress));
    const smoothT = p * p * (3 - 2 * p);

    for (let i = 0; i < 65; i++) {
      this.currentWeightsHead[i] = THREE.MathUtils.lerp(this.fromWeightsHead[i], this.toWeightsHead[i], smoothT);
    }
    for (let i = 0; i < 31; i++) {
      this.currentWeightsTeeth[i] = THREE.MathUtils.lerp(this.fromWeightsTeeth[i], this.toWeightsTeeth[i], smoothT);
    }
  }

  public applyToMeshes(
    headMesh: THREE.Mesh | null,
    teethDownMesh: THREE.Mesh | null,
    options?: {
      blinkFactor?: number;
      gazeNormY?: number;
      clickEngagement?: number;
    }
  ) {
    const blinkFactor = options?.blinkFactor ?? 0;
    const gazeNormY = options?.gazeNormY ?? 0;
    const clickEngagement = options?.clickEngagement ?? 0;

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
        // Skip eye aperture/closure which are blended dynamically with blink & gaze
        if (i === 45 || i === 46 || i === 47 || i === 48 || i === 51 || i === 52 || i === 58 || i === 59) {
          continue;
        }
        hMorphs[i] = this.currentWeightsHead[i];
      }

      // Base eye aperture from the current evaluated expression
      const baseEyeOpen = this.currentWeightsHead[47] || 0.32;
      const baseBrowUpR = this.currentWeightsHead[58] || 0.0;
      const baseBrowUpL = this.currentWeightsHead[59] || 0.0;

      // Eyelid tracking with vertical gaze pitch
      const lidPitchOffset = gazeNormY > 0 ? gazeNormY * 0.10 : gazeNormY * 0.16;
      const clickAperture = clickEngagement * 0.05;

      const dynamicOpen = Math.max(0.06, Math.min(0.70, baseEyeOpen + lidPitchOffset + clickAperture)) * (1.0 - blinkFactor);
      const downLidClose = gazeNormY < -0.15 ? (-gazeNormY - 0.15) * 0.26 : 0.0;
      const dynamicClose = Math.min(1.0, blinkFactor + downLidClose * (1.0 - blinkFactor));
      const dynamicLowLid = (this.currentWeightsHead[51] || 0.0) + (gazeNormY < -0.10 ? (-gazeNormY - 0.10) * 0.14 : 0.0);

      const dynamicBrowUpR = baseBrowUpR + (gazeNormY > 0.25 ? (gazeNormY - 0.25) * 0.08 : 0.0) + clickEngagement * 0.08;
      const dynamicBrowUpL = baseBrowUpL + (gazeNormY > 0.25 ? (gazeNormY - 0.25) * 0.08 : 0.0) + clickEngagement * 0.08;

      hMorphs[45] = dynamicClose;  // ReyeClose_h
      hMorphs[46] = dynamicClose;  // LeyeClose_h
      hMorphs[47] = dynamicOpen;   // ReyeOpen_h
      hMorphs[48] = dynamicOpen;   // LeyeOpen_h
      hMorphs[51] = Math.min(1.0, dynamicLowLid); // RlowLid_h
      hMorphs[52] = Math.min(1.0, dynamicLowLid); // LlowLid_h
      hMorphs[58] = Math.min(1.0, dynamicBrowUpR); // RbrowUp_h
      hMorphs[59] = Math.min(1.0, dynamicBrowUpL); // LbrowUp_h
    }
  }
}
