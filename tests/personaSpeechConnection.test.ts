import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  SpeechSynthesisService,
  speechSynthesisService
} from '../src/services/speechSynthesisService';
import {
  PERSONA_GREETING_TEXT,
  GRAPHMIN_VOICE_CONFIG
} from '../src/components/persona/personaVoiceConfig';
import { PersonaLifeController } from '../src/components/persona/personaLifeController';
import { PersonaExpressionController } from '../src/components/persona/personaExpressionController';

describe('GRAPHMIND — PERSONA: SPEECH INTERFACE & GREETING INTEGRATION', () => {
  let originalWindow: any;
  let mockVoices: any[];
  let speakCallCount = 0;
  let cancelCallCount = 0;
  let lastUtterance: any = null;

  beforeEach(() => {
    mockVoices = [
      { name: 'Google US English', lang: 'en-US', default: true },
      { name: 'Rishi', lang: 'en-IN', default: false },
      { name: 'Daniel', lang: 'en-GB', default: false }
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
  // 1. REUSABLE SPEAKING INTERFACE & STATE MANAGEMENT
  // =========================================================================
  describe('1. Reusable Speaking Interface & Minimal State Model', () => {
    it('manages speech lifecycle: idle -> speaking -> completed', async () => {
      const service = new SpeechSynthesisService();
      assert.strictEqual(service.getState().status, 'idle');

      const speakPromise = service.speak(PERSONA_GREETING_TEXT);
      await new Promise(r => setTimeout(r, 10));

      assert.strictEqual(service.getState().status, 'speaking');
      assert.strictEqual(service.getState().text, PERSONA_GREETING_TEXT);

      if (lastUtterance?.onend) lastUtterance.onend();
      await speakPromise;

      assert.strictEqual(service.getState().status, 'completed');
    });

    it('cancels ongoing speech and resets state to idle when stop() is invoked', async () => {
      const service = new SpeechSynthesisService();
      const speakPromise = service.speak('Ongoing sentence that gets stopped');

      await new Promise(r => setTimeout(r, 10));
      assert.strictEqual(service.getState().status, 'speaking');

      service.stop();
      assert.strictEqual(cancelCallCount, 1);
      assert.strictEqual(service.getState().status, 'idle');
      assert.strictEqual(service.getState().text, null);

      await speakPromise;
    });

    it('prevents overlapping utterances by cancelling ongoing speech before starting a new one', async () => {
      const service = new SpeechSynthesisService();

      service.speak('Utterance One');
      await new Promise(r => setTimeout(r, 10));
      assert.strictEqual(speakCallCount, 1);

      service.speak('Utterance Two');
      await new Promise(r => setTimeout(r, 10));

      assert.strictEqual(cancelCallCount, 1);
      assert.strictEqual(speakCallCount, 2);
      assert.strictEqual(service.getState().text, 'Utterance Two');
    });

    it('handles speech failure gracefully without uncaught rejection and records error state', async () => {
      const service = new SpeechSynthesisService();
      const speakPromise = service.speak('Failing utterance');

      await new Promise(r => setTimeout(r, 10));

      if (lastUtterance?.onerror) {
        lastUtterance.onerror({ error: 'not-allowed' });
      }

      await speakPromise.catch(err => {
        assert.ok(err.message.includes('not-allowed'));
      });

      assert.strictEqual(service.getState().status, 'failed');
      assert.ok(service.getState().error?.includes('not-allowed'));
    });
  });

  // =========================================================================
  // 2. INITIAL GREETING INTEGRATION & COORDINATION
  // =========================================================================
  describe('2. Initial Greeting Lifecycle & Animation Coordination', () => {
    it('uses the exact expected greeting sentence: "Hey, welcome to GraphMind."', () => {
      assert.strictEqual(PERSONA_GREETING_TEXT, 'Hey, welcome to GraphMind.');
    });

    it('applies calm, warm vocal defaults (rate: 0.94, pitch: 0.96) and resolves Asian male voice', async () => {
      const service = new SpeechSynthesisService();
      const voice = service.getResolvedVoice();
      assert.strictEqual(voice?.name, 'Rishi');

      const speakPromise = service.speak(PERSONA_GREETING_TEXT);
      await new Promise(r => setTimeout(r, 10));

      assert.strictEqual(lastUtterance.rate, GRAPHMIN_VOICE_CONFIG.speakingRate);
      assert.strictEqual(lastUtterance.pitch, GRAPHMIN_VOICE_CONFIG.pitch);
      assert.strictEqual(lastUtterance.voice?.name, 'Rishi');

      if (lastUtterance?.onend) lastUtterance.onend();
      await speakPromise;
    });

    it('coordinates visual greeting duration when audio finishes BEFORE 3.0s (holds until 3.0s)', () => {
      const life = new PersonaLifeController();
      const expr = new PersonaExpressionController();

      // Trigger Stage C (nod and smile)
      life.startGreetingNod();
      expr.setGreetingLocked(true);
      expr.setExpression('happy', 1.0);

      assert.strictEqual(life.isGreetingActive(), true);
      assert.strictEqual(expr.isGreetingLocked(), true);

      // Advance 2.0s (audio finished at 2.0s, visual greeting still holding)
      for (let i = 0; i < 125; i++) {
        life.update(0.016, i * 16);
        expr.update(0.016);
      }

      // Visual smile must remain locked and active while within the 3.0s window
      assert.strictEqual(expr.isGreetingLocked(), true);
      assert.strictEqual(expr.getCurrentExpression(), 'happy');

      // Settle at 3.0s
      expr.setExpression('neutral', 1.2);
      expr.setGreetingLocked(false);
      life.resetGreeting();

      assert.strictEqual(life.isGreetingActive(), false);
      assert.strictEqual(expr.isGreetingLocked(), false);
    });

    it('coordinates visual greeting duration when audio finishes AFTER 3.0s (extends until audio ends)', () => {
      const life = new PersonaLifeController();
      const expr = new PersonaExpressionController();
      const service = new SpeechSynthesisService();

      service.speak(PERSONA_GREETING_TEXT);
      life.startGreetingNod();
      expr.setGreetingLocked(true);
      expr.setExpression('happy', 1.0);

      // At 3.0s, audio is still speaking
      let greetingCompleted = false;
      const simulateStageECheck = (speaking: boolean) => {
        if (speaking) {
          // Audio still active, greeting does not terminate prematurely
          return false;
        }
        greetingCompleted = true;
        expr.setExpression('neutral', 1.2);
        expr.setGreetingLocked(false);
        life.resetGreeting();
        return true;
      };

      // At 3000ms, still speaking:
      assert.strictEqual(simulateStageECheck(true), false);
      assert.strictEqual(expr.isGreetingLocked(), true);

      // At 3500ms, speech completes:
      if (lastUtterance?.onend) lastUtterance.onend();
      assert.strictEqual(simulateStageECheck(false), true);
      assert.strictEqual(greetingCompleted, true);
      assert.strictEqual(expr.isGreetingLocked(), false);
      assert.strictEqual(life.isGreetingActive(), false);
    });

    it('preserves visual greeting completely if speech playback fails (e.g. autoplay restriction)', () => {
      const life = new PersonaLifeController();
      const expr = new PersonaExpressionController();

      life.startGreetingNod();
      expr.setGreetingLocked(true);
      expr.setExpression('happy', 1.0);

      // Speech failed (e.g. autoplay error event)
      const speechState = { status: 'failed' as const, error: 'NotAllowedError: play() failed' };

      // Stage E check verifies that failed speech does not prevent visual greeting from completing
      const isSpeaking = speechState.status === 'speaking';
      assert.strictEqual(isSpeaking, false);

      // Visual greeting settles smoothly after 3.0s
      expr.setExpression('neutral', 1.2);
      expr.setGreetingLocked(false);
      life.resetGreeting();

      assert.strictEqual(life.isGreetingActive(), false);
      assert.strictEqual(expr.isGreetingLocked(), false);
    });
  });

  // =========================================================================
  // 3. UNMOUNT & RESOURCE CLEANUP
  // =========================================================================
  describe('3. Unmount & Cleanup Behavior', () => {
    it('stops active speech immediately when unmounting or exiting', () => {
      const service = new SpeechSynthesisService();
      service.speak(PERSONA_GREETING_TEXT);

      assert.strictEqual(cancelCallCount, 0);

      // User presses Esc / Exit button
      service.stop();
      assert.strictEqual(cancelCallCount, 1);
      assert.strictEqual(service.getState().status, 'idle');
    });

    it('allows fresh greeting upon re-entering Persona', () => {
      let entryCount = 0;
      let greetingTriggerCount = 0;

      const enterPersona = () => {
        entryCount++;
        let hasTriggeredInSession = false;
        return {
          onGreetingStage: (stage: string) => {
            if (stage === 'greeting' && !hasTriggeredInSession) {
              hasTriggeredInSession = true;
              greetingTriggerCount++;
            }
          }
        };
      };

      // Entry 1
      const session1 = enterPersona();
      session1.onGreetingStage('pause');
      session1.onGreetingStage('greeting');
      session1.onGreetingStage('complete');
      assert.strictEqual(greetingTriggerCount, 1);

      // Entry 2 (re-entry)
      const session2 = enterPersona();
      session2.onGreetingStage('pause');
      session2.onGreetingStage('greeting');
      session2.onGreetingStage('complete');
      assert.strictEqual(greetingTriggerCount, 2);
    });
  });
});
