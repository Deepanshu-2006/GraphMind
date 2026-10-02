import React, { useEffect, useRef } from 'react';

/**
 * KnowledgeParticleField
 * 
 * Interactive 3D spatial particle experience for the GraphMind hero.
 * 
 * Concept:
 * SCATTERED KNOWLEDGE → DISCOVERY → CONNECTION → STRUCTURE
 * 
 * Visual Architecture:
 * - True 3D perspective projection with depth-attenuated scale, alpha, and parallax.
 * - Cursor acts as a radial gravitational and magnetic field (attraction + gentle tangential swirl + depth lift).
 * - Knowledge connection effect: ultra-thin, low-opacity lines revealed under cursor influence.
 * - GraphMind green (#A3FF12) used with restraint as discovered accents on active connections.
 * - Center calm zone protects typography readability; edges frame the composition.
 * - Dwell discovery: staying in one area reveals an emergent constellation that dissolves upon departure.
 */

interface Particle3D {
  // Base rest coordinates in 3D world space (origin at center)
  x0: number;
  y0: number;
  z0: number;

  // Dynamic coordinates
  x: number;
  y: number;
  z: number;

  // Velocities for momentum and damping
  vx: number;
  vy: number;
  vz: number;

  // Base physical traits
  baseRadius: number;
  baseAlpha: number;

  // Subtle harmonic drift parameters for rest state
  freqX: number;
  freqY: number;
  freqZ: number;
  ampX: number;
  ampY: number;
  ampZ: number;
  phaseX: number;
  phaseY: number;
  phaseZ: number;

  // Interactive activation & discovery
  activeRatio: number; // 0 = resting neutral, 1 = fully active/green
  targetActive: number;
  discoveryWeight: number; // 0 to 1 pull toward constellation anchor
  constellationOffsetX: number;
  constellationOffsetY: number;
  constellationOffsetZ: number;

  // Projected 2D screen coordinates
  sx: number;
  sy: number;
  sr: number;
  depthAlpha: number;
  inCenterZone: boolean;
}

const FOCAL_LENGTH = 540;
const NEAR_Z = -140;
const FAR_Z = 420;
const INFLUENCE_RADIUS = 200;
const MAX_CONNECTION_DIST = 92;

export const KnowledgeParticleField: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let isVisible = true;

    // Reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Pointer and cursor physics tracking
    let cursorInside = false;
    let targetCursorX = 0;
    let targetCursorY = 0;
    let currentCursorX = 0;
    let currentCursorY = 0;
    let prevCursorX = 0;
    let prevCursorY = 0;
    let cursorVelX = 0;
    let cursorVelY = 0;

    // Parallax tracking
    let targetParallaxX = 0;
    let targetParallaxY = 0;
    let currentParallaxX = 0;
    let currentParallaxY = 0;

    // Discovery / Dwell detection
    let dwellTimer = 0;
    let dwellIntensity = 0;
    let dwellAnchorX = 0;
    let dwellAnchorY = 0;

    // Particle collection
    let particles: Particle3D[] = [];

    // Constellation offsets for discovery moment (subtle pentagon/star-like structure)
    const constellationOffsets = [
      { x: 0, y: -38, z: -20 },
      { x: 42, y: -12, z: 15 },
      { x: 26, y: 36, z: -10 },
      { x: -26, y: 36, z: 20 },
      { x: -42, y: -12, z: -15 },
      { x: 0, y: 0, z: 5 }
    ];

    /**
     * Determine optimal particle count based on display width
     */
    const getParticleCount = (w: number): number => {
      if (prefersReducedMotion) return 28;
      if (w < 520) return 24;
      if (w < 860) return 46;
      return 78;
    };

    /**
     * Initialize particles with structured spatial variation:
     * - Outer edges: higher density framing the typography
     * - Middle: moderate density
     * - Center: calm, low density to ensure headline and CTA legibility
     */
    const initParticles = () => {
      const count = getParticleCount(width);
      particles = [];

      const halfW = width / 2;
      const halfH = height / 2;

      for (let i = 0; i < count; i++) {
        let x0 = 0;
        let y0 = 0;
        let inCenter = false;

        // Try placing with distribution bias toward framing zones
        for (let attempt = 0; attempt < 8; attempt++) {
          // Normal/uniform random blend
          const angle = Math.random() * Math.PI * 2;
          const distFactor = Math.sqrt(Math.random()); // standard disc
          const rx = Math.cos(angle) * (halfW * 0.96) * distFactor;
          const ry = Math.sin(angle) * (halfH * 0.94) * distFactor;

          // Check if inside center reading zone (|rx| < 260 && |ry| < 110)
          const inReadingZone = Math.abs(rx) < 250 && Math.abs(ry) < 95;

          // 90% chance to reject points placed directly over the center headline
          if (inReadingZone && Math.random() < 0.88) {
            continue;
          }

          x0 = rx;
          y0 = ry;
          inCenter = inReadingZone;
          break;
        }

        // Z-depth: spans from near (negative) to far (positive)
        const z0 = NEAR_Z + Math.random() * (FAR_Z - NEAR_Z);

        // Size and base alpha depends on natural depth strata
        const depthNorm = (z0 - NEAR_Z) / (FAR_Z - NEAR_Z); // 0 (near) to 1 (far)
        const baseRadius = 1.0 + (1 - depthNorm) * 1.35; // 1.0px (far) to 2.35px (near)
        const baseAlpha = 0.16 + (1 - depthNorm) * 0.32; // 0.16 (far) to 0.48 (near)

        // Rest harmonic oscillation
        const speedMultiplier = prefersReducedMotion ? 0 : 0.0004 + Math.random() * 0.0006;

        particles.push({
          x0,
          y0,
          z0,
          x: x0,
          y: y0,
          z: z0,
          vx: 0,
          vy: 0,
          vz: 0,
          baseRadius,
          baseAlpha,
          freqX: speedMultiplier * (0.8 + Math.random() * 0.5),
          freqY: speedMultiplier * (0.8 + Math.random() * 0.5),
          freqZ: speedMultiplier * (0.6 + Math.random() * 0.4),
          ampX: 8 + Math.random() * 12,
          ampY: 6 + Math.random() * 10,
          ampZ: 12 + Math.random() * 18,
          phaseX: Math.random() * Math.PI * 2,
          phaseY: Math.random() * Math.PI * 2,
          phaseZ: Math.random() * Math.PI * 2,
          activeRatio: 0,
          targetActive: 0,
          discoveryWeight: 0,
          constellationOffsetX: 0,
          constellationOffsetY: 0,
          constellationOffsetZ: 0,
          sx: 0,
          sy: 0,
          sr: 1,
          depthAlpha: baseAlpha,
          inCenterZone: inCenter
        });
      }
    };

    /**
     * Handle dimension resizing with crisp DPR scaling
     */
    const handleResize = () => {
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      width = Math.floor(rect.width);
      height = Math.floor(rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);

      initParticles();
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);
    handleResize();

    // Pause when hero is out of viewport
    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        isVisible = entry.isIntersecting;
      },
      { threshold: 0.05 }
    );
    intersectionObserver.observe(container);

    const targetElement = container.parentElement || container;

    /**
     * Pointer interaction handlers
     * Bound to hero element to allow smooth interaction even when moving over text & buttons
     */
    const handlePointerMove = (e: PointerEvent) => {
      if (prefersReducedMotion) return;
      const rect = targetElement.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      targetCursorX = clientX;
      targetCursorY = clientY;
      cursorInside = true;

      // Parallax target (-0.04 to 0.04 relative to center)
      targetParallaxX = ((clientX - width / 2) / (width / 2)) * 26;
      targetParallaxY = ((clientY - height / 2) / (height / 2)) * 18;

      // Dwell distance check: if cursor moved significantly, reset dwell
      const distFromDwell = Math.hypot(clientX - dwellAnchorX, clientY - dwellAnchorY);
      if (distFromDwell > 18) {
        dwellAnchorX = clientX;
        dwellAnchorY = clientY;
        dwellTimer = performance.now();
      }
    };

    const handlePointerLeave = () => {
      cursorInside = false;
      targetParallaxX = 0;
      targetParallaxY = 0;
      dwellTimer = 0;
    };

    targetElement.addEventListener('pointermove', handlePointerMove, { passive: true });
    targetElement.addEventListener('pointerleave', handlePointerLeave, { passive: true });

    /**
     * Main 60-120fps Animation Loop
     */
    const render = (now: number) => {
      animationFrameId = requestAnimationFrame(render);
      if (!isVisible || width === 0 || height === 0) return;

      // Smooth cursor lerping
      prevCursorX = currentCursorX;
      prevCursorY = currentCursorY;
      currentCursorX += (targetCursorX - currentCursorX) * 0.14;
      currentCursorY += (targetCursorY - currentCursorY) * 0.14;

      cursorVelX = (currentCursorX - prevCursorX);
      cursorVelY = (currentCursorY - prevCursorY);

      // Smooth camera parallax lerping
      currentParallaxX += (targetParallaxX - currentParallaxX) * 0.05;
      currentParallaxY += (targetParallaxY - currentParallaxY) * 0.05;

      // Dwell discovery evaluation (dwell for ~1.2s to trigger constellation)
      if (cursorInside && dwellTimer > 0 && (now - dwellTimer > 1100)) {
        dwellIntensity = Math.min(1, dwellIntensity + 0.024);
      } else {
        dwellIntensity = Math.max(0, dwellIntensity - 0.035);
      }

      const centerX = width / 2;
      const centerY = height / 2;

      // Clear canvas with transparent clearRect
      ctx.clearRect(0, 0, width, height);

      // 1. Identify closest particles to cursor for the "Discovery" constellation
      if (dwellIntensity > 0.02 && cursorInside) {
        // Sort particles by projected screen distance to dwell anchor
        const sorted = [...particles]
          .map((p, idx) => ({ idx, dist: Math.hypot(p.sx - dwellAnchorX, p.sy - dwellAnchorY) }))
          .sort((a, b) => a.dist - b.dist)
          .slice(0, 5);

        sorted.forEach((item, slotIdx) => {
          const p = particles[item.idx];
          const offset = constellationOffsets[slotIdx % constellationOffsets.length];
          p.constellationOffsetX = offset.x;
          p.constellationOffsetY = offset.y;
          p.constellationOffsetZ = offset.z;
          p.discoveryWeight = dwellIntensity;
        });
      } else {
        for (let i = 0; i < particles.length; i++) {
          particles[i].discoveryWeight = 0;
        }
      }

      // 2. Physics & 3D Projection update for each particle
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Rest harmonic oscillation
        const oscX = Math.sin(now * p.freqX + p.phaseX) * p.ampX;
        const oscY = Math.cos(now * p.freqY + p.phaseY) * p.ampY;
        const oscZ = Math.sin(now * p.freqZ + p.phaseZ) * p.ampZ;

        let targetX = p.x0 + oscX;
        let targetY = p.y0 + oscY;
        let targetZ = p.z0 + oscZ;

        // If part of the discovery constellation, gently anchor toward the formation
        if (p.discoveryWeight > 0.01) {
          const anchorWorldX = (dwellAnchorX - centerX) + p.constellationOffsetX;
          const anchorWorldY = (dwellAnchorY - centerY) + p.constellationOffsetY;
          const anchorWorldZ = p.constellationOffsetZ;

          targetX = targetX * (1 - p.discoveryWeight) + anchorWorldX * p.discoveryWeight;
          targetY = targetY * (1 - p.discoveryWeight) + anchorWorldY * p.discoveryWeight;
          targetZ = targetZ * (1 - p.discoveryWeight) + anchorWorldZ * p.discoveryWeight;
        }

        // Perspective scale factor: k = F / (F + z)
        const scale = FOCAL_LENGTH / (FOCAL_LENGTH + p.z);

        // Near particles shift more with parallax than far particles
        const depthParallaxMultiplier = (FAR_Z - p.z) / (FAR_Z - NEAR_Z);
        p.sx = centerX + (p.x + currentParallaxX * depthParallaxMultiplier) * scale;
        p.sy = centerY + (p.y + currentParallaxY * depthParallaxMultiplier) * scale;
        p.sr = Math.max(0.65, p.baseRadius * scale);

        // Compute screen distance to cursor
        p.targetActive = 0;

        if (cursorInside && !prefersReducedMotion) {
          const dx = p.sx - currentCursorX;
          const dy = p.sy - currentCursorY;
          const dist = Math.hypot(dx, dy);

          if (dist < INFLUENCE_RADIUS) {
            // Smooth non-linear falloff
            const normDist = dist / INFLUENCE_RADIUS;
            const influence = Math.pow(1 - normDist, 1.8);

            // Gravitational pull toward cursor (subtle, clamped)
            const dirX = dx / (dist + 30);
            const dirY = dy / (dist + 30);
            p.vx -= dirX * influence * 1.5;
            p.vy -= dirY * influence * 1.5;

            // Tangential swirl / rotation around cursor
            p.vx += -dirY * influence * 0.75;
            p.vy += dirX * influence * 0.75;

            // Subtle depth lift: particle comes slightly closer in Z
            p.vz -= influence * 1.1;

            // Momentum trail: transfer a fraction of recent cursor velocity
            p.vx += cursorVelX * influence * 0.12;
            p.vy += cursorVelY * influence * 0.12;

            p.targetActive = influence;
          }
        }

        // If part of active discovery constellation, ensure active
        if (p.discoveryWeight > 0.05) {
          p.targetActive = Math.max(p.targetActive, p.discoveryWeight * 0.85);
        }

        // Active state transition (smooth fade in, slower decay)
        const activeLerp = p.targetActive > p.activeRatio ? 0.18 : 0.04;
        p.activeRatio += (p.targetActive - p.activeRatio) * activeLerp;

        // Spring force pulling back to resting/constellation target
        const springK = 0.038;
        p.vx += (targetX - p.x) * springK;
        p.vy += (targetY - p.y) * springK;
        p.vz += (targetZ - p.z) * springK;

        // Friction damping
        p.vx *= 0.89;
        p.vy *= 0.89;
        p.vz *= 0.89;

        // Apply velocities
        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        // Depth-dependent base opacity
        const depthFactor = (FAR_Z - p.z) / (FAR_Z - NEAR_Z);
        p.depthAlpha = p.baseAlpha * Math.max(0.2, Math.min(1.0, depthFactor));

        // Center typography zone check: soften alpha if in central reading corridor
        const inCenterText = Math.abs(p.sx - centerX) < 220 && Math.abs(p.sy - (centerY - 10)) < 85;
        if (inCenterText) {
          p.depthAlpha *= 0.35;
        }
      }

      // 3. Render Knowledge Connection Lines
      // Only connects nearby particles that are within the cursor's interaction field
      ctx.lineWidth = 0.75;
      const connectedCount = new Uint8Array(particles.length);

      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        if (p1.activeRatio < 0.08) continue; // Only active particles can reveal connections

        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          if (p2.activeRatio < 0.08) continue;

          // Limit connections per node to preserve elegance (no dense spiderweb)
          if (connectedCount[i] >= 3 || connectedCount[j] >= 3) continue;

          // Must exist in similar 3D spatial strata
          const dz = Math.abs(p1.z - p2.z);
          if (dz > 140) continue;

          const dx = p1.sx - p2.sx;
          const dy = p1.sy - p2.sy;
          const dist = Math.hypot(dx, dy);

          if (dist < MAX_CONNECTION_DIST) {
            connectedCount[i]++;
            connectedCount[j]++;

            const distanceFactor = 1 - dist / MAX_CONNECTION_DIST;
            const mutualActive = Math.max(p1.activeRatio, p2.activeRatio);
            const lineAlpha = distanceFactor * mutualActive * 0.28;

            ctx.beginPath();
            ctx.moveTo(p1.sx, p1.sy);
            ctx.lineTo(p2.sx, p2.sy);

            // Connective lines: soft neutral with subtle GraphMind green (#A3FF12) accent as discovery intensifies
            if (mutualActive > 0.45 || (p1.discoveryWeight > 0.2 && p2.discoveryWeight > 0.2)) {
              const greenIntensity = Math.min(1, mutualActive * 1.2);
              // Subtle gradient between points or GraphMind green with restrained alpha
              ctx.strokeStyle = `rgba(163, 255, 18, ${lineAlpha * greenIntensity + 0.04})`;
            } else {
              ctx.strokeStyle = `rgba(220, 220, 220, ${lineAlpha})`;
            }

            ctx.stroke();
          }
        }
      }

      // 4. Render 3D Particles
      // Sort in depth order (painter's algorithm) so near particles cleanly layer over far
      const sortedIndices = Array.from({ length: particles.length }, (_, k) => k);
      sortedIndices.sort((a, b) => particles[b].z - particles[a].z);

      for (let idx = 0; idx < sortedIndices.length; idx++) {
        const p = particles[sortedIndices[idx]];

        // Interpolate color and alpha
        const active = p.activeRatio;
        const currentAlpha = Math.min(0.85, p.depthAlpha + active * 0.45);
        const radius = p.sr * (1 + active * 0.35);

        ctx.beginPath();
        ctx.arc(p.sx, p.sy, radius, 0, Math.PI * 2);

        if (active > 0.22) {
          // Discovered state: GraphMind green accent (#A3FF12)
          // Neutral soft white blended with green
          const r = Math.round(230 * (1 - active) + 163 * active);
          const g = Math.round(230 * (1 - active) + 255 * active);
          const b = Math.round(230 * (1 - active) + 18 * active);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${currentAlpha})`;
        } else {
          // Resting state: soft neutral off-white / gray
          ctx.fillStyle = `rgba(235, 235, 235, ${currentAlpha})`;
        }

        ctx.fill();

        // Subtle tiny core dot for discovered constellation nodes
        if (p.discoveryWeight > 0.3) {
          ctx.beginPath();
          ctx.arc(p.sx, p.sy, radius * 0.45, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(163, 255, 18, ${p.discoveryWeight * 0.7})`;
          ctx.fill();
        }
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      targetElement.removeEventListener('pointermove', handlePointerMove);
      targetElement.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="overview-hero-particle-field" 
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="overview-hero-particle-canvas" />
    </div>
  );
};
