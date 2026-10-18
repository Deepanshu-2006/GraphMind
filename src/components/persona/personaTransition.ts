/**
 * GraphMind Persona — Shared Transition Controller
 * 
 * Manages the state machine for the hero particle orb to human character transformation:
 * HERO_IDLE -> ORB_TO_HUMAN -> HUMAN_FORMED -> HUMAN_SOLIDIFYING -> PERSONA_READY
 */

export type PersonaTransitionState =
  | 'HERO_ENTERING'
  | 'HERO_IDLE'
  | 'ORB_TO_HUMAN'
  | 'HUMAN_FORMED'
  | 'PERSONA_READY'
  | 'RETURNING_TO_HERO';

class PersonaTransitionController {
  private _state: PersonaTransitionState = 'HERO_ENTERING';
  private _startTime = 0;
  private _listeners = new Set<(state: PersonaTransitionState) => void>();

  get state(): PersonaTransitionState {
    return this._state;
  }

  get startTime(): number {
    return this._startTime;
  }

  /**
   * Triggers transition from HERO_IDLE to ORB_TO_HUMAN.
   * Prevents repeated clicks from restarting or corrupting an active transition.
   */
  triggerOrbToHuman(): boolean {
    if (this._state !== 'HERO_IDLE') {
      return false;
    }
    this._state = 'ORB_TO_HUMAN';
    this._startTime = performance.now();
    this.notify();
    return true;
  }

  /**
   * Universal entry point to open Persona from anywhere in the application
   * (e.g. from any workspace view, TopBar avatar, direct navigation, or shortcuts).
   * Bypasses the hero orb idle restriction so profile can open from Overview,
   * Knowledge Graph, Study Space, Sources, Revision, or Settings.
   */
  openPersona(): boolean;
  openPersona(isReturning?: boolean): boolean;
  openPersona(isReturning = false): boolean {
    if (this._state === 'ORB_TO_HUMAN' || this._state === 'HUMAN_FORMED' || this._state === 'PERSONA_READY') {
      return false; // Already in Persona
    }
    this._state = isReturning ? 'PERSONA_READY' : 'ORB_TO_HUMAN';
    this._startTime = performance.now();
    this.notify();
    return true;
  }

  /**
   * Marks particle transformation as complete when human silhouette is formed.
   */
  completeHumanFormed(): void {
    if (this._state === 'ORB_TO_HUMAN') {
      this._state = 'HUMAN_FORMED';
      this.notify();
    }
  }

  /**
   * Transitions to PERSONA_READY once persona experience is fully active.
   */
  setPersonaReady(): void {
    if (this._state === 'HUMAN_FORMED') {
      this._state = 'PERSONA_READY';
      this.notify();
    }
  }

  /**
   * Triggers exit from Persona and begins preparation for return to hero.
   */
  triggerReturnToHero(): boolean {
    if (this._state !== 'PERSONA_READY' && this._state !== 'HUMAN_FORMED' && this._state !== 'ORB_TO_HUMAN') {
      return false;
    }
    this._state = 'RETURNING_TO_HERO';
    this._startTime = 0;
    this.notify();
    return true;
  }

  /**
   * Begins the hero entrance animation playback from its proper initial state.
   */
  startHeroEntering(): void {
    if (this._state === 'RETURNING_TO_HERO') {
      this._state = 'HERO_ENTERING';
      this._startTime = performance.now();
      this.notify();
    }
  }

  /**
   * Completes the hero entrance animation, returning orb to rest in HERO_IDLE.
   */
  completeHeroEntry(): void {
    if (this._state === 'HERO_ENTERING') {
      this._state = 'HERO_IDLE';
      this.notify();
    }
  }

  /**
   * Resets transition state back to HERO_IDLE when returning to workspace.
   */
  resetToHero(): void {
    if (this._state === 'PERSONA_READY' || this._state === 'HUMAN_FORMED' || this._state === 'ORB_TO_HUMAN') {
      this.triggerReturnToHero();
    } else {
      this._state = 'HERO_IDLE';
      this._startTime = 0;
      this.notify();
    }
  }

  /**
   * Development-only inspection mode (Phase 5):
   * Instantly displays the particle humanoid at its final target positions
   * in portrait framing without running the transition animation.
   */
  inspectStaticHumanoid(): void {
    this._state = 'PERSONA_READY';
    this._startTime = performance.now();
    this.notify();
  }

  /**
   * Subscribes a listener to transition state changes.
   * Immediately calls the listener with the current state.
   */
  subscribe(listener: (state: PersonaTransitionState) => void): () => void {
    this._listeners.add(listener);
    listener(this._state);
    return () => {
      this._listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of this._listeners) {
      listener(this._state);
    }
  }
}

export const personaTransitionController = new PersonaTransitionController();

if (typeof window !== 'undefined') {
  (window as unknown as { __personaTransitionController: PersonaTransitionController }).__personaTransitionController = personaTransitionController;
}
