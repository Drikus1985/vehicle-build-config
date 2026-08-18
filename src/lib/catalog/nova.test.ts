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
import { setPartRemoved, setPartVariant } from '@/state/buildActions';
import { useBuildStore } from '@/state/buildStore';

const GLB_PATH = resolve(process.cwd(), 'public/assets/vehicles/nova-1970.glb');
const UV_GLB_PATH = resolve(process.cwd(), 'public/assets/vehicles/nova-1970-uv.glb');
const ADDONS_GLB_PATH = resolve(process.cwd(), 'public/assets/vehicles/nova-addons.glb');

// Window glass panes split during the seller's UV work — present only in the
// UV-mapped liverySource asset, absent from the original GLB.
const UV_ONLY_NODES = new Set(['Object001', 'Object002']);

function glbJson(path: string): {
  nodes?: { name?: string; mesh?: number }[];
  extensionsRequired?: string[];
} {
  const buffer = readFileSync(path);
  expect(buffer.toString('ascii', 0, 4)).toBe('glTF');
  const jsonLength = buffer.readUInt32LE(12);
  return JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength)) as ReturnType<typeof glbJson>;
}

function glbNodeNames(path: string): Set<string> {
  // Only mesh-bearing nodes matter to the manifest; container groups don't.
  return new Set(
    (glbJson(path).nodes ?? []).filter((n) => n.mesh !== undefined).map((n) => n.name ?? ''),
  );
}

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

  it('the committed add-on GLB contains every addon node the manifest names', () => {
    const addonNames = glbNodeNames(ADDONS_GLB_PATH);
    for (const name of [
      'cowl_scoop_2in',
      'cowl_scoop_4in',
      'chin_spoiler',
      'trunk_spoiler_ducktail',
      'trunk_spoiler_wing',
    ]) {
      expect(addonNames.has(name), `addons GLB missing ${name}`).toBe(true);
    }
  });

  // The purchased GLB is not committed (Standard License); this cross-check
  // runs only where the file is installed locally.
  it.skipIf(!existsSync(GLB_PATH))('every manifest node exists in the local GLBs', () => {
    const names = new Set([...glbNodeNames(GLB_PATH), ...glbNodeNames(ADDONS_GLB_PATH)]);
    for (const node of NOVA_MANIFEST.meshNodes) {
      if (UV_ONLY_NODES.has(node.nodeName)) continue;
      expect(names.has(node.nodeName), `GLBs missing node ${node.nodeName}`).toBe(true);
    }
    // And the manifest maps every node in both GLBs (nothing unaccounted for).
    const mapped = new Set(NOVA_MANIFEST.meshNodes.map((n) => n.nodeName));
    for (const name of names) {
      expect(mapped.has(name), `GLB node ${name} unmapped in manifest`).toBe(true);
    }
  });

  // Same cross-check against the UV-mapped liverySource asset (also licensed
  // and uncommitted): it must contain every non-addon manifest node.
  it.skipIf(!existsSync(UV_GLB_PATH))('the UV asset covers every manifest node', () => {
    const uvNames = glbNodeNames(UV_GLB_PATH);
    const addonNames = glbNodeNames(ADDONS_GLB_PATH);
    for (const node of NOVA_MANIFEST.meshNodes) {
      if (addonNames.has(node.nodeName)) continue;
      expect(uvNames.has(node.nodeName), `UV GLB missing node ${node.nodeName}`).toBe(true);
    }
    const mapped = new Set(NOVA_MANIFEST.meshNodes.map((n) => n.nodeName));
    for (const name of uvNames) {
      expect(mapped.has(name), `UV GLB node ${name} unmapped in manifest`).toBe(true);
    }
  });

  // Manifest compression metadata must match the installed files: when the
  // manifest says draco, the GLB must require KHR_draco_mesh_compression (and
  // vice versa) so the loader's expectations stay truthful.
  it.skipIf(!existsSync(GLB_PATH) || !existsSync(UV_GLB_PATH))(
    'compression metadata matches the local asset files',
    () => {
      for (const [source, path] of [
        [NOVA_MANIFEST.source, GLB_PATH],
        [NOVA_MANIFEST.liverySource!, UV_GLB_PATH],
      ] as const) {
        const isDraco = (glbJson(path).extensionsRequired ?? []).includes(
          'KHR_draco_mesh_compression',
        );
        expect(isDraco, path).toBe(source.compression === 'draco');
      }
    },
  );

  it('a default Nova build exposes every independent paint zone', () => {
    const vehicle = getVehicle('veh-nova-1970')!;
    const build = createDefaultBuild(vehicle);
    for (const zone of [
      'body',
      'interior',
      'hood',
      'bumper-front',
      'bumper-rear',
      'grille',
      'trim',
    ]) {
      expect(build.paint[zone], `paint zone ${zone}`).toBeDefined();
    }
    // Non-paintable zones must not appear in the paint state.
    expect(build.paint['chrome']).toBeUndefined();
    expect(build.paint['glass']).toBeUndefined();
  });

  it('interchange add-on parts start uninstalled with selectable variants', () => {
    const vehicle = getVehicle('veh-nova-1970')!;
    useBuildStore.getState().clear();
    useBuildStore.getState().newBuildForVehicle(vehicle, 'Addon test');
    const build = useBuildStore.getState().build!;
    for (const partId of [
      'part-nova-cowl-scoop',
      'part-nova-chin-spoiler',
      'part-nova-trunk-spoiler',
    ]) {
      expect(
        build.installed.find((e) => e.partId === partId)?.removed,
        `${partId} should start uninstalled`,
      ).toBe(true);
    }
    // Installing the 4" cowl scoop selects its variant and shows only that node.
    setPartVariant('part-nova-cowl-scoop', 'var-nova-cowl-4in');
    const entry = useBuildStore
      .getState()
      .build!.installed.find((e) => e.partId === 'part-nova-cowl-scoop')!;
    expect(entry.removed).toBe(false);
    expect(entry.variantId).toBe('var-nova-cowl-4in');
  });
});
