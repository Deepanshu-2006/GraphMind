import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  sampleHumanoidSurfacePoints,
  buildHumanoidMesh,
  type HumanoidParticleData,
  CHARACTER_Y_BOUNDS
} from './humanoidGeometry';
import { createPersonaSolidMaterial } from './personaShader';

export type PersonaAnimationState =
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

export const PERSONA_ANIMATION_CONFIG = {
  sphereDuration: 0.8, // 0.0s -> 0.8s: Landing-page particle sphere rotating
  formationDuration: 2.4, // 0.8s -> 3.2s: Phase A: Reorganizing into humanoid
  settleDuration: 1.0, // 3.2s -> 4.2s: Phase A settle (100% particle humanoid)
  solidifyDuration: 3.6, // 4.2s -> 7.8s: Phase B: Bottom-up continuous solidification
  fullySolidDuration: 0.6, // 7.8s -> 8.4s: Complete solid character finishing wave
  minY: CHARACTER_Y_BOUNDS.min - 0.05,
  maxY: CHARACTER_Y_BOUNDS.max + 0.05,
  transitionBand: 0.08,
  particleCount: 1600
};

function createParticleDiscTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const center = size / 2;
    const radius = center - 3;
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, radius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.86, 'rgba(255, 255, 255, 1)');
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
  const [currentState, setCurrentState] = useState<PersonaAnimationState>('SPHERE');
  const currentStateRef = useRef<PersonaAnimationState>('SPHERE');

  useEffect(() => {
    currentStateRef.current = currentState;
    onStateChange?.(currentState);
  }, [currentState, onStateChange]);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1. Initialize WebGL Renderer
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
      renderer.toneMappingExposure = 1.15;
    } catch (e) {
      console.warn('[PersonaHumanoidCanvas] WebGL context creation failed:', e);
      return;
    }

    const scene = new THREE.Scene();

    // 2. Camera Setup (Frames the entire 2.3-unit character from head to feet)
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    camera.position.set(0, 0.0, 3.8);
    camera.lookAt(0, -0.05, 0);

    // 3. Lighting System (Sculptural Three-Point Studio Lighting)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(2.4, 3.5, 3.0);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x7a889b, 0.55);
    fillLight.position.set(-2.5, 1.0, 2.0);
    scene.add(fillLight);

    // Backlight / Rim light in GraphMind lime-green (#A3FF12)
    const rimLight = new THREE.DirectionalLight(0xa3ff12, 1.3);
    rimLight.position.set(0, -1.0, -3.0);
    scene.add(rimLight);

    // 4. Character Core Group
    const characterGroup = new THREE.Group();
    characterGroup.name = 'persona-character-group';
    scene.add(characterGroup);

    // 5. Solid Humanoid Mesh
    const solidMaterial = createPersonaSolidMaterial();
    const solidMeshGroup = buildHumanoidMesh(solidMaterial);
    characterGroup.add(solidMeshGroup);

    // 6. Particle Humanoid Surface Sampling
    const count = prefersReducedMotion ? 600 : PERSONA_ANIMATION_CONFIG.particleCount;
    const particleData: HumanoidParticleData[] = sampleHumanoidSurfacePoints(count, 1.48);

    const positionsArray = new Float32Array(count * 3);
    const colorsArray = new Float32Array(count * 3);
    const sizesArray = new Float32Array(count);

    // Initialize initial buffer data
    for (let i = 0; i < count; i++) {
      const p = particleData[i];
      const i3 = i * 3;

      if (prefersReducedMotion) {
        positionsArray[i3] = p.targetX;
        positionsArray[i3 + 1] = p.targetY;
        positionsArray[i3 + 2] = p.targetZ;
      } else {
        positionsArray[i3] = p.sphereX;
        positionsArray[i3 + 1] = p.sphereY;
        positionsArray[i3 + 2] = p.sphereZ;
      }

      colorsArray[i3] = p.baseR;
      colorsArray[i3 + 1] = p.baseG;
      colorsArray[i3 + 2] = p.baseB;
      sizesArray[i] = p.baseSize;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(positionsArray, 3));
    particleGeometry.setAttribute('color', new THREE.BufferAttribute(colorsArray, 3));
    particleGeometry.setAttribute('size', new THREE.BufferAttribute(sizesArray, 1));

    const particleTexture = createParticleDiscTexture();

    // Shader-enhanced particle material for individual particle sizing and smooth alpha fade
    const particleMaterial = new THREE.PointsMaterial({
      size: 0.038,
      vertexColors: true,
      map: particleTexture,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    particleSystem.name = 'persona-particle-humanoid';
    characterGroup.add(particleSystem);

    // Resize Handling
    const handleResize = () => {
      if (!container || !renderer) return;
      const width = container.clientWidth || 600;
      const height = container.clientHeight || 500;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };

    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // 7. State Machine & Continuous Physical Animation Loop
    let animationFrameId: number;
    let startTime = performance.now();
    let isDisposed = false;

    // Config timing milestones
    const cfg = PERSONA_ANIMATION_CONFIG;
    const tSphereEnd = cfg.sphereDuration;
    const tFormationEnd = tSphereEnd + cfg.formationDuration;
    const tSettleEnd = tFormationEnd + cfg.settleDuration;
    const tSolidifyEnd = tSettleEnd + cfg.solidifyDuration;
    const tFullySolidEnd = tSolidifyEnd + cfg.fullySolidDuration;

    if (prefersReducedMotion) {
      // For reduced motion, immediately skip to fully solid state
      solidMaterial.solidifyUniforms.uSolidifyY.value = cfg.maxY + 1.0;
      particleMaterial.opacity = 0.0;
      setCurrentState('IDLE');
    }

    const render = (now: number) => {
      if (isDisposed) return;

      const elapsed = (now - startTime) / 1000;

      // Determine explicit animation state
      let newState: PersonaAnimationState = 'SPHERE';

      if (prefersReducedMotion) {
        newState = 'IDLE';
      } else if (elapsed < tSphereEnd) {
        newState = 'SPHERE';
      } else if (elapsed < tFormationEnd) {
        newState = 'FORMING_HUMANOID';
      } else if (elapsed < tSettleEnd) {
        newState = 'HUMANOID_SETTLING';
      } else if (elapsed < tSolidifyEnd) {
        newState = 'PARTIAL_SOLIDIFICATION';
      } else if (elapsed < tFullySolidEnd) {
        newState = 'FULLY_SOLID';
      } else {
        newState = 'IDLE';
      }

      if (newState !== currentStateRef.current) {
        setCurrentState(newState);
      }

      const positions = particleGeometry.attributes.position.array as Float32Array;
      const colors = particleGeometry.attributes.color.array as Float32Array;

      // A. SPHERE STATE (0.0s -> 0.8s)
      if (newState === 'SPHERE') {
        const sphereProgress = elapsed / tSphereEnd;
        solidMaterial.solidifyUniforms.uSolidifyY.value = cfg.minY - 1.0; // Solid mesh completely hidden

        // Gentle spherical rotation
        characterGroup.rotation.y = elapsed * 0.35;
        characterGroup.position.set(0, 0, 0);

        for (let i = 0; i < count; i++) {
          const p = particleData[i];
          const i3 = i * 3;

          // Subtle pulse on particle sphere
          const pulse = 1.0 + Math.sin(elapsed * 2.5 + i * 0.1) * 0.03;
          positions[i3] = p.sphereX * pulse;
          positions[i3 + 1] = p.sphereY * pulse;
          positions[i3 + 2] = p.sphereZ * pulse;

          colors[i3] = p.baseR;
          colors[i3 + 1] = p.baseG;
          colors[i3 + 2] = p.baseB;
        }

        particleMaterial.opacity = 0.95;
      }

      // B. FORMING_HUMANOID (0.8s -> 3.2s) — Phase A Transition
      else if (newState === 'FORMING_HUMANOID') {
        const formTime = elapsed - tSphereEnd;
        solidMaterial.solidifyUniforms.uSolidifyY.value = cfg.minY - 1.0; // Solid mesh remains hidden

        // Slowly ease rotation back to upright front-facing angle
        characterGroup.rotation.y = THREE.MathUtils.lerp(characterGroup.rotation.y, 0, 0.04);
        characterGroup.position.set(0, 0, 0);

        for (let i = 0; i < count; i++) {
          const p = particleData[i];
          const i3 = i * 3;

          const rawProg = Math.max(0, Math.min(1, (formTime - p.formationDelay) / p.formationDuration));
          // Cubic smoothstep easing
          const easeProg = rawProg * rawProg * (3 - 2 * rawProg);

          // Quadratic Bezier curved trajectory from sphere -> curveMid -> humanoid surface
          const inv = 1 - easeProg;
          const curX = inv * inv * p.sphereX + 2 * inv * easeProg * p.curveMidX + easeProg * easeProg * p.targetX;
          const curY = inv * inv * p.sphereY + 2 * inv * easeProg * p.curveMidY + easeProg * easeProg * p.targetY;
          const curZ = inv * inv * p.sphereZ + 2 * inv * easeProg * p.curveMidZ + easeProg * easeProg * p.targetZ;

          positions[i3] = curX;
          positions[i3 + 1] = curY;
          positions[i3 + 2] = curZ;

          // Color shifts as particles approach target
          colors[i3] = p.baseR;
          colors[i3 + 1] = p.baseG;
          colors[i3 + 2] = p.baseB;
        }

        particleMaterial.opacity = 0.95;
      }

      // C. HUMANOID_SETTLING (3.2s -> 4.2s) — Phase A Settled (100% particle humanoid)
      else if (newState === 'HUMANOID_SETTLING') {
        const settleTime = elapsed - tFormationEnd;
        solidMaterial.solidifyUniforms.uSolidifyY.value = cfg.minY - 1.0; // Solid mesh still completely hidden

        characterGroup.rotation.y = 0;

        // Subtle gentle breathing motion
        const breath = Math.sin(settleTime * 2.0) * 0.008;
        characterGroup.position.y = breath;

        for (let i = 0; i < count; i++) {
          const p = particleData[i];
          const i3 = i * 3;

          // Stable settling with micro idle drift along normal
          const microJitter = Math.sin(settleTime * 3.0 + i * 0.2) * 0.003;
          positions[i3] = p.targetX + p.normalX * microJitter;
          positions[i3 + 1] = p.targetY + p.normalY * microJitter;
          positions[i3 + 2] = p.targetZ + p.normalZ * microJitter;

          colors[i3] = p.baseR;
          colors[i3 + 1] = p.baseG;
          colors[i3 + 2] = p.baseB;
        }

        particleMaterial.opacity = 0.95;
      }

      // D. PARTIAL_SOLIDIFICATION (4.2s -> 7.8s) — Phase B Bottom-Up Solidification
      else if (newState === 'PARTIAL_SOLIDIFICATION') {
        const solidifyTime = elapsed - tSettleEnd;
        const progress = Math.max(0, Math.min(1, solidifyTime / cfg.solidifyDuration));
        // Smooth continuous upward ascension
        const easeProg = progress * progress * (3 - 2 * progress);
        const currentY = cfg.minY + easeProg * (cfg.maxY - cfg.minY);

        solidMaterial.solidifyUniforms.uSolidifyY.value = currentY;

        // Gentle breathing motion shared by both representations
        const breath = Math.sin(elapsed * 1.5) * 0.01;
        characterGroup.position.y = breath;
        characterGroup.rotation.y = Math.sin(elapsed * 0.4) * 0.06;

        for (let i = 0; i < count; i++) {
          const p = particleData[i];
          const i3 = i * 3;

          const pY = p.targetY;
          const distToCut = currentY - pY;

          positions[i3] = p.targetX;
          positions[i3 + 1] = p.targetY;
          positions[i3 + 2] = p.targetZ;

          // State of particle relative to the moving boundary
          if (pY > currentY) {
            // ABOVE BOUNDARY: 100% active particles in the upper body
            colors[i3] = p.baseR;
            colors[i3 + 1] = p.baseG;
            colors[i3 + 2] = p.baseB;
          } else if (distToCut < cfg.transitionBand) {
            // AT ACTIVE BOUNDARY: glowing lime-green wavefront (#A3FF12)
            const edgeNorm = 1.0 - distToCut / cfg.transitionBand;
            colors[i3] = 0.64 * edgeNorm + p.baseR * (1 - edgeNorm);
            colors[i3 + 1] = 1.0 * edgeNorm + p.baseG * (1 - edgeNorm);
            colors[i3 + 2] = 0.07 * edgeNorm + p.baseB * (1 - edgeNorm);
          } else {
            // BELOW BOUNDARY: Particle has solidified into the solid mesh
            // Smoothly dissolve particle opacity/brightness to 0
            const fade = Math.max(0, 1.0 - (distToCut - cfg.transitionBand) / 0.12);
            colors[i3] = p.baseR * fade;
            colors[i3 + 1] = p.baseG * fade;
            colors[i3 + 2] = p.baseB * fade;
          }
        }

        particleMaterial.opacity = 0.95;
      }

      // E. FULLY_SOLID (7.8s -> 8.4s) & F. IDLE (8.4s+)
      else {
        // Head has completed solidification; character is fully solid
        solidMaterial.solidifyUniforms.uSolidifyY.value = cfg.maxY + 1.0;

        // Subtle idle floating / breathing animation
        const breath = Math.sin(elapsed * 1.5) * 0.012;
        characterGroup.position.y = breath;
        characterGroup.rotation.y = Math.sin(elapsed * 0.3) * 0.08;

        // Fade remaining particle points to quiet ambient dust motes
        particleMaterial.opacity = THREE.MathUtils.lerp(particleMaterial.opacity, 0.08, 0.05);

        for (let i = 0; i < count; i++) {
          const p = particleData[i];
          const i3 = i * 3;
          // Very gentle ambient float
          const floatOffset = Math.sin(elapsed * 1.2 + i * 0.15) * 0.006;
          positions[i3] = p.targetX + p.normalX * floatOffset;
          positions[i3 + 1] = p.targetY + p.normalY * floatOffset;
          positions[i3 + 2] = p.targetZ + p.normalZ * floatOffset;
        }
      }

      particleGeometry.attributes.position.needsUpdate = true;
      particleGeometry.attributes.color.needsUpdate = true;

      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    // 8. Safe Cleanup of All Resources
    return () => {
      isDisposed = true;
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }
      resizeObserver.disconnect();

      // Dispose geometries & materials
      particleGeometry.dispose();
      particleMaterial.dispose();
      particleTexture.dispose();

      solidMeshGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
        }
      });
      solidMaterial.dispose();

      // Dispose lights & renderer
      renderer.dispose();
      renderer.forceContextLoss();
    };
  }, [autoPlay]);

  return (
    <div
      ref={containerRef}
      className={`persona-humanoid-canvas-container ${className}`}
      data-animation-state={currentState}
      id="persona-humanoid-stage"
      aria-label="GraphMind Persona 3D Humanoid"
    >
      <canvas ref={canvasRef} className="persona-humanoid-canvas" />
    </div>
  );
};
