/**
 * GraphMind Authentication & Identity Service
 * 
 * Provides unified user identity resolution across the local application.
 * Designed to integrate seamlessly with future OAuth / Firebase / backend auth providers
 * while providing strict identity separation and ownership verification in the local environment.
 */

export interface AuthUser {
  id: string;
  email?: string;
  name?: string;
}

export const DEFAULT_LOCAL_USER_ID = 'user-local-default';

const AUTH_STORAGE_KEY = 'graphmind_current_user_v1';

let activeUserOverride: AuthUser | null | undefined = undefined;

/**
 * Get the currently authenticated user.
 * Defaults to the standard local workspace user if none explicitly set.
 */
export function getCurrentUser(): AuthUser | null {
  if (activeUserOverride !== undefined) {
    return activeUserOverride;
  }

  if (typeof localStorage === 'undefined') {
    return { id: DEFAULT_LOCAL_USER_ID, name: 'Local Scholar' };
  }

  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.id === 'string') {
        return parsed as AuthUser;
      }
    }
  } catch (err) {
    console.warn('[Auth] Failed to load current user:', err);
  }

  // Default local user for the workspace
  return { id: DEFAULT_LOCAL_USER_ID, name: 'Local Scholar' };
}

/**
 * Get current user ID, or null if unauthenticated.
 */
export function getCurrentUserId(): string | null {
  const user = getCurrentUser();
  return user ? user.id : null;
}

/**
 * Set the currently authenticated user (or null to log out).
 */
export function setCurrentUser(user: AuthUser | null): void {
  activeUserOverride = user;

  if (typeof localStorage === 'undefined') return;

  try {
    if (user) {
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    }
  } catch (err) {
    console.warn('[Auth] Failed to save current user:', err);
  }
}

/**
 * Reset authentication state (for tests and session logout).
 */
export function clearCurrentUser(): void {
  activeUserOverride = null;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}

/**
 * Reset override back to default state (useful between tests).
 */
export function resetAuthToDefault(): void {
  activeUserOverride = undefined;
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(AUTH_STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
