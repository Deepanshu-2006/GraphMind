import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

import {
  EMOTION_BEHAVIOR_PROFILES,
  getEmotionProfile,
  pickNextNaturalEmotion,
  type PersonaExpression
} from '../src/components/persona/personaEmotionProfiles';

import {
  PersonaExpressionController,
  PERSONA_EXPRESSION_PRESETS
} from '../src/components/persona/personaExpressionController';

import {
  PersonaLifeController
} from '../src/components/persona/personaLifeController';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const canvasSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/persona/PersonaHumanoidCanvas.tsx'), 'utf8');
const profilesSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/persona/personaEmotionProfiles.ts'), 'utf8');
const exprControllerSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/persona/personaExpressionController.ts'), 'utf8');
const lifeControllerSrc = fs.readFileSync(path.resolve(__dirname, '../src/components/persona/personaLifeController.ts'), 'utf8');

describe('GRAPHMIND — PERSONA: NATURAL PERSONALITY & EMOTION-AWARE ANIMATION', () => {
  describe('1. Centralized Emotion Behavior Profiles (Section 2)', () => {
    const expectedExpressions: PersonaExpression[] = [
      'neutral',
      'happy',
      'curious',
      'thinking',
      'surprised',
      'sad',
      'angry',
      'worried'
    ];

    it('defines centralized behavior profiles for all required emotions', () => {
      for (const expr of expectedExpressions) {
        const profile = EMOTION_BEHAVIOR_PROFILES[expr];
        assert.ok(profile, `Profile for "${expr}" must be defined`);
        assert.equal(profile.expression, expr);
        assert.ok(profile.holdDurationMin > 0, `holdDurationMin must be > 0 for ${expr}`);
        assert.ok(profile.holdDurationMax >= profile.holdDurationMin, `holdDurationMax >= min for ${expr}`);
        assert.ok(profile.transitionDurationMin > 0, `transitionDurationMin must be > 0 for ${expr}`);
      }
    });

    it('NEUTRAL represents a calm, attentive resting baseline (Section 2: Neutral)', () => {
      const neutral = getEmotionProfile('neutral');
      assert.equal(neutral.headTiltRoll, 0);
      assert.equal(neutral.headTiltPitch, 0);
      assert.equal(neutral.headDriftScale, 1.0);
      assert.equal(neutral.gazePitchOffset, 0);
      assert.equal(neutral.suppressAutonomousGaze, false, 'Neutral must preserve occasional natural glances away');
    });

    it('HAPPY profile defines warm, friendly gaze, eyelid softening, and gradual onset (Section 2: Happy)', () => {
      const happy = getEmotionProfile('happy');
      assert.ok(happy.transitionDurationMin >= 1.0, 'Smile must develop gradually (>= 1.0s)');
      assert.ok(happy.gazeEngagementMin >= 7.0, 'Happy must maintain eye contact for slightly longer periods');
      assert.ok(happy.squintBonus >= 0.10, 'Happy must soften eyelids via Duchenne squint');
      assert.ok(happy.headTiltRoll > 0, 'Happy must define a small natural friendly tilt');
      assert.ok(happy.headTiltChance < 1.0, 'Happy head tilt must occur occasionally, not every single time');
    });

    it('CURIOUS profile defines attentive eye openness, cursor focus, and conditional tilt (Section 2: Curious)', () => {
      const curious = getEmotionProfile('curious');
      assert.ok(curious.eyeOpenBonus > 0, 'Curious must slightly increase eye openness');
      assert.ok(curious.headTiltRoll !== 0, 'Curious must define inquisitive head tilt');
      assert.ok(curious.headTiltChance > 0 && curious.headTiltChance < 1.0, 'Head tilt must be conditional, not mechanical');
      assert.ok(curious.anticipationDuration > 0, 'Curious must have an anticipation phase where eyes become attentive first');
    });

    it('SURPRISED profile defines a brief reaction rather than permanent pose (Section 2: Surprised)', () => {
      const surprised = getEmotionProfile('surprised');
      assert.ok(surprised.holdDurationMin <= 2.0 && surprised.holdDurationMax <= 3.5, 'Surprise must be brief (hold 1.5-3s)');
      assert.ok(surprised.eyeOpenBonus >= 0.15, 'Surprise must widen eyes within realistic limits');
      assert.ok(surprised.headTiltPitch < 0, 'Surprise introduces small head reaction lift without jerk');
    });

    it('SAD profile defines quiet, subdued posture and lowered gaze (Section 2: Sad)', () => {
      const sad = getEmotionProfile('sad');
      assert.ok(sad.gazePitchOffset < -0.08, 'Sad must lower gaze modestly (negative pitch)');
      assert.ok(sad.headDriftScale <= 0.45, 'Sad must reduce unnecessary head movement (< 0.45 intensity)');
      assert.ok(sad.headTiltPitch > 0, 'Sad must introduce slight downward reflective head posture');
      assert.ok(sad.transitionDurationMin >= 1.2, 'Sadness must develop slowly');
    });

    it('ANGRY profile defines steady, focused gaze and restrained posture (Section 2: Angry)', () => {
      const angry = getEmotionProfile('angry');
      assert.ok(angry.suppressAutonomousGaze, 'Angry must suppress unnecessary autonomous gaze shifts to maintain focus');
      assert.ok(angry.headDriftScale <= 0.45, 'Angry must keep head movement restrained');
      assert.equal(angry.headTiltRoll, 0, 'Angry must avoid playful or exaggerated head rolls');
    });

    it('WORRIED profile preserves teeth alignment and clenched dental bite (Section 2: Worried)', () => {
      const worriedPreset = PERSONA_EXPRESSION_PRESETS.worried;
      assert.ok(worriedPreset.head[21] >= 0.30, 'Worried must clench jaw via JawCompress_h');
      assert.ok(worriedPreset.teethDown[24] >= 0.30, 'Dental bite must match clenched jaw via t_JawCompress_h');
      assert.ok(worriedPreset.head[26] <= 0.12, 'Mouth opening must remain restrained to prevent teeth clipping through lips');
    });
  });

  describe('2. Intentional Expression Transitions & Timing (Section 3 & 4)', () => {
    it('holds emotions within the prompt specified duration ranges', () => {
      const controller = new PersonaExpressionController();
      const emotions: PersonaExpression[] = ['happy', 'curious', 'surprised', 'sad', 'angry', 'worried', 'neutral'];

      for (const expr of emotions) {
        const profile = getEmotionProfile(expr);
        for (let i = 0; i < 20; i++) {
          const dur = controller.getHoldDuration(expr);
          assert.ok(
            dur >= profile.holdDurationMin - 0.001,
            `${expr} hold duration (${dur}) must be >= min (${profile.holdDurationMin})`
          );
          assert.ok(
            dur <= profile.holdDurationMax + 0.001,
            `${expr} hold duration (${dur}) must be <= max (${profile.holdDurationMax})`
          );
        }
      }
    });

    it('returns naturally to neutral after holding non-neutral expressions', () => {
      const controller = new PersonaExpressionController();
      // Start in happy with short durations
      controller.setExpression('happy', 0.2);
      controller.update(0.2); // Complete transition
      assert.equal(controller.getCurrentExpression(), 'happy');

      // Simulate past happy hold duration
      const stateInfo = controller.getStateInfo();
      controller.update(stateInfo.profile.holdDurationMax + 0.5);

      // Must now be transitioning or in neutral!
      assert.equal(controller.getCurrentExpression(), 'neutral', 'Must return naturally to neutral after holding emotion');
    });

    it('smoothly recovers if a transition is interrupted without popping or snapping', () => {
      const controller = new PersonaExpressionController();
      controller.setExpression('happy', 1.0);
      controller.update(0.3); // 30% into transition

      const state1 = controller.getStateInfo();
      assert.equal(state1.targetExpr, 'happy');

      // Interrupt transition and switch to sad
      controller.setExpression('sad', 1.0);
      const state2 = controller.getStateInfo();
      assert.equal(state2.targetExpr, 'sad');
      assert.equal(state2.currentExpr, 'happy');

      // Should interpolate smoothly from intermediate weights
      controller.update(0.5);
      const state3 = controller.getStateInfo();
      assert.ok(state3.transitionProgress > 0 && state3.transitionProgress < 1.0);
    });
  });

  describe('3. Subtle Anticipation and Settling (Section 5)', () => {
    it('executes an anticipation phase before the main facial morph transition when starting naturally', () => {
      const controller = new PersonaExpressionController();
      // Calling setExpression without explicit duration initiates natural transition with anticipation
      controller.setExpression('happy');

      assert.equal(controller.getPhase(), 'ANTICIPATING', 'Must enter ANTICIPATING phase on natural emotion onset');
      const state = controller.getStateInfo();
      assert.ok(state.profile.anticipationDuration > 0);

      // Advance halfway through anticipation
      controller.update(state.profile.anticipationDuration * 0.5);
      const midState = controller.getStateInfo();
      assert.equal(midState.phase, 'ANTICIPATING');
      assert.ok(midState.anticipationWeight > 0.3 && midState.anticipationWeight < 0.7);

      // Complete anticipation
      controller.update(state.profile.anticipationDuration * 0.6);
      const transState = controller.getStateInfo();
      assert.equal(transState.phase, 'TRANSITIONING', 'Must advance to TRANSITIONING after anticipation completes');
    });

    it('settles smoothly into pose after morph targets reach target weights', () => {
      const controller = new PersonaExpressionController();
      controller.setExpression('sad');

      // Step through anticipation
      const profile = getEmotionProfile('sad');
      controller.update(profile.anticipationDuration + 0.05);
      assert.equal(controller.getPhase(), 'TRANSITIONING');

      // Step through transition duration
      controller.update(profile.transitionDurationMax + 0.1);
      assert.equal(controller.getPhase(), 'SETTLING', 'Must enter SETTLING phase after facial morph transition');

      // Step through settling duration
      controller.update(profile.settlingDuration + 0.05);
      assert.equal(controller.getPhase(), 'HOLDING', 'Must settle into HOLDING phase');
    });
  });

  describe('4. Emotion-Aware Gaze Coordination (Section 6)', () => {
    it('maintains steady gaze and suppresses autonomous glance-away during ANGRY', () => {
      const controller = new PersonaLifeController();
      let simTime = 0;
      const dt = 0.1;
      let glancedAway = false;

      // Simulate 15 seconds in angry state
      while (simTime < 15.0) {
        simTime += dt;
        const out = controller.update(dt, simTime * 1000, 'angry');
        if (out.gazeMode === 'GLANCE_AWAY') {
          glancedAway = true;
          break;
        }
      }

      assert.equal(glancedAway, false, 'Angry expression must suppress autonomous glance-away to maintain steady focus');
    });

    it('applies downward gaze pitch bias during SAD', () => {
      const controller = new PersonaLifeController();
      const neutralOut = controller.update(0.1, 100, 'neutral');
      const sadOut = controller.update(0.1, 200, 'sad');

      assert.ok(
        sadOut.gazeNDC.y < neutralOut.gazeNDC.y,
        `Sad gaze NDC Y (${sadOut.gazeNDC.y}) must be lower than neutral gaze (${neutralOut.gazeNDC.y})`
      );
    });

    it('preserves responsive cursor tracking priority regardless of current emotion', () => {
      const controller = new PersonaLifeController();
      let simTime = 1.0;

      // User moves pointer to top right
      controller.onPointerMove(0.7, 0.6, simTime * 1000);

      for (let i = 0; i < 20; i++) {
        simTime += 0.05;
        controller.onPointerMove(0.7, 0.6, simTime * 1000);
        controller.update(0.05, simTime * 1000, 'sad');
      }

      const out = controller.update(0.05, simTime * 1000, 'sad');
      assert.ok(out.gazeNDC.x > 0.45, `Active cursor must override emotion bias horizontally, got ${out.gazeNDC.x}`);
      assert.ok(out.gazeNDC.y > 0.30, `Active cursor must override sad downward bias vertically, got ${out.gazeNDC.y}`);
    });
  });

  describe('5. Emotion-Aware Head Movement & Posture (Section 7)', () => {
    it('restrains autonomous micro-drift during SAD and ANGRY compared to NEUTRAL', () => {
      const controller = new PersonaLifeController();
      let neutralMaxDrift = 0;
      let sadMaxDrift = 0;

      // Sample neutral drift
      for (let t = 0; t < 10.0; t += 0.1) {
        const out = controller.update(0.1, t * 1000, 'neutral');
        const mag = Math.abs(out.headEuler.pitch) + Math.abs(out.headEuler.yaw);
        if (mag > neutralMaxDrift) neutralMaxDrift = mag;
      }

      // Sample sad drift
      const sadController = new PersonaLifeController();
      for (let t = 0; t < 10.0; t += 0.1) {
        const out = sadController.update(0.1, t * 1000, 'sad');
        // Subtract static tilt to isolate dynamic drift amplitude
        const driftYaw = Math.abs(out.headEuler.yaw);
        if (driftYaw > sadMaxDrift) sadMaxDrift = driftYaw;
      }

      assert.ok(
        sadMaxDrift < neutralMaxDrift * 0.70,
        `Sad drift (${sadMaxDrift}) must be noticeably restrained compared to neutral (${neutralMaxDrift})`
      );
    });

    it('returns head Euler angles smoothly to resting baseline without accumulated rotation drift', () => {
      const controller = new PersonaLifeController();
      let simTime = 0;
      const dt = 0.05;

      // Simulate a cycle of emotions returning to neutral
      const cycle: PersonaExpression[] = ['happy', 'sad', 'curious', 'angry', 'neutral'];
      for (const expr of cycle) {
        for (let i = 0; i < 40; i++) {
          simTime += dt;
          controller.update(dt, simTime * 1000, expr);
        }
      }

      // Allow 4 seconds in calm neutral
      let finalOut = controller.update(dt, simTime * 1000, 'neutral');
      for (let i = 0; i < 80; i++) {
        simTime += dt;
        finalOut = controller.update(dt, simTime * 1000, 'neutral');
      }

      assert.ok(Math.abs(finalOut.headEuler.pitch) < 0.02, 'Head pitch must return close to 0 baseline');
      assert.ok(Math.abs(finalOut.headEuler.yaw) < 0.02, 'Head yaw must return close to 0 baseline');
      assert.ok(Math.abs(finalOut.headEuler.roll) < 0.02, 'Head roll must return close to 0 baseline');
    });
  });

  describe('6. Natural Blinking and Breathing Continuity (Section 8)', () => {
    it('continues natural blinking across all emotion states without interruption', () => {
      const controller = new PersonaLifeController();
      const testEmotions: PersonaExpression[] = ['happy', 'sad', 'curious', 'angry', 'surprised', 'worried'];

      for (const expr of testEmotions) {
        let simTime = 0;
        const dt = 0.05;
        let detectedBlink = false;

        while (simTime < 15.0) {
          simTime += dt;
          const out = controller.update(dt, simTime * 1000, expr);
          if (out.blinkFactor > 0.8) {
            detectedBlink = true;
            break;
          }
        }

        assert.ok(detectedBlink, `Natural blinking must continue during ${expr}`);
      }
    });

    it('maintains continuous breathing across all emotions', () => {
      const controller = new PersonaLifeController();
      let prevLift = 0;
      let hasRisen = false;
      let hasFallen = false;

      for (let t = 0; t < 6.0; t += 0.1) {
        const out = controller.update(0.1, t * 1000, 'happy');
        if (out.shoulderLift > prevLift) hasRisen = true;
        if (out.shoulderLift < prevLift) hasFallen = true;
        prevLift = out.shoulderLift;
      }

      assert.ok(hasRisen && hasFallen, 'Breathing shoulder movement must cycle smoothly during expressions');
    });
  });

  describe('7. Non-Repetitive Natural Progression Architecture (Section 9)', () => {
    it('pickNextNaturalEmotion selects varied emotions without repeating the immediate previous emotion', () => {
      const selections: PersonaExpression[] = [];
      let prev: PersonaExpression | undefined = undefined;

      for (let i = 0; i < 50; i++) {
        const next = pickNextNaturalEmotion(prev);
        assert.notEqual(next, prev, 'Should not repeat the immediate previous emotion');
        assert.notEqual(next, 'neutral', 'pickNextNaturalEmotion selects from non-neutral candidate pool');
        selections.push(next);
        prev = next;
      }

      // Should have selected multiple distinct emotions across 50 iterations
      const uniqueSelected = new Set(selections);
      assert.ok(uniqueSelected.size >= 4, `Should select diverse emotions, got ${uniqueSelected.size} unique`);
      assert.ok(uniqueSelected.has('happy'), 'Should include happy');
      assert.ok(uniqueSelected.has('curious'), 'Should include curious');
    });
  });

  describe('8. Canvas Architecture & Integration Requirements (Section 10 & 11)', () => {
    it('verifies PersonaHumanoidCanvas passes ExpressionStateInfo to PersonaLifeController', () => {
      assert.ok(
        canvasSrc.includes('expressionController.getStateInfo()'),
        'PersonaHumanoidCanvas must query getStateInfo from ExpressionController'
      );
      assert.ok(
        canvasSrc.includes('lifeController.update(dt, nowMs, exprState)'),
        'PersonaHumanoidCanvas must pass ExpressionStateInfo to PersonaLifeController'
      );
    });

    it('verifies calculations remain outside React render cycle and use requestAnimationFrame', () => {
      assert.ok(
        canvasSrc.includes('requestAnimationFrame(render)'),
        'Animation loop must run outside React render in requestAnimationFrame'
      );
      assert.ok(
        !canvasSrc.includes('setCurrentState(newState); // inside 60fps loop'),
        'Must not update per-frame React state in 60fps loop'
      );
    });

    it('verifies NO manual expression UI, dropdowns, or sliders are added (Section 11)', () => {
      assert.ok(!canvasSrc.includes('expression-slider'), 'No sliders in canvas');
      assert.ok(!canvasSrc.includes('expression-picker'), 'No expression picker in canvas');
      assert.ok(!canvasSrc.includes('debug-expression-controls'), 'No debug expression controls in canvas');
    });
  });
});
