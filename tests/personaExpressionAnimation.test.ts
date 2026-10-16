import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

import {
  PersonaExpressionController,
  PERSONA_EXPRESSION_PRESETS,
  AUTOMATIC_EXPRESSION_SEQUENCE,
  type PersonaExpression
} from '../src/components/persona/personaExpressionController';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const canvasSrcPath = path.resolve(__dirname, '../src/components/persona/PersonaHumanoidCanvas.tsx');
const controllerSrcPath = path.resolve(__dirname, '../src/components/persona/personaExpressionController.ts');
const canvasSrc = fs.readFileSync(canvasSrcPath, 'utf8');
const controllerSrc = fs.readFileSync(controllerSrcPath, 'utf8');

describe('GRAPHMIND — PERSONA: AUTOMATIC FACIAL EXPRESSION ANIMATION SYSTEM', () => {
  describe('1. Central Expression Controller & Presets', () => {
    const requiredExpressions: PersonaExpression[] = [
      'neutral',
      'happy',
      'sad',
      'angry',
      'surprised',
      'thinking',
      'worried'
    ];

    it('implements all seven distinct expressions in PERSONA_EXPRESSION_PRESETS', () => {
      for (const expr of requiredExpressions) {
        assert.ok(
          PERSONA_EXPRESSION_PRESETS[expr],
          `Expression preset "${expr}" must be defined`
        );
        assert.ok(
          Object.keys(PERSONA_EXPRESSION_PRESETS[expr].head).length > 0,
          `Expression "${expr}" must define head morph weights`
        );
      }
    });

    it('enforces mandatory WORRIED / FRIGHTENED expression matching the reference emotion', () => {
      const worried = PERSONA_EXPRESSION_PRESETS.worried;
      assert.ok(worried, 'Worried expression must exist');

      // Inner eyebrow lift (index 58 & 59)
      assert.ok(
        (worried.head[58] || 0) >= 0.70 && (worried.head[59] || 0) >= 0.70,
        'Worried expression must feature high raised inner eyebrows (RbrowUp_h, LbrowUp_h >= 0.70)'
      );

      // Wide open eyes (index 47 & 48)
      assert.ok(
        (worried.head[47] || 0) >= 0.60 && (worried.head[48] || 0) >= 0.60,
        'Worried expression must widen eyes (ReyeOpen_h, LeyeOpen_h >= 0.60)'
      );

      // Bared clenched teeth grimace (index 8 for S_h, 13 & 14 for RlipUp_h/LlipUp_h, 21 for JawCompress_h)
      assert.ok(
        (worried.head[8] || 0) >= 0.50,
        'Worried mouth must bare teeth in tense grimace (S_h >= 0.50)'
      );
      assert.ok(
        (worried.head[13] || 0) >= 0.50 && (worried.head[14] || 0) >= 0.50,
        'Worried expression must retract upper lip to expose upper teeth (RlipUp_h, LlipUp_h >= 0.50)'
      );
      assert.ok(
        (worried.head[21] || 0) >= 0.30 && (worried.teethDown[24] || 0) >= 0.30,
        'Dental bite must remain clenched in tense grit (JawCompress_h, t_JawCompress_h >= 0.30)'
      );

      // Anxious downturned mouth and lower lip (index 32, 33, 15, 16)
      assert.ok(
        (worried.head[32] || 0) >= 0.35 && (worried.head[33] || 0) >= 0.35,
        'Worried mouth corners must pull down (RmouthSad_h, LmouthSad_h >= 0.35)'
      );
      assert.ok(
        (worried.head[15] || 0) >= 0.30 && (worried.head[16] || 0) >= 0.30,
        'Worried lower lip must be pulled down (RlipDown_h, LlipDown_h >= 0.30)'
      );
    });

    it('enforces natural HAPPY / SMILING expression with warm mouth corners and eye crinkle', () => {
      const happy = PERSONA_EXPRESSION_PRESETS.happy;
      assert.ok(
        (happy.head[30] || 0) >= 0.50 && (happy.head[31] || 0) >= 0.50,
        'Happy expression must feature raised smile corners (RsmileOpen_h, LsmileOpen_h >= 0.50)'
      );
      assert.ok(
        (happy.head[49] || 0) >= 0.20 && (happy.head[50] || 0) >= 0.20,
        'Happy expression must feature Duchenne eye squints (Rsquint_h, Lsquint_h >= 0.20)'
      );
    });

    it('enforces SAD expression with inner brow lift and downturned lips', () => {
      const sad = PERSONA_EXPRESSION_PRESETS.sad;
      assert.ok(
        (sad.head[58] || 0) >= 0.40 && (sad.head[59] || 0) >= 0.40,
        'Sad expression must raise inner brows (RbrowUp_h, LbrowUp_h >= 0.40)'
      );
      assert.ok(
        (sad.head[32] || 0) >= 0.45 && (sad.head[33] || 0) >= 0.45,
        'Sad expression must pull down mouth corners (RmouthSad_h, LmouthSad_h >= 0.45)'
      );
    });

    it('enforces ANGRY expression with furrowed inner brows and compressed jaw', () => {
      const angry = PERSONA_EXPRESSION_PRESETS.angry;
      assert.ok(
        (angry.head[62] || 0) >= 0.50 && (angry.head[63] || 0) >= 0.50,
        'Angry expression must pull inner brows down (RbrowDown_h, LbrowDown_h >= 0.50)'
      );
      assert.ok(
        (angry.head[21] || 0) >= 0.25,
        'Angry expression must compress jaw (JawCompress_h >= 0.25)'
      );
    });

    it('enforces SURPRISED expression with high raised brows and oval mouth opening', () => {
      const surprised = PERSONA_EXPRESSION_PRESETS.surprised;
      assert.ok(
        (surprised.head[58] || 0) >= 0.60 && (surprised.head[59] || 0) >= 0.60,
        'Surprised expression must raise brows high (RbrowUp_h, LbrowUp_h >= 0.60)'
      );
      assert.ok(
        (surprised.head[26] || 0) >= 0.45,
        'Surprised expression must open mouth widely (MouthOpen_h >= 0.45)'
      );
    });

    it('enforces THINKING expression with asymmetric inquisitive brow and contemplative lips', () => {
      const thinking = PERSONA_EXPRESSION_PRESETS.thinking;
      assert.ok(
        (thinking.head[58] || 0) > (thinking.head[59] || 0) ||
        (thinking.head[58] || 0) > 0.35,
        'Thinking expression must feature inquisitive raised right brow'
      );
      assert.ok(
        (thinking.head[17] || 0) >= 0.15,
        'Thinking expression must feature subtle contemplative lip purse (RlipSide_h >= 0.15)'
      );
    });
  });

  describe('2. Automatic Expression Sequence & Timing Architecture', () => {
    it('defines an automatic sequence that visits all emotions and returns to neutral between states', () => {
      assert.ok(
        AUTOMATIC_EXPRESSION_SEQUENCE.length >= 10,
        'Automatic sequence must contain full cycle of emotional transitions'
      );
      assert.ok(
        AUTOMATIC_EXPRESSION_SEQUENCE.includes('worried'),
        'Sequence must include worried expression'
      );
      assert.ok(
        AUTOMATIC_EXPRESSION_SEQUENCE.includes('happy'),
        'Sequence must include happy expression'
      );
      assert.ok(
        AUTOMATIC_EXPRESSION_SEQUENCE.includes('sad'),
        'Sequence must include sad expression'
      );
      assert.ok(
        AUTOMATIC_EXPRESSION_SEQUENCE.includes('angry'),
        'Sequence must include angry expression'
      );
      assert.ok(
        AUTOMATIC_EXPRESSION_SEQUENCE.includes('surprised'),
        'Sequence must include surprised expression'
      );
      assert.ok(
        AUTOMATIC_EXPRESSION_SEQUENCE.includes('thinking'),
        'Sequence must include thinking expression'
      );

      // Verify that after every strong emotion, the sequence returns to neutral
      for (let i = 0; i < AUTOMATIC_EXPRESSION_SEQUENCE.length - 1; i++) {
        const curr = AUTOMATIC_EXPRESSION_SEQUENCE[i];
        const next = AUTOMATIC_EXPRESSION_SEQUENCE[i + 1];
        if (curr !== 'neutral') {
          assert.equal(
            next,
            'neutral',
            `Strong emotion "${curr}" must return to neutral before progressing to the next state`
          );
        }
      }
    });

    it('interpolates weights smoothly using cubic easing without snapping', () => {
      const controller = new PersonaExpressionController();
      controller.setExpression('happy', 1.0);

      // Update 0.5s into 1.0s transition
      controller.update(0.5);

      const dummyHead = new THREE.Mesh();
      dummyHead.morphTargetInfluences = new Array(65).fill(0);
      const dummyTeeth = new THREE.Mesh();
      dummyTeeth.morphTargetInfluences = new Array(31).fill(0);

      controller.applyToMeshes(dummyHead, dummyTeeth);

      // Smile target 30 should be halfway interpolated (between 0.20 and 0.58)
      const smile = dummyHead.morphTargetInfluences[30];
      assert.ok(smile > 0.25 && smile < 0.55, `Smile must be smoothly interpolated mid-transition, got ${smile}`);
    });
  });

  describe('3. Coordination with Cursor Tracking, Blinking & Accessibility', () => {
    it('applies blinking on top of expression eye aperture without overriding facial pose', () => {
      const controller = new PersonaExpressionController({ forcedExpression: 'surprised' });
      controller.update(0.1);

      const dummyHead = new THREE.Mesh();
      dummyHead.morphTargetInfluences = new Array(65).fill(0);

      // Apply with full blink
      controller.applyToMeshes(dummyHead, null, { blinkFactor: 1.0, gazeNormY: 0 });

      // Eyelids should be closed
      assert.equal(dummyHead.morphTargetInfluences[45], 1.0, 'ReyeClose_h must be 1.0 during full blink');
      assert.equal(dummyHead.morphTargetInfluences[47], 0.0, 'ReyeOpen_h must be 0.0 during full blink');

      // But eyebrow surprise must remain preserved!
      assert.ok(
        dummyHead.morphTargetInfluences[58] >= 0.60,
        'Surprise eyebrow raise must not be wiped out by blinking'
      );
    });

    it('respects prefersReducedMotion by remaining locked in calm neutral expression', () => {
      const controller = new PersonaExpressionController({ reducedMotion: true });
      controller.update(10.0); // Simulate 10 seconds of updates

      assert.equal(
        controller.getCurrentExpression(),
        'neutral',
        'Reduced motion must keep character locked in neutral state'
      );
    });

    it('does NOT render manual expression UI controls or buttons', () => {
      assert.ok(!canvasSrc.includes('expression-button'), 'No manual expression buttons in canvas');
      assert.ok(!canvasSrc.includes('expression-dropdown'), 'No manual expression dropdown in canvas');
      assert.ok(!canvasSrc.includes('expression-select'), 'No manual expression select in canvas');
    });
  });
});
