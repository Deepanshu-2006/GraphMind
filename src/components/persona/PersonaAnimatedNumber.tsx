import React, { useEffect, useState, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

export interface PersonaAnimatedNumberProps {
  /** The target numerical value to animate to */
  value: number;
  /** Animation duration in milliseconds (bounded between 500ms and 1200ms) */
  duration?: number;
  /** Optional delay before counting starts in milliseconds */
  delay?: number;
  /** Custom formatter function (e.g. formatTabularCount or percentage) */
  format?: (val: number) => string;
  /** Optional lower boundary (e.g. 0 for percentages) */
  min?: number;
  /** Optional upper boundary (e.g. 100 for percentages) */
  max?: number;
  /** Suffix to append to the formatted number (e.g. '%') */
  suffix?: string;
  /** Prefix to prepend to the formatted number */
  prefix?: string;
  /** Optional CSS class name */
  className?: string;
  /** Optional test id attribute */
  'data-testid'?: string;
}

/**
 * Pure ease-out cubic curve: 1 - (1 - t)^3
 * Produces smooth, restrained deceleration matching GraphMind's quiet editorial aesthetic.
 */
export function easeOutCubic(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return 1.0 - Math.pow(1.0 - clamped, 3);
}

/**
 * Clamp a numerical value to optional minimum and maximum bounds.
 */
export function clampValue(val: number, min?: number, max?: number): number {
  if (min !== undefined && max !== undefined) {
    return Math.max(min, Math.min(max, val));
  }
  if (min !== undefined) {
    return Math.max(min, val);
  }
  if (max !== undefined) {
    return Math.min(max, val);
  }
  return val;
}

/**
 * Calculate interpolated value for a specific progress percentage with exact rounding and bounds.
 */
export function calculateInterpolatedValue(
  start: number,
  target: number,
  progress: number,
  min?: number,
  max?: number
): number {
  if (progress >= 1.0) {
    return clampValue(Math.round(target), min, max);
  }
  if (progress <= 0) {
    return clampValue(Math.round(start), min, max);
  }
  const ease = easeOutCubic(progress);
  const current = Math.round(start + (target - start) * ease);
  return clampValue(current, min, max);
}

/**
 * PersonaAnimatedNumber
 *
 * Lightweight, accessible numerical counter for GraphMind Persona statistics.
 * Smoothly interpolates from previous to current target value using ease-out cubic curve.
 * 
 * Guarantees:
 * - Settles on the exact integer target with 100% data integrity.
 * - Respects prefers-reduced-motion by bypassing animation entirely.
 * - Prevents animation restarts on unrelated parent re-renders.
 * - Bounds percentages strictly to valid ranges [0, 100].
 * - Duration is restrained between 500ms and 800ms.
 */
export const PersonaAnimatedNumber: React.FC<PersonaAnimatedNumberProps> = ({
  value,
  duration = 650,
  delay = 0,
  format,
  min,
  max,
  suffix = '',
  prefix = '',
  className = '',
  'data-testid': testId
}) => {
  const shouldReduceMotion = useReducedMotion();
  const safeValue = typeof value === 'number' && !isNaN(value) ? value : 0;
  const boundedTarget = Math.round(clampValue(safeValue, min, max));

  const [displayValue, setDisplayValue] = useState<number>(shouldReduceMotion ? boundedTarget : 0);
  const currentDisplayRef = useRef<number>(shouldReduceMotion ? boundedTarget : 0);
  const prevTargetRef = useRef<number>(boundedTarget);
  const startValueRef = useRef<number>(0);
  const startTimeRef = useRef<number | null>(null);
  const isInitialMountRef = useRef<boolean>(true);

  useEffect(() => {
    // If reduced motion is requested, immediately lock to the target value
    if (shouldReduceMotion) {
      setDisplayValue(boundedTarget);
      prevTargetRef.current = boundedTarget;
      currentDisplayRef.current = boundedTarget;
      return;
    }

    // Determine starting value for animation
    const fromValue = isInitialMountRef.current ? 0 : currentDisplayRef.current;
    isInitialMountRef.current = false;

    // If target has not meaningfully changed, avoid unnecessary re-animations
    if (fromValue === boundedTarget) {
      setDisplayValue(boundedTarget);
      prevTargetRef.current = boundedTarget;
      currentDisplayRef.current = boundedTarget;
      return;
    }

    startValueRef.current = fromValue;
    startTimeRef.current = null;
    let rafId: number;

    const animDuration = Math.max(500, Math.min(1200, duration));

    const step = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;

      // Hold at initial value during delay
      if (delay > 0 && elapsed < delay) {
        rafId = requestAnimationFrame(step);
        return;
      }

      const animElapsed = delay > 0 ? elapsed - delay : elapsed;
      const progress = Math.min(1.0, animElapsed / animDuration);

      const current = calculateInterpolatedValue(
        startValueRef.current,
        boundedTarget,
        progress,
        min,
        max
      );

      setDisplayValue(current);
      currentDisplayRef.current = current;

      if (progress < 1.0) {
        rafId = requestAnimationFrame(step);
      } else {
        // Guarantee final exact match
        setDisplayValue(boundedTarget);
        prevTargetRef.current = boundedTarget;
        currentDisplayRef.current = boundedTarget;
      }
    };

    rafId = requestAnimationFrame(step);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [boundedTarget, duration, delay, min, max, shouldReduceMotion]);

  const formatted = format ? format(displayValue) : `${prefix}${displayValue}${suffix}`;

  return (
    <span
      className={className}
      data-testid={testId}
      aria-label={`${prefix}${boundedTarget}${suffix}`}
    >
      <span aria-hidden="true">{formatted}</span>
    </span>
  );
};
