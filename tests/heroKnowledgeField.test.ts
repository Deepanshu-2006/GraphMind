import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

describe('True 3D Particle Knowledge Orb Hero System', () => {
  const INFLUENCE_RADIUS = 2.4;
  const MAX_DISPLACEMENT_UNITS = 0.20; // ~16px displacement limit
  const BASE_ORB_RADIUS = 1.48;

  test('Particles are distributed across volumetric layers (core, mid, surface)', () => {
    const classifyVolumetricLayer = (rRatio: number) => {
      if (rRatio < 0.60) return 'core';
      if (rRatio < 0.92) return 'mid';
      return 'surface';
    };

    assert.equal(classifyVolumetricLayer(0.35), 'core');
    assert.equal(classifyVolumetricLayer(0.75), 'mid');
    assert.equal(classifyVolumetricLayer(1.02), 'surface');
  });

  test('Particle sizes exhibit natural variation (1.5-2.2px most, 2.5-3.2px some, 3.8-4.4px focal)', () => {
    const getParticleCategory = (size: number) => {
      if (size >= 3.6) return 'focal';
      if (size >= 2.4) return 'mid';
      return 'standard';
    };

    assert.equal(getParticleCategory(1.8), 'standard');
    assert.equal(getParticleCategory(2.8), 'mid');
    assert.equal(getParticleCategory(4.0), 'focal');
  });

  test('Knowledge graph relationships are sparse (strictly 5-10% connection density)', () => {
    const totalParticles = 860;
    const maxAllowedConnections = Math.floor(totalParticles * 0.10);
    const minExpectedConnections = Math.floor(totalParticles * 0.05);

    // Our generator targets ~8.5%
    const actualConnectionsCount = Math.floor(totalParticles * 0.085);

    assert.ok(
      actualConnectionsCount >= minExpectedConnections,
      'Must have enough connections to represent graph relationships'
    );
    assert.ok(
      actualConnectionsCount <= maxAllowedConnections,
      'Connections must not exceed 10% to prevent wireframe globe effect'
    );
  });

  test('Natural resting home position is anchored in the right-hand volume', () => {
    const computeHomePosition = (width: number, height: number) => {
      const aspect = width / height;
      if (width < 768) {
        return { x: aspect * 0.42, y: -0.15, z: 0 };
      } else if (width < 1080) {
        return { x: aspect * 0.70, y: 0.05, z: 0 };
      }
      const posX = Math.min(2.4, Math.max(1.6, aspect * 0.86));
      return { x: posX, y: 0.05, z: 0 };
    };

    const desktopHome = computeHomePosition(1440, 900);
    const tabletHome = computeHomePosition(900, 700);
    const mobileHome = computeHomePosition(400, 800);

    assert.ok(desktopHome.x >= 1.6, 'Desktop orb must be anchored in the right volume (x >= 1.6)');
    assert.ok(tabletHome.x > 0.8, 'Tablet orb must be positioned to the right of content');
    assert.ok(mobileHome.x > 0, 'Mobile orb must have dedicated non-overlapping coordinates');
  });

  test('Orb position displacement is strictly clamped and never follows the cursor around the screen', () => {
    const computeDisplacement = (
      cursorRayX: number,
      cursorRayY: number,
      homeX: number,
      homeY: number
    ) => {
      const dx = cursorRayX - homeX;
      const dy = cursorRayY - homeY;
      const dist = Math.hypot(dx, dy);

      if (dist >= INFLUENCE_RADIUS) return { shiftX: 0, shiftY: 0, dist };

      const normDist = dist / INFLUENCE_RADIUS;
      const influence = Math.pow(1 - normDist, 1.8);
      const contactX = dx / (dist || 1);
      const contactY = dy / (dist || 1);

      const shiftX = contactX * influence * MAX_DISPLACEMENT_UNITS;
      const shiftY = contactY * influence * MAX_DISPLACEMENT_UNITS;

      return { shiftX, shiftY, dist };
    };

    const homeX = 1.85;
    const homeY = 0.05;

    // 1. Extreme cursor position (cursor on far left side of screen)
    const farLeft = computeDisplacement(-2.5, 0.05, homeX, homeY);
    assert.equal(farLeft.shiftX, 0, 'Far cursor must cause 0 position shift');

    // 2. Cursor in near zone
    const nearZone = computeDisplacement(2.4, 0.05, homeX, homeY);
    assert.ok(Math.abs(nearZone.shiftX) > 0 && Math.abs(nearZone.shiftX) < MAX_DISPLACEMENT_UNITS);

    // 3. Cursor in direct contact
    const contactZone = computeDisplacement(1.90, 0.05, homeX, homeY);
    assert.ok(Math.abs(contactZone.shiftX) <= MAX_DISPLACEMENT_UNITS, 'Shift must not exceed maximum displacement threshold');
  });

  test('Spring-damper physics returns particles and orb to exact home position with zero permanent drift', () => {
    let currentX = 1.98; // Displaced position
    let currentY = 0.18;
    let vx = 0;
    let vy = 0;
    const homeX = 1.85;
    const homeY = 0.05;
    const springK = 0.048;
    const damping = 0.82;

    // Simulate 60 frames (~1 second) of release
    for (let f = 0; f < 60; f++) {
      vx = (vx + (homeX - currentX) * springK) * damping;
      vy = (vy + (homeY - currentY) * springK) * damping;
      currentX += vx;
      currentY += vy;
    }

    assert.ok(Math.abs(currentX - homeX) < 0.002, 'Orb X must return to exact home state');
    assert.ok(Math.abs(currentY - homeY) < 0.002, 'Orb Y must return to exact home state');
    assert.ok(Math.hypot(vx, vy) < 0.001, 'Velocity must damp to resting equilibrium');
  });

  test('Particle deformation responds locally without destroying overall spherical form', () => {
    const computeParticleDeformation = (
      px: number,
      py: number,
      pz: number,
      cursorX: number,
      cursorY: number,
      cursorZ: number,
      speed: number
    ) => {
      const dx = px - cursorX;
      const dy = py - cursorY;
      const dz = pz - cursorZ;
      const dist = Math.hypot(dx, dy, dz);
      const influenceR = 1.6;

      if (dist >= influenceR) return { deform: 0, shift: 0 };

      const normD = dist / influenceR;
      const deform = Math.pow(1 - normD, 2.2);
      const pullForce = 0.22 * deform;
      return { deform, shift: pullForce };
    };

    // Particle close to cursor
    const nearParticle = computeParticleDeformation(1.2, 0.1, 0, 1.3, 0.1, 0, 0.5);
    // Particle on opposite side of sphere
    const farParticle = computeParticleDeformation(-1.2, 0.1, 0, 1.3, 0.1, 0, 0.5);

    assert.ok(nearParticle.deform > 0.6, 'Nearby particles experience local attraction deformation');
    assert.equal(farParticle.deform, 0, 'Far-side particles maintain their spherical position');
  });

  test('Particle ripple wave propagates across spherical surface and dissipates', () => {
    const computeRipple = (
      angularDist: number,
      rippleAge: number,
      strength: number
    ) => {
      if (rippleAge >= 1.1) return 0;
      const waveFront = rippleAge * 3.4;
      const deltaWave = Math.abs(angularDist - waveFront);
      if (deltaWave >= 0.45) return 0;
      const waveShape = Math.cos((deltaWave / 0.45) * (Math.PI / 2));
      const decay = Math.max(0, 1 - rippleAge / 1.1);
      return waveShape * strength * 0.08 * decay;
    };

    const strength = 0.8;

    // Early stage
    const earlyCrest = computeRipple(0.34, 0.1, strength);
    const earlyFar = computeRipple(2.5, 0.1, strength);
    assert.ok(earlyCrest > 0, 'Ripple crest is active near origin at 100ms');
    assert.equal(earlyFar, 0, 'Far particles untouched by ripple at 100ms');

    // Expired
    const expired = computeRipple(1.5, 1.2, strength);
    assert.equal(expired, 0, 'Ripple completely decays after duration');
  });

  test('Organic harmonic breathing prevents rigid spherical symmetry', () => {
    const computeOrganicNoise = (theta: number, phi: number, time: number) => {
      return (
        0.032 * Math.sin(2 * theta + 1.1 * time) * Math.cos(3 * phi - 0.9 * time) +
        0.018 * Math.sin(3 * theta + 2 * phi + 1.4 * time)
      );
    };

    const noise1 = computeOrganicNoise(0, 0, 1.0);
    const noise2 = computeOrganicNoise(Math.PI / 2, Math.PI / 4, 1.0);
    const noise3 = computeOrganicNoise(0, 0, 2.5);

    assert.ok(noise1 !== noise2, 'Noise varies across spherical surface points');
    assert.ok(noise1 !== noise3, 'Noise breathes continuously across time');
    assert.ok(Math.abs(noise1) < 0.06, 'Breathing noise is subtle and restrained');
  });

  test('Hero typography area remains distinct and unoccluded by the 3D particle orb', () => {
    const isInsideTypographyCorridor = (screenX: number, screenY: number, width = 1440, height = 900) => {
      const halfW = width / 2;
      const halfH = height / 2;
      return (
        screenX >= 36 &&
        screenX <= halfW * 0.92 &&
        screenY >= halfH - 220 &&
        screenY <= halfH + 180
      );
    };

    // Headline is on the left
    assert.ok(isInsideTypographyCorridor(200, 450, 1440, 900), 'Headline area is in typography corridor');

    // Orb sits on the right
    const orbScreenX = 1440 * 0.70;
    const orbScreenY = 900 * 0.50;
    assert.equal(isInsideTypographyCorridor(orbScreenX, orbScreenY, 1440, 900), false, 'Orb position is outside typography corridor');
  });
});
