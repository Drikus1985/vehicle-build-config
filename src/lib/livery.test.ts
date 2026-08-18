import { beforeEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_LIVERY_SETUP,
  LIVERY_COLORS,
  liveryHasContent,
  sanitizeLetteringText,
  sanitizeRoundelNumber,
} from './livery';
import { buildSchema } from '@/lib/schemas';
import { createDefaultBuild } from '@/lib/build/defaults';
import { getVehicle, NOVA_MANIFEST, TF100_MANIFEST } from '@/lib/catalog';
import { setLivery, toggleLiveryAnchor } from '@/state/buildActions';
import { useBuildStore } from '@/state/buildStore';

describe('livery anchors (Nova)', () => {
  it('anchors are unique, in UV range, with sane UV-per-metre frames', () => {
    const ids = NOVA_MANIFEST.liveryAnchors.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(7);
    for (const anchor of NOVA_MANIFEST.liveryAnchors) {
      for (const c of anchor.uv) expect(c, `${anchor.id} uv`).toBeGreaterThanOrEqual(0);
      for (const c of anchor.uv) expect(c, `${anchor.id} uv`).toBeLessThanOrEqual(1);
      // The atlas unwraps at ~0.2 UV/m; a broken frame would smear decals.
      for (const vec of [anchor.rightUvPerM, anchor.upUvPerM]) {
        const mag = Math.hypot(...vec);
        expect(mag, `${anchor.id} frame magnitude`).toBeGreaterThan(0.15);
        expect(mag, `${anchor.id} frame magnitude`).toBeLessThan(0.25);
      }
      expect(anchor.sizeM).toBeGreaterThan(0.05);
      expect(anchor.sizeM).toBeLessThan(0.7);
    }
    expect(LIVERY_COLORS.length).toBeGreaterThan(2);
  });

  it('livery zones are paintable zones; the TF-100 has no livery support', () => {
    expect(NOVA_MANIFEST.liveryZones.sort()).toEqual(['body', 'hood']);
    for (const zoneId of NOVA_MANIFEST.liveryZones) {
      const zone = NOVA_MANIFEST.materialZones.find((z) => z.id === zoneId);
      expect(zone?.paintable, `zone ${zoneId}`).toBe(true);
    }
    expect(NOVA_MANIFEST.liverySource?.uri).toContain('nova-1970-uv.glb');
    expect(TF100_MANIFEST.liveryAnchors).toHaveLength(0);
    expect(TF100_MANIFEST.liverySource).toBeUndefined();
  });
});

describe('livery build state', () => {
  it('default builds start with an empty livery and legacy builds still parse', () => {
    const build = createDefaultBuild(getVehicle('veh-nova-1970')!);
    expect(build.livery).toEqual(DEFAULT_LIVERY_SETUP);
    expect(liveryHasContent(build.livery)).toBe(false);
    const legacy = JSON.parse(JSON.stringify(build)) as Record<string, unknown>;
    delete legacy['livery'];
    const parsed = buildSchema.safeParse(legacy);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.livery).toEqual(DEFAULT_LIVERY_SETUP);
  });

  it('rejects out-of-range livery sizes and overlong numbers', () => {
    const build = createDefaultBuild(getVehicle('veh-nova-1970')!);
    const bad = JSON.parse(JSON.stringify(build)) as {
      livery: { roundels: { sizeScale: number; number: string } };
    };
    bad.livery.roundels.sizeScale = 2;
    expect(buildSchema.safeParse(bad).success).toBe(false);
    bad.livery.roundels.sizeScale = 1;
    bad.livery.roundels.number = 'ABCD';
    expect(buildSchema.safeParse(bad).success).toBe(false);
  });
});

describe('livery sanitisers', () => {
  it('racing numbers keep alphanumerics only, max 3, uppercased', () => {
    expect(sanitizeRoundelNumber('7')).toBe('7');
    expect(sanitizeRoundelNumber('x-33!')).toBe('X33');
    expect(sanitizeRoundelNumber('12345')).toBe('123');
  });

  it('lettering keeps a printable subset and collapses spaces', () => {
    expect(sanitizeLetteringText("O'BRIEN & CO.")).toBe("O'BRIEN & CO.");
    expect(sanitizeLetteringText('BAD<script>')).toBe('BADscript');
    expect(sanitizeLetteringText('A  LOT   OF SPACE')).toBe('A LOT OF SPACE');
    expect(sanitizeLetteringText('X'.repeat(40))).toHaveLength(18);
  });
});

describe('setLivery / toggleLiveryAnchor actions', () => {
  beforeEach(() => {
    useBuildStore.getState().clear();
    useBuildStore.getState().newBuildForVehicle(getVehicle('veh-nova-1970')!, 'Livery test');
  });

  it('updates roundels and lettering with sanitisation, undoably', () => {
    setLivery({ roundels: { number: 'x-7', discHex: '#b1121b' } });
    toggleLiveryAnchor('roundels', 'door-l');
    toggleLiveryAnchor('lettering', 'quarter-l');
    setLivery({ lettering: { text: '  All American  ' } });
    const build = useBuildStore.getState().build!;
    expect(build.livery.roundels.number).toBe('X7');
    expect(build.livery.roundels.discHex).toBe('#b1121b');
    expect(build.livery.roundels.anchorIds).toEqual(['door-l']);
    expect(build.livery.lettering.text).toBe('All American ');
    expect(liveryHasContent(build.livery)).toBe(true);
    // Toggling off removes the anchor; undo restores it.
    toggleLiveryAnchor('roundels', 'door-l');
    expect(useBuildStore.getState().build!.livery.roundels.anchorIds).toEqual([]);
    useBuildStore.getState().undo();
    expect(useBuildStore.getState().build!.livery.roundels.anchorIds).toEqual(['door-l']);
  });
});
