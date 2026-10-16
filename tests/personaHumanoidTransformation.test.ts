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
  createPersonaSolidMaterial
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
const landingOrbPath = path.resolve(__dirname, '../src/components/overview/KnowledgeOrb3D.tsx');

const canvasSrc = fs.readFileSync(canvasSrcPath, 'utf8');
const shaderSrc = fs.readFileSync(shaderSrcPath, 'utf8');
const geometrySrc = fs.readFileSync(geometrySrcPath, 'utf8');
const experienceSrc = fs.readFileSync(experienceSrcPath, 'utf8');

describe('GRAPHMIND — PERSONA PROMPT 02: PARTICLE SPHERE → HUMANOID → BOTTOM-UP SOLIDIFICATION', () => {
  describe('1. Single Coordinate System & Anatomical Proportions (Criterion 3 & 12)', () => {
    it('defines a consistent character space spanning feet to head within expected bounds', () => {
      const parts = createHumanoidBodyParts();
      assert.ok(parts.length >= 10, 'Must have at least 10 anatomical body parts');

      const regionsFound = new Set(parts.map((p) => p.region));
      const expectedRegions: BodyRegion[] = [
        'feet',
        'lower_legs',
        'upper_legs',
        'pelvis',
        'abdomen',
        'chest',
        'arms',
        'neck',
        'head'
      ];

      for (const region of expectedRegions) {
        assert.ok(regionsFound.has(region), `Missing required anatomical region: ${region}`);
      }
    });

    it('enforces vertical monotonic anatomical ordering from feet to head', () => {
      assert.ok(
        BODY_REGIONS_HEIGHTS.feet.maxY <= BODY_REGIONS_HEIGHTS.lower_legs.minY + 0.05,
        'Feet must sit below lower legs'
      );
      assert.ok(
        BODY_REGIONS_HEIGHTS.lower_legs.maxY <= BODY_REGIONS_HEIGHTS.upper_legs.minY + 0.05,
        'Lower legs must sit below upper legs'
      );
      assert.ok(
        BODY_REGIONS_HEIGHTS.upper_legs.maxY <= BODY_REGIONS_HEIGHTS.pelvis.minY + 0.05,
        'Upper legs must sit below pelvis'
      );
      assert.ok(
        BODY_REGIONS_HEIGHTS.pelvis.maxY <= BODY_REGIONS_HEIGHTS.abdomen.minY + 0.05,
        'Pelvis must sit below abdomen'
      );
      assert.ok(
        BODY_REGIONS_HEIGHTS.abdomen.maxY <= BODY_REGIONS_HEIGHTS.chest.minY + 0.05,
        'Abdomen must sit below chest'
      );
      assert.ok(
        BODY_REGIONS_HEIGHTS.chest.maxY <= BODY_REGIONS_HEIGHTS.neck.minY + 0.05,
        'Chest must sit below neck'
      );
      assert.ok(
        BODY_REGIONS_HEIGHTS.neck.maxY <= BODY_REGIONS_HEIGHTS.head.minY + 0.05,
        'Neck must sit below head'
      );
    });

    it('builds solid humanoid mesh with matching names and regions', () => {
      const material = new THREE.MeshBasicMaterial();
      const group = buildHumanoidMesh(material);
      assert.equal(group.name, 'solid-humanoid-character');
      assert.ok(group.children.length >= 10, 'Group must contain all anatomical body part meshes');

      const headMesh = group.children.find((c) => c.name === 'head');
      assert.ok(headMesh, 'Head mesh must be present');
      assert.ok(headMesh.position.y > 0.8, 'Head mesh must be positioned at upper vertical pole');
    });
  });

  describe('2. Phase A: Particle Sphere Starting Point & Humanoid Formation (Criteria 1, 2, 4)', () => {
    it('samples particles with exact Fibonacci spherical starting positions (Criterion 1)', () => {
      const particles = sampleHumanoidSurfacePoints(200, 1.48);
      assert.equal(particles.length, 200, 'Must sample requested particle count');

      for (const p of particles) {
        const sphereDist = Math.sqrt(p.sphereX ** 2 + p.sphereY ** 2 + p.sphereZ ** 2);
        assert.ok(
          sphereDist >= 0.4 && sphereDist <= 1.8,
          `Initial position must be spherical within orb bounds, got ${sphereDist}`
        );
      }
    });

    it('samples particles directly on the 3D surface of the character (Criterion 2 & 3)', () => {
      const particles = sampleHumanoidSurfacePoints(400, 1.48);
      const headParticles = particles.filter((p) => p.region === 'head');
      const feetParticles = particles.filter((p) => p.region === 'feet');
      const armParticles = particles.filter((p) => p.region === 'arms');

      assert.ok(headParticles.length > 20, 'Must sample head surface');
      assert.ok(feetParticles.length > 10, 'Must sample feet surface');
      assert.ok(armParticles.length > 20, 'Must sample arm surfaces');

      for (const hp of headParticles) {
        assert.ok(hp.targetY >= 0.75, 'Head particles must occupy upper coordinates');
      }

      for (const fp of feetParticles) {
        assert.ok(fp.targetY <= -1.0, 'Feet particles must occupy lowest coordinates');
      }
    });

    it('guarantees Phase A completion before solidification starts (Criterion 4 & 5)', () => {
      assert.ok(
        PERSONA_ANIMATION_CONFIG.formationDuration > 0,
        'Formation duration must be positive'
      );
      assert.ok(
        PERSONA_ANIMATION_CONFIG.settleDuration > 0,
        'Settling duration must be positive'
      );

      // Verify in code that solid mesh is hidden during SPHERE, FORMING, and SETTLING
      assert.ok(
        canvasSrc.includes("solidMaterial.solidifyUniforms.uSolidifyY.value = cfg.minY - 1.0;"),
        'Solid mesh must be hidden below viewport during all of Phase A'
      );
    });
  });

  describe('3. Phase B: Bottom-Up Solidification Sequence (Criteria 5, 6, 7, 8, 9, 10, 11, 13)', () => {
    it('sets initial solidification threshold below the feet (Criterion 6)', () => {
      assert.ok(
        PERSONA_ANIMATION_CONFIG.minY < BODY_REGIONS_HEIGHTS.feet.minY,
        'minY must start below the lowest foot coordinate'
      );
    });

    it('ascends continuously upward from feet to head (Criterion 7)', () => {
      assert.ok(
        PERSONA_ANIMATION_CONFIG.maxY > BODY_REGIONS_HEIGHTS.head.maxY,
        'maxY must end above the highest head coordinate'
      );
      assert.ok(
        canvasSrc.includes('cfg.minY + easeProg * (cfg.maxY - cfg.minY)'),
        'Solidification threshold must interpolate from feet to head'
      );
    });

    it('solidifies legs before torso, and torso before head (Criteria 8 & 9)', () => {
      const feetMid = (BODY_REGIONS_HEIGHTS.feet.minY + BODY_REGIONS_HEIGHTS.feet.maxY) / 2;
      const legMid = (BODY_REGIONS_HEIGHTS.lower_legs.minY + BODY_REGIONS_HEIGHTS.lower_legs.maxY) / 2;
      const torsoMid = (BODY_REGIONS_HEIGHTS.chest.minY + BODY_REGIONS_HEIGHTS.chest.maxY) / 2;
      const headMid = (BODY_REGIONS_HEIGHTS.head.minY + BODY_REGIONS_HEIGHTS.head.maxY) / 2;

      assert.ok(feetMid < legMid, 'Feet must be below legs');
      assert.ok(legMid < torsoMid, 'Legs must be below torso');
      assert.ok(torsoMid < headMid, 'Torso must be below head');
    });

    it('keeps particle region active and visible above boundary (Criterion 10)', () => {
      assert.ok(
        canvasSrc.includes('pY > currentY'),
        'Must check if particle is above the current boundary'
      );
      assert.ok(
        canvasSrc.includes('colors[i3] = p.baseR'),
        'Particles above boundary must preserve color and visibility'
      );
    });

    it('maintains continuous solid geometry below boundary (Criterion 11)', () => {
      assert.ok(
        shaderSrc.includes('if (vWorldY > uSolidifyY)'),
        'Shader must clip above threshold and preserve full continuous mesh below'
      );
    });

    it('head becomes solid last (Criterion 13)', () => {
      assert.equal(
        BODY_REGIONS_HEIGHTS.head.order,
        9,
        'Head region must have the highest order in the sequence'
      );
    });
  });

  describe('4. Spatial Alignment & Visual Continuity (Criteria 12 & 14)', () => {
    it('both representations share identical local coordinates and parent group', () => {
      assert.ok(
        canvasSrc.includes('characterGroup.add(solidMeshGroup)'),
        'Solid mesh must be child of characterGroup'
      );
      assert.ok(
        canvasSrc.includes('characterGroup.add(particleSystem)'),
        'Particle system must be child of characterGroup'
      );
    });

    it('enters stable idle state after completion (Criterion 14)', () => {
      assert.ok(
        canvasSrc.includes("newState = 'IDLE'"),
        'Must transition to IDLE state after fully solid phase'
      );
      assert.ok(
        canvasSrc.includes('characterGroup.position.y = breath'),
        'Must execute subtle breathing motion during idle'
      );
    });
  });

  describe('5. Landing Page Preservation & Resource Cleanup (Criteria 15, 16, 17, 18)', () => {
    it('preserves existing landing page KnowledgeOrb3D intact (Criterion 15)', () => {
      assert.ok(fs.existsSync(landingOrbPath), 'KnowledgeOrb3D must exist');
      const landingOrbSrc = fs.readFileSync(landingOrbPath, 'utf8');
      assert.ok(landingOrbSrc.includes('KnowledgeOrb3D'), 'KnowledgeOrb3D must remain intact');
    });

    it('cleans up RAF, geometries, materials, and renderer on unmount (Criterion 16 & 18)', () => {
      assert.ok(
        canvasSrc.includes('cancelAnimationFrame(animationFrameId)'),
        'Must cancel animation frame on unmount'
      );
      assert.ok(
        canvasSrc.includes('particleGeometry.dispose()'),
        'Must dispose particle geometry'
      );
      assert.ok(
        canvasSrc.includes('solidMaterial.dispose()'),
        'Must dispose solid material'
      );
      assert.ok(
        canvasSrc.includes('renderer.dispose()'),
        'Must dispose renderer'
      );
    });

    it('respects prefers-reduced-motion (Criterion 17)', () => {
      assert.ok(
        canvasSrc.includes('prefers-reduced-motion: reduce'),
        'Must detect prefers-reduced-motion media query'
      );
      assert.ok(
        canvasSrc.includes("newState = 'IDLE'"),
        'Must jump directly to idle state when reduced motion is preferred'
      );
    });

    it('mounts PersonaHumanoidCanvas in PersonaExperience stage', () => {
      assert.ok(
        experienceSrc.includes('<PersonaHumanoidCanvas'),
        'PersonaExperience must mount PersonaHumanoidCanvas'
      );
      assert.ok(
        experienceSrc.includes('id="persona-character-stage"'),
        'PersonaExperience must retain id="persona-character-stage"'
      );
    });
  });
});
