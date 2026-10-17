import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import * as THREE from 'three';
import {
  PersonaLipSyncController,
  type VisemeName,
  type VisemeFrame
} from '../src/components/persona/personaLipSyncController';
import {
  speechSynthesisService,
  type SpeechBoundaryEvent
} from '../src/services/speechSynthesisService';
import {
  PERSONA_GREETING_TEXT,
  PERSONA_TEST_SENTENCES
} from '../src/components/persona/personaVoiceConfig';
import { PersonaExpressionController } from '../src/components/persona/personaExpressionController';

describe('GRAPHMIND — PERSONA: REAL-TIME LIP-SYNC & VISEME ENGINE (STEP 9)', () => {
  let controller: PersonaLipSyncController;

  beforeEach(() => {
    controller = new PersonaLipSyncController();
  });

  afterEach(() => {
    controller.dispose();
  });

  // --------------------------------------------------------------------------
  // 1. Text-to-Viseme Mapping & English Phonetic Sound Groups
  // --------------------------------------------------------------------------
  describe('1. Text-to-Viseme Mapping (All 9 Phonetic Groups)', () => {
    it('maps open vowels (/ɑ/, /æ/, /ʌ/) to AE_AA or AO_A', () => {
      const bat = controller.parseTextToVisemes('bat');
      assert.ok(bat[0].frames.some(f => f.viseme === 'AE_AA'));

      const hot = controller.parseTextToVisemes('hot');
      assert.ok(hot[0].frames.some(f => f.viseme === 'AO_A'));
    });

    it('maps front vowels (/i/, /ɪ/, /ɛ/) to Ax_E or TD_I', () => {
      const bed = controller.parseTextToVisemes('bed');
      assert.ok(bed[0].frames.some(f => f.viseme === 'Ax_E'));

      const sit = controller.parseTextToVisemes('sit');
      assert.ok(sit[0].frames.some(f => f.viseme === 'TD_I'));
    });

    it('maps rounded vowels (/u/, /ʊ/, /oʊ/) to UW_U or UH_OO', () => {
      const moon = controller.parseTextToVisemes('moon');
      assert.ok(moon[0].frames.some(f => f.viseme === 'UH_OO' || f.viseme === 'UW_U'));

      const you = controller.parseTextToVisemes('you');
      assert.ok(you[0].frames.some(f => f.viseme === 'UH_OO' || f.viseme === 'UW_U'));
    });

    it('maps consonants requiring lip closure (/p/, /b/, /m/) to MPB', () => {
      const map = controller.parseTextToVisemes('map');
      assert.ok(map[0].frames.some(f => f.viseme === 'MPB'));

      const pet = controller.parseTextToVisemes('pet');
      assert.ok(pet[0].frames.some(f => f.viseme === 'MPB'));
    });

    it('maps labiodental consonants (/f/, /v/) to FV', () => {
      const fox = controller.parseTextToVisemes('fox');
      assert.ok(fox[0].frames.some(f => f.viseme === 'FV'));

      const voice = controller.parseTextToVisemes('voice');
      assert.ok(voice[0].frames.some(f => f.viseme === 'FV'));
    });

    it('maps dental and alveolar consonants (/t/, /d/, /n/, /s/, /z/, /l/) to TD_I or S', () => {
      const top = controller.parseTextToVisemes('top');
      assert.ok(top[0].frames.some(f => f.viseme === 'TD_I'));

      const sun = controller.parseTextToVisemes('sun');
      assert.ok(sun[0].frames.some(f => f.viseme === 'S'));

      const letWord = controller.parseTextToVisemes('let');
      assert.ok(letWord[0].frames.some(f => f.tongue === 'L' || f.viseme === 'TD_I'));
    });

    it('maps postalveolar consonants (/ʃ/, /tʃ/, /dʒ/) to SH_CH', () => {
      const ship = controller.parseTextToVisemes('ship');
      assert.ok(ship[0].frames.some(f => f.viseme === 'SH_CH'));

      const cheer = controller.parseTextToVisemes('cheer');
      assert.ok(cheer[0].frames.some(f => f.viseme === 'SH_CH'));
    });

    it('maps velar consonants (/k/, /g/) to KG', () => {
      const kite = controller.parseTextToVisemes('kite');
      assert.ok(kite[0].frames.some(f => f.viseme === 'KG'));

      const go = controller.parseTextToVisemes('go');
      assert.ok(go[0].frames.some(f => f.viseme === 'KG'));
    });

    it('maps aspirated transitions (/h/) to H_EST', () => {
      const hello = controller.parseTextToVisemes('hello');
      assert.ok(hello[0].frames.some(f => f.viseme === 'H_EST'));
    });

    it('handles multi-letter combinations (sh, ch, th, ph, ee, oo, ai) with longest-prefix priority', () => {
      const tooth = controller.parseTextToVisemes('tooth');
      assert.ok(tooth[0].frames.some(f => f.viseme === 'UH_OO'));
      assert.ok(tooth[0].frames.some(f => f.viseme === 'TD_I'));

      const graph = controller.parseTextToVisemes('graph');
      assert.ok(graph[0].frames.some(f => f.viseme === 'FV'));
    });
  });

  // --------------------------------------------------------------------------
  // 2. Persona Greeting Sequence Parsing & Punctuation Relaxation
  // --------------------------------------------------------------------------
  describe('2. Greeting Sequence Decomposition ("Hey, welcome to GraphMind.")', () => {
    it('accurately parses the complete initial greeting text', () => {
      const words = controller.parseTextToVisemes(PERSONA_GREETING_TEXT);
      assert.strictEqual(words.length, 4); // "Hey,", "welcome", "to", "GraphMind."

      assert.strictEqual(words[0].cleanWord, 'hey');
      assert.strictEqual(words[1].cleanWord, 'welcome');
      assert.strictEqual(words[2].cleanWord, 'to');
      assert.strictEqual(words[3].cleanWord, 'graphmind');
    });

    it('inserts a REST relaxation frame after trailing punctuation', () => {
      const words = controller.parseTextToVisemes('Hey, welcome to GraphMind.');
      // "Hey," has trailing comma
      const lastFrameHey = words[0].frames[words[0].frames.length - 1];
      assert.strictEqual(lastFrameHey.viseme, 'REST');
      assert.ok(words[0].hasPunctuationPause);

      // "GraphMind." has trailing period
      const lastFrameMind = words[3].frames[words[3].frames.length - 1];
      assert.strictEqual(lastFrameMind.viseme, 'REST');
      assert.ok(words[3].hasPunctuationPause);
    });

    it('allocates realistic estimated durations for words bounded between 0.24s and 0.75s', () => {
      const words = controller.parseTextToVisemes(PERSONA_GREETING_TEXT);
      for (const w of words) {
        assert.ok(w.estimatedDuration >= 0.24, `Duration ${w.estimatedDuration} too small`);
        assert.ok(w.estimatedDuration <= 0.75, `Duration ${w.estimatedDuration} too large`);
      }
    });

    it('accurately parses and schedules all Persona test sentences without errors', () => {
      for (const sentence of PERSONA_TEST_SENTENCES) {
        const words = controller.parseTextToVisemes(sentence);
        assert.ok(words.length >= 4, `Sentence "${sentence}" should produce words`);
        for (const w of words) {
          assert.ok(w.frames.length > 0, `Word "${w.word}" should produce viseme frames`);
          assert.ok(w.estimatedDuration >= 0.20, `Word duration should be realistic`);
        }
      }
    });
  });

  // --------------------------------------------------------------------------
  // 3. Word-Boundary Event Integration & Dynamic Scheduling
  // --------------------------------------------------------------------------
  describe('3. Real-Time Boundary Integration & Autonomous Fallback', () => {
    it('advances active word when SpeechSynthesis boundary event is received', () => {
      controller.startSpeech(PERSONA_GREETING_TEXT);
      assert.strictEqual(controller.getState().isSpeaking, true);
      assert.strictEqual(controller.getState().currentWordIndex, 0);

      // Simulate boundary for "welcome" (charIndex 5)
      const event: SpeechBoundaryEvent = {
        name: 'word',
        charIndex: 5,
        charLength: 7,
        word: 'welcome'
      };
      controller.handleBoundary(event);

      assert.strictEqual(controller.getState().currentWordIndex, 1);
      assert.strictEqual(controller.getState().currentWord, 'welcome');
    });

    it('progresses autonomously if boundary events are absent (browser fallback)', () => {
      controller.startSpeech('Hey you');
      assert.strictEqual(controller.getState().currentWordIndex, 0);

      // Simulate advancing time past word duration (e.g. 0.55s)
      controller.update(0.30);
      controller.update(0.30);

      // Should automatically advance to word 1 ("you")
      assert.strictEqual(controller.getState().currentWordIndex, 1);
    });

    it('settles targets to resting state when all words finish', () => {
      controller.startSpeech('Hi');
      // Advance past single word duration
      controller.update(0.70);

      const weights = controller.getCurrentWeights();
      assert.strictEqual(weights.mouthOpen, 0);
      assert.strictEqual(weights.visemes.REST, 0);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Bilabial Lip Closure, Puckering & Co-Articulation
  // --------------------------------------------------------------------------
  describe('4. Bilabial Closure, Rounded Puckering & Co-Articulation Smoothing', () => {
    it('activates bilabialFactor when speaking /m/, /p/, /b/ sounds', () => {
      controller.startSpeech('mom');
      controller.update(0.05);

      const weights = controller.getCurrentWeights();
      assert.ok(weights.visemes.MPB > 0, 'MPB weight should be active');
      assert.ok(weights.bilabialFactor > 0, 'bilabialFactor should be active');
    });

    it('activates lip puckering (kiss) when speaking rounded vowels (/u/, /oʊ/)', () => {
      controller.startSpeech('ooze');
      controller.update(0.05);

      const weights = controller.getCurrentWeights();
      assert.ok(weights.kiss > 0, 'Kiss/pucker should be active for rounded vowels');
    });

    it('interpolates blend shape weights smoothly across frames without sudden snapping', () => {
      controller.startSpeech('welcome');
      const w0 = controller.getCurrentWeights().mouthOpen;

      // Small delta time step
      controller.update(0.016);
      const w1 = controller.getCurrentWeights().mouthOpen;

      controller.update(0.016);
      const w2 = controller.getCurrentWeights().mouthOpen;

      // Changes should be gradual and continuous
      assert.ok(Math.abs(w1 - w0) < 0.20, 'Transition step should be smooth');
      assert.ok(Math.abs(w2 - w1) < 0.20, 'Transition step should be smooth');
    });
  });

  // --------------------------------------------------------------------------
  // 5. Mesh Morph Compositing & Expression Coordination
  // --------------------------------------------------------------------------
  describe('5. Mesh Morph Compositing with Existing Expression Controller', () => {
    it('applies morph targets to head and teeth meshes using runtime dictionary', () => {
      const headGeom = new THREE.BufferGeometry();
      const headMesh = new THREE.Mesh(headGeom);
      headMesh.morphTargetDictionary = {
        'h_expressions.AE_AA_h': 0,
        'h_expressions.AO_a_h': 1,
        'h_expressions.Ax_E_h': 2,
        'h_expressions.TD_I_h': 3,
        'h_expressions.UH_OO_h': 4,
        'h_expressions.UW_U_h': 5,
        'h_expressions.H_EST_h': 6,
        'h_expressions.FV_h': 7,
        'h_expressions.S_h': 8,
        'h_expressions.SH_CH_h': 9,
        'h_expressions.MPB_Up_h': 10,
        'h_expressions.MPB_Down_h': 11,
        'h_expressions.KG_h': 12,
        'h_expressions.MouthOpen_h': 26,
        'h_expressions.Kiss_h': 36
      };
      headMesh.morphTargetInfluences = new Array(65).fill(0);

      const teethGeom = new THREE.BufferGeometry();
      const teethMesh = new THREE.Mesh(teethGeom);
      teethMesh.morphTargetDictionary = {
        'h_teeth.t_AE_AA_h': 12,
        'h_teeth.t_MouthOpen_h': 29,
        'h_teeth.LLL_In_tg_h': 11
      };
      teethMesh.morphTargetInfluences = new Array(31).fill(0);

      controller.startSpeech('welcome');
      controller.update(0.05);

      const baseMouthOpen = 0.22;
      controller.applyToMeshes(headMesh, teethMesh, baseMouthOpen);

      // Verify that net mouth open is clamped and within physiological limits [0, 0.44]
      assert.ok(headMesh.morphTargetInfluences[26] >= 0 && headMesh.morphTargetInfluences[26] <= 0.44);
      // Verify that lower teeth follow the jaw open synchronously
      assert.strictEqual(teethMesh.morphTargetInfluences[29], headMesh.morphTargetInfluences[26]);
    });

    it('damps jaw opening during bilabial closure so lips touch even during an expression smile', () => {
      const headGeom = new THREE.BufferGeometry();
      const headMesh = new THREE.Mesh(headGeom);
      headMesh.morphTargetDictionary = {
        'h_expressions.MPB_Up_h': 10,
        'h_expressions.MPB_Down_h': 11,
        'h_expressions.MouthOpen_h': 26
      };
      headMesh.morphTargetInfluences = new Array(65).fill(0);

      controller.startSpeech('map');
      // Advance into /m/
      controller.update(0.04);

      const smileMouthOpen = 0.28; // Active happy smile
      controller.applyToMeshes(headMesh, null, smileMouthOpen);

      // Bilabial damp should compress mouth opening significantly below base smile
      const netMouthOpen = headMesh.morphTargetInfluences[26];
      assert.ok(netMouthOpen < smileMouthOpen * 0.70, `MouthOpen ${netMouthOpen} should be compressed during /m/`);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Cancellation, Cleanup & Safety
  // --------------------------------------------------------------------------
  describe('6. Immediate Cancellation & Lifecycle Cleanup', () => {
    it('stops speech and zeroes targets when stopSpeech is called', () => {
      controller.startSpeech('Hello world');
      controller.update(0.10);
      assert.strictEqual(controller.getState().isSpeaking, true);

      controller.stopSpeech();
      assert.strictEqual(controller.getState().isSpeaking, false);
      assert.strictEqual(controller.getState().currentWordIndex, -1);
    });

    it('disposes subscriptions cleanly without throwing errors', () => {
      assert.doesNotThrow(() => {
        controller.dispose();
      });
      assert.strictEqual(controller.getState().isSpeaking, false);
    });

    it('supports prefersReducedMotion by restraining viseme amplitudes', () => {
      const normalController = new PersonaLipSyncController({ prefersReducedMotion: false });
      const reducedController = new PersonaLipSyncController({ prefersReducedMotion: true });

      normalController.startSpeech('bat');
      reducedController.startSpeech('bat');

      normalController.update(0.10);
      reducedController.update(0.10);

      const normalWeights = normalController.getCurrentWeights();
      const reducedWeights = reducedController.getCurrentWeights();

      assert.ok(reducedWeights.visemes.AE_AA < normalWeights.visemes.AE_AA);

      normalController.dispose();
      reducedController.dispose();
    });
  });
});
