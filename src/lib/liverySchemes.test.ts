import { beforeEach, describe, expect, it } from 'vitest';
import { getLiveryScheme, LIVERY_SCHEMES } from './liverySchemes';
import { DEFAULT_LIVERY_SETUP, liveryHasContent } from './livery';
import { buildSchema, type LiveryPanel } from '@/lib/schemas';
import { createDefaultBuild } from '@/lib/build/defaults';
import { getVehicle, NOVA_MANIFEST } from '@/lib/catalog';
import { setLivery } from '@/state/buildActions';
import { useBuildStore } from '@/state/buildStore';

function project(panel: LiveryPanel, pt: [number, number, number]): [number, number] {
  const d = [pt[0] - panel.origin[0], pt[1] - panel.origin[1], pt[2] - panel.origin[2]];
  const r = d[0]! * panel.rightDir[0] + d[1]! * panel.rightDir[1] + d[2]! * panel.rightDir[2];
  const u = d[0]! * panel.upDir[0] + d[1]! * panel.upDir[1] + d[2]! * panel.upDir[2];
  return [
    panel.uv[0] + panel.rightUvPerM[0] * r + panel.upUvPerM[0] * u,
    panel.uv[1] + panel.rightUvPerM[1] * r + panel.upUvPerM[1] * u,
  ];
}

describe('livery schemes', () => {
  it('schemes are unique, labelled, and reference existing Nova panels', () => {
    const ids = LIVERY_SCHEMES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(4);
    expect(ids).not.toContain('none');
    const panelIds = new Set(NOVA_MANIFEST.liveryPanels.map((p) => p.id));
    for (const scheme of LIVERY_SCHEMES) {
      expect(scheme.label.length).toBeGreaterThan(0);
      expect(scheme.shapes.length).toBeGreaterThan(0);
      for (const shape of scheme.shapes) {
        expect(shape.pts.length, `${scheme.id} polygon size`).toBeGreaterThanOrEqual(3);
        for (const panel of shape.panels) {
          expect(panelIds.has(panel), `${scheme.id} → panel ${panel}`).toBe(true);
        }
        // Shapes stay within the car's bounding volume (metres).
        for (const [x, y, z] of shape.pts) {
          expect(Math.abs(x), `${scheme.id} x`).toBeLessThanOrEqual(1);
          expect(y, `${scheme.id} y`).toBeGreaterThanOrEqual(0);
          expect(y, `${scheme.id} y`).toBeLessThanOrEqual(1.5);
          expect(Math.abs(z), `${scheme.id} z`).toBeLessThanOrEqual(2.5);
        }
      }
    }
    expect(getLiveryScheme('none')).toBeUndefined();
    expect(getLiveryScheme('spear')?.label).toBe('Side spear');
  });

  it('panel frames reproduce independently measured vertex UVs', () => {
    // Regression against scripts/probe-nova-livery-anchors.mjs: the door
    // frame must predict the quarter and fender vertices (same island).
    const sideL = NOVA_MANIFEST.liveryPanels.find((p) => p.id === 'side-l')!;
    const quarter = project(sideL, [0.9306, 0.7686, -1.487]);
    expect(quarter[0]).toBeCloseTo(0.7957, 2);
    expect(quarter[1]).toBeCloseTo(0.6376, 2);
    const fender = project(sideL, [0.9331, 0.6802, 1.8602]);
    expect(fender[0]).toBeCloseTo(0.1178, 2);
    expect(fender[1]).toBeCloseTo(0.6197, 2);
    // Every panel's own origin maps to its own UV, and frames are ~0.2 UV/m.
    for (const panel of NOVA_MANIFEST.liveryPanels) {
      const self = project(panel, panel.origin);
      expect(self[0]).toBeCloseTo(panel.uv[0], 6);
      expect(self[1]).toBeCloseTo(panel.uv[1], 6);
      for (const vec of [panel.rightUvPerM, panel.upUvPerM]) {
        const mag = Math.hypot(...vec);
        expect(mag, `${panel.id} frame`).toBeGreaterThan(0.15);
        expect(mag, `${panel.id} frame`).toBeLessThan(0.25);
      }
    }
  });

  it('builds saved before the scheme field existed parse with scheme none', () => {
    const build = createDefaultBuild(getVehicle('veh-nova-1970')!);
    const legacy = JSON.parse(JSON.stringify(build)) as {
      livery: Record<string, unknown>;
    };
    delete legacy.livery['scheme'];
    const parsed = buildSchema.safeParse(legacy);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.livery.scheme).toEqual(DEFAULT_LIVERY_SETUP.scheme);
    // Malformed colours are rejected.
    const bad = JSON.parse(JSON.stringify(build)) as {
      livery: { scheme: { accentHex: string } };
    };
    bad.livery.scheme.accentHex = 'red';
    expect(buildSchema.safeParse(bad).success).toBe(false);
  });
});

describe('scheme build state', () => {
  beforeEach(() => {
    useBuildStore.getState().clear();
    useBuildStore.getState().newBuildForVehicle(getVehicle('veh-nova-1970')!, 'Scheme test');
  });

  it('selecting a scheme counts as livery content and is undoable', () => {
    expect(liveryHasContent(useBuildStore.getState().build!.livery)).toBe(false);
    setLivery({ scheme: { id: 'hockey', primaryHex: '#141519' } });
    const livery = useBuildStore.getState().build!.livery;
    expect(livery.scheme.id).toBe('hockey');
    expect(livery.scheme.primaryHex).toBe('#141519');
    expect(liveryHasContent(livery)).toBe(true);
    // An unknown scheme id draws nothing and counts as no content.
    setLivery({ scheme: { id: 'not-a-scheme' } });
    expect(liveryHasContent(useBuildStore.getState().build!.livery)).toBe(false);
    useBuildStore.getState().undo();
    useBuildStore.getState().undo();
    expect(useBuildStore.getState().build!.livery.scheme.id).toBe('none');
  });
});
