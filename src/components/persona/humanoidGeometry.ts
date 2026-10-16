import * as THREE from 'three';
import { PERSONA_SURFACE_POINTS } from './personaSurfaceData';

export type BodyRegion =
  | 'feet'
  | 'lower_legs'
  | 'upper_legs'
  | 'pelvis'
  | 'abdomen'
  | 'chest'
  | 'arms'
  | 'neck'
  | 'head';

export interface BodyPartSpec {
  name: string;
  region: BodyRegion;
  geometry: THREE.BufferGeometry;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  surfaceWeight: number;
}

export interface HumanoidParticleData {
  // Target position on 3D humanoid model surface
  targetX: number;
  targetY: number;
  targetZ: number;

  // Surface normal for lighting & offset effects
  normalX: number;
  normalY: number;
  normalZ: number;

  // Initial spherical position in GraphMind particle sphere
  sphereX: number;
  sphereY: number;
  sphereZ: number;

  // Curved trajectory control point for Phase A
  curveMidX: number;
  curveMidY: number;
  curveMidZ: number;

  // Animation timing offsets
  formationDelay: number;
  formationDuration: number;

  // Height and anatomical region for Phase B bottom-up solidification
  yHeight: number;
  region: BodyRegion;

  // Visual attributes
  baseSize: number;
  baseR: number;
  baseG: number;
  baseB: number;
  isAccent: boolean;
}

/**
 * Vertical bounds for the anatomical body regions framed chest-up (strictly ordered from bottom to top)
 */
export const BODY_REGIONS_HEIGHTS: Record<BodyRegion, { minY: number; maxY: number; order: number }> = {
  feet: { minY: -0.45, maxY: -0.40, order: 1 },
  lower_legs: { minY: -0.40, maxY: -0.36, order: 2 },
  upper_legs: { minY: -0.36, maxY: -0.32, order: 3 },
  pelvis: { minY: -0.32, maxY: -0.28, order: 4 },
  abdomen: { minY: -0.28, maxY: -0.22, order: 5 },
  chest: { minY: -0.22, maxY: -0.06, order: 6 },
  arms: { minY: -0.25, maxY: 0.05, order: 7 },
  neck: { minY: -0.06, maxY: 0.05, order: 8 },
  head: { minY: 0.05, maxY: 0.32, order: 9 }
};

/**
 * Vertical bounds for the chest-up framed Persona character (upper chest to top of hair)
 */
export const CHARACTER_Y_BOUNDS = {
  min: -0.35,
  max: 0.30
};

/**
 * Builds the geometric specification of the chest-up humanoid character.
 * Used for fallback rendering and spatial unit testing.
 */
export function createHumanoidBodyParts(): BodyPartSpec[] {
  const parts: BodyPartSpec[] = [];

  // Head
  const headGeo = new THREE.SphereGeometry(0.12, 24, 20);
  headGeo.scale(0.85, 1.15, 0.95);
  parts.push({
    name: 'head',
    region: 'head',
    geometry: headGeo,
    position: new THREE.Vector3(0, 0.16, 0.02),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    surfaceWeight: 1.5
  });

  // Neck
  const neckGeo = new THREE.CylinderGeometry(0.055, 0.065, 0.09, 16);
  parts.push({
    name: 'neck',
    region: 'neck',
    geometry: neckGeo,
    position: new THREE.Vector3(0, 0.01, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    surfaceWeight: 0.6
  });

  // Chest / Upper Torso
  const chestGeo = new THREE.CylinderGeometry(0.19, 0.17, 0.20, 20);
  chestGeo.scale(1.15, 1.0, 0.65);
  parts.push({
    name: 'chest',
    region: 'chest',
    geometry: chestGeo,
    position: new THREE.Vector3(0, -0.15, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    surfaceWeight: 1.8
  });

  // Shoulders & Arms
  const shoulderGeoL = new THREE.SphereGeometry(0.068, 16, 14);
  const shoulderGeoR = new THREE.SphereGeometry(0.068, 16, 14);
  parts.push({
    name: 'shoulder_l',
    region: 'arms',
    geometry: shoulderGeoL,
    position: new THREE.Vector3(0.24, -0.09, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 0.9),
    surfaceWeight: 0.6
  });
  parts.push({
    name: 'shoulder_r',
    region: 'arms',
    geometry: shoulderGeoR,
    position: new THREE.Vector3(-0.24, -0.09, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 0.9),
    surfaceWeight: 0.6
  });

  const armGeoL = new THREE.CylinderGeometry(0.055, 0.048, 0.18, 14);
  const armGeoR = new THREE.CylinderGeometry(0.055, 0.048, 0.18, 14);
  parts.push({
    name: 'upper_arm_l',
    region: 'arms',
    geometry: armGeoL,
    position: new THREE.Vector3(0.26, -0.22, 0),
    rotation: new THREE.Euler(0, 0, 0.08),
    scale: new THREE.Vector3(1, 1, 1),
    surfaceWeight: 0.8
  });
  parts.push({
    name: 'upper_arm_r',
    region: 'arms',
    geometry: armGeoR,
    position: new THREE.Vector3(-0.26, -0.22, 0),
    rotation: new THREE.Euler(0, 0, -0.08),
    scale: new THREE.Vector3(1, 1, 1),
    surfaceWeight: 0.8
  });

  // Lower support masses for tests
  const lowerGeo = new THREE.BoxGeometry(0.05, 0.04, 0.05);
  for (const reg of ['abdomen', 'pelvis', 'upper_legs', 'lower_legs', 'feet'] as BodyRegion[]) {
    parts.push({
      name: reg,
      region: reg,
      geometry: lowerGeo,
      position: new THREE.Vector3(0, BODY_REGIONS_HEIGHTS[reg].minY, 0),
      rotation: new THREE.Euler(0, 0, 0),
      scale: new THREE.Vector3(1, 1, 1),
      surfaceWeight: 0.1
    });
  }

  return parts;
}

/**
 * Builds the fallback 3D mesh group of the humanoid character.
 */
export function buildHumanoidMesh(material: THREE.Material): THREE.Group {
  const group = new THREE.Group();
  group.name = 'solid-humanoid-character';

  const parts = createHumanoidBodyParts();
  for (const part of parts) {
    const mesh = new THREE.Mesh(part.geometry, material);
    mesh.name = part.name;
    mesh.position.copy(part.position);
    mesh.rotation.copy(part.rotation);
    mesh.scale.copy(part.scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData = { region: part.region };
    group.add(mesh);
  }

  return group;
}

/**
 * Samples surface points from the high-quality 3D human model.
 * Each particle has an exact starting Fibonacci position in the particle sphere,
 * a natural cubic bezier trajectory, and a target surface position on the human model.
 */
export function sampleHumanoidSurfacePoints(
  count: number,
  initialSphereRadius: number = 1.48
): HumanoidParticleData[] {
  const particleData: HumanoidParticleData[] = [];
  const sourcePoints = PERSONA_SURFACE_POINTS;
  const numSource = sourcePoints.length;

  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  const angleIncrement = Math.PI * 2 * goldenRatio;

  for (let i = 0; i < count; i++) {
    // 1. Pick surface point from 3D model
    const srcIdx = Math.min(Math.floor((i / count) * numSource), numSource - 1);
    const pt = sourcePoints[srcIdx];

    const targetX = pt.x;
    const targetY = pt.y;
    const targetZ = pt.z;
    const normalX = pt.nx;
    const normalY = pt.ny;
    const normalZ = pt.nz;

    // 2. Fibonacci spiral spherical distribution (GraphMind landing page particle sphere)
    const t = i / count;
    const phi = Math.acos(1 - 2 * (t + 0.5 / count));
    const theta = angleIncrement * i;

    // Slight radius variation for organic particle cloud
    const rVariation = 0.88 + 0.24 * Math.sin(i * 3.71 + 0.4);
    const r = initialSphereRadius * rVariation;

    const sphereX = r * Math.sin(phi) * Math.cos(theta);
    const sphereY = r * Math.cos(phi);
    const sphereZ = r * Math.sin(phi) * Math.sin(theta);

    // 3. Curved trajectory control point for Phase A
    const midT = 0.5;
    const dirX = targetX - sphereX;
    const dirY = targetY - sphereY;
    const dirZ = targetZ - sphereZ;

    // Subtle tangential curl
    const tangentX = -dirZ * 0.25;
    const tangentY = (Math.sin(i * 1.5) - 0.2) * 0.3;
    const tangentZ = dirX * 0.25;

    const curveMidX = sphereX + dirX * midT + tangentX;
    const curveMidY = sphereY + dirY * midT + tangentY;
    const curveMidZ = sphereZ + dirZ * midT + tangentZ;

    // 4. Staggered formation delays
    const normH = Math.max(0, Math.min(1, (targetY - CHARACTER_Y_BOUNDS.min) / (CHARACTER_Y_BOUNDS.max - CHARACTER_Y_BOUNDS.min)));
    const formationDelay = normH * 0.45 + (Math.sin(i * 5.3) * 0.5 + 0.5) * 0.2;
    const formationDuration = 0.65 + (Math.cos(i * 2.7) * 0.5 + 0.5) * 0.25;

    // 5. Region classification
    let region: BodyRegion = 'chest';
    if (targetY >= 0.18) region = 'head';
    else if (targetY >= 0.05) region = 'head'; // face is part of head region
    else if (targetY >= -0.06) region = 'neck';
    else if (Math.abs(targetX) > 0.22) region = 'arms';
    else region = 'chest';

    // 6. Signature GraphMind palette: warm ivory, sleek silver, and lime-green (#A3FF12) accents
    const isAccent = i % 8 === 0;
    const isCoolSilver = !isAccent && i % 3 === 0;

    let baseR = 0.96;
    let baseG = 0.95;
    let baseB = 0.92;
    let baseSize = 0.038 + (i % 5) * 0.004;

    if (isAccent) {
      // GraphMind Lime Green (#A3FF12)
      baseR = 0.64;
      baseG = 1.0;
      baseB = 0.07;
      baseSize = 0.046;
    } else if (isCoolSilver) {
      baseR = 0.78;
      baseG = 0.82;
      baseB = 0.88;
    }

    particleData.push({
      targetX,
      targetY,
      targetZ,
      normalX,
      normalY,
      normalZ,
      sphereX,
      sphereY,
      sphereZ,
      curveMidX,
      curveMidY,
      curveMidZ,
      formationDelay,
      formationDuration,
      yHeight: targetY,
      region,
      baseSize,
      baseR,
      baseG,
      baseB,
      isAccent
    });
  }

  return particleData;
}
