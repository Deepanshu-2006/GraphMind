import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { personaTransitionController } from '../src/components/persona/personaTransition';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const orbSrcPath = path.resolve(__dirname, '../src/components/overview/KnowledgeOrb3D.tsx');
const heroSectionPath = path.resolve(__dirname, '../src/components/overview/HeroSection.tsx');
const personaTransitionPath = path.resolve(__dirname, '../src/components/persona/personaTransition.ts');
const personaCanvasPath = path.resolve(__dirname, '../src/components/persona/PersonaHumanoidCanvas.tsx');
const appSrcPath = path.resolve(__dirname, '../src/App.tsx');

const orbSrc = fs.readFileSync(orbSrcPath, 'utf8');
const heroSectionSrc = fs.readFileSync(heroSectionPath, 'utf8');
const personaTransitionSrc = fs.readFileSync(personaTransitionPath, 'utf8');
const personaCanvasSrc = fs.readFileSync(personaCanvasPath, 'utf8');
const appSrc = fs.readFileSync(appSrcPath, 'utf8');

describe('GRAPHMIND — HERO ORB PARTICLE COUNT, ENTRY ANIMATION & PERSONA LIFECYCLE', () => {
  describe('1. Original Hero Orb Particle Count Restoration', () => {
    it('restores the original responsive particle counts with 760 baseline on desktop', () => {
      assert.ok(
        orbSrc.includes('return 760; // Optimal density with rock-solid 120fps performance'),
        'Must restore 760 particle count on desktop'
      );
      assert.ok(
        orbSrc.includes('if (prefersReducedMotion) return 180;'),
        'Must retain 180 on reduced motion'
      );
      assert.ok(
        orbSrc.includes('if (w < 560) return 240;'),
        'Must retain 240 on mobile'
      );
      assert.ok(
        orbSrc.includes('if (w < 960) return 460;'),
        'Must retain 460 on tablet'
      );
    });

    it('does not inflate hero particle count to 2400', () => {
      assert.ok(
        !orbSrc.includes('return 2400;'),
        'Must not contain 2400 hardcoded particle count'
      );
    });

    it('samples surface points across entire model using uniform stride for the dedicated persona system', () => {
      assert.ok(
        personaCanvasSrc.includes('const targetIdx = Math.floor((i * numSource) / particleCount);'),
        'Must sample surface points across entire model using uniform stride for persona particles'
      );
    });
  });

  describe('2. Separation of Particle Positions & Authoritative Identity', () => {
    it('maintains distinct data for scatter positions, spherical orb positions, and human target positions', () => {
      assert.ok(orbSrc.includes('scatterX: number;'), 'ParticleData must retain scatterX');
      assert.ok(orbSrc.includes('scatterY: number;'), 'ParticleData must retain scatterY');
      assert.ok(orbSrc.includes('scatterZ: number;'), 'ParticleData must retain scatterZ');
      assert.ok(orbSrc.includes('sphereX: number;'), 'ParticleData must retain sphereX');
      assert.ok(orbSrc.includes('sphereY: number;'), 'ParticleData must retain sphereY');
      assert.ok(orbSrc.includes('sphereZ: number;'), 'ParticleData must retain sphereZ');
      assert.ok(orbSrc.includes('transTargetX: number;'), 'ParticleData must retain transTargetX');
      assert.ok(orbSrc.includes('transTargetY: number;'), 'ParticleData must retain transTargetY');
      assert.ok(orbSrc.includes('transTargetZ: number;'), 'ParticleData must retain transTargetZ');
    });

    it('resets particles to original scatter starting positions upon return', () => {
      assert.ok(
        orbSrc.includes('p.x = prefersReducedMotion ? p.sphereX : p.scatterX;'),
        'Must restore initial scatter X position for fresh entrance replay'
      );
      assert.ok(
        orbSrc.includes('p.y = prefersReducedMotion ? p.sphereY : p.scatterY;'),
        'Must restore initial scatter Y position for fresh entrance replay'
      );
      assert.ok(
        orbSrc.includes('p.z = prefersReducedMotion ? p.sphereZ : p.scatterZ;'),
        'Must restore initial scatter Z position for fresh entrance replay'
      );
    });
  });

  describe('3. Deterministic Persona Navigation Lifecycle States', () => {
    it('defines all required lifecycle states in personaTransition.ts', () => {
      assert.ok(personaTransitionSrc.includes("'HERO_ENTERING'"), 'Must include HERO_ENTERING state');
      assert.ok(personaTransitionSrc.includes("'HERO_IDLE'"), 'Must include HERO_IDLE state');
      assert.ok(personaTransitionSrc.includes("'ORB_TO_HUMAN'"), 'Must include ORB_TO_HUMAN state');
      assert.ok(personaTransitionSrc.includes("'HUMAN_FORMED'"), 'Must include HUMAN_FORMED state');
      assert.ok(personaTransitionSrc.includes("'PERSONA_READY'"), 'Must include PERSONA_READY state');
      assert.ok(personaTransitionSrc.includes("'RETURNING_TO_HERO'"), 'Must include RETURNING_TO_HERO state');
    });

    it('executes deterministic lifecycle transitions with re-entry guards', () => {
      // 1. Initial State
      personaTransitionController.resetToHero();
      assert.equal(personaTransitionController.state, 'HERO_IDLE');

      // 2. Activate Persona: HERO_IDLE -> ORB_TO_HUMAN
      const triggerSuccess = personaTransitionController.triggerOrbToHuman();
      assert.equal(triggerSuccess, true);
      assert.equal(personaTransitionController.state, 'ORB_TO_HUMAN');

      // 3. Re-entry guard: cannot trigger while in flight
      const doubleTrigger = personaTransitionController.triggerOrbToHuman();
      assert.equal(doubleTrigger, false);
      assert.equal(personaTransitionController.state, 'ORB_TO_HUMAN');

      // 4. Silhouette formed: ORB_TO_HUMAN -> HUMAN_FORMED
      personaTransitionController.completeHumanFormed();
      assert.equal(personaTransitionController.state, 'HUMAN_FORMED');

      // 5. Persona ready: HUMAN_FORMED -> PERSONA_READY
      personaTransitionController.setPersonaReady();
      assert.equal(personaTransitionController.state, 'PERSONA_READY');

      // 6. Return: PERSONA_READY -> RETURNING_TO_HERO
      const returnSuccess = personaTransitionController.triggerReturnToHero();
      assert.equal(returnSuccess, true);
      assert.equal(personaTransitionController.state, 'RETURNING_TO_HERO');

      // 7. Fresh hero entry: RETURNING_TO_HERO -> HERO_ENTERING
      personaTransitionController.startHeroEntering();
      assert.equal(personaTransitionController.state, 'HERO_ENTERING');

      // 8. Cannot activate Persona while entering
      const enterTrigger = personaTransitionController.triggerOrbToHuman();
      assert.equal(enterTrigger, false);
      assert.equal(personaTransitionController.state, 'HERO_ENTERING');

      // 9. Entry complete: HERO_ENTERING -> HERO_IDLE
      personaTransitionController.completeHeroEntry();
      assert.equal(personaTransitionController.state, 'HERO_IDLE');
    });
  });

  describe('4. Hero Entry Animation Replay & Reset Architecture', () => {
    it('resets animation timing and mutable startTime in KnowledgeOrb3D', () => {
      assert.ok(
        orbSrc.includes('let startTime = performance.now();'),
        'startTime must be mutable to allow reset on entry replay'
      );
      assert.ok(
        orbSrc.includes('startTime = performance.now();'),
        'prepareFreshHeroEntry must reset startTime to performance.now()'
      );
    });

    it('replays HeroSection typography entrance animations via entryKey when entering hero', () => {
      assert.ok(
        heroSectionSrc.includes("if (state === 'HERO_ENTERING')"),
        'HeroSection must subscribe to HERO_ENTERING state'
      );
      assert.ok(
        heroSectionSrc.includes('setEntryKey((prev) => prev + 1);'),
        'HeroSection must increment entryKey to re-trigger staggered Framer Motion entrance'
      );
      assert.ok(
        heroSectionSrc.includes('key={`hero-content-${entryKey}`}'),
        'overview-hero-content must mount with unique key for full entrance replay'
      );
      assert.ok(
        heroSectionSrc.includes('key={`hero-cue-${entryKey}`}'),
        'overview-hero-cue must mount with unique key for entrance replay'
      );
    });

    it('restores camera, orb group transform, and materials to original values upon return', () => {
      assert.ok(
        orbSrc.includes('camera.position.set(0, 0, 5.2);'),
        'Camera position must reset to (0, 0, 5.2)'
      );
      assert.ok(
        orbSrc.includes('camera.fov = 44;'),
        'Camera FOV must reset to 44'
      );
      assert.ok(
        orbSrc.includes('pointsMaterial.size = 0.048;'),
        'Points material size must reset to 0.048'
      );
      assert.ok(
        orbSrc.includes('linesMaterial.opacity = 0.52;'),
        'Lines material opacity must reset to 0.52'
      );
    });
  });
});
