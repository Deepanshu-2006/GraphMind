import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Hero 3D Knowledge Particle Field System', () => {
  const FOCAL_LENGTH = 540;
  const NEAR_Z = -140;
  const FAR_Z = 420;
  const INFLUENCE_RADIUS = 200;
  const MAX_CONNECTION_DIST = 92;

  test('3D perspective projection scales strictly with depth', () => {
    const project = (z: number) => FOCAL_LENGTH / (FOCAL_LENGTH + z);

    const nearScale = project(NEAR_Z);
    const midScale = project(0);
    const farScale = project(FAR_Z);

    assert.ok(nearScale > midScale, 'Near particles must have larger scale than mid particles');
    assert.ok(midScale > farScale, 'Mid particles must have larger scale than far particles');
    assert.ok(nearScale > 1.0, 'Near plane particles should have scale > 1');
    assert.ok(farScale < 0.6, 'Far plane particles should have scale < 0.6');
  });

  test('Radial cursor influence demonstrates smooth physical falloff', () => {
    const computeInfluence = (dist: number, radius = INFLUENCE_RADIUS) => {
      if (dist >= radius) return 0;
      const norm = dist / radius;
      return Math.pow(1 - norm, 1.8);
    };

    const centerInfluence = computeInfluence(0);
    const quarterInfluence = computeInfluence(50);
    const halfInfluence = computeInfluence(100);
    const edgeInfluence = computeInfluence(200);
    const outsideInfluence = computeInfluence(250);

    assert.equal(centerInfluence, 1.0, 'Center influence must be 1.0');
    assert.ok(quarterInfluence > halfInfluence, 'Influence must fall off monotonically');
    assert.ok(halfInfluence > edgeInfluence, 'Influence must continue falling off');
    assert.equal(edgeInfluence, 0, 'Influence at boundary radius must be 0');
    assert.equal(outsideInfluence, 0, 'Influence outside radius must be 0');
  });

  test('Connection filtering requires proximity and similar 3D depth strata', () => {
    const canConnect = (
      p1: { sx: number; sy: number; z: number; active: number },
      p2: { sx: number; sy: number; z: number; active: number }
    ) => {
      if (p1.active < 0.08 && p2.active < 0.08) return false;
      if (Math.abs(p1.z - p2.z) > 140) return false;
      const dist = Math.hypot(p1.sx - p2.sx, p1.sy - p2.sy);
      return dist < MAX_CONNECTION_DIST;
    };

    // Both active and close in 2D and 3D
    assert.ok(
      canConnect(
        { sx: 100, sy: 100, z: 20, active: 0.8 },
        { sx: 130, sy: 120, z: 40, active: 0.7 }
      ),
      'Should connect nearby active particles in similar depth'
    );

    // Inactive particles do not reveal connections
    assert.equal(
      canConnect(
        { sx: 100, sy: 100, z: 20, active: 0.02 },
        { sx: 130, sy: 120, z: 40, active: 0.01 }
      ),
      false,
      'Resting inactive particles must not form connections'
    );

    // Close in 2D but distant in 3D Z-depth
    assert.equal(
      canConnect(
        { sx: 100, sy: 100, z: -100, active: 0.8 },
        { sx: 110, sy: 105, z: 250, active: 0.8 }
      ),
      false,
      'Particles with large 3D depth difference must not connect'
    );

    // Far in 2D
    assert.equal(
      canConnect(
        { sx: 100, sy: 100, z: 20, active: 0.8 },
        { sx: 250, sy: 250, z: 30, active: 0.8 }
      ),
      false,
      'Particles exceeding distance threshold must not connect'
    );
  });

  test('Reading zone is properly bounded to protect headline typography', () => {
    const isInsideReadingZone = (rx: number, ry: number, width = 1200) => {
      const halfW = width / 2;
      const isLeftAligned = width > 800;
      return isLeftAligned
        ? (rx > -halfW * 0.94 && rx < Math.min(100, halfW * 0.16) && ry > -200 && ry < 140)
        : (Math.abs(rx) < 250 && Math.abs(ry) < 110);
    };

    // Desktop left-aligned headline position
    assert.ok(isInsideReadingZone(-200, 0, 1200), 'Desktop left-aligned headline area is in reading zone');
    assert.ok(isInsideReadingZone(0, -50, 1200), 'Midpoint text is in reading zone');

    // Desktop outer framing positions
    assert.equal(isInsideReadingZone(350, 150, 1200), false, 'Right-hand spatial area is outside reading zone');
    assert.equal(isInsideReadingZone(200, -50, 1200), false, 'Far right region is outside reading zone');

    // Mobile centered bounds
    assert.ok(isInsideReadingZone(0, 0, 500), 'Mobile center is in reading zone');
    assert.equal(isInsideReadingZone(300, 0, 500), false, 'Mobile edge is outside reading zone');
  });
});
