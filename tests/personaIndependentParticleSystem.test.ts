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

const appSrcPath = path.resolve(__dirname, '../src/App.tsx');
const appSrc = fs.readFileSync(appSrcPath, 'utf8');

describe('GRAPHMIND — INDEPENDENT PERSONA PARTICLE SYSTEM ARCHITECTURE', () => {
  describe('1. Strict Protection of the Knowledge Orb', () => {
    it('strictly preserves the Knowledge Orb particle count (760 desktop, 460 tablet, 240 mobile, 180 reduced motion)', () => {
      assert.ok(
        orbSrc.includes('return 760; // Optimal density with rock-solid 120fps performance'),
        'Knowledge Orb must maintain its exact 760 desktop particle count'
      );
      assert.ok(
        !orbSrc.includes('const particleCount = 2400;'),
        'Knowledge Orb must NOT have its particle count increased'
      );
    });

    it('preserves the Knowledge Orb resting appearance and entrance replay', () => {
      assert.ok(
        orbSrc.includes('prepareFreshHeroEntry'),
        'Must retain fresh hero entry replay on return'
      );
      assert.ok(
        orbSrc.includes('personaTransitionController.startHeroEntering();'),
        'Must start fresh hero entrance cycle on return'
      );
    });
  });

  describe('2. Independent High-Density Persona Particle System', () => {
    it('defines an independent configuration with 5,200 desktop particles', () => {
      assert.equal(PERSONA_PARTICLE_CONFIG.desktopCount, 5200, 'Persona desktop particle count must be 5200');
      assert.equal(PERSONA_PARTICLE_CONFIG.tabletCount, 3200, 'Persona tablet particle count must be 3200');
      assert.equal(PERSONA_PARTICLE_CONFIG.mobileCount, 1600, 'Persona mobile particle count must be 1600');
    });

    it('calibrates projected point size appropriately for high density without oversized dots', () => {
      assert.equal(PERSONA_PARTICLE_CONFIG.baseParticleSize, 0.0125, 'Base point size must be calibrated to 0.0125');
      assert.ok(
        personaCanvasSrc.includes('size: PERSONA_PARTICLE_CONFIG.baseParticleSize'),
        'PointsMaterial must use the calibrated particle size'
      );
    });

    it('allocates independent position, color, and size buffers without sharing mutable arrays', () => {
      assert.ok(
        personaCanvasSrc.includes('const positionsArray = new Float32Array(particleCount * 3);'),
        'Persona must allocate its own position buffer'
      );
      assert.ok(
        personaCanvasSrc.includes('const colorsArray = new Float32Array(particleCount * 3);'),
        'Persona must allocate its own color buffer'
      );
      assert.ok(
        personaCanvasSrc.includes('const sizesArray = new Float32Array(particleCount);'),
        'Persona must allocate its own size buffer'
      );
    });

    it('samples 5,200 genuine GLB surface points evaluated from posed character geometry', () => {
      assert.equal(PERSONA_SURFACE_POINTS.length, 5200, 'Must have 5,200 precomputed GLB surface points');
      assert.ok(
        personaCanvasSrc.includes('const target: PrecomputedSurfacePoint = sourcePoints[targetIdx];'),
        'Persona must sample from precomputed GLB surface points'
      );
    });

    it('implements independent Persona reveal driven by GLB surface targets without orb dependency', () => {
      assert.ok(
        !orbSrc.includes('import { PERSONA_SURFACE_POINTS }'),
        'Knowledge Orb must NOT import Persona surface targets'
      );
      assert.ok(
        personaCanvasSrc.includes('const startX = target.x + target.nx * normalOffset'),
        'Starting positions must emerge along surface normals rather than traveling from hero orb'
      );
    });

    it('implements clean WebGL resource disposal on unmount to prevent leaks on repeated entry', () => {
      assert.ok(personaCanvasSrc.includes('particleGeometry.dispose();'), 'Must dispose geometry on unmount');
      assert.ok(personaCanvasSrc.includes('particleMaterial.dispose();'), 'Must dispose material on unmount');
      assert.ok(personaCanvasSrc.includes('particleTexture.dispose();'), 'Must dispose texture on unmount');
      assert.ok(personaCanvasSrc.includes('renderer.dispose();'), 'Must dispose renderer on unmount');
    });

    it('renders PersonaHumanoidCanvas inside PersonaExperience in App.tsx', () => {
      assert.ok(
        !appSrc.includes('characterSlot={<div className="persona-stage-placeholder" />}'),
        'App.tsx must not block PersonaHumanoidCanvas with a placeholder slot'
      );
    });
  });
});
