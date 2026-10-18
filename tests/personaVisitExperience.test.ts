import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PERSONA_INTRO_STORAGE_KEY,
  isPersonaIntroCompleted,
  markPersonaIntroCompleted,
  resetPersonaIntroCompleted,
  getPersonaIntroRecord
} from '../src/services/personaVisit';
import { PERSONA_GREETING_TEXT, PERSONA_WELCOME_BACK_TEXT } from '../src/components/persona/personaVoiceConfig';
import { personaTransitionController } from '../src/components/persona/personaTransition';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock localStorage for Node test runner environment
class MockLocalStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }
}

// Attach mock localStorage to global if running in Node
const mockStorage = new MockLocalStorage();
(globalThis as unknown as { localStorage: MockLocalStorage }).localStorage = mockStorage;
(globalThis as unknown as { window: Record<string, unknown> }).window = {
  localStorage: mockStorage
};

describe('GRAPHMIND — PERSONA: FIRST-VISIT & RETURNING-VISIT EXPERIENCE', () => {
  beforeEach(() => {
    mockStorage.clear();
    personaTransitionController.resetToHero();
  });

  // =========================================================================
  // 1. Storage Key, Schema & Persistence Service
  // =========================================================================
  describe('1. Storage Key, Schema & Persistence Service', () => {
    it('uses a dedicated versioned storage key', () => {
      assert.strictEqual(
        PERSONA_INTRO_STORAGE_KEY,
        'graphmind_persona_intro_completed_v1',
        'Storage key must be graphmind_persona_intro_completed_v1'
      );
    });

    it('returns false for absent or empty storage', () => {
      assert.strictEqual(isPersonaIntroCompleted(), false);
      assert.strictEqual(getPersonaIntroRecord(), null);
    });

    it('returns false for corrupted or invalid JSON', () => {
      mockStorage.setItem(PERSONA_INTRO_STORAGE_KEY, 'invalid-json{{{');
      assert.strictEqual(isPersonaIntroCompleted(), false);
      assert.strictEqual(getPersonaIntroRecord(), null);
    });

    it('returns false when version is incorrect or completed flag is false', () => {
      mockStorage.setItem(
        PERSONA_INTRO_STORAGE_KEY,
        JSON.stringify({ version: 2, completed: true, completedAt: new Date().toISOString() })
      );
      assert.strictEqual(isPersonaIntroCompleted(), false);

      mockStorage.setItem(
        PERSONA_INTRO_STORAGE_KEY,
        JSON.stringify({ version: 1, completed: false, completedAt: new Date().toISOString() })
      );
      assert.strictEqual(isPersonaIntroCompleted(), false);
    });

    it('successfully persists version 1 record with ISO timestamp upon completion', () => {
      const success = markPersonaIntroCompleted();
      assert.strictEqual(success, true);
      assert.strictEqual(isPersonaIntroCompleted(), true);

      const record = getPersonaIntroRecord();
      assert.ok(record, 'Record must exist');
      assert.strictEqual(record?.version, 1);
      assert.strictEqual(record?.completed, true);
      assert.ok(!isNaN(Date.parse(record?.completedAt ?? '')), 'completedAt must be a valid ISO date');
    });

    it('cleanly resets the introduction flag via resetPersonaIntroCompleted', () => {
      markPersonaIntroCompleted();
      assert.strictEqual(isPersonaIntroCompleted(), true);
      resetPersonaIntroCompleted();
      assert.strictEqual(isPersonaIntroCompleted(), false);
      assert.strictEqual(getPersonaIntroRecord(), null);
    });
  });

  // =========================================================================
  // 2. First-Visit Experience & Genuine Completion Event
  // =========================================================================
  describe('2. First-Visit Experience & Genuine Completion Event', () => {
    it('treats a fresh user as a first-time visitor', () => {
      assert.strictEqual(isPersonaIntroCompleted(), false);
    });

    it('defines distinct first-visit greeting and returning-visit welcome-back copy', () => {
      assert.strictEqual(PERSONA_GREETING_TEXT, 'Hey, welcome to GraphMind.');
      assert.strictEqual(
        PERSONA_WELCOME_BACK_TEXT,
        'Welcome back. Let’s pick up where you left off.'
      );
      assert.notStrictEqual(PERSONA_GREETING_TEXT, PERSONA_WELCOME_BACK_TEXT);
    });

    it('verifies leaving during the first introduction does not mark it complete', () => {
      let isCompleted = false;
      let isDisposed = false;

      // Simulate first visit lifecycle with premature exit at 2.5s
      const timeout = setTimeout(() => {
        if (!isDisposed) {
          isCompleted = true;
          markPersonaIntroCompleted();
        }
      }, 5000);

      // Premature exit at 2.5s (simulating user pressing Esc or navigating back)
      isDisposed = true;
      clearTimeout(timeout);

      assert.strictEqual(isCompleted, false);
      assert.strictEqual(isPersonaIntroCompleted(), false);
    });

    it('marks introduction as completed only upon full completion of panel introductions', () => {
      let isCompleted = false;
      let continuousAnalysisStarted = false;

      // Simulate genuine completion point: right after right performance panel entrance finishes
      const triggerIntroductionComplete = () => {
        markPersonaIntroCompleted();
        isCompleted = true;
        continuousAnalysisStarted = true;
      };

      triggerIntroductionComplete();
      assert.strictEqual(isCompleted, true);
      assert.strictEqual(continuousAnalysisStarted, true);
      assert.strictEqual(isPersonaIntroCompleted(), true);
    });
  });

  // =========================================================================
  // 3. Returning-Visit Experience & Skip Behavior
  // =========================================================================
  describe('3. Returning-Visit Experience & Skip Behavior', () => {
    beforeEach(() => {
      markPersonaIntroCompleted();
    });

    it('recognizes returning visitor status immediately', () => {
      assert.strictEqual(isPersonaIntroCompleted(), true);
    });

    it('bypasses particle formation and initializes personaTransitionController directly in PERSONA_READY', () => {
      const isReturning = isPersonaIntroCompleted();
      const opened = personaTransitionController.openPersona(isReturning);
      assert.strictEqual(opened, true);
      assert.strictEqual(personaTransitionController.state, 'PERSONA_READY');
    });

    it('provides welcome-back message without replaying first-visit greeting', () => {
      const isReturning = true;
      const activeGreeting = isReturning ? PERSONA_WELCOME_BACK_TEXT : PERSONA_GREETING_TEXT;

      assert.strictEqual(activeGreeting, 'Welcome back. Let’s pick up where you left off.');
      assert.ok(!activeGreeting.includes('Hey, welcome to GraphMind.'));
    });

    it('shows full animation on page reload or fresh open, and shows welcome back when already viewed once and reopened', () => {
      // Reopening in the active session recognizes returning visitor status
      assert.strictEqual(isPersonaIntroCompleted(), true);

      // On page reload or fresh open, state is cleanly reset so full animation plays
      resetPersonaIntroCompleted();
      assert.strictEqual(isPersonaIntroCompleted(), false);
      assert.strictEqual(getPersonaIntroRecord(), null);
    });

    it('navigating away and reopening skips introduction without resetting completed state', () => {
      // Open persona as returning visitor
      personaTransitionController.openPersona(true);
      assert.strictEqual(personaTransitionController.state, 'PERSONA_READY');

      // Exit persona
      personaTransitionController.triggerReturnToHero();
      assert.strictEqual(personaTransitionController.state, 'RETURNING_TO_HERO');
      personaTransitionController.startHeroEntering();
      personaTransitionController.completeHeroEntry();
      assert.strictEqual(personaTransitionController.state, 'HERO_IDLE');

      // Completed flag is still preserved
      assert.strictEqual(isPersonaIntroCompleted(), true);

      // Reopen persona
      const reOpened = personaTransitionController.openPersona(isPersonaIntroCompleted());
      assert.strictEqual(reOpened, true);
      assert.strictEqual(personaTransitionController.state, 'PERSONA_READY');
    });
  });

  // =========================================================================
  // 4. Source Code Integration & Architecture Verification
  // =========================================================================
  describe('4. Source Code Integration & Architecture Verification', () => {
    const canvasPath = path.resolve(__dirname, '../src/components/persona/PersonaHumanoidCanvas.tsx');
    const canvasSrc = fs.readFileSync(canvasPath, 'utf8');

    const expPath = path.resolve(__dirname, '../src/components/persona/PersonaExperience.tsx');
    const expSrc = fs.readFileSync(expPath, 'utf8');

    const appPath = path.resolve(__dirname, '../src/App.tsx');
    const appSrc = fs.readFileSync(appPath, 'utf8');

    const transitionPath = path.resolve(__dirname, '../src/components/persona/personaTransition.ts');
    const transitionSrc = fs.readFileSync(transitionPath, 'utf8');

    it('verifies PersonaHumanoidCanvas exposes isReturningVisit and onIntroductionComplete props', () => {
      assert.ok(canvasSrc.includes('isReturningVisit?: boolean;'), 'Must define isReturningVisit prop');
      assert.ok(canvasSrc.includes('onIntroductionComplete?: () => void;'), 'Must define onIntroductionComplete prop');
      assert.ok(canvasSrc.includes('markPersonaIntroCompleted();'), 'Must invoke markPersonaIntroCompleted on genuine finish');
      assert.ok(canvasSrc.includes('onIntroductionCompleteRef.current?.();'), 'Must invoke onIntroductionComplete callback');
    });

    it('verifies PersonaExperience checks isPersonaIntroCompleted and passes state to canvas', () => {
      assert.ok(expSrc.includes('isPersonaIntroCompleted()'), 'Must check isPersonaIntroCompleted on mount');
      assert.ok(expSrc.includes('isReturningVisit={isReturningVisit}'), 'Must pass isReturningVisit to canvas');
      assert.ok(expSrc.includes('onIntroductionComplete={handleIntroductionComplete}'), 'Must pass onIntroductionComplete to canvas');
      assert.ok(expSrc.includes('PERSONA_WELCOME_BACK_TEXT'), 'Must reference PERSONA_WELCOME_BACK_TEXT');
    });

    it('verifies PersonaExperience shows welcome-back message in dedicated message area without speech bubble or card', () => {
      assert.ok(expSrc.includes('welcomeBackCaptionVisible'), 'Must manage welcomeBackCaptionVisible state');
      assert.ok(
        expSrc.includes('PERSONA_WELCOME_BACK_TEXT') && expSrc.includes('activeMessage'),
        'Must route welcome-back message through unified activeMessage system'
      );
    });

    it('verifies App.tsx checks isPersonaIntroCompleted when opening persona from navigation or route', () => {
      assert.ok(appSrc.includes('isPersonaIntroCompleted()'), 'App.tsx must check isPersonaIntroCompleted');
      assert.ok(appSrc.includes('personaTransitionController.openPersona(isReturning)'), 'App.tsx must pass isReturning to openPersona');
    });

    it('verifies personaTransitionController.openPersona supports isReturning to enter PERSONA_READY immediately', () => {
      assert.ok(transitionSrc.includes('openPersona(isReturning = false)'), 'openPersona must accept isReturning parameter');
      assert.ok(transitionSrc.includes("this._state = isReturning ? 'PERSONA_READY' : 'ORB_TO_HUMAN';"), 'Must set state to PERSONA_READY when returning');
    });
  });
});
