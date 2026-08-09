import { describe, expect, it } from 'vitest';
import { checkAxleFitment, computeTyreSpec, diameterDeltaPct } from './tyres';
import { STOCK_AXLE, STOCK_STANCE } from '@/lib/build/defaults';
import { TF100_MANIFEST } from '@/lib/catalog';
import type { AxleSetup } from '@/lib/schemas';

describe('computeTyreSpec', () => {
  it('computes overall diameter from width/aspect/rim', () => {
    // 235/60R15: sidewall = 141 mm, diameter = 15*25.4 + 282 = 663 mm
    const spec = computeTyreSpec({
      type: 'radial',
      widthMm: 235,
      aspectPct: 60,
      rimIn: 15,
      whitewall: false,
      raisedLetters: false,
    });
    expect(spec.sidewallMm).toBeCloseTo(141, 0);
    expect(spec.diameterMm).toBeCloseTo(663, 0);
    expect(spec.designation).toBe('235/60R15');
  });

  it('marks bias-ply designations with a dash', () => {
    const spec = computeTyreSpec({ ...STOCK_AXLE.tyre, type: 'bias-ply' });
    expect(spec.designation).toContain('-');
  });

  it('computes diameter delta percentage', () => {
    expect(diameterDeltaPct(700, 735)).toBeCloseTo(5, 5);
  });
});

describe('checkAxleFitment', () => {
  const bigTyres: AxleSetup = {
    ...STOCK_AXLE,
    tyre: {
      type: 'all-terrain',
      widthMm: 315,
      aspectPct: 75,
      rimIn: 18,
      whitewall: false,
      raisedLetters: false,
    },
  };

  it('passes stock setup with no warnings', () => {
    expect(checkAxleFitment('front', STOCK_AXLE, STOCK_STANCE, TF100_MANIFEST)).toHaveLength(0);
  });

  it('warns when tyre radius exceeds well clearance', () => {
    const warnings = checkAxleFitment('front', bigTyres, STOCK_STANCE, TF100_MANIFEST);
    expect(warnings.some((w) => w.id === 'front-radius')).toBe(true);
  });

  it('lowering reduces effective clearance and can trigger warnings', () => {
    const nearLimit: AxleSetup = {
      ...STOCK_AXLE,
      tyre: {
        type: 'radial',
        widthMm: 235,
        aspectPct: 75,
        rimIn: 16,
        whitewall: false,
        raisedLetters: false,
      },
    };
    const stockWarnings = checkAxleFitment('front', nearLimit, STOCK_STANCE, TF100_MANIFEST);
    const slammed = { ...STOCK_STANCE, rideHeightFrontMm: -100 };
    const loweredWarnings = checkAxleFitment('front', nearLimit, slammed, TF100_MANIFEST);
    expect(loweredWarnings.length).toBeGreaterThanOrEqual(stockWarnings.length);
    expect(loweredWarnings.some((w) => w.id.startsWith('front-radius'))).toBe(true);
  });

  it('warns about poke with aggressive negative offset', () => {
    const poked: AxleSetup = { ...STOCK_AXLE, offsetMm: -70, spacerMm: 30 };
    const warnings = checkAxleFitment('rear', poked, STOCK_STANCE, TF100_MANIFEST);
    expect(warnings.some((w) => w.id === 'rear-width')).toBe(true);
  });

  it('flags extreme camber as a caution', () => {
    const warnings = checkAxleFitment(
      'front',
      STOCK_AXLE,
      { ...STOCK_STANCE, camberFrontDeg: -8 },
      TF100_MANIFEST,
    );
    expect(warnings.some((w) => w.id === 'front-camber')).toBe(true);
  });
});
