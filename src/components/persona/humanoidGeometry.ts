import * as THREE from 'three';

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
  surfaceWeight: number; // Proportional weight for surface particle sampling
}

export interface HumanoidParticleData {
  // Target position on humanoid surface
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
 * Vertical bounds for the anatomical body regions (strictly ordered from bottom to top)
 */
export const BODY_REGIONS_HEIGHTS: Record<BodyRegion, { minY: number; maxY: number; order: number }> = {
  feet: { minY: -1.18, maxY: -1.06, order: 1 },
  lower_legs: { minY: -1.06, maxY: -0.56, order: 2 },
  upper_legs: { minY: -0.56, maxY: -0.10, order: 3 },
  pelvis: { minY: -0.10, maxY: 0.12, order: 4 },
  abdomen: { minY: 0.12, maxY: 0.36, order: 5 },
  chest: { minY: 0.36, maxY: 0.66, order: 6 },
  arms: { minY: -0.22, maxY: 0.64, order: 7 },
  neck: { minY: 0.66, maxY: 0.80, order: 8 },
  head: { minY: 0.80, maxY: 1.15, order: 9 }
};

export const CHARACTER_Y_BOUNDS = {
  min: -1.20,
  max: 1.18
};

/**
 * Builds the geometric specification of the abstract humanoid character.
 * Sculptural, athletic proportions: neutral upright posture with readable silhouette separation.
 */
export function createHumanoidBodyParts(): BodyPartSpec[] {
  const parts: BodyPartSpec[] = [];

  // 1. Head (Sculptural tapered ellipsoid)
  const headGeo = new THREE.SphereGeometry(0.16, 24, 20);
  headGeo.scale(0.88, 1.16, 0.94);
  parts.push({
    name: 'head',
    region: 'head',
    geometry: headGeo,
    position: new THREE.Vector3(0, 0.96, 0.02),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    surfaceWeight: 1.2
  });

  // 2. Neck (Tapered cylinder)
  const neckGeo = new THREE.CylinderGeometry(0.075, 0.095, 0.14, 16);
  parts.push({
    name: 'neck',
    region: 'neck',
    geometry: neckGeo,
    position: new THREE.Vector3(0, 0.73, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    surfaceWeight: 0.35
  });

  // 3. Chest / Upper Torso (Athletic sculptural trapezoid)
  const chestGeo = new THREE.CylinderGeometry(0.24, 0.19, 0.30, 20);
  chestGeo.scale(1.08, 1.0, 0.65);
  parts.push({
    name: 'chest',
    region: 'chest',
    geometry: chestGeo,
    position: new THREE.Vector3(0, 0.51, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    surfaceWeight: 1.6
  });

  // 4. Abdomen / Waist (Tapered transition)
  const abdomenGeo = new THREE.CylinderGeometry(0.18, 0.175, 0.24, 18);
  abdomenGeo.scale(1.02, 1.0, 0.62);
  parts.push({
    name: 'abdomen',
    region: 'abdomen',
    geometry: abdomenGeo,
    position: new THREE.Vector3(0, 0.24, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    surfaceWeight: 1.1
  });

  // 5. Pelvis / Hips (Sculptural base)
  const pelvisGeo = new THREE.CylinderGeometry(0.175, 0.195, 0.20, 18);
  pelvisGeo.scale(1.06, 1.0, 0.66);
  parts.push({
    name: 'pelvis',
    region: 'pelvis',
    geometry: pelvisGeo,
    position: new THREE.Vector3(0, 0.02, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    surfaceWeight: 1.1
  });

  // 6. Shoulders (Left & Right deltoid spheres)
  const shoulderGeoL = new THREE.SphereGeometry(0.082, 16, 14);
  const shoulderGeoR = new THREE.SphereGeometry(0.082, 16, 14);
  parts.push({
    name: 'shoulder_l',
    region: 'chest',
    geometry: shoulderGeoL,
    position: new THREE.Vector3(-0.29, 0.59, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1.1, 1, 0.9),
    surfaceWeight: 0.4
  });
  parts.push({
    name: 'shoulder_r',
    region: 'chest',
    geometry: shoulderGeoR,
    position: new THREE.Vector3(0.29, 0.59, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1.1, 1, 0.9),
    surfaceWeight: 0.4
  });

  // 7. Upper Arms (Tapered cylinders with slight outward separation for readable silhouette)
  const upperArmGeoL = new THREE.CylinderGeometry(0.065, 0.055, 0.28, 16);
  const upperArmGeoR = new THREE.CylinderGeometry(0.065, 0.055, 0.28, 16);
  parts.push({
    name: 'upper_arm_l',
    region: 'arms',
    geometry: upperArmGeoL,
    position: new THREE.Vector3(-0.35, 0.38, 0),
    rotation: new THREE.Euler(0, 0, -0.14),
    scale: new THREE.Vector3(1, 1, 1),
    surfaceWeight: 0.75
  });
  parts.push({
    name: 'upper_arm_r',
    region: 'arms',
    geometry: upperArmGeoR,
    position: new THREE.Vector3(0.35, 0.38, 0),
    rotation: new THREE.Euler(0, 0, 0.14),
    scale: new THREE.Vector3(1, 1, 1),
    surfaceWeight: 0.75
  });

  // 8. Forearms (Tapered cylinders)
  const forearmGeoL = new THREE.CylinderGeometry(0.055, 0.045, 0.28, 16);
  const forearmGeoR = new THREE.CylinderGeometry(0.055, 0.045, 0.28, 16);
  parts.push({
    name: 'forearm_l',
    region: 'arms',
    geometry: forearmGeoL,
    position: new THREE.Vector3(-0.40, 0.10, 0.02),
    rotation: new THREE.Euler(0.08, 0, -0.16),
    scale: new THREE.Vector3(1, 1, 1),
    surfaceWeight: 0.65
  });
  parts.push({
    name: 'forearm_r',
    region: 'arms',
    geometry: forearmGeoR,
    position: new THREE.Vector3(0.40, 0.10, 0.02),
    rotation: new THREE.Euler(0.08, 0, 0.16),
    scale: new THREE.Vector3(1, 1, 1),
    surfaceWeight: 0.65
  });

  // 9. Hands (Sculptural digital paddles)
  const handGeoL = new THREE.BoxGeometry(0.05, 0.12, 0.035);
  const handGeoR = new THREE.BoxGeometry(0.05, 0.12, 0.035);
  parts.push({
    name: 'hand_l',
    region: 'arms',
    geometry: handGeoL,
    position: new THREE.Vector3(-0.43, -0.12, 0.03),
    rotation: new THREE.Euler(0.05, 0, -0.15),
    scale: new THREE.Vector3(1, 1, 1),
    surfaceWeight: 0.35
  });
  parts.push({
    name: 'hand_r',
    region: 'arms',
    geometry: handGeoR,
    position: new THREE.Vector3(0.43, -0.12, 0.03),
    rotation: new THREE.Euler(0.05, 0, 0.15),
    scale: new THREE.Vector3(1, 1, 1),
    surfaceWeight: 0.35
  });

  // 10. Thighs / Upper Legs
  const thighGeoL = new THREE.CylinderGeometry(0.095, 0.075, 0.44, 18);
  const thighGeoR = new THREE.CylinderGeometry(0.095, 0.075, 0.44, 18);
  thighGeoL.scale(1.0, 1.0, 0.9);
  thighGeoR.scale(1.0, 1.0, 0.9);
  parts.push({
    name: 'thigh_l',
    region: 'upper_legs',
    geometry: thighGeoL,
    position: new THREE.Vector3(-0.125, -0.32, 0),
    rotation: new THREE.Euler(0, 0, 0.03),
    scale: new THREE.Vector3(1, 1, 1),
    surfaceWeight: 1.3
  });
  parts.push({
    name: 'thigh_r',
    region: 'upper_legs',
    geometry: thighGeoR,
    position: new THREE.Vector3(0.125, -0.32, 0),
    rotation: new THREE.Euler(0, 0, -0.03),
    scale: new THREE.Vector3(1, 1, 1),
    surfaceWeight: 1.3
  });

  // 11. Knees
  const kneeGeoL = new THREE.SphereGeometry(0.07, 14, 12);
  const kneeGeoR = new THREE.SphereGeometry(0.07, 14, 12);
  parts.push({
    name: 'knee_l',
    region: 'upper_legs',
    geometry: kneeGeoL,
    position: new THREE.Vector3(-0.12, -0.55, 0.01),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1.1, 1),
    surfaceWeight: 0.3
  });
  parts.push({
    name: 'knee_r',
    region: 'upper_legs',
    geometry: kneeGeoR,
    position: new THREE.Vector3(0.12, -0.55, 0.01),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1.1, 1),
    surfaceWeight: 0.3
  });

  // 12. Calves / Lower Legs
  const calfGeoL = new THREE.CylinderGeometry(0.075, 0.055, 0.48, 18);
  const calfGeoR = new THREE.CylinderGeometry(0.075, 0.055, 0.48, 18);
  calfGeoL.scale(0.95, 1.0, 0.9);
  calfGeoR.scale(0.95, 1.0, 0.9);
  parts.push({
    name: 'calf_l',
    region: 'lower_legs',
    geometry: calfGeoL,
    position: new THREE.Vector3(-0.118, -0.81, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    surfaceWeight: 1.25
  });
  parts.push({
    name: 'calf_r',
    region: 'lower_legs',
    geometry: calfGeoR,
    position: new THREE.Vector3(0.118, -0.81, 0),
    rotation: new THREE.Euler(0, 0, 0),
    scale: new THREE.Vector3(1, 1, 1),
    surfaceWeight: 1.25
  });

  // 13. Feet (Clean geometric shoe/wedge)
  const footGeoL = new THREE.BoxGeometry(0.09, 0.07, 0.20);
  const footGeoR = new THREE.BoxGeometry(0.09, 0.07, 0.20);
  parts.push({
    name: 'foot_l',
    region: 'feet',
    geometry: footGeoL,
    position: new THREE.Vector3(-0.12, -1.11, 0.04),
    rotation: new THREE.Euler(-0.06, 0.05, 0),
    scale: new THREE.Vector3(1, 1, 1),
    surfaceWeight: 0.55
  });
  parts.push({
    name: 'foot_r',
    region: 'feet',
    geometry: footGeoR,
    position: new THREE.Vector3(0.12, -1.11, 0.04),
    rotation: new THREE.Euler(-0.06, -0.05, 0),
    scale: new THREE.Vector3(1, 1, 1),
    surfaceWeight: 0.55
  });

  return parts;
}

/**
 * Builds the complete 3D solid mesh group of the humanoid character.
 * Uses shared geometry with the sampled particles for zero drift and perfect alignment.
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
 * Deterministic pseudo-random number generator (LCG)
 * Guarantees identical particle assignments across all sessions and runs.
 */
function createSeededRandom(seed: number = 19720412) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/**
 * Samples points uniformly from the surface of a THREE.BufferGeometry.
 */
function sampleGeometrySurface(
  geometry: THREE.BufferGeometry,
  count: number,
  transformMatrix: THREE.Matrix4,
  rng: () => number
): { points: THREE.Vector3[]; normals: THREE.Vector3[] } {
  const points: THREE.Vector3[] = [];
  const normals: THREE.Vector3[] = [];

  const posAttr = geometry.attributes.position;
  const normalAttr = geometry.attributes.normal;
  const indexAttr = geometry.index;

  const normalMatrix = new THREE.Matrix3().getNormalMatrix(transformMatrix);

  if (!posAttr) return { points, normals };

  const triangleCount = indexAttr ? indexAttr.count / 3 : posAttr.count / 3;
  if (triangleCount === 0) return { points, normals };

  // Calculate cumulative areas of triangles for uniform area-weighted sampling
  const cumulativeAreas: number[] = new Array(triangleCount);
  let totalArea = 0;

  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const edge1 = new THREE.Vector3();
  const edge2 = new THREE.Vector3();
  const cross = new THREE.Vector3();

  for (let t = 0; t < triangleCount; t++) {
    const iA = indexAttr ? indexAttr.getX(t * 3) : t * 3;
    const iB = indexAttr ? indexAttr.getX(t * 3 + 1) : t * 3 + 1;
    const iC = indexAttr ? indexAttr.getX(t * 3 + 2) : t * 3 + 2;

    vA.fromBufferAttribute(posAttr, iA);
    vB.fromBufferAttribute(posAttr, iB);
    vC.fromBufferAttribute(posAttr, iC);

    edge1.subVectors(vB, vA);
    edge2.subVectors(vC, vA);
    cross.crossVectors(edge1, edge2);
    const triArea = 0.5 * cross.length();

    totalArea += triArea;
    cumulativeAreas[t] = totalArea;
  }

  const nA = new THREE.Vector3();
  const nB = new THREE.Vector3();
  const nC = new THREE.Vector3();

  for (let i = 0; i < count; i++) {
    // Select triangle with probability proportional to area
    const r = rng() * totalArea;
    let low = 0;
    let high = triangleCount - 1;
    let triIdx = 0;

    while (low <= high) {
      const mid = (low + high) >> 1;
      if (cumulativeAreas[mid] >= r) {
        triIdx = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }

    const iA = indexAttr ? indexAttr.getX(triIdx * 3) : triIdx * 3;
    const iB = indexAttr ? indexAttr.getX(triIdx * 3 + 1) : triIdx * 3 + 1;
    const iC = indexAttr ? indexAttr.getX(triIdx * 3 + 2) : triIdx * 3 + 2;

    vA.fromBufferAttribute(posAttr, iA);
    vB.fromBufferAttribute(posAttr, iB);
    vC.fromBufferAttribute(posAttr, iC);

    if (normalAttr) {
      nA.fromBufferAttribute(normalAttr, iA);
      nB.fromBufferAttribute(normalAttr, iB);
      nC.fromBufferAttribute(normalAttr, iC);
    } else {
      nA.set(0, 1, 0);
      nB.set(0, 1, 0);
      nC.set(0, 1, 0);
    }

    // Uniform point in triangle
    const r1 = rng();
    const r2 = rng();
    const sqrtR1 = Math.sqrt(r1);
    const u = 1 - sqrtR1;
    const v = r2 * sqrtR1;
    const w = 1 - u - v;

    const p = new THREE.Vector3(
      u * vA.x + v * vB.x + w * vC.x,
      u * vA.y + v * vB.y + w * vC.y,
      u * vA.z + v * vB.z + w * vC.z
    );

    const n = new THREE.Vector3(
      u * nA.x + v * nB.x + w * nC.x,
      u * nA.y + v * nB.y + w * nC.y,
      u * nA.z + v * nB.z + w * nC.z
    );

    // Transform to character coordinate space
    p.applyMatrix4(transformMatrix);
    n.applyMatrix3(normalMatrix).normalize();

    points.push(p);
    normals.push(n);
  }

  return { points, normals };
}

/**
 * Generates deterministic surface-sampled particles across the entire humanoid anatomy.
 * Computes exact spherical starting points matching the landing page particle sphere.
 */
export function sampleHumanoidSurfacePoints(
  totalCount: number = 1600,
  baseOrbRadius: number = 1.48
): HumanoidParticleData[] {
  const parts = createHumanoidBodyParts();
  const totalWeight = parts.reduce((acc, part) => acc + part.surfaceWeight, 0);
  const rng = createSeededRandom(20261016);

  // Calculate exact integer quota per part summing strictly to totalCount
  const rawQuotas = parts.map((p) => Math.max(1, (p.surfaceWeight / totalWeight) * totalCount));
  const rawSum = rawQuotas.reduce((a, b) => a + b, 0);
  const quotas = rawQuotas.map((q) => Math.max(1, Math.round((q / rawSum) * totalCount)));
  let currentSum = quotas.reduce((a, b) => a + b, 0);

  let qIdx = 0;
  while (currentSum < totalCount) {
    quotas[qIdx % parts.length]++;
    currentSum++;
    qIdx++;
  }
  while (currentSum > totalCount) {
    if (quotas[qIdx % parts.length] > 1) {
      quotas[qIdx % parts.length]--;
      currentSum--;
    }
    qIdx++;
  }

  const particles: HumanoidParticleData[] = [];
  let globalIndex = 0;

  for (let pIdx = 0; pIdx < parts.length; pIdx++) {
    const part = parts[pIdx];
    const partCount = quotas[pIdx];

    // Construct local-to-world matrix for this part
    const matrix = new THREE.Matrix4();
    const position = part.position;
    const quaternion = new THREE.Quaternion().setFromEuler(part.rotation);
    const scale = part.scale;
    matrix.compose(position, quaternion, scale);

    const { points, normals } = sampleGeometrySurface(part.geometry, partCount, matrix, rng);

    for (let i = 0; i < points.length; i++) {
      const target = points[i];
      const norm = normals[i];

      // A. Initial Sphere Position (Fibonacci sphere distribution matching KnowledgeOrb3D.tsx)
      const phiAngle = Math.acos(1 - (2 * (globalIndex + 0.5)) / totalCount);
      const thetaAngle = Math.PI * (1 + Math.sqrt(5)) * globalIndex;

      // Volumetric sphere layering
      const layerRand = rng();
      const rRatio = layerRand < 0.15 ? 0.35 + rng() * 0.3 : 0.88 + rng() * 0.18;
      const r = baseOrbRadius * rRatio;

      const sphereX = Math.sin(phiAngle) * Math.cos(thetaAngle) * r;
      const sphereY = Math.cos(phiAngle) * r;
      const sphereZ = Math.sin(phiAngle) * Math.sin(thetaAngle) * r;

      // B. Curved 3D Trajectory Control Point for Phase A
      const curveAngle = rng() * Math.PI * 2;
      const curveArc = 0.4 + rng() * 0.6;
      const curveMidX = (sphereX + target.x) * 0.5 + Math.cos(curveAngle) * curveArc;
      const curveMidY = (sphereY + target.y) * 0.5 + Math.sin(curveAngle) * curveArc;
      const curveMidZ = (sphereZ + target.z) * 0.5 + (rng() - 0.5) * 0.8;

      // C. Trajectory timing offsets (organized but with natural fluid variance)
      const formationDelay = rng() * 0.4;
      const formationDuration = 1.6 + rng() * 0.5;

      // D. Particle visual styling (Lime accents matching GraphMind brand)
      const isAccent = rng() < 0.22;
      const isFocal = isAccent && rng() < 0.35;

      const baseSize = isFocal
        ? 3.8 + rng() * 0.6
        : isAccent
        ? 2.4 + rng() * 0.5
        : 1.4 + rng() * 0.6;

      let baseR = 0.08;
      let baseG = 0.22;
      let baseB = 0.10;

      if (isFocal) {
        baseR = 0.64;
        baseG = 1.0;
        baseB = 0.07;
      } else if (isAccent) {
        baseR = 0.42;
        baseG = 0.82;
        baseB = 0.08;
      } else {
        const whiteTint = 0.7 + rng() * 0.3;
        baseR = 0.85 * whiteTint;
        baseG = 0.88 * whiteTint;
        baseB = 0.90 * whiteTint;
      }

      particles.push({
        targetX: target.x,
        targetY: target.y,
        targetZ: target.z,
        normalX: norm.x,
        normalY: norm.y,
        normalZ: norm.z,
        sphereX,
        sphereY,
        sphereZ,
        curveMidX,
        curveMidY,
        curveMidZ,
        formationDelay,
        formationDuration,
        yHeight: target.y,
        region: part.region,
        baseSize,
        baseR,
        baseG,
        baseB,
        isAccent
      });

      globalIndex++;
    }
  }

  return particles;
}
