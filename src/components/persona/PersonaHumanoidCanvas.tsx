import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { CHARACTER_Y_BOUNDS } from './humanoidGeometry';
import {
  attachPersonaSolidifyShader,
  type SolidifyMaterialUniforms
} from './personaShader';
import { PERSONA_SURFACE_POINTS, type PrecomputedSurfacePoint } from './personaSurfaceData';
import { personaTransitionController } from './personaTransition';

export type PersonaAnimationState =
  | 'INITIALIZING'
  | 'SPHERE'
  | 'FORMING_HUMANOID'
  | 'HUMANOID_SETTLING'
  | 'PARTIAL_SOLIDIFICATION'
  | 'FULLY_SOLID'
  | 'IDLE';

export interface PersonaHumanoidCanvasProps {
  onStateChange?: (state: PersonaAnimationState) => void;
  className?: string;
  autoPlay?: boolean;
}

/**
 * Independent Persona Particle System Configuration.
 * Fully decoupled from the hero Knowledge Orb (which maintains its protected 760 particle budget).
 */
export const PERSONA_PARTICLE_CONFIG = {
  desktopCount: 3600,
  tabletCount: 2200,
  mobileCount: 1200,
  reducedMotionCount: 600,
  baseParticleSize: 0.0132, // Crisp, refined projected point size for 3,600 points at camera z=1.48
  cameraZ: 1.48,
  cameraY: 0.0,
  cameraFov: 30,
  revealDuration: 2.20 // Independent cinematic reveal duration
};

export const PERSONA_ANIMATION_CONFIG = {
  sphereDuration: 0.30,
  formationDuration: 1.50,
  settleDuration: 0.40,
  solidifyDuration: 3.6, // Phase B bottom-up solidification (hidden until future approval)
  fullySolidDuration: 0.8,
  minY: CHARACTER_Y_BOUNDS.min - 0.05,
  maxY: CHARACTER_Y_BOUNDS.max + 0.05,
  transitionBand: 0.045,
  particleCount: 3600
};

interface PersonaParticle {
  startX: number;
  startY: number;
  startZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
  targetR: number;
  targetG: number;
  targetB: number;
  baseR: number;
  baseG: number;
  baseB: number;
  baseScale: number;
  delay: number;
  duration: number;
}

function createParticleDiscTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const center = size / 2;
    const radius = center - 3;
    // Crisp, sharp disc with subpixel anti-aliasing edge (zero blurry neon haze)
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.82, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.96, 'rgba(255, 255, 255, 0.7)');
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

export const PersonaHumanoidCanvas: React.FC<PersonaHumanoidCanvasProps> = ({
  onStateChange,
  className = '',
  autoPlay = true
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [currentState, setCurrentState] = useState<PersonaAnimationState>('INITIALIZING');
  const currentStateRef = useRef<PersonaAnimationState>('INITIALIZING');

  useEffect(() => {
    currentStateRef.current = currentState;
    onStateChange?.(currentState);
  }, [currentState, onStateChange]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    let isDisposed = false;
    let animationFrameId: number;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1. Independent WebGL Renderer for Persona Humanoid
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance'
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
    } catch (e) {
      console.warn('[PersonaHumanoidCanvas] WebGLRenderer creation failed:', e);
      setCurrentState('IDLE');
      return;
    }

    const scene = new THREE.Scene();

    // 2. Persona Portrait Camera Setup (Direct chest-up portrait framing)
    const camera = new THREE.PerspectiveCamera(
      PERSONA_PARTICLE_CONFIG.cameraFov,
      1,
      0.1,
      50
    );
    camera.position.set(0, 0.0, 1.48);
    camera.lookAt(0, 0.0, 0);

    // 3. Controlled Studio Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.50);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xfff8ee, 1.20);
    keyLight.position.set(1.2, 1.4, 1.6);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.60);
    fillLight.position.set(-1.4, 0.7, 1.3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xa3ff12, 0.34);
    rimLight.position.set(0.9, 1.3, -2.2);
    scene.add(rimLight);

    // 4. Character Core Group
    const characterGroup = new THREE.Group();
    characterGroup.name = 'persona-humanoid-group';
    scene.add(characterGroup);

    // Solidification uniforms (solid model kept strictly hidden below viewport)
    const cfg = PERSONA_ANIMATION_CONFIG;
    const solidifyUniforms: SolidifyMaterialUniforms = {
      uSolidifyY: { value: cfg.minY - 1.0 },
      uTransitionBand: { value: cfg.transitionBand },
      uGlowColor: { value: new THREE.Color('#A3FF12') },
      uGlowIntensity: { value: 2.2 }
    };

    let loadedSolidModel: THREE.Object3D | null = null;
    const gltfLoader = new GLTFLoader();
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    gltfLoader.load(
      '/models/human_persona.glb',
      (gltf) => {
        if (isDisposed) return;
        const model = gltf.scene;
        model.name = 'solid-humanoid-character';

        // Relax arms naturally beside the torso
        const leftArm = model.getObjectByName('LeftArm');
        const rightArm = model.getObjectByName('RightArm');
        if (leftArm) leftArm.rotation.set(1.20, 0.0, 0.0);
        if (rightArm) rightArm.rotation.set(1.80, 1.40, -0.60);

        model.position.set(0, -1.56, 0);

        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            if (mesh.material) {
              const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              materials.forEach((m) => {
                attachPersonaSolidifyShader(m, solidifyUniforms);
              });
            }
          }
        });

        loadedSolidModel = model;
        // Keep solid model hidden during particle-only phase
        model.visible = false;
        characterGroup.add(model);
      },
      undefined,
      (err) => {
        console.warn('[PersonaHumanoidCanvas] Model loading error:', err);
      }
    );

    // 5. Independent High-Density Particle System Allocation
    const width = container.clientWidth || window.innerWidth || 1200;
    const isMobile = width < 768;
    const isTablet = width >= 768 && width < 1200;

    const particleCount = prefersReducedMotion
      ? PERSONA_PARTICLE_CONFIG.reducedMotionCount
      : isMobile
      ? PERSONA_PARTICLE_CONFIG.mobileCount
      : isTablet
      ? PERSONA_PARTICLE_CONFIG.tabletCount
      : PERSONA_PARTICLE_CONFIG.desktopCount;

    const particles: PersonaParticle[] = [];
    const positionsArray = new Float32Array(particleCount * 3);
    const colorsArray = new Float32Array(particleCount * 3);
    const sizesArray = new Float32Array(particleCount);

    const sourcePoints = PERSONA_SURFACE_POINTS;
    const numSource = sourcePoints.length;

    // Key directional light vector for 3D normal shading
    const lx = 0.38, ly = 0.58, lz = 0.72;

    for (let i = 0; i < particleCount; i++) {
      // Precise target sampling across GLB surface via uniform stride
      const targetIdx = Math.floor((i * numSource) / particleCount);
      const target: PrecomputedSurfacePoint = sourcePoints[targetIdx];

      // 3D Lighting & Normal Grading
      const nDotL = Math.max(0.0, target.nx * lx + target.ny * ly + target.nz * lz);
      const facing = Math.max(0.0, target.nz);

      // Anatomical feature zones
      const isEyeball =
        target.z > 0.076 &&
        Math.abs(target.x) >= 0.024 &&
        Math.abs(target.x) <= 0.052 &&
        target.y >= 0.072 &&
        target.y <= 0.11;

      const isCheekOrFace =
        target.z > 0.045 &&
        target.y >= 0.01 &&
        target.y <= 0.16 &&
        Math.abs(target.x) < 0.09;

      const isTopCrown = target.y > 0.16;
      const isNeckOrJaw = target.y >= -0.09 && target.y < 0.01;
      const isChestOrShoulder = target.y < -0.09;

      let targetR = 0.28;
      let targetG = 0.88;
      let targetB = 0.10;
      let baseScale = 1.0;

      if (isEyeball) {
        // Delicate, crisp specular reflections for eyes
        targetR = 0.55;
        targetG = 1.0;
        targetB = 0.16;
        baseScale = 0.82;
      } else if (isCheekOrFace) {
        // Luminous emerald/lime facial plane with clear diffuse shading
        const lightMod = 0.82 + 0.28 * nDotL;
        targetR = Math.min(0.66, 0.46 * lightMod);
        targetG = Math.min(1.0, 0.96 * lightMod);
        targetB = 0.07;
        baseScale = 1.02;
      } else if (isTopCrown) {
        // Crown and hair silhouette
        const lightMod = 0.80 + 0.25 * nDotL;
        targetR = 0.40 * lightMod;
        targetG = 0.92 * lightMod;
        targetB = 0.08;
        baseScale = 1.0;
      } else if (isNeckOrJaw) {
        // Slender neck & jawline bridge connecting head to torso
        const lightMod = 0.76 + 0.28 * nDotL;
        targetR = 0.34 * lightMod;
        targetG = 0.90 * lightMod;
        targetB = 0.09;
        baseScale = 1.0;
      } else if (isChestOrShoulder) {
        // Broad polo shirt torso & deltoids (consistent luminous presence)
        const lightMod = 0.80 + 0.26 * nDotL;
        targetR = 0.32 * lightMod;
        targetG = 0.90 * lightMod;
        targetB = 0.09;
        baseScale = 1.0;
      }

      // Depth falloff for grazing angles (enhances 3D roundness and volumetric form)
      if (facing < 0.30) {
        targetR *= 0.78;
        targetG *= 0.82;
      }

      // Initial positions for dedicated Persona reveal (soft normal offset near silhouette)
      const normalOffset = 0.12 + Math.sin(i * 3.7) * 0.03;
      const lateralSpread = Math.sin(i * 5.1) * 0.025;
      const verticalSpread = Math.cos(i * 4.3) * 0.025;

      const startX = target.x + target.nx * normalOffset + lateralSpread;
      const startY = target.y + target.ny * normalOffset + verticalSpread;
      const startZ = target.z + target.nz * normalOffset;

      // Soft ambient base colors for Phase A
      const baseR = 0.06;
      const baseG = 0.28;
      const baseB = 0.08;

      // Spatial reveal wave timing: sweeps upward from chest to crown
      const normY = Math.max(0, Math.min(1, (target.y - (-0.37)) / (0.27 - (-0.37))));
      const normZ = Math.max(0, Math.min(1, (target.z - (-0.08)) / (0.18 - (-0.08))));

      let delay = 0;
      let duration = 0.05;

      if (!prefersReducedMotion) {
        // Wave starts at 0.25s: chest & shoulders -> neck -> face -> crown
        delay = 0.25 + normY * 0.65 + (1.0 - normZ) * 0.15 + (i % 9) * 0.02;
        duration = 0.75 + (i % 5) * 0.03;
      }

      particles.push({
        startX,
        startY,
        startZ,
        targetX: target.x,
        targetY: target.y,
        targetZ: target.z,
        targetR,
        targetG,
        targetB,
        baseR,
        baseG,
        baseB,
        baseScale,
        delay,
        duration
      });

      const i3 = i * 3;
      if (prefersReducedMotion) {
        positionsArray[i3] = target.x;
        positionsArray[i3 + 1] = target.y;
        positionsArray[i3 + 2] = target.z;
        colorsArray[i3] = targetR;
        colorsArray[i3 + 1] = targetG;
        colorsArray[i3 + 2] = targetB;
        sizesArray[i] = baseScale;
      } else {
        positionsArray[i3] = startX;
        positionsArray[i3 + 1] = startY;
        positionsArray[i3 + 2] = startZ;
        colorsArray[i3] = baseR;
        colorsArray[i3 + 1] = baseG;
        colorsArray[i3 + 2] = baseB;
        sizesArray[i] = baseScale * 0.35;
      }
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positionsArray, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));
    particleGeometry.setAttribute('pSize', new THREE.BufferAttribute(sizesArray, 1));

    const particleTexture = createParticleDiscTexture();

    // NormalBlending with depthTest avoids blinding white-hot overlap clumping
    const particleMaterial = new THREE.PointsMaterial({
      size: PERSONA_PARTICLE_CONFIG.baseParticleSize,
      sizeAttenuation: true,
      vertexColors: true,
      map: particleTexture,
      transparent: true,
      opacity: 0.98,
      blending: THREE.NormalBlending,
      depthTest: true,
      depthWrite: false
    });

    particleMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        'uniform float size;',
        'uniform float size;\nattribute float pSize;'
      );
      shader.vertexShader = shader.vertexShader.replace(
        'gl_PointSize = size;',
        'gl_PointSize = size * pSize;'
      );
    };
    particleMaterial.customProgramCacheKey = () => 'persona-independent-humanoid-v2';

    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    particleSystem.name = 'persona-independent-particle-humanoid';
    characterGroup.add(particleSystem);

    // Responsive viewport resizing
    const handleResize = () => {
      if (!container || !renderer) return;
      const w = container.clientWidth || window.innerWidth || 1200;
      const h = container.clientHeight || window.innerHeight || 900;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;

      if (w < 768) {
        camera.position.set(0, 0.04, 1.75);
        camera.fov = 34;
        camera.lookAt(0, 0.04, 0);
      } else {
        camera.position.set(0, 0.0, 1.48);
        camera.fov = PERSONA_PARTICLE_CONFIG.cameraFov;
        camera.lookAt(0, 0, 0);
      }
      camera.updateProjectionMatrix();
    };

    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // Animation & Transition Timing
    const transitionStart = personaTransitionController.startTime || performance.now();
    const REVEAL_DURATION = prefersReducedMotion ? 0.05 : PERSONA_PARTICLE_CONFIG.revealDuration;

    // Check if initial mount is already in settled/inspection state
    let isInstantSettled = personaTransitionController.state === 'PERSONA_READY' || prefersReducedMotion;

    const render = (now: number) => {
      if (isDisposed) return;

      const elapsed = isInstantSettled
        ? REVEAL_DURATION + 1.0
        : (now - transitionStart) * 0.001;

      const progress = Math.min(1.0, elapsed / REVEAL_DURATION);

      // Determine animation state
      let newState: PersonaAnimationState = 'FORMING_HUMANOID';
      if (prefersReducedMotion) {
        newState = 'IDLE';
      } else if (isInstantSettled || progress >= 1.0) {
        newState = 'IDLE';
      } else if (elapsed < 0.25) {
        newState = 'INITIALIZING';
      } else if (elapsed < 1.80) {
        newState = 'FORMING_HUMANOID';
      } else {
        newState = 'HUMANOID_SETTLING';
      }

      if (newState !== currentStateRef.current) {
        setCurrentState(newState);
      }

      const posAttr = particleGeometry.attributes.position;
      const colAttr = particleGeometry.attributes.color;
      const sizesAttr = particleGeometry.attributes.pSize;

      // Ensure solid mesh remains strictly hidden below viewport during all particle stages
      solidifyUniforms.uSolidifyY.value = cfg.minY - 1.0;
      // Reserved for future Phase B bottom-up solidification when visually approved:
      // const currentY = cfg.minY + easeProg * (cfg.maxY - cfg.minY);

      // ----------------------------------------------------
      // PHASE D: Stabilized Humanoid (100% surface alignment with living breathing wave)
      // ----------------------------------------------------
      if (isInstantSettled || progress >= 1.0) {
        const timeVal = now * 0.001;

        for (let i = 0; i < particleCount; i++) {
          const p = particles[i];
          const breath = Math.sin(timeVal * 1.5 + p.targetY * 4.0) * 0.0012;
          const py = p.targetY + (p.targetY < 0.05 ? breath : breath * 0.35);

          posAttr.setXYZ(i, p.targetX, py, p.targetZ);
          colAttr.setXYZ(i, p.targetR, p.targetG, p.targetB);
          sizesAttr.setX(i, p.baseScale);
        }

        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        sizesAttr.needsUpdate = true;

        if (!isInstantSettled && progress >= 1.0) {
          isInstantSettled = true;
          personaTransitionController.completeHumanFormed();
          personaTransitionController.setPersonaReady();
        }

        renderer.render(scene, camera);
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      // ----------------------------------------------------
      // PHASES A, B, C: Independent Persona Reveal
      // ----------------------------------------------------
      for (let i = 0; i < particleCount; i++) {
        const p = particles[i];

        if (elapsed < p.delay) {
          // Phase A: Ambient floating dust near silhouette
          const ambientWave = Math.sin(elapsed * 2.0 + i) * 0.005;
          posAttr.setXYZ(i, p.startX, p.startY + ambientWave, p.startZ);
          colAttr.setXYZ(i, p.baseR, p.baseG, p.baseB);
          sizesAttr.setX(i, p.baseScale * 0.35);
          continue;
        }

        // Phase B: Convergence onto surface target
        const pTime = elapsed - p.delay;
        const rawP = Math.min(1.0, pTime / p.duration);
        // Smooth cubic ease-in-out
        const u = rawP * rawP * (3 - 2 * rawP);

        let px = THREE.MathUtils.lerp(p.startX, p.targetX, u);
        let py = THREE.MathUtils.lerp(p.startY, p.targetY, u);
        let pz = THREE.MathUtils.lerp(p.startZ, p.targetZ, u);

        // Phase C: Velocity damping and settling (1.80s -> 2.20s)
        if (elapsed >= 1.80) {
          const settleP = Math.min(1.0, (elapsed - 1.80) / 0.40);
          const damp = Math.exp(-settleP * 8.0);
          px = THREE.MathUtils.lerp(p.targetX, px, damp);
          py = THREE.MathUtils.lerp(p.targetY, py, damp);
          pz = THREE.MathUtils.lerp(p.targetZ, pz, damp);
        }

        posAttr.setXYZ(i, px, py, pz);

        // Color and scale grading
        const curR = THREE.MathUtils.lerp(p.baseR, p.targetR, u);
        const curG = THREE.MathUtils.lerp(p.baseG, p.targetG, u);
        const curB = THREE.MathUtils.lerp(p.baseB, p.targetB, u);
        const curScale = THREE.MathUtils.lerp(0.35, p.baseScale, u);

        colAttr.setXYZ(i, curR, curG, curB);
        sizesAttr.setX(i, curScale);
      }

      posAttr.needsUpdate = true;
      colAttr.needsUpdate = true;
      sizesAttr.needsUpdate = true;

      try {
        renderer.render(scene, camera);
      } catch (renderErr) {
        console.error('[PersonaHumanoidCanvas] Render error:', renderErr);
      }
      animationFrameId = requestAnimationFrame(render);
    };

    if (autoPlay) {
      animationFrameId = requestAnimationFrame(render);
    }

    return () => {
      isDisposed = true;
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();

      // Clean disposal of independent Persona resources
      particleGeometry.dispose();
      particleMaterial.dispose();
      particleTexture.dispose();
      if (loadedSolidModel) {
        loadedSolidModel.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const m = child as THREE.Mesh;
            m.geometry?.dispose();
            if (m.material) {
              if (Array.isArray(m.material)) m.material.forEach((mat) => mat.dispose());
              else m.material.dispose();
            }
          }
        });
      }
      renderer.dispose();
    };
  }, [autoPlay]);

  return (
    <div
      ref={containerRef}
      className={`persona-humanoid-canvas-container ${className}`}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        overflow: 'hidden'
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block'
        }}
      />
    </div>
  );
};
