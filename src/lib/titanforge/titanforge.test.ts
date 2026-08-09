import { beforeEach, describe, expect, it } from 'vitest';
import { getVehicle, getManifestForVehicle } from '@/lib/catalog';
import { useBuildStore } from '@/state/buildStore';
import { upsertFabricationRecord } from '@/state/buildActions';
import { buildTitanforgeManifest, titanforgeManifestToCsv } from './index';

const vehicle = () => getVehicle('veh-tf100-1952')!;

beforeEach(() => {
  useBuildStore.getState().clear();
  useBuildStore.getState().newBuildForVehicle(vehicle(), 'TF test');
});

describe('Titanforge manifest export', () => {
  it('includes vehicle/build identity, provenance and the unvalidated flag', () => {
    upsertFabricationRecord('part-hood', {
      status: 'print-candidate',
      process: 'fdm-print',
      dimensionsMm: { x: 1440, y: 120, z: 1120 },
      notes: 'Check scoop clearance',
    });
    upsertFabricationRecord('part-grille', { status: 'needs-3d-scan', scanRequired: true });
    const build = useBuildStore.getState().build!;
    const manifest = buildTitanforgeManifest(build, vehicle(), getManifestForVehicle(vehicle().id));

    expect(manifest.format).toBe('titanforge/manifest');
    expect(manifest.units).toBe('mm');
    expect(manifest.vehicle.make).toBe('Titanforge');
    expect(manifest.build.name).toBe('TF test');
    expect(manifest.sourceAsset.licence).toBe('CC0-1.0');
    expect(manifest.sourceAsset.note).toMatch(/NOT manufacturing-validated/);
    expect(manifest.manufacturingValidated).toBe(false);
    expect(manifest.items).toHaveLength(2);
    const hood = manifest.items.find((i) => i.componentId === 'part-hood')!;
    expect(hood.partName).toBe('Hood');
    expect(hood.meshNodeIds).toContain('hood_stock');
    expect(hood.manufacturingValidated).toBe(false);
  });

  it('CSV export escapes quotes, commas and formula injection', () => {
    upsertFabricationRecord('part-hood', {
      status: 'modify-existing',
      notes: '=HYPERLINK("http://evil"), "quoted", and, commas',
      supplier: '+ACME, Inc.',
    });
    const build = useBuildStore.getState().build!;
    const csv = titanforgeManifestToCsv(
      buildTitanforgeManifest(build, vehicle(), getManifestForVehicle(vehicle().id)),
    );
    const lines = csv.split('\n');
    expect(lines[0]).toContain('componentId');
    expect(lines).toHaveLength(2);
    // Formula-leading values must be prefixed so spreadsheets treat them as text.
    expect(csv).toContain(`"'=HYPERLINK`);
    expect(csv).toContain(`"'+ACME, Inc."`);
    expect(csv).toContain('""quoted""');
  });
});
