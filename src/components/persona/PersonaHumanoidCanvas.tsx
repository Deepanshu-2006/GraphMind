import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {
  sampleHumanoidSurfacePoints,
  type HumanoidParticleData,
  CHARACTER_Y_BOUNDS
} from './humanoidGeometry';
import {
  attachPersonaSolidifyShader,
  type SolidifyMaterialUniforms
} from './personaShader';

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

export const PERSONA_ANIMATION_CONFIG = {
  sphereDuration: 1.0, // 0.0s -> 1.0s: Landing-page particle sphere rotating
  formationDuration: 2.4, // 1.0s -> 3.4s: Phase A: Reorganizing into human head/shoulders
  settleDuration: 1.0, // 3.4s -> 4.4s: Phase A settle (100% particle humanoid)
  solidifyDuration: 3.6, // 4.4s -> 8.0s: Phase B: Bottom-up continuous solidification (chest -> head)
  fullySolidDuration: 0.8, // 8.0s -> 8.8s: Complete solid character finishing wave
  minY: CHARACTER_Y_BOUNDS.min - 0.05,
  maxY: CHARACTER_Y_BOUNDS.max + 0.05,
  transitionBand: 0.045,
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
      renderer.toneMappingExposure = 1.05;
    } catch (e) {
      console.warn('[PersonaHumanoidCanvas] WebGL context creation failed:', e);
      setCurrentState('IDLE');
      return;
    }

    const scene = new THREE.Scene();

    // 2. Camera Setup (Full-bleed cinematic portrait: character emerging from bottom edge)
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 0.0, 1.48);
    camera.lookAt(0, 0.0, 0);

    // 3. Controlled Studio Lighting Setup (Soft, restrained, premium)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.50);
    scene.add(ambientLight);

    // Soft key lighting to reveal facial structure without harsh glare
    const keyLight = new THREE.DirectionalLight(0xfff8ee, 1.20);
    keyLight.position.set(1.2, 1.4, 1.6);
    scene.add(keyLight);

    // Gentle cool slate fill lighting to preserve detail in darker areas
    const fillLight = new THREE.DirectionalLight(0x94a3b8, 0.60);
    fillLight.position.set(-1.4, 0.7, 1.3);
    scene.add(fillLight);

    // Delicate eye catchlight to add life and specular clarity to corneas
    const eyeCatchLight = new THREE.DirectionalLight(0xffffff, 0.22);
    eyeCatchLight.position.set(0, 0.15, 1.8);
    scene.add(eyeCatchLight);

    // Subtle GraphMind lime-green rim light (#A3FF12) - restrained edge accent behind shoulders & hair
    const rimLight = new THREE.DirectionalLight(0xa3ff12, 0.34);
    rimLight.position.set(0.9, 1.3, -2.2);
    scene.add(rimLight);

    // Neutral soft hair kicker to balance silhouette separation against near-black background
    const backKicker = new THREE.DirectionalLight(0xf1f5f9, 0.26);
    backKicker.position.set(-0.9, 1.4, -2.0);
    scene.add(backKicker);

    // 4. Character Core Group
    const characterGroup = new THREE.Group();
    characterGroup.name = 'persona-character-group';
    scene.add(characterGroup);

    // Shared Solidification Uniforms
    const solidifyUniforms: SolidifyMaterialUniforms = {
      uSolidifyY: { value: PERSONA_ANIMATION_CONFIG.minY - 1.0 }, // Initially hidden below viewport
      uTransitionBand: { value: PERSONA_ANIMATION_CONFIG.transitionBand },
      uGlowColor: { value: new THREE.Color('#A3FF12') },
      uGlowIntensity: { value: 2.2 }
    };

    // 5. High-Quality 3D Human Model Loading (GLB with MeshoptDecoder)
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

        // Position model so lower torso continues beyond bottom edge of viewport
        model.position.set(0, -1.56, 0);

        // Attach bottom-up solidification shader and refine material PBR parameters
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            if (mesh.material) {
              const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
              materials.forEach((m) => {
                if (m instanceof THREE.MeshStandardMaterial) {
                  if (mesh.name.toLowerCase().includes('eye')) {
                    // Glassy cornea glossiness
                    m.roughness = 0.15;
                    m.metalness = 0.0;
                  } else {
                    // Soft natural skin and fabric: diffuse matte finish prevents plastic shine and green light pooling
                    m.roughness = 0.72;
                    m.metalness = 0.02;
                  }
                }
                attachPersonaSolidifyShader(m, solidifyUniforms);
              });
            }
          }
        });

        loadedSolidModel = model;
        characterGroup.add(model);
      },
      undefined,
      (loadError) => {
        console.error('[PersonaHumanoidCanvas] GLB human model failed to load:', loadError);
      }
    );

    // 6. Particle Humanoid Surface Sampling (framed chest-up)
    const count = prefersReducedMotion ? 400 : PERSONA_ANIMATION_CONFIG.particleCount;
    const particleData: HumanoidParticleData[] = sampleHumanoidSurfacePoints(count, 0.28);

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
    particleGeometry.setAttribute('pSize', new THREE.BufferAttribute(sizesArray, 1));

    const particleTexture = createParticleDiscTexture();

    const particleMaterial = new THREE.PointsMaterial({
      size: 0.034,
      sizeAttenuation: true,
      vertexColors: true,
      map: particleTexture,
      transparent: true,
      opacity: 0.98,
      blending: THREE.AdditiveBlending,
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
    particleMaterial.customProgramCacheKey = () => 'persona-particle-humanoid-v4';

    const particleSystem = new THREE.Points(particleGeometry, particleMaterial);
    particleSystem.name = 'persona-particle-humanoid';
    characterGroup.add(particleSystem);

    // Responsive camera and viewport handling
    const handleResize = () => {
      if (!container || !renderer) return;
      const width = container.clientWidth || 600;
      const height = container.clientHeight || 500;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;

      // Adjust camera distance and FOV responsively for full-bleed portrait emerging from bottom edge
      if (width < 768) {
        // Mobile: Adjusted distance so shoulders fit comfortably inside narrow viewport
        camera.position.set(0, 0.04, 1.75);
        camera.fov = 34;
        camera.lookAt(0, 0.04, 0);
      } else {
        // Desktop: Cinematic, immersive full-bleed portrait emerging from bottom edge
        camera.position.set(0, 0.0, 1.48);
        camera.fov = 30;
        camera.lookAt(0, 0.0, 0);
      }
      camera.updateProjectionMatrix();
    };

    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // 7. State Machine & Animation Loop
    let animationFrameId: number;
    const startTime = performance.now();
    let isDisposed = false;

    const cfg = PERSONA_ANIMATION_CONFIG;
    const tSphereEnd = cfg.sphereDuration;
    const tFormationEnd = tSphereEnd + cfg.formationDuration;
    const tSettleEnd = tFormationEnd + cfg.settleDuration;
    const tSolidifyEnd = tSettleEnd + cfg.solidifyDuration;
    const tFullySolidEnd = tSolidifyEnd + cfg.fullySolidDuration;

    if (prefersReducedMotion) {
      solidifyUniforms.uSolidifyY.value = cfg.maxY + 1.0;
      particleMaterial.opacity = 0.0;
      setCurrentState('IDLE');
    }

    const render = (now: number) => {
      if (isDisposed) return;

      const elapsed = (now - startTime) / 1000;
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

      // PHASE A: Particle Sphere -> Humanoid Formation
      if (elapsed < tSphereEnd) {
        // Rotating sphere
        const sphereAngle = elapsed * 0.45;
        const cosA = Math.cos(sphereAngle);
        const sinA = Math.sin(sphereAngle);

        for (let i = 0; i < count; i++) {
          const p = particleData[i];
          const i3 = i * 3;
          positions[i3] = p.sphereX * cosA - p.sphereZ * sinA;
          positions[i3 + 1] = p.sphereY;
          positions[i3 + 2] = p.sphereX * sinA + p.sphereZ * cosA;

          colors[i3] = p.baseR;
          colors[i3 + 1] = p.baseG;
          colors[i3 + 2] = p.baseB;
        }

        solidifyUniforms.uSolidifyY.value = cfg.minY - 1.0;
        particleMaterial.opacity = 0.98;
        characterGroup.position.y = 0;
      } else if (elapsed < tFormationEnd) {
        // Traveling along bezier trajectories into the human model's shape
        const formT = (elapsed - tSphereEnd) / cfg.formationDuration;

        for (let i = 0; i < count; i++) {
          const p = particleData[i];
          const i3 = i * 3;

          const localT = Math.max(0, Math.min(1, (formT - p.formationDelay) / Math.max(0.01, p.formationDuration)));
          const easeT = localT < 0.5 ? 4 * localT * localT * localT : 1 - Math.pow(-2 * localT + 2, 3) / 2;

          const u = 1 - easeT;
          const u2 = u * u;
          const t2 = easeT * easeT;

          positions[i3] = u2 * p.sphereX + 2 * u * easeT * p.curveMidX + t2 * p.targetX;
          positions[i3 + 1] = u2 * p.sphereY + 2 * u * easeT * p.curveMidY + t2 * p.targetY;
          positions[i3 + 2] = u2 * p.sphereZ + 2 * u * easeT * p.curveMidZ + t2 * p.targetZ;

          colors[i3] = p.baseR;
          colors[i3 + 1] = p.baseG;
          colors[i3 + 2] = p.baseB;
        }

        solidifyUniforms.uSolidifyY.value = cfg.minY - 1.0;
        particleMaterial.opacity = 0.98;
        characterGroup.position.y = 0;
      } else if (elapsed < tSettleEnd) {
        // Settling into complete 100% human particle silhouette
        const settleT = (elapsed - tFormationEnd) / cfg.settleDuration;
        const damp = Math.exp(-settleT * 3.5);
        const wavePhase = settleT * Math.PI * 4;

        for (let i = 0; i < count; i++) {
          const p = particleData[i];
          const i3 = i * 3;
          const subtleWave = Math.sin(wavePhase + p.targetY * 6) * 0.003 * damp;

          positions[i3] = p.targetX;
          positions[i3 + 1] = p.targetY + subtleWave;
          positions[i3 + 2] = p.targetZ;

          colors[i3] = p.baseR;
          colors[i3 + 1] = p.baseG;
          colors[i3 + 2] = p.baseB;
        }

        solidifyUniforms.uSolidifyY.value = cfg.minY - 1.0;
        particleMaterial.opacity = 0.98;
        characterGroup.position.y = 0;
      } else if (elapsed < tSolidifyEnd) {
        // PHASE B: Bottom-up continuous solidification (Chest -> Shoulders -> Neck -> Face -> Hair)
        const solT = (elapsed - tSettleEnd) / cfg.solidifyDuration;
        const easeProg = solT < 0.5 ? 2 * solT * solT : 1 - Math.pow(-2 * solT + 2, 2) / 2;

        const currentY = cfg.minY + easeProg * (cfg.maxY - cfg.minY);
        solidifyUniforms.uSolidifyY.value = currentY;

        for (let i = 0; i < count; i++) {
          const p = particleData[i];
          const i3 = i * 3;
          const pY = p.targetY;

          positions[i3] = p.targetX;
          positions[i3 + 1] = p.targetY;
          positions[i3 + 2] = p.targetZ;

          if (pY > currentY) {
            // Unsolidified region above wavefront: fully visible
            colors[i3] = p.baseR;
            colors[i3 + 1] = p.baseG;
            colors[i3 + 2] = p.baseB;
          } else {
            // Solidified region: smooth fade into the solid mesh
            const distPastCut = currentY - pY;
            const fade = Math.max(0, 1.0 - distPastCut / (cfg.transitionBand * 2.2));
            colors[i3] = p.baseR * fade;
            colors[i3 + 1] = p.baseG * fade;
            colors[i3 + 2] = p.baseB * fade;
          }
        }

        particleMaterial.opacity = 0.98;
        characterGroup.position.y = 0;
      } else if (elapsed < tFullySolidEnd) {
        // Solid character fully formed with finishing rim pulse
        solidifyUniforms.uSolidifyY.value = cfg.maxY + 0.5;
        particleMaterial.opacity = Math.max(0, 1.0 - (elapsed - tSolidifyEnd) / cfg.fullySolidDuration);
        characterGroup.position.y = 0;
      } else {
        // IDLE: High-quality solid character stably anchored to the bottom edge (no floating/bobbing)
        solidifyUniforms.uSolidifyY.value = cfg.maxY + 1.0;
        particleMaterial.opacity = 0.0;
        characterGroup.position.y = 0;
        characterGroup.rotation.y = 0;
      }

      particleGeometry.attributes.position.needsUpdate = true;
      particleGeometry.attributes.color.needsUpdate = true;

      try {
        renderer.render(scene, camera);
      } catch (renderErr) {
        console.error('[PersonaHumanoidCanvas] WebGL render error:', renderErr);
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

      // Dispose particle resources
      particleGeometry.dispose();
      particleMaterial.dispose();
      particleTexture.dispose();
      // Dispose loaded GLB model resources if present
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
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none'
      }}
    >
      <canvas
        ref={canvasRef}
        className="persona-humanoid-canvas"
        style={{
          width: '100%',
          height: '100%',
          display: 'block'
        }}
      />
    </div>
  );
};
