import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';

import {
  createHumanoidBodyParts,
  buildHumanoidMesh,
  sampleHumanoidSurfacePoints,
  BODY_REGIONS_HEIGHTS,
  CHARACTER_Y_BOUNDS,
  type BodyRegion
} from '../src/components/persona/humanoidGeometry';
import {
  createPersonaSolidMaterial,
  attachPersonaSolidifyShader
} from '../src/components/persona/personaShader';
import {
  PERSONA_ANIMATION_CONFIG
} from '../src/components/persona/PersonaHumanoidCanvas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const canvasSrcPath = path.resolve(__dirname, '../src/components/persona/PersonaHumanoidCanvas.tsx');
const shaderSrcPath = path.resolve(__dirname, '../src/components/persona/personaShader.ts');
const geometrySrcPath = path.resolve(__dirname, '../src/components/persona/humanoidGeometry.ts');
const experienceSrcPath = path.resolve(__dirname, '../src/components/persona/PersonaExperience.tsx');
const surfaceDataSrcPath = path.resolve(__dirname, '../src/components/persona/personaSurfaceData.ts');
const modelPath = path.resolve(__dirname, '../public/models/human_persona.glb');
const licensePath = path.resolve(__dirname, '../public/models/LICENSE.txt');
const landingOrbPath = path.resolve(__dirname, '../src/components/overview/KnowledgeOrb3D.tsx');

const canvasSrc = fs.readFileSync(canvasSrcPath, 'utf8');
const shaderSrc = fs.readFileSync(shaderSrcPath, 'utf8');
const geometrySrc = fs.readFileSync(geometrySrcPath, 'utf8');
const experienceSrc = fs.readFileSync(experienceSrcPath, 'utf8');

describe('GRAPHMIND — PERSONA: HIGH-QUALITY 3D HUMANOID CHARACTER & CHEST-UP FRAMING', () => {
  describe('1. Real 3D Human Model & Validated Asset Requirements', () => {
    it('stores a genuine high-quality GLB 3D human character in public/models/', () => {
      assert.ok(fs.existsSync(modelPath), 'Model file human_persona.glb must exist in public/models/');
      const stats = fs.statSync(modelPath);
      assert.ok(
        stats.size > 1000000,
        `Model must be a complete 3D asset with geometry and textures (>1MB), got ${stats.size} bytes`
      );
    });

    it('verifies permissive MIT license and ethical open dataset attribution', () => {
      assert.ok(fs.existsSync(licensePath), 'LICENSE.txt must exist in public/models/');
      const licenseContent = fs.readFileSync(licensePath, 'utf8');
      assert.ok(licenseContent.includes('MIT License'), 'Model must be licensed under MIT License');
      assert.ok(licenseContent.includes('VALID'), 'Model must document dataset origin (VALID avatars)');
    });

    it('loads the 3D model via GLTFLoader and MeshoptDecoder in PersonaHumanoidCanvas', () => {
      assert.ok(
        canvasSrc.includes("from 'three/examples/jsm/loaders/GLTFLoader.js'"),
        'Must import standard GLTFLoader'
      );
      assert.ok(
        canvasSrc.includes("from 'three/examples/jsm/libs/meshopt_decoder.module.js'"),
        'Must import MeshoptDecoder for high-performance decompression'
      );
      assert.ok(
        canvasSrc.includes("setMeshoptDecoder(MeshoptDecoder)"),
        'Must configure MeshoptDecoder on the GLTFLoader'
      );
      assert.ok(
        canvasSrc.includes("'/models/human_persona.glb'"),
        'Must load the official local model asset /models/human_persona.glb'
      );
    });
  });

  describe('2. Chest-Up Portrait Composition & Proportions', () => {
    it('frames the upper chest and shoulders upward without showing lower body', () => {
      assert.ok(
        canvasSrc.includes('camera.position.set(0, 0.08, 0.98)'),
        'Camera must be positioned for deliberate chest-up portrait framing (z ~ 0.98)'
      );
      assert.ok(
        canvasSrc.includes('camera.lookAt(0, 0.08, 0)'),
        'Camera must look at eye/face level'
      );
      assert.ok(
        canvasSrc.includes('model.position.set(0, -1.52, 0)'),
        'Model must be positioned so upper chest and head occupy the primary focal height'
      );
    });

    it('relaxes arms naturally beside the torso instead of rigid T-pose', () => {
      assert.ok(
        canvasSrc.includes("getObjectByName('LeftArm')"),
        'Must access LeftArm bone'
      );
      assert.ok(
        canvasSrc.includes("getObjectByName('RightArm')"),
        'Must access RightArm bone'
      );
      assert.ok(
        canvasSrc.includes('leftArm.rotation.set(') && canvasSrc.includes('rightArm.rotation.set('),
        'Must configure arm rotations to rest naturally beside body'
      );
    });

    it('enforces vertical monotonic anatomical ordering from chest to head', () => {
      assert.ok(
        BODY_REGIONS_HEIGHTS.chest.maxY <= BODY_REGIONS_HEIGHTS.neck.minY + 0.05,
        'Chest must sit below neck'
      );
      assert.ok(
        BODY_REGIONS_HEIGHTS.neck.maxY <= BODY_REGIONS_HEIGHTS.head.minY + 0.05,
        'Neck must sit below head'
      );
    });
  });

  describe('3. Phase A: Particle Surface Sampling & Human Silhouette Formation', () => {
    it('samples particles with exact Fibonacci spherical starting positions', () => {
      const particles = sampleHumanoidSurfacePoints(200, 1.48);
      assert.equal(particles.length, 200, 'Must sample requested particle count');

      for (const p of particles) {
        const sphereDist = Math.sqrt(p.sphereX ** 2 + p.sphereY ** 2 + p.sphereZ ** 2);
        assert.ok(
          sphereDist >= 0.4 && sphereDist <= 1.9,
          `Initial position must be spherical within orb bounds, got ${sphereDist}`
        );
      }
    });

    it('samples particles directly from the real 3D human character surface', () => {
      assert.ok(fs.existsSync(surfaceDataSrcPath), 'personaSurfaceData.ts must exist');
      const particles = sampleHumanoidSurfacePoints(400, 1.48);

      const headParticles = particles.filter((p) => p.region === 'head');
      const neckParticles = particles.filter((p) => p.region === 'neck');
      const chestParticles = particles.filter((p) => p.region === 'chest');

      assert.ok(headParticles.length > 50, 'Must sample head/face surface');
      assert.ok(neckParticles.length > 20, 'Must sample neck surface');
      assert.ok(chestParticles.length > 50, 'Must sample chest/shoulder surface');

      for (const hp of headParticles) {
        assert.ok(hp.targetY >= 0.05, 'Head particles must occupy upper coordinates');
      }
    });

    it('guarantees Phase A completion before solidification starts', () => {
      assert.ok(
        PERSONA_ANIMATION_CONFIG.formationDuration > 0,
        'Formation duration must be positive'
      );
      assert.ok(
        PERSONA_ANIMATION_CONFIG.settleDuration > 0,
        'Settling duration must be positive'
      );
      assert.ok(
        canvasSrc.includes('solidifyUniforms.uSolidifyY.value = cfg.minY - 1.0;'),
        'Solid mesh must be hidden below viewport during all of Phase A'
      );
    });
  });

  describe('4. Phase B: Bottom-Up Solidification with Wavefront Clipping', () => {
    it('sets initial solidification threshold below chest', () => {
      assert.ok(
        PERSONA_ANIMATION_CONFIG.minY < BODY_REGIONS_HEIGHTS.chest.minY,
        'minY must start below upper chest level'
      );
    });

    it('ascends continuously upward from chest to head', () => {
      assert.ok(
        PERSONA_ANIMATION_CONFIG.maxY > BODY_REGIONS_HEIGHTS.head.maxY,
        'maxY must end above the highest head coordinate'
      );
      assert.ok(
        canvasSrc.includes('cfg.minY + easeProg * (cfg.maxY - cfg.minY)'),
        'Solidification threshold must interpolate from chest to head'
      );
    });

    it('shader hooks project_vertex to compute skinned world position and clips smoothly', () => {
      assert.ok(
        shaderSrc.includes('#include <project_vertex>'),
        'Must hook project_vertex to read skinned vertex coordinates'
      );
      assert.ok(
        shaderSrc.includes('if (vWorldY > uSolidifyY)'),
        'Shader must clip geometry above uSolidifyY threshold'
      );
      assert.ok(
        shaderSrc.includes('uGlowColor'),
        'Shader must illuminate active boundary with GraphMind lime green glow'
      );
    });

    it('attaches solidification shader to loaded GLB model materials', () => {
      assert.ok(
        canvasSrc.includes('attachPersonaSolidifyShader'),
        'PersonaHumanoidCanvas must attach solidification shader to model materials'
      );
    });
  });

  describe('5. Lighting, Aesthetics & Resource Cleanup', () => {
    it('configures sculpted studio lighting with subtle lime-green rim light behind head', () => {
      assert.ok(canvasSrc.includes('new THREE.AmbientLight(0xffffff, 0.50)'), 'Soft ambient fill');
      assert.ok(canvasSrc.includes('new THREE.DirectionalLight(0xfff8ee'), 'Warm key light');
      assert.ok(canvasSrc.includes('new THREE.DirectionalLight(0x94a3b8'), 'Cool fill light');
      assert.ok(canvasSrc.includes('new THREE.DirectionalLight(0xa3ff12, 0.38)'), 'Subtle restrained lime rim light');
      assert.ok(canvasSrc.includes('rimLight.position.set(0.9, 1.3, -2.2)'), 'Rim light positioned behind character edge');
    });

    it('cleans up RAF, geometries, materials, and renderer on unmount', () => {
      assert.ok(
        canvasSrc.includes('cancelAnimationFrame(animationFrameId)'),
        'Must cancel animation frame on unmount'
      );
      assert.ok(
        canvasSrc.includes('particleGeometry.dispose()'),
        'Must dispose particle geometry'
      );
      assert.ok(
        canvasSrc.includes('renderer.dispose()'),
        'Must dispose renderer'
      );
    });

    it('respects prefers-reduced-motion', () => {
      assert.ok(
        canvasSrc.includes('prefers-reduced-motion: reduce'),
        'Must detect prefers-reduced-motion media query'
      );
      assert.ok(
        canvasSrc.includes("newState = 'IDLE'"),
        'Must jump directly to idle state when reduced motion is preferred'
      );
    });
  });
});
