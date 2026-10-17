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
import {
  PersonaExpressionController,
  type PersonaExpression
} from './personaExpressionController';
import {
  PersonaLifeController,
  type LifeFrameOutput
} from './personaLifeController';

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
  desktopCount: 5200,
  tabletCount: 3200,
  mobileCount: 1600,
  reducedMotionCount: 800,
  baseParticleSize: 0.0125, // Crisp, refined projected point size for 5,200 points at camera z=1.48
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
  transitionBand: 0.035,
  particleCount: 5200
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
      uGlowColor: { value: new THREE.Color('#00E575') },
      uGlowIntensity: { value: 0.40 }
    };

    let loadedSolidModel: THREE.Object3D | null = null;
    let leftEyeBone: THREE.Bone | null = null;
    let rightEyeBone: THREE.Bone | null = null;
    let headBone: THREE.Bone | null = null;
    let neckBone: THREE.Bone | null = null;
    let spine2Bone: THREE.Bone | null = null;
    let rightShoulderBone: THREE.Bone | null = null;
    let leftShoulderBone: THREE.Bone | null = null;
    let headMesh: THREE.Mesh | null = null;
    let teethDownMesh: THREE.Mesh | null = null;

    // Optional URL query parameters for deterministic testing & development
    const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const forcedTimeParam = searchParams?.get('t');
    const forcedElapsed = forcedTimeParam !== null && forcedTimeParam !== undefined ? parseFloat(forcedTimeParam) : null;
    const forcedExprParam = searchParams?.get('expr') as PersonaExpression | null;
    const validExprs: PersonaExpression[] = ['neutral', 'happy', 'sad', 'angry', 'surprised', 'thinking', 'worried'];

    // Centralized Facial Expression Controller (Sections 3, 4, 5, 6)
    const expressionController = new PersonaExpressionController({
      forcedExpression: forcedExprParam && validExprs.includes(forcedExprParam) ? forcedExprParam : null,
      reducedMotion: prefersReducedMotion
    });

    const forcedGazeXParam = searchParams?.get('gazeX');
    const forcedGazeYParam = searchParams?.get('gazeY');

    // Centralized Natural Life Controller (Idle Gaze, Breathing, Head Orientation, Posture)
    const lifeController = new PersonaLifeController({
      prefersReducedMotion,
      forcedGazeX: forcedGazeXParam !== null && !isNaN(parseFloat(forcedGazeXParam)) ? parseFloat(forcedGazeXParam) : null,
      forcedGazeY: forcedGazeYParam !== null && !isNaN(parseFloat(forcedGazeYParam)) ? parseFloat(forcedGazeYParam) : null
    });

    const gltfLoader = new GLTFLoader();
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);

    const modelParam = searchParams?.get('model');
    // Reliable rollback option to original grey polo outfit:
    const ROLLBACK_MODEL_URL = '/models/human_persona.glb';
    const DEFAULT_MODEL_URL = '/models/human_persona_casual.glb';
    const modelUrl = modelParam === 'polo' ? ROLLBACK_MODEL_URL : (modelParam ? `/models/${modelParam}` : DEFAULT_MODEL_URL);

    gltfLoader.load(
      modelUrl,
      (gltf) => {
        if (isDisposed) return;
        console.log('[PersonaHumanoidCanvas] Successfully loaded GLTF model:', modelUrl);
        const model = gltf.scene;
        model.name = 'solid-humanoid-character';

        // Relax arms naturally beside the torso
        const leftArm = model.getObjectByName('LeftArm');
        const rightArm = model.getObjectByName('RightArm');
        if (leftArm) leftArm.rotation.set(1.20, 0.0, 0.0);
        if (rightArm) rightArm.rotation.set(1.80, 1.40, -0.60);

        // Cache eye bones, record rest quaternions, and enlarge eye scale by 8% (Section 2)
        leftEyeBone = model.getObjectByName('LeftEye') as THREE.Bone | null;
        rightEyeBone = model.getObjectByName('RightEye') as THREE.Bone | null;
        if (leftEyeBone) {
          leftEyeBone.userData.restQuat = leftEyeBone.quaternion.clone();
          leftEyeBone.scale.setScalar(1.08);
        }
        if (rightEyeBone) {
          rightEyeBone.userData.restQuat = rightEyeBone.quaternion.clone();
          rightEyeBone.scale.setScalar(1.08);
        }

        // Cache head, neck, spine2, and shoulder bones with rest quaternions & positions
        headBone = model.getObjectByName('Head') as THREE.Bone | null;
        neckBone = model.getObjectByName('Neck') as THREE.Bone | null;
        spine2Bone = model.getObjectByName('Spine2') as THREE.Bone | null;
        rightShoulderBone = model.getObjectByName('RightShoulder') as THREE.Bone | null;
        leftShoulderBone = model.getObjectByName('LeftShoulder') as THREE.Bone | null;

        [headBone, neckBone, spine2Bone, rightShoulderBone, leftShoulderBone].forEach((bone) => {
          if (bone) {
            bone.userData.restQuat = bone.quaternion.clone();
            bone.userData.restPos = bone.position.clone();
          }
        });

        // Configure facial expressiveness via anatomical morph targets (Sections 2, 5, 6)
        headMesh = model.getObjectByName('H_DDS_HighRes') as THREE.Mesh | null;
        teethDownMesh = model.getObjectByName('h_TeethDown') as THREE.Mesh | null;
        const teethUp = model.getObjectByName('h_TeethUp') as THREE.Mesh | null;
        const leftEyeMesh = model.getObjectByName('h_L_eye') as THREE.Mesh | null;
        const rightEyeMesh = model.getObjectByName('h_R_eye') as THREE.Mesh | null;

        // Apply initial baseline expression
        expressionController.applyToMeshes(headMesh, teethDownMesh);

        if (typeof window !== 'undefined') {
          (window as any).__personaDebug = {
            headMesh,
            teethDownMesh,
            expressionController,
            lifeController,
            model,
            bones: {
              head: headBone,
              neck: neckBone,
              spine2: spine2Bone,
              rightShoulder: rightShoulderBone,
              leftShoulder: leftShoulderBone,
              leftEye: leftEyeBone,
              rightEye: rightEyeBone
            }
          };
        }

        // Custom Teeth Material: Natural ivory color with realistic dental roughness (Section 5)
        [teethDownMesh, teethUp].forEach((mesh) => {
          if (mesh && mesh.material) {
            const origMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
            const teethMat = origMat.clone();
            teethMat.userData = teethMat.userData || {};
            teethMat.userData.customRoughness = true;
            teethMat.userData.customMetalness = true;
            teethMat.roughness = 0.30;
            teethMat.metalness = 0.0;
            teethMat.color = new THREE.Color('#FAF7F0');
            teethMat.onBeforeCompile = (shader) => {
              shader.fragmentShader = shader.fragmentShader.replace(
                '#include <dithering_fragment>',
                `#include <dithering_fragment>
                // Natural ivory tooth enamel: clamp excess green illumination from rear rim light
                gl_FragColor.g = min(gl_FragColor.g, max(gl_FragColor.r, gl_FragColor.b));
                `
              );
            };
            mesh.material = teethMat;
          }
        });

        // Custom Eyeball Material: High corneal specular glint + distinct iris & pupil definition (Section 3)
        [leftEyeMesh, rightEyeMesh].forEach((mesh) => {
          if (mesh && mesh.material) {
            const origMat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
            const eyeMat = origMat.clone();
            eyeMat.userData = eyeMat.userData || {};
            eyeMat.userData.customRoughness = true;
            eyeMat.userData.customMetalness = true;
            eyeMat.roughness = 0.10;
            eyeMat.metalness = 0.0;
            eyeMat.onBeforeCompile = (shader) => {
              shader.fragmentShader = shader.fragmentShader.replace(
                '#include <map_fragment>',
                `#include <map_fragment>
                // Enhanced Iris & Pupil Definition (Section 3)
                float eyeLum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
                if (eyeLum > 0.02 && eyeLum < 0.35) {
                  // Warm amber-brown iris structure clearly distinct from central pupil
                  vec3 irisWarmth = vec3(0.38, 0.22, 0.12);
                  diffuseColor.rgb = mix(diffuseColor.rgb * 1.6 + irisWarmth * 0.45, diffuseColor.rgb, smoothstep(0.02, 0.06, eyeLum) * (1.0 - smoothstep(0.18, 0.35, eyeLum)));
                } else if (eyeLum <= 0.02) {
                  // Distinct deep black pupil center
                  diffuseColor.rgb = vec3(0.015, 0.015, 0.018);
                } else {
                  // Sclera: clean natural off-white with delicate ocular tone
                  diffuseColor.rgb = clamp(diffuseColor.rgb * 1.08, 0.0, 1.0);
                }
                `
              );
            };
            mesh.material = eyeMat;
          }
        });

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
        if (import.meta.env.DEV) {
          (window as any).__personaModel = model;
          (window as any).THREE = THREE;
        }
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

    // Key directional light vector for 3D normal shading (front-fill key)
    const lx = 0.22, ly = 0.35, lz = 0.90;

    for (let i = 0; i < particleCount; i++) {
      // Precise target sampling across GLB surface via uniform stride
      const targetIdx = Math.floor((i * numSource) / particleCount);
      const target: PrecomputedSurfacePoint = sourcePoints[targetIdx];

      // 3D Lighting & Normal Grading
      const nDotL = Math.max(0.0, target.nx * lx + target.ny * ly + target.nz * lz);
      const facing = Math.max(0.0, target.nz);
      const diff = 0.75 + 0.25 * nDotL;
      const lum = target.lum ?? 0.50;
      const cat = target.category || 'base_surface';
      const subCat = target.subCategory || cat;

      // Anatomical feature zones
      const isEyeball =
        (target.category && target.category.includes('eye')) ||
        (target.z > 0.076 &&
          Math.abs(target.x) >= 0.016 &&
          Math.abs(target.x) <= 0.052 &&
          target.y >= 0.072 &&
          target.y <= 0.16);

      const isCheekOrFace =
        (target.category && (target.category.includes('cheeks') || target.category.includes('nose') || target.category.includes('lips') || target.category.includes('forehead') || target.category.includes('eyebrow'))) ||
        (target.z > 0.045 &&
          target.y >= -0.04 &&
          target.y <= 0.16 &&
          Math.abs(target.x) < 0.09);

      const isTopCrown = target.y > 0.16;
      const isNeckOrJaw =
        (target.category && (target.category.includes('chin') || target.category.includes('jaw'))) ||
        (target.y >= -0.09 && target.y < 0.01);
      const isChestOrShoulder = target.y < -0.09;

      let targetR = 0.36 * diff;
      let targetG = 0.90 * diff;
      let targetB = 0.07;
      let baseScale = 0.95;

      if (subCat === 'hair' || cat === 'hair') {
        // Authentic Asian male dark hair volume & silhouette
        targetR = 0.16 * diff * (0.60 + 0.40 * lum);
        targetG = 0.52 * diff * (0.60 + 0.40 * lum);
        targetB = 0.08;
        baseScale = 0.95;
      } else if (subCat === 'forehead' || cat === 'forehead') {
        // Smooth frontal bone plane
        targetR = 0.36 * diff;
        targetG = 0.90 * diff;
        targetB = 0.07;
        baseScale = 0.92;
      } else if (subCat.includes('eyebrow') || cat.includes('eyebrow')) {
        // Defined masculine brow arches matching texture pigment
        targetR = 0.18 * (0.50 + 0.50 * lum);
        targetG = 0.58 * (0.50 + 0.50 * lum);
        targetB = 0.07;
        baseScale = 0.88;
      } else if (subCat.includes('pupil')) {
        // Center dark pupil & iris: provides crisp gaze contrast
        targetR = 0.05;
        targetG = 0.24;
        targetB = 0.04;
        baseScale = 0.78;
      } else if (subCat.includes('sclera')) {
        // White sclera & corneal reflection glint
        targetR = 0.50 * diff;
        targetG = 1.00 * diff;
        targetB = 0.15;
        baseScale = 0.94;
      } else if (subCat.includes('eye_lid')) {
        // Eyelid contour & palpebral margin separating eye from cheek
        targetR = 0.28 * diff;
        targetG = 0.75 * diff;
        targetB = 0.07;
        baseScale = 0.82;
      } else if (subCat === 'nose_tip') {
        // Protruding nose tip highlight (maximum Z forward)
        targetR = 0.48 * diff;
        targetG = 1.00 * diff;
        targetB = 0.10;
        baseScale = 1.08;
      } else if (subCat === 'nose_bridge') {
        // Dorsal nasal ridge
        targetR = 0.44 * diff;
        targetG = 0.96 * diff;
        targetB = 0.08;
        baseScale = 1.02;
      } else if (subCat === 'nose_wings') {
        // Lateral alar wing slope (creates sharp plane boundary from cheek)
        targetR = 0.26 * diff;
        targetG = 0.72 * diff;
        targetB = 0.06;
        baseScale = 0.82;
      } else if (subCat === 'nose_nostrils') {
        // Dark nostril cavity depth
        targetR = 0.10;
        targetG = 0.32;
        targetB = 0.04;
        baseScale = 0.70;
      } else if (subCat === 'philtrum') {
        // Anatomical groove separating nose base from upper lip
        targetR = 0.28 * diff;
        targetG = 0.76 * diff;
        targetB = 0.07;
        baseScale = 0.82;
      } else if (subCat === 'upper_lip') {
        // Cupid's bow & upper vermilion lip
        targetR = 0.46 * diff;
        targetG = 0.82 * diff;
        targetB = 0.10;
        baseScale = 0.92;
      } else if (subCat === 'mouth_line') {
        // Dark horizontal lip slit / mouth line (crisp upper-to-lower separation)
        targetR = 0.08;
        targetG = 0.28;
        targetB = 0.04;
        baseScale = 0.68;
      } else if (subCat.includes('teeth') || cat.includes('teeth')) {
        // Natural ivory teeth row visible inside parted mouth (Section 7)
        targetR = 0.85 * diff;
        targetG = 0.98 * diff;
        targetB = 0.70 * diff;
        baseScale = 0.82;
      } else if (subCat === 'lower_lip') {
        // Full lower vermilion lip highlight
        targetR = 0.45 * diff;
        targetG = 0.84 * diff;
        targetB = 0.10;
        baseScale = 0.94;
      } else if (subCat === 'chin' || cat === 'chin') {
        // Labiomental groove indent vs rounded chin pad
        const isCrease = target.y >= 0.024 && target.y <= 0.030;
        if (isCrease) {
          targetR = 0.24 * diff;
          targetG = 0.68 * diff;
          targetB = 0.06;
          baseScale = 0.80;
        } else {
          targetR = 0.36 * diff;
          targetG = 0.88 * diff;
          targetB = 0.07;
          baseScale = 0.94;
        }
      } else if (subCat === 'jaw' || cat === 'jaw') {
        // Mandibular contour curving to ears
        targetR = 0.30 * diff;
        targetG = 0.80 * diff;
        targetB = 0.07;
        baseScale = 0.92;
      } else if (subCat === 'cheeks' || cat === 'cheeks') {
        // Smooth midface and zygomatic planes (softer so nose & eyes read distinctly)
        targetR = 0.30 * diff;
        targetG = 0.78 * diff;
        targetB = 0.07;
        baseScale = 0.86;
      } else if (cat.includes('ear')) {
        // Left & right ears
        targetR = 0.32 * diff;
        targetG = 0.84 * diff;
        targetB = 0.07;
        baseScale = 0.92;
      } else if (cat === 'neck') {
        // Cervical column connecting head to torso
        targetR = 0.30 * diff;
        targetG = 0.82 * diff;
        targetB = 0.08;
        baseScale = 0.96;
      } else if (cat === 'upper_chest' || cat === 'shoulders') {
        // Polo shirt torso and deltoids
        targetR = 0.28 * diff * (0.80 + 0.20 * lum);
        targetG = 0.78 * diff * (0.80 + 0.20 * lum);
        targetB = 0.09;
        baseScale = 1.00;
      } else if (cat === 'upper_arms') {
        // Relaxed arms
        targetR = 0.30 * diff;
        targetG = 0.80 * diff;
        targetB = 0.09;
        baseScale = 1.00;
      }

      // Depth falloff for grazing angles (enhances 3D roundness and volumetric form)
      if (facing < 0.30) {
        targetR *= 0.88;
        targetG *= 0.90;
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
        `gl_PointSize = size * pSize;
        if (pSize <= 0.001) {
          gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
        }`
      );
    };
    particleMaterial.customProgramCacheKey = () => 'persona-independent-humanoid-v3';

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

    // Development Comparison Mode support (Section 8):
    // A. SOLID MODEL ONLY (?debugMode=solid, or Key '1')
    // B. PARTICLE REPRESENTATION ONLY (?debugMode=particles, or Key '2')
    // C. SOLID MODEL AND PARTICLES OVERLAID (?debugMode=overlay, or Key '3')
    const debugModeParam = searchParams?.get('debugMode');
    let comparisonMode: 'default' | 'solid' | 'particles' | 'overlay' =
      debugModeParam === 'solid' ? 'solid'
      : debugModeParam === 'overlay' ? 'overlay'
      : debugModeParam === 'particles' ? 'particles'
      : 'default';

    const handleDevKeyDown = (e: KeyboardEvent) => {
      if (import.meta.env.DEV) {
        if (e.key === '1') {
          comparisonMode = 'solid';
        } else if (e.key === '2') {
          comparisonMode = 'particles';
        } else if (e.key === '3') {
          comparisonMode = 'overlay';
        } else if (e.key === '0' || e.key === 'Escape') {
          comparisonMode = 'default';
        }
      }
    };
    window.addEventListener('keydown', handleDevKeyDown);

    // Check if initial mount is already in settled/inspection state
    let isInstantSettled = personaTransitionController.state === 'PERSONA_READY' || prefersReducedMotion;

    // ----------------------------------------------------
    // Natural 3D Eye Tracking & Ocular Life Dynamics
    // ----------------------------------------------------
    let prevPointerNDC = { x: 0, y: 0 };
    let lastPointerMoveTime = performance.now();
    let clickEngagement = 0;

    const handlePointerMove = (e: PointerEvent) => {
      if (prefersReducedMotion) return;
      const x = (e.clientX / (window.innerWidth || 1200)) * 2 - 1;
      const y = -((e.clientY / (window.innerHeight || 900)) * 2 - 1);
      const clampedX = Math.max(-1, Math.min(1, x));
      const clampedY = Math.max(-1, Math.min(1, y));

      // Saccade detection: rapid cursor leaps trigger a subtle reflexive micro-blink
      const dx = clampedX - prevPointerNDC.x;
      const dy = clampedY - prevPointerNDC.y;
      const saccadeDist = Math.sqrt(dx * dx + dy * dy);
      const now = performance.now();
      if (saccadeDist > 0.65 && now - lastPointerMoveTime < 180) {
        lifeController.triggerBlink(0.14);
      }
      prevPointerNDC.x = clampedX;
      prevPointerNDC.y = clampedY;
      lastPointerMoveTime = now;

      lifeController.onPointerMove(clampedX, clampedY, now);
    };

    const handlePointerDown = () => {
      if (prefersReducedMotion) return;
      clickEngagement = 1.0;
      lifeController.onPointerDown();
    };

    const handlePointerLeave = () => {
      lifeController.onPointerLeave();
    };

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        lastFrameTime = performance.now();
      }
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: true });
    window.addEventListener('pointerleave', handlePointerLeave, { passive: true });
    window.addEventListener('pointerdown', handlePointerDown, { passive: true });
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    const vRestForward = new THREE.Vector3(0, 0, 1);
    const eyeWorldPos = new THREE.Vector3();
    const parentWorldQuat = new THREE.Quaternion();
    const desiredGazeDir = new THREE.Vector3();
    const deltaGazeQuat = new THREE.Quaternion();
    const localDeltaQuat = new THREE.Quaternion();
    const gazeTargetPos = new THREE.Vector3();

    const _tempParentQuat = new THREE.Quaternion();
    const _tempLocalDelta = new THREE.Quaternion();
    const _tempEuler = new THREE.Euler(0, 0, 0, 'YXZ');
    const _tempDeltaQuat = new THREE.Quaternion();

    /**
     * Apply a conjugate world-space delta rotation to any rig bone.
     * Prevents gimbal lock and works independently of local bone bind axes.
     */
    const applyWorldRotationOffset = (
      bone: THREE.Bone | null,
      pitch: number, // pitch (nod) around world X
      yaw: number,   // yaw (turn) around world Y
      roll: number   // roll (tilt) around world Z
    ) => {
      if (!bone || !bone.parent || !bone.userData.restQuat) return;
      _tempEuler.set(pitch, yaw, roll, 'YXZ');
      _tempDeltaQuat.setFromEuler(_tempEuler);

      bone.parent.getWorldQuaternion(_tempParentQuat);
      _tempLocalDelta.copy(_tempParentQuat).invert().multiply(_tempDeltaQuat).multiply(_tempParentQuat);
      bone.quaternion.copy(_tempLocalDelta).multiply(bone.userData.restQuat);
      bone.updateMatrixWorld(true);
    };

    const updateEyeGaze = (eyeBone: THREE.Bone | null, targetPos: THREE.Vector3) => {
      if (!eyeBone || !eyeBone.parent || !eyeBone.userData.restQuat) return;

      eyeBone.getWorldPosition(eyeWorldPos);
      desiredGazeDir.subVectors(targetPos, eyeWorldPos).normalize();

      deltaGazeQuat.setFromUnitVectors(vRestForward, desiredGazeDir);

      eyeBone.parent.getWorldQuaternion(parentWorldQuat);
      localDeltaQuat.copy(parentWorldQuat).invert().multiply(deltaGazeQuat).multiply(parentWorldQuat);

      eyeBone.quaternion.copy(localDeltaQuat).multiply(eyeBone.userData.restQuat);
      eyeBone.updateMatrixWorld(true);
    };

    const updateEyeTracking = (dt: number, nowMs: number) => {
      if (!leftEyeBone || !rightEyeBone) return;

      if (clickEngagement > 0) {
        clickEngagement = Math.max(0, clickEngagement - dt * 2.5);
      }

      // 1. Advance Life Controller (coordinated gaze, breathing, head tilt, posture, blinking)
      const currentExpr = expressionController.getCurrentExpression();
      const lifeOutput = lifeController.update(dt, nowMs, currentExpr);

      // 2. Map 3D Gaze Target (Z = 1.48 at camera focal plane)
      // Horizontal span: 0.52 world units (~21 deg, rich widescreen tracking)
      // Vertical span: 0.26 world units (~11 deg, natural gaze arc)
      gazeTargetPos.set(
        lifeOutput.gazeNDC.x * 0.52,
        0.121 + lifeOutput.gazeNDC.y * 0.26,
        1.48
      );

      updateEyeGaze(leftEyeBone, gazeTargetPos);
      updateEyeGaze(rightEyeBone, gazeTargetPos);

      // 3. Gentle Upper Body Breathing & Micro-Posture
      if (!prefersReducedMotion) {
        // Upper Spine / Chest (Spine2)
        applyWorldRotationOffset(
          spine2Bone,
          lifeOutput.spine2Euler.pitch,
          lifeOutput.spine2Euler.yaw,
          lifeOutput.spine2Euler.roll
        );
        if (spine2Bone && spine2Bone.userData.restPos) {
          spine2Bone.position.set(
            spine2Bone.userData.restPos.x + lifeOutput.spine2PositionOffset.x,
            spine2Bone.userData.restPos.y + lifeOutput.spine2PositionOffset.y,
            spine2Bone.userData.restPos.z + lifeOutput.spine2PositionOffset.z
          );
        }

        // Shoulders: subtle vertical breathing lift & micro-posture
        if (rightShoulderBone && rightShoulderBone.userData.restPos) {
          rightShoulderBone.position.y = rightShoulderBone.userData.restPos.y + lifeOutput.shoulderLift;
        }
        if (leftShoulderBone && leftShoulderBone.userData.restPos) {
          leftShoulderBone.position.y = leftShoulderBone.userData.restPos.y + lifeOutput.shoulderLift;
        }

        // Neck & Head: subtle orienting, organic micro-drift, and expression-specific tilt
        applyWorldRotationOffset(
          neckBone,
          lifeOutput.neckEuler.pitch,
          lifeOutput.neckEuler.yaw,
          lifeOutput.neckEuler.roll
        );
        applyWorldRotationOffset(
          headBone,
          lifeOutput.headEuler.pitch,
          lifeOutput.headEuler.yaw,
          lifeOutput.headEuler.roll
        );
      }

      // 5. Update Expression Controller & Coordinate Eyelids, Blinking, and Jaw (Sections 3, 4, 5, 6, 7)
      const debugOverride = typeof window !== 'undefined' ? (window as any).__personaDebug?.overrideWeights : null;
      if (debugOverride) {
        if (headMesh && headMesh.morphTargetInfluences) {
          headMesh.morphTargetInfluences.fill(0);
          for (const [k, v] of Object.entries(debugOverride.head || {})) {
            headMesh.morphTargetInfluences[Number(k)] = v as number;
          }
        }
        if (teethDownMesh && teethDownMesh.morphTargetInfluences) {
          teethDownMesh.morphTargetInfluences.fill(0);
          for (const [k, v] of Object.entries(debugOverride.teethDown || {})) {
            teethDownMesh.morphTargetInfluences[Number(k)] = v as number;
          }
        }
      } else {
        expressionController.update(dt);
        expressionController.applyToMeshes(headMesh, teethDownMesh, {
          blinkFactor: lifeOutput.blinkFactor,
          gazeNormY: lifeOutput.gazeNDC.y,
          clickEngagement,
          eyeOpenBonus: lifeOutput.eyeOpenBonus,
          squintBonus: lifeOutput.squintBonus
        });
      }
    };

    let lastFrameTime = performance.now();

    const render = (now: number) => {
      if (isDisposed) return;

      // Pause or throttle rendering when page is hidden in background tab (Objective 6)
      if (typeof document !== 'undefined' && document.hidden) {
        lastFrameTime = now;
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      const dt = Math.min(0.1, (now - lastFrameTime) * 0.001);
      lastFrameTime = now;

      const elapsed = forcedElapsed !== null && !isNaN(forcedElapsed)
        ? forcedElapsed
        : isInstantSettled
        ? 5.0
        : (now - transitionStart) * 0.001;

      // Development Comparison Mode rendering (Section 8)
      if (comparisonMode !== 'default') {
        const posAttr = particleGeometry.attributes.position;
        const colAttr = particleGeometry.attributes.color;
        const sizesAttr = particleGeometry.attributes.pSize;

        for (let i = 0; i < particleCount; i++) {
          const p = particles[i];
          posAttr.setXYZ(i, p.targetX, p.targetY, p.targetZ);
          colAttr.setXYZ(i, p.targetR, p.targetG, p.targetB);
          sizesAttr.setX(i, p.baseScale);
        }
        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        sizesAttr.needsUpdate = true;

        if (comparisonMode === 'solid') {
          if (loadedSolidModel) {
            loadedSolidModel.visible = true;
            updateEyeTracking(dt, now);
          }
          solidifyUniforms.uSolidifyY.value = 10.0;
          solidifyUniforms.uGlowIntensity.value = 0.0;
          particleSystem.visible = false;
        } else if (comparisonMode === 'particles') {
          if (loadedSolidModel) loadedSolidModel.visible = false;
          particleSystem.visible = true;
          particleMaterial.opacity = 0.98;
        } else if (comparisonMode === 'overlay') {
          if (loadedSolidModel) {
            loadedSolidModel.visible = true;
            updateEyeTracking(dt, now);
          }
          solidifyUniforms.uSolidifyY.value = 10.0;
          solidifyUniforms.uGlowIntensity.value = 0.0;
          particleSystem.visible = true;
          particleMaterial.opacity = 0.95;
        }

        renderer.render(scene, camera);
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      // Determine animation state
      let newState: PersonaAnimationState = 'FORMING_HUMANOID';
      if (prefersReducedMotion || isInstantSettled || elapsed >= 4.50) {
        newState = 'IDLE';
      } else if (elapsed < 0.25) {
        newState = 'INITIALIZING';
      } else if (elapsed < 1.80) {
        newState = 'FORMING_HUMANOID';
      } else if (elapsed < 2.55) {
        newState = 'HUMANOID_SETTLING';
      } else if (elapsed < 4.15) {
        newState = 'PARTIAL_SOLIDIFICATION';
      } else {
        newState = 'FULLY_SOLID';
      }

      if (newState !== currentStateRef.current) {
        setCurrentState(newState);
      }

      const posAttr = particleGeometry.attributes.position;
      const colAttr = particleGeometry.attributes.color;
      const sizesAttr = particleGeometry.attributes.pSize;

      // ----------------------------------------------------
      // STAGE E: Persona READY (Final Solid Character Settled)
      // ----------------------------------------------------
      if (isInstantSettled || elapsed >= 4.50) {
        if (loadedSolidModel) {
          loadedSolidModel.visible = true;
          // Apply Natural 3D Eye Tracking (Section 2, 3, 4, 5)
          updateEyeTracking(dt, now);
        }
        solidifyUniforms.uSolidifyY.value = 10.0;
        solidifyUniforms.uGlowIntensity.value = 0.0;
        particleSystem.visible = false;

        if (!isInstantSettled && elapsed >= 4.50) {
          isInstantSettled = true;
          personaTransitionController.completeHumanFormed();
          personaTransitionController.setPersonaReady();
        }

        renderer.render(scene, camera);
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      // During active reconstruction wave, eyes and upper body remain anchored in neutral forward rest pose
      [headBone, neckBone, spine2Bone, rightShoulderBone, leftShoulderBone, leftEyeBone, rightEyeBone].forEach((bone) => {
        if (bone && bone.userData.restQuat) {
          bone.quaternion.copy(bone.userData.restQuat);
        }
        if (bone && bone.userData.restPos) {
          bone.position.copy(bone.userData.restPos);
        }
      });
      // Keep expression in baseline neutral during wave formation
      expressionController.applyToMeshes(headMesh, teethDownMesh, {
        blinkFactor: 0,
        gazeNormY: 0
      });

      // ----------------------------------------------------
      // STAGE D: Final Convergence (4.15s -> 4.50s)
      // ----------------------------------------------------
      if (elapsed >= 4.15) {
        if (loadedSolidModel) {
          loadedSolidModel.visible = true;
        }
        solidifyUniforms.uSolidifyY.value = cfg.maxY + 0.20;
        const stageDProg = Math.min(1.0, (elapsed - 4.15) / 0.35);
        solidifyUniforms.uGlowIntensity.value = 0.40 * (1.0 - stageDProg);
        particleMaterial.opacity = 0.98 * (1.0 - stageDProg);

        for (let i = 0; i < particleCount; i++) {
          sizesAttr.setX(i, 0.0);
          colAttr.setXYZ(i, 0.0, 0.0, 0.0);
          posAttr.setXYZ(i, 0.0, -10.0, 0.0);
        }

        posAttr.needsUpdate = true;
        sizesAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        renderer.render(scene, camera);
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      // ----------------------------------------------------
      // STAGES B & C: Bottom-Up Reconstruction Wave (2.55s -> 4.15s)
      // ----------------------------------------------------
      if (elapsed >= 2.55) {
        if (loadedSolidModel) {
          loadedSolidModel.visible = true;
        }

        const waveElapsed = elapsed - 2.55;
        const rawWaveProg = Math.min(1.0, waveElapsed / 1.60);
        // Smooth cubic ease-in-out for cinematic acceleration and deceleration
        const easeProg = rawWaveProg * rawWaveProg * (3.0 - 2.0 * rawWaveProg);
        const currentY = cfg.minY + easeProg * (cfg.maxY - cfg.minY);

        solidifyUniforms.uSolidifyY.value = currentY;
        solidifyUniforms.uGlowIntensity.value = 0.40;
        solidifyUniforms.uTransitionBand.value = cfg.transitionBand;
        particleMaterial.opacity = 0.98;

        for (let i = 0; i < particleCount; i++) {
          const p = particles[i];
          // Surface-hugging anatomical reveal coordinate identical to vertex shader
          const lateralArmOffset = Math.max(0.0, Math.abs(p.targetX) - 0.14);
          const pReveal = p.targetY + 0.028 * p.targetZ - 0.055 * lateralArmOffset;
          const distFromWave = pReveal - currentY;

          if (distFromWave > cfg.transitionBand) {
            // Unsolidified region above advancing wave: full particle presence
            posAttr.setXYZ(i, p.targetX, p.targetY, p.targetZ);
            sizesAttr.setX(i, p.baseScale);
            colAttr.setXYZ(i, p.targetR, p.targetG, p.targetB);
          } else if (distFromWave < 0.0) {
            // Solidified region below active wave: dissolved cleanly offscreen
            posAttr.setXYZ(i, 0.0, -10.0, 0.0);
            sizesAttr.setX(i, 0.0);
            colAttr.setXYZ(i, 0.0, 0.0, 0.0);
          } else {
            // Transition band (0.0 <= distFromWave <= cfg.transitionBand):
            // Smooth handoff as solid surface condenses, with restrained subtle edge sparks
            const norm = distFromWave / cfg.transitionBand; // 0.0 at solid boundary, 1.0 at particle boundary

            // Short-lived restrained reconstruction sparks (Section 4C)
            const isSpark = (i % 6 === 0);
            const sparkBoost = isSpark ? (1.0 - Math.abs(norm - 0.5) * 2.0) * 0.18 : 0.0;

            // Refined GraphMind emerald green transition (no yellowing)
            const edgeR = THREE.MathUtils.lerp(0.05, p.targetR, norm);
            const edgeG = Math.min(1.0, THREE.MathUtils.lerp(0.92, p.targetG, norm) + sparkBoost);
            const edgeB = THREE.MathUtils.lerp(0.35, p.targetB, norm);

            // Particles scale down smoothly as solid surface takes over
            const scale = p.baseScale * (0.15 + 0.85 * norm) * (1.0 + sparkBoost * 0.20);

            posAttr.setXYZ(i, p.targetX, p.targetY, p.targetZ);
            colAttr.setXYZ(i, edgeR, edgeG, edgeB);
            sizesAttr.setX(i, scale);
          }
        }

        posAttr.needsUpdate = true;
        colAttr.needsUpdate = true;
        sizesAttr.needsUpdate = true;

        renderer.render(scene, camera);
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      // ----------------------------------------------------
      // STAGE A: Particle Stabilization (2.20s -> 2.55s)
      // ----------------------------------------------------
      if (elapsed >= 2.20) {
        solidifyUniforms.uSolidifyY.value = cfg.minY - 1.0;
        if (loadedSolidModel) {
          loadedSolidModel.visible = false;
        }

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

        renderer.render(scene, camera);
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      // ----------------------------------------------------
      // PHASES A, B, C: Independent Persona Reveal (0.00s -> 2.20s)
      // ----------------------------------------------------
      solidifyUniforms.uSolidifyY.value = cfg.minY - 1.0;
      if (loadedSolidModel) {
        loadedSolidModel.visible = false;
      }

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
      window.removeEventListener('keydown', handleDevKeyDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerleave', handlePointerLeave);
      window.removeEventListener('pointerdown', handlePointerDown);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }

      [headBone, neckBone, spine2Bone, rightShoulderBone, leftShoulderBone, leftEyeBone, rightEyeBone].forEach((bone) => {
        if (bone && bone.userData.restQuat) {
          bone.quaternion.copy(bone.userData.restQuat);
        }
        if (bone && bone.userData.restPos) {
          bone.position.copy(bone.userData.restPos);
        }
      });

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
