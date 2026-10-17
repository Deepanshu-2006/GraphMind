import * as THREE from 'three';
import {
  type PersonaExpression,
  type ExpressionStateInfo,
  type EmotionBehaviorProfile,
  getEmotionProfile
} from './personaEmotionProfiles';

export type GazeMode = 'ENGAGED' | 'GLANCE_AWAY' | 'RETURN_TO_VIEWER';

export interface GazeLookAwayTarget {
  x: number;
  y: number;
  duration: number;
}

export interface PersonaLifeControllerConfig {
  prefersReducedMotion?: boolean;
  forcedGazeX?: number | null;
  forcedGazeY?: number | null;
}

export interface LifeFrameOutput {
  // Coordinated Gaze Output in NDC [-1, 1]
  gazeNDC: { x: number; y: number };
  gazeMode: GazeMode;
  isGlancingAway: boolean;
  blinkFactor: number;

  // Expression-Aware Morph Target Bonuses
  eyeOpenBonus: number;
  squintBonus: number;

  // World Euler Angle Offsets for Bones (Pitch = X, Yaw = Y, Roll = Z in radians)
  headEuler: { pitch: number; yaw: number; roll: number };
  neckEuler: { pitch: number; yaw: number; roll: number };
  spine2Euler: { pitch: number; yaw: number; roll: number };

  // Bone Translation / Elevation Offsets
  spine2PositionOffset: { x: number; y: number; z: number };
  shoulderLift: number; // Local bone Y elevation for shoulders
}

/**
 * PersonaLifeController
 * Coordinates:
 * 1. Natural gaze behavior (ENGAGED, GLANCE_AWAY, RETURN_TO_VIEWER).
 * 2. Absolute cursor priority with smooth re-engagement and viewport departure handling.
 * 3. Gentle upper-body breathing through shoulders and chest (Spine2) with organic rate drift.
 * 4. Micro-movements and subtle head orientation complementing gaze.
 * 5. Infrequent, understated posture micro-adjustments.
 * 6. Emotion-aware gaze, eyelid, and head posture modulation with human pacing stillness.
 */
export class PersonaLifeController {
  // Gaze State Machine
  private gazeMode: GazeMode = 'ENGAGED';
  private gazeTimer = 0;
  private gazeTargetDuration = 8.0;
  private currentIdleGaze = { x: 0, y: 0 };
  private targetIdleGaze = { x: 0, y: 0 };
  private startIdleGaze = { x: 0, y: 0 };
  private transitionProgress = 1.0;
  private transitionDuration = 0.5;

  // Final Output Gaze (filtered & smoothed)
  private currentNDC = { x: 0, y: 0 };

  // Pointer & Cursor Tracking
  private pointerNDC = { x: 0, y: 0 };
  private hasPointer = false;
  private lastPointerMoveTime = 0;
  private cursorWeight = 0; // 0 = full autonomous idle, 1 = full cursor control

  // Blinking
  private blinkActive = false;
  private blinkElapsed = 0;
  private blinkDuration = 0.16;
  private nextBlinkTime = 0;
  private isDoubleBlinkPending = false;

  // Interactive Click Engagement
  private clickEngagement = 0;

  // Breathing Cycle
  private breathPhase = 0;

  // Head Orientation (Smoothed)
  private currentHeadEuler = { pitch: 0, yaw: 0, roll: 0 };
  private currentNeckEuler = { pitch: 0, yaw: 0, roll: 0 };

  // Posture Settling Adjustment
  private postureTimer = 0;
  private nextPostureTime = 16.0;
  private postureAdjusting = false;
  private postureProgress = 0;
  private postureDuration = 2.2;
  private postureShoulderOffset = 0;

  // Human Pacing & Calm Stillness (Objective 7 / Section 9)
  private pacingTimer = 0;
  private nextStillnessTime = 18.0;
  private isStillnessActive = false;
  private stillnessProgress = 0;
  private stillnessDuration = 4.2;

  // Config & Flags
  private prefersReducedMotion = false;
  private forcedGazeX: number | null = null;
  private forcedGazeY: number | null = null;

  constructor(config?: PersonaLifeControllerConfig) {
    this.prefersReducedMotion = config?.prefersReducedMotion ?? false;
    this.forcedGazeX = config?.forcedGazeX ?? null;
    this.forcedGazeY = config?.forcedGazeY ?? null;

    if (this.forcedGazeX !== null && !isNaN(this.forcedGazeX)) {
      this.currentNDC.x = this.forcedGazeX;
      this.pointerNDC.x = this.forcedGazeX;
    }
    if (this.forcedGazeY !== null && !isNaN(this.forcedGazeY)) {
      this.currentNDC.y = this.forcedGazeY;
      this.pointerNDC.y = this.forcedGazeY;
    }

    this.resetEngagedTimer('neutral');
    this.nextBlinkTime = 3000 + Math.random() * 2500;
    this.nextPostureTime = 14.0 + Math.random() * 12.0;
    this.nextStillnessTime = 16.0 + Math.random() * 10.0;
  }

  // ---------------------------------------------------------------------------
  // POINTER & CURSOR INPUT
  // ---------------------------------------------------------------------------

  public onPointerMove(ndcX: number, ndcY: number, nowMs: number) {
    if (this.prefersReducedMotion || this.isForcedGaze()) return;

    this.pointerNDC.x = Math.max(-1, Math.min(1, ndcX));
    this.pointerNDC.y = Math.max(-1, Math.min(1, ndcY));
    this.hasPointer = true;
    this.lastPointerMoveTime = nowMs;
  }

  public onPointerLeave() {
    if (this.isForcedGaze()) return;
    this.hasPointer = false;
  }

  public onPointerDown() {
    if (this.prefersReducedMotion || this.isForcedGaze()) return;
    this.clickEngagement = 1.0;
    if (!this.blinkActive && Math.random() < 0.60) {
      this.triggerBlink(0.15);
    }
  }

  public triggerBlink(duration = 0.16) {
    if (this.isForcedGaze() || this.prefersReducedMotion || this.blinkActive) return;
    this.blinkActive = true;
    this.blinkElapsed = 0;
    this.blinkDuration = duration;
  }

  public isForcedGaze(): boolean {
    return this.forcedGazeX !== null || this.forcedGazeY !== null;
  }

  // ---------------------------------------------------------------------------
  // TIMERS & TRANSITIONS
  // ---------------------------------------------------------------------------

  private resetEngagedTimer(expr: PersonaExpression | EmotionBehaviorProfile) {
    this.gazeMode = 'ENGAGED';
    this.gazeTimer = 0;

    const profile = typeof expr === 'string' ? getEmotionProfile(expr) : expr;

    if (profile.suppressAutonomousGaze) {
      // Focused / serious expressions (e.g. angry, surprised): steady gaze, look-away suppressed
      this.gazeTargetDuration = 24.0 + Math.random() * 12.0;
    } else {
      const range = profile.gazeEngagementMax - profile.gazeEngagementMin;
      this.gazeTargetDuration = profile.gazeEngagementMin + Math.random() * Math.max(0.5, range);
    }
  }

  private pickGlanceAwayTarget(expr: PersonaExpression): GazeLookAwayTarget {
    let duration = 0.9 + Math.random() * 0.9;

    if (expr === 'sad') {
      // Downward reflective glance (Section 2 & 6)
      return {
        x: (Math.random() - 0.5) * 0.16,
        y: -0.16 - Math.random() * 0.12,
        duration: 1.2 + Math.random() * 0.8
      };
    }

    if (expr === 'thinking' || expr === 'curious') {
      // Contemplative cognitive glance (often up-right or down-left)
      const isUpRight = Math.random() < 0.60;
      if (isUpRight) {
        return {
          x: 0.16 + Math.random() * 0.10,
          y: 0.08 + Math.random() * 0.10,
          duration: 1.1 + Math.random() * 0.8
        };
      } else {
        return {
          x: -0.18 - Math.random() * 0.10,
          y: -0.10 - Math.random() * 0.08,
          duration: 1.1 + Math.random() * 0.8
        };
      }
    }

    if (expr === 'angry') {
      // Highly restrained micro-shift if any
      return {
        x: (Math.random() - 0.5) * 0.06,
        y: (Math.random() - 0.5) * 0.04,
        duration: 0.5 + Math.random() * 0.3
      };
    }

    // Neutral / Happy / Surprised: natural believable gaze directions
    const roll = Math.random();
    let x = 0;
    let y = 0;

    if (roll < 0.28) {
      // Glance down-left
      x = -0.16 - Math.random() * 0.09;
      y = -0.12 - Math.random() * 0.08;
    } else if (roll < 0.56) {
      // Glance down-right
      x = 0.16 + Math.random() * 0.09;
      y = -0.12 - Math.random() * 0.08;
    } else if (roll < 0.78) {
      // Glance slightly left
      x = -0.18 - Math.random() * 0.08;
      y = (Math.random() - 0.5) * 0.06;
    } else if (roll < 0.92) {
      // Glance slightly right
      x = 0.18 + Math.random() * 0.08;
      y = (Math.random() - 0.5) * 0.06;
    } else {
      // Gentle downward glance
      x = (Math.random() - 0.5) * 0.06;
      y = -0.18 - Math.random() * 0.08;
    }

    return { x, y, duration };
  }

  // ---------------------------------------------------------------------------
  // MAIN UPDATE PER FRAME
  // ---------------------------------------------------------------------------

  public update(
    dt: number,
    nowMs: number,
    currentExpression: PersonaExpression | ExpressionStateInfo = 'neutral'
  ): LifeFrameOutput {
    const timeSec = nowMs * 0.001;

    // Resolve expression profile, active emotion, and transition weights
    const isStateInfo = typeof currentExpression === 'object';
    const stateInfo: ExpressionStateInfo | null = isStateInfo ? (currentExpression as ExpressionStateInfo) : null;
    const activeExpr: PersonaExpression = stateInfo ? stateInfo.activeExpr : (currentExpression as PersonaExpression);
    const profile = stateInfo ? stateInfo.profile : getEmotionProfile(activeExpr);
    const emotionWeight = stateInfo ? stateInfo.expressionWeight : (activeExpr === 'neutral' ? 0.0 : 1.0);
    const anticipationWeight = stateInfo ? stateInfo.anticipationWeight : 0.0;

    // Handle Reduced Motion Mode: stable, stationary, neutral
    if (this.prefersReducedMotion) {
      return {
        gazeNDC: { x: this.forcedGazeX ?? 0, y: this.forcedGazeY ?? 0 },
        gazeMode: 'ENGAGED',
        isGlancingAway: false,
        blinkFactor: 0,
        eyeOpenBonus: 0,
        squintBonus: 0,
        headEuler: { pitch: 0, yaw: 0, roll: 0 },
        neckEuler: { pitch: 0, yaw: 0, roll: 0 },
        spine2Euler: { pitch: 0, yaw: 0, roll: 0 },
        spine2PositionOffset: { x: 0, y: 0, z: 0 },
        shoulderLift: 0
      };
    }

    // 1. BLINK LIFECYCLE (Single & Double Blinking - Objective 4 & Section 8)
    let blinkFactor = 0;
    if (this.blinkActive) {
      this.blinkElapsed += dt;
      const p = this.blinkElapsed / this.blinkDuration;
      if (p >= 1.0) {
        this.blinkActive = false;
        this.blinkElapsed = 0;

        if (this.isDoubleBlinkPending) {
          // Schedule second flutter blink
          this.isDoubleBlinkPending = false;
          this.nextBlinkTime = nowMs + 80 + Math.random() * 40;
        } else {
          // 18% natural probability that the next blink will trigger a double blink
          const willDouble = Math.random() < 0.18;
          if (willDouble) {
            this.isDoubleBlinkPending = true;
            this.nextBlinkTime = nowMs + 2600 + Math.random() * 2600;
          } else {
            this.nextBlinkTime = nowMs + 3000 + Math.random() * 2800;
          }
        }
      } else if (p < 0.38) {
        const t = p / 0.38;
        blinkFactor = t * t * (3 - 2 * t);
      } else if (p < 0.48) {
        blinkFactor = 1.0;
      } else {
        const t = (p - 0.48) / 0.52;
        blinkFactor = 1.0 - t * t * (3 - 2 * t);
      }
    } else if (!this.isForcedGaze() && nowMs >= this.nextBlinkTime) {
      const duration = this.isDoubleBlinkPending ? (0.13 + Math.random() * 0.02) : (0.16 + Math.random() * 0.03);
      this.triggerBlink(duration);
    }

    if (this.clickEngagement > 0) {
      this.clickEngagement = Math.max(0, this.clickEngagement - dt * 2.5);
    }

    // 2. CURSOR ACTIVITY & PRIORITY (Section 2 & 6)
    const timeSincePointerMove = nowMs - this.lastPointerMoveTime;
    const isCursorActive = this.hasPointer && timeSincePointerMove < 1800;

    const targetCursorWeight = isCursorActive ? 1.0 : 0.0;
    const cursorBlendSpeed = isCursorActive ? 8.0 : 2.5;
    this.cursorWeight += (targetCursorWeight - this.cursorWeight) * (1.0 - Math.exp(-cursorBlendSpeed * dt));

    // 3. AUTONOMOUS GAZE STATE MACHINE (Section 2 & 6)
    if (!this.isForcedGaze()) {
      // If cursor is actively in control or emotion suppresses look-away, return/stay engaged
      const shouldSuppressGlance = (this.cursorWeight > 0.65) || (profile.suppressAutonomousGaze && emotionWeight > 0.5);

      if (shouldSuppressGlance && this.gazeMode === 'GLANCE_AWAY') {
        this.gazeMode = 'RETURN_TO_VIEWER';
        this.transitionProgress = 0;
        this.transitionDuration = 0.35;
        this.startIdleGaze = { ...this.currentIdleGaze };
        this.targetIdleGaze = { x: 0, y: 0 };
      }

      this.gazeTimer += dt;

      if (this.gazeMode === 'ENGAGED') {
        if (!shouldSuppressGlance && this.gazeTimer >= this.gazeTargetDuration && this.cursorWeight < 0.25) {
          // Transition to GLANCE_AWAY
          const glance = this.pickGlanceAwayTarget(activeExpr);
          this.gazeMode = 'GLANCE_AWAY';
          this.gazeTimer = 0;
          this.gazeTargetDuration = glance.duration;
          this.startIdleGaze = { ...this.currentIdleGaze };
          this.targetIdleGaze = { x: glance.x, y: glance.y };
          this.transitionProgress = 0;
          this.transitionDuration = 0.35 + Math.random() * 0.15;
        }
      } else if (this.gazeMode === 'GLANCE_AWAY') {
        if (this.gazeTimer >= this.gazeTargetDuration) {
          // Transition to RETURN_TO_VIEWER
          this.gazeMode = 'RETURN_TO_VIEWER';
          this.gazeTimer = 0;
          this.startIdleGaze = { ...this.currentIdleGaze };
          this.targetIdleGaze = { x: 0, y: 0 };
          this.transitionProgress = 0;
          this.transitionDuration = 0.50 + Math.random() * 0.20;

          // Natural saccadic reflex blink on return to viewer (~30% chance)
          if (!this.blinkActive && Math.random() < 0.30) {
            this.triggerBlink(0.14);
          }
        }
      } else if (this.gazeMode === 'RETURN_TO_VIEWER') {
        if (this.transitionProgress >= 1.0) {
          this.resetEngagedTimer(profile);
        }
      }

      // Update look-away transition interpolation
      if (this.transitionProgress < 1.0) {
        this.transitionProgress += dt / Math.max(0.01, this.transitionDuration);
        const p = Math.min(1.0, this.transitionProgress);
        const smoothP = p * p * (3 - 2 * p);
        this.currentIdleGaze.x = THREE.MathUtils.lerp(this.startIdleGaze.x, this.targetIdleGaze.x, smoothP);
        this.currentIdleGaze.y = THREE.MathUtils.lerp(this.startIdleGaze.y, this.targetIdleGaze.y, smoothP);
      } else {
        this.currentIdleGaze.x = this.targetIdleGaze.x;
        this.currentIdleGaze.y = this.targetIdleGaze.y;
      }
    }

    // 4. COMBINE CURSOR TARGET & EMOTION-AWARE IDLE GAZE (Section 2, 5 & 6)
    // Organic ocular micro-fixation tremor scaled by emotion focus
    const tremorScale = profile.gazeMicroTremorScale;
    const microTremorX = (Math.sin(timeSec * 1.9) * 0.003 + Math.cos(timeSec * 3.8) * 0.0015) * tremorScale;
    const microTremorY = (Math.cos(timeSec * 1.5) * 0.0022 + Math.sin(timeSec * 3.1) * 0.0012) * tremorScale;

    // Emotion gaze offsets (e.g. sad downward gaze leads during anticipation)
    const activeGazeWeight = Math.max(emotionWeight, anticipationWeight * 0.85);
    const exprBiasX = profile.gazeYawOffset * activeGazeWeight;
    const exprBiasY = profile.gazePitchOffset * activeGazeWeight;

    let targetGazeX = 0;
    let targetGazeY = 0;

    if (this.isForcedGaze()) {
      targetGazeX = this.forcedGazeX ?? 0;
      targetGazeY = this.forcedGazeY ?? 0;
    } else {
      const cursorTargetX = this.pointerNDC.x;
      const cursorTargetY = this.pointerNDC.y;
      const idleTargetX = this.currentIdleGaze.x + exprBiasX + microTremorX;
      const idleTargetY = this.currentIdleGaze.y + exprBiasY + microTremorY;

      targetGazeX = THREE.MathUtils.lerp(idleTargetX, cursorTargetX, this.cursorWeight);
      targetGazeY = THREE.MathUtils.lerp(idleTargetY, cursorTargetY, this.cursorWeight);
    }

    // Smooth critically-damped arrival at target gaze (saccadic profile)
    const dx = targetGazeX - this.currentNDC.x;
    const dy = targetGazeY - this.currentNDC.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const baseSpeed = this.cursorWeight > 0.5 ? 15.0 : 8.5;
    const saccadeBoost = Math.min(12.0, dist * 16.0);
    const lerpRate = baseSpeed + saccadeBoost;
    const gazeFactor = 1.0 - Math.exp(-lerpRate * Math.max(0.001, dt));

    this.currentNDC.x += (targetGazeX - this.currentNDC.x) * gazeFactor;
    this.currentNDC.y += (targetGazeY - this.currentNDC.y) * gazeFactor;

    // 5. GENTLE ANATOMICAL BREATHING (Section 8)
    // Continuous asymmetric cycle: 42% inhale, 58% exhale with organic drift
    const organicPeriod = 4.0 + Math.sin(timeSec * 0.12) * 0.35 + Math.cos(timeSec * 0.05) * 0.20;
    const organicAmp = (1.0 + Math.sin(timeSec * 0.08) * 0.12) * profile.breathingAmplitudeScale;

    this.breathPhase = (this.breathPhase + dt / organicPeriod) % 1.0;
    let breathVal = 0;
    if (this.breathPhase < 0.42) {
      const t = this.breathPhase / 0.42;
      breathVal = 0.5 * (1.0 - Math.cos(t * Math.PI));
    } else {
      const t = (this.breathPhase - 0.42) / 0.58;
      breathVal = 0.5 * (1.0 + Math.cos(t * Math.PI));
    }

    // Spine2 pitch and upper shoulder lift
    const spinePitch = -0.0075 * breathVal * organicAmp;
    const spinePosY = 0.0008 * breathVal * organicAmp;
    const shoulderLift = 0.28 * breathVal * organicAmp;

    // 6. SUBTLE HEAD MOVEMENT & POSTURE ADJUSTMENT (Section 2, 7 & 9)
    // A. Head orienting coupled to gaze (eyes lead, head follows with ~15% amplitude)
    const targetHeadYaw = this.currentNDC.x * 0.08;
    const targetHeadPitch = -this.currentNDC.y * 0.045 - spinePitch * 0.45;

    // B. Human Pacing Stillness Modulation (Objective 7 / Section 9)
    this.pacingTimer += dt;
    if (!this.isStillnessActive && this.pacingTimer >= this.nextStillnessTime) {
      this.isStillnessActive = true;
      this.stillnessProgress = 0;
      this.stillnessDuration = 3.5 + Math.random() * 2.0;
      this.nextStillnessTime = 20.0 + Math.random() * 14.0;
      this.pacingTimer = 0;
    }

    let stillnessFactor = 1.0;
    if (this.isStillnessActive) {
      this.stillnessProgress += dt / this.stillnessDuration;
      if (this.stillnessProgress >= 1.0) {
        this.isStillnessActive = false;
      } else {
        const sp = this.stillnessProgress;
        let sWeight = 1.0;
        if (sp < 0.25) {
          sWeight = 1.0 - (sp / 0.25);
        } else if (sp > 0.75) {
          sWeight = (sp - 0.75) / 0.25;
        } else {
          sWeight = 0.0;
        }
        stillnessFactor = 0.08 + 0.92 * sWeight;
      }
    }

    // C. Autonomous low-frequency organic head drift scaled by emotion restraint (Section 2 & 7)
    const driftIntensity = profile.headDriftScale * stillnessFactor;
    const headDriftYaw = (Math.sin(timeSec * 0.45) * 0.006 + Math.cos(timeSec * 0.95) * 0.003) * driftIntensity;
    const headDriftPitch = (Math.cos(timeSec * 0.35) * 0.004 + Math.sin(timeSec * 0.82) * 0.002) * driftIntensity;
    const headDriftRoll = (Math.sin(timeSec * 0.28) * 0.004) * driftIntensity;

    // D. Emotion-Specific Head Tilt & Posture Offsets (Section 2 & 7)
    // Uses evaluated tilt for current instance (respecting conditional tilt probability)
    const tiltRollVal = stateInfo ? stateInfo.headTiltRoll : profile.headTiltRoll;
    const tiltPitchVal = stateInfo ? stateInfo.headTiltPitch : profile.headTiltPitch;
    const exprHeadTiltRoll = tiltRollVal * emotionWeight;
    const exprHeadTiltPitch = tiltPitchVal * emotionWeight;

    // E. Rare posture settling adjustments (every 16-28s)
    this.postureTimer += dt;
    if (!this.postureAdjusting && this.postureTimer >= this.nextPostureTime) {
      this.postureAdjusting = true;
      this.postureProgress = 0;
      this.postureDuration = 2.0 + Math.random() * 0.6;
      this.nextPostureTime = 16.0 + Math.random() * 12.0;
      this.postureTimer = 0;
    }

    if (this.postureAdjusting) {
      this.postureProgress += dt / this.postureDuration;
      if (this.postureProgress >= 1.0) {
        this.postureAdjusting = false;
        this.postureShoulderOffset = 0;
      } else {
        const p = this.postureProgress;
        const bell = Math.sin(p * Math.PI);
        this.postureShoulderOffset = -0.12 * bell;
      }
    }

    // Blend head & neck orientations smoothly with exponential damping
    const desiredTotalYaw = targetHeadYaw + headDriftYaw;
    const desiredTotalPitch = targetHeadPitch + headDriftPitch + exprHeadTiltPitch;
    const desiredTotalRoll = headDriftRoll + exprHeadTiltRoll;

    const headDampSpeed = 4.0;
    const headFactor = 1.0 - Math.exp(-headDampSpeed * dt);

    this.currentHeadEuler.yaw += (desiredTotalYaw * 0.65 - this.currentHeadEuler.yaw) * headFactor;
    this.currentHeadEuler.pitch += (desiredTotalPitch * 0.65 - this.currentHeadEuler.pitch) * headFactor;
    this.currentHeadEuler.roll += (desiredTotalRoll * 0.65 - this.currentHeadEuler.roll) * headFactor;

    this.currentNeckEuler.yaw += (desiredTotalYaw * 0.35 - this.currentNeckEuler.yaw) * headFactor;
    this.currentNeckEuler.pitch += (desiredTotalPitch * 0.35 - this.currentNeckEuler.pitch) * headFactor;
    this.currentNeckEuler.roll += (desiredTotalRoll * 0.35 - this.currentNeckEuler.roll) * headFactor;

    // 7. EMOTION-AWARE MORPH BONUSES (Section 2 & 8)
    const effectiveBonusWeight = Math.max(emotionWeight, anticipationWeight * 0.60);
    const eyeOpenBonus = profile.eyeOpenBonus * effectiveBonusWeight;
    const squintBonus = profile.squintBonus * emotionWeight;

    return {
      gazeNDC: { ...this.currentNDC },
      gazeMode: this.gazeMode,
      isGlancingAway: this.gazeMode === 'GLANCE_AWAY',
      blinkFactor,
      eyeOpenBonus,
      squintBonus,
      headEuler: { ...this.currentHeadEuler },
      neckEuler: { ...this.currentNeckEuler },
      spine2Euler: { pitch: spinePitch, yaw: 0, roll: 0 },
      spine2PositionOffset: { x: 0, y: spinePosY, z: 0 },
      shoulderLift: shoulderLift + this.postureShoulderOffset
    };
  }
}
