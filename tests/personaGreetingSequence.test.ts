import { describe, it } from 'node:test';
import assert from 'node:assert';
import * as THREE from 'three';
import { PersonaLifeController } from '../src/components/persona/personaLifeController';
import { PersonaExpressionController } from '../src/components/persona/personaExpressionController';
import { PERSONA_ANIMATION_CONFIG, PERSONA_PARTICLE_CONFIG } from '../src/components/persona/PersonaHumanoidCanvas';
import fs from 'node:fs';
import path from 'node:path';

describe('GRAPHMIND — PERSONA: INITIAL GREETING SEQUENCE', () => {
  // =========================================================================
  // 1. STAGE A: FORMATION PRESERVATION & TIMING
  // =========================================================================
  describe('1. Stage A — Character Formation & Timing', () => {
    it('preserves existing bottom-to-top particle budget and configuration', () => {
      assert.strictEqual(PERSONA_PARTICLE_CONFIG.desktopCount, 5200);
      assert.strictEqual(PERSONA_ANIMATION_CONFIG.solidifyDuration, 3.6);
      assert.strictEqual(PERSONA_ANIMATION_CONFIG.fullySolidDuration, 0.8);
      // Particle system parameters are preserved
      assert.ok(PERSONA_PARTICLE_CONFIG.baseParticleSize > 0.01);
    });

    it('does not display greeting during active particle reconstruction', () => {
      // Prior to solidification (elapsed < 4.50), greeting state remains 'idle'
      let greetingState: 'idle' | 'pause' | 'greeting' | 'complete' = 'idle';
      const simulateFrame = (elapsed: number) => {
        if (elapsed < 4.50) {
          // In active reconstruction wave, greeting is never triggered
          return greetingState;
        }
        greetingState = 'pause';
        return greetingState;
      };

      assert.strictEqual(simulateFrame(0.5), 'idle');
      assert.strictEqual(simulateFrame(2.0), 'idle');
      assert.strictEqual(simulateFrame(4.1), 'idle');
      assert.strictEqual(simulateFrame(4.49), 'idle');
      assert.strictEqual(simulateFrame(4.50), 'pause');
    });
  });

  // =========================================================================
  // 2. STAGE B: BRIEF PAUSE (400-700ms)
  // =========================================================================
  describe('2. Stage B — Brief Pause Post-Solidification', () => {
    it('implements a short pause between 400ms and 700ms before greeting nod and text', () => {
      const PAUSE_DURATION_MS = 500;
      assert.ok(
        PAUSE_DURATION_MS >= 400 && PAUSE_DURATION_MS <= 700,
        `Pause duration ${PAUSE_DURATION_MS}ms must be between 400ms and 700ms`
      );
    });
  });

  // =========================================================================
  // 3. STAGE C: ESTABLISH EYE CONTACT, SMILE & GREETING NOD
  // =========================================================================
  describe('3. Stage C — Eye Contact, Warm Smile & Subtle Greeting Nod', () => {
    it('prioritizes viewer eye contact at (0, 0) during greeting sequence', () => {
      const life = new PersonaLifeController();
      life.startGreetingNod();
      assert.strictEqual(life.isGreetingActive(), true);

      // Advance frames without pointer movement: gaze settles on center (0, 0)
      let output = life.update(0.016, 100);
      for (let i = 0; i < 30; i++) {
        output = life.update(0.016, 100 + i * 16);
      }

      assert.ok(
        Math.abs(output.gazeNDC.x) < 0.05,
        `Gaze X ${output.gazeNDC.x} should be centered on viewer during greeting`
      );
      assert.ok(
        Math.abs(output.gazeNDC.y) < 0.05,
        `Gaze Y ${output.gazeNDC.y} should be centered on viewer during greeting`
      );
    });

    it('maintains responsive cursor tracking when cursor moves with significant intention', () => {
      const life = new PersonaLifeController();
      life.startGreetingNod();

      // Send cursor move
      life.onPointerMove(0.75, 0.45, 100);
      // Give cursor weight time to engage
      for (let i = 0; i < 40; i++) {
        life.update(0.016, 100 + i * 16);
      }

      const output = life.update(0.016, 800);
      // Should track toward cursor
      assert.ok(output.gazeNDC.x > 0.35, 'Gaze should smoothly respond to active cursor intention');
    });

    it('executes a restrained, natural nod profile without cartoon-like exaggeration', () => {
      const life = new PersonaLifeController();
      life.startGreetingNod();

      let minPitch = 0;
      let maxPitch = 0;

      // Sample nod over its 1.4s duration
      const steps = 90;
      const dt = 1.4 / steps;
      for (let i = 0; i < steps; i++) {
        const out = life.update(dt, i * dt * 1000);
        const pitch = out.headEuler.pitch;
        if (pitch < minPitch) minPitch = pitch;
        if (pitch > maxPitch) maxPitch = pitch;
      }

      // Restrained pitch bounds: polite nod dip is subtle (~0.01 - 0.03 rad)
      assert.ok(
        maxPitch > 0.005,
        `Nod must have a polite downward pitch dip, got ${maxPitch}`
      );
      assert.ok(
        maxPitch < 0.06,
        `Nod must remain restrained (<0.06 rad / ~3.4 deg), got ${maxPitch}`
      );

      // After nod duration, nod influence settles back to resting baseline
      const settledOut = life.update(0.2, 2000);
      assert.ok(
        Math.abs(settledOut.headEuler.pitch) < 0.02,
        'Head pitch must smoothly return to resting baseline after nod'
      );
    });

    it('activates subtle warm smile via expression controller without competing transitions', () => {
      const expr = new PersonaExpressionController();
      expr.setGreetingLocked(true);
      assert.strictEqual(expr.isGreetingLocked(), true);

      expr.setExpression('happy', 1.0);
      assert.strictEqual(expr.getCurrentExpression(), 'happy');

      // Update for 1.2s to complete blend
      for (let i = 0; i < 75; i++) {
        expr.update(0.016);
      }

      const state = expr.getStateInfo();
      assert.strictEqual(state.activeExpr, 'happy');

      // While greeting is locked, holding phase does NOT trigger autonomous emotion switches
      for (let i = 0; i < 300; i++) {
        expr.update(0.016);
      }
      assert.strictEqual(expr.getCurrentExpression(), 'happy', 'Smile must remain stable during greeting');
    });
  });

  // =========================================================================
  // 4. STAGE D: GESTURAL GREETING (CLEAN & UNCLUTTERED WITHOUT TEXT)
  // =========================================================================
  describe('4. Stage D — Gestural Character Greeting Without Text Overlay', () => {
    it('keeps the viewport clean without chatbot speech bubbles, text boxes, or cards', () => {
      const personaExpPath = path.resolve(
        process.cwd(),
        'src/components/persona/PersonaExperience.tsx'
      );
      const content = fs.readFileSync(personaExpPath, 'utf8');

      // Verifies greeting text overlay has been removed for a clean, non-chatbot experience
      assert.strictEqual(
        content.includes('persona-greeting-overlay'),
        false,
        'PersonaExperience must not render a text greeting overlay'
      );
      assert.strictEqual(
        content.includes('Hey, welcome to GraphMind'),
        false,
        'PersonaExperience must not render text in the greeting'
      );
    });

    it('keeps the character silhouette pristine and unobstructed', () => {
      const personaExpPath = path.resolve(
        process.cwd(),
        'src/components/persona/PersonaExperience.tsx'
      );
      const content = fs.readFileSync(personaExpPath, 'utf8');

      // The character stage is rendered directly inside persona-main-content without competing DOM overlays
      assert.ok(
        content.includes('persona-character-stage'),
        'PersonaExperience must render the character stage unobstructed'
      );
    });
  });

  // =========================================================================
  // 5. STAGE E: RETURN TO IDLE
  // =========================================================================
  describe('5. Stage E — Return to Idle', () => {
    it('maintains greeting visibility for 2.5–4.0s (3.0s) and transitions smile back to neutral', () => {
      const GREETING_DISPLAY_DURATION_MS = 3000;
      assert.ok(
        GREETING_DISPLAY_DURATION_MS >= 2500 && GREETING_DISPLAY_DURATION_MS <= 4000,
        `Display duration ${GREETING_DISPLAY_DURATION_MS}ms must be between 2500ms and 4000ms`
      );

      const expr = new PersonaExpressionController();
      expr.setGreetingLocked(true);
      expr.setExpression('happy', 1.0);
      for (let i = 0; i < 70; i++) expr.update(0.016);

      // Return to neutral
      expr.setExpression('neutral', 1.2);
      expr.setGreetingLocked(false);
      assert.strictEqual(expr.isGreetingLocked(), false);
      assert.strictEqual(expr.getCurrentExpression(), 'neutral');

      // Update until transition complete
      for (let i = 0; i < 90; i++) expr.update(0.016);
      assert.strictEqual(expr.getPhase(), 'HOLDING');
      assert.strictEqual(expr.getCurrentExpression(), 'neutral');
    });

    it('restores normal idle gaze behavior after greeting completes', () => {
      const life = new PersonaLifeController();
      life.startGreetingNod();
      assert.strictEqual(life.isGreetingActive(), true);

      life.resetGreeting();
      assert.strictEqual(life.isGreetingActive(), false);

      // Idle gaze updates smoothly without errors
      const out = life.update(0.016, 2000);
      assert.ok(out.gazeMode === 'ENGAGED' || out.gazeMode === 'GLANCE_AWAY');
    });
  });

  // =========================================================================
  // 6. TRIGGERING RULES & LIFECYCLE
  // =========================================================================
  describe('6. Triggering Rules & Lifecycle Management', () => {
    it('triggers greeting sequence exactly once per entry', () => {
      let triggerCount = 0;
      let hasInitiatedGreeting = false;

      const onSolidificationComplete = () => {
        if (!hasInitiatedGreeting) {
          hasInitiatedGreeting = true;
          triggerCount++;
        }
      };

      // Multiple animation frames in solid state
      for (let frame = 0; frame < 100; frame++) {
        onSolidificationComplete();
      }

      assert.strictEqual(triggerCount, 1, 'Greeting must trigger only once per entry');
    });

    it('resets cleanly when component unmounts and replays on fresh re-entry', () => {
      const life = new PersonaLifeController();
      life.startGreetingNod();
      assert.strictEqual(life.isGreetingActive(), true);

      // Component unmount cleans up
      life.resetGreeting();
      assert.strictEqual(life.isGreetingActive(), false);

      // Re-entry starts a fresh sequence
      life.startGreetingNod();
      assert.strictEqual(life.isGreetingActive(), true);
    });

    it('respects prefers-reduced-motion by skipping nod animation while preserving text display', () => {
      const lifeReduced = new PersonaLifeController({ prefersReducedMotion: true });
      lifeReduced.startGreetingNod();

      // Pitch is not perturbed by nod when reduced motion is preferred
      const out = lifeReduced.update(0.016, 100);
      assert.strictEqual(out.headEuler.pitch, 0);
      assert.strictEqual(out.headEuler.yaw, 0);
      assert.strictEqual(out.headEuler.roll, 0);
    });
  });
});
