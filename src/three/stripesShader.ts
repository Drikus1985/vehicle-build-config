/**
 * Shader-painted zone effects: racing stripes and (on UV-mapped assets) the
 * livery overlay. A small extension injected into the standard material of
 * eligible zones.
 *
 * Stripes: the mask is computed from car-space position and normal (no
 * UVs/textures), so it stays glued to the panels through stance, isolation
 * and exploded view. Masks (car space, metres — matched to the ~1.9 m-wide
 * catalogue vehicles):
 * - single / twin-rally: top-facing surfaces plus the upper nose/tail faces
 * - rocker: side-facing surfaces in a low horizontal band
 *
 * Livery: a shared canvas texture (see liveryTexture.ts) sampled with the
 * asset's own UVs and composited over paint and stripes by its alpha. Only
 * materials created with a livery map ever sample it; everything is
 * uniform-driven so changes never recompile, and all materials share one
 * program variant.
 */
import * as THREE from 'three';
import type { StripeSetup } from '@/lib/schemas';
import { STRIPE_STYLE_INDEX } from '@/lib/stripes';

export interface StripeUniforms {
  uStripeStyle: { value: number };
  uStripeColor: { value: THREE.Color };
  uStripeScale: { value: number };
  uLiveryOn: { value: number };
  uLiveryMap: { value: THREE.Texture };
}

const STRIPE_USERDATA_KEY = 'stripeUniforms';

/** 1×1 transparent texture bound when a material has no livery source. */
let blankTexture: THREE.DataTexture | null = null;
function getBlankTexture(): THREE.DataTexture {
  if (!blankTexture) {
    blankTexture = new THREE.DataTexture(new Uint8Array([0, 0, 0, 0]), 1, 1);
    blankTexture.needsUpdate = true;
  }
  return blankTexture;
}

/** Attach the zone-effects extension to a material (before first compile). */
export function applyStripeShader(
  material: THREE.MeshStandardMaterial,
  liveryMap: THREE.Texture | null = null,
): StripeUniforms {
  const uniforms: StripeUniforms = {
    uStripeStyle: { value: 0 },
    uStripeColor: { value: new THREE.Color('#f2f1ec') },
    uStripeScale: { value: 1 },
    uLiveryOn: { value: 0 },
    uLiveryMap: { value: liveryMap ?? getBlankTexture() },
  };
  material.userData[STRIPE_USERDATA_KEY] = uniforms;

  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vStripePos;\nvarying vec3 vStripeNormal;\nvarying vec2 vLiveryUv;',
      )
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvStripePos = transformed;\nvStripeNormal = objectNormal;\nvLiveryUv = uv;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vStripePos;
varying vec3 vStripeNormal;
varying vec2 vLiveryUv;
uniform float uStripeStyle;
uniform vec3 uStripeColor;
uniform float uStripeScale;
uniform float uLiveryOn;
uniform sampler2D uLiveryMap;`,
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
}
if (uLiveryOn > 0.5) {
  // Livery graphics sit on top of paint and stripes.
  vec4 livery = texture2D(uLiveryMap, vLiveryUv);
  diffuseColor.rgb = mix(diffuseColor.rgb, livery.rgb, livery.a);
}`,
      );
  };
  // All zone-effect materials share one program variant.
  material.customProgramCacheKey = () => 'with-stripes-v2';
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

/** Enable/disable livery sampling on a material that was given a livery map. */
export function updateLiveryUniforms(material: THREE.Material, on: boolean): void {
  const uniforms = material.userData[STRIPE_USERDATA_KEY] as StripeUniforms | undefined;
  if (!uniforms) return;
  uniforms.uLiveryOn.value = on && uniforms.uLiveryMap.value !== getBlankTexture() ? 1 : 0;
}

export function hasStripeShader(material: THREE.Material): boolean {
  return material.userData[STRIPE_USERDATA_KEY] !== undefined;
}

/** True when the material was created with a real livery texture bound. */
export function hasLiveryMap(material: THREE.Material): boolean {
  const uniforms = material.userData[STRIPE_USERDATA_KEY] as StripeUniforms | undefined;
  return uniforms !== undefined && uniforms.uLiveryMap.value !== getBlankTexture();
}
