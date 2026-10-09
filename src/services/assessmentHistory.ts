/**
 * GraphMind Assessment History & Attempt Persistence Service
 * 
 * Provides an immutable, permanent historical record of every completed assessment attempt.
 * Ensures strict historical accuracy: questions, answer options, selected answers, explanations,
 * and scores remain preserved even if the underlying knowledge graph is edited, renamed, or deleted.
 */

import type { AssessmentAttempt, TestQuestion } from '../types/test';
import { getCurrentUserId } from './auth';

export const ASSESSMENT_HISTORY_STORAGE_KEY = 'graphmind_assessment_attempts_v1';

export class AssessmentPersistenceError extends Error {
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'AssessmentPersistenceError';
    this.cause = cause;
  }
}

export class AssessmentAccessDeniedError extends Error {
  constructor(message: string = 'Access denied: you do not have permission to view this assessment attempt.') {
    super(message);
    this.name = 'AssessmentAccessDeniedError';
  }
}

export interface GetAssessmentAttemptsOptions {
  userId?: string | null;
  graphId?: string;
}

export interface GetAttemptByIdOptions {
  userId?: string | null;
}

/**
 * Retrieve all persistent assessment attempts with strict ownership isolation.
 * Results are ordered by completedAt descending (newest first).
 */
export function getAssessmentAttempts(options: GetAssessmentAttemptsOptions = {}): AssessmentAttempt[] {
  if (typeof localStorage === 'undefined') return [];

  try {
    const raw = localStorage.getItem(ASSESSMENT_HISTORY_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const attempts = parsed as AssessmentAttempt[];

    // Determine target user for ownership filtering
    const targetUserId = options.userId !== undefined ? options.userId : getCurrentUserId();

    const filtered = attempts.filter(attempt => {
      // 1. Ownership verification
      if (targetUserId) {
        // Only return attempts matching current user's ID or unowned legacy attempts
        if (attempt.userId && attempt.userId !== targetUserId) {
          return false;
        }
      }

      // 2. Graph filter (optional)
      if (options.graphId && attempt.graphId !== options.graphId) {
        return false;
      }

      return true;
    });

    // 3. Order by completion date descending (newest first)
    return filtered.sort((a, b) => {
      const timeA = new Date(a.completedAt).getTime() || 0;
      const timeB = new Date(b.completedAt).getTime() || 0;
      return timeB - timeA;
    });
  } catch (err) {
    console.warn('[AssessmentHistory] Failed to read assessment history:', err);
    return [];
  }
}

/**
 * Retrieve a specific assessment attempt by ID with ownership verification.
 * Throws AssessmentAccessDeniedError if the attempt belongs to another user.
 */
export function getAssessmentAttemptById(
  attemptId: string,
  options: GetAttemptByIdOptions = {}
): AssessmentAttempt | null {
  if (typeof localStorage === 'undefined' || !attemptId) return null;

  try {
    const raw = localStorage.getItem(ASSESSMENT_HISTORY_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    const match = (parsed as AssessmentAttempt[]).find(a => a.id === attemptId);
    if (!match) return null;

    // Verify ownership
    const targetUserId = options.userId !== undefined ? options.userId : getCurrentUserId();
    if (targetUserId && match.userId && match.userId !== targetUserId) {
      throw new AssessmentAccessDeniedError();
    }

    return match;
  } catch (err) {
    if (err instanceof AssessmentAccessDeniedError) {
      throw err;
    }
    console.warn('[AssessmentHistory] Failed to load attempt by id:', err);
    return null;
  }
}

/**
 * Save an assessment attempt permanently.
 * - Deeply snapshots questions and choices to guarantee historical accuracy.
 * - Prevents duplicate records if the same attempt or test session submits more than once.
 * - Associates with current authenticated user.
 * - Never overwrites earlier attempts on the same graph.
 * - Throws AssessmentPersistenceError on write failure.
 */
export function saveAssessmentAttempt(attempt: AssessmentAttempt): AssessmentAttempt {
  if (typeof localStorage === 'undefined') {
    throw new AssessmentPersistenceError('LocalStorage is not available in the current environment.');
  }

  if (!attempt || !attempt.id) {
    throw new AssessmentPersistenceError('Invalid attempt record: missing attempt ID.');
  }

  // Ensure user ownership is assigned if available
  const resolvedUserId = attempt.userId !== undefined ? attempt.userId : getCurrentUserId();

  // Deep clone questions snapshot to preserve historical integrity against later graph mutations
  const frozenQuestions: TestQuestion[] = JSON.parse(JSON.stringify(attempt.questions || []));

  // Ensure unanswered questions remain absent without invented values
  const frozenAnswers: Record<string, string> = { ...(attempt.userAnswers || {}) };

  const sanitizedAttempt: AssessmentAttempt = {
    ...attempt,
    userId: resolvedUserId,
    questions: frozenQuestions,
    userAnswers: frozenAnswers,
    completedAt: attempt.completedAt || new Date().toISOString(),
    createdAt: attempt.createdAt || new Date().toISOString()
  };

  try {
    const raw = localStorage.getItem(ASSESSMENT_HISTORY_STORAGE_KEY);
    const existing: AssessmentAttempt[] = raw ? JSON.parse(raw) : [];

    // DUPLICATE PREVENTION:
    // If an attempt with this ID or identical testId already exists, do not duplicate
    const existingIndex = existing.findIndex(
      a => a.id === sanitizedAttempt.id || (sanitizedAttempt.testId && a.testId === sanitizedAttempt.testId)
    );

    let updated: AssessmentAttempt[];
    if (existingIndex >= 0) {
      // Already saved: return existing record safely without duplicate insertion
      return existing[existingIndex];
    } else {
      // Prepend newest attempt to history
      updated = [sanitizedAttempt, ...existing];
    }

    localStorage.setItem(ASSESSMENT_HISTORY_STORAGE_KEY, JSON.stringify(updated));
    return sanitizedAttempt;
  } catch (err) {
    console.error('[AssessmentHistory] Database write failed:', err);
    throw new AssessmentPersistenceError(
      'Failed to persist assessment attempt to permanent storage.',
      err
    );
  }
}

/**
 * Delete an assessment attempt with ownership verification.
 */
export function deleteAssessmentAttempt(
  attemptId: string,
  options: GetAttemptByIdOptions = {}
): boolean {
  if (typeof localStorage === 'undefined' || !attemptId) return false;

  try {
    const raw = localStorage.getItem(ASSESSMENT_HISTORY_STORAGE_KEY);
    if (!raw) return false;

    const existing: AssessmentAttempt[] = JSON.parse(raw);
    const target = existing.find(a => a.id === attemptId);
    if (!target) return false;

    // Verify ownership before deleting
    const targetUserId = options.userId !== undefined ? options.userId : getCurrentUserId();
    if (targetUserId && target.userId && target.userId !== targetUserId) {
      throw new AssessmentAccessDeniedError('Cannot delete assessment attempt belonging to another user.');
    }

    const filtered = existing.filter(a => a.id !== attemptId);
    localStorage.setItem(ASSESSMENT_HISTORY_STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch (err) {
    if (err instanceof AssessmentAccessDeniedError) throw err;
    console.warn('[AssessmentHistory] Failed to delete attempt:', err);
    return false;
  }
}

/**
 * Clear assessment attempts (for testing or reset).
 */
export function clearAssessmentHistory(options: GetAssessmentAttemptsOptions = {}): void {
  if (typeof localStorage === 'undefined') return;

  try {
    if (!options.userId && !options.graphId) {
      localStorage.removeItem(ASSESSMENT_HISTORY_STORAGE_KEY);
      return;
    }

    const existing = getAssessmentAttempts();
    const remaining = existing.filter(a => {
      if (options.userId && a.userId === options.userId) return false;
      if (options.graphId && a.graphId === options.graphId) return false;
      return true;
    });

    localStorage.setItem(ASSESSMENT_HISTORY_STORAGE_KEY, JSON.stringify(remaining));
  } catch (err) {
    console.warn('[AssessmentHistory] Failed to clear history:', err);
  }
}
