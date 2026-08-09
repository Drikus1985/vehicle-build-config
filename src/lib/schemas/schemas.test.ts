import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  assetManifestSchema,
  buildSchema,
  partSchema,
  partVariantSchema,
  vehicleSchema,
} from './index';
import { TF100_MANIFEST, TF100_PARTS, TF100_VARIANTS, VEHICLES } from '@/lib/catalog';
import { createDefaultBuild } from '@/lib/build/defaults';

describe('seed catalogue validity', () => {
  it('every vehicle passes the Vehicle schema', () => {
    for (const v of VEHICLES) {
      expect(vehicleSchema.safeParse(v).success, `vehicle ${v.id}`).toBe(true);
    }
  });

  it('the TF-100 manifest passes the AssetManifest schema', () => {
    const parsed = assetManifestSchema.safeParse(TF100_MANIFEST);
    expect(parsed.success).toBe(true);
  });

  it('all parts and variants pass their schemas, and references line up', () => {
    const variantIds = new Set(TF100_VARIANTS.map((v) => v.id));
    for (const p of TF100_PARTS) {
      expect(partSchema.safeParse(p).success, `part ${p.id}`).toBe(true);
      for (const vid of p.variantIds) {
        expect(variantIds.has(vid), `part ${p.id} references missing variant ${vid}`).toBe(true);
      }
      if (p.defaultVariantId) expect(p.variantIds).toContain(p.defaultVariantId);
    }
    for (const v of TF100_VARIANTS) {
      expect(partVariantSchema.safeParse(v).success, `variant ${v.id}`).toBe(true);
      expect(
        TF100_PARTS.some((p) => p.id === v.partId),
        `variant ${v.id} orphan`,
      ).toBe(true);
    }
  });

  it('manifest mesh nodes reference known parts and material zones', () => {
    const partIds = new Set(TF100_PARTS.map((p) => p.id));
    const zoneIds = new Set(TF100_MANIFEST.materialZones.map((z) => z.id));
    for (const node of TF100_MANIFEST.meshNodes) {
      if (node.componentId) expect(partIds.has(node.componentId), node.nodeName).toBe(true);
      if (node.materialZoneId) expect(zoneIds.has(node.materialZoneId), node.nodeName).toBe(true);
    }
  });

  it('every part meshNodeId exists in the manifest', () => {
    const nodeNames = new Set(TF100_MANIFEST.meshNodes.map((n) => n.nodeName));
    for (const p of TF100_PARTS) {
      for (const id of p.meshNodeIds) {
        expect(nodeNames.has(id), `part ${p.id} node ${id}`).toBe(true);
      }
    }
  });

  it('a default build for the demo vehicle passes the Build schema', () => {
    const vehicle = VEHICLES.find((v) => v.id === 'veh-tf100-1952')!;
    const build = createDefaultBuild(vehicle);
    expect(buildSchema.safeParse(build).success).toBe(true);
  });
});

describe('generated GLB ↔ manifest agreement', () => {
  it('the demo GLB contains every mesh node named in the manifest', () => {
    const glbPath = resolve(process.cwd(), 'public/assets/vehicles/tf100-stepside.glb');
    const buffer = readFileSync(glbPath);
    // GLB layout: 12-byte header, then chunk 0 = JSON.
    expect(buffer.toString('ascii', 0, 4)).toBe('glTF');
    const jsonLength = buffer.readUInt32LE(12);
    const json = JSON.parse(buffer.toString('utf8', 20, 20 + jsonLength)) as {
      nodes?: { name?: string }[];
    };
    const names = new Set((json.nodes ?? []).map((n) => n.name));
    for (const node of TF100_MANIFEST.meshNodes) {
      expect(names.has(node.nodeName), `GLB missing node ${node.nodeName}`).toBe(true);
    }
  });
});
