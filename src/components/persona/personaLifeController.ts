import * as THREE from 'three';
import { type PersonaExpression } from './personaExpressionController';

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
 * 3. Gentle upper-body breathing through shoulders and chest (Spine2).
 * 4. Micro-movements and subtle head orientation complementing gaze.
 * 5. Infrequent, understated posture micro-adjustments.
 * 6. Expression-aware gaze, eyelid, and head posture modulation.
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

  // Interactive Click Engagement
  private clickEngagement = 0;

  // Breathing Cycle
  private breathPhase = 0;
  private breathCycleDuration = 4.0; // Slow, relaxed 4-second respiratory cycle (~15 bpm)

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

  private resetEngagedTimer(expr: PersonaExpression) {
    this.gazeMode = 'ENGAGED';
    this.gazeTimer = 0;

    // Expression-aware engagement interval
    if (expr === 'happy') {
      this.gazeTargetDuration = 8.0 + Math.random() * 4.5; // Stays warmly engaged longer
    } else if (expr === 'angry') {
      this.gazeTargetDuration = 24.0 + Math.random() * 10.0; // Focused, steady gaze with suppressed wandering
    } else if (expr === 'sad') {
      this.gazeTargetDuration = 4.5 + Math.random() * 3.5; // Breaks eye contact sooner
    } else if (expr === 'thinking') {
      this.gazeTargetDuration = 5.0 + Math.random() * 3.0; // Contemplative shifts
    } else {
      this.gazeTargetDuration = 6.0 + Math.random() * 5.5; // Standard 6-11.5s interval
    }
  }

  private pickGlanceAwayTarget(expr: PersonaExpression): GazeLookAwayTarget {
    // Random duration for looking away: 0.9s to 1.8s
    let duration = 0.9 + Math.random() * 0.9;

    if (expr === 'sad') {
      // Downward reflective gaze
      return {
        x: (Math.random() - 0.5) * 0.16,
        y: -0.16 - Math.random() * 0.12,
        duration: 1.2 + Math.random() * 0.8
      };
    }

    if (expr === 'thinking') {
      // Contemplative gaze (often up-right or down-left)
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
      // Very restrained shift if any
      return {
        x: (Math.random() - 0.5) * 0.08,
        y: (Math.random() - 0.5) * 0.06,
        duration: 0.6 + Math.random() * 0.4
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
      // Gentle downward gaze
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
    currentExpression: PersonaExpression = 'neutral'
  ): LifeFrameOutput {
    const timeSec = nowMs * 0.001;

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

    // 1. BLINK LIFECYCLE
    let blinkFactor = 0;
    if (this.blinkActive) {
      this.blinkElapsed += dt;
      const p = this.blinkElapsed / this.blinkDuration;
      if (p >= 1.0) {
        this.blinkActive = false;
        this.blinkElapsed = 0;
        this.nextBlinkTime = nowMs + 3200 + Math.random() * 2600;
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
      this.triggerBlink(0.16 + Math.random() * 0.04);
    }

    if (this.clickEngagement > 0) {
      this.clickEngagement = Math.max(0, this.clickEngagement - dt * 2.5);
    }

    // 2. CURSOR ACTIVITY & PRIORITY
    const timeSincePointerMove = nowMs - this.lastPointerMoveTime;
    const isCursorActive = this.hasPointer && timeSincePointerMove < 1800;

    // Smoothly blend cursor influence weight
    const targetCursorWeight = isCursorActive ? 1.0 : 0.0;
    const cursorBlendSpeed = isCursorActive ? 8.0 : 2.5;
    this.cursorWeight += (targetCursorWeight - this.cursorWeight) * (1.0 - Math.exp(-cursorBlendSpeed * dt));

    // 3. AUTONOMOUS GAZE STATE MACHINE (Look Away & Return)
    if (!this.isForcedGaze()) {
      // If cursor is actively in control, suspend glance-away and stay engaged
      if (this.cursorWeight > 0.65 && this.gazeMode === 'GLANCE_AWAY') {
        this.gazeMode = 'RETURN_TO_VIEWER';
        this.transitionProgress = 0;
        this.transitionDuration = 0.4;
        this.startIdleGaze = { ...this.currentIdleGaze };
        this.targetIdleGaze = { x: 0, y: 0 };
      }

      this.gazeTimer += dt;

      if (this.gazeMode === 'ENGAGED') {
        if (this.gazeTimer >= this.gazeTargetDuration && this.cursorWeight < 0.25) {
          // Transition to GLANCE_AWAY
          const glance = this.pickGlanceAwayTarget(currentExpression);
          this.gazeMode = 'GLANCE_AWAY';
          this.gazeTimer = 0;
          this.gazeTargetDuration = glance.duration;
          this.startIdleGaze = { ...this.currentIdleGaze };
          this.targetIdleGaze = { x: glance.x, y: glance.y };
          this.transitionProgress = 0;
          this.transitionDuration = 0.35 + Math.random() * 0.15; // Smooth 350-500ms look-away transition
        }
      } else if (this.gazeMode === 'GLANCE_AWAY') {
        if (this.gazeTimer >= this.gazeTargetDuration) {
          // Transition to RETURN_TO_VIEWER
          this.gazeMode = 'RETURN_TO_VIEWER';
          this.gazeTimer = 0;
          this.startIdleGaze = { ...this.currentIdleGaze };
          this.targetIdleGaze = { x: 0, y: 0 };
          this.transitionProgress = 0;
          this.transitionDuration = 0.50 + Math.random() * 0.20; // Smooth 500-700ms return transition
        }
      } else if (this.gazeMode === 'RETURN_TO_VIEWER') {
        if (this.transitionProgress >= 1.0) {
          this.resetEngagedTimer(currentExpression);
        }
      }

      // Update look-away transition interpolation
      if (this.transitionProgress < 1.0) {
        this.transitionProgress += dt / Math.max(0.01, this.transitionDuration);
        const p = Math.min(1.0, this.transitionProgress);
        // Smooth hermite curve (smoothstep)
        const smoothP = p * p * (3 - 2 * p);
        this.currentIdleGaze.x = THREE.MathUtils.lerp(this.startIdleGaze.x, this.targetIdleGaze.x, smoothP);
        this.currentIdleGaze.y = THREE.MathUtils.lerp(this.startIdleGaze.y, this.targetIdleGaze.y, smoothP);
      } else {
        this.currentIdleGaze.x = this.targetIdleGaze.x;
        this.currentIdleGaze.y = this.targetIdleGaze.y;
      }
    }

    // 4. COMBINE CURSOR TARGET & AUTONOMOUS IDLE GAZE
    // Organic ocular micro-fixation tremor (subtle alive drift)
    const microTremorX = Math.sin(timeSec * 1.9) * 0.003 + Math.cos(timeSec * 3.8) * 0.0015;
    const microTremorY = Math.cos(timeSec * 1.5) * 0.0022 + Math.sin(timeSec * 3.1) * 0.0012;

    // Expression gaze bias
    let exprBiasX = 0;
    let exprBiasY = 0;
    if (currentExpression === 'sad') {
      exprBiasY = -0.10; // Slightly lowered gaze during sad
    } else if (currentExpression === 'thinking') {
      exprBiasX = 0.04;
      exprBiasY = 0.03;
    }

    let targetGazeX = 0;
    let targetGazeY = 0;

    if (this.isForcedGaze()) {
      targetGazeX = this.forcedGazeX ?? 0;
      targetGazeY = this.forcedGazeY ?? 0;
    } else {
      // Blend between pointer target and idle look-away target based on cursorWeight
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

    // 5. GENTLE ANATOMICAL BREATHING
    // Smooth asymmetric cycle: 42% inhale, 58% exhale
    this.breathPhase = (this.breathPhase + dt / this.breathCycleDuration) % 1.0;
    let breathVal = 0;
    if (this.breathPhase < 0.42) {
      // Inhalation (smooth expansion)
      const t = this.breathPhase / 0.42;
      breathVal = 0.5 * (1.0 - Math.cos(t * Math.PI));
    } else {
      // Exhalation (relaxed settling)
      const t = (this.breathPhase - 0.42) / 0.58;
      breathVal = 0.5 * (1.0 + Math.cos(t * Math.PI));
    }

    // Breathing upper chest & shoulder movements
    // Spine2 pitch: -0.0075 rad (chest expands slightly upward and back)
    const spinePitch = -0.0075 * breathVal;
    const spinePosY = 0.0008 * breathVal;
    // Shoulders lift slightly (+0.28 bone local Y units)
    const shoulderLift = 0.28 * breathVal;

    // 6. SUBTLE HEAD MOVEMENT & POSTURE ADJUSTMENT
    // A. Head orienting coupled to gaze (eyes lead, head follows with ~15% amplitude)
    const targetHeadYaw = this.currentNDC.x * 0.08; // Max ~1.15 degrees
    const targetHeadPitch = -this.currentNDC.y * 0.045 - spinePitch * 0.45; // Counteract chest pitch to stabilize gaze

    // B. Autonomous low-frequency organic head drift
    const headDriftYaw = Math.sin(timeSec * 0.45) * 0.006 + Math.cos(timeSec * 0.95) * 0.003;
    const headDriftPitch = Math.cos(timeSec * 0.35) * 0.004 + Math.sin(timeSec * 0.82) * 0.002;
    const headDriftRoll = Math.sin(timeSec * 0.28) * 0.004;

    // C. Expression-specific head posture
    let exprHeadTiltRoll = 0;
    let exprHeadTiltPitch = 0;
    if (currentExpression === 'thinking') {
      exprHeadTiltRoll = -0.022; // Inquisitive head tilt
      exprHeadTiltPitch = 0.012;
    } else if (currentExpression === 'sad') {
      exprHeadTiltPitch = 0.018; // Slight downward reflective head droop
    } else if (currentExpression === 'happy') {
      exprHeadTiltRoll = 0.010; // Warm, friendly tilt
      exprHeadTiltPitch = -0.006;
    } else if (currentExpression === 'surprised') {
      exprHeadTiltPitch = -0.016; // Alert slight head lift
    }

    // D. Rare posture settling adjustments (every 16-28s)
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
        // Subtle bell-curve settling dip and relax
        const p = this.postureProgress;
        const bell = Math.sin(p * Math.PI);
        this.postureShoulderOffset = -0.12 * bell;
      }
    }

    // Blend head & neck orientations smoothly
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

    // 7. EXPRESSION-AWARE MORPH BONUSES
    let eyeOpenBonus = 0;
    let squintBonus = 0;
    if (currentExpression === 'happy') {
      squintBonus = 0.12; // Duchenne smile softness
      eyeOpenBonus = -0.03;
    } else if (currentExpression === 'thinking') {
      eyeOpenBonus = 0.05; // Attentive, inquisitive gaze
    } else if (currentExpression === 'surprised') {
      eyeOpenBonus = 0.16; // Widened alert gaze
    } else if (currentExpression === 'sad') {
      eyeOpenBonus = -0.05; // Softer, lower eyelids
    } else if (currentExpression === 'angry') {
      squintBonus = 0.08; // Focused furrow
      eyeOpenBonus = -0.06;
    } else if (currentExpression === 'worried') {
      eyeOpenBonus = 0.12; // Apprehensive openness
    }

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
