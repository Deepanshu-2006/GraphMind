import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PERSONA_SURFACE_POINTS } from '../src/components/persona/personaSurfaceData';
import { PERSONA_PARTICLE_CONFIG } from '../src/components/persona/PersonaHumanoidCanvas';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const orbSrcPath = path.resolve(__dirname, '../src/components/overview/KnowledgeOrb3D.tsx');
const orbSrc = fs.readFileSync(orbSrcPath, 'utf8');

const personaCanvasPath = path.resolve(__dirname, '../src/components/persona/PersonaHumanoidCanvas.tsx');
const personaCanvasSrc = fs.readFileSync(personaCanvasPath, 'utf8');

describe('GRAPHMIND — INDEPENDENT PERSONA REVEAL & 3D POINT CLOUD', () => {
  describe('1. Strict Protection of the Knowledge Orb', () => {
    it('preserves the original 760 desktop particle count and responsive tiers', () => {
      assert.ok(
        orbSrc.includes('return 760; // Optimal density with rock-solid 120fps performance'),
        'Desktop particle count must remain 760'
      );
      assert.ok(
        !orbSrc.includes('return 2400;') && !orbSrc.includes('return 3600;'),
        'Must not hardcode inflated particle count in orb'
      );
    });

    it('does not import or mutate Persona surface targets in Knowledge Orb', () => {
      assert.ok(
        !orbSrc.includes('import { PERSONA_SURFACE_POINTS }'),
        'Knowledge Orb must not import PERSONA_SURFACE_POINTS'
      );
    });

    it('pauses hero orb when Persona is active to protect performance and prevent particle mutation', () => {
      assert.ok(
        orbSrc.includes("if (\n        transitionState === 'ORB_TO_HUMAN' ||\n        transitionState === 'HUMAN_FORMED' ||\n        transitionState === 'PERSONA_READY'\n      ) {\n        return;\n      }"),
        'Must pause orb simulation while in Persona'
      );
    });
  });

  describe('2. Dedicated Persona Surface Sampling & High-Density Targets', () => {
    it('samples 3,600 precision surface points evaluated from posed character geometry', () => {
      assert.equal(PERSONA_SURFACE_POINTS.length, 3600, 'Must have 3,600 precomputed GLB surface points');
      assert.equal(PERSONA_PARTICLE_CONFIG.desktopCount, 3600, 'Desktop count must be 3,600');
    });

    it('maps points across GLB surface via uniform stride', () => {
      assert.ok(
        personaCanvasSrc.includes('const targetIdx = Math.floor((i * numSource) / particleCount);'),
        'Must sample surface points across entire model using uniform stride'
      );
    });

    it('classifies anatomical feature zones (eyes, cheeks, crown, neck, chest)', () => {
      assert.ok(
        personaCanvasSrc.includes('const isEyeball ='),
        'Must identify eye regions for refined specular glints'
      );
      assert.ok(
        personaCanvasSrc.includes('const isCheekOrFace ='),
        'Must identify facial planes for luminous coverage'
      );
      assert.ok(
        personaCanvasSrc.includes('const isTopCrown = target.y > 0.16;'),
        'Must identify crown silhouette'
      );
      assert.ok(
        personaCanvasSrc.includes('const isNeckOrJaw ='),
        'Must identify neck and jaw bridge'
      );
      assert.ok(
        personaCanvasSrc.includes('const isChestOrShoulder = target.y < -0.09;'),
        'Must identify upper chest and shoulders'
      );
    });
  });

  describe('3. Refined Point-Cloud Appearance & 3D Shading', () => {
    it('uses NormalBlending and depthTest to prevent blown-out white-hot clusters', () => {
      assert.ok(
        personaCanvasSrc.includes('blending: THREE.NormalBlending'),
        'Must use NormalBlending instead of AdditiveBlending to eliminate hot clusters'
      );
      assert.ok(
        personaCanvasSrc.includes('depthTest: true'),
        'Must enable depthTest'
      );
    });

    it('calibrates base particle size to 0.0132 for dense, fine point cloud without oversized circles', () => {
      assert.equal(PERSONA_PARTICLE_CONFIG.baseParticleSize, 0.0132);
      assert.ok(
        personaCanvasSrc.includes('size: PERSONA_PARTICLE_CONFIG.baseParticleSize'),
        'Must apply calibrated base particle size'
      );
    });

    it('implements normal-based diffuse lighting and depth falloff for rich 3D form', () => {
      assert.ok(
        personaCanvasSrc.includes('const nDotL = Math.max(0.0, target.nx * lx + target.ny * ly + target.nz * lz);'),
        'Must calculate NdotL diffuse shading'
      );
      assert.ok(
        personaCanvasSrc.includes('if (facing < 0.30)'),
        'Must apply depth falloff to grazing angles'
      );
    });
  });

  describe('4. Independent Spatial Reveal Wave & Settling', () => {
    it('emerges from normal offsets near silhouette without traveling from orb', () => {
      assert.ok(
        personaCanvasSrc.includes('const startX = target.x + target.nx * normalOffset'),
        'Starting positions must originate along surface normals'
      );
      assert.ok(
        !personaCanvasSrc.includes('1.85 + r * Math.sin'),
        'Must NOT originate from orb coordinates on right'
      );
    });

    it('sequences ascending spatial wave from chest upward to crown', () => {
      assert.ok(
        personaCanvasSrc.includes('delay = 0.25 + normY * 0.65'),
        'Must sweep upward along Y axis'
      );
    });

    it('applies exponential velocity damping during Phase C settling', () => {
      assert.ok(
        personaCanvasSrc.includes('const damp = Math.exp(-settleP * 8.0);'),
        'Must damp velocity smoothly as particles settle'
      );
    });

    it('maintains subtle living breathing motion in settled state', () => {
      assert.ok(
        personaCanvasSrc.includes('const breath = Math.sin(timeVal * 1.5 + p.targetY * 4.0) * 0.0012;'),
        'Must maintain subtle breathing life (<0.0014 units) in stabilized humanoid'
      );
    });
  });
});
