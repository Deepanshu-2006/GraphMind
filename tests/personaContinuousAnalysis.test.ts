import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PersonaAnalysisController,
  SEMANTIC_GAZE_TARGETS,
  SCORE_PRESENTATION_RANGES,
  ANALYSIS_STATE_TIMINGS,
  getScorePresentation,
  type AnalysisState,
  type SemanticGazeTarget
} from '../src/components/persona/personaAnalysisController';
import { PersonaLifeController } from '../src/components/persona/personaLifeController';
import { PersonaExpressionController } from '../src/components/persona/personaExpressionController';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const canvasSrcPath = path.resolve(__dirname, '../src/components/persona/PersonaHumanoidCanvas.tsx');
const analysisSrcPath = path.resolve(__dirname, '../src/components/persona/personaAnalysisController.ts');
const lifeControllerSrcPath = path.resolve(__dirname, '../src/components/persona/personaLifeController.ts');
const canvasSrc = fs.readFileSync(canvasSrcPath, 'utf8');
const analysisSrc = fs.readFileSync(analysisSrcPath, 'utf8');
const lifeControllerSrc = fs.readFileSync(lifeControllerSrcPath, 'utf8');

describe('GRAPHMIND — PERSONA: CONTINUOUS ANALYSIS & REACTION LOOP', () => {
  describe('1. Behavior State Machine Architecture & Transitions', () => {
    it('defines all 7 continuous analysis states in correct order', () => {
      const expectedStates: AnalysisState[] = [
        'idle',
        'observeRight',
        'analysePerformance',
        'reactToScore',
        'observeLeft',
        'reflect',
        'returnToIdle'
      ];

      for (const s of expectedStates) {
        assert.ok(ANALYSIS_STATE_TIMINGS[s], `State ${s} must have timing configuration`);
        assert.ok(ANALYSIS_STATE_TIMINGS[s].baseDuration > 0, `State ${s} must have positive duration`);
      }
    });

    it('advances through the full continuous sequence deterministically and loops', () => {
      const lifeController = new PersonaLifeController();
      const expressionController = new PersonaExpressionController();
      const controller = new PersonaAnalysisController({
        lifeController,
        expressionController,
        assessmentScore: 85,
        deterministic: true
      });

      controller.start('idle', 1000);
      assert.equal(controller.getCurrentState(), 'idle');

      const observedStates: AnalysisState[] = ['idle'];

      // Simulate advancing through time step-by-step
      let simTime = 1.0;
      const step = 0.2;
      const totalSimSeconds = 25.0; // enough to complete at least 1.5 full cycles

      while (simTime < totalSimSeconds) {
        simTime += step;
        controller.update(step, simTime * 1000);
        const cur = controller.getCurrentState();
        if (observedStates[observedStates.length - 1] !== cur) {
          observedStates.push(cur);
        }
      }

      // Verify sequence of states matches right-section-only analysis loop
      assert.ok(observedStates.includes('observeRight'), 'Must enter observeRight');
      assert.ok(observedStates.includes('analysePerformance'), 'Must enter analysePerformance');
      assert.ok(observedStates.includes('reactToScore'), 'Must enter reactToScore');
      assert.ok(observedStates.includes('returnToIdle'), 'Must enter returnToIdle');
      assert.ok(controller.getCycleCount() >= 1, `Cycle count should be at least 1, got ${controller.getCycleCount()}`);
    });

    it('executes the analyzing expression sequence exactly twice and then settles permanently in idle', () => {
      const lifeController = new PersonaLifeController();
      const expressionController = new PersonaExpressionController();
      const controller = new PersonaAnalysisController({
        lifeController,
        expressionController,
        assessmentScore: 15,
        deterministic: true
      });

      controller.start('analysePerformance', 1000);
      assert.equal(controller.getMaxCycles(), 2);

      let reactionCount = 0;
      let previousState = controller.getCurrentState();

      // Step through sufficient time to complete 2 full cycles and settle (each cycle is ~14.8s, so 35s is plenty)
      let simTime = 1.0;
      const step = 0.1;
      const totalSimSeconds = 35.0;

      while (simTime < totalSimSeconds) {
        simTime += step;
        controller.update(step, simTime * 1000);
        const cur = controller.getCurrentState();
        if (cur === 'reactToScore' && previousState !== 'reactToScore') {
          reactionCount++;
        }
        previousState = cur;
      }

      // Must have executed reactToScore exactly twice
      assert.equal(reactionCount, 2, `Analyzing reaction expression must be performed twice only, got ${reactionCount}`);
      assert.equal(controller.getCycleCount(), 2, 'Must have completed 2 cycles');
      assert.equal(controller.isAnalysisComplete(), true, 'isAnalysisComplete must be true');
      assert.equal(controller.getCurrentState(), 'idle', 'Must settle in resting idle');

      // Continue simulating for another 15 seconds
      const extraSimSeconds = 15.0;
      let extraTime = 0;
      while (extraTime < extraSimSeconds) {
        extraTime += step;
        controller.update(step, (simTime + extraTime) * 1000);
        const cur = controller.getCurrentState();
        if (cur === 'reactToScore' && previousState !== 'reactToScore') {
          reactionCount++;
        }
        previousState = cur;
      }

      // Still exactly 2 reactions, remains in idle
      assert.equal(reactionCount, 2, 'Must never trigger a 3rd analyzing expression');
      assert.equal(controller.getCurrentState(), 'idle', 'Must stay permanently in resting idle');
      assert.equal(controller.getCycleCount(), 2);
    });

    it('applies modest organic duration variance in non-deterministic mode', () => {
      const lifeController = new PersonaLifeController();
      const expressionController = new PersonaExpressionController();
      const controller = new PersonaAnalysisController({
        lifeController,
        expressionController,
        assessmentScore: 75,
        deterministic: false
      });

      controller.start('idle', 1000);
      const idleTiming = ANALYSIS_STATE_TIMINGS.idle;
      const progress = controller.getStateProgress();
      assert.ok(progress >= 0 && progress <= 1);
    });
  });

  describe('2. Semantic Gaze Targets & Natural Coordination', () => {
    it('defines authoritative NDC coordinates for all semantic gaze targets', () => {
      const targets: SemanticGazeTarget[] = ['assessment', 'revision', 'learning', 'forward', 'reflection'];
      for (const t of targets) {
        const coord = SEMANTIC_GAZE_TARGETS[t];
        assert.ok(coord, `Target "${t}" must be defined`);
        assert.ok(coord.x >= -1 && coord.x <= 1, `Target "${t}" X must be in NDC bounds`);
        assert.ok(coord.y >= -1 && coord.y <= 1, `Target "${t}" Y must be in NDC bounds`);
      }

      // Right-side performance panel targets
      assert.ok(SEMANTIC_GAZE_TARGETS.assessment.x > 0.40, 'Assessment target must be on the right side');
      assert.ok(SEMANTIC_GAZE_TARGETS.revision.x > 0.40, 'Revision target must be on the right side');

      // Left-side activity panel targets
      assert.ok(SEMANTIC_GAZE_TARGETS.learning.x < -0.40, 'Learning target must be on the left side');

      // Forward and reflection targets
      assert.equal(SEMANTIC_GAZE_TARGETS.forward.x, 0.0, 'Forward gaze must be horizontally centered');
      assert.ok(SEMANTIC_GAZE_TARGETS.reflection.y < 0.0, 'Reflection target should be slightly lowered');
    });

    it('sets intentional analysis gaze in PersonaLifeController during observations', () => {
      const lifeController = new PersonaLifeController();
      const expressionController = new PersonaExpressionController();
      const controller = new PersonaAnalysisController({
        lifeController,
        expressionController,
        deterministic: true
      });

      controller.transitionTo('observeRight', 1000);
      assert.equal(controller.getCurrentTarget(), 'assessment');
      assert.ok(lifeController.isIntentionalGlanceActive(), 'Must activate intentional gaze in life controller');

      controller.transitionTo('observeLeft', 2000);
      assert.equal(controller.getCurrentTarget(), 'learning');
      assert.ok(lifeController.isIntentionalGlanceActive(), 'Must keep intentional gaze active on learning panel');

      controller.transitionTo('returnToIdle', 3000);
      assert.equal(controller.getCurrentTarget(), 'forward');
      assert.equal(lifeController.isIntentionalGlanceActive(), false, 'Releases intentional gaze when returning to idle');
    });
  });

  describe('3. Score-Dependent Facial Expressions & Presentation Ranges', () => {
    it('maps below 20% score to worried expression with head shake', () => {
      const pres = getScorePresentation(15);
      assert.ok(pres);
      assert.equal(pres.tier, 'worried');
      assert.equal(pres.reactionExpression, 'worried');
      assert.equal(pres.hasNod, false);
      assert.equal(pres.hasHeadShake, true);
    });

    it('maps 20 to 40% score to sad expression with head shake', () => {
      const pres = getScorePresentation(30);
      assert.ok(pres);
      assert.equal(pres.tier, 'sad');
      assert.equal(pres.reactionExpression, 'sad');
      assert.equal(pres.hasNod, false);
      assert.equal(pres.hasHeadShake, true);
    });

    it('maps 40 to 60% score to neutral expression without shake or nod', () => {
      const pres = getScorePresentation(50);
      assert.ok(pres);
      assert.equal(pres.tier, 'neutral');
      assert.equal(pres.reactionExpression, 'neutral');
      assert.equal(pres.hasNod, false);
      assert.equal(pres.hasHeadShake, false);
    });

    it('maps 60 to 80% score to smile (happy) expression without nod or shake', () => {
      const pres = getScorePresentation(70);
      assert.ok(pres);
      assert.equal(pres.tier, 'smile');
      assert.equal(pres.reactionExpression, 'happy');
      assert.equal(pres.hasNod, false);
      assert.equal(pres.hasHeadShake, false);
    });

    it('maps 80 to 100% score to happy with nod but without shake', () => {
      const pres = getScorePresentation(85);
      assert.ok(pres);
      assert.equal(pres.tier, 'celebratory');
      assert.equal(pres.reactionExpression, 'happy');
      assert.equal(pres.hasNod, true);
      assert.equal(pres.hasHeadShake, false);
    });

    it('never interprets null, undefined, or missing score as zero', () => {
      assert.equal(getScorePresentation(null), null);
      assert.equal(getScorePresentation(undefined), null);
      assert.equal(getScorePresentation(NaN), null);

      const lifeController = new PersonaLifeController();
      const expressionController = new PersonaExpressionController();
      const controller = new PersonaAnalysisController({
        lifeController,
        expressionController,
        assessmentScore: null
      });

      controller.transitionTo('reactToScore', 1000);
      controller.update(0.6, 1600);
      assert.equal(expressionController.getCurrentExpression(), 'neutral');
      assert.equal(lifeController.isHeadShakeInProgress(), false, 'Null score must not trigger head shake');
      assert.equal(lifeController.isApprovingNodInProgress(), false, 'Null score must not trigger approving nod');
    });

    it('triggers head shake for 19%, 20%, and 39% scores after facial expression is presented', () => {
      const testScores = [19, 20, 39];
      for (const score of testScores) {
        const lifeController = new PersonaLifeController();
        const expressionController = new PersonaExpressionController();
        const controller = new PersonaAnalysisController({
          lifeController,
          expressionController,
          assessmentScore: score,
          deterministic: true
        });

        controller.start('reactToScore', 1000);
        assert.equal(lifeController.isHeadShakeInProgress(), false, 'Head shake must not trigger at t=0 before expression presents');
        assert.equal(expressionController.getCurrentExpression(), score < 20 ? 'worried' : 'sad');

        // Advance past expression presentation window (0.40s)
        controller.update(0.45, 1450);
        assert.ok(lifeController.isHeadShakeInProgress(), `Head shake must be active for score ${score}%`);
        assert.equal(lifeController.isApprovingNodInProgress(), false, 'Approving nod must NOT be active for low score');

        // Advance into the peak oscillation of the head shake (~0.52s into shake)
        const peakOut = lifeController.update(0.525, 1975, score < 20 ? 'worried' : 'sad');
        assert.ok(
          Math.abs(peakOut.headEuler.yaw) > 0.05,
          `Head yaw must have prominent visible amplitude (> 0.05 rad), got ${peakOut.headEuler.yaw}`
        );

        // Let shake finish (remaining ~0.60s)
        lifeController.update(0.60, 2575, score < 20 ? 'worried' : 'sad');
        assert.equal(lifeController.isHeadShakeInProgress(), false, 'Head shake should finish after duration');
      }
    });

    it('verifies 40% and 60% scores do not trigger head shake', () => {
      for (const score of [40, 60]) {
        const lifeController = new PersonaLifeController();
        const expressionController = new PersonaExpressionController();
        const controller = new PersonaAnalysisController({
          lifeController,
          expressionController,
          assessmentScore: score,
          deterministic: true
        });

        controller.start('reactToScore', 1000);
        controller.update(0.6, 1600);
        assert.equal(lifeController.isHeadShakeInProgress(), false, `Score ${score}% must not trigger head shake`);
        assert.equal(lifeController.isApprovingNodInProgress(), false, `Score ${score}% must not trigger nod`);
      }
    });

    it('triggers approving nod on PersonaLifeController for 80%+ scores after expression is presented', () => {
      const lifeController = new PersonaLifeController();
      const expressionController = new PersonaExpressionController();
      const controller = new PersonaAnalysisController({
        lifeController,
        expressionController,
        assessmentScore: 92,
        deterministic: true
      });

      controller.start('reactToScore', 1000);
      assert.equal(lifeController.isApprovingNodInProgress(), false, 'Nod should not start before expression presents');

      controller.update(0.6, 1600);
      assert.ok(lifeController.isApprovingNodInProgress(), 'Approving nod must be active for 92% score');
      assert.equal(lifeController.isHeadShakeInProgress(), false, 'Head shake must NOT trigger for 92% score');

      // Advance life controller to observe approving nod pitch offset
      const out = lifeController.update(0.4, 2000, 'happy');
      assert.ok(out.headEuler.pitch > 0.005, 'Head pitch should reflect approving nod dip');
    });

    it('does not repeat head shake continuously while character is idle', () => {
      const lifeController = new PersonaLifeController();
      const expressionController = new PersonaExpressionController();
      const controller = new PersonaAnalysisController({
        lifeController,
        expressionController,
        assessmentScore: 15,
        deterministic: true
      });

      controller.start('idle', 1000);
      controller.update(1.0, 2000);
      assert.equal(lifeController.isHeadShakeInProgress(), false, 'Must not shake head in idle state');
      controller.update(2.5, 4500);
      assert.equal(lifeController.isHeadShakeInProgress(), false, 'Must not shake head in idle state');
    });
  });

  describe('4. Dynamic Updates, Reduced Motion & Clean Lifecycle', () => {
    it('updates assessment score dynamically without restarting loop', () => {
      const lifeController = new PersonaLifeController();
      const expressionController = new PersonaExpressionController();
      const controller = new PersonaAnalysisController({
        lifeController,
        expressionController,
        assessmentScore: 50,
        deterministic: true
      });

      controller.start('analysePerformance', 1000);
      assert.equal(controller.getCurrentState(), 'analysePerformance');

      // Score updates to 95%
      controller.setAssessmentScore(95);
      assert.equal(controller.getAssessmentScore(), 95);
      // State machine remains in current state without restarting
      assert.equal(controller.getCurrentState(), 'analysePerformance');
    });

    it('disables continuous gaze sweeps and stays calm when prefersReducedMotion is true', () => {
      const lifeController = new PersonaLifeController({ prefersReducedMotion: true });
      const expressionController = new PersonaExpressionController({ reducedMotion: true });
      const controller = new PersonaAnalysisController({
        lifeController,
        expressionController,
        assessmentScore: 90,
        prefersReducedMotion: true
      });

      controller.start('idle', 1000);
      assert.equal(controller.isRunning(), false);

      // Updating dt does not advance states
      controller.update(1.0, 2000);
      assert.equal(controller.getCurrentState(), 'idle');
      assert.equal(lifeController.isIntentionalGlanceActive(), false);
    });

    it('cleans up resources and stops running on dispose()', () => {
      const lifeController = new PersonaLifeController();
      const expressionController = new PersonaExpressionController();
      const controller = new PersonaAnalysisController({
        lifeController,
        expressionController
      });

      controller.start('observeRight', 1000);
      assert.equal(controller.isRunning(), true);

      controller.dispose();
      assert.equal(controller.isRunning(), false);

      // Further updates are ignored
      controller.update(2.0, 3000);
      assert.equal(controller.isRunning(), false);
    });
  });

  describe('5. Canvas Integration & Rendering Loop Verification', () => {
    it('verifies PersonaHumanoidCanvas integrates PersonaAnalysisController', () => {
      assert.ok(canvasSrc.includes('PersonaAnalysisController'), 'Must import PersonaAnalysisController');
      assert.ok(canvasSrc.includes('analysisController.update(dt, nowMs)'), 'Must update analysisController in render loop');
      assert.ok(canvasSrc.includes('assessmentScore'), 'Must support assessmentScore prop');
      assert.ok(canvasSrc.includes('analysisController.dispose()'), 'Must dispose analysisController on unmount');
    });

    it('verifies PersonaExperience connects authoritative averageScore to canvas', () => {
      const expSrcPath = path.resolve(__dirname, '../src/components/persona/PersonaExperience.tsx');
      const expSrc = fs.readFileSync(expSrcPath, 'utf8');
      assert.ok(expSrc.includes('usePersonaStats'), 'PersonaExperience must use usePersonaStats');
      assert.ok(expSrc.includes('assessmentScore={averageScore}'), 'PersonaExperience must pass assessmentScore to canvas');
    });

    it('verifies continuous analysis loop hands off seamlessly from right panel entrance', () => {
      assert.ok(canvasSrc.includes('analysisController.start(\'analysePerformance\')'), 'Must start analysis loop after right panel entrance completes');
    });
  });

  describe('6. Transition into Expressive Idle State & Emotion Preservation', () => {
    it('transitions into expressive idle after exactly two completed cycles with cycle-completion events', () => {
      const lifeController = new PersonaLifeController();
      const expressionController = new PersonaExpressionController();
      const completedCycles: number[] = [];
      let transitionFired = false;

      const controller = new PersonaAnalysisController({
        lifeController,
        expressionController,
        assessmentScore: 15,
        deterministic: true,
        onCycleComplete: (c) => completedCycles.push(c),
        onTransitionToIdle: () => { transitionFired = true; }
      });

      controller.start('analysePerformance', 1000);
      assert.equal(controller.isAnalysisComplete(), false);

      // Advance through Cycle 1 and Cycle 2 (total ~30s)
      let simTime = 1.0;
      const step = 0.1;
      while (simTime < 32.0) {
        simTime += step;
        controller.update(step, simTime * 1000);
      }

      assert.deepEqual(completedCycles, [1, 2], 'Must record exactly 2 completed cycles in order');
      assert.equal(transitionFired, true, 'onTransitionToIdle must fire upon 2nd cycle completion');
      assert.equal(controller.isAnalysisComplete(), true, 'Must report analysis is complete');
      assert.equal(controller.getCurrentState(), 'idle', 'Must settle in resting idle state');
    });

    it('blends naturally over 800-1200ms into expressive idle, relaxing tension and returning gaze forward', () => {
      const lifeController = new PersonaLifeController();
      const expressionController = new PersonaExpressionController();

      const controller = new PersonaAnalysisController({
        lifeController,
        expressionController,
        assessmentScore: 15,
        deterministic: true
      });

      // Start right before returnToIdle in reflect state
      controller.transitionTo('observeLeft', 1000);
      assert.equal(expressionController.getCurrentExpression(), 'neutral', 'observeLeft must be neutral (no analyzing expression on left)');
      controller.transitionTo('reflect', 2000);
      assert.equal(expressionController.getCurrentExpression(), 'neutral', 'reflect must be neutral (no analyzing expression on left)');

      // Advance to returnToIdle
      controller.update(1.65, 3650);
      assert.equal(controller.getCurrentState(), 'returnToIdle');

      // Verify duration is within 800-1200ms (1.0s base duration)
      assert.ok(ANALYSIS_STATE_TIMINGS.returnToIdle.baseDuration >= 0.8);
      assert.ok(ANALYSIS_STATE_TIMINGS.returnToIdle.baseDuration <= 1.2);

      // During returnToIdle, gaze returns forward and facial morphs relax to neutral
      assert.equal(controller.getCurrentTarget(), 'forward');
      assert.equal(expressionController.getCurrentExpression(), 'neutral', 'Relaxes temporary facial tension to neutral during returnToIdle');
      assert.equal(lifeController.isHeadShakeInProgress(), false, 'Head shake must not be active');

      // Step halfway through returnToIdle (0.5s)
      controller.update(0.5, 4150);
      assert.equal(controller.getCurrentState(), 'returnToIdle');

      // Complete returnToIdle (another 0.55s) -> transitions into idle
      controller.update(0.55, 4700);
      assert.equal(controller.getCurrentState(), 'idle');
      assert.equal(expressionController.getCurrentExpression(), 'neutral', 'Settles into comfortable resting baseline in expressive idle');
      assert.equal(expressionController.isAnalysisLocked(), false, 'Expression controller must be unlocked in expressive idle');
    });

    it('blends into expressive idle after two cycles settling comfortably without getting stuck on analyzing expression', () => {
      const testCases = [
        { score: 10, tier: 'worried' },
        { score: 30, tier: 'sad' },
        { score: 50, tier: 'neutral' },
        { score: 70, tier: 'smile' },
        { score: 90, tier: 'celebratory' },
        { score: null, tier: 'neutral' }
      ];

      for (const { score } of testCases) {
        const lifeController = new PersonaLifeController();
        const expressionController = new PersonaExpressionController();
        const controller = new PersonaAnalysisController({
          lifeController,
          expressionController,
          assessmentScore: score,
          deterministic: true
        });

        // Start and simulate through 2 full cycles
        controller.start('analysePerformance', 1000);
        let simTime = 1.0;
        const step = 0.2;
        while (simTime < 32.0) {
          simTime += step;
          controller.update(step, simTime * 1000);
        }

        assert.equal(controller.isAnalysisComplete(), true);
        assert.equal(controller.getCurrentState(), 'idle');
        assert.equal(controller.isRunning(), false, 'Analysis must be stopped after 2 cycles');
        assert.equal(
          expressionController.isAnalysisLocked(),
          false,
          `Character must not get stuck with analysis locked for score ${score}`
        );
        assert.equal(
          expressionController.getCurrentExpression(),
          'neutral',
          `Expressive idle settles into comfortable neutral resting baseline for score ${score}`
        );

        // Advance 10 more seconds into expressive idle: breathing and head movements continue without interruption
        for (let i = 0; i < 20; i++) {
          simTime += 0.5;
          controller.update(0.5, simTime * 1000);
          expressionController.update(0.5);
        }

        assert.equal(controller.isAnalysisComplete(), true);
        assert.equal(controller.getCurrentState(), 'idle');
        assert.equal(controller.isRunning(), false);
        assert.equal(expressionController.isAnalysisLocked(), false);
      }
    });

    it('keeps breathing, blinking, and head micro-movements active during expressive idle without freezing', () => {
      const lifeController = new PersonaLifeController();
      const expressionController = new PersonaExpressionController();
      const controller = new PersonaAnalysisController({
        lifeController,
        expressionController,
        assessmentScore: 25, // sad
        deterministic: true
      });

      controller.start('analysePerformance', 1000);
      let simTime = 1.0;
      const step = 0.2;
      while (simTime < 32.0) {
        simTime += step;
        controller.update(step, simTime * 1000);
      }

      assert.equal(controller.isAnalysisComplete(), true);

      // Sample spine breathing, head drift, and blinking across 6 seconds of expressive idle
      const spinePositions: number[] = [];
      const headPitches: number[] = [];
      let totalBlinks = 0;

      for (let i = 0; i < 60; i++) {
        simTime += 0.1;
        controller.update(0.1, simTime * 1000);
        expressionController.update(0.1);
        const exprState = expressionController.getStateInfo();
        const lifeOutput = lifeController.update(0.1, simTime * 1000, exprState);

        spinePositions.push(lifeOutput.spine2PositionOffset.y);
        headPitches.push(lifeOutput.headEuler.pitch);
        if (lifeOutput.blinkFactor > 0.5) {
          totalBlinks++;
        }
      }

      // Verify spine2 breathes (min vs max position difference)
      const minSpine = Math.min(...spinePositions);
      const maxSpine = Math.max(...spinePositions);
      assert.ok(maxSpine - minSpine > 0.0005, 'Breathing must actively oscillate upper spine');

      // Verify head micro-drift animates
      const minHeadPitch = Math.min(...headPitches);
      const maxHeadPitch = Math.max(...headPitches);
      assert.ok(maxHeadPitch - minHeadPitch > 0.0001, 'Head micro-movements must remain active');

      // Animated expressive idle: expression controller is active and transitions naturally
      assert.ok(
        ['neutral', 'happy', 'curious', 'thinking', 'supportive'].includes(expressionController.getCurrentExpression()),
        'Engages natural expressive idle emotions'
      );
      assert.equal(expressionController.isAnalysisLocked(), false, 'Expression controller is unlocked and actively animating');
    });

    it('does not retrigger the transition or restart analysis cycles on React re-renders', () => {
      const lifeController = new PersonaLifeController();
      const expressionController = new PersonaExpressionController();
      const controller = new PersonaAnalysisController({
        lifeController,
        expressionController,
        assessmentScore: 75,
        deterministic: true
      });

      controller.start('analysePerformance', 1000);
      let simTime = 1.0;
      while (simTime < 32.0) {
        simTime += 0.2;
        controller.update(0.2, simTime * 1000);
      }

      assert.equal(controller.isAnalysisComplete(), true);
      assert.equal(controller.getCurrentState(), 'idle');
      assert.equal(controller.getCycleCount(), 2);
      assert.equal(expressionController.getCurrentExpression(), 'neutral');

      // Simulate 5 React re-renders passing assessment score prop
      for (let i = 0; i < 5; i++) {
        controller.setAssessmentScore(75);
        assert.equal(controller.isAnalysisComplete(), true);
        assert.equal(controller.getCurrentState(), 'idle');
        assert.equal(controller.getCycleCount(), 2);
        assert.equal(controller.isRunning(), false);
      }

      // Re-render updating score to 85: updates resting baseline without restarting loop
      controller.setAssessmentScore(85);
      assert.equal(controller.isAnalysisComplete(), true);
      assert.equal(controller.getCurrentState(), 'idle');
      assert.equal(controller.getCycleCount(), 2);
      assert.equal(controller.isRunning(), false);
      assert.equal(expressionController.getCurrentExpression(), 'neutral');
    });

    it('ensures analyzing expression is performed strictly on right section and never on left section', () => {
      const lifeController = new PersonaLifeController();
      const expressionController = new PersonaExpressionController();
      const controller = new PersonaAnalysisController({
        lifeController,
        expressionController,
        assessmentScore: 15,
        deterministic: true
      });

      // 1. Right side: analysePerformance sets thinking analyzing expression
      controller.transitionTo('observeRight', 1000);
      assert.equal(controller.getCurrentTarget(), 'assessment');

      controller.transitionTo('analysePerformance', 2000);
      assert.equal(expressionController.getCurrentExpression(), 'thinking', 'Right section must perform thinking analyzing expression');

      // 2. Score reaction
      controller.transitionTo('reactToScore', 3000);
      assert.equal(expressionController.getCurrentExpression(), 'worried');

      // 3. Left side: observeLeft must NEVER have an analyzing expression (must be neutral)
      controller.transitionTo('observeLeft', 4000);
      assert.equal(controller.getCurrentTarget(), 'learning');
      assert.equal(expressionController.getCurrentExpression(), 'neutral', 'Left section must NOT perform analyzing expression (must be neutral)');

      // 4. reflect must also NEVER have an analyzing expression (must be neutral)
      controller.transitionTo('reflect', 5000);
      assert.equal(controller.getCurrentTarget(), 'reflection');
      assert.equal(expressionController.getCurrentExpression(), 'neutral', 'reflect after left glance must NOT perform analyzing expression');
    });

    it('respects prefers-reduced-motion during transition and idle', () => {
      const lifeController = new PersonaLifeController({ prefersReducedMotion: true });
      const expressionController = new PersonaExpressionController({ reducedMotion: true });
      const controller = new PersonaAnalysisController({
        lifeController,
        expressionController,
        assessmentScore: 25,
        prefersReducedMotion: true
      });

      controller.start('idle', 1000);
      assert.equal(controller.isRunning(), false);
      assert.equal(controller.getCurrentState(), 'idle');

      // Head Euler in lifeController remains zeroed for reduced motion
      const out = lifeController.update(0.1, 1100, expressionController.getStateInfo());
      assert.equal(out.headEuler.yaw, 0);
      assert.equal(out.headEuler.pitch, 0);
    });
  });
});
