import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  SpeechSynthesisService,
  speechSynthesisService,
  type SpeechPlaybackStatus,
  type SpeechPlaybackState
} from '../src/services/speechSynthesisService';

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

    it('prioritizes enhanced/natural voices when available', () => {
      (global as any).window.speechSynthesis.getVoices = () => [
        { name: 'Generic Voice', lang: 'en-US', default: true },
        { name: 'Samantha (Enhanced)', lang: 'en-US', default: false }
      ];
      const service = new SpeechSynthesisService();
      const best = service.selectBestVoice();
      assert.ok(best !== null);
      assert.strictEqual(best?.name, 'Samantha (Enhanced)');
    });

    it('selects explicit voice by name when requested', () => {
      const service = new SpeechSynthesisService();
      const voice = service.selectBestVoice('Daniel');
      assert.strictEqual(voice?.name, 'Daniel');
    });

    it('falls back gracefully to default voice when no natural voices match language', () => {
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
});
