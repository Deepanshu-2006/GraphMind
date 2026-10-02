import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * KnowledgeOrb3D — "PHYSICAL FLUID KNOWLEDGE ORB"
 * 
 * Continuous Physical System:
 * SCATTERED KNOWLEDGE → DISCOVERY → CONNECTED KNOWLEDGE → KNOWLEDGE ORB → SCROLL → REVERSE SCATTER DISSOLUTION
 * 
 * Motion Architecture & Principles:
 * 1. Continuous Combined Forces per Particle:
 *    F_total = F_spring (target) + F_mouse (inertia & deflection) + F_ripple + F_idle
 *    acceleration = F_total / particle.mass
 *    velocity = (velocity + acceleration * dtNorm) * (damping ^ dtNorm)
 *    position += velocity * dtNorm
 *    - Each particle has subtle individual mass (0.85–1.30), spring strength, and damping.
 *    - Soft, controlled overshoot communicating physical weight without bouncy recoil.
 * 
 * 2. Invisible Blended Transitions (No hard state boundaries):
 *    - formationInfluence: 1 → 0 smoothly as orb settles (60–96% formation).
 *    - idleInfluence: 0 → 1 smoothly blends in (40–92% formation).
 *    - scrollDissolution: smooth continuous progression (6–82% scroll).
 *    - Zero moments where "animation A finishes and animation B starts".
 * 
 * 3. Frame-Rate Independent Physics:
 *    - Physics equations use normalized delta time (dtNorm = dt / (1/60)).
 *    - Behaves identically at 60fps, 120fps, and 144fps displays.
 * 
 * 4. Smooth Mouse Velocity & Damped Fallback:
 *    - Raw mouse velocity is continuously smoothed via exponential lerp.
 *    - Mouse influence decays gradually to zero when cursor moves away (no sudden snap).
 * 
 * 5. Smooth Scroll Interpolation & Reversibility:
 *    - Target scroll progress is continuously smoothed:
 *      smoothScroll += (targetScroll - smoothScroll) * (1 - exp(-10 * dt)).
 *    - Scrolling down dissolves the orb; scrolling back up smoothly reforms it along the same continuous timeline.
 * 
 * 6. Physical Proximity Connections:
 *    - Relationship line opacity emerges organically as connected particles approach their rest distances.
 *    - Fades smoothly when particles separate or during scroll dissolution.
 */

interface KnowledgeOrb3DProps {
  scrollProgress?: number; // 0.0 (top) to 1.0 (scrolled away)
}

interface ParticleData {
  // 1. Initial Scattered 3D Position
  scatterX: number;
  scatterY: number;
  scatterZ: number;

  // 2. Target 3D Spherical Position
  sphereX: number;
  sphereY: number;
  sphereZ: number;
  radius0: number;
  theta0: number;
  phi0: number;

  // 3. Curved 3D Trajectory Control Point
  curveMidX: number;
  curveMidY: number;
  curveMidZ: number;

  // Trajectory timing variation
  formationDelay: number;
  formationDuration: number;

  // 4. Physical Simulation Coordinates
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  mass: number;
  springK: number;
  damping: number;

  // Layer & Visual Traits
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
  restDist: number;
  drawDelay: number;
  currentOpacity: number;
  active: number;
}

interface KnowledgeCluster {
  id: number;
  centerIndex: number;
  memberIndices: number[];
  connectionIndices: number[];
  activation: number;
}

interface ParticleRipple {
  center: THREE.Vector3;
  startTime: number;
  strength: number;
}

function smoothstep(min: number, max: number, value: number): number {
  const x = Math.max(0, Math.min(1, (value - min) / (max - min)));
  return x * x * (3 - 2 * x);
}

function createParticleTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const center = size / 2;
    const radius = center - 3;

    // Crisp, sharp disc with tight subpixel anti-aliasing edge (zero haze / blur)
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.88, 'rgba(255, 255, 255, 1)'); // solid sharp core
    gradient.addColorStop(0.96, 'rgba(255, 255, 255, 0.7)'); // 1.5px smooth subpixel AA
    gradient.addColorStop(1.0, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export const KnowledgeOrb3D: React.FC<KnowledgeOrb3DProps> = ({
  scrollProgress = 0
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Store target scroll progress in ref for seamless 60/120fps physics loop
  const scrollRef = useRef(scrollProgress);
  scrollRef.current = scrollProgress;

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let animationFrameId: number;
    let width = 0;
    let height = 0;
    let isVisible = true;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1. Three.js Core Setup
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

    // 2. Anchored Home Position (Right spatial volume)
    const homePosition = new THREE.Vector3(1.85, 0.05, 0);
    const homeRotation = new THREE.Euler(0, 0, 0);
    const homeScale = new THREE.Vector3(1, 1, 1);

    const currentOrbPosition = homePosition.clone();
    const orbPositionVelocity = new THREE.Vector3(0, 0, 0);

    const targetOrbRotation = new THREE.Vector3(0, 0, 0);

    // 3. Volumetric Particle Initialization
    const getParticleCount = (w: number): number => {
      if (prefersReducedMotion) return 180;
      if (w < 560) return 240;
      if (w < 960) return 460;
      return 760; // Optimal density with rock-solid 120fps performance
    };

    const particleCount = getParticleCount(window.innerWidth);
    const baseOrbRadius = 1.48;

    const particles: ParticleData[] = [];
    const positionsArray = new Float32Array(particleCount * 3);
    const colorsArray = new Float32Array(particleCount * 3);
    const sizesArray = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      // A. Target Spherical Position (Fibonacci sphere with volumetric depth stratification)
      const phiAngle = Math.acos(1 - (2 * (i + 0.5)) / particleCount);
      const thetaAngle = Math.PI * (1 + Math.sqrt(5)) * i;

      // 55% surface silhouette, 30% mantle, 15% core
      const layerRand = Math.random();
      let layer: 'core' | 'mid' | 'surface' = 'surface';
      let rRatio = 1.0;

      if (layerRand < 0.15) {
        layer = 'core';
        rRatio = 0.22 + Math.random() * 0.38;
      } else if (layerRand < 0.45) {
        layer = 'mid';
        rRatio = 0.60 + Math.random() * 0.32;
      } else {
        layer = 'surface';
        rRatio = 0.94 + Math.random() * 0.11;
      }

      const r = baseOrbRadius * rRatio;

      const ux = Math.sin(phiAngle) * Math.cos(thetaAngle);
      const uy = Math.cos(phiAngle);
      const uz = Math.sin(phiAngle) * Math.sin(thetaAngle);

      const sphereX = ux * r;
      const sphereY = uy * r;
      const sphereZ = uz * r;

      // B. Initial Scattered Position (Right and center-right volume, keeping left text corridor calm)
      const scatterX = 0.45 + Math.random() * 2.7;
      const scatterY = (Math.random() - 0.5) * 3.3;
      const scatterZ = (Math.random() - 0.5) * 2.5;

      // C. Curved Trajectory Control Point (Approaching from above, below, front, behind, lateral)
      const curveAngle = Math.random() * Math.PI * 2;
      const curveArc = 0.5 + Math.random() * 0.85;
      const curveMidX = (scatterX + sphereX) * 0.5 + Math.cos(curveAngle) * curveArc;
      const curveMidY = (scatterY + sphereY) * 0.5 + Math.sin(curveAngle) * curveArc;
      const curveMidZ = (scatterZ + sphereZ) * 0.5 + (Math.random() - 0.5) * 1.3;

      const formationDelay = Math.random() * 0.35;
      const formationDuration = 1.8 + Math.random() * 0.55;

      // Particle Size & Color Palette
      const sizeRand = Math.random();
      const isFocal = sizeRand < 0.05 && layer !== 'core';
      const baseSize = isFocal
        ? 3.8 + Math.random() * 0.6
        : sizeRand < 0.24
        ? 2.5 + Math.random() * 0.7
        : 1.5 + Math.random() * 0.7;

      const normZ = (sphereZ + baseOrbRadius) / (baseOrbRadius * 2);
      let baseR = 0.06;
      let baseG = 0.16;
      let baseB = 0.08;

      if (isFocal) {
        baseR = 0.64;
        baseG = 1.0;
        baseB = 0.07;
      } else if (normZ > 0.65) {
        baseR = 0.35 + normZ * 0.28;
        baseG = 0.68 + normZ * 0.30;
        baseB = 0.06 + normZ * 0.04;
      } else if (normZ > 0.35) {
        baseR = 0.12 + normZ * 0.16;
        baseG = 0.32 + normZ * 0.28;
        baseB = 0.08 + normZ * 0.04;
      } else {
        baseR = 0.06 + normZ * 0.06;
        baseG = 0.14 + normZ * 0.14;
        baseB = 0.06 + normZ * 0.04;
      }

      // Initial positions start scattered (unless prefersReducedMotion)
      const startX = prefersReducedMotion ? sphereX : scatterX;
      const startY = prefersReducedMotion ? sphereY : scatterY;
      const startZ = prefersReducedMotion ? sphereZ : scatterZ;

      // Physical traits per particle (Section 3: subtle variation in mass, spring strength, damping)
      const mass = 0.85 + Math.random() * 0.45; // 0.85 to 1.30
      const springK = 0.048 + Math.random() * 0.022; // subtle variation in responsiveness
      const damping = 0.83 + Math.random() * 0.04; // subtle variation in settling rate

      particles.push({
        scatterX,
        scatterY,
        scatterZ,
        sphereX,
        sphereY,
        sphereZ,
        radius0: r,
        theta0: thetaAngle,
        phi0: phiAngle,
        curveMidX,
        curveMidY,
        curveMidZ,
        formationDelay,
        formationDuration,
        x: startX,
        y: startY,
        z: startZ,
        vx: 0,
        vy: 0,
        vz: 0,
        mass,
        springK,
        damping,
        layer,
        baseSize,
        baseR,
        baseG,
        baseB,
        isFocal
      });

      positionsArray[i * 3] = startX;
      positionsArray[i * 3 + 1] = startY;
      positionsArray[i * 3 + 2] = startZ;

      colorsArray[i * 3] = baseR;
      colorsArray[i * 3 + 1] = baseG;
      colorsArray[i * 3 + 2] = baseB;

      sizesArray[i] = baseSize;
    }

    // 4. Sparse Internal Knowledge Graph Connections (6–9% of particles) & Conceptual Clusters
    const connections: GraphConnection[] = [];
    const maxConnections = Math.floor(particleCount * 0.085);
    const clusters: KnowledgeCluster[] = [];
    const particleClusterMap = new Int16Array(particleCount).fill(-1);
    const connectionClusterMap: number[] = [];

    // 6 local organic conceptual clusters for exploratory discovery
    for (let c = 0; c < 6; c++) {
      const centerIdx = Math.floor((c + 0.5) * (particleCount / 6));
      const clusterCenter = particles[centerIdx];
      const members: number[] = [centerIdx];
      particleClusterMap[centerIdx] = c;

      const candidates: { index: number; dist: number }[] = [];
      for (let i = 0; i < particleCount; i++) {
        if (i === centerIdx) continue;
        const p = particles[i];
        const dist = Math.hypot(p.sphereX - clusterCenter.sphereX, p.sphereY - clusterCenter.sphereY, p.sphereZ - clusterCenter.sphereZ);
        if (dist > 0.08 && dist < 0.62) {
          candidates.push({ index: i, dist });
        }
      }

      candidates.sort((a, b) => a.dist - b.dist);
      const connectCount = Math.min(candidates.length, 5);
      const clusterConnIndices: number[] = [];

      for (let j = 0; j < connectCount; j++) {
        const candIdx = candidates[j].index;
        members.push(candIdx);
        if (particleClusterMap[candIdx] === -1) {
          particleClusterMap[candIdx] = c;
        }

        if (connections.length < maxConnections) {
          const pA = candIdx;
          const pB = j + 1 < connectCount ? candidates[j + 1].index : centerIdx;
          const partA = particles[pA];
          const partB = particles[pB];
          const restDist = Math.hypot(partA.sphereX - partB.sphereX, partA.sphereY - partB.sphereY, partA.sphereZ - partB.sphereZ);

          const connIdx = connections.length;
          connections.push({
            p1: pA,
            p2: pB,
            restDist,
            drawDelay: 0.8 + (connections.length / maxConnections) * 0.9,
            currentOpacity: 0,
            active: 0
          });
          clusterConnIndices.push(connIdx);
          connectionClusterMap[connIdx] = c;
        }
      }

      clusters.push({
        id: c,
        centerIndex: centerIdx,
        memberIndices: members,
        connectionIndices: clusterConnIndices,
        activation: 0
      });
    }

    const linePositions = new Float32Array(connections.length * 2 * 3);
    const lineColors = new Float32Array(connections.length * 2 * 3);

    for (let c = 0; c < connections.length; c++) {
      const cIdx = c * 6;
      lineColors[cIdx] = 0.08;
      lineColors[cIdx + 1] = 0.22;
      lineColors[cIdx + 2] = 0.10;
      lineColors[cIdx + 3] = 0.08;
      lineColors[cIdx + 4] = 0.22;
      lineColors[cIdx + 5] = 0.10;
    }

    // 5. Construct Three.js BufferGeometry Objects with Dynamic Focal Scaling
    const pointsGeometry = new THREE.BufferGeometry();
    pointsGeometry.setAttribute('position', new THREE.BufferAttribute(positionsArray, 3));
    pointsGeometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));
    pointsGeometry.setAttribute('size', new THREE.BufferAttribute(sizesArray, 1));
    pointsGeometry.setAttribute('pSize', new THREE.BufferAttribute(sizesArray, 1));

    const particleTexture = createParticleTexture();

    const pointsMaterial = new THREE.PointsMaterial({
      size: 0.048,
      sizeAttenuation: true,
      vertexColors: true,
      map: particleTexture,
      transparent: true,
      opacity: 0.98,
      blending: THREE.NormalBlending,
      depthWrite: false
    });

    // Custom vertex shader hook: allows dynamic per-particle scale attribute (pSize)
    pointsMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        'uniform float size;',
        'uniform float size;\nattribute float pSize;'
      );
      shader.vertexShader = shader.vertexShader.replace(
        'gl_PointSize = size;',
        'gl_PointSize = size * pSize;'
      );
    };
    pointsMaterial.customProgramCacheKey = () => 'knowledge-orb-points-custom';

    const particlePoints = new THREE.Points(pointsGeometry, pointsMaterial);

    const linesGeometry = new THREE.BufferGeometry();
    linesGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    linesGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));

    const linesMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.52,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const graphLines = new THREE.LineSegments(linesGeometry, linesMaterial);

    const orbGroup = new THREE.Group();
    orbGroup.add(particlePoints);
    orbGroup.add(graphLines);
    orbGroup.position.copy(homePosition);
    scene.add(orbGroup);

    // 6. Interaction & Motion Physics State
    const startTime = performance.now();
    let lastTime = startTime;

    // Smoothed continuous scroll progress
    let smoothScrollProgress = 0;

    // Smooth mouse coordinates and velocity tracking (Section 14 & 37)
    let targetPointerX = 0;
    let targetPointerY = 0;
    let smoothPointerX = 0;
    let smoothPointerY = 0;
    let prevRawPointerX = 0;
    let prevRawPointerY = 0;
    let rawMouseVx = 0;
    let rawMouseVy = 0;
    let smoothedMouseVx = 0;
    let smoothedMouseVy = 0;
    let mouseActiveTarget = 0;
    let mouseActiveInfluence = 0;

    const cursorRay3D = new THREE.Vector3(0, 0, 0);
    const localCursorPos = new THREE.Vector3(0, 0, 0);

    let activeRipple: ParticleRipple | null = null;

    /**
     * Compute Responsive Home Position (Anchored on right side: 65–75% across)
     */
    const updateHomePosition = () => {
      if (width === 0 || height === 0) return;
      const aspect = width / height;

      if (width < 768) {
        homePosition.set(aspect * 0.42, -0.15, 0);
        homeScale.set(0.82, 0.82, 0.82);
      } else if (width < 1080) {
        homePosition.set(aspect * 0.70, 0.05, 0);
        homeScale.set(0.95, 0.95, 0.95);
      } else {
        const posX = Math.min(2.4, Math.max(1.6, aspect * 0.86));
        homePosition.set(posX, 0.05, 0);
        homeScale.set(1.0, 1.0, 1.0);
      }
    };

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

    // Passive pointer tracking (Section 37: Zero React re-renders)
    const handlePointerMove = (e: PointerEvent) => {
      if (prefersReducedMotion) return;
      const rect = targetElement.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      prevRawPointerX = targetPointerX;
      prevRawPointerY = targetPointerY;

      targetPointerX = (clientX / width) * 2 - 1;
      targetPointerY = -(clientY / height) * 2 + 1;

      mouseActiveTarget = 1;

      // Raw velocity calculation
      rawMouseVx = (targetPointerX - prevRawPointerX) * 25;
      rawMouseVy = (targetPointerY - prevRawPointerY) * 25;
    };

    const handlePointerLeave = () => {
      mouseActiveTarget = 0;
      rawMouseVx = 0;
      rawMouseVy = 0;
    };

    const handlePointerDown = () => {
      if (prefersReducedMotion) return;
      activeRipple = {
        center: localCursorPos.clone().normalize().multiplyScalar(baseOrbRadius),
        startTime: performance.now(),
        strength: 0.95
      };
    };

    targetElement.addEventListener('pointermove', handlePointerMove, { passive: true });
    targetElement.addEventListener('pointerleave', handlePointerLeave, { passive: true });
    targetElement.addEventListener('pointerdown', handlePointerDown, { passive: true });

    /**
     * Continuous Frame-Rate Independent Physics Simulation Loop (Section 30)
     */
    const animate = (now: number) => {
      animationFrameId = requestAnimationFrame(animate);
      if (!isVisible || width === 0 || height === 0) return;

      // Delta time calculation clamped to avoid huge jumps on tab switch
      const dt = Math.min(Math.max((now - lastTime) * 0.001, 0.001), 0.05);
      lastTime = now;
      const dtNorm = dt / (1 / 60); // 1.0 at 60Hz, 0.5 at 120Hz, 0.417 at 144Hz

      const elapsedSeconds = (now - startTime) * 0.001;
      const time = now * 0.001;

      // 1. Continuous Smooth Scroll Progress (Section 18: smooth exponential approach)
      const targetScroll = Math.min(1.0, Math.max(0, scrollRef.current));
      const scrollLerp = 1 - Math.exp(-10.0 * dt);
      smoothScrollProgress += (targetScroll - smoothScrollProgress) * scrollLerp;

      // 2. Continuous Formation & Blended Stage Influences (Sections 6, 9, 10, 32)
      // 0–25% particles begin moving, 20–55% converge, 45–75% connections appear, 65–100% settle
      const formationTime = Math.max(0, elapsedSeconds - 0.25);
      const globalFormation = prefersReducedMotion ? 1.0 : Math.min(1.0, formationTime / 2.2);

      // Smooth blended influence values:
      // formationInfluence: 1 -> 0 over the final portion of formation
      const formationInfluence = prefersReducedMotion ? 0 : 1.0 - smoothstep(0.60, 0.96, globalFormation);
      // idleInfluence: 0 -> 1 smoothly rises as formation completes (no freeze and start)
      const idleInfluence = prefersReducedMotion ? 1.0 : smoothstep(0.40, 0.92, globalFormation);
      // scrollDissolution: smooth reverse formation on scroll
      const scrollDissolution = smoothstep(0.06, 0.82, smoothScrollProgress);

      // Hero overall opacity on scroll exit
      const heroOpacity = Math.max(0, 1.0 - Math.max(0, (smoothScrollProgress - 0.65) / 0.35));
      pointsMaterial.opacity = 0.94 * heroOpacity;

      // 3. Smooth Mouse Tracking & Velocity (Sections 13 & 14)
      const pointerLerp = 1 - Math.exp(-14.0 * dt);
      smoothPointerX += (targetPointerX - smoothPointerX) * pointerLerp;
      smoothPointerY += (targetPointerY - smoothPointerY) * pointerLerp;

      // Smoothed mouse velocity (Section 14: smoothedVelocity = lerp(smoothedVelocity, rawVelocity, factor))
      const velLerp = 1 - Math.exp(-9.0 * dt);
      smoothedMouseVx += (rawMouseVx - smoothedMouseVx) * velLerp;
      smoothedMouseVy += (rawMouseVy - smoothedMouseVy) * velLerp;
      rawMouseVx *= Math.exp(-5.0 * dt);
      rawMouseVy *= Math.exp(-5.0 * dt);
      const smoothedMouseSpeed = Math.hypot(smoothedMouseVx, smoothedMouseVy);

      // Mouse influence decay fallback (Section 13: gradually decay 1 -> 0 using damping)
      const mouseDecayLerp = 1 - Math.exp(-6.0 * dt);
      mouseActiveInfluence += (mouseActiveTarget - mouseActiveInfluence) * mouseDecayLerp;

      // Mouse interaction factor fades as user scrolls past 15%
      const scrollMouseAtten = Math.max(0, 1.0 - smoothScrollProgress / 0.15);
      const effectiveMouseInfluence = mouseActiveInfluence * scrollMouseAtten * (prefersReducedMotion ? 0 : 1);

      // 4. Anchored Orb Position, Surface-Aware Contact & Gyroscopic Tilt
      const vFovRad = (camera.fov * Math.PI) / 180;
      const planeH = 2 * Math.tan(vFovRad / 2) * camera.position.z;
      const planeW = planeH * camera.aspect;

      const cursorWorldX = (smoothPointerX * planeW) / 2;
      const cursorWorldY = (smoothPointerY * planeH) / 2;

      // Local displacement in XY plane relative to current orb position
      const dxFromOrb = cursorWorldX - currentOrbPosition.x;
      const dyFromOrb = cursorWorldY - currentOrbPosition.y;
      const distXY = Math.hypot(dxFromOrb, dyFromOrb);

      // Surface-aware contact depth (Z on front hemisphere surface)
      let surfaceContactZ = 0;
      if (distXY < baseOrbRadius) {
        surfaceContactZ = Math.sqrt(Math.max(0, baseOrbRadius * baseOrbRadius - distXY * distXY));
      } else {
        const outsideDist = distXY - baseOrbRadius;
        surfaceContactZ = Math.max(0, baseOrbRadius * Math.exp(-outsideDist * 2.4));
      }

      cursorRay3D.set(cursorWorldX, cursorWorldY, currentOrbPosition.z + surfaceContactZ);
      localCursorPos.set(dxFromOrb, dyFromOrb, surfaceContactZ);

      const influenceRadius = 2.4;
      let targetOrbX = homePosition.x;
      let targetOrbY = homePosition.y;
      let targetOrbZ = homePosition.z;

      if (effectiveMouseInfluence > 0.01 && distXY < influenceRadius) {
        const normDist = distXY / influenceRadius;
        const infl = Math.pow(1 - normDist, 1.8) * effectiveMouseInfluence;
        const dir = new THREE.Vector2(dxFromOrb, dyFromOrb).normalize();
        const maxShift = 0.18; // ~14px displacement clamped
        targetOrbX += dir.x * infl * maxShift;
        targetOrbY += dir.y * infl * maxShift;
        targetOrbZ += infl * 0.08;

        if (distXY < baseOrbRadius * 1.15 && smoothedMouseSpeed > 1.25 && (!activeRipple || now - activeRipple.startTime > 420)) {
          activeRipple = {
            center: localCursorPos.clone().normalize().multiplyScalar(baseOrbRadius),
            startTime: now,
            strength: Math.min(1.0, 0.45 + smoothedMouseSpeed * 0.08)
          };
        }
      }

      // Spring-damper for orb anchor
      const orbSpringK = 0.045;
      const orbDamp = Math.pow(0.84, dtNorm);
      orbPositionVelocity.x = (orbPositionVelocity.x + (targetOrbX - currentOrbPosition.x) * orbSpringK * dtNorm) * orbDamp;
      orbPositionVelocity.y = (orbPositionVelocity.y + (targetOrbY - currentOrbPosition.y) * orbSpringK * dtNorm) * orbDamp;
      orbPositionVelocity.z = (orbPositionVelocity.z + (targetOrbZ - currentOrbPosition.z) * orbSpringK * dtNorm) * orbDamp;
      currentOrbPosition.x += orbPositionVelocity.x * dtNorm;
      currentOrbPosition.y += orbPositionVelocity.y * dtNorm;
      currentOrbPosition.z += orbPositionVelocity.z * dtNorm;
      orbGroup.position.copy(currentOrbPosition);

      // Continuous subtle rotation + Gyroscopic 3D Tilt
      const rotSpeed = 0.035 * idleInfluence * (1.0 - scrollDissolution * 0.85);
      targetOrbRotation.y += rotSpeed * dt;

      const maxTiltX = 0.16; // ~9.2 degrees pitch
      const maxTiltZ = 0.11; // ~6.3 degrees roll
      const pitchTarget = effectiveMouseInfluence > 0.01 
        ? homeRotation.x - smoothPointerY * maxTiltX * effectiveMouseInfluence 
        : homeRotation.x + Math.sin(time * 0.35) * 0.02 * idleInfluence;
      const rollTarget = effectiveMouseInfluence > 0.01
        ? -smoothPointerX * maxTiltZ * effectiveMouseInfluence
        : 0;
      const yawBias = smoothPointerX * 0.14 * effectiveMouseInfluence;

      orbGroup.rotation.x += (pitchTarget - orbGroup.rotation.x) * (1 - Math.exp(-7.0 * dt));
      orbGroup.rotation.y = targetOrbRotation.y + yawBias;
      orbGroup.rotation.z += (rollTarget - orbGroup.rotation.z) * (1 - Math.exp(-7.0 * dt));

      // Update Cluster Exploratory Activations
      for (let c = 0; c < clusters.length; c++) {
        const cluster = clusters[c];
        const centerPart = particles[cluster.centerIndex];
        const distToCluster = Math.hypot(
          centerPart.x - localCursorPos.x,
          centerPart.y - localCursorPos.y,
          centerPart.z - localCursorPos.z
        );

        let targetActivation = 0;
        if (effectiveMouseInfluence > 0.02 && globalFormation > 0.45 && distToCluster < 1.15) {
          targetActivation = Math.pow(1.0 - distToCluster / 1.15, 1.8) * effectiveMouseInfluence;
        }
        cluster.activation += (targetActivation - cluster.activation) * (1 - Math.exp(-9.0 * dt));
      }

      // 5. Particle Physics: Combined Continuous Forces with Knowledge Lens
      const posAttr = pointsGeometry.attributes.position;
      const colAttr = pointsGeometry.attributes.color;
      const sizesAttr = pointsGeometry.attributes.pSize;

      const rippleAge = activeRipple ? (now - activeRipple.startTime) * 0.001 : 999;
      const rippleActive = activeRipple !== null && rippleAge < 1.1;
      if (!rippleActive && activeRipple) {
        activeRipple = null;
      }

      for (let i = 0; i < particleCount; i++) {
        const p = particles[i];

        // A. Continuous Trajectory Parameter (tau)
        const pLocalTime = Math.max(0, formationTime - p.formationDelay);
        const rawProg = Math.min(1.0, pLocalTime / p.formationDuration);
        const tCurve = prefersReducedMotion ? 1.0 : rawProg * rawProg * (3 - 2 * rawProg);

        // Blended timeline progress: formation -> idle -> scroll dissolution (Sections 19 & 20)
        const pTau = tCurve * (1.0 - scrollDissolution);

        // Curved 3D Bézier trajectory (Section 4)
        const invTau = 1 - pTau;
        const b0 = invTau * invTau;
        const b1 = 2 * invTau * pTau;
        const b2 = pTau * pTau;

        let targetX = b0 * p.scatterX + b1 * p.curveMidX + b2 * p.sphereX;
        let targetY = b0 * p.scatterY + b1 * p.curveMidY + b2 * p.sphereY;
        let targetZ = b0 * p.scatterZ + b1 * p.curveMidZ + b2 * p.sphereZ;

        // Radial outward scatter momentum during scroll (Section 19)
        if (scrollDissolution > 0.15) {
          const scatterOut = (scrollDissolution - 0.15) * 1.6;
          const invR = 1 / (p.radius0 || 1);
          targetX += p.sphereX * invR * scatterOut;
          targetY += p.sphereY * invR * scatterOut;
          targetZ += p.sphereZ * invR * scatterOut * 1.3;
        }

        // Low-frequency organic breathing noise blended into idle (Section 11)
        if (pTau > 0.3 && idleInfluence > 0.01) {
          const breathing =
            0.028 * Math.sin(2 * p.theta0 + 1.1 * time) * Math.cos(3 * p.phi0 - 0.9 * time) +
            0.016 * Math.sin(3 * p.theta0 + 2 * p.phi0 + 1.4 * time);
          const breatheScale = 1 + breathing * idleInfluence * pTau;
          targetX *= breatheScale;
          targetY *= breatheScale;
          targetZ *= breatheScale;
        }

        // B. Knowledge Lens Dual-Zone Mouse Force & Velocity Momentum
        let fMouseX = 0;
        let fMouseY = 0;
        let fMouseZ = 0;
        let activeBrightness = 0;

        if (effectiveMouseInfluence > 0.02 && pTau > 0.4) {
          const dx = p.x - localCursorPos.x;
          const dy = p.y - localCursorPos.y;
          const dz = p.z - localCursorPos.z;
          const distToCursor = Math.hypot(dx, dy, dz);
          const localR = 1.65;

          if (distToCursor < localR) {
            // 1. Dual-zone radial force:
            // Core dispersion (dist < 0.42): gentle outward parting lens
            // Rim attraction (0.42 to 1.65): gentle inward focusing ring
            let radialForce = 0;
            if (distToCursor < 0.42) {
              const coreFactor = 1.0 - (distToCursor / 0.42);
              radialForce = coreFactor * 0.16; // positive = pushes away from cursor
            } else {
              const rimProgress = (distToCursor - 0.42) / (localR - 0.42);
              const rimFactor = Math.sin(rimProgress * Math.PI);
              radialForce = -rimFactor * 0.12; // negative = pulls inward toward focal ring
            }

            const invD = 1 / Math.max(0.08, distToCursor);
            const normDx = dx * invD;
            const normDy = dy * invD;
            const normDz = dz * invD;

            // Depth weighting: front hemisphere particles react with highest clarity
            const depthWeight = 0.50 + Math.max(0, (p.z + baseOrbRadius * 0.2) / (baseOrbRadius * 1.2)) * 0.50;
            const falloff = Math.pow(1.0 - distToCursor / localR, 1.8) * effectiveMouseInfluence * depthWeight;

            // Radial force application
            fMouseX = normDx * radialForce * falloff;
            fMouseY = normDy * radialForce * falloff;
            fMouseZ = normDz * radialForce * falloff * 0.6;

            // 2. Tangential mouse velocity drag
            const dragStrength = Math.min(smoothedMouseSpeed * 0.042, 0.28) * falloff;
            fMouseX += smoothedMouseVx * dragStrength;
            fMouseY += smoothedMouseVy * dragStrength;
            fMouseZ += (smoothedMouseVx * normDx + smoothedMouseVy * normDy) * 0.04 * dragStrength;

            // Active brightness for lens illumination
            const lensProximity = Math.pow(1.0 - Math.min(1.0, distToCursor / 1.35), 2.0);
            activeBrightness = lensProximity * effectiveMouseInfluence * depthWeight;
          }
        }

        // Cluster discovery boost
        const pClusterIdx = particleClusterMap[i];
        if (pClusterIdx !== undefined && pClusterIdx >= 0) {
          const clus = clusters[pClusterIdx];
          if (clus && clus.activation > 0.02) {
            activeBrightness = Math.max(activeBrightness, clus.activation * 0.88);
          }
        }

        // Surface Ripple wave propagation
        if (rippleActive && activeRipple && pTau > 0.5) {
          const normDirX = p.sphereX / (p.radius0 || 1);
          const normDirY = p.sphereY / (p.radius0 || 1);
          const normDirZ = p.sphereZ / (p.radius0 || 1);
          const rdot = normDirX * (activeRipple.center.x / baseOrbRadius) +
                       normDirY * (activeRipple.center.y / baseOrbRadius) +
                       normDirZ * (activeRipple.center.z / baseOrbRadius);
          const angDist = Math.acos(Math.max(-1, Math.min(1, rdot)));
          const waveFront = rippleAge * 3.2;
          const deltaWave = Math.abs(angDist - waveFront);
          if (deltaWave < 0.45) {
            const waveShape = Math.cos((deltaWave / 0.45) * (Math.PI / 2));
            const decay = Math.max(0, 1 - rippleAge / 1.1) * effectiveMouseInfluence;
            const rippleShift = waveShape * activeRipple.strength * 0.07 * decay;
            fMouseX += normDirX * rippleShift;
            fMouseY += normDirY * rippleShift;
            fMouseZ += normDirZ * rippleShift;
            activeBrightness = Math.max(activeBrightness, waveShape * decay * 0.5);
          }
        }

        // C. Continuous Spring Physics Integration (Section 2: force = (target - position) * springStrength)
        // Combined forces: F_total = F_spring + F_mouse
        const totalFx = (targetX - p.x) * p.springK + fMouseX;
        const totalFy = (targetY - p.y) * p.springK + fMouseY;
        const totalFz = (targetZ - p.z) * p.springK + fMouseZ;

        // Acceleration = Force / Mass (Section 3)
        const ax = totalFx / p.mass;
        const ay = totalFy / p.mass;
        const az = totalFz / p.mass;

        // Frame-rate independent velocity integration with settling damping (Section 9)
        const settleDamp = 1.0 - (1.0 - formationInfluence) * 0.04 * (1.0 - scrollDissolution);
        const dampFactor = Math.pow(p.damping * settleDamp, dtNorm);
        p.vx = (p.vx + ax * dtNorm) * dampFactor;
        p.vy = (p.vy + ay * dtNorm) * dampFactor;
        p.vz = (p.vz + az * dtNorm) * dampFactor;

        p.x += p.vx * dtNorm;
        p.y += p.vy * dtNorm;
        p.z += p.vz * dtNorm;

        posAttr.setXYZ(i, p.x, p.y, p.z);

        // Dynamic size swelling on hover (+32% focal scale)
        const sizeMultiplier = 1.0 + activeBrightness * 0.32;
        sizesAttr.setX(i, p.baseSize * sizeMultiplier);

        // Dynamic Color: Deep Green Volume + GraphMind Green (#A3FF12) active glow
        if (activeBrightness > 0.02) {
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
      sizesAttr.needsUpdate = true;

      // 6. Update Knowledge Graph Relationship Lines with Cluster Discovery
      const linePosAttr = linesGeometry.attributes.position;
      const lineColAttr = linesGeometry.attributes.color;

      for (let c = 0; c < connections.length; c++) {
        const conn = connections[c];
        const pA = particles[conn.p1];
        const pB = particles[conn.p2];

        linePosAttr.setXYZ(c * 2, pA.x, pA.y, pA.z);
        linePosAttr.setXYZ(c * 2 + 1, pB.x, pB.y, pB.z);

        // Distance proximity factor (Sections 7 & 8)
        const currentDist = Math.hypot(pA.x - pB.x, pA.y - pB.y, pA.z - pB.z);
        const distDiff = Math.abs(currentDist - conn.restDist);
        const proximityFactor = Math.max(0, 1.0 - distDiff / 0.40);

        // Staggered emergence over formation time (250–600ms per relationship)
        const drawProgress = Math.min(1.0, Math.max(0, (formationTime - conn.drawDelay) / 0.45));

        // Early dissolve on scroll
        const scrollConnFactor = Math.max(0, 1.0 - smoothScrollProgress / 0.24);

        const targetConnOpacity = proximityFactor * drawProgress * scrollConnFactor * (1.0 - scrollDissolution);

        // Smooth opacity transition
        conn.currentOpacity += (targetConnOpacity - conn.currentOpacity) * (1 - Math.exp(-7.0 * dt));

        // Mouse proximity activation
        let lineActive = 0;
        if (effectiveMouseInfluence > 0.05) {
          const midX = (pA.x + pB.x) * 0.5;
          const midY = (pA.y + pB.y) * 0.5;
          const midZ = (pA.z + pB.z) * 0.5;
          const distToCursor = Math.hypot(midX - localCursorPos.x, midY - localCursorPos.y, midZ - localCursorPos.z);
          if (distToCursor < 1.45) {
            lineActive = Math.pow(1 - distToCursor / 1.45, 1.8) * effectiveMouseInfluence;
          }
        }

        // Boost by cluster activation if this connection belongs to an active cluster
        const clusIdx = connectionClusterMap[c];
        if (clusIdx !== undefined && clusIdx >= 0) {
          const clus = clusters[clusIdx];
          if (clus && clus.activation > 0.02) {
            lineActive = Math.max(lineActive, clus.activation * 0.95);
          }
        }

        conn.active += (lineActive - conn.active) * (1 - Math.exp(-8.0 * dt));

        const baseAlpha = conn.currentOpacity * 0.45 * heroOpacity;

        if (conn.active > 0.02) {
          const r = THREE.MathUtils.lerp(0.08, 0.64, conn.active) * baseAlpha;
          const g = THREE.MathUtils.lerp(0.22, 1.0, conn.active) * baseAlpha;
          const b = THREE.MathUtils.lerp(0.10, 0.07, conn.active) * baseAlpha;
          lineColAttr.setXYZ(c * 2, r, g, b);
          lineColAttr.setXYZ(c * 2 + 1, r, g, b);
        } else {
          const r = 0.08 * baseAlpha;
          const g = 0.22 * baseAlpha;
          const b = 0.10 * baseAlpha;
          lineColAttr.setXYZ(c * 2, r, g, b);
          lineColAttr.setXYZ(c * 2 + 1, r, g, b);
        }
      }

      linePosAttr.needsUpdate = true;
      lineColAttr.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      targetElement.removeEventListener('pointermove', handlePointerMove);
      targetElement.removeEventListener('pointerleave', handlePointerLeave);
      targetElement.removeEventListener('pointerdown', handlePointerDown);

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
      className="overview-hero-particle-field overview-hero-orb-viewport overview-hero-canvas-container"
      aria-hidden="true"
    >
      <canvas 
        ref={canvasRef}
        className="overview-hero-particle-canvas overview-hero-orb-canvas overview-hero-canvas"
      />
    </div>
  );
};
