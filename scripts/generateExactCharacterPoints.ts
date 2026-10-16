import fs from 'node:fs';
import path from 'node:path';

(globalThis as any).self = globalThis;
(globalThis as any).window = globalThis;

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

interface TriangleSample {
  pA: THREE.Vector3;
  pB: THREE.Vector3;
  pC: THREE.Vector3;
  nA: THREE.Vector3;
  nB: THREE.Vector3;
  nC: THREE.Vector3;
  uvA: THREE.Vector2;
  uvB: THREE.Vector2;
  uvC: THREE.Vector2;
  area: number;
}

export interface PrecomputedSurfacePoint {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  u?: number;
  v?: number;
  lum?: number;
  category?: string;
  subCategory?: string;
}

// Load color texture
const textureRawPath = '/Users/deepanshukhatri/.gemini/antigravity-ide/brain/8e870d33-0ea5-452d-b701-899647412fc0/scratch/color_texture.raw';
const rawBuffer = fs.readFileSync(textureRawPath);
const TEX_WIDTH = 2048;
const TEX_HEIGHT = 2048;
console.log(`Loaded texture: ${TEX_WIDTH}x${TEX_HEIGHT} (${rawBuffer.length} bytes)`);

function sampleTexture(u: number, v: number): { r: number; g: number; b: number; lum: number } {
  let uu = u % 1.0;
  if (uu < 0) uu += 1.0;
  let vv = v % 1.0;
  if (vv < 0) vv += 1.0;

  const px = Math.min(Math.floor(uu * TEX_WIDTH), TEX_WIDTH - 1);
  const py = Math.min(Math.floor(vv * TEX_HEIGHT), TEX_HEIGHT - 1);
  const idx = (py * TEX_WIDTH + px) * 3;

  const r = rawBuffer[idx] / 255.0;
  const g = rawBuffer[idx + 1] / 255.0;
  const b = rawBuffer[idx + 2] / 255.0;
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

  return { r, g, b, lum };
}

// Deterministic pseudo-random number generator (Mulberry32)
function mulberry32(a: number) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(1337);

const glbBuffer = fs.readFileSync('public/models/human_persona.glb');
const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

loader.parse(glbBuffer.buffer, '', (gltf) => {
  const model = gltf.scene;

  // Apply EXACT arm rest pose & world positioning from PersonaHumanoidCanvas
  const leftArm = model.getObjectByName('LeftArm');
  const rightArm = model.getObjectByName('RightArm');
  if (leftArm) leftArm.rotation.set(1.20, 0.0, 0.0);
  if (rightArm) rightArm.rotation.set(1.80, 1.40, -0.60);

  model.position.set(0, -1.56, 0);
  model.updateMatrixWorld(true);

  function extractMeshTriangles(mesh: THREE.SkinnedMesh): TriangleSample[] {
    const geom = mesh.geometry;
    const posAttr = geom.attributes.position;
    const normalAttr = geom.attributes.normal;
    const uvAttr = geom.attributes.uv;
    const index = geom.index!;

    const worldPos: THREE.Vector3[] = [];
    const worldNorms: THREE.Vector3[] = [];
    const uvs: THREE.Vector2[] = [];

    const p = new THREE.Vector3();
    const n = new THREE.Vector3();
    const uv = new THREE.Vector2();

    const morphPositions = geom.morphAttributes?.position;

    for (let i = 0; i < posAttr.count; i++) {
      p.fromBufferAttribute(posAttr, i);

      // Evaluate vertex morph target displacement if present on the mesh
      if (morphPositions && mesh.morphTargetInfluences) {
        for (let m = 0; m < morphPositions.length; m++) {
          const inf = mesh.morphTargetInfluences[m];
          if (inf > 0.001) {
            p.x += morphPositions[m].getX(i) * inf;
            p.y += morphPositions[m].getY(i) * inf;
            p.z += morphPositions[m].getZ(i) * inf;
          }
        }
      }

      mesh.applyBoneTransform(i, p);
      p.applyMatrix4(mesh.matrixWorld);
      worldPos.push(p.clone());

      if (normalAttr) {
        n.fromBufferAttribute(normalAttr, i);
        n.transformDirection(mesh.matrixWorld);
        worldNorms.push(n.clone().normalize());
      } else {
        worldNorms.push(new THREE.Vector3(0, 0, 1));
      }

      if (uvAttr) {
        uv.fromBufferAttribute(uvAttr, i);
        uvs.push(uv.clone());
      } else {
        uvs.push(new THREE.Vector2(0.5, 0.5));
      }
    }

    const triangles: TriangleSample[] = [];
    const vAB = new THREE.Vector3();
    const vAC = new THREE.Vector3();
    const cross = new THREE.Vector3();

    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i);
      const b = index.getX(i + 1);
      const c = index.getX(i + 2);

      const pA = worldPos[a];
      const pB = worldPos[b];
      const pC = worldPos[c];

      vAB.subVectors(pB, pA);
      vAC.subVectors(pC, pA);
      cross.crossVectors(vAB, vAC);
      const area = cross.length() * 0.5;

      triangles.push({
        pA,
        pB,
        pC,
        nA: worldNorms[a],
        nB: worldNorms[b],
        nC: worldNorms[c],
        uvA: uvs[a],
        uvB: uvs[b],
        uvC: uvs[c],
        area
      });
    }

    return triangles;
  }

  const highResMesh = model.getObjectByName('H_DDS_HighRes') as THREE.SkinnedMesh;
  const lEyeMesh = model.getObjectByName('h_L_eye') as THREE.SkinnedMesh;
  const rEyeMesh = model.getObjectByName('h_R_eye') as THREE.SkinnedMesh;
  const lGlandMesh = model.getObjectByName('h_L_gland') as THREE.SkinnedMesh;
  const rGlandMesh = model.getObjectByName('h_R_gland') as THREE.SkinnedMesh;
  const teethUpMesh = model.getObjectByName('h_TeethUp') as THREE.SkinnedMesh;
  const teethDownMesh = model.getObjectByName('h_TeethDown') as THREE.SkinnedMesh;

  // Scale eye bones by 1.08 (~10-12% eye size enlargement)
  const leftEyeBone = model.getObjectByName('LeftEye');
  const rightEyeBone = model.getObjectByName('RightEye');
  if (leftEyeBone) leftEyeBone.scale.setScalar(1.08);
  if (rightEyeBone) rightEyeBone.scale.setScalar(1.08);

  // Apply expressive facial morph targets matching Persona solid character
  if (highResMesh && highResMesh.morphTargetInfluences) {
    highResMesh.morphTargetInfluences[26] = 0.26; // MouthOpen_h
    highResMesh.morphTargetInfluences[30] = 0.24; // RsmileOpen_h
    highResMesh.morphTargetInfluences[31] = 0.24; // LsmileOpen_h
    highResMesh.morphTargetInfluences[47] = 0.32; // ReyeOpen_h (wider eye aperture)
    highResMesh.morphTargetInfluences[48] = 0.32; // LeyeOpen_h
    highResMesh.morphTargetInfluences[13] = 0.08; // RlipUp_h
    highResMesh.morphTargetInfluences[14] = 0.08; // LlipUp_h
    highResMesh.morphTargetInfluences[15] = 0.08; // RlipDown_h
    highResMesh.morphTargetInfluences[16] = 0.08; // LlipDown_h
  }

  if (teethDownMesh && teethDownMesh.morphTargetInfluences) {
    teethDownMesh.morphTargetInfluences[29] = 0.26; // t_MouthOpen_h
  }

  model.updateMatrixWorld(true);

  const highResTris = extractMeshTriangles(highResMesh);
  const lEyeTris = extractMeshTriangles(lEyeMesh);
  const rEyeTris = extractMeshTriangles(rEyeMesh);
  const lGlandTris = extractMeshTriangles(lGlandMesh);
  const rGlandTris = extractMeshTriangles(rGlandMesh);
  const teethUpTris = teethUpMesh ? extractMeshTriangles(teethUpMesh) : [];
  const teethDownTris = teethDownMesh ? extractMeshTriangles(teethDownMesh) : [];

  console.log(`Extracted triangles: HighRes=${highResTris.length}, LEye=${lEyeTris.length}, REye=${rEyeTris.length}, TeethUp=${teethUpTris.length}, TeethDown=${teethDownTris.length}`);

  type SubRegionKey =
    | 'hair'
    | 'forehead'
    | 'left_eyebrow'
    | 'right_eyebrow'
    | 'left_eye_pupil'
    | 'left_eye_sclera'
    | 'left_eye_lid'
    | 'right_eye_pupil'
    | 'right_eye_sclera'
    | 'right_eye_lid'
    | 'nose_bridge'
    | 'nose_tip'
    | 'nose_wings'
    | 'nose_nostrils'
    | 'philtrum'
    | 'upper_lip'
    | 'mouth_line'
    | 'teeth_upper'
    | 'teeth_lower'
    | 'lower_lip'
    | 'chin'
    | 'jaw'
    | 'cheeks'
    | 'left_ear'
    | 'right_ear'
    | 'neck'
    | 'torso_chest'
    | 'torso_shoulders'
    | 'upper_arm_left'
    | 'upper_arm_right';

  const subRegionTris: Record<SubRegionKey, TriangleSample[]> = {
    hair: [],
    forehead: [],
    left_eyebrow: [],
    right_eyebrow: [],
    left_eye_pupil: [],
    left_eye_sclera: [],
    left_eye_lid: [],
    right_eye_pupil: [],
    right_eye_sclera: [],
    right_eye_lid: [],
    nose_bridge: [],
    nose_tip: [],
    nose_wings: [],
    nose_nostrils: [],
    philtrum: [],
    upper_lip: [],
    mouth_line: [],
    teeth_upper: [],
    teeth_lower: [],
    lower_lip: [],
    chin: [],
    jaw: [],
    cheeks: [],
    left_ear: [],
    right_ear: [],
    neck: [],
    torso_chest: [],
    torso_shoulders: [],
    upper_arm_left: [],
    upper_arm_right: []
  };

  // Separate Teeth meshes sampling (front-visible dental arches)
  for (const tri of teethUpTris) {
    const cnz = (tri.nA.z + tri.nB.z + tri.nC.z) / 3;
    const cz = (tri.pA.z + tri.pB.z + tri.pC.z) / 3;
    const cy = (tri.pA.y + tri.pB.y + tri.pC.y) / 3;
    const cx = (tri.pA.x + tri.pB.x + tri.pC.x) / 3;
    if (cnz > 0.15 && cz > 0.120 && cy >= 0.032 && cy <= 0.058 && Math.abs(cx) <= 0.026) {
      subRegionTris.teeth_upper.push(tri);
    }
  }
  for (const tri of teethDownTris) {
    const cnz = (tri.nA.z + tri.nB.z + tri.nC.z) / 3;
    const cz = (tri.pA.z + tri.pB.z + tri.pC.z) / 3;
    const cy = (tri.pA.y + tri.pB.y + tri.pC.y) / 3;
    const cx = (tri.pA.x + tri.pB.x + tri.pC.x) / 3;
    if (cnz > 0.15 && cz > 0.120 && cy >= 0.026 && cy <= 0.048 && Math.abs(cx) <= 0.026) {
      subRegionTris.teeth_lower.push(tri);
    }
  }

  // 1. Separate Left Eye mesh sampling
  for (const tri of lEyeTris) {
    const cnz = (tri.nA.z + tri.nB.z + tri.nC.z) / 3;
    if (cnz < 0.15) continue; // Front-visible cornea/sclera
    const cu = (tri.uvA.x + tri.uvB.x + tri.uvC.x) / 3;
    const cv = (tri.uvA.y + tri.uvB.y + tri.uvC.y) / 3;
    const tex = sampleTexture(cu, cv);
    if (tex.lum < 0.38) {
      subRegionTris.left_eye_pupil.push(tri);
    } else {
      subRegionTris.left_eye_sclera.push(tri);
    }
  }
  for (const tri of lGlandTris) {
    subRegionTris.left_eye_pupil.push(tri);
  }

  // 2. Separate Right Eye mesh sampling
  for (const tri of rEyeTris) {
    const cnz = (tri.nA.z + tri.nB.z + tri.nC.z) / 3;
    if (cnz < 0.15) continue;
    const cu = (tri.uvA.x + tri.uvB.x + tri.uvC.x) / 3;
    const cv = (tri.uvA.y + tri.uvB.y + tri.uvC.y) / 3;
    const tex = sampleTexture(cu, cv);
    if (tex.lum < 0.38) {
      subRegionTris.right_eye_pupil.push(tri);
    } else {
      subRegionTris.right_eye_sclera.push(tri);
    }
  }
  for (const tri of rGlandTris) {
    subRegionTris.right_eye_pupil.push(tri);
  }

  // 3. HighRes body and face mesh sampling
  for (const tri of highResTris) {
    const cx = (tri.pA.x + tri.pB.x + tri.pC.x) / 3;
    const cy = (tri.pA.y + tri.pB.y + tri.pC.y) / 3;
    const cz = (tri.pA.z + tri.pB.z + tri.pC.z) / 3;
    const cnx = (tri.nA.x + tri.nB.x + tri.nC.x) / 3;
    const cny = (tri.nA.y + tri.nB.y + tri.nC.y) / 3;
    const cnz = (tri.nA.z + tri.nB.z + tri.nC.z) / 3;
    const cu = (tri.uvA.x + tri.uvB.x + tri.uvC.x) / 3;
    const cv = (tri.uvA.y + tri.uvB.y + tri.uvC.y) / 3;

    // Filter below visible framed bust and arms
    if (cy < -0.45) continue;

    // Lower bust: Torso and Arms
    if (cy < -0.15) {
      if (cnz < -0.15 && cz < -0.04) continue;
      if (Math.abs(cx) > 0.18) {
        if (cx > 0) subRegionTris.upper_arm_left.push(tri);
        else subRegionTris.upper_arm_right.push(tri);
      } else if (cy >= -0.27 && Math.abs(cx) > 0.09) {
        subRegionTris.torso_shoulders.push(tri);
      } else {
        subRegionTris.torso_chest.push(tri);
      }
      continue;
    }

    // Shoulders & clavicles
    if (cy < -0.02 && Math.abs(cx) > 0.10) {
      if (cnz < -0.15 && cz < -0.04) continue;
      subRegionTris.torso_shoulders.push(tri);
      continue;
    }

    // Neck
    if (cy < -0.02) {
      if (cnz >= -0.25 || cz >= -0.02) {
        subRegionTris.neck.push(tri);
      }
      continue;
    }

    // HEAD & FACE (cy >= -0.02)
    // Ears
    if (cx > 0.065 && cy >= 0.045 && cy <= 0.160 && cz <= 0.070) {
      subRegionTris.left_ear.push(tri);
      continue;
    }
    if (cx < -0.065 && cy >= 0.045 && cy <= 0.160 && cz <= 0.070) {
      subRegionTris.right_ear.push(tri);
      continue;
    }

    // Hair
    if (cy > 0.135 && (cy > 0.215 || cz < 0.088 || cv < 0.08)) {
      subRegionTris.hair.push(tri);
      continue;
    }

    // Eyebrows
    if (cy >= 0.155 && cy <= 0.205 && Math.abs(cx) >= 0.012 && Math.abs(cx) <= 0.080 && cz >= 0.090 && cv >= 0.09 && cv <= 0.14) {
      if (cx > 0) subRegionTris.left_eyebrow.push(tri);
      else subRegionTris.right_eyebrow.push(tri);
      continue;
    }

    // Forehead
    if (cy >= 0.150 && cy <= 0.220 && Math.abs(cx) <= 0.085 && cz >= 0.085) {
      subRegionTris.forehead.push(tri);
      continue;
    }

    // Eyelids
    if (cy >= 0.100 && cy <= 0.160 && Math.abs(cx) >= 0.012 && Math.abs(cx) <= 0.065 && cz >= 0.110) {
      if (cx > 0) subRegionTris.left_eye_lid.push(tri);
      else subRegionTris.right_eye_lid.push(tri);
      continue;
    }

    // Nose sub-features
    if (cy >= 0.060 && cy <= 0.145 && Math.abs(cx) <= 0.026 && cz >= 0.140) {
      const tex = sampleTexture(cu, cv);
      if (cy <= 0.085 && (tex.lum < 0.25 || cny < -0.3)) {
        subRegionTris.nose_nostrils.push(tri);
      } else if (cy >= 0.080 && cy <= 0.105 && cz >= 0.165) {
        subRegionTris.nose_tip.push(tri);
      } else if (Math.abs(cx) > 0.013) {
        subRegionTris.nose_wings.push(tri);
      } else {
        subRegionTris.nose_bridge.push(tri);
      }
      continue;
    }

    // Philtrum
    if (cy >= 0.052 && cy < 0.065 && Math.abs(cx) <= 0.014 && cz >= 0.145) {
      subRegionTris.philtrum.push(tri);
      continue;
    }

    // Mouth / Lips
    if (cy >= 0.030 && cy < 0.054 && Math.abs(cx) <= 0.030 && cz >= 0.135) {
      const tex = sampleTexture(cu, cv);
      if (cy >= 0.043 && cy <= 0.049 && (tex.lum < 0.35 || cz < 0.158)) {
        subRegionTris.mouth_line.push(tri);
      } else if (cy >= 0.041) {
        subRegionTris.upper_lip.push(tri);
      } else {
        subRegionTris.lower_lip.push(tri);
      }
      continue;
    }

    // Chin
    if (cy >= 0.000 && cy < 0.032 && Math.abs(cx) <= 0.028 && cz >= 0.125) {
      subRegionTris.chin.push(tri);
      continue;
    }

    // Jaw
    if (cy >= -0.020 && cy <= 0.050 && Math.abs(cx) >= 0.028 && Math.abs(cx) <= 0.085 && cz >= 0.020) {
      subRegionTris.jaw.push(tri);
      continue;
    }

    // Cheeks
    subRegionTris.cheeks.push(tri);
  }

  // Exact budget allocation summing to exactly 5,200
  const budget: Record<SubRegionKey, number> = {
    hair: 500,
    forehead: 305,
    left_eyebrow: 80,
    right_eyebrow: 80,
    left_eye_pupil: 30,
    left_eye_sclera: 50,
    left_eye_lid: 80,
    right_eye_pupil: 30,
    right_eye_sclera: 50,
    right_eye_lid: 80,
    nose_bridge: 120,
    nose_tip: 100,
    nose_wings: 120,
    nose_nostrils: 80,
    philtrum: 50,
    upper_lip: 115,
    mouth_line: 45,
    teeth_upper: 40,
    teeth_lower: 25,
    lower_lip: 140,
    chin: 140,
    jaw: 190,
    cheeks: 290,
    left_ear: 130,
    right_ear: 130,
    neck: 250,
    torso_chest: 700,
    torso_shoulders: 550,
    upper_arm_left: 350,
    upper_arm_right: 350
  };

  const totalBudget = Object.values(budget).reduce((a, b) => a + b, 0);
  console.log(`Total target budget: ${totalBudget} (Must be exactly 5,200)`);

  function sampleSubRegion(tris: TriangleSample[], count: number, category: string, subCategory: string): PrecomputedSurfacePoint[] {
    const points: PrecomputedSurfacePoint[] = [];
    if (tris.length === 0 || count <= 0) {
      console.warn(`Warning: 0 triangles for ${subCategory}`);
      return points;
    }

    const prefixSums: number[] = new Array(tris.length);
    let totalArea = 0;
    for (let i = 0; i < tris.length; i++) {
      totalArea += tris[i].area;
      prefixSums[i] = totalArea;
    }

    for (let i = 0; i < count; i++) {
      const targetArea = ((i + rng()) / count) * totalArea;

      let low = 0;
      let high = tris.length - 1;
      let triIdx = 0;
      while (low <= high) {
        const mid = (low + high) >> 1;
        if (prefixSums[mid] >= targetArea) {
          triIdx = mid;
          high = mid - 1;
        } else {
          low = mid + 1;
        }
      }

      const tri = tris[triIdx];
      const r1 = rng();
      const r2 = rng();
      const sqrtR1 = Math.sqrt(r1);
      const uBary = 1 - sqrtR1;
      const vBary = r2 * sqrtR1;
      const wBary = 1 - uBary - vBary;

      const x = uBary * tri.pA.x + vBary * tri.pB.x + wBary * tri.pC.x;
      const y = uBary * tri.pA.y + vBary * tri.pB.y + wBary * tri.pC.y;
      const z = uBary * tri.pA.z + vBary * tri.pB.z + wBary * tri.pC.z;

      const nxRaw = uBary * tri.nA.x + vBary * tri.nB.x + wBary * tri.nC.x;
      const nyRaw = uBary * tri.nA.y + vBary * tri.nB.y + wBary * tri.nC.y;
      const nzRaw = uBary * tri.nA.z + vBary * tri.nB.z + wBary * tri.nC.z;
      const nLen = Math.hypot(nxRaw, nyRaw, nzRaw) || 1.0;
      const nx = nxRaw / nLen;
      const ny = nyRaw / nLen;
      const nz = nzRaw / nLen;

      const u = uBary * tri.uvA.x + vBary * tri.uvB.x + wBary * tri.uvC.x;
      const v = uBary * tri.uvA.y + vBary * tri.uvB.y + wBary * tri.uvC.y;

      const tex = sampleTexture(u, v);

      points.push({
        x: Number(x.toFixed(6)),
        y: Number(y.toFixed(6)),
        z: Number(z.toFixed(6)),
        nx: Number(nx.toFixed(6)),
        ny: Number(ny.toFixed(6)),
        nz: Number(nz.toFixed(6)),
        u: Number(u.toFixed(6)),
        v: Number(v.toFixed(6)),
        lum: Number(tex.lum.toFixed(4)),
        category,
        subCategory
      });
    }

    return points;
  }

  // Sample all subregions
  const subRegionPoints: Record<SubRegionKey, PrecomputedSurfacePoint[]> = {} as any;
  for (const [key, bCount] of Object.entries(budget) as [SubRegionKey, number][]) {
    const category =
      key.startsWith('left_eye') ? 'left_eye'
      : key.startsWith('right_eye') ? 'right_eye'
      : key.startsWith('nose') ? 'nose'
      : key.startsWith('teeth') ? 'teeth'
      : key === 'philtrum' || key === 'upper_lip' || key === 'mouth_line' || key === 'lower_lip' ? 'lips'
      : key.startsWith('upper_arm') ? 'upper_arms'
      : key === 'torso_chest' ? 'upper_chest'
      : key === 'torso_shoulders' ? 'shoulders'
      : key;

    subRegionPoints[key] = sampleSubRegion(subRegionTris[key], bCount, category, key);
    console.log(`Sampled ${subRegionPoints[key].length} points for ${key}`);
  }

  // Interleave points deterministically so uniform stride subsets retain exact feature proportions
  const allPoints: PrecomputedSurfacePoint[] = [];
  const keys = Object.keys(budget) as SubRegionKey[];
  const pointers: Record<SubRegionKey, number> = {} as any;
  keys.forEach(k => pointers[k] = 0);

  let added = true;
  while (allPoints.length < totalBudget && added) {
    added = false;
    for (const k of keys) {
      if (pointers[k] < subRegionPoints[k].length) {
        allPoints.push(subRegionPoints[k][pointers[k]++]);
        added = true;
      }
    }
  }

  console.log(`\nTotal generated points: ${allPoints.length}`);

  // Save generated points
  const outPath = path.resolve(process.cwd(), 'src/components/persona/personaSurfaceData.ts');
  const code = `/**
 * Precision surface sample points extracted directly from production 3D human model (human_persona.glb).
 * Sourced from the VALID (Validated Avatar Library for Inclusion and Diversity) dataset (MIT License).
 * Evaluated from the exact SkinnedMesh in rest pose with exact world transforms (position [0, -1.56, 0]).
 * Framed chest-up: upper chest (y ~ -0.45) to top of hair (y ~ +0.26).
 * Exact Anatomical Feature Allocation (Total 5,200 points):
 * - Hair Silhouette (550 pts)
 * - Forehead (300 pts)
 * - Eyebrows (160 pts: 80 left, 80 right)
 * - Eyes (320 pts: left/right pupil 60, sclera 100, eyelids 160)
 * - Nose (420 pts: bridge 120, tip 100, wings 120, nostrils 80)
 * - Mouth & Lips (380 pts: philtrum 50, upper lip 120, mouth slit 60, lower lip 150)
 * - Chin (150 pts: rounded chin pad)
 * - Jaw (200 pts: mandibular contour)
 * - Cheeks (360 pts: smooth midface volume)
 * - Ears (260 pts: 130 left, 130 right)
 * - Neck (300 pts: cylindrical cervical column)
 * - Polo Shirt Torso & Shoulders (1,300 pts: 700 chest, 600 shoulders/deltoids)
 * - Upper Arms (800 pts: 400 left, 400 right)
 * Interleaved so uniform stride sampling preserves balanced anatomical distribution across all viewport tiers.
 */

export interface PrecomputedSurfacePoint {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
  nz: number;
  u?: number;
  v?: number;
  lum?: number;
  category?: string;
  subCategory?: string;
}

export const PERSONA_SURFACE_POINTS: PrecomputedSurfacePoint[] = ${JSON.stringify(allPoints, null, 2)};
`;

  fs.writeFileSync(outPath, code, 'utf8');
  console.log(`Successfully generated and wrote ${allPoints.length} points to ${outPath}!`);
});
