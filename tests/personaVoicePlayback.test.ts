import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  SpeechSynthesisService,
  speechSynthesisService,
  type SpeechPlaybackStatus,
  type SpeechPlaybackState
} from '../src/services/speechSynthesisService';
import {
  GRAPHMIN_VOICE_CONFIG,
  prepareTextForSpeech,
  PERSONA_TEST_SENTENCES
} from '../src/components/persona/personaVoiceConfig';

describe('GRAPHMIND — PERSONA: VOICE & SPEECH PLAYBACK ARCHITECTURE', () => {
  // Mock SpeechSynthesis environment for Node.js test runner
  let originalWindow: any;
  let mockVoices: any[];
  let speakCallCount = 0;
  let cancelCallCount = 0;
  let lastUtterance: any = null;

  beforeEach(() => {
    mockVoices = [
      { name: 'Google US English', lang: 'en-US', default: true },
      { name: 'Samantha (Enhanced)', lang: 'en-US', default: false },
      { name: 'Daniel', lang: 'en-GB', default: false },
      { name: 'Thomas', lang: 'fr-FR', default: false }
    ];
    speakCallCount = 0;
    cancelCallCount = 0;
    lastUtterance = null;

    originalWindow = (global as any).window;

    class MockSpeechSynthesisUtterance {
      public text: string;
      public rate = 1;
      public pitch = 1;
      public volume = 1;
      public lang = 'en-US';
      public voice: any = null;
      public onstart: (() => void) | null = null;
      public onend: (() => void) | null = null;
      public onerror: ((e: any) => void) | null = null;

      constructor(text: string) {
        this.text = text;
        lastUtterance = this;
      }
    }

    const mockSpeechSynthesis = {
      speaking: false,
      pending: false,
      paused: false,
      getVoices: () => mockVoices,
      speak: (utt: any) => {
        speakCallCount++;
        mockSpeechSynthesis.speaking = true;
        // Trigger onstart synchronously or microtask
        queueMicrotask(() => {
          if (utt.onstart) utt.onstart();
        });
      },
      cancel: () => {
        cancelCallCount++;
        mockSpeechSynthesis.speaking = false;
        if (lastUtterance && lastUtterance.onerror) {
          lastUtterance.onerror({ error: 'canceled' });
        }
      },
      pause: () => { mockSpeechSynthesis.paused = true; },
      resume: () => { mockSpeechSynthesis.paused = false; },
      addEventListener: () => {},
      removeEventListener: () => {}
    };

    (global as any).window = {
      speechSynthesis: mockSpeechSynthesis,
      SpeechSynthesisUtterance: MockSpeechSynthesisUtterance
    };
  });

  afterEach(() => {
    (global as any).window = originalWindow;
  });

  // =========================================================================
  // 1. SPEECH INTERFACE & CAPABILITIES
  // =========================================================================
  describe('1. Speech Interface & State Machine', () => {
    it('initializes in idle status when supported', () => {
      const service = new SpeechSynthesisService();
      assert.strictEqual(service.isSupported(), true);
      assert.strictEqual(service.getState().status, 'idle');
      assert.strictEqual(service.getState().text, null);
      assert.strictEqual(service.getState().error, null);
    });

    it('handles unsupported environments gracefully without crashing', () => {
      (global as any).window = {};
      const service = new SpeechSynthesisService();
      assert.strictEqual(service.isSupported(), false);
      assert.strictEqual(service.getState().status, 'unsupported');

      // Attempting to speak in unsupported runtime rejects gracefully
      return service.speak('Hello').catch((err) => {
        assert.ok(err.message.includes('not supported'));
      });
    });

    it('starts speech playback and transitions states: idle -> loading -> speaking -> completed', async () => {
      const service = new SpeechSynthesisService();
      const statusTransitions: SpeechPlaybackStatus[] = [];

      service.subscribe((state) => {
        statusTransitions.push(state.status);
      });

      const speakPromise = service.speak('Welcome to GraphMind.');

      // Wait for microtasks
      await new Promise(r => setTimeout(r, 10));

      assert.strictEqual(service.getState().status, 'speaking');
      assert.strictEqual(service.getState().text, 'Welcome to GraphMind.');

      // Simulate browser speech completion
      if (lastUtterance?.onend) {
        lastUtterance.onend();
      }

      await speakPromise;
      assert.strictEqual(service.getState().status, 'completed');

      // Confirm expected progression
      assert.ok(statusTransitions.includes('loading'));
      assert.ok(statusTransitions.includes('speaking'));
      assert.ok(statusTransitions.includes('completed'));
    });

    it('stops ongoing playback immediately and resets status to idle', async () => {
      const service = new SpeechSynthesisService();
      const speakPromise = service.speak('This will be interrupted.');

      await new Promise(r => setTimeout(r, 10));
      assert.strictEqual(service.getState().status, 'speaking');

      service.stop();
      assert.strictEqual(cancelCallCount, 1);
      assert.strictEqual(service.getState().status, 'idle');

      // Stopped promise resolves cleanly without uncaught rejection
      await speakPromise;
    });

    it('prevents overlapping speech requests by cancelling previous utterance before starting new one', async () => {
      const service = new SpeechSynthesisService();

      service.speak('First message that should be canceled.');
      await new Promise(r => setTimeout(r, 10));
      assert.strictEqual(speakCallCount, 1);

      service.speak('Second message that takes precedence.');
      await new Promise(r => setTimeout(r, 10));

      // Cancel must have been invoked to stop the first utterance
      assert.strictEqual(cancelCallCount, 1);
      assert.strictEqual(speakCallCount, 2);
      assert.strictEqual(service.getState().text, 'Second message that takes precedence.');
    });

    it('handles speech playback error events gracefully without breaking service', async () => {
      const service = new SpeechSynthesisService();
      const speakPromise = service.speak('Error test');

      await new Promise(r => setTimeout(r, 10));

      // Trigger unexpected synth error (not user cancellation)
      if (lastUtterance?.onerror) {
        lastUtterance.onerror({ error: 'audio-busy' });
      }

      await speakPromise.catch((err) => {
        assert.ok(err.message.includes('audio-busy'));
      });

      assert.strictEqual(service.getState().status, 'failed');
      assert.ok(service.getState().error?.includes('audio-busy'));

      // Service remains operational for subsequent calls
      const retryPromise = service.speak('Retry works');
      await new Promise(r => setTimeout(r, 10));
      assert.strictEqual(service.getState().status, 'speaking');
      if (lastUtterance?.onend) lastUtterance.onend();
      await retryPromise;
      assert.strictEqual(service.getState().status, 'completed');
    });
  });

  // =========================================================================
  // 2. CROSS-PLATFORM VOICE DISCOVERY & SELECTION
  // =========================================================================
  describe('2. Voice Discovery & Natural Voice Prioritization', () => {
    it('retrieves available voices from the synthesis engine', () => {
      const service = new SpeechSynthesisService();
      const voices = service.getVoices();
      assert.strictEqual(voices.length, 4);
      assert.strictEqual(voices[0].name, 'Google US English');
    });

    it('prioritizes articulate male voices (e.g. Daniel) over default female voices', () => {
      (global as any).window.speechSynthesis.getVoices = () => [
        { name: 'Generic Voice', lang: 'en-US', default: true },
        { name: 'Samantha (Enhanced)', lang: 'en-US', default: false },
        { name: 'Daniel', lang: 'en-GB', default: false }
      ];
      const service = new SpeechSynthesisService();
      const best = service.selectBestVoice();
      assert.ok(best !== null);
      assert.strictEqual(best?.name, 'Daniel');
    });

    it('selects explicit voice by name when requested', () => {
      const service = new SpeechSynthesisService();
      const voice = service.selectBestVoice('Daniel');
      assert.strictEqual(voice?.name, 'Daniel');
    });

    it('falls back gracefully to default voice when no preferred voices match', () => {
      (global as any).window.speechSynthesis.getVoices = () => [
        { name: 'Generic Voice', lang: 'en-US', default: true }
      ];
      const service = new SpeechSynthesisService();
      const voice = service.selectBestVoice(undefined, 'en-US');
      assert.strictEqual(voice?.name, 'Generic Voice');
    });

    it('returns null safely without errors when voice list is empty', () => {
      (global as any).window.speechSynthesis.getVoices = () => [];
      const service = new SpeechSynthesisService();
      const voice = service.selectBestVoice();
      assert.strictEqual(voice, null);
    });
  });

  // =========================================================================
  // 3. CLEANUP & SUBSCRIPTION MANAGEMENT
  // =========================================================================
  describe('3. Resource Cleanup & Listener Management', () => {
    it('cleans up listeners and cancels speech on service disposal', () => {
      const service = new SpeechSynthesisService();
      let listenerCalled = false;
      const unsubscribe = service.subscribe(() => {
        listenerCalled = true;
      });

      assert.strictEqual(listenerCalled, true);
      unsubscribe();

      // Disposing service stops speech
      service.dispose();
      assert.strictEqual(service.getState().status, 'idle');
    });

    it('exposes shared singleton instance for app-wide reuse', () => {
      assert.ok(speechSynthesisService instanceof SpeechSynthesisService);
    });
  });

  // =========================================================================
  // 4. CENTRALIZED VOICE CONFIGURATION & DEFAULTS
  // =========================================================================
  describe('4. Centralized Voice Configuration & Restrained Defaults', () => {
    it('provides calm, articulate speaking rate and pitch matching Persona identity', () => {
      assert.strictEqual(GRAPHMIN_VOICE_CONFIG.speakingRate, 0.94);
      assert.strictEqual(GRAPHMIN_VOICE_CONFIG.pitch, 0.96);
      assert.strictEqual(GRAPHMIN_VOICE_CONFIG.volume, 1.0);
      assert.strictEqual(GRAPHMIN_VOICE_CONFIG.lang, 'en-US');
    });

    it('exposes prioritized voice list with Asian English male voices at the top', () => {
      assert.ok(GRAPHMIN_VOICE_CONFIG.preferredVoiceNames.length > 0);
      assert.strictEqual(GRAPHMIN_VOICE_CONFIG.preferredVoiceNames[0], 'Rishi');
      assert.ok(GRAPHMIN_VOICE_CONFIG.preferredAsianVoiceKeywords.includes('rishi'));
      assert.ok(GRAPHMIN_VOICE_CONFIG.preferredAsianVoiceKeywords.includes('ravi'));
    });

    it('filters out female vocal keywords when seeking masculine persona', () => {
      assert.ok(GRAPHMIN_VOICE_CONFIG.disallowedVoiceKeywords.includes('female'));
      assert.ok(GRAPHMIN_VOICE_CONFIG.disallowedVoiceKeywords.includes('woman'));
      assert.ok(GRAPHMIN_VOICE_CONFIG.disallowedVoiceKeywords.includes('samantha'));
    });
  });

  // =========================================================================
  // 5. TEXT PREPROCESSING & NATURAL SENTENCE PACING
  // =========================================================================
  describe('5. Text Preprocessing for Spoken Delivery', () => {
    it('strips markdown syntax while preserving spoken words', () => {
      const raw = '### Heading\n**Welcome** to [GraphMind](https://example.com)! Run `npm start`.';
      const processed = prepareTextForSpeech(raw);
      assert.strictEqual(processed, 'Heading. Welcome to GraphMind! Run npm start.');
    });

    it('replaces em-dashes and colons with commas for natural vocal breath pauses', () => {
      const raw = 'GraphMind — a thinking tool: connect your ideas.';
      const processed = prepareTextForSpeech(raw);
      assert.strictEqual(processed, 'GraphMind, a thinking tool, connect your ideas.');
    });

    it('replaces ellipses with clean sentence pause', () => {
      const raw = 'Thinking... ready now.';
      const processed = prepareTextForSpeech(raw);
      assert.strictEqual(processed, 'Thinking. ready now.');
    });

    it('preserves uppercase technical acronyms so they are spelled or pronounced cleanly', () => {
      const raw = 'inspect cpu, ram, gpu and api connections';
      const processed = prepareTextForSpeech(raw);
      assert.strictEqual(processed, 'inspect CPU, RAM, GPU and API connections');
    });

    it('preserves test sentences verbatim without arbitrary rewriting', () => {
      for (const sentence of PERSONA_TEST_SENTENCES) {
        assert.strictEqual(prepareTextForSpeech(sentence), sentence);
      }
    });
  });

  // =========================================================================
  // 6. ASIAN MALE VOICE SELECTION & MULTI-TIER FALLBACK
  // =========================================================================
  describe('6. Asian Male Voice Prioritization & Multi-Tier Fallback', () => {
    it('prioritizes Asian male voice (e.g. Rishi) over generic or female voices', () => {
      (global as any).window.speechSynthesis.getVoices = () => [
        { name: 'Samantha (Enhanced)', lang: 'en-US', default: true },
        { name: 'Rishi', lang: 'en-IN', default: false },
        { name: 'Alex', lang: 'en-US', default: false }
      ];
      const service = new SpeechSynthesisService();
      const best = service.selectBestVoice();
      assert.strictEqual(best?.name, 'Rishi');
    });

    it('prioritizes Microsoft Ravi or Wayne when present', () => {
      (global as any).window.speechSynthesis.getVoices = () => [
        { name: 'Microsoft Zira - English (United States)', lang: 'en-US', default: true },
        { name: 'Microsoft Ravi Online (Natural) - English (India)', lang: 'en-IN', default: false },
        { name: 'Microsoft David - English (United States)', lang: 'en-US', default: false }
      ];
      const service = new SpeechSynthesisService();
      const best = service.selectBestVoice();
      assert.strictEqual(best?.name, 'Microsoft Ravi Online (Natural) - English (India)');
    });

    it('falls back to articulate calm male voices (Google UK English Male, Daniel) if Asian male voice unavailable', () => {
      (global as any).window.speechSynthesis.getVoices = () => [
        { name: 'Google US English (Female)', lang: 'en-US', default: true },
        { name: 'Google UK English Male', lang: 'en-GB', default: false },
        { name: 'Victoria', lang: 'en-US', default: false }
      ];
      const service = new SpeechSynthesisService();
      const best = service.selectBestVoice();
      assert.strictEqual(best?.name, 'Google UK English Male');
    });

    it('filters out disallowed female voices and falls back to default or available voice if no male voices exist', () => {
      (global as any).window.speechSynthesis.getVoices = () => [
        { name: 'Samantha', lang: 'en-US', default: false },
        { name: 'Victoria', lang: 'en-US', default: false },
        { name: 'System Neutral Voice', lang: 'en-US', default: true }
      ];
      const service = new SpeechSynthesisService();
      const best = service.selectBestVoice();
      assert.strictEqual(best?.name, 'System Neutral Voice');
    });
  });

  // =========================================================================
  // 7. THREE TEST SENTENCES DEVELOPMENT VERIFICATION
  // =========================================================================
  describe('7. Three Test Sentences Voice Quality Verification', () => {
    it('applies configured speaking rate (0.94) and pitch (0.96) to all three test sentences', async () => {
      const service = new SpeechSynthesisService();

      for (let i = 0; i < PERSONA_TEST_SENTENCES.length; i++) {
        const sentence = PERSONA_TEST_SENTENCES[i];
        const speakPromise = service.speak(sentence);

        await new Promise(r => setTimeout(r, 10));

        assert.strictEqual(service.getState().status, 'speaking');
        assert.strictEqual(service.getState().text, sentence);
        assert.ok(lastUtterance !== null);
        assert.strictEqual(lastUtterance.rate, 0.94);
        assert.strictEqual(lastUtterance.pitch, 0.96);
        assert.strictEqual(lastUtterance.volume, 1.0);
        assert.strictEqual(lastUtterance.text, sentence);

        // End utterance
        if (lastUtterance.onend) lastUtterance.onend();
        await speakPromise;
        assert.strictEqual(service.getState().status, 'completed');
      }
    });

    it('interfering consecutive sentence cancels previous without overlapping audio', async () => {
      const service = new SpeechSynthesisService();

      // Start sentence 1
      service.speak(PERSONA_TEST_SENTENCES[0]);
      await new Promise(r => setTimeout(r, 10));
      assert.strictEqual(service.getState().text, PERSONA_TEST_SENTENCES[0]);

      // Trigger sentence 2 before sentence 1 completes
      const sentence2Promise = service.speak(PERSONA_TEST_SENTENCES[1]);
      await new Promise(r => setTimeout(r, 10));

      assert.strictEqual(cancelCallCount, 1);
      assert.strictEqual(service.getState().text, PERSONA_TEST_SENTENCES[1]);

      if (lastUtterance.onend) lastUtterance.onend();
      await sentence2Promise;
      assert.strictEqual(service.getState().status, 'completed');
    });
  });
});
