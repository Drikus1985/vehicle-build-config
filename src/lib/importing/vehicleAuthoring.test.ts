import { describe, expect, it } from 'vitest';
import {
  buildUserVehicleBundle,
  guessZoneForNode,
  inferScale,
  KEEP_ORIGINAL,
  USER_ZONES,
  type AuthoringInput,
} from './vehicleAuthoring';
import { userVehicleBundleSchema } from '@/lib/catalog/userCatalog';
import { createDefaultBuild } from '@/lib/build/defaults';
import {
  getManifestForVehicle,
  getPart,
  getPartsForVehicle,
  getVehicle,
  removeUserVehicle,
  saveUserVehicle,
} from '@/lib/catalog';

const INPUT: AuthoringInput = {
  asset: {
    id: 'asset-test-1',
    name: 'my-car.glb',
    attribution: {
      sourceName: 'Test source',
      licence: 'CC0-1.0',
      attributionText: 'Test asset (CC0)',
      reuseConfirmed: true,
    },
  },
  meta: { year: 1969, make: 'Testcraft', model: 'Runner', vehicleType: 'car', bodyStyle: 'coupe' },
  nodes: [
    { name: 'body_shell', zoneId: 'body' },
    { name: 'window_glass', zoneId: 'glass' },
    { name: 'front bumper', zoneId: 'chrome' },
    { name: 'Front Bumper', zoneId: 'chrome' }, // slug-collides with the previous
    { name: 'engine', zoneId: KEEP_ORIGINAL },
  ],
  bboxMin: [-95, 30, -240], // floats 30 cm above the ground
  bboxMax: [95, 140, 240], // cm-scale model, 4.8 m long
};

describe('zone and scale inference', () => {
  it('guesses zones from node names with a body fallback', () => {
    expect(guessZoneForNode('windshield_outer')).toBe('glass');
    expect(guessZoneForNode('Tire_FL')).toBe('rubber');
    expect(guessZoneForNode('rim_5spoke')).toBe('steel');
    expect(guessZoneForNode('front_bumper_chrome')).toBe('chrome');
    expect(guessZoneForNode('seat_bench')).toBe('interior');
    expect(guessZoneForNode('door_left')).toBe('body');
  });

  it('normalises common unit scales and fits unknown ones', () => {
    expect(inferScale(4.8)).toBe(1); // metres
    expect(inferScale(480)).toBe(0.01); // centimetres
    expect(inferScale(4800)).toBe(0.001); // millimetres
    expect(inferScale(48)).toBeCloseTo(0.1); // unknown → fit to 4.8 m
  });
});

describe('buildUserVehicleBundle', () => {
  const bundle = buildUserVehicleBundle(INPUT);

  it('produces a schema-valid bundle with consistent references', () => {
    expect(userVehicleBundleSchema.safeParse(bundle).success).toBe(true);
    const nodeNames = new Set(bundle.manifest.meshNodes.map((n) => n.nodeName));
    for (const part of bundle.parts) {
      for (const id of part.meshNodeIds) expect(nodeNames.has(id)).toBe(true);
      expect(part.compatibility.vehicleIds).toEqual([bundle.vehicle.id]);
    }
    // Slug collisions still yield unique part ids.
    expect(new Set(bundle.parts.map((p) => p.id)).size).toBe(bundle.parts.length);
    expect(bundle.vehicle.assetManifestId).toBe(bundle.manifest.id);
    expect(bundle.manifest.source.uri).toBe('asset:asset-test-1');
  });

  it('normalises scale, grounds the model and derives dimensions', () => {
    expect(bundle.manifest.scale).toBe(0.01);
    // Grounding: the y offset drops the floating model onto the ground plane.
    const [ox, oy, oz] = bundle.manifest.rootOffset!;
    expect(ox).toBeCloseTo(0);
    expect(oy).toBeCloseTo(-0.3);
    expect(oz).toBeCloseTo(0);
    expect(bundle.manifest.fitmentBounds.overallLengthM).toBeCloseTo(4.8);
    expect(bundle.vehicle.dimensionsMm!.length).toBe(4800);
    expect(bundle.manifest.cameraTargets.presets.length).toBeGreaterThanOrEqual(9);
    // Wheels/stance and decor features are honestly disabled.
    expect(bundle.manifest.supportedFeatures.stance).toBe(false);
    expect(bundle.manifest.wheelAnchors).toHaveLength(0);
    expect(bundle.manifest.stripeZones).toHaveLength(0);
  });

  it('keep-original nodes stay selectable but unzoned', () => {
    const engine = bundle.manifest.meshNodes.find((n) => n.nodeName === 'engine')!;
    expect(engine.materialZoneId).toBeNull();
    expect(engine.componentId).toBeTruthy();
  });
});

describe('user catalogue registration', () => {
  it('registers, resolves through every lookup, supports default builds, and removes', async () => {
    const bundle = buildUserVehicleBundle(INPUT);
    await saveUserVehicle(bundle);
    const id = bundle.vehicle.id;
    expect(getVehicle(id)?.make).toBe('Testcraft');
    expect(getManifestForVehicle(id)?.id).toBe(bundle.manifest.id);
    expect(getPart(bundle.parts[0]!.id)?.name).toBe('body_shell');
    // Parts stay scoped to their own vehicle.
    expect(getPartsForVehicle(getVehicle(id)!).map((p) => p.id)).toEqual(
      expect.arrayContaining(bundle.parts.map((p) => p.id)),
    );
    expect(
      getPartsForVehicle(getVehicle('veh-nova-1970')!).some((p) =>
        p.id.startsWith('part-veh-user'),
      ),
    ).toBe(false);
    // A default build works: paintable user zones present, all parts installed.
    const build = createDefaultBuild(getVehicle(id)!);
    for (const zone of USER_ZONES.filter((z) => z.paintable)) {
      expect(build.paint[zone.id], `zone ${zone.id}`).toBeDefined();
    }
    expect(build.installed).toHaveLength(bundle.parts.length);
    await removeUserVehicle(id);
    expect(getVehicle(id)).toBeUndefined();
  });
});
