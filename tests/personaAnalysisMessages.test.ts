import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PersonaAnalysisController,
  SCORE_ANALYSIS_MESSAGES,
  SCORE_PRESENTATION_RANGES,
  getScorePresentation,
  getScoreAnalysisMessage
} from '../src/components/persona/personaAnalysisController';
import { PersonaLifeController } from '../src/components/persona/personaLifeController';
import { PersonaExpressionController } from '../src/components/persona/personaExpressionController';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const canvasSrcPath = path.resolve(__dirname, '../src/components/persona/PersonaHumanoidCanvas.tsx');
const expSrcPath = path.resolve(__dirname, '../src/components/persona/PersonaExperience.tsx');
const cssSrcPath = path.resolve(__dirname, '../src/styles/persona.css');
const canvasSrc = fs.readFileSync(canvasSrcPath, 'utf8');
const expSrc = fs.readFileSync(expSrcPath, 'utf8');
const cssSrc = fs.readFileSync(cssSrcPath, 'utf8');

describe('GRAPHMIND — PERSONA: CONTEXTUAL SCORE-BASED ANALYSIS MESSAGES', () => {
  describe('1. Score-Based Message Pairs & Content Verification', () => {
    it('defines exact two-cycle message pairs for all five score ranges', () => {
      // 0% to <20% (WORRIED)
      assert.equal(
        SCORE_ANALYSIS_MESSAGES.worried.cycle1,
        'Oh no… this needs a little more work.',
        'Worried Cycle 1 message must match specification'
      );
      assert.equal(
        SCORE_ANALYSIS_MESSAGES.worried.cycle2,
        'Hmm… we’re not quite there yet. Let’s try again.',
        'Worried Cycle 2 message must match specification'
      );

      // 20% to <40% (SAD)
      assert.equal(
        SCORE_ANALYSIS_MESSAGES.sad.cycle1,
        'Ah… that didn’t go quite as planned.',
        'Sad Cycle 1 message must match specification'
      );
      assert.equal(
        SCORE_ANALYSIS_MESSAGES.sad.cycle2,
        'I’m a little concerned. Let’s revisit these concepts.',
        'Sad Cycle 2 message must match specification'
      );

      // 40% to <60% (NEUTRAL)
      assert.equal(
        SCORE_ANALYSIS_MESSAGES.neutral.cycle1,
        'Hmm, we’re making some progress.',
        'Neutral Cycle 1 message must match specification'
      );
      assert.equal(
        SCORE_ANALYSIS_MESSAGES.neutral.cycle2,
        'There’s still room to understand a little more.',
        'Neutral Cycle 2 message must match specification'
      );

      // 60% to <80% (SMILE)
      assert.equal(
        SCORE_ANALYSIS_MESSAGES.smile.cycle1,
        'Hey, that’s some nice progress!',
        'Smile Cycle 1 message must match specification'
      );
      assert.equal(
        SCORE_ANALYSIS_MESSAGES.smile.cycle2,
        'You’re getting the hang of this. Keep going!',
        'Smile Cycle 2 message must match specification'
      );

      // 80% to 100% (HAPPY)
      assert.equal(
        SCORE_ANALYSIS_MESSAGES.celebratory.cycle1,
        'Whoa, look at you! That’s impressive.',
        'Happy Cycle 1 message must match specification'
      );
      assert.equal(
        SCORE_ANALYSIS_MESSAGES.celebratory.cycle2,
        'Now that’s what I’m talking about. Well done!',
        'Happy Cycle 2 message must match specification'
      );
    });

    it('attaches correct messages to each tier in SCORE_PRESENTATION_RANGES', () => {
      for (const range of SCORE_PRESENTATION_RANGES) {
        assert.ok(range.messages, `Range ${range.tier} must have messages defined`);
        assert.ok(range.messages.cycle1.length > 0, `Range ${range.tier} must have non-empty cycle 1 message`);
        assert.ok(range.messages.cycle2.length > 0, `Range ${range.tier} must have non-empty cycle 2 message`);
      }
    });
  });

  describe('2. Exact Score Boundary Mapping Without Rounding', () => {
    it('maps boundaries 0 <= score < 20 to Worried messages', () => {
      assert.equal(getScoreAnalysisMessage(0, 1), 'Oh no… this needs a little more work.');
      assert.equal(getScoreAnalysisMessage(14, 1), 'Oh no… this needs a little more work.');
      assert.equal(getScoreAnalysisMessage(19.99, 1), 'Oh no… this needs a little more work.');
      assert.equal(getScoreAnalysisMessage(19.99, 2), 'Hmm… we’re not quite there yet. Let’s try again.');
    });

    it('maps boundaries 20 <= score < 40 to Sad messages', () => {
      assert.equal(getScoreAnalysisMessage(20, 1), 'Ah… that didn’t go quite as planned.');
      assert.equal(getScoreAnalysisMessage(25.5, 1), 'Ah… that didn’t go quite as planned.');
      assert.equal(getScoreAnalysisMessage(39.99, 1), 'Ah… that didn’t go quite as planned.');
      assert.equal(getScoreAnalysisMessage(39.99, 2), 'I’m a little concerned. Let’s revisit these concepts.');
    });

    it('maps boundaries 40 <= score < 60 to Neutral messages', () => {
      assert.equal(getScoreAnalysisMessage(40, 1), 'Hmm, we’re making some progress.');
      assert.equal(getScoreAnalysisMessage(50, 1), 'Hmm, we’re making some progress.');
      assert.equal(getScoreAnalysisMessage(59.99, 1), 'Hmm, we’re making some progress.');
      assert.equal(getScoreAnalysisMessage(59.99, 2), 'There’s still room to understand a little more.');
    });

    it('maps boundaries 60 <= score < 80 to Smile messages', () => {
      assert.equal(getScoreAnalysisMessage(60, 1), 'Hey, that’s some nice progress!');
      assert.equal(getScoreAnalysisMessage(75, 1), 'Hey, that’s some nice progress!');
      assert.equal(getScoreAnalysisMessage(79.99, 1), 'Hey, that’s some nice progress!');
      assert.equal(getScoreAnalysisMessage(79.99, 2), 'You’re getting the hang of this. Keep going!');
    });

    it('maps boundaries 80 <= score <= 100 to Happy messages', () => {
      assert.equal(getScoreAnalysisMessage(80, 1), 'Whoa, look at you! That’s impressive.');
      assert.equal(getScoreAnalysisMessage(95, 1), 'Whoa, look at you! That’s impressive.');
      assert.equal(getScoreAnalysisMessage(100, 1), 'Whoa, look at you! That’s impressive.');
      assert.equal(getScoreAnalysisMessage(100, 2), 'Now that’s what I’m talking about. Well done!');
    });

    it('returns null for missing, null, undefined, or NaN score (neutral fallback)', () => {
      assert.equal(getScoreAnalysisMessage(null, 1), null);
      assert.equal(getScoreAnalysisMessage(null, 2), null);
      assert.equal(getScoreAnalysisMessage(undefined, 1), null);
      assert.equal(getScoreAnalysisMessage(NaN, 1), null);
    });
  });

  describe('3. Cycle Synchronization & Message Timing Lifecycle', () => {
    it('displays Cycle 1 message during cycle 1 reactToScore and Cycle 2 message during cycle 2 reactToScore', () => {
      const lifeController = new PersonaLifeController();
      const expressionController = new PersonaExpressionController();
      const messageEvents: Array<{ msg: string | null; cycle: 1 | 2 }> = [];

      const controller = new PersonaAnalysisController({
        lifeController,
        expressionController,
        assessmentScore: 14, // Worried
        deterministic: true,
        onMessageChange: (msg, cycle) => {
          messageEvents.push({ msg, cycle });
        }
      });

      // Start in observeRight -> analysePerformance
      controller.start('observeRight', 1000);
      assert.equal(controller.getCurrentMessage(), null, 'No message before reactToScore');

      // 1. Cycle 1: Transition into reactToScore
      controller.transitionTo('reactToScore', 2000);
      assert.equal(controller.getCurrentMessage(), 'Oh no… this needs a little more work.');
      assert.equal(controller.getCurrentMessageCycle(), 1);
      assert.equal(expressionController.getCurrentExpression(), 'worried');

      // 2. Cycle 1: Transition to returnToIdle -> message is dismissed
      controller.transitionTo('returnToIdle', 5200);
      assert.equal(controller.getCurrentMessage(), null, 'Message dismissed in returnToIdle');

      // 3. Cycle 1: Settle into idle -> cycleCount becomes 1
      controller.transitionTo('idle', 6200);
      assert.equal(controller.getCurrentMessage(), null);
      assert.equal(controller.getCycleCount(), 1);

      // 4. Cycle 2: Transition through observeRight -> analysePerformance
      controller.transitionTo('observeRight', 9200);
      assert.equal(controller.getCurrentMessage(), null);
      controller.transitionTo('analysePerformance', 10800);
      assert.equal(controller.getCurrentMessage(), null);

      // 5. Cycle 2: Transition into reactToScore -> Cycle 2 message displays
      controller.transitionTo('reactToScore', 13200);
      assert.equal(controller.getCurrentMessage(), 'Hmm… we’re not quite there yet. Let’s try again.');
      assert.equal(controller.getCurrentMessageCycle(), 2);
      assert.equal(expressionController.getCurrentExpression(), 'worried');

      // 6. Cycle 2: Transition to returnToIdle -> message dismissed
      controller.transitionTo('returnToIdle', 16400);
      assert.equal(controller.getCurrentMessage(), null);

      // 7. Cycle 2 complete: Settle into permanent expressive idle
      controller.transitionTo('idle', 17400);
      assert.equal(controller.getCurrentMessage(), null);
      assert.equal(controller.isAnalysisComplete(), true);
      assert.equal(controller.isRunning(), false);

      // Verify sequence of message changes
      assert.equal(messageEvents[0].msg, 'Oh no… this needs a little more work.');
      assert.equal(messageEvents[0].cycle, 1);
      assert.equal(messageEvents[1].msg, null);
      assert.equal(messageEvents[2].msg, 'Hmm… we’re not quite there yet. Let’s try again.');
      assert.equal(messageEvents[2].cycle, 2);
      assert.equal(messageEvents[3].msg, null);
    });

    it('shows each message exactly once per cycle and does not replay due to eye-tracking or blinking', () => {
      const lifeController = new PersonaLifeController();
      const expressionController = new PersonaExpressionController();
      let emitCount = 0;

      const controller = new PersonaAnalysisController({
        lifeController,
        expressionController,
        assessmentScore: 85, // Happy
        deterministic: true,
        onMessageChange: (msg) => {
          if (msg !== null) emitCount++;
        }
      });

      controller.start('analysePerformance', 1000);
      controller.transitionTo('reactToScore', 3400);
      assert.equal(emitCount, 1, 'Message emitted once upon entering reactToScore');

      // Simulate 50 frames of animation, eye-tracking updates, blinks, and micro-movements
      for (let i = 0; i < 50; i++) {
        controller.update(0.016, 3400 + i * 16);
        lifeController.update(0.016, 3400 + i * 16, expressionController.getStateInfo());
        lifeController.triggerBlink(0.14);
      }

      // Emitted count must remain exactly 1 throughout the reactToScore state
      assert.equal(emitCount, 1, 'Must not replay message during animation, blinking, or eye tracking updates');
      assert.equal(controller.getCurrentMessage(), 'Whoa, look at you! That’s impressive.');
    });
  });

  describe('4. Dynamic Score Changes & Fallbacks', () => {
    it('crosses into a different score range dynamically during reactToScore and updates message and expression', () => {
      const lifeController = new PersonaLifeController();
      const expressionController = new PersonaExpressionController();
      const messages: string[] = [];

      const controller = new PersonaAnalysisController({
        lifeController,
        expressionController,
        assessmentScore: 15, // Worried
        deterministic: true,
        onMessageChange: (msg) => {
          if (msg) messages.push(msg);
        }
      });

      controller.start('analysePerformance', 1000);
      controller.transitionTo('reactToScore', 3400);
      assert.equal(controller.getCurrentMessage(), 'Oh no… this needs a little more work.');
      assert.equal(expressionController.getCurrentExpression(), 'worried');

      // Dynamically update score to 85 (Happy)
      controller.setAssessmentScore(85);
      assert.equal(controller.getCurrentMessage(), 'Whoa, look at you! That’s impressive.');
      assert.equal(expressionController.getCurrentExpression(), 'happy');

      // Dynamically update score to 50 (Neutral)
      controller.setAssessmentScore(50);
      assert.equal(controller.getCurrentMessage(), 'Hmm, we’re making some progress.');
      assert.equal(expressionController.getCurrentExpression(), 'neutral');

      // Dynamically clear score to null
      controller.setAssessmentScore(null);
      assert.equal(controller.getCurrentMessage(), null);
      assert.equal(expressionController.getCurrentExpression(), 'neutral');
    });

    it('clears message and does not display score-specific text when score is missing', () => {
      const lifeController = new PersonaLifeController();
      const expressionController = new PersonaExpressionController();
      let displayedMessage: string | null = null;

      const controller = new PersonaAnalysisController({
        lifeController,
        expressionController,
        assessmentScore: null,
        deterministic: true,
        onMessageChange: (msg) => {
          displayedMessage = msg;
        }
      });

      controller.start('analysePerformance', 1000);
      controller.transitionTo('reactToScore', 3400);

      assert.equal(displayedMessage, null, 'Must not display message when assessment score is missing');
      assert.equal(controller.getCurrentMessage(), null);
      assert.equal(expressionController.getCurrentExpression(), 'neutral');
    });

    it('cleans up message on stop() and dispose()', () => {
      const lifeController = new PersonaLifeController();
      const expressionController = new PersonaExpressionController();
      const controller = new PersonaAnalysisController({
        lifeController,
        expressionController,
        assessmentScore: 70,
        deterministic: true
      });

      controller.start('analysePerformance', 1000);
      controller.transitionTo('reactToScore', 3400);
      assert.ok(controller.getCurrentMessage() !== null);

      controller.stop();
      assert.equal(controller.getCurrentMessage(), null, 'stop() must clear currentMessage');

      controller.transitionTo('reactToScore', 5000);
      controller.dispose();
      assert.equal(controller.getCurrentMessage(), null, 'dispose() must clear currentMessage');
    });
  });

  describe('5. Component Integration & Visual Design Verification', () => {
    it('verifies PersonaHumanoidCanvas exposes onAnalysisMessageChange prop and connects to controller', () => {
      assert.ok(canvasSrc.includes('onAnalysisMessageChange?: (message: string | null, cycle: 1 | 2) => void;'));
      assert.ok(canvasSrc.includes('onAnalysisMessageChangeRef.current?.(msg, cycle)'));
    });

    it('verifies PersonaExperience receives onAnalysisMessageChange and renders accessible message element', () => {
      assert.ok(expSrc.includes('onAnalysisMessageChange={setAnalysisMessage}'), 'PersonaExperience must pass setAnalysisMessage to canvas');
      assert.ok(expSrc.includes('persona-analysis-message-container'), 'Must render persona-analysis-message-container');
      assert.ok(expSrc.includes('persona-analysis-message'), 'Must render persona-analysis-message');
      assert.ok(expSrc.includes('persona-analysis-message-dot'), 'Must render lime-green accent dot');
      assert.ok(expSrc.includes('persona-analysis-message-text'), 'Must render text content');
      assert.ok(expSrc.includes('aria-live="polite"'), 'Must have polite accessibility live region for screen readers');
      assert.ok(expSrc.includes('data-analysis-message="true"'), 'Must have data attribute for automated verification');
    });

    it('verifies persona.css styles the analysis message container and text capsule with elegance', () => {
      assert.ok(cssSrc.includes('.persona-analysis-message-container'), 'Must define .persona-analysis-message-container');
      assert.ok(cssSrc.includes('.persona-analysis-message {'), 'Must define .persona-analysis-message');
      assert.ok(cssSrc.includes('.persona-analysis-message-dot'), 'Must define .persona-analysis-message-dot');
      assert.ok(cssSrc.includes('#00E575'), 'Must use restrained lime-green accent #00E575');
      assert.ok(cssSrc.includes('backdrop-filter: blur'), 'Must use subtle frosted backdrop blur');
    });
  });
});
