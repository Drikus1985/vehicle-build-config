import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PLATE_SETUP, getPlateStyle, PLATE_STYLES, sanitizePlateText } from './plates';
import { buildSchema } from '@/lib/schemas';
import { createDefaultBuild } from '@/lib/build/defaults';
import { getVehicle, NOVA_MANIFEST, NOVA_PARTS, TF100_MANIFEST } from '@/lib/catalog';
import { serializeBuild, parseBuildFile } from '@/lib/export/buildFile';
import { setPlateSetup } from '@/state/buildActions';
import { useBuildStore } from '@/state/buildStore';

describe('plate styles & sanitisation', () => {
  it('has unique style ids and a working lookup with fallback', () => {
    const ids = PLATE_STYLES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(getPlateStyle('classic-black').label).toBe('Classic black');
    expect(getPlateStyle('nope')).toBe(PLATE_STYLES[0]);
    expect(ids).toContain(DEFAULT_PLATE_SETUP.styleId);
  });

  it('sanitises plate text: uppercase, allowed charset, length cap', () => {
    expect(sanitizePlateText('nova 70')).toBe('NOVA 70');
    expect(sanitizePlateText('aam@396!!')).toBe('AAM396');
    expect(sanitizePlateText('  A   B  ')).toBe('A B ');
    expect(sanitizePlateText('ABCDEFGHIJKLMNOP')).toBe('ABCDEFGHIJ');
    expect(sanitizePlateText('<script>')).toBe('SCRIPT');
  });
});

describe('plate mounts & build state', () => {
  it('Nova declares front + rear mounts tied to the plates part; TF-100 has none', () => {
    expect(NOVA_MANIFEST.plateMounts.map((m) => m.id).sort()).toEqual(['front', 'rear']);
    const nodeNames = new Set(NOVA_MANIFEST.meshNodes.map((n) => n.nodeName));
    for (const mount of NOVA_MANIFEST.plateMounts) {
      expect(NOVA_PARTS.some((p) => p.id === mount.componentId)).toBe(true);
      for (const hidden of mount.hideNodeNames) expect(nodeNames.has(hidden)).toBe(true);
    }
    expect(TF100_MANIFEST.plateMounts).toHaveLength(0);
  });

  it('default builds carry a plate setup and round-trip through export files', () => {
    const build = createDefaultBuild(getVehicle('veh-nova-1970')!);
    expect(build.plateSetup).toEqual(DEFAULT_PLATE_SETUP);
    const result = parseBuildFile(serializeBuild(build));
    expect(result.ok && result.build.plateSetup.text).toBe(DEFAULT_PLATE_SETUP.text);
  });

  it('builds saved before the plate field existed still parse (default fills in)', () => {
    const build = createDefaultBuild(getVehicle('veh-nova-1970')!);
    const legacy = JSON.parse(JSON.stringify(build)) as Record<string, unknown>;
    delete legacy['plateSetup'];
    const parsed = buildSchema.safeParse(legacy);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.plateSetup).toEqual(DEFAULT_PLATE_SETUP);
  });
});

describe('setPlateSetup action', () => {
  beforeEach(() => {
    useBuildStore.getState().clear();
    useBuildStore.getState().newBuildForVehicle(getVehicle('veh-nova-1970')!, 'Plate test');
  });

  it('updates sanitised text and style, and is undoable', () => {
    setPlateSetup({ text: 'aam 396#', styleId: 'blue' });
    const build = useBuildStore.getState().build!;
    expect(build.plateSetup).toEqual({ text: 'AAM 396', styleId: 'blue' });
    useBuildStore.getState().undo();
    expect(useBuildStore.getState().build!.plateSetup).toEqual(DEFAULT_PLATE_SETUP);
  });
});
