import { beforeEach, describe, expect, it } from 'vitest';
import { getVehicle } from '@/lib/catalog';
import { useBuildStore } from '@/state/buildStore';
import { analyzeVehicleChange, checkPartCompatibility } from './compat';

describe('compatibility checks', () => {
  beforeEach(() => {
    useBuildStore.getState().clear();
    useBuildStore.getState().newBuildForVehicle(getVehicle('veh-tf100-1952')!);
  });

  it('TF-100 parts are compatible with the TF-100', () => {
    expect(
      checkPartCompatibility('part-hood', 'var-hood-scooped', getVehicle('veh-tf100-1952')!),
    ).toBeNull();
  });

  it('TF-100-specific parts are incompatible with other vehicles', () => {
    const issue = checkPartCompatibility(
      'part-hood',
      'var-hood-stock',
      getVehicle('veh-mustang-1965')!,
    );
    expect(issue).not.toBeNull();
    expect(issue!.reason).toMatch(/Not listed/);
  });

  it('body-style-restricted parts report the restriction', () => {
    // part-bed requires a stepside body style.
    const issue = checkPartCompatibility('part-bed', null, getVehicle('veh-c10-1967')!);
    expect(issue).not.toBeNull();
  });

  it('changing base vehicle reports every incompatible installed part', () => {
    const build = useBuildStore.getState().build!;
    const issues = analyzeVehicleChange(build, getVehicle('veh-belair-1957')!);
    // Every installed (non-removed) TF-100 part is incompatible with the Bel Air.
    const installedCount = build.installed.filter((p) => !p.removed).length;
    expect(issues).toHaveLength(installedCount);
    expect(issues.every((i) => i.reason.length > 0)).toBe(true);
  });
});
