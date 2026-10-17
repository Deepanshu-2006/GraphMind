import type { PersonaLifeController } from './personaLifeController';
import type { PersonaExpressionController } from './personaExpressionController';
import type { PersonaExpression } from './personaEmotionProfiles';

export type AnalysisState =
  | 'idle'
  | 'observeRight'
  | 'analysePerformance'
  | 'reactToScore'
  | 'observeLeft'
  | 'reflect'
  | 'returnToIdle';

export type SemanticGazeTarget =
  | 'assessment'
  | 'revision'
  | 'learning'
  | 'forward'
  | 'reflection';

export interface GazeTargetCoordinate {
  x: number;
  y: number;
}

/**
 * Authoritative semantic gaze targets in NDC [-1, 1].
 * Calibrated against the portrait camera at (0, 0, 1.48) and the 3-column dashboard layout:
 * - assessment: upper right performance panel (assessment score badges & recent attempts)
 * - revision: lower right performance panel (active revision session & concepts to revisit)
 * - learning: left activity panel (graph counts & recent learning updates)
 * - forward: natural resting forward viewer gaze (0, 0)
 * - reflection: slightly lowered / gently off-centre contemplative gaze (0.06, -0.14)
 */
export const SEMANTIC_GAZE_TARGETS: Record<SemanticGazeTarget, GazeTargetCoordinate> = {
  assessment: { x: 0.52, y: 0.18 },
  revision: { x: 0.52, y: -0.06 },
  learning: { x: -0.52, y: 0.10 },
  forward: { x: 0.0, y: 0.0 },
  reflection: { x: 0.06, y: -0.14 }
};

export type ScorePresentationTier =
  | 'worried'
  | 'sad'
  | 'neutral'
  | 'smile'
  | 'celebratory';

export interface ScorePresentationConfig {
  minScore: number;
  maxScore: number;
  tier: ScorePresentationTier;
  reactionExpression: PersonaExpression;
  baselineExpression: PersonaExpression;
  hasNod: boolean;
  hasHeadShake: boolean;
  description: string;
}

/**
 * Visual presentation thresholds isolated from grading/business logic (Section 5).
 * User specification:
 * - below 20%: worried + subtle head shake
 * - 20 to 40%: sad + subtle head shake
 * - 40 to 60%: neutral (no shake, no nod)
 * - 60 to 80%: smile (happy without nod, no shake)
 * - 80 to 100%: happy with nod (no shake)
 * Missing or loading data: neutral baseline (never treated as 0).
 */
export const SCORE_PRESENTATION_RANGES: ScorePresentationConfig[] = [
  {
    minScore: 0,
    maxScore: 19,
    tier: 'worried',
    reactionExpression: 'worried',
    baselineExpression: 'neutral',
    hasNod: false,
    hasHeadShake: true,
    description: 'Below 20%: worried with head shake'
  },
  {
    minScore: 20,
    maxScore: 39,
    tier: 'sad',
    reactionExpression: 'sad',
    baselineExpression: 'neutral',
    hasNod: false,
    hasHeadShake: true,
    description: '20 to 40%: sad with head shake'
  },
  {
    minScore: 40,
    maxScore: 59,
    tier: 'neutral',
    reactionExpression: 'neutral',
    baselineExpression: 'neutral',
    hasNod: false,
    hasHeadShake: false,
    description: '40 to 60%: neutral'
  },
  {
    minScore: 60,
    maxScore: 79,
    tier: 'smile',
    reactionExpression: 'happy',
    baselineExpression: 'neutral',
    hasNod: false,
    hasHeadShake: false,
    description: '60 to 80%: smile'
  },
  {
    minScore: 80,
    maxScore: 100,
    tier: 'celebratory',
    reactionExpression: 'happy',
    baselineExpression: 'neutral',
    hasNod: true,
    hasHeadShake: false,
    description: '80 to 100%: happy with nod'
  }
];

/**
 * Resolves score presentation configuration safely.
 * Returns null if score is missing, null, undefined, or NaN (treated as neutral).
 */
export function getScorePresentation(score: number | null | undefined): ScorePresentationConfig | null {
  if (score === null || score === undefined || isNaN(score)) {
    return null;
  }
  const clamped = Math.max(0, Math.min(100, Number(score)));
  if (clamped < 20) {
    return SCORE_PRESENTATION_RANGES[0]; // Below 20%: worried
  }
  if (clamped < 40) {
    return SCORE_PRESENTATION_RANGES[1]; // 20 to 40%: sad
  }
  if (clamped < 60) {
    return SCORE_PRESENTATION_RANGES[2]; // 40 to 60%: neutral
  }
  if (clamped < 80) {
    return SCORE_PRESENTATION_RANGES[3]; // 60 to 80%: smile (happy without nod)
  }
  return SCORE_PRESENTATION_RANGES[4]; // 80 to 100%: happy with nod
}

export interface StateTimingConfig {
  baseDuration: number;
  variance: number;
}

/**
 * Timing configuration for analysis state transitions with organic variance (Section 2 & 6).
 */
export const ANALYSIS_STATE_TIMINGS: Record<AnalysisState, StateTimingConfig> = {
  idle: { baseDuration: 3.0, variance: 0.8 },               // 2.2s - 3.8s (approx 2-4s)
  observeRight: { baseDuration: 1.6, variance: 0.4 },       // 1.2s - 2.0s
  analysePerformance: { baseDuration: 2.4, variance: 0.4 }, // 2.0s - 2.8s
  reactToScore: { baseDuration: 3.2, variance: 0.4 },       // 2.8s - 3.6s (held generously so reaction is unmistakably visible!)
  observeLeft: { baseDuration: 1.6, variance: 0.4 },        // 1.2s - 2.0s
  reflect: { baseDuration: 1.6, variance: 0.4 },            // 1.2s - 2.0s
  returnToIdle: { baseDuration: 1.0, variance: 0.1 }        // 0.9s - 1.1s (smooth 800-1200ms transition)
};

export interface PersonaAnalysisControllerConfig {
  lifeController: PersonaLifeController;
  expressionController: PersonaExpressionController;
  assessmentScore?: number | null;
  prefersReducedMotion?: boolean;
  deterministic?: boolean;
  maxCycles?: number;
  onCycleComplete?: (cycleCount: number) => void;
  onTransitionToIdle?: () => void;
}

/**
 * PersonaAnalysisController
 *
 * Implements a continuous, organic behavior state machine for GraphMind Persona:
 * - Periodically observes right performance statistics (assessment / revision).
 * - Examines left learning activity.
 * - Returns to forward viewer engagement between observations.
 * - Shows subtle thinking and reflective expressions.
 * - Reacts to authoritative average assessment score with supportive, reflective, or approving behavior.
 * - Coordinates seamlessly with existing breathing, blinking, and eye tracking without conflicts.
 */
export class PersonaAnalysisController {
  private lifeController: PersonaLifeController;
  private expressionController: PersonaExpressionController;

  private currentState: AnalysisState = 'idle';
  private stateTimer = 0;
  private stateDuration = 3.0;
  private isActive = false;
  private isDisposed = false;

  private currentTarget: SemanticGazeTarget = 'forward';
  private assessmentScore: number | null = null;

  // Reduced motion and determinism controls
  private prefersReducedMotion = false;
  private deterministic = false;

  // Cycle tracking and nod frequency throttling (Section 5 & 6)
  private cycleCount = 0;
  private maxAnalysisCycles = 2;
  private lastNodScore: number | null = null;
  private lastNodTimeMs = 0;
  private hasTriggeredReactionGesture = false;

  private onCycleComplete?: (cycleCount: number) => void;
  private onTransitionToIdle?: () => void;

  constructor(config: PersonaAnalysisControllerConfig) {
    this.lifeController = config.lifeController;
    this.expressionController = config.expressionController;
    this.assessmentScore = config.assessmentScore ?? null;
    this.prefersReducedMotion = config.prefersReducedMotion ?? false;
    this.deterministic = config.deterministic ?? false;
    this.maxAnalysisCycles = config.maxCycles ?? 2;
    this.onCycleComplete = config.onCycleComplete;
    this.onTransitionToIdle = config.onTransitionToIdle;

    this.calculateStateDuration('idle');
  }

  public start(initialState: AnalysisState = 'idle', nowMs = performance.now()): void {
    if (this.isDisposed) return;
    this.isActive = true;
    this.expressionController.setAnalysisLocked(true);

    if (this.prefersReducedMotion) {
      this.currentState = 'idle';
      this.currentTarget = 'forward';
      this.stateTimer = 0;
      this.stateDuration = 999999;
      return;
    }

    this.transitionTo(initialState, nowMs);
  }

  public stop(): void {
    this.isActive = false;
    this.expressionController.setAnalysisLocked(false);
    this.currentState = 'idle';
    this.currentTarget = 'forward';
    this.stateTimer = 0;
    this.lifeController.releaseAnalysisGaze(0.5);
    this.lifeController.cancelHeadShake();
  }

  public dispose(): void {
    this.isDisposed = true;
    this.isActive = false;
    this.expressionController.setAnalysisLocked(false);
    this.lifeController.cancelHeadShake();
  }

  public setAssessmentScore(score: number | null): void {
    const oldPres = getScorePresentation(this.assessmentScore);
    const newPres = getScorePresentation(score);
    this.assessmentScore = score;

    // If score changes while in reactToScore and presentation tier changes, cancel shake if old was low and new is not
    if (this.currentState === 'reactToScore') {
      if (oldPres?.hasHeadShake && !newPres?.hasHeadShake) {
        this.lifeController.cancelHeadShake();
      }
    }

    // Safely update resting baseline expression without restarting the loop
    if (this.currentState === 'idle' || this.currentState === 'returnToIdle') {
      const pres = getScorePresentation(score);
      const baseline = pres ? pres.baselineExpression : 'neutral';
      this.expressionController.setExpression(baseline, 0.8);
    }
  }

  public getAssessmentScore(): number | null {
    return this.assessmentScore;
  }

  public setReducedMotion(reduced: boolean): void {
    this.prefersReducedMotion = reduced;
    if (reduced) {
      this.stop();
      this.expressionController.setExpression('neutral', 0.5);
      this.lifeController.releaseAnalysisGaze(0.3);
      this.lifeController.cancelHeadShake();
    }
  }

  public getCurrentState(): AnalysisState {
    return this.currentState;
  }

  public getCurrentTarget(): SemanticGazeTarget {
    return this.currentTarget;
  }

  public getStateProgress(): number {
    return Math.min(1.0, this.stateTimer / Math.max(0.01, this.stateDuration));
  }

  public getCycleCount(): number {
    return this.cycleCount;
  }

  public getMaxCycles(): number {
    return this.maxAnalysisCycles;
  }

  public setMaxCycles(max: number): void {
    this.maxAnalysisCycles = max;
  }

  public isAnalysisComplete(): boolean {
    return this.cycleCount >= this.maxAnalysisCycles;
  }

  public isRunning(): boolean {
    return this.isActive && !this.isDisposed && !this.prefersReducedMotion;
  }

  private calculateStateDuration(state: AnalysisState): number {
    const config = ANALYSIS_STATE_TIMINGS[state];
    if (this.deterministic) {
      this.stateDuration = config.baseDuration;
      return this.stateDuration;
    }
    const varianceOffset = (Math.random() * 2 - 1) * config.variance;
    this.stateDuration = Math.max(0.6, config.baseDuration + varianceOffset);
    return this.stateDuration;
  }

  /**
   * Main per-frame update invoked inside PersonaHumanoidCanvas render loop.
   */
  public update(dt: number, nowMs: number): void {
    if (!this.isActive || this.isDisposed || this.prefersReducedMotion) {
      return;
    }

    // When the configured analysis cycles (2 cycles) complete, settle permanently in resting idle
    if (this.currentState === 'idle' && this.cycleCount >= this.maxAnalysisCycles) {
      return;
    }

    this.stateTimer += dt;

    // Trigger reaction gesture (shake for low score <40%, nod for high score >=80%)
    // after the facial expression is visibly presented (~0.40s)
    if (this.currentState === 'reactToScore' && !this.hasTriggeredReactionGesture) {
      if (this.stateTimer >= 0.40) {
        this.hasTriggeredReactionGesture = true;
        const pres = getScorePresentation(this.assessmentScore);
        if (pres) {
          if (pres.hasHeadShake) {
            this.lifeController.triggerHeadShake(1.05, 0.14);
          } else if (pres.hasNod) {
            const isScoreChanged = this.lastNodScore !== this.assessmentScore;
            const isCooldownExpired = (nowMs - this.lastNodTimeMs) > 42000;
            if (isScoreChanged || isCooldownExpired || this.deterministic) {
              this.lastNodScore = this.assessmentScore;
              this.lastNodTimeMs = nowMs;
              this.lifeController.triggerApprovingNod(1.2);
            }
          }
        }
      }
    }

    if (this.stateTimer >= this.stateDuration) {
      this.advanceToNextState(nowMs);
    }
  }

  private advanceToNextState(nowMs: number): void {
    // If analysis cycles are complete, do not advance from resting idle
    if (this.currentState === 'idle' && this.cycleCount >= this.maxAnalysisCycles) {
      return;
    }

    let nextState: AnalysisState;

    switch (this.currentState) {
      case 'idle':
        nextState = 'observeRight';
        break;
      case 'observeRight':
        nextState = 'analysePerformance';
        break;
      case 'analysePerformance':
        nextState = 'reactToScore';
        break;
      case 'reactToScore':
        // Analyzing expression is strictly for the right section.
        // After reacting to the score on the right, smoothly return to idle.
        nextState = 'returnToIdle';
        break;
      case 'observeLeft':
        nextState = 'reflect';
        break;
      case 'reflect':
        nextState = 'returnToIdle';
        break;
      case 'returnToIdle':
      default:
        nextState = 'idle';
        this.cycleCount++;
        this.onCycleComplete?.(this.cycleCount);
        if (this.cycleCount >= this.maxAnalysisCycles) {
          this.onTransitionToIdle?.();
        }
        break;
    }

    this.transitionTo(nextState, nowMs);
  }

  public transitionTo(state: AnalysisState, _nowMs = performance.now()): void {
    this.isActive = true;
    this.currentState = state;
    this.stateTimer = 0;
    this.calculateStateDuration(state);

    const randX = this.deterministic ? 0 : (Math.random() - 0.5) * 0.03;
    const randY = this.deterministic ? 0 : (Math.random() - 0.5) * 0.03;

    switch (state) {
      case 'idle': {
        this.currentTarget = 'forward';
        this.lifeController.releaseAnalysisGaze(0.55);

        // Relax temporary analysis facial tension into comfortable resting baseline in expressive idle
        const pres = getScorePresentation(this.assessmentScore);
        const baseline = pres ? pres.baselineExpression : 'neutral';
        this.expressionController.setExpression(baseline, 1.0);
        this.expressionController.setAnalysisLocked(false);

        if (this.cycleCount >= this.maxAnalysisCycles) {
          // Completed exactly two full analysis-and-reaction cycles:
          // Deactivate the analysis controller loop so it settles permanently into expressive idle
          this.isActive = false;
        }
        break;
      }

      case 'observeRight': {
        // Alternates between upper assessment statistics and lower revision statistics
        const chooseRevision = !this.deterministic && (this.cycleCount % 3 === 2);
        this.currentTarget = chooseRevision ? 'revision' : 'assessment';
        const target = SEMANTIC_GAZE_TARGETS[this.currentTarget];

        this.lifeController.setAnalysisGaze(target.x + randX, target.y + randY, 0.48);
        this.expressionController.setExpression('attentive', 0.85);

        // Natural saccadic blink during gaze transition (~35% chance)
        if (!this.deterministic && Math.random() < 0.35) {
          this.lifeController.triggerBlink(0.14);
        }
        break;
      }

      case 'analysePerformance': {
        // Hold focused attention on right stats with subtle micro-gaze adjustment
        const target = SEMANTIC_GAZE_TARGETS[this.currentTarget];
        this.lifeController.setAnalysisGaze(target.x + randX * 0.5, target.y + randY * 0.5, 0.60);
        this.expressionController.setExpression('thinking', 1.0);
        break;
      }

      case 'reactToScore': {
        // Direct gaze towards viewer/camera so reaction expression is clearly visible front-and-center
        this.currentTarget = 'forward';
        this.lifeController.setAnalysisGaze(0.04 + randX, 0.02 + randY, 0.45);
        this.hasTriggeredReactionGesture = false;

        const pres = getScorePresentation(this.assessmentScore);
        if (!pres) {
          // Missing or loading assessments: neutral expression (never treat as 0)
          this.expressionController.setExpression('neutral', 0.6);
        } else {
          // Swift, clear transition into the score reaction expression
          this.expressionController.setExpression(pres.reactionExpression, 0.45);
        }
        break;
      }

      case 'observeLeft': {
        this.currentTarget = 'learning';
        const target = SEMANTIC_GAZE_TARGETS.learning;

        this.lifeController.setAnalysisGaze(target.x + randX, target.y + randY, 0.55);
        // Left learning section: calm, natural neutral glance without analyzing expression
        this.expressionController.setExpression('neutral', 0.8);

        // Natural saccadic blink during wide sweep across center (~40% chance)
        if (!this.deterministic && Math.random() < 0.40) {
          this.lifeController.triggerBlink(0.15);
        }
        break;
      }

      case 'reflect': {
        this.currentTarget = 'reflection';
        const target = SEMANTIC_GAZE_TARGETS.reflection;

        this.lifeController.setAnalysisGaze(target.x + randX * 0.5, target.y + randY * 0.5, 0.50);
        // Reflection following left glance: maintain relaxed neutral expression, no analyzing expression
        this.expressionController.setExpression('neutral', 0.8);
        break;
      }

      case 'returnToIdle': {
        this.currentTarget = 'forward';
        const transitionDuration = this.deterministic ? 1.0 : this.stateDuration;

        // 1. Return gaze towards natural forward-facing position smoothly over ~1000ms (800-1200ms)
        this.lifeController.releaseAnalysisGaze(transitionDuration);

        // 2. Smoothly reduce any temporary head movement
        this.lifeController.cancelHeadShake();

        // 3. Relax temporary analysis-related facial tension into comfortable resting baseline over ~1000ms
        const pres = getScorePresentation(this.assessmentScore);
        const baseline = pres ? pres.baselineExpression : 'neutral';
        this.expressionController.setExpression(baseline, transitionDuration);
        this.expressionController.setAnalysisLocked(false);

        // Natural settle blink
        if (!this.deterministic && Math.random() < 0.30) {
          this.lifeController.triggerBlink(0.14);
        }
        break;
      }
    }
  }
}
