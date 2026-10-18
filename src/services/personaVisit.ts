/**
 * GraphMind Persona — Visit State Persistence Service
 *
 * Tracks whether the user has completed the full introduction sequence
 * for the GraphMind Persona.
 *
 * Requirements:
 * - Versioned persistence key: 'graphmind_persona_intro_completed_v1'
 * - Independent of component mounting lifecycle
 * - Safe against missing, corrupted, or invalid localStorage data
 * - Does not introduce authentication, backend, or unrelated user profile state
 */

export const PERSONA_INTRO_STORAGE_KEY = 'graphmind_persona_intro_completed_v1';

export interface PersonaIntroRecord {
  version: 1;
  completed: boolean;
  completedAt: string;
}

/**
 * Determines whether the Persona introduction has been genuinely completed.
 * Validates version and completion structure; returns false for missing or corrupt records.
 */
export function isPersonaIntroCompleted(): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false;
  }

  try {
    const raw = localStorage.getItem(PERSONA_INTRO_STORAGE_KEY);
    if (!raw) return false;

    const parsed = JSON.parse(raw) as Partial<PersonaIntroRecord>;
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.version === 1 &&
      parsed.completed === true &&
      typeof parsed.completedAt === 'string'
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Persists a versioned record indicating the Persona introduction has finished.
 * Returns true if written successfully, false on error.
 */
export function markPersonaIntroCompleted(): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return false;
  }

  try {
    const record: PersonaIntroRecord = {
      version: 1,
      completed: true,
      completedAt: new Date().toISOString()
    };
    localStorage.setItem(PERSONA_INTRO_STORAGE_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
}

/**
 * Resets the Persona introduction completion flag in localStorage.
 * Useful for automated tests and resetting demo state.
 */
export function resetPersonaIntroCompleted(): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.removeItem(PERSONA_INTRO_STORAGE_KEY);
  } catch {
    // Ignore storage errors on reset
  }
}

/**
 * Retrieves the raw completed record if valid, or null.
 */
export function getPersonaIntroRecord(): PersonaIntroRecord | null {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }

  try {
    const raw = localStorage.getItem(PERSONA_INTRO_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as PersonaIntroRecord;
    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.version === 1 &&
      parsed.completed === true &&
      typeof parsed.completedAt === 'string'
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
