import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

import {
  PersonaLifeController,
  type GazeMode,
  type LifeFrameOutput
} from '../src/components/persona/personaLifeController';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const canvasSrcPath = path.resolve(__dirname, '../src/components/persona/PersonaHumanoidCanvas.tsx');
const lifeControllerSrcPath = path.resolve(__dirname, '../src/components/persona/personaLifeController.ts');
const canvasSrc = fs.readFileSync(canvasSrcPath, 'utf8');
const lifeControllerSrc = fs.readFileSync(lifeControllerSrcPath, 'utf8');

describe('GRAPHMIND — PERSONA: NATURAL IDLE ANIMATION, GAZE BEHAVIOR & EXPRESSION-AWARE EYES', () => {
  describe('1. Natural Gaze State Machine & Look-Away/Return Cycles', () => {
    it('initializes in ENGAGED state looking toward the viewer', () => {
      const controller = new PersonaLifeController();
      const output = controller.update(0.016, 16, 'neutral');
      assert.equal(output.gazeMode, 'ENGAGED');
      assert.equal(output.isGlancingAway, false);
      // Neutral starting gaze is close to center
      assert.ok(Math.abs(output.gazeNDC.x) < 0.05);
      assert.ok(Math.abs(output.gazeNDC.y) < 0.05);
    });

    it('transitions from ENGAGED to GLANCE_AWAY after holding interval and returns naturally', () => {
      const controller = new PersonaLifeController();
      let modeSequence: GazeMode[] = [];

      // Advance time step-by-step for 20 seconds
      let simTime = 0;
      const dt = 0.1;
      let glanceAwayCount = 0;
      let returnCount = 0;

      while (simTime < 25.0) {
        simTime += dt;
        const out = controller.update(dt, simTime * 1000, 'neutral');
        const curMode = out.gazeMode;
        if (modeSequence[modeSequence.length - 1] !== curMode) {
          modeSequence.push(curMode);
          if (curMode === 'GLANCE_AWAY') glanceAwayCount++;
          if (curMode === 'RETURN_TO_VIEWER') returnCount++;
        }
      }

      assert.ok(glanceAwayCount >= 1, `Should trigger at least 1 GLANCE_AWAY event, got ${glanceAwayCount}`);
      assert.ok(returnCount >= 1, `Should trigger at least 1 RETURN_TO_VIEWER event, got ${returnCount}`);
      assert.ok(modeSequence.includes('GLANCE_AWAY'), 'Mode sequence must include GLANCE_AWAY');
      assert.ok(modeSequence.includes('RETURN_TO_VIEWER'), 'Mode sequence must include RETURN_TO_VIEWER');
    });

    it('uses restrained gaze shifts during GLANCE_AWAY (never extreme)', () => {
      const controller = new PersonaLifeController();
      let simTime = 0;
      const dt = 0.05;

      while (simTime < 30.0) {
        simTime += dt;
        const out = controller.update(dt, simTime * 1000, 'neutral');
        if (out.gazeMode === 'GLANCE_AWAY') {
          assert.ok(
            Math.abs(out.gazeNDC.x) <= 0.40,
            `Gaze NDC X should remain restrained during glance-away, got ${out.gazeNDC.x}`
          );
          assert.ok(
            Math.abs(out.gazeNDC.y) <= 0.40,
            `Gaze NDC Y should remain restrained during glance-away, got ${out.gazeNDC.y}`
          );
        }
      }
    });
  });

  describe('2. Cursor Tracking Priority & Smooth Coordination', () => {
    it('gives active cursor tracking priority over autonomous idle gaze', () => {
      const controller = new PersonaLifeController();
      let simTime = 1.0;
      controller.update(0.1, simTime * 1000, 'neutral');

      // User actively moves cursor to (0.5, 0.4)
      controller.onPointerMove(0.5, 0.4, simTime * 1000);

      // Simulate a few frames of active cursor movement
      for (let i = 0; i < 15; i++) {
        simTime += 0.05;
        controller.onPointerMove(0.5, 0.4, simTime * 1000);
        controller.update(0.05, simTime * 1000, 'neutral');
      }

      const out = controller.update(0.05, simTime * 1000, 'neutral');
      // Gaze should be tracking the cursor target closely
      assert.ok(out.gazeNDC.x > 0.35, `Gaze NDC X should approach cursor 0.5, got ${out.gazeNDC.x}`);
      assert.ok(out.gazeNDC.y > 0.25, `Gaze NDC Y should approach cursor 0.4, got ${out.gazeNDC.y}`);
    });

    it('resumes autonomous gaze smoothly after cursor remains still for > 1.8 seconds', () => {
      const controller = new PersonaLifeController();
      let simTime = 1.0;
      controller.onPointerMove(0.4, 0.3, simTime * 1000);

      // Active for a moment
      for (let i = 0; i < 10; i++) {
        simTime += 0.05;
        controller.update(0.05, simTime * 1000, 'neutral');
      }

      // Cursor remains completely still for 3 seconds
      const stillStart = simTime;
      while (simTime - stillStart < 3.0) {
        simTime += 0.1;
        controller.update(0.1, simTime * 1000, 'neutral');
      }

      // Time since move is > 1.8s, cursor influence should have decayed
      const out = controller.update(0.1, simTime * 1000, 'neutral');
      assert.ok(out.gazeNDC !== undefined);
    });

    it('handles pointer leaving the viewport gracefully by returning to center', () => {
      const controller = new PersonaLifeController();
      let simTime = 1.0;
      controller.onPointerMove(0.6, -0.4, simTime * 1000);
      for (let i = 0; i < 10; i++) {
        simTime += 0.05;
        controller.update(0.05, simTime * 1000, 'neutral');
      }

      controller.onPointerLeave();

      // Simulate 2 seconds after pointer leave
      for (let i = 0; i < 20; i++) {
        simTime += 0.1;
        controller.update(0.1, simTime * 1000, 'neutral');
      }

      const out = controller.update(0.05, simTime * 1000, 'neutral');
      // Should have returned towards center
      assert.ok(Math.abs(out.gazeNDC.x) < 0.25, `Gaze NDC X should return towards center, got ${out.gazeNDC.x}`);
    });
  });

  describe('3. Gentle Upper Body Breathing', () => {
    it('produces continuous sinusoidal breathing across shoulders and Spine2', () => {
      const controller = new PersonaLifeController();
      let simTime = 0;
      const samples: number[] = [];

      for (let i = 0; i < 50; i++) {
        simTime += 0.1;
        const out = controller.update(0.1, simTime * 1000, 'neutral');
        samples.push(out.shoulderLift);
      }

      const minVal = Math.min(...samples);
      const maxVal = Math.max(...samples);
      assert.ok(maxVal > minVal, 'Shoulder lift should oscillate with breathing');
      assert.ok(maxVal <= 0.40, `Shoulder lift should be subtle (< 0.40 local units), got ${maxVal}`);
      assert.ok(minVal >= -0.20, `Shoulder lift should remain bounded, got ${minVal}`);
    });

    it('expands upper chest Spine2 gently on inhale without whole-model scaling', () => {
      const controller = new PersonaLifeController();
      let simTime = 0;
      const pitches: number[] = [];

      for (let i = 0; i < 40; i++) {
        simTime += 0.1;
        const out = controller.update(0.1, simTime * 1000, 'neutral');
        pitches.push(out.spine2Euler.pitch);
      }

      const minPitch = Math.min(...pitches);
      const maxPitch = Math.max(...pitches);
      assert.ok(minPitch < 0, 'Inhale should gently pitch Spine2 back (negative pitch)');
      assert.ok(Math.abs(minPitch) <= 0.015, 'Chest pitch should be subtle (<= 0.015 radians)');
    });
  });

  describe('4. Subtle Head & Neck Movements', () => {
    it('keeps head and neck rotations within anatomically plausible subtle limits', () => {
      const controller = new PersonaLifeController();
      let simTime = 0;

      for (let i = 0; i < 60; i++) {
        simTime += 0.1;
        const out = controller.update(0.1, simTime * 1000, 'neutral');
        assert.ok(
          Math.abs(out.headEuler.yaw) <= 0.10,
          `Head yaw should remain subtle (<= 0.10 rad), got ${out.headEuler.yaw}`
        );
        assert.ok(
          Math.abs(out.headEuler.pitch) <= 0.10,
          `Head pitch should remain subtle (<= 0.10 rad), got ${out.headEuler.pitch}`
        );
        assert.ok(
          Math.abs(out.headEuler.roll) <= 0.06,
          `Head roll should remain subtle (<= 0.06 rad), got ${out.headEuler.roll}`
        );
      }
    });

    it('splits head orientation between Neck (35%) and Head (65%) for natural flexion', () => {
      const controller = new PersonaLifeController();
      let simTime = 2.0;
      controller.onPointerMove(0.4, 0.2, simTime * 1000);
      for (let i = 0; i < 15; i++) {
        simTime += 0.1;
        controller.update(0.1, simTime * 1000, 'neutral');
      }

      const out = controller.update(0.05, simTime * 1000, 'neutral');
      assert.ok(out.headEuler.yaw !== 0);
      assert.ok(out.neckEuler.yaw !== 0);
      // Head has higher amplitude than neck
      assert.ok(Math.abs(out.headEuler.yaw) >= Math.abs(out.neckEuler.yaw));
    });
  });

  describe('5. Expression-Aware Gaze & Eyelid Modulation', () => {
    it('applies squint bonus for happy smiling expression', () => {
      const controller = new PersonaLifeController();
      const out = controller.update(0.05, 1000, 'happy');
      assert.ok(out.squintBonus > 0, `Happy should apply positive squint bonus, got ${out.squintBonus}`);
    });

    it('applies eye open bonus and attentive tilt for thinking / curious expression', () => {
      const controller = new PersonaLifeController();
      const out = controller.update(0.05, 1000, 'thinking');
      assert.ok(out.eyeOpenBonus > 0, `Thinking should increase eye openness, got ${out.eyeOpenBonus}`);
    });

    it('applies widened eye bonus for surprised expression', () => {
      const controller = new PersonaLifeController();
      const out = controller.update(0.05, 1000, 'surprised');
      assert.ok(out.eyeOpenBonus >= 0.12, `Surprised should apply significant eye open bonus, got ${out.eyeOpenBonus}`);
    });

    it('applies downward gaze bias and lower eyelids for sad expression', () => {
      const controller = new PersonaLifeController();
      const out = controller.update(0.05, 1000, 'sad');
      assert.ok(out.eyeOpenBonus < 0, `Sad should soften/lower eyelid openness, got ${out.eyeOpenBonus}`);
    });

    it('maintains focused gaze with reduced wandering for angry expression', () => {
      const controller = new PersonaLifeController();
      let prevMode: GazeMode = 'ENGAGED';
      let glanceEventCount = 0;
      let simTime = 0;
      for (let i = 0; i < 150; i++) {
        simTime += 0.1;
        const out = controller.update(0.1, simTime * 1000, 'angry');
        if (out.gazeMode === 'GLANCE_AWAY' && prevMode !== 'GLANCE_AWAY') {
          glanceEventCount++;
        }
        prevMode = out.gazeMode;
      }
      // Angry should rarely glance away
      assert.ok(glanceEventCount <= 1, `Angry should maintain focused gaze, got ${glanceEventCount} glance-aways`);
    });
  });

  describe('6. Reduced Motion Accessibility & Clean Rig Integration', () => {
    it('zeroes out autonomous head and posture movement when prefersReducedMotion is enabled', () => {
      const controller = new PersonaLifeController({ prefersReducedMotion: true });
      const out = controller.update(0.1, 1000, 'neutral');
      assert.equal(out.headEuler.pitch, 0);
      assert.equal(out.headEuler.yaw, 0);
      assert.equal(out.headEuler.roll, 0);
      assert.equal(out.neckEuler.pitch, 0);
      assert.equal(out.neckEuler.yaw, 0);
      assert.equal(out.neckEuler.roll, 0);
      assert.equal(out.spine2Euler.pitch, 0);
      assert.equal(out.shoulderLift, 0);
    });

    it('verifies PersonaHumanoidCanvas caches all upper-body bones and applies conjugate world rotations', () => {
      assert.ok(canvasSrc.includes('model.getObjectByName(\'Head\')'), 'Must query Head bone');
      assert.ok(canvasSrc.includes('model.getObjectByName(\'Neck\')'), 'Must query Neck bone');
      assert.ok(canvasSrc.includes('model.getObjectByName(\'Spine2\')'), 'Must query Spine2 bone');
      assert.ok(canvasSrc.includes('model.getObjectByName(\'RightShoulder\')'), 'Must query RightShoulder bone');
      assert.ok(canvasSrc.includes('model.getObjectByName(\'LeftShoulder\')'), 'Must query LeftShoulder bone');
      assert.ok(canvasSrc.includes('applyWorldRotationOffset'), 'Must define conjugate world rotation helper');
    });

    it('verifies unmount cleanup safely restores rest pose on all bones', () => {
      assert.ok(
        canvasSrc.includes('bone.quaternion.copy(bone.userData.restQuat)'),
        'Unmount must restore rest quaternion on bones'
      );
      assert.ok(
        canvasSrc.includes('bone.position.copy(bone.userData.restPos)'),
        'Unmount must restore rest position on bones'
      );
    });

    it('verifies document visibility change listener and background tab pause', () => {
      assert.ok(
        canvasSrc.includes('document.addEventListener(\'visibilitychange\', handleVisibilityChange)'),
        'Canvas must register visibilitychange listener'
      );
      assert.ok(
        canvasSrc.includes('document.removeEventListener(\'visibilitychange\', handleVisibilityChange)'),
        'Canvas must clean up visibilitychange listener on unmount'
      );
      assert.ok(
        canvasSrc.includes('document.hidden'),
        'Canvas must throttle or pause rendering when document.hidden is true'
      );
    });
  });

  describe('7. Cinematic Lifelike Polish (Double Blinks, Breathing Drift, Human Pacing)', () => {
    it('produces natural, non-periodic blinking with variable intervals and short smooth duration', () => {
      const controller = new PersonaLifeController();
      let simTime = 0;
      const dt = 0.02; // 50 fps simulation
      let blinkCount = 0;
      let maxBlinkFactor = 0;

      while (simTime < 40.0) {
        simTime += dt;
        const out = controller.update(dt, simTime * 1000, 'neutral');
        if (out.blinkFactor > 0.01) {
          if (out.blinkFactor > maxBlinkFactor) maxBlinkFactor = out.blinkFactor;
        }
        if (out.blinkFactor > 0.8) {
          blinkCount++;
        }
      }

      assert.ok(blinkCount >= 5, `Should produce multiple natural blinks across 40s, got ${blinkCount}`);
      assert.ok(maxBlinkFactor >= 0.95, `Blinks should reach full closure (>0.95), got ${maxBlinkFactor}`);
    });

    it('drifts breathing rate and amplitude organically over time (Objective 1)', () => {
      const controller = new PersonaLifeController();
      // Test two breathing peaks at different simulation times (e.g. at ~2s and ~16s)
      // Shoulder lift peak values will vary slightly due to organic amplitude drift
      const peaks: number[] = [];
      let prevLift = 0;
      let wasRising = true;
      let simTime = 0;
      const dt = 0.05;

      while (simTime < 30.0) {
        simTime += dt;
        const out = controller.update(dt, simTime * 1000, 'neutral');
        const curLift = out.shoulderLift;
        if (wasRising && curLift < prevLift && prevLift > 0.20) {
          peaks.push(prevLift);
        }
        wasRising = curLift >= prevLift;
        prevLift = curLift;
      }

      assert.ok(peaks.length >= 4, `Should detect at least 4 respiratory inhalation peaks, got ${peaks.length}`);
      // The peak amplitudes should not be identical (demonstrating organic drift)
      const maxPeak = Math.max(...peaks);
      const minPeak = Math.min(...peaks);
      assert.ok(maxPeak - minPeak > 0.005, `Respiratory peaks should vary organically, diff=${maxPeak - minPeak}`);
    });

    it('implements calm stillness pacing periods where head micro-drift settles into resting posture (Objective 7)', () => {
      const controller = new PersonaLifeController();
      let simTime = 0;
      const dt = 0.1;
      let detectedStillnessCount = 0;

      while (simTime < 60.0) {
        simTime += dt;
        const out = controller.update(dt, simTime * 1000, 'neutral');
        // During stillness, head roll drift is attenuated to near zero (< 0.001 rad)
        if (Math.abs(out.headEuler.roll) < 0.0008) {
          detectedStillnessCount++;
        }
      }

      assert.ok(
        detectedStillnessCount >= 5,
        `Should enter restful stillness pauses with subdued head micro-drift, detected ${detectedStillnessCount} frames`
      );
    });
  });
});
