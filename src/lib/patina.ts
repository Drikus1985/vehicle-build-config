/**
 * Patina/weathering configuration. The effect is drawn procedurally onto the
 * vehicle's UV atlas (see src/three/patinaTexture.ts) over the livery zones,
 * so it needs the UV-mapped liverySource asset. It is a cosmetic display
 * effect — deterministic per seed so saved builds restore exactly — not a
 * corrosion model.
 */
import type { PatinaSetup } from '@/lib/schemas';

export const DEFAULT_PATINA_SETUP: PatinaSetup = {
  amount: 0,
  fade: true,
  rust: true,
  grime: true,
  seed: 1970,
};

/** True when the setup draws anything at all. */
export function patinaActive(patina: PatinaSetup): boolean {
  return patina.amount > 0.001 && (patina.fade || patina.rust || patina.grime);
}

/**
 * Deterministic 32-bit PRNG (mulberry32). Same seed → same weathering
 * pattern on every load, which is what lets patina live in a saved build.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
