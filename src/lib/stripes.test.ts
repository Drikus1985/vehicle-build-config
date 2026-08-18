import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_STRIPE_SETUP, STRIPE_COLORS, STRIPE_STYLE_INDEX, STRIPE_STYLES } from './stripes';
import { buildSchema } from '@/lib/schemas';
import { createDefaultBuild } from '@/lib/build/defaults';
import { getVehicle, NOVA_MANIFEST, TF100_MANIFEST } from '@/lib/catalog';
import { parseBuildFile, serializeBuild } from '@/lib/export/buildFile';
import { setStripes } from '@/state/buildActions';
import { useBuildStore } from '@/state/buildStore';

describe('stripe styles', () => {
  it('every style has a unique id and a shader index', () => {
    const ids = STRIPE_STYLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(STRIPE_STYLE_INDEX[id]).toBeTypeOf('number');
    expect(STRIPE_STYLE_INDEX['none']).toBe(0);
    expect(STRIPE_COLORS.length).toBeGreaterThan(2);
  });

  it('Nova exposes stripe zones that exist as paintable zones; TF-100 opts out', () => {
    expect(NOVA_MANIFEST.stripeZones.sort()).toEqual(['body', 'hood']);
    for (const zoneId of NOVA_MANIFEST.stripeZones) {
      const zone = NOVA_MANIFEST.materialZones.find((z) => z.id === zoneId);
      expect(zone?.paintable, `zone ${zoneId}`).toBe(true);
    }
    expect(TF100_MANIFEST.stripeZones).toHaveLength(0);
  });
});

describe('stripe build state', () => {
  it('default builds start without stripes and round-trip through export files', () => {
    const build = createDefaultBuild(getVehicle('veh-nova-1970')!);
    expect(build.stripes).toEqual(DEFAULT_STRIPE_SETUP);
    const result = parseBuildFile(serializeBuild(build));
    expect(result.ok && result.build.stripes.styleId).toBe('none');
  });

  it('builds saved before the stripes field existed still parse (default fills in)', () => {
    const build = createDefaultBuild(getVehicle('veh-nova-1970')!);
    const legacy = JSON.parse(JSON.stringify(build)) as Record<string, unknown>;
    delete legacy['stripes'];
    const parsed = buildSchema.safeParse(legacy);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.stripes).toEqual(DEFAULT_STRIPE_SETUP);
  });

  it('rejects out-of-range stripe widths', () => {
    const build = createDefaultBuild(getVehicle('veh-nova-1970')!);
    const bad = JSON.parse(JSON.stringify(build)) as { stripes: { widthScale: number } };
    bad.stripes.widthScale = 3;
    expect(buildSchema.safeParse(bad).success).toBe(false);
  });
});

describe('setStripes action', () => {
  beforeEach(() => {
    useBuildStore.getState().clear();
    useBuildStore.getState().newBuildForVehicle(getVehicle('veh-nova-1970')!, 'Stripe test');
  });

  it('updates style/colour/width and is undoable', () => {
    setStripes({ styleId: 'twin-rally', colorHex: '#141519', widthScale: 1.2 });
    const build = useBuildStore.getState().build!;
    expect(build.stripes).toEqual({ styleId: 'twin-rally', colorHex: '#141519', widthScale: 1.2 });
    useBuildStore.getState().undo();
    expect(useBuildStore.getState().build!.stripes).toEqual(DEFAULT_STRIPE_SETUP);
  });
});
