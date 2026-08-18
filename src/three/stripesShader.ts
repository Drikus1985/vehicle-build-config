/**
 * Shader-painted racing stripes. A small extension injected into the standard
 * material of stripe-eligible zones: the stripe mask is computed from
 * car-space position and normal (no UVs/textures), so it stays glued to the
 * panels through stance, isolation and exploded view.
 *
 * Masks (car space, metres — matched to the ~1.9 m-wide catalogue vehicles):
 * - single / twin-rally: top-facing surfaces plus the upper nose/tail faces
 * - rocker: side-facing surfaces in a low horizontal band
 */
import * as THREE from 'three';
import type { StripeSetup } from '@/lib/schemas';
import { STRIPE_STYLE_INDEX } from '@/lib/stripes';

export interface StripeUniforms {
  uStripeStyle: { value: number };
  uStripeColor: { value: THREE.Color };
  uStripeScale: { value: number };
}

const STRIPE_USERDATA_KEY = 'stripeUniforms';

/** Attach the stripe extension to a material (before first compile). */
export function applyStripeShader(material: THREE.MeshStandardMaterial): StripeUniforms {
  const uniforms: StripeUniforms = {
    uStripeStyle: { value: 0 },
    uStripeColor: { value: new THREE.Color('#f2f1ec') },
    uStripeScale: { value: 1 },
  };
  material.userData[STRIPE_USERDATA_KEY] = uniforms;

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vStripePos;\nvarying vec3 vStripeNormal;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvStripePos = transformed;\nvStripeNormal = objectNormal;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vStripePos;
varying vec3 vStripeNormal;
uniform float uStripeStyle;
uniform vec3 uStripeColor;
uniform float uStripeScale;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
if (uStripeStyle > 0.5) {
  vec3 sp = vStripePos;
  vec3 sn = normalize(vStripeNormal);
  float mask = 0.0;
  if (uStripeStyle < 2.5) {
    // Centre stripes: top surfaces + upper nose/tail faces.
    float topFace = smoothstep(0.25, 0.45, sn.y);
    float endFace = step(0.72, abs(sn.z)) * smoothstep(0.55, 0.65, sp.y);
    float face = max(topFace, endFace);
    if (uStripeStyle < 1.5) {
      float w = 0.20 * uStripeScale;
      mask = (1.0 - smoothstep(w - 0.006, w + 0.006, abs(sp.x))) * face;
    } else {
      float w = 0.075 * uStripeScale;
      float off = 0.115 * uStripeScale;
      float d = abs(abs(sp.x) - off);
      mask = (1.0 - smoothstep(w - 0.006, w + 0.006, d)) * face;
    }
  } else {
    // Rocker stripe: side faces, low band, between the wheel arches.
    float sideFace = smoothstep(0.6, 0.75, abs(sn.x));
    float h = 0.055 * uStripeScale;
    float band = 1.0 - smoothstep(h - 0.008, h + 0.008, abs(sp.y - 0.56));
    float zLimit = 1.0 - smoothstep(2.0, 2.12, abs(sp.z));
    mask = sideFace * band * zLimit;
  }
  diffuseColor.rgb = mix(diffuseColor.rgb, uStripeColor, mask);
}`,
      );
  };
  // All stripe materials share one program variant.
  material.customProgramCacheKey = () => 'with-stripes-v1';
  return uniforms;
}

/** Push the build's stripe setup into a material's uniforms (no recompile). */
export function updateStripeUniforms(material: THREE.Material, setup: StripeSetup): void {
  const uniforms = material.userData[STRIPE_USERDATA_KEY] as StripeUniforms | undefined;
  if (!uniforms) return;
  uniforms.uStripeStyle.value = STRIPE_STYLE_INDEX[setup.styleId];
  uniforms.uStripeColor.value.set(setup.colorHex);
  uniforms.uStripeScale.value = setup.widthScale;
}

export function hasStripeShader(material: THREE.Material): boolean {
  return material.userData[STRIPE_USERDATA_KEY] !== undefined;
}
