import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * KnowledgeOrb3D — "TRUE 3D PARTICLE KNOWLEDGE ORB"
 * 
 * Core Architectural Mandates:
 * 1. 100% Particle-Based Rendering:
 *    - NO solid mesh, NO SphereGeometry surface, NO opaque green blob, NO metaballs.
 *    - Built entirely with THREE.Points (BufferGeometry) and THREE.LineSegments.
 *    - Visible form comes strictly from hundreds of individual particles.
 * 
 * 2. 3D Volumetric Spherical Distribution:
 *    - ~820 particles distributed in a volumetric sphere (core, middle, surface silhouette).
 *    - Particles have individual sizes, depths, and brightness levels.
 *    - Depth perspective camera creates genuine 3D spatial depth.
 * 
 * 3. GraphMind Knowledge Graph Identity:
 *    - Particles = Concepts.
 *    - Sparse internal lines (5–10% of particles) = Relationships.
 *    - Organic local clusters represent conceptual knowledge groupings.
 *    - Resting: dark green / muted green.
 *    - Active / Interacted: illuminates to GraphMind green (#A3FF12).
 * 
 * 4. Anchored Home Position & Cursor Physics:
 *    - Positioned primarily on the RIGHT side of the hero (65–75% across width).
 *    - The orb remains ANCHORED to its home position; it does NOT follow the cursor around.
 *    - Cursor acts as an external 3D influence field:
 *      - Slow cursor: particles gently attract toward cursor.
 *      - Fast cursor: local particles stretch/deform in direction of movement.
 *      - Surface ripples propagate across nearby particles.
 *    - When cursor leaves: spring-damping physics returns all particles smoothly to their exact
 *      equilibrium positions with zero permanent drift.
 */

interface ParticleData {
  // Equilibrium spherical offset relative to orb center
  x0: number;
  y0: number;
  z0: number;
  radius0: number;
  theta0: number;
  phi0: number;

  // Dynamic simulation position (relative to orb center)
  x: number;
  y: number;
  z: number;

  // Velocity & physical mass
  vx: number;
  vy: number;
  vz: number;
  mass: number;

  // Particle attributes
  layer: 'core' | 'mid' | 'surface';
  baseSize: number;
  baseR: number;
  baseG: number;
  baseB: number;
  isFocal: boolean;
}

interface GraphConnection {
  p1: number;
  p2: number;
  active: number; // 0 to 1
}

interface ParticleRipple {
  center: THREE.Vector3;
  startTime: number;
  strength: number;
}

/**
 * Creates a circular soft-particle alpha texture
 */
function createParticleTexture(): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.85)');
    gradient.addColorStop(0.72, 'rgba(255, 255, 255, 0.22)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export const KnowledgeOrb3D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let isVisible = true;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1. Three.js Scene, Camera & WebGL Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
    camera.position.set(0, 0, 5.2);

    // 2. Anchored Home State
    const homePosition = new THREE.Vector3(1.85, 0.05, 0);
    const homeRotation = new THREE.Euler(0, 0, 0);
    const homeScale = new THREE.Vector3(1, 1, 1);

    const currentOrbPosition = homePosition.clone();
    const targetOrbPosition = homePosition.clone();
    const orbPositionVelocity = new THREE.Vector3(0, 0, 0);

    const currentOrbRotation = new THREE.Euler(0, 0, 0);
    const targetOrbRotation = new THREE.Vector3(0, 0, 0);
    const orbRotationVelocity = new THREE.Vector3(0, 0, 0);

    // 3. Volumetric Particle Generation
    const getParticleCount = (w: number): number => {
      if (prefersReducedMotion) return 180;
      if (w < 560) return 260;
      if (w < 960) return 520;
      return 860;
    };

    const particleCount = getParticleCount(window.innerWidth);
    const baseOrbRadius = 1.48;

    const particles: ParticleData[] = [];
    const positionsArray = new Float32Array(particleCount * 3);
    const colorsArray = new Float32Array(particleCount * 3);
    const sizesArray = new Float32Array(particleCount);

    // Fibonacci sphere distribution with volumetric stratification
    for (let i = 0; i < particleCount; i++) {
      // Golden spiral angles
      const phiAngle = Math.acos(1 - (2 * (i + 0.5)) / particleCount);
      const thetaAngle = Math.PI * (1 + Math.sqrt(5)) * i;

      // Layered volumetric radial distribution
      // 55% surface silhouette, 30% mantle, 15% core
      const layerRand = Math.random();
      let layer: 'core' | 'mid' | 'surface' = 'surface';
      let rRatio = 1.0;

      if (layerRand < 0.15) {
        layer = 'core';
        rRatio = 0.20 + Math.random() * 0.40;
      } else if (layerRand < 0.45) {
        layer = 'mid';
        rRatio = 0.60 + Math.random() * 0.32;
      } else {
        layer = 'surface';
        rRatio = 0.92 + Math.random() * 0.12;
      }

      const r = baseOrbRadius * rRatio;

      const ux = Math.sin(phiAngle) * Math.cos(thetaAngle);
      const uy = Math.cos(phiAngle);
      const uz = Math.sin(phiAngle) * Math.sin(thetaAngle);

      const x0 = ux * r;
      const y0 = uy * r;
      const z0 = uz * r;

      // Particle size variation: most 1.5–2.2px, some 2.5–3.2px, rare focal 3.6–4.2px
      const sizeRand = Math.random();
      const isFocal = sizeRand < 0.05 && layer !== 'core';
      const baseSize = isFocal
        ? 3.8 + Math.random() * 0.6
        : sizeRand < 0.24
        ? 2.5 + Math.random() * 0.7
        : 1.5 + Math.random() * 0.7;

      // Depth & Layer-based Green Palette
      // Back particles: dark green-gray
      // Mid particles: muted deep green
      // Front particles: rich GraphMind green (#A3FF12 accents)
      const normZ = (z0 + baseOrbRadius) / (baseOrbRadius * 2); // 0 (back) to 1 (front)
      let baseR = 0.06;
      let baseG = 0.16;
      let baseB = 0.08;

      if (isFocal) {
        // Bright GraphMind green focal point
        baseR = 0.64;
        baseG = 1.0;
        baseB = 0.07;
      } else if (normZ > 0.65) {
        // Front surface: bright GraphMind green (#A3FF12)
        baseR = 0.35 + normZ * 0.28;
        baseG = 0.68 + normZ * 0.30;
        baseB = 0.06 + normZ * 0.04;
      } else if (normZ > 0.35) {
        // Mid volume: muted deep green
        baseR = 0.12 + normZ * 0.16;
        baseG = 0.32 + normZ * 0.28;
        baseB = 0.08 + normZ * 0.04;
      } else {
        // Rear volume: dark green-gray
        baseR = 0.06 + normZ * 0.06;
        baseG = 0.14 + normZ * 0.14;
        baseB = 0.06 + normZ * 0.04;
      }

      particles.push({
        x0,
        y0,
        z0,
        radius0: r,
        theta0: thetaAngle,
        phi0: phiAngle,
        x: x0,
        y: y0,
        z: z0,
        vx: 0,
        vy: 0,
        vz: 0,
        mass: 0.85 + Math.random() * 0.4,
        layer,
        baseSize,
        baseR,
        baseG,
        baseB,
        isFocal
      });

      positionsArray[i * 3] = x0;
      positionsArray[i * 3 + 1] = y0;
      positionsArray[i * 3 + 2] = z0;

      colorsArray[i * 3] = baseR;
      colorsArray[i * 3 + 1] = baseG;
      colorsArray[i * 3 + 2] = baseB;

      sizesArray[i] = baseSize;
    }

    // 4. Sparse Internal Knowledge Graph Connections (5–10% of particles)
    const connections: GraphConnection[] = [];
    const connectedParticleSet = new Set<number>();
    const maxConnections = Math.floor(particleCount * 0.085);

    // Identify 5 local organic clusters across the sphere volume
    for (let c = 0; c < 5; c++) {
      const clusterCenter = particles[Math.floor(Math.random() * particleCount)];
      const candidates: { index: number; dist: number }[] = [];

      for (let i = 0; i < particleCount; i++) {
        const p = particles[i];
        const dist = Math.hypot(p.x0 - clusterCenter.x0, p.y0 - clusterCenter.y0, p.z0 - clusterCenter.z0);
        if (dist > 0.08 && dist < 0.62) {
          candidates.push({ index: i, dist });
        }
      }

      candidates.sort((a, b) => a.dist - b.dist);

      // Connect 4–7 pairs within cluster
      const connectCount = Math.min(candidates.length, 6);
      for (let j = 0; j < connectCount; j++) {
        if (connections.length >= maxConnections) break;
        const pA = candidates[j].index;
        const pB = j + 1 < connectCount ? candidates[j + 1].index : candidates[0].index;
        connections.push({ p1: pA, p2: pB, active: 0 });
        connectedParticleSet.add(pA);
        connectedParticleSet.add(pB);
      }
    }

    // Prepare LineSegments BufferGeometry
    const linePositions = new Float32Array(connections.length * 2 * 3);
    const lineColors = new Float32Array(connections.length * 2 * 3);

    // Initial line color: subtle dark green-gray
    for (let c = 0; c < connections.length; c++) {
      const cIdx = c * 6;
      lineColors[cIdx] = 0.08;
      lineColors[cIdx + 1] = 0.22;
      lineColors[cIdx + 2] = 0.10;
      lineColors[cIdx + 3] = 0.08;
      lineColors[cIdx + 4] = 0.22;
      lineColors[cIdx + 5] = 0.10;
    }

    // 5. Construct Three.js Particle and Line Objects
    const pointsGeometry = new THREE.BufferGeometry();
    pointsGeometry.setAttribute('position', new THREE.BufferAttribute(positionsArray, 3));
    pointsGeometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));
    pointsGeometry.setAttribute('size', new THREE.BufferAttribute(sizesArray, 1));

    const particleTexture = createParticleTexture();

    const pointsMaterial = new THREE.PointsMaterial({
      size: 0.048,
      vertexColors: true,
      map: particleTexture,
      transparent: true,
      opacity: 0.94,
      blending: THREE.NormalBlending,
      depthWrite: false
    });

    const particlePoints = new THREE.Points(pointsGeometry, pointsMaterial);

    const linesGeometry = new THREE.BufferGeometry();
    linesGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    linesGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));

    const linesMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const graphLines = new THREE.LineSegments(linesGeometry, linesMaterial);

    // Group containing the particle orb (anchored to home position)
    const orbGroup = new THREE.Group();
    orbGroup.add(particlePoints);
    orbGroup.add(graphLines);
    orbGroup.position.copy(homePosition);
    scene.add(orbGroup);

    // 6. Interaction State
    let cursorInside = false;
    let pointerX = 0; // -1 to 1
    let pointerY = 0;
    let prevPointerX = 0;
    let prevPointerY = 0;
    let cursorSpeed = 0;
    let cursorDirX = 0;
    let cursorDirY = 0;

    const cursorRay3D = new THREE.Vector3(0, 0, 0);
    const localCursorPos = new THREE.Vector3(0, 0, 0);

    let activeRipple: ParticleRipple | null = null;

    /**
     * Compute Responsive Home Position (keeps orb on right side of content area)
     */
    const updateHomePosition = () => {
      if (width === 0 || height === 0) return;
      const aspect = width / height;

      if (width < 768) {
        // Mobile / Small tablet
        homePosition.set(aspect * 0.42, -0.15, 0);
        homeScale.set(0.82, 0.82, 0.82);
      } else if (width < 1080) {
        homePosition.set(aspect * 0.70, 0.05, 0);
        homeScale.set(0.95, 0.95, 0.95);
      } else {
        // Desktop: anchored firmly on the right (65–75% across)
        const posX = Math.min(2.4, Math.max(1.6, aspect * 0.86));
        homePosition.set(posX, 0.05, 0);
        homeScale.set(1.0, 1.0, 1.0);
      }
    };

    /**
     * Resize Handler
     */
    const handleResize = () => {
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      width = Math.floor(rect.width);
      height = Math.floor(rect.height);

      if (width === 0 || height === 0) return;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      renderer.setSize(width, height, false);
      updateHomePosition();
    };

    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);
    handleResize();

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
     * Pointer Event Listeners
     */
    const handlePointerMove = (e: PointerEvent) => {
      if (prefersReducedMotion) return;
      const rect = targetElement.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      prevPointerX = pointerX;
      prevPointerY = pointerY;

      pointerX = (clientX / width) * 2 - 1;
      pointerY = -(clientY / height) * 2 + 1;

      cursorInside = true;

      const vx = pointerX - prevPointerX;
      const vy = pointerY - prevPointerY;
      cursorSpeed = Math.hypot(vx, vy) * 55;

      if (cursorSpeed > 0.05) {
        cursorDirX = vx / (Math.hypot(vx, vy) || 1);
        cursorDirY = vy / (Math.hypot(vx, vy) || 1);
      }
    };

    const handlePointerLeave = () => {
      cursorInside = false;
      cursorSpeed = 0;
    };

    targetElement.addEventListener('pointermove', handlePointerMove, { passive: true });
    targetElement.addEventListener('pointerleave', handlePointerLeave, { passive: true });

    /**
     * 60fps Particle Physics & 3D Knowledge Orb Simulation Loop
     */
    const animate = (now: number) => {
      animationFrameId = requestAnimationFrame(animate);
      if (!isVisible || width === 0 || height === 0) return;

      const time = now * 0.001;

      // 1. Unproject Cursor into 3D Space at Orb Depth Plane (Z = 0)
      const vFovRad = (camera.fov * Math.PI) / 180;
      const planeH = 2 * Math.tan(vFovRad / 2) * camera.position.z;
      const planeW = planeH * camera.aspect;

      cursorRay3D.set(
        (pointerX * planeW) / 2,
        (pointerY * planeH) / 2,
        0
      );

      // Distance from cursor to anchored orb center
      const distToOrb = cursorRay3D.distanceTo(currentOrbPosition);

      // Local cursor position relative to the orb
      localCursorPos.subVectors(cursorRay3D, currentOrbPosition);

      // 2. Mouse Influence Field (Three distance zones: FAR, NEAR, CONTACT)
      const influenceRadius = 2.4;
      let globalInfluence = 0;

      if (cursorInside && !prefersReducedMotion && distToOrb < influenceRadius) {
        const normDist = distToOrb / influenceRadius;
        globalInfluence = Math.pow(1 - normDist, 1.8);
      }

      // Trigger particle ripple when cursor enters contact with speed
      if (globalInfluence > 0.4 && cursorSpeed > 1.2 && (!activeRipple || now - activeRipple.startTime > 420)) {
        activeRipple = {
          center: localCursorPos.clone().normalize().multiplyScalar(baseOrbRadius),
          startTime: now,
          strength: Math.min(1.0, 0.4 + cursorSpeed * 0.08)
        };
      }

      // 3. Anchored Position Displacement (Clamped to 10–25px, orb remains anchored)
      if (globalInfluence > 0.01) {
        const maxShift = 0.20; // ~16px
        const dir = localCursorPos.clone().normalize();
        targetOrbPosition.set(
          homePosition.x + dir.x * globalInfluence * maxShift,
          homePosition.y + dir.y * globalInfluence * maxShift,
          homePosition.z + globalInfluence * 0.1
        );
      } else {
        targetOrbPosition.copy(homePosition);
      }

      // Spring-damper physics for anchored position
      const posSpringK = 0.048;
      const posDamping = 0.82;
      orbPositionVelocity.x = (orbPositionVelocity.x + (targetOrbPosition.x - currentOrbPosition.x) * posSpringK) * posDamping;
      orbPositionVelocity.y = (orbPositionVelocity.y + (targetOrbPosition.y - currentOrbPosition.y) * posSpringK) * posDamping;
      orbPositionVelocity.z = (orbPositionVelocity.z + (targetOrbPosition.z - currentOrbPosition.z) * posSpringK) * posDamping;
      currentOrbPosition.add(orbPositionVelocity);
      orbGroup.position.copy(currentOrbPosition);

      // 4. Subtle 3D Tilt with Inertia
      if (globalInfluence > 0.01) {
        const dir = localCursorPos.clone().normalize();
        targetOrbRotation.set(
          homeRotation.x - dir.y * globalInfluence * 0.28,
          homeRotation.y + dir.x * globalInfluence * 0.35 + time * 0.03,
          homeRotation.z
        );
      } else {
        // Slow organic idle rotation
        targetOrbRotation.set(
          homeRotation.x + Math.sin(time * 0.3) * 0.03,
          homeRotation.y + time * 0.04,
          homeRotation.z
        );
      }

      const rotSpringK = 0.044;
      const rotDamping = 0.84;
      orbRotationVelocity.x = (orbRotationVelocity.x + (targetOrbRotation.x - currentOrbRotation.x) * rotSpringK) * rotDamping;
      orbRotationVelocity.y = (orbRotationVelocity.y + (targetOrbRotation.y - currentOrbRotation.y) * rotSpringK) * rotDamping;
      orbRotationVelocity.z = (orbRotationVelocity.z + (targetOrbRotation.z - currentOrbRotation.z) * rotSpringK) * rotDamping;
      currentOrbRotation.x += orbRotationVelocity.x;
      currentOrbRotation.y += orbRotationVelocity.y;
      currentOrbRotation.z += orbRotationVelocity.z;
      orbGroup.rotation.copy(currentOrbRotation);

      // 5. Update Individual Particle Physics & Surface Deformation
      const posAttr = pointsGeometry.attributes.position;
      const colAttr = pointsGeometry.attributes.color;

      const rippleAge = activeRipple ? (now - activeRipple.startTime) * 0.001 : 999;
      const rippleActive = activeRipple !== null && rippleAge < 1.1;

      if (!rippleActive && activeRipple) {
        activeRipple = null;
      }

      for (let i = 0; i < particleCount; i++) {
        const p = particles[i];

        // A. Subtle Organic Silhouette Breathing (Harmonic multi-frequency noise)
        const organicNoise =
          0.032 * Math.sin(2 * p.theta0 + 1.1 * time) * Math.cos(3 * p.phi0 - 0.9 * time) +
          0.018 * Math.sin(3 * p.theta0 + 2 * p.phi0 + 1.4 * time);

        // Equilibrium position with organic breathing
        const rCurrent = p.radius0 * (1 + (prefersReducedMotion ? 0 : organicNoise));
        const normDirX = p.x0 / p.radius0;
        const normDirY = p.y0 / p.radius0;
        const normDirZ = p.z0 / p.radius0;

        let targetPx = normDirX * rCurrent;
        let targetPy = normDirY * rCurrent;
        let targetPz = normDirZ * rCurrent;

        // B. Mouse Influence Field & Local Surface Deformation
        let localDeform = 0;
        let activeBrightness = 0;

        if (cursorInside && !prefersReducedMotion) {
          // Distance from particle to local cursor position
          const dx = p.x - localCursorPos.x;
          const dy = p.y - localCursorPos.y;
          const dz = p.z - localCursorPos.z;
          const distToCursor = Math.hypot(dx, dy, dz);

          const localInfluenceR = 1.6;
          if (distToCursor < localInfluenceR) {
            const normD = distToCursor / localInfluenceR;
            localDeform = Math.pow(1 - normD, 2.2);

            // Slow cursor: gently attracts particles toward cursor
            // Fast cursor: stretches/pushes particles along movement vector
            if (cursorSpeed > 1.2) {
              const stretch = Math.min(cursorSpeed * 0.04, 0.28);
              targetPx += cursorDirX * localDeform * stretch;
              targetPy += cursorDirY * localDeform * stretch;
            } else {
              const pullForce = 0.22 * localDeform;
              targetPx -= (dx / (distToCursor + 0.2)) * pullForce;
              targetPy -= (dy / (distToCursor + 0.2)) * pullForce;
              targetPz -= (dz / (distToCursor + 0.2)) * pullForce * 0.6;
            }

            activeBrightness = localDeform;
          }
        }

        // C. Particle Ripple Wave Propagation
        if (rippleActive && activeRipple) {
          const rdot = normDirX * (activeRipple.center.x / baseOrbRadius) +
                       normDirY * (activeRipple.center.y / baseOrbRadius) +
                       normDirZ * (activeRipple.center.z / baseOrbRadius);
          const angDist = Math.acos(Math.max(-1, Math.min(1, rdot)));
          const waveFront = rippleAge * 3.4;
          const deltaWave = Math.abs(angDist - waveFront);

          if (deltaWave < 0.45) {
            const waveShape = Math.cos((deltaWave / 0.45) * (Math.PI / 2));
            const decay = Math.max(0, 1 - rippleAge / 1.1);
            const rippleShift = waveShape * activeRipple.strength * 0.08 * decay;
            targetPx += normDirX * rippleShift;
            targetPy += normDirY * rippleShift;
            targetPz += normDirZ * rippleShift;
            activeBrightness = Math.max(activeBrightness, waveShape * decay * 0.6);
          }
        }

        // D. Particle Spring Restoring Physics & Damping
        const pSpringK = 0.055 / p.mass;
        const pDamping = 0.84;

        p.vx = (p.vx + (targetPx - p.x) * pSpringK) * pDamping;
        p.vy = (p.vy + (targetPy - p.y) * pSpringK) * pDamping;
        p.vz = (p.vz + (targetPz - p.z) * pSpringK) * pDamping;

        p.x += p.vx;
        p.y += p.vy;
        p.z += p.vz;

        posAttr.setXYZ(i, p.x, p.y, p.z);

        // E. Dynamic Particle Color Update (Depth + Active Brightness)
        if (activeBrightness > 0.02) {
          // Illuminate toward GraphMind green (#A3FF12)
          const targetR = THREE.MathUtils.lerp(p.baseR, 0.64, activeBrightness);
          const targetG = THREE.MathUtils.lerp(p.baseG, 1.0, activeBrightness);
          const targetB = THREE.MathUtils.lerp(p.baseB, 0.07, activeBrightness);
          colAttr.setXYZ(i, targetR, targetG, targetB);
        } else {
          colAttr.setXYZ(i, p.baseR, p.baseG, p.baseB);
        }
      }

      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;

      // 6. Update Sparse Internal Knowledge Graph Lines
      const linePosAttr = linesGeometry.attributes.position;
      const lineColAttr = linesGeometry.attributes.color;

      for (let c = 0; c < connections.length; c++) {
        const conn = connections[c];
        const pA = particles[conn.p1];
        const pB = particles[conn.p2];

        linePosAttr.setXYZ(c * 2, pA.x, pA.y, pA.z);
        linePosAttr.setXYZ(c * 2 + 1, pB.x, pB.y, pB.z);

        // Check proximity to cursor to reveal active relationship in GraphMind green
        let lineActive = 0;
        if (cursorInside && !prefersReducedMotion) {
          const midX = (pA.x + pB.x) * 0.5;
          const midY = (pA.y + pB.y) * 0.5;
          const midZ = (pA.z + pB.z) * 0.5;
          const distToCursor = Math.hypot(midX - localCursorPos.x, midY - localCursorPos.y, midZ - localCursorPos.z);
          if (distToCursor < 1.4) {
            lineActive = Math.pow(1 - distToCursor / 1.4, 1.8);
          }
        }

        conn.active += (lineActive - conn.active) * 0.12;

        if (conn.active > 0.02) {
          // Active relationship: GraphMind green (#A3FF12)
          const r = THREE.MathUtils.lerp(0.08, 0.64, conn.active);
          const g = THREE.MathUtils.lerp(0.22, 1.0, conn.active);
          const b = THREE.MathUtils.lerp(0.10, 0.07, conn.active);
          lineColAttr.setXYZ(c * 2, r, g, b);
          lineColAttr.setXYZ(c * 2 + 1, r, g, b);
        } else {
          // Muted dark green
          lineColAttr.setXYZ(c * 2, 0.08, 0.22, 0.10);
          lineColAttr.setXYZ(c * 2 + 1, 0.08, 0.22, 0.10);
        }
      }

      linePosAttr.needsUpdate = true;
      lineColAttr.needsUpdate = true;

      // Render frame
      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      targetElement.removeEventListener('pointermove', handlePointerMove);
      targetElement.removeEventListener('pointerleave', handlePointerLeave);

      pointsGeometry.dispose();
      pointsMaterial.dispose();
      linesGeometry.dispose();
      linesMaterial.dispose();
      particleTexture.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="overview-hero-orb-viewport" 
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="overview-hero-orb-canvas" />
    </div>
  );
};
