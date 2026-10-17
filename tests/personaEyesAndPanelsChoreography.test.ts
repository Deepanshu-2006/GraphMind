import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PersonaLifeController } from '../src/components/persona/personaLifeController';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('GRAPHMIND — PERSONA EYES & SIDE PANELS CHOREOGRAPHY', () => {
  describe('1. PersonaLifeController Intentional Presentation Gaze', () => {
    it('initializes with isIntentionalGlanceActive as false', () => {
      const controller = new PersonaLifeController();
      assert.strictEqual(controller.isIntentionalGlanceActive(), false);
    });

    it('activates isIntentionalGlanceActive when glanceTowards is called', () => {
      const controller = new PersonaLifeController();
      controller.glanceTowards(-0.52, 0.06, 3.2);
      assert.strictEqual(controller.isIntentionalGlanceActive(), true);
    });

    it('holds gaze firmly on left panel (-0.52, 0.06) without being canceled by cursor moves', () => {
      const controller = new PersonaLifeController();
      let simTime = 1.0;
      const dt = 1 / 60;

      // Settle initial neutral pose
      for (let i = 0; i < 20; i++) {
        simTime += dt;
        controller.update(dt, simTime * 1000, 'neutral');
      }

      // Trigger glance towards left learning activity panel
      controller.glanceTowards(-0.52, 0.06, 3.2);

      // Advance 30 frames into the glance (~0.5s)
      for (let i = 0; i < 30; i++) {
        simTime += dt;
        controller.update(dt, simTime * 1000, 'neutral');
      }

      // Simulate mouse pointer movement across the screen
      controller.onPointerMove(0.45, 0.30, simTime * 1000);
      simTime += dt;
      const frameWithCursor = controller.update(dt, simTime * 1000, 'neutral');

      // Gaze should still remain firmly oriented to the left (x < -0.35)
      assert.strictEqual(
        frameWithCursor.gazeNDC.x < -0.35,
        true,
        `Gaze should stay focused on left panel even with pointer movement, got x = ${frameWithCursor.gazeNDC.x}`
      );
      assert.strictEqual(controller.isIntentionalGlanceActive(), true);
    });

    it('transitions smoothly from left panel to right panel when glanceTowards right is triggered', () => {
      const controller = new PersonaLifeController();
      let simTime = 1.0;
      const dt = 1 / 60;

      // Start on the left
      controller.glanceTowards(-0.52, 0.06, 3.2);
      for (let i = 0; i < 60; i++) {
        simTime += dt;
        controller.update(dt, simTime * 1000, 'neutral');
      }

      // Now shift to the right panel
      controller.glanceTowards(0.52, 0.06, 2.8);
      assert.strictEqual(controller.isIntentionalGlanceActive(), true);

      // Advance frames across the gaze transition (~0.45s)
      for (let i = 0; i < 40; i++) {
        simTime += dt;
        controller.update(dt, simTime * 1000, 'neutral');
      }

      const rightFrame = controller.update(dt, simTime * 1000, 'neutral');
      assert.strictEqual(
        rightFrame.gazeNDC.x > 0.35,
        true,
        `Gaze should swing over to right performance panel (x > 0.35), got x = ${rightFrame.gazeNDC.x}`
      );
      assert.strictEqual(
        rightFrame.headEuler.yaw > 0.015,
        true,
        `Head yaw should orient towards right panel, got yaw = ${rightFrame.headEuler.yaw}`
      );
    });

    it('deactivates intentional glance and returns to viewer once duration elapses', () => {
      const controller = new PersonaLifeController();
      let simTime = 1.0;
      const dt = 1 / 60;

      // Trigger short glance (0.5s = 30 frames)
      controller.glanceTowards(0.52, 0.06, 0.5);
      assert.strictEqual(controller.isIntentionalGlanceActive(), true);

      // Advance 45 frames (> 0.5s duration)
      for (let i = 0; i < 45; i++) {
        simTime += dt;
        controller.update(dt, simTime * 1000, 'neutral');
      }

      assert.strictEqual(
        controller.isIntentionalGlanceActive(),
        false,
        'isIntentionalGlance should deactivate when duration completes'
      );
    });
  });

  describe('2. Canvas & Experience Choreography Synchronization', () => {
    const canvasSrc = fs.readFileSync(
      path.resolve(__dirname, '../src/components/persona/PersonaHumanoidCanvas.tsx'),
      'utf8'
    );
    const experienceSrc = fs.readFileSync(
      path.resolve(__dirname, '../src/components/persona/PersonaExperience.tsx'),
      'utf8'
    );
    const activitySrc = fs.readFileSync(
      path.resolve(__dirname, '../src/components/persona/PersonaActivityPanel.tsx'),
      'utf8'
    );

    it('holds eyes on left panel with duration >= 3.0s in PersonaHumanoidCanvas', () => {
      // Must glanceTowards left with duration at least 3.0 seconds so all ~2.7s left content finishes
      const leftGlanceMatch = canvasSrc.match(/lifeController\.glanceTowards\(\s*-0\.52\s*,\s*0\.06\s*,\s*([\d\.]+)\s*\)/);
      assert.ok(leftGlanceMatch, 'glanceTowards(-0.52, 0.06, duration) must be present in canvas');
      const duration = parseFloat(leftGlanceMatch[1]);
      assert.strictEqual(duration >= 3.0, true, `Left glance duration must be >= 3.0s, found ${duration}s`);
    });

    it('schedules glanceRightTimeout >= 3100ms in PersonaHumanoidCanvas so all left content renders first', () => {
      const timeoutMatch = canvasSrc.match(/glanceRightTimeout\s*=\s*setTimeout\([\s\S]*?,\s*(\d+)\s*\);/);
      assert.ok(timeoutMatch, 'glanceRightTimeout must be scheduled');
      const delay = parseInt(timeoutMatch[1], 10);
      assert.strictEqual(
        delay >= 3100,
        true,
        `glanceRightTimeout delay must be >= 3100ms (to let left panel complete), found ${delay}ms`
      );
    });

    it('shifts gaze to right panel (+0.52) inside glanceRightTimeout', () => {
      const rightGlanceMatch = canvasSrc.match(/lifeController\.glanceTowards\(\s*0\.52\s*,\s*0\.06\s*,\s*([\d\.]+)\s*\)/);
      assert.ok(rightGlanceMatch, 'glanceTowards(0.52, 0.06, duration) must be present in canvas');
      assert.ok(
        canvasSrc.includes("onGreetingChangeRef.current?.('glance-right')"),
        'Must dispatch glance-right stage event to PersonaExperience'
      );
    });

    it('sets PersonaExperience right panel safety fallback to >= 3500ms', () => {
      const fallbackMatch = experienceSrc.match(/setIsRightPanelVisible\(true\);[\s\S]*?shouldReduceMotion\s*\?\s*\d+\s*:\s*(\d+)/);
      assert.ok(fallbackMatch, 'Right panel fallback timer must be present in PersonaExperience');
      const fallbackMs = parseInt(fallbackMatch[1], 10);
      assert.strictEqual(
        fallbackMs >= 3500,
        true,
        `Right panel fallback must not prematurely fire before left content renders, found ${fallbackMs}ms`
      );
    });

    it('renders right performance panel when glance-right event arrives', () => {
      assert.ok(
        experienceSrc.includes("stage === 'glance-right'"),
        'PersonaExperience must listen for glance-right stage'
      );
      assert.ok(
        experienceSrc.includes('setIsRightPanelVisible(true)'),
        'PersonaExperience must reveal right panel on glance-right'
      );
    });

    it('has left activity panel entrance sequence finishing within 2800ms', () => {
      // Phase E list container starts at ~1.95s with staggered children (0.12s)
      assert.ok(activitySrc.includes('delayChildren: shouldReduceMotion ? 0 : 1.95'));
      assert.ok(activitySrc.includes('staggerChildren: shouldReduceMotion ? 0 : 0.12'));
    });
  });
});
