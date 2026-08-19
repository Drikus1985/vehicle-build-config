import { describe, expect, it } from 'vitest';
import { useBuildStore } from './buildStore';
import { useUiStore } from './uiStore';
import { getVehicle } from '@/lib/catalog';

describe('compare mode state', () => {
  it('entering compare starts against factory stock and the picker can change it', () => {
    useUiStore.getState().setCompareBuildId('build-other');
    useUiStore.getState().setMode('compare');
    expect(useUiStore.getState().compareBuildId).toBeNull();
    useUiStore.getState().setCompareBuildId('build-b');
    expect(useUiStore.getState().compareBuildId).toBe('build-b');
    // Switching workspace mode resets the B side for the next compare visit.
    useUiStore.getState().setMode('design');
    expect(useUiStore.getState().compareBuildId).toBeNull();
  });

  it('the stock reference build stays pristine while the working build changes', () => {
    useBuildStore.getState().clear();
    useBuildStore.getState().newBuildForVehicle(getVehicle('veh-nova-1970')!, 'Compare test');
    useBuildStore.getState().update((draft) => {
      draft.paint['body']!.colorHex = '#ff0000';
    });
    const { build, stockBuild } = useBuildStore.getState();
    expect(build!.paint['body']!.colorHex).toBe('#ff0000');
    expect(stockBuild!.paint['body']!.colorHex).not.toBe('#ff0000');
  });
});
