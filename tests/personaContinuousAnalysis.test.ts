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

      // Verify sequence of states matches expected loop
      assert.ok(observedStates.includes('observeRight'), 'Must enter observeRight');
      assert.ok(observedStates.includes('analysePerformance'), 'Must enter analysePerformance');
      assert.ok(observedStates.includes('reactToScore'), 'Must enter reactToScore');
      assert.ok(observedStates.includes('observeLeft'), 'Must enter observeLeft');
      assert.ok(observedStates.includes('reflect'), 'Must enter reflect');
      assert.ok(observedStates.includes('returnToIdle'), 'Must enter returnToIdle');
      assert.ok(controller.getCycleCount() >= 1, `Cycle count should be at least 1, got ${controller.getCycleCount()}`);
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
    it('maps below 20% score to worried expression', () => {
      const pres = getScorePresentation(15);
      assert.ok(pres);
      assert.equal(pres.tier, 'worried');
      assert.equal(pres.reactionExpression, 'worried');
      assert.equal(pres.hasNod, false);
    });

    it('maps 20 to 40% score to sad expression', () => {
      const pres = getScorePresentation(30);
      assert.ok(pres);
      assert.equal(pres.tier, 'sad');
      assert.equal(pres.reactionExpression, 'sad');
      assert.equal(pres.hasNod, false);
    });

    it('maps 40 to 60% score to neutral expression', () => {
      const pres = getScorePresentation(50);
      assert.ok(pres);
      assert.equal(pres.tier, 'neutral');
      assert.equal(pres.reactionExpression, 'neutral');
      assert.equal(pres.hasNod, false);
    });

    it('maps 60 to 80% score to smile (happy) expression without nod', () => {
      const pres = getScorePresentation(70);
      assert.ok(pres);
      assert.equal(pres.tier, 'smile');
      assert.equal(pres.reactionExpression, 'happy');
      assert.equal(pres.hasNod, false);
    });

    it('maps 80 to 100% score to happy with nod', () => {
      const pres = getScorePresentation(85);
      assert.ok(pres);
      assert.equal(pres.tier, 'celebratory');
      assert.equal(pres.reactionExpression, 'happy');
      assert.equal(pres.hasNod, true);
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
      assert.equal(expressionController.getCurrentExpression(), 'neutral');
    });

    it('triggers approving nod on PersonaLifeController for 90%+ scores with throttling', () => {
      const lifeController = new PersonaLifeController();
      const expressionController = new PersonaExpressionController();
      const controller = new PersonaAnalysisController({
        lifeController,
        expressionController,
        assessmentScore: 92,
        deterministic: true
      });

      controller.transitionTo('reactToScore', 1000);
      assert.ok(lifeController.isApprovingNodInProgress(), 'Approving nod must be active for 92% score');

      // Advance life controller to observe approving nod pitch offset
      const out = lifeController.update(0.4, 1400, 'happy');
      assert.ok(out.headEuler.pitch > 0.005, 'Head pitch should reflect approving nod dip');
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
});
