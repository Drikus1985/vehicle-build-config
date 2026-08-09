import { describe, expect, it } from 'vitest';
import { getVehicle } from '@/lib/catalog';
import { createDefaultBuild } from '@/lib/build/defaults';
import { parseBuildFile, serializeBuild } from './buildFile';

describe('build file export/import', () => {
  it('round-trips a build exactly', () => {
    const build = createDefaultBuild(getVehicle('veh-tf100-1952')!, 'Round trip');
    build.stance.rideHeightFrontMm = -45;
    const result = parseBuildFile(serializeBuild(build));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.build).toEqual(build);
  });

  it('rejects invalid JSON', () => {
    const result = parseBuildFile('not json {');
    expect(result.ok).toBe(false);
  });

  it('rejects JSON that is not a build file', () => {
    const result = parseBuildFile('{"some":"thing"}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/valid build file/i);
  });

  it('rejects builds for vehicles missing from the catalogue', () => {
    const build = createDefaultBuild(getVehicle('veh-tf100-1952')!, 'Ghost vehicle');
    build.vehicleId = 'veh-does-not-exist';
    const result = parseBuildFile(serializeBuild(build));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/catalogue/);
  });

  it('rejects newer format versions', () => {
    const build = createDefaultBuild(getVehicle('veh-tf100-1952')!, 'Future');
    const raw = JSON.parse(serializeBuild(build)) as { formatVersion: number };
    raw.formatVersion = 99;
    const result = parseBuildFile(JSON.stringify(raw));
    expect(result.ok).toBe(false);
  });
});
