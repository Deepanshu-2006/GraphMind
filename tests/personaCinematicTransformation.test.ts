import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PERSONA_SURFACE_POINTS } from '../src/components/persona/personaSurfaceData';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const orbSrcPath = path.resolve(__dirname, '../src/components/overview/KnowledgeOrb3D.tsx');
const orbSrc = fs.readFileSync(orbSrcPath, 'utf8');

describe('GRAPHMIND — CINEMATIC 3D ORB-TO-HUMAN TRANSFORMATION', () => {
  describe('1. Preservation of Particle Count & Authoritative System', () => {
    it('preserves the original 760 desktop particle count and responsive tiers', () => {
      assert.ok(
        orbSrc.includes('return 760; // Optimal density with rock-solid 120fps performance'),
        'Desktop particle count must remain 760'
      );
      assert.ok(
        !orbSrc.includes('return 2400;'),
        'Must not hardcode 2400 particle count'
      );
    });

    it('maps existing particles across 2,400 GLB model surface points via uniform stride', () => {
      assert.ok(
        orbSrc.includes('const targetIdx = Math.floor((i * PERSONA_SURFACE_POINTS.length) / particleCount);'),
        'Must sample surface points across entire model using uniform stride'
      );
      assert.equal(PERSONA_SURFACE_POINTS.length, 2400, 'Must have 2,400 GLB model surface points');
    });

    it('maintains distinct data for scatter, sphere, and human target coordinates', () => {
      assert.ok(orbSrc.includes('scatterX: number;'), 'Must preserve scatter coordinates');
      assert.ok(orbSrc.includes('sphereX: number;'), 'Must preserve sphere coordinates');
      assert.ok(orbSrc.includes('transTargetX: number;'), 'Must preserve human surface target coordinates');
    });
  });

  describe('2. Phase A: Interaction Response Choreography', () => {
    it('implements responsive radial pulse, rotational energy, and brightness wave during initial 0.35s', () => {
      assert.ok(
        orbSrc.includes('const isPhaseA = elapsed < 0.35 && !prefersReducedMotion;'),
        'Must designate Phase A for elapsed < 0.35s'
      );
      assert.ok(
        orbSrc.includes('const phaseAPulse = isPhaseA ? Math.sin((elapsed / 0.35) * Math.PI) : 0;'),
        'Must compute smooth sinusoidal pulse for Phase A'
      );
      assert.ok(
        orbSrc.includes('const orbExpansion = 1.0 + 0.04 * phaseAPulse;'),
        'Must apply restrained radial expansion to the orb'
      );
      assert.ok(
        orbSrc.includes('const orbSpin = (elapsed / 0.35) * 0.32;'),
        'Must impart rotational energy acceleration'
      );
    });

    it('fades graph relationship lines during Phase A', () => {
      assert.ok(
        orbSrc.includes('const lineFade = Math.max(0, 1.0 - elapsed / 0.35);'),
        'Relationship lines must fade gracefully over the initial 0.35s'
      );
    });
  });

  describe('3. Phase B: 3D Orbital Flow & Vortex Curl', () => {
    it('defines curved 3D control points with lateral sweep, vertical arch, and depth', () => {
      assert.ok(
        orbSrc.includes('p.transMidX = (p.transStartX + p.transTargetX) * 0.52 - 0.20'),
        'Must compute curved lateral mid-point arching from hero right to center'
      );
      assert.ok(
        orbSrc.includes('p.transMidY = Math.max(p.transStartY, p.transTargetY) * 0.65 + 0.36'),
        'Must lift particles gracefully into the upper spatial quadrant'
      );
      assert.ok(
        orbSrc.includes('p.transMidZ = (p.transStartZ + p.transTargetZ) * 0.5 + 0.42'),
        'Must sweep particles forward in depth for three-dimensional parallax'
      );
    });

    it('applies controlled vortex swirl during transit that smoothly damps to zero upon arrival', () => {
      assert.ok(
        orbSrc.includes('const swirlMag = Math.sin(rawP * Math.PI) * 0.12 * (1.0 - rawP * 0.4);'),
        'Vortex swirl magnitude must peak mid-flight and vanish at rawP=1'
      );
      assert.ok(
        orbSrc.includes('p.x = b0 * p.transStartX + b1 * p.transMidX + b2 * p.transTargetX + swirlX;'),
        'Must apply tangential vortex offset to X coordinate'
      );
      assert.ok(
        orbSrc.includes('p.z = b0 * p.transStartZ + b1 * p.transMidZ + b2 * p.transTargetZ + swirlZ;'),
        'Must apply tangential vortex offset to Z coordinate'
      );
    });
  });

  describe('4. Phase C: Target-Aware Human Formation & Spatial Waves', () => {
    it('classifies structural silhouette landmarks vs interior volumetric surface', () => {
      assert.ok(
        orbSrc.includes('const isTopHair = target.y > 0.20;'),
        'Must classify hair crest contour'
      );
      assert.ok(
        orbSrc.includes('const isShoulder = Math.abs(target.x) > 0.18 && target.y < -0.06;'),
        'Must classify shoulder lateral contour'
      );
      assert.ok(
        orbSrc.includes('const isFaceLandmark = target.z > 0.075 && target.y >= 0.02 && target.y <= 0.20;'),
        'Must classify prominent frontal facial features'
      );
    });

    it('sequences silhouette arrival first, followed by ascending upward wave for interior fill', () => {
      assert.ok(
        orbSrc.includes('p.transDelay = 0.35 + (1.0 - normY) * 0.18'),
        'Silhouette points must arrive first to establish the human frame'
      );
      assert.ok(
        orbSrc.includes('p.transDelay = 0.50 + normY * 0.42'),
        'Interior fill points must ascend upward in a spatial wave from chest to face'
      );
    });
  });

  describe('5. Phase D & E: Final Convergence, Shimmer & Stabilized Hold', () => {
    it('implements exponential velocity damping and finishing surface shimmer in Phase D', () => {
      assert.ok(
        orbSrc.includes('const damp = Math.exp(-settleP * 8.0);'),
        'Must damp velocity smoothly as particles settle'
      );
      assert.ok(
        orbSrc.includes('const shimmer = Math.sin(shimmerPhase * Math.PI) * 0.18;'),
        'Must illuminate completed surface with finishing shimmer wave'
      );
    });

    it('maintains subtle natural breathing motion in Phase E while keeping silhouette rock-solid', () => {
      assert.ok(
        orbSrc.includes("if (transitionState === 'HUMAN_FORMED' || transitionState === 'PERSONA_READY')"),
        'Must handle stabilized state explicitly'
      );
      assert.ok(
        orbSrc.includes('const breath = Math.sin(timeVal * 1.5 + p.transTargetY * 4.0) * 0.0012;'),
        'Must maintain subtle breathing life (<0.0014 units) without drifting'
      );
      assert.ok(
        orbSrc.includes('pointsMaterial.size = 0.028;'),
        'Must preserve crisp, visible particle size (0.028) in portrait framing'
      );
    });
  });
});
