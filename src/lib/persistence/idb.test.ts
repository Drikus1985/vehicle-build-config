import { beforeEach, describe, expect, it } from 'vitest';
import { getVehicle } from '@/lib/catalog';
import { createDefaultBuild } from '@/lib/build/defaults';
import { repositories } from './idb';

const vehicle = () => getVehicle('veh-tf100-1952')!;

describe('IndexedDB repositories (fake-indexeddb)', () => {
  beforeEach(async () => {
    for (const b of await repositories.builds.list()) await repositories.builds.remove(b.id);
    await repositories.builds.setCurrentBuildId(null);
  });

  it('saves and reloads a build byte-identically', async () => {
    const build = createDefaultBuild(vehicle(), 'Persisted');
    build.paint['body']!.colorHex = '#2e5d9e';
    build.wheels.front.tyre.widthMm = 255;
    await repositories.builds.save(build);
    const loaded = await repositories.builds.get(build.id);
    expect(loaded).toEqual(build);
  });

  it('tracks the current build id for restore-after-refresh', async () => {
    const build = createDefaultBuild(vehicle(), 'Current');
    await repositories.builds.save(build);
    await repositories.builds.setCurrentBuildId(build.id);
    expect(await repositories.builds.getCurrentBuildId()).toBe(build.id);
    await repositories.builds.setCurrentBuildId(null);
    expect(await repositories.builds.getCurrentBuildId()).toBeNull();
  });

  it('lists builds newest-first and removes them', async () => {
    const a = createDefaultBuild(vehicle(), 'A');
    a.updatedAt = '2026-01-01T00:00:00.000Z';
    const b = createDefaultBuild(vehicle(), 'B');
    b.updatedAt = '2026-02-01T00:00:00.000Z';
    await repositories.builds.save(a);
    await repositories.builds.save(b);
    const list = await repositories.builds.list();
    expect(list.map((x) => x.name)).toEqual(['B', 'A']);
    await repositories.builds.remove(a.id);
    expect((await repositories.builds.list()).map((x) => x.name)).toEqual(['B']);
  });

  it('rejects corrupt stored builds instead of returning them', async () => {
    const build = createDefaultBuild(vehicle(), 'Corrupt');
    // @ts-expect-error deliberately corrupting a field
    build.wheels = { nope: true };
    await repositories.builds.save(build);
    expect(await repositories.builds.get(build.id)).toBeNull();
  });

  it('stores and dedupes saved colours', async () => {
    await repositories.settings.addSavedColor({ hex: '#112233', name: 'x', savedAt: 'now' });
    await repositories.settings.addSavedColor({ hex: '#112233', name: 'x', savedAt: 'later' });
    const colors = await repositories.settings.getSavedColors();
    expect(colors.filter((c) => c.hex === '#112233')).toHaveLength(1);
    await repositories.settings.removeSavedColor('#112233');
    expect((await repositories.settings.getSavedColors()).some((c) => c.hex === '#112233')).toBe(
      false,
    );
  });
});
