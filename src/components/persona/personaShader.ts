import * as THREE from 'three';

export interface SolidifyMaterialUniforms {
  uSolidifyY: { value: number };
  uTransitionBand: { value: number };
  uGlowColor: { value: THREE.Color };
  uGlowIntensity: { value: number };
}

/**
 * Creates the sophisticated PBR material for the GraphMind Persona solid humanoid.
 * Integrates an ascending vertical clipping threshold with an emissive lime-green wavefront.
 */
export function createPersonaSolidMaterial(): THREE.MeshStandardMaterial & {
  solidifyUniforms: SolidifyMaterialUniforms;
} {
  const uniforms: SolidifyMaterialUniforms = {
    // Start well below feet so character is initially completely unsolidified
    uSolidifyY: { value: -2.0 },
    uTransitionBand: { value: 0.08 },
    uGlowColor: { value: new THREE.Color('#A3FF12') },
    uGlowIntensity: { value: 2.2 }
  };

  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#141619'),
    roughness: 0.42,
    metalness: 0.22,
    flatShading: false,
    side: THREE.DoubleSide
  }) as THREE.MeshStandardMaterial & { solidifyUniforms: SolidifyMaterialUniforms };

  material.solidifyUniforms = uniforms;

  material.onBeforeCompile = (shader) => {
    // Inject uniforms
    shader.uniforms.uSolidifyY = uniforms.uSolidifyY;
    shader.uniforms.uTransitionBand = uniforms.uTransitionBand;
    shader.uniforms.uGlowColor = uniforms.uGlowColor;
    shader.uniforms.uGlowIntensity = uniforms.uGlowIntensity;

    // Vertex shader injection: pass world position Y coordinate
    shader.vertexShader = `
      varying float vWorldY;
      varying vec3 vWorldNormalVec;
      ${shader.vertexShader}
    `;

    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `
      #include <begin_vertex>
      vec4 worldPositionForSolidify = modelMatrix * vec4(transformed, 1.0);
      vWorldY = worldPositionForSolidify.y;
      vWorldNormalVec = normalize(mat3(modelMatrix) * normal);
      `
    );

    // Fragment shader injection: discard above threshold, illuminate boundary
    shader.fragmentShader = `
      uniform float uSolidifyY;
      uniform float uTransitionBand;
      uniform vec3 uGlowColor;
      uniform float uGlowIntensity;
      varying float vWorldY;
      varying vec3 vWorldNormalVec;
      ${shader.fragmentShader}
    `;

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `
      #include <dithering_fragment>

      // 1. Clip geometry above the vertical solidification boundary
      if (vWorldY > uSolidifyY) {
        discard;
      }

      // 2. Signature GraphMind lime-green wavefront at the active boundary
      float distFromCut = uSolidifyY - vWorldY;
      if (distFromCut < uTransitionBand) {
        float edgeNorm = 1.0 - (distFromCut / uTransitionBand);
        float pulse = pow(edgeNorm, 1.8);
        gl_FragColor.rgb += uGlowColor * (pulse * uGlowIntensity);
      }

      // 3. Subtle editorial rim sheen highlighting anatomical masses
      vec3 viewDir = normalize(vViewPosition);
      float rim = 1.0 - max(0.0, dot(vNormal, viewDir));
      float rimGlow = pow(rim, 3.5) * 0.18;
      gl_FragColor.rgb += uGlowColor * rimGlow;
      `
    );
  };

  return material;
}
