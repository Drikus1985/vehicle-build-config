import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PATINA_SETUP, mulberry32, patinaActive } from './patina';
import { buildSchema } from '@/lib/schemas';
import { createDefaultBuild } from '@/lib/build/defaults';
import { getVehicle } from '@/lib/catalog';
import { setPatina } from '@/state/buildActions';
import { useBuildStore } from '@/state/buildStore';

describe('patina setup', () => {
  it('defaults to pristine and round-trips legacy builds without the field', () => {
    const build = createDefaultBuild(getVehicle('veh-nova-1970')!);
    expect(build.patina).toEqual(DEFAULT_PATINA_SETUP);
    expect(patinaActive(build.patina)).toBe(false);
    const legacy = JSON.parse(JSON.stringify(build)) as Record<string, unknown>;
    delete legacy['patina'];
    const parsed = buildSchema.safeParse(legacy);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.patina).toEqual(DEFAULT_PATINA_SETUP);
  });

  it('rejects out-of-range amounts and non-integer seeds', () => {
    const build = createDefaultBuild(getVehicle('veh-nova-1970')!);
    const bad = JSON.parse(JSON.stringify(build)) as {
      patina: { amount: number; seed: number };
    };
    bad.patina.amount = 1.5;
    expect(buildSchema.safeParse(bad).success).toBe(false);
    bad.patina.amount = 0.5;
    bad.patina.seed = 3.7;
    expect(buildSchema.safeParse(bad).success).toBe(false);
  });

  it('is active only with a positive amount and at least one effect', () => {
    expect(patinaActive({ ...DEFAULT_PATINA_SETUP, amount: 0.4 })).toBe(true);
    expect(patinaActive({ amount: 0.4, fade: false, rust: false, grime: false, seed: 1 })).toBe(
      false,
    );
  });

  it('mulberry32 is deterministic and stays in [0, 1)', () => {
    const a = mulberry32(1970);
    const b = mulberry32(1970);
    const c = mulberry32(1971);
    const seqA = Array.from({ length: 50 }, () => a());
    const seqB = Array.from({ length: 50 }, () => b());
    expect(seqA).toEqual(seqB);
    expect(seqA).not.toEqual(Array.from({ length: 50 }, () => c()));
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('setPatina action', () => {
  beforeEach(() => {
    useBuildStore.getState().clear();
    useBuildStore.getState().newBuildForVehicle(getVehicle('veh-nova-1970')!, 'Patina test');
  });

  it('updates amount/toggles/seed and is undoable', () => {
    setPatina({ amount: 0.6, grime: false, seed: 42 });
    const patina = useBuildStore.getState().build!.patina;
    expect(patina).toEqual({ amount: 0.6, fade: true, rust: true, grime: false, seed: 42 });
    expect(patinaActive(patina)).toBe(true);
    useBuildStore.getState().undo();
    expect(useBuildStore.getState().build!.patina).toEqual(DEFAULT_PATINA_SETUP);
  });
});
