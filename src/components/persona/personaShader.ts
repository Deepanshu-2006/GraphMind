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
    uTransitionBand: { value: 0.035 },
    uGlowColor: { value: new THREE.Color('#00E575') }, // Refined GraphMind emerald green
    uGlowIntensity: { value: 0.40 } // Subtle surface highlight (no yellow blowout)
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

  // FrontSide rendering prevents looking into hollow interior of cut meshes
  stdMat.side = THREE.FrontSide;

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

    // Calculate surface-hugging anatomical reveal coordinate after skinning
    shader.vertexShader = shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      vec4 worldPositionForSolidify = modelMatrix * vec4(transformed, 1.0);
      // Surface-hugging anatomical reveal coordinate:
      // Advances upward with chest/face depth curvature, seamlessly bridging arms into shoulders
      float lateralArmOffset = max(0.0, abs(worldPositionForSolidify.x) - 0.14);
      vWorldY = worldPositionForSolidify.y + 0.028 * worldPositionForSolidify.z - 0.055 * lateralArmOffset;`
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

    // Surface-hugging dithered condensation with restrained emerald edge light
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
      if (vWorldY > uSolidifyY) {
        discard;
      }
      float distFromCut = uSolidifyY - vWorldY;
      if (distFromCut < uTransitionBand) {
        float bandProgress = distFromCut / uTransitionBand;

        // 4x4 Bayer dither matrix for progressive surface condensation (no sharp cut lines or open hollow rims)
        vec2 ditherCoord = mod(floor(gl_FragCoord.xy), 4.0);
        int ditherIdx = int(ditherCoord.x) + int(ditherCoord.y) * 4;
        float ditherVal = 0.0;
        if (ditherIdx == 0) ditherVal = 0.0625;
        else if (ditherIdx == 1) ditherVal = 0.5625;
        else if (ditherIdx == 2) ditherVal = 0.1875;
        else if (ditherIdx == 3) ditherVal = 0.6875;
        else if (ditherIdx == 4) ditherVal = 0.8125;
        else if (ditherIdx == 5) ditherVal = 0.3125;
        else if (ditherIdx == 6) ditherVal = 0.9375;
        else if (ditherIdx == 7) ditherVal = 0.4375;
        else if (ditherIdx == 8) ditherVal = 0.25;
        else if (ditherIdx == 9) ditherVal = 0.75;
        else if (ditherIdx == 10) ditherVal = 0.125;
        else if (ditherIdx == 11) ditherVal = 0.625;
        else if (ditherIdx == 12) ditherVal = 1.0;
        else if (ditherIdx == 13) ditherVal = 0.5;
        else if (ditherIdx == 14) ditherVal = 0.875;
        else ditherVal = 0.375;

        if (bandProgress < ditherVal * 0.85) {
          discard;
        }

        // Restrained subtle green highlight following the surface (bell curve peaking within the transition)
        float edgeNorm = sin(clamp(bandProgress, 0.0, 1.0) * 3.14159265);
        float pulse = pow(edgeNorm, 1.5);
        gl_FragColor.rgb += uGlowColor * (pulse * uGlowIntensity);
      }`
    );
  };

  stdMat.customProgramCacheKey = () => 'persona-humanoid-solidify-pbr-v5';
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
    side: THREE.FrontSide
  }) as THREE.MeshStandardMaterial & { solidifyUniforms: SolidifyMaterialUniforms };

  material.solidifyUniforms = uniforms;
  attachPersonaSolidifyShader(material, uniforms);

  return material;
}
