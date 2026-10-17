import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import * as THREE from 'three';
import { PersonaLipSyncController } from '../src/components/persona/personaLipSyncController';
import {
  PersonaPresentationController,
  type PresentationState
} from '../src/components/persona/personaPresentationController';
import { PERSONA_GREETING_TEXT } from '../src/components/persona/personaVoiceConfig';

describe('GRAPHMIND — PERSONA: REUSABLE SILENT PRESENTATION & ARTICULATION INTERFACE', () => {
  let presentationController: PersonaPresentationController;
  let lipSyncController: PersonaLipSyncController;

  beforeEach(() => {
    presentationController = new PersonaPresentationController();
    lipSyncController = new PersonaLipSyncController();
    presentationController.bindLipSync(lipSyncController);
  });

  afterEach(() => {
    presentationController.cancel();
    lipSyncController.dispose();
  });

  // =========================================================================
  // 1. SILENT PRESENTATION LIFECYCLE & STATE MACHINE
  // =========================================================================
  describe('1. Silent Presentation Lifecycle (Audio-Free)', () => {
    it('initializes in idle status with no active presentation', () => {
      const state = presentationController.getState();
      assert.strictEqual(state.status, 'idle');
      assert.strictEqual(state.text, null);
      assert.strictEqual(state.revealedText, null);
      assert.strictEqual(state.progress, 0);
      assert.strictEqual(state.isArticulating, false);
    });

    it('starts presentation with text and transitions from idle to presenting', async () => {
      const presentPromise = presentationController.present('Welcome to GraphMind', {
        revealMode: 'instant'
      });

      const state = presentationController.getState();
      assert.strictEqual(state.status, 'presenting');
      assert.strictEqual(state.text, 'Welcome to GraphMind');
      assert.strictEqual(state.isArticulating, true);

      // Cancel to finish clean
      presentationController.cancel();
      await presentPromise;
    });

    it('completes presentation and settles state to completed and idle', async () => {
      let completed = false;
      await presentationController.present('Hello world', {
        wordsPerMinute: 600,
        revealMode: 'instant',
        onComplete: () => {
          completed = true;
        }
      });

      assert.strictEqual(completed, true);
      assert.strictEqual(presentationController.getState().status, 'completed');
      assert.strictEqual(presentationController.getState().progress, 1.0);
      assert.strictEqual(presentationController.getState().isArticulating, false);
    });

    it('cancels active presentation immediately and returns mouth to rest', async () => {
      presentationController.present('Consistency really pays off. Let’s tackle one more concept today.');
      assert.strictEqual(presentationController.getState().status, 'presenting');
      assert.strictEqual(presentationController.getState().isArticulating, true);

      // Cancel presentation
      presentationController.cancel();

      assert.strictEqual(presentationController.getState().status, 'idle');
      assert.strictEqual(presentationController.getState().isArticulating, false);

      const mouthWeights = lipSyncController.getCurrentWeights();
      assert.strictEqual(mouthWeights.mouthOpen, 0);
      assert.strictEqual(mouthWeights.jawCompress, 0);
      assert.strictEqual(mouthWeights.visemes.REST, 0);
    });

    it('prevents overlapping presentations by cleanly cancelling prior sequence', async () => {
      presentationController.present('First long message that should be interrupted.');
      assert.strictEqual(presentationController.getState().text, 'First long message that should be interrupted.');

      // Second message begins immediately
      presentationController.present('Second message replacing the first.');
      assert.strictEqual(presentationController.getState().text, 'Second message replacing the first.');
      assert.strictEqual(presentationController.getState().status, 'presenting');

      presentationController.cancel();
    });

    it('pauses and resumes silent presentation cleanly', () => {
      presentationController.present('Testing pause and resume capability.');
      assert.strictEqual(presentationController.getState().status, 'presenting');

      presentationController.pause();
      assert.strictEqual(presentationController.getState().status, 'paused');

      presentationController.resume();
      assert.strictEqual(presentationController.getState().status, 'presenting');

      presentationController.cancel();
    });
  });

  // =========================================================================
  // 2. TEXT-DRIVEN MOUTH ARTICULATION (NO AUDIO REQUIRED)
  // =========================================================================
  describe('2. Text-Driven Mouth Articulation without Audio', () => {
    it('articulates mouth shapes autonomously when text is presented', () => {
      lipSyncController.startArticulation('Peter bought a beautiful blue book.');
      assert.strictEqual(lipSyncController.isArticulating, true);

      // Advance delta time
      lipSyncController.update(0.06);

      const weights = lipSyncController.getCurrentWeights();
      // Should activate bilabial closure for "Peter" (/p/)
      assert.ok(weights.visemes.MPB > 0 || weights.bilabialFactor > 0);
    });

    it('progresses through words autonomously during delta-time updates', () => {
      lipSyncController.startArticulation('Five clever students');
      assert.strictEqual(lipSyncController.getState().currentWordIndex, 0);

      // Advance through word 0 duration (~0.45s)
      lipSyncController.update(0.30);
      lipSyncController.update(0.30);

      // Should automatically advance to next word
      assert.ok(lipSyncController.getState().currentWordIndex >= 1);
    });

    it('returns mouth to resting zero weights upon presentation completion', () => {
      lipSyncController.startArticulation('Hey');
      assert.strictEqual(lipSyncController.isArticulating, true);

      // Advance past single word duration
      lipSyncController.update(0.70);

      // Should settle to rest
      assert.strictEqual(lipSyncController.isArticulating, false);
      const weights = lipSyncController.getCurrentWeights();
      assert.strictEqual(weights.mouthOpen, 0);
      assert.strictEqual(weights.kiss, 0);
    });

    it('coordinates with custom mesh blend shapes without audio playback', () => {
      const headGeom = new THREE.BufferGeometry();
      const headMesh = new THREE.Mesh(headGeom, new THREE.MeshBasicMaterial());
      headMesh.morphTargetDictionary = {
        'mouthOpen': 0,
        'jawOpen': 1,
        'mouthPucker': 2,
        'viseme_O': 3
      };
      headMesh.morphTargetInfluences = [0, 0, 0, 0];

      lipSyncController.startArticulation('you');
      lipSyncController.update(0.08);

      lipSyncController.applyToMeshes(headMesh, null, 0);

      // Morph influences should be modified on the 3D mesh
      assert.ok(headMesh.morphTargetInfluences.some((v) => v > 0));

      lipSyncController.stopArticulation(true);
      lipSyncController.applyToMeshes(headMesh, null, 0);
      assert.strictEqual(headMesh.morphTargetInfluences[0], 0);
    });
  });

  // =========================================================================
  // 3. SILENT GREETING EXPERIENCE
  // =========================================================================
  describe('3. Silent Greeting Presentation', () => {
    it('articulates standard greeting text silently with no audio calls', () => {
      presentationController.present(PERSONA_GREETING_TEXT, { withMouthArticulation: true });

      const state = presentationController.getState();
      assert.strictEqual(state.status, 'presenting');
      assert.strictEqual(state.text, PERSONA_GREETING_TEXT);
      assert.strictEqual(state.isArticulating, true);

      presentationController.cancel();
      assert.strictEqual(presentationController.getState().status, 'idle');
    });

    it('handles reduced motion by restraining viseme amplitudes', () => {
      const reducedController = new PersonaLipSyncController({ prefersReducedMotion: true });
      reducedController.startArticulation('Welcome to GraphMind');
      reducedController.update(0.08);

      const reducedWeights = reducedController.getCurrentWeights();

      const normalController = new PersonaLipSyncController({ prefersReducedMotion: false });
      normalController.startArticulation('Welcome to GraphMind');
      normalController.update(0.08);

      const normalWeights = normalController.getCurrentWeights();

      // Reduced motion should scale amplitudes
      assert.ok(reducedWeights.mouthOpen <= normalWeights.mouthOpen);

      reducedController.dispose();
      normalController.dispose();
    });
  });
});
