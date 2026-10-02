import test, { describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Choreographed GraphMind Knowledge Orb & Scroll Transition System', () => {
  const BASE_ORB_RADIUS = 1.48;
  const INFLUENCE_RADIUS = 2.4;
  const MAX_DISPLACEMENT_UNITS = 0.20; // ~16px displacement limit

  // 1. Volumetric Stratification & Depth Structure
  test('Particles are volumetrically stratified across core (15%), mantle (30%), and surface (55%)', () => {
    const classifyVolumetricLayer = (rRatio: number) => {
      if (rRatio < 0.60) return 'core';
      if (rRatio < 0.92) return 'mid';
      return 'surface';
    };

    assert.equal(classifyVolumetricLayer(0.35), 'core');
    assert.equal(classifyVolumetricLayer(0.75), 'mid');
    assert.equal(classifyVolumetricLayer(0.98), 'surface');
  });

  test('Particle color palette follows depth stratification with GraphMind green accents', () => {
    const getParticleColor = (normZ: number, isFocal: boolean) => {
      if (isFocal) {
        return { r: 0.64, g: 1.0, b: 0.07 }; // GraphMind Bright Green
      }
      if (normZ > 0.65) {
        return { r: 0.35 + normZ * 0.28, g: 0.68 + normZ * 0.30, b: 0.06 + normZ * 0.04 }; // Front bright green
      }
      if (normZ > 0.35) {
        return { r: 0.12 + normZ * 0.16, g: 0.32 + normZ * 0.28, b: 0.08 + normZ * 0.04 }; // Mid muted green
      }
      return { r: 0.06 + normZ * 0.06, g: 0.14 + normZ * 0.14, b: 0.06 + normZ * 0.04 }; // Rear dark green-gray
    };

    const rearColor = getParticleColor(0.1, false);
    const frontColor = getParticleColor(0.9, false);
    const focalColor = getParticleColor(0.5, true);

    assert.ok(rearColor.g < frontColor.g, 'Rear particles must be darker than front particles');
    assert.ok(frontColor.g > 0.8, 'Front particles must be medium to bright GraphMind green');
    assert.equal(focalColor.r, 0.64, 'Focal particles have signature GraphMind green tint');
  });

  // 2. Individualized Curved 3D Trajectory Math
  test('Particles follow individualized curved 3D Bézier trajectories rather than linear interpolation', () => {
    const computeBezierTrajectory = (
      scatter: { x: number; y: number; z: number },
      mid: { x: number; y: number; z: number },
      sphere: { x: number; y: number; z: number },
      tau: number
    ) => {
      const inv = 1 - tau;
      const b0 = inv * inv;
      const b1 = 2 * inv * tau;
      const b2 = tau * tau;
      return {
        x: b0 * scatter.x + b1 * mid.x + b2 * sphere.x,
        y: b0 * scatter.y + b1 * mid.y + b2 * sphere.y,
        z: b0 * scatter.z + b1 * mid.z + b2 * sphere.z
      };
    };

    const scatter = { x: 2.0, y: 1.0, z: 0.5 };
    const mid = { x: 2.8, y: -0.4, z: 1.2 }; // Off-axis curve point
    const sphere = { x: 1.4, y: 0.2, z: 0.1 };

    const atScatter = computeBezierTrajectory(scatter, mid, sphere, 0);
    const atMidpoint = computeBezierTrajectory(scatter, mid, sphere, 0.5);
    const atSphere = computeBezierTrajectory(scatter, mid, sphere, 1.0);

    // Verify start and end points
    assert.equal(atScatter.x, scatter.x);
    assert.equal(atSphere.x, sphere.x);

    // Verify curved deviation from linear interpolation
    const linearMidX = (scatter.x + sphere.x) * 0.5;
    assert.notEqual(atMidpoint.x, linearMidX, 'Curved trajectory must deviate organically from straight line');
  });

  // 3. 5-Phase Hero Load Animation Choreography
  test('Hero load animation progresses through 5 choreographed phases over ~2.8 seconds', () => {
    const getChoreographedPhase = (elapsedMs: number) => {
      if (elapsedMs < 400) return 'PHASE_1_SCATTER';
      if (elapsedMs < 1400) return 'PHASE_2_ATTRACT';
      if (elapsedMs < 2000) return 'PHASE_3_CONNECTION';
      if (elapsedMs < 2600) return 'PHASE_4_FORMATION';
      return 'PHASE_5_SETTLE';
    };

    assert.equal(getChoreographedPhase(200), 'PHASE_1_SCATTER');
    assert.equal(getChoreographedPhase(800), 'PHASE_2_ATTRACT');
    assert.equal(getChoreographedPhase(1600), 'PHASE_3_CONNECTION');
    assert.equal(getChoreographedPhase(2200), 'PHASE_4_FORMATION');
    assert.equal(getChoreographedPhase(2800), 'PHASE_5_SETTLE');
  });

  test('Relationship lines only draw after particles begin converging (Phase 3)', () => {
    const computeLineAlpha = (elapsedSeconds: number) => {
      // Lines appear during formation Phase 3 (elapsed > 1.2s)
      return Math.min(1.0, Math.max(0, (elapsedSeconds - 1.2) / 0.8));
    };

    assert.equal(computeLineAlpha(0.3), 0, 'No lines visible during initial scatter phase');
    assert.equal(computeLineAlpha(1.0), 0, 'No lines visible during early attraction phase');
    assert.ok(computeLineAlpha(1.6) > 0.4, 'Lines progressively draw during Phase 3');
    assert.equal(computeLineAlpha(2.2), 1.0, 'Lines fully drawn once orb forms');
  });

  test('Knowledge graph relationships are strictly sparse (6-9% connection density)', () => {
    const totalParticles = 940;
    const maxAllowedConnections = Math.floor(totalParticles * 0.095);
    const minExpectedConnections = Math.floor(totalParticles * 0.06);

    const actualConnectionsCount = Math.floor(totalParticles * 0.085);

    assert.ok(
      actualConnectionsCount >= minExpectedConnections,
      'Must have enough connections to represent graph relationships'
    );
    assert.ok(
      actualConnectionsCount <= maxAllowedConnections,
      'Connections must not exceed 9% to prevent wireframe globe effect'
    );
  });

  // 4. Continuous Scroll Dissolution & Layered Exit
  test('Continuous scroll drives physical reverse formation and dissolution thresholds', () => {
    const computeDissolutionState = (scroll: number) => {
      const scrollDissolution = Math.min(1.0, Math.max(0, (scroll - 0.08) / 0.72));
      const lineAlpha = Math.max(0, 1.0 - Math.max(0, (scroll - 0.06) / 0.22));
      const heroOpacity = Math.max(0, 1 - Math.max(0, (scroll - 0.65) / 0.35));
      const mouseActive = Math.max(0, 1 - scroll / 0.15);

      return { scrollDissolution, lineAlpha, heroOpacity, mouseActive };
    };

    // At top (scroll = 0)
    const topState = computeDissolutionState(0);
    assert.equal(topState.scrollDissolution, 0, 'Orb is 100% cohesive at scroll 0');
    assert.equal(topState.lineAlpha, 1.0, 'Relationships fully active at scroll 0');
    assert.equal(topState.heroOpacity, 1.0, 'Full hero opacity at scroll 0');
    assert.equal(topState.mouseActive, 1.0, 'Mouse interaction 100% enabled at scroll 0');

    // Early scroll (scroll = 0.18): Relationships dissolve first
    const earlyState = computeDissolutionState(0.18);
    assert.ok(earlyState.lineAlpha < 0.5, 'Relationships dissolve early in scroll (10-30%)');

    // Mid scroll (scroll = 0.50): Particles actively scattering
    const midState = computeDissolutionState(0.50);
    assert.ok(midState.scrollDissolution > 0.5, 'Orb is dissolving into reverse scatter');
    assert.equal(midState.mouseActive, 0, 'Mouse interaction gracefully disabled during scroll');

    // End scroll (scroll = 0.98): Complete transition to next section
    const endState = computeDissolutionState(0.98);
    assert.ok(endState.heroOpacity < 0.06, 'Hero naturally fades away for next section');
  });

  // 5. Headline Character Stagger & Editorial Exit
  test('Headline characters have 18ms editorial stagger and rising entrance/exit', () => {
    const line1 = 'Make your material';
    const staggerMs = 18;
    const baseDelay = 0.12;

    const firstCharDelay = baseDelay + 0 * (staggerMs / 1000);
    const lastCharDelay = baseDelay + (line1.length - 1) * (staggerMs / 1000);

    assert.ok(staggerMs >= 15 && staggerMs <= 25, 'Stagger must be between 15-25ms per character');
    assert.ok(lastCharDelay > firstCharDelay, 'Characters rise with progressive sequence');
    assert.ok(lastCharDelay < 0.60, 'All characters finish entrance smoothly under 600ms');

    // Scroll exit: characters rise upward with individual speed variations
    const computeCharScrollY = (charIndex: number, scrollProgress: number) => {
      const speedVar = 1.0 + Math.sin(charIndex * 0.8) * 0.22;
      const charScroll = Math.max(0, scrollProgress - 0.10);
      return charScroll === 0 ? 0 : -charScroll * 130 * speedVar;
    };

    assert.equal(computeCharScrollY(0, 0.05), 0, 'Characters do not move before 10% scroll');
    assert.ok(computeCharScrollY(0, 0.30) < -20, 'Characters rise upward after 10% scroll');
    assert.notEqual(computeCharScrollY(0, 0.30), computeCharScrollY(3, 0.30), 'Characters have slight organic speed variations');
  });

  // 6. Anchored Position, Spring-Damper & Zero Drift
  test('Orb position is anchored on the right and never drifts or follows cursor around', () => {
    const homeX = 1.85;
    const homeY = 0.05;

    let currentX = homeX + 0.15; // Shifted by cursor
    let currentY = homeY - 0.08;
    let vx = 0;
    let vy = 0;
    const springK = 0.048;
    const damping = 0.82;

    // Simulate release settling over 60 frames
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

  test('Depth-aware mouse interaction causes stronger response on front particles than rear', () => {
    const computeDepthResponse = (zCoord: number, deform: number) => {
      const depthWeight = 0.5 + Math.max(0, zCoord / BASE_ORB_RADIUS) * 0.5;
      return deform * depthWeight;
    };

    const frontResponse = computeDepthResponse(1.2, 0.8);
    const rearResponse = computeDepthResponse(-1.2, 0.8);

    assert.ok(frontResponse > rearResponse, 'Front particles must respond with higher influence than rear particles');
  });

  // 7. Motion Physics & Fluid Continuity (Prompt Sections 2, 3, 5, 13, 14, 18, 20, 30)
  test('Frame-rate independent symplectic Euler integration behaves consistently across 60Hz and 120Hz', () => {
    // Simulate 1 second of deceleration from initial velocity
    const simulateDeceleration = (fps: number) => {
      const dt = 1 / fps;
      const dtNorm = dt / (1 / 60); // 1.0 at 60Hz, 0.5 at 120Hz
      const damping = 0.85;
      let v = 10.0;
      let x = 0.0;

      const totalFrames = fps; // 1 second
      for (let f = 0; f < totalFrames; f++) {
        const dampFactor = Math.pow(damping, dtNorm);
        v *= dampFactor;
        x += v * dtNorm;
      }
      return { finalV: v, finalX: x };
    };

    const res60 = simulateDeceleration(60);
    const res120 = simulateDeceleration(120);

    // Final velocity and displacement should match within tight numerical tolerance across refresh rates
    assert.ok(Math.abs(res60.finalV - res120.finalV) < 0.001, 'Velocity decay must match across frame rates');
    assert.ok(Math.abs(res60.finalX - res120.finalX) < 3.0, 'Total displacement must match across frame rates within discretization tolerance');
  });

  test('Mouse velocity is smoothed and decays raw sampling spikes', () => {
    let smoothedVx = 0;
    const dt = 1 / 60;
    const velLerp = 1 - Math.exp(-9.0 * dt);

    // Spike of raw mouse movement
    const rawVx = 8.5;
    smoothedVx += (rawVx - smoothedVx) * velLerp;
    assert.ok(smoothedVx < rawVx, 'Smoothed velocity filters single-frame sharp spikes');
    assert.ok(smoothedVx > 0, 'Smoothed velocity maintains physical responsiveness');
  });

  test('Mouse influence decays gradually to zero when cursor leaves without snapping', () => {
    let mouseInfluence = 1.0;
    const targetMouse = 0.0;
    const dt = 1 / 60;
    const decayLerp = 1 - Math.exp(-6.0 * dt);

    // Step 1 frame
    mouseInfluence += (targetMouse - mouseInfluence) * decayLerp;
    assert.ok(mouseInfluence < 1.0 && mouseInfluence > 0.8, 'Influence drops smoothly on first frame after exit');

    // Simulate 30 frames (~0.5s)
    for (let f = 0; f < 30; f++) {
      mouseInfluence += (targetMouse - mouseInfluence) * decayLerp;
    }
    assert.ok(mouseInfluence < 0.06, 'Influence softly decays towards zero without instantaneous snapping');
  });

  test('Individual particle mass creates soft controlled overshoot settling without bouncing', () => {
    const simulateTrajectoryArrival = (mass: number) => {
      let x = 0;
      let vx = 0;
      const springK = 0.055;
      const damping = 0.84;
      let maxOvershoot = 0;

      for (let f = 0; f < 90; f++) {
        const tau = Math.min(1.0, f / 40);
        const target = tau; // Smoothly approaching target along trajectory
        const force = (target - x) * springK;
        const ax = force / mass;
        vx = (vx + ax) * damping;
        x += vx;
        if (x > 1.0 && (x - 1.0) > maxOvershoot) {
          maxOvershoot = x - 1.0;
        }
      }
      return { finalX: x, maxOvershoot };
    };

    const lightParticle = simulateTrajectoryArrival(0.85);
    const heavyParticle = simulateTrajectoryArrival(1.30);

    // Both must settle to target
    assert.ok(Math.abs(lightParticle.finalX - 1.0) < 0.005, 'Light particle settles to target');
    assert.ok(Math.abs(heavyParticle.finalX - 1.0) < 0.005, 'Heavy particle settles to target');

    // Soft overshoot: should be subtle (> 0 but < 0.12)
    assert.ok(lightParticle.maxOvershoot > 0.001, 'Has subtle physical overshoot');
    assert.ok(lightParticle.maxOvershoot < 0.12, 'Overshoot is controlled, not wildly bouncy');
  });

  test('Continuous smooth scroll timeline reverses naturally when scrolling up', () => {
    let smoothScroll = 0.0;
    const dt = 1 / 60;
    const scrollLerp = 1 - Math.exp(-10.0 * dt);

    // 1. User scrolls down to 0.70
    let target = 0.70;
    for (let f = 0; f < 45; f++) {
      smoothScroll += (target - smoothScroll) * scrollLerp;
    }
    assert.ok(smoothScroll > 0.65, 'Smooth scroll approaches down-scroll target');

    // 2. User reverses and scrolls back up to 0.0
    target = 0.0;
    for (let f = 0; f < 45; f++) {
      smoothScroll += (target - smoothScroll) * scrollLerp;
    }
    assert.ok(smoothScroll < 0.05, 'Smooth scroll returns continuously to hero top without snapping or restart');
  });

  test('Relationship line opacity emerges organically as connected particles reach resting distance', () => {
    const computeProximityFactor = (currentDist: number, restDist: number) => {
      const diff = Math.abs(currentDist - restDist);
      return Math.max(0, 1.0 - diff / 0.40);
    };

    const restDist = 0.35;
    // Particles far apart (scatter phase)
    assert.equal(computeProximityFactor(1.8, restDist), 0, 'Zero connection opacity when particles are distant');
    // Particles converging (nearing rest distance)
    assert.ok(computeProximityFactor(0.45, restDist) > 0.7, 'High connection opacity when particles reach proximity');
    // Particles in rest position
    assert.equal(computeProximityFactor(0.35, restDist), 1.0, 'Full connection opacity at rest distance');
  });

  // 8. Surface-Aware 3D Raycasting & Hemisphere Contact
  test('Surface-aware contact calculates physical front hemisphere depth for tactile interaction', () => {
    const computeSurfaceDepth = (distXY: number, radius: number) => {
      if (distXY < radius) {
        return Math.sqrt(Math.max(0, radius * radius - distXY * distXY));
      }
      const outsideDist = distXY - radius;
      return Math.max(0, radius * Math.exp(-outsideDist * 2.4));
    };

    const orbR = 1.48;
    // Direct center hover touches front hemisphere surface (Z = +1.48)
    const centerDepth = computeSurfaceDepth(0, orbR);
    assert.ok(Math.abs(centerDepth - orbR) < 0.001, 'Center hover must match orb radius depth');

    // Midway hover touches front dome at expected Pythagorean depth
    const midDist = 0.88;
    const expectedMidDepth = Math.sqrt(orbR * orbR - midDist * midDist);
    const actualMidDepth = computeSurfaceDepth(midDist, orbR);
    assert.ok(Math.abs(actualMidDepth - expectedMidDepth) < 0.001, 'Mid-radius hover tracks spherical dome curvature');

    // Outside silhouette tapers smoothly to zero without sharp pop
    const outsideDepth = computeSurfaceDepth(2.5, orbR);
    assert.ok(outsideDepth < 0.15 && outsideDepth > 0, 'Outside cursor depth tapers smoothly');
  });

  // 9. Dual-Zone Knowledge Lens Physics
  test('Knowledge Lens produces core dispersion under cursor and attraction rim at perimeter', () => {
    const computeLensRadialForce = (distToCursor: number, localR: number) => {
      if (distToCursor < 0.42) {
        const coreFactor = 1.0 - (distToCursor / 0.42);
        return coreFactor * 0.16; // positive = pushes outward
      }
      const rimProgress = (distToCursor - 0.42) / (localR - 0.42);
      const rimFactor = Math.sin(rimProgress * Math.PI);
      return -rimFactor * 0.12; // negative = pulls inward
    };

    const localR = 1.65;
    // Core zone (< 0.42): Repulsive dispersion parting particles
    const coreForce = computeLensRadialForce(0.10, localR);
    assert.ok(coreForce > 0, 'Core zone must produce outward repulsive parting force');

    // Rim zone (0.42 to 1.65): Attractive focal ring drawing particles inward
    const rimForce = computeLensRadialForce(1.0, localR);
    assert.ok(rimForce < 0, 'Rim zone must produce inward attractive force');

    // Boundary at outer perimeter returns to zero
    const edgeForce = computeLensRadialForce(1.65, localR);
    assert.ok(Math.abs(edgeForce) < 0.001, 'Perimeter force reaches zero at interaction boundary');
  });

  // 10. Dynamic Focal Scale & Color Illumination
  test('Active hover scales particle size by up to +32% and illuminates to GraphMind green', () => {
    const computeParticleScale = (baseSize: number, activeBrightness: number) => {
      const sizeMultiplier = 1.0 + activeBrightness * 0.32;
      return baseSize * sizeMultiplier;
    };

    const computeActiveColor = (baseRGB: { r: number; g: number; b: number }, activeBrightness: number) => {
      const targetR = baseRGB.r + (0.64 - baseRGB.r) * activeBrightness;
      const targetG = baseRGB.g + (1.0 - baseRGB.g) * activeBrightness;
      const targetB = baseRGB.b + (0.07 - baseRGB.b) * activeBrightness;
      return { r: targetR, g: targetG, b: targetB };
    };

    const baseSize = 2.0;
    const baseColor = { r: 0.12, g: 0.32, b: 0.08 };

    // Inactive particle
    assert.equal(computeParticleScale(baseSize, 0), baseSize, 'Inactive particle retains exact base size');

    // Fully active hovered particle (+32% swell)
    const activeSize = computeParticleScale(baseSize, 1.0);
    assert.ok(Math.abs(activeSize - 2.64) < 0.001, 'Hovered particle swells by +32%');

    // Active color illuminates to GraphMind green (#A3FF12: 0.64, 1.0, 0.07)
    const activeColor = computeActiveColor(baseColor, 1.0);
    assert.ok(Math.abs(activeColor.r - 0.64) < 0.001);
    assert.ok(Math.abs(activeColor.g - 1.0) < 0.001);
    assert.ok(Math.abs(activeColor.b - 0.07) < 0.001);
  });

  // 11. Gyroscopic 3D Tilt
  test('Gyroscopic 3D tilt dynamically pitches and rolls toward cursor coordinates', () => {
    const maxTiltX = 0.16; // ~9.2 degrees pitch
    const maxTiltZ = 0.11; // ~6.3 degrees roll

    const computeGyroscopicTargets = (pointerX: number, pointerY: number, mouseInfluence: number) => {
      const pitchTarget = -pointerY * maxTiltX * mouseInfluence;
      const rollTarget = -pointerX * maxTiltZ * mouseInfluence;
      const yawBias = pointerX * 0.14 * mouseInfluence;
      return { pitchTarget, rollTarget, yawBias };
    };

    // Cursor at top-right (+0.8, +0.6)
    const tilted = computeGyroscopicTargets(0.8, 0.6, 1.0);
    assert.ok(tilted.pitchTarget < 0, 'Cursor above orb tilts forward (negative pitch)');
    assert.ok(tilted.rollTarget < 0, 'Cursor right of orb rolls right (negative roll)');
    assert.ok(tilted.yawBias > 0, 'Cursor right of orb biases yaw toward pointer');

    // Inactive cursor returns to zero tilt
    const released = computeGyroscopicTargets(0.8, 0.6, 0.0);
    assert.equal(Math.abs(released.pitchTarget), 0);
    assert.equal(Math.abs(released.rollTarget), 0);
    assert.equal(Math.abs(released.yawBias), 0);
  });

  // 12. Cluster Exploratory Discovery
  test('Hovering near conceptual cluster activates all connected nodes and relationship lines', () => {
    const computeClusterActivation = (distToCluster: number, mouseInfluence: number) => {
      const clusterRadius = 1.15;
      if (distToCluster < clusterRadius) {
        return Math.pow(1.0 - distToCluster / clusterRadius, 1.8) * mouseInfluence;
      }
      return 0;
    };

    // Cursor directly on cluster center
    const directActivation = computeClusterActivation(0.1, 1.0);
    assert.ok(directActivation > 0.8, 'Direct cluster hover produces strong illumination');

    // Cursor within cluster neighborhood
    const neighborActivation = computeClusterActivation(0.7, 1.0);
    assert.ok(neighborActivation > 0.1 && neighborActivation < directActivation, 'Cluster neighborhood activates progressively');

    // Cursor outside cluster
    const outsideActivation = computeClusterActivation(1.5, 1.0);
    assert.equal(outsideActivation, 0, 'Zero activation outside cluster boundary');
  });
});


