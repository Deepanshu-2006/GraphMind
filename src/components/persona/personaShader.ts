import * as THREE from 'three';

export interface SolidifyMaterialUniforms {
  uSolidifyY: { value: number };
  uTransitionBand: { value: number };
  uGlowColor: { value: THREE.Color };
  uGlowIntensity: { value: number };
}

/**
 * Creates default uniforms for the GraphMind Persona solidification effect.
 * Framed chest-up from minY (-0.35) to maxY (+0.32).
 */
export function createDefaultSolidifyUniforms(): SolidifyMaterialUniforms {
  return {
    uSolidifyY: { value: -0.40 }, // Start below chest
    uTransitionBand: { value: 0.05 },
    uGlowColor: { value: new THREE.Color('#A3FF12') },
    uGlowIntensity: { value: 2.2 }
  };
}

/**
 * Injects the bottom-up vertical solidification clipping threshold and
 * signature GraphMind lime-green wavefront into any Three.js Material (e.g. GLTF MeshStandardMaterial).
 *
 * Compatible with both SkinnedMesh and static Mesh across WebGL 1 & WebGL 2.
 */
export function attachPersonaSolidifyShader(
  material: THREE.Material,
  uniforms: SolidifyMaterialUniforms
): void {
  const stdMat = material as THREE.MeshStandardMaterial;
  stdMat.userData = stdMat.userData || {};
  stdMat.userData.solidifyUniforms = uniforms;

  // Soft natural skin & fabric response
  if ('roughness' in stdMat && stdMat.roughness !== undefined) {
    stdMat.roughness = Math.max(stdMat.roughness, 0.45);
  }
  if ('metalness' in stdMat && stdMat.metalness !== undefined) {
    stdMat.metalness = Math.min(stdMat.metalness, 0.15);
  }

  stdMat.onBeforeCompile = (shader) => {
    shader.uniforms.uSolidifyY = uniforms.uSolidifyY;
    shader.uniforms.uTransitionBand = uniforms.uTransitionBand;
    shader.uniforms.uGlowColor = uniforms.uGlowColor;
    shader.uniforms.uGlowIntensity = uniforms.uGlowIntensity;

    // Inject varying in vertex shader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      varying float vWorldY;`
    );

    // Calculate world Y position after project_vertex (after skinning has been computed)
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vec4 worldPositionForSolidify = modelMatrix * vec4(transformed, 1.0);
      // Smooth anatomical curvature contouring the natural torso, chest, jaw, and facial planes
      vWorldY = worldPositionForSolidify.y + 0.032 * (worldPositionForSolidify.z - 0.05) - 0.020 * abs(worldPositionForSolidify.x);`
    );

    // Inject varying and uniforms in fragment shader
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      uniform float uSolidifyY;
      uniform float uTransitionBand;
      uniform vec3 uGlowColor;
      uniform float uGlowIntensity;
      varying float vWorldY;`
    );

    // Discard geometry above active threshold and illuminate the rising wavefront
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      if (vWorldY > uSolidifyY) {
        discard;
      }
      float distFromCut = uSolidifyY - vWorldY;
      if (distFromCut < uTransitionBand) {
        float edgeNorm = 1.0 - (distFromCut / uTransitionBand);
        float pulse = pow(edgeNorm, 1.8);
        gl_FragColor.rgb += uGlowColor * (pulse * uGlowIntensity);
      }`
    );
  };

  stdMat.customProgramCacheKey = () => 'persona-humanoid-solidify-pbr-v4';
}

/**
 * Creates the sophisticated PBR material for the GraphMind Persona solid humanoid.
 * Integrates an ascending vertical clipping threshold with an emissive lime-green wavefront.
 */
export function createPersonaSolidMaterial(
  customUniforms?: SolidifyMaterialUniforms
): THREE.MeshStandardMaterial & {
  solidifyUniforms: SolidifyMaterialUniforms;
} {
  const uniforms = customUniforms || createDefaultSolidifyUniforms();

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#252b36'),
    roughness: 0.45,
    metalness: 0.12,
    flatShading: false,
    side: THREE.DoubleSide
  }) as THREE.MeshStandardMaterial & { solidifyUniforms: SolidifyMaterialUniforms };

  material.solidifyUniforms = uniforms;
  attachPersonaSolidifyShader(material, uniforms);

  return material;
}
