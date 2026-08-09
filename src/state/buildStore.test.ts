import { beforeEach, describe, expect, it } from 'vitest';
import { getVehicle } from '@/lib/catalog';
import { useBuildStore } from './buildStore';
import {
  applyStancePreset,
  setAxleSetup,
  setPaintZone,
  setPartRemoved,
  setPartVariant,
  setCameraState,
  setWheelsLinked,
  upsertFabricationRecord,
} from './buildActions';

const vehicle = () => getVehicle('veh-tf100-1952')!;

beforeEach(() => {
  useBuildStore.getState().clear();
  useBuildStore.getState().newBuildForVehicle(vehicle(), 'Test build');
});

describe('build store history', () => {
  it('creates a stock build with installed parts and paint zones', () => {
    const build = useBuildStore.getState().build!;
    expect(build.installed.length).toBeGreaterThan(10);
    expect(build.paint['body']).toBeDefined();
    // Stripe kit has variants but no default variant -> starts uninstalled.
    expect(build.installed.find((p) => p.partId === 'part-stripe')?.removed).toBe(true);
  });

  it('undo/redo restores configuration state exactly', () => {
    const before = useBuildStore.getState().build!.paint['body']!.colorHex;
    setPaintZone('body', { colorHex: '#123456' });
    expect(useBuildStore.getState().build!.paint['body']!.colorHex).toBe('#123456');
    useBuildStore.getState().undo();
    expect(useBuildStore.getState().build!.paint['body']!.colorHex).toBe(before);
    useBuildStore.getState().redo();
    expect(useBuildStore.getState().build!.paint['body']!.colorHex).toBe('#123456');
  });

  it('every build-changing action is undoable across domains', () => {
    setPartVariant('part-hood', 'var-hood-scooped');
    setPartRemoved('part-bumper-front', true);
    setAxleSetup('front', { wheelWidthIn: 9 });
    upsertFabricationRecord('part-hood', { status: 'print-candidate' });
    const store = useBuildStore.getState();
    expect(store.past.length).toBe(4);
    store.undo();
    store.undo();
    store.undo();
    useBuildStore.getState().undo();
    const build = useBuildStore.getState().build!;
    expect(build.installed.find((p) => p.partId === 'part-hood')?.variantId).toBe('var-hood-stock');
    expect(build.installed.find((p) => p.partId === 'part-bumper-front')?.removed).toBe(false);
    expect(build.wheels.front.wheelWidthIn).toBe(6);
    expect(build.fabricationRecords['part-hood']).toBeUndefined();
  });

  it('camera state updates do not pollute history', () => {
    const depth = useBuildStore.getState().past.length;
    setCameraState([1, 2, 3], [0, 0, 0]);
    expect(useBuildStore.getState().past.length).toBe(depth);
    expect(useBuildStore.getState().build!.cameraState?.position).toEqual([1, 2, 3]);
  });

  it('resetToStock returns to factory state but keeps identity, and is undoable', () => {
    const id = useBuildStore.getState().build!.id;
    setPaintZone('body', { colorHex: '#0000ff' });
    setPartRemoved('part-tailgate', true);
    useBuildStore.getState().resetToStock();
    const build = useBuildStore.getState().build!;
    expect(build.id).toBe(id);
    expect(build.paint['body']!.colorHex).not.toBe('#0000ff');
    expect(build.installed.find((p) => p.partId === 'part-tailgate')?.removed).toBe(false);
    useBuildStore.getState().undo();
    expect(useBuildStore.getState().build!.paint['body']!.colorHex).toBe('#0000ff');
  });
});

describe('wheel actions', () => {
  it('linked wheels mirror front changes to the rear', () => {
    setWheelsLinked(true);
    setAxleSetup('front', { offsetMm: -20 });
    const build = useBuildStore.getState().build!;
    expect(build.wheels.rear.offsetMm).toBe(-20);
  });

  it('unlinked wheels change independently', () => {
    setWheelsLinked(false);
    setAxleSetup('rear', { wheelWidthIn: 10 });
    const build = useBuildStore.getState().build!;
    expect(build.wheels.front.wheelWidthIn).toBe(6);
    expect(build.wheels.rear.wheelWidthIn).toBe(10);
  });

  it('stance presets apply wheels, tyres and stance together', () => {
    applyStancePreset('pro-touring');
    const build = useBuildStore.getState().build!;
    expect(build.stance.rideHeightFrontMm).toBe(-70);
    expect(build.wheels.front.tyre.rimIn).toBe(18);
    expect(build.wheels.rear.tyre.widthMm).toBe(285);
  });

  it('rejects unknown wheel variants', () => {
    setPartVariant('part-wheel', 'var-not-real');
    // no crash, no change
    expect(useBuildStore.getState().build!.wheels.front.wheelVariantId).toBe('var-wheel-steelie');
  });
});

describe('fabrication records', () => {
  it('upsert creates a record and can never set manufacturingValidated', () => {
    upsertFabricationRecord('part-grille', { status: 'needs-3d-scan', scanRequired: true });
    const record = useBuildStore.getState().build!.fabricationRecords['part-grille']!;
    expect(record.status).toBe('needs-3d-scan');
    expect(record.manufacturingValidated).toBe(false);
    // even a malicious patch can't force it
    upsertFabricationRecord('part-grille', {
      notes: 'x',
      ...({ manufacturingValidated: true } as object),
    });
    expect(
      useBuildStore.getState().build!.fabricationRecords['part-grille']!.manufacturingValidated,
    ).toBe(false);
  });
});
