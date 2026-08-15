import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  NOVA_MANIFEST,
  NOVA_PARTS,
  NOVA_VARIANTS,
  getOemWheelsetPart,
  getPartsForVehicle,
  getVehicle,
  hasActiveOemWheelset,
} from './index';
import { assetManifestSchema, partSchema, partVariantSchema } from '@/lib/schemas';
import { createDefaultBuild } from '@/lib/build/defaults';
import { setPartRemoved } from '@/state/buildActions';
import { useBuildStore } from '@/state/buildStore';

const GLB_PATH = resolve(process.cwd(), 'public/assets/vehicles/nova-1970.glb');

describe('Nova catalogue data', () => {
  it('manifest, parts and variants pass their schemas with consistent references', () => {
    expect(assetManifestSchema.safeParse(NOVA_MANIFEST).success).toBe(true);
    const partIds = new Set(NOVA_PARTS.map((p) => p.id));
    const zoneIds = new Set(NOVA_MANIFEST.materialZones.map((z) => z.id));
    const nodeNames = new Set(NOVA_MANIFEST.meshNodes.map((n) => n.nodeName));
    for (const node of NOVA_MANIFEST.meshNodes) {
      if (node.componentId) expect(partIds.has(node.componentId), node.nodeName).toBe(true);
      if (node.materialZoneId) expect(zoneIds.has(node.materialZoneId), node.nodeName).toBe(true);
    }
    const variantIds = new Set(NOVA_VARIANTS.map((v) => v.id));
    for (const p of NOVA_PARTS) {
      expect(partSchema.safeParse(p).success, p.id).toBe(true);
      for (const id of p.meshNodeIds) expect(nodeNames.has(id), `${p.id} node ${id}`).toBe(true);
      for (const vid of p.variantIds)
        expect(variantIds.has(vid), `${p.id} variant ${vid}`).toBe(true);
    }
    for (const v of NOVA_VARIANTS) {
      expect(partVariantSchema.safeParse(v).success, v.id).toBe(true);
    }
  });

  it('the Nova vehicle resolves its manifest and full parts list', () => {
    const vehicle = getVehicle('veh-nova-1970')!;
    expect(vehicle.assetManifestId).toBe('manifest-nova-1970');
    const parts = getPartsForVehicle(vehicle).filter((p) => p.meshNodeIds.length > 0);
    expect(parts.length).toBeGreaterThan(20);
    // Nova-only parts must not leak onto other vehicles.
    const tf100Parts = getPartsForVehicle(getVehicle('veh-tf100-1952')!);
    expect(tf100Parts.some((p) => p.id.startsWith('part-nova'))).toBe(false);
  });

  it('OEM wheelset is installed on the stock build and suspends the parametric system', () => {
    const vehicle = getVehicle('veh-nova-1970')!;
    expect(getOemWheelsetPart(vehicle)?.id).toBe('part-nova-oem-wheelset');
    useBuildStore.getState().clear();
    useBuildStore.getState().newBuildForVehicle(vehicle, 'Nova test');
    const build = useBuildStore.getState().build!;
    expect(hasActiveOemWheelset(build)).toBe(true);
    // Removing it re-enables parametric wheels; undo restores the OEM set.
    setPartRemoved('part-nova-oem-wheelset', true);
    expect(hasActiveOemWheelset(useBuildStore.getState().build!)).toBe(false);
    useBuildStore.getState().undo();
    expect(hasActiveOemWheelset(useBuildStore.getState().build!)).toBe(true);
  });

  it('the TF-100 has no OEM wheelset (procedural wheels always active)', () => {
    useBuildStore.getState().clear();
    useBuildStore.getState().newBuildForVehicle(getVehicle('veh-tf100-1952')!);
    expect(hasActiveOemWheelset(useBuildStore.getState().build!)).toBe(false);
  });

  // The purchased GLB is not committed (Standard License); this cross-check
  // runs only where the file is installed locally.
  it.skipIf(!existsSync(GLB_PATH))('every manifest node exists in the local Nova GLB', () => {
    const buffer = readFileSync(GLB_PATH);
    expect(buffer.toString('ascii', 0, 4)).toBe('glTF');
    const jsonLength = buffer.readUInt32LE(12);
    const json = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength)) as {
      nodes?: { name?: string }[];
    };
    const names = new Set((json.nodes ?? []).map((n) => n.name));
    for (const node of NOVA_MANIFEST.meshNodes) {
      expect(names.has(node.nodeName), `GLB missing node ${node.nodeName}`).toBe(true);
    }
    // And the manifest maps every node in the GLB (nothing unaccounted for).
    const mapped = new Set(NOVA_MANIFEST.meshNodes.map((n) => n.nodeName));
    for (const name of names) {
      expect(mapped.has(name as string), `GLB node ${name} unmapped in manifest`).toBe(true);
    }
  });

  it('a default Nova build validates and paints body + interior zones', () => {
    const vehicle = getVehicle('veh-nova-1970')!;
    const build = createDefaultBuild(vehicle);
    expect(build.paint['body']).toBeDefined();
    expect(build.paint['interior']).toBeDefined();
    // Non-paintable zones must not appear in the paint state.
    expect(build.paint['chrome']).toBeUndefined();
    expect(build.paint['glass']).toBeUndefined();
  });
});
