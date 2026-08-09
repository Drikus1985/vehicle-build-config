import type { AssetManifest, AxleSetup, Stance, TyreSetup } from '@/lib/schemas';

export const MM_PER_IN = 25.4;

/** Derived tyre/wheel measurements. Purely geometric; indicative only. */
export interface TyreSpec {
  /** Overall tyre diameter in mm (rim + 2 * sidewall). */
  diameterMm: number;
  sidewallMm: number;
  circumferenceMm: number;
  /** Common size designation, e.g. "235/60R15". */
  designation: string;
}

export function computeTyreSpec(tyre: TyreSetup): TyreSpec {
  const sidewallMm = (tyre.widthMm * tyre.aspectPct) / 100;
  const diameterMm = tyre.rimIn * MM_PER_IN + 2 * sidewallMm;
  const construction = tyre.type === 'bias-ply' ? '-' : 'R';
  return {
    diameterMm,
    sidewallMm,
    circumferenceMm: Math.PI * diameterMm,
    designation: `${tyre.widthMm}/${tyre.aspectPct}${construction}${tyre.rimIn}`,
  };
}

export interface FitmentWarning {
  id: string;
  severity: 'caution' | 'warning';
  message: string;
}

/**
 * Indicative interference checks for one axle against the manifest's wheel-well
 * clearance metadata. These are geometric estimates from display-asset bounds,
 * NOT engineering measurements — the UI must label them as indicative.
 */
export function checkAxleFitment(
  axle: 'front' | 'rear',
  setup: AxleSetup,
  stance: Stance,
  manifest: AssetManifest,
): FitmentWarning[] {
  const warnings: FitmentWarning[] = [];
  const anchor = manifest.wheelAnchors.find((a) => a.axle === axle);
  if (!anchor) return warnings;

  const spec = computeTyreSpec(setup.tyre);
  const radiusM = spec.diameterMm / 2000;
  const widthM = setup.tyre.widthMm / 1000;
  const rideDropM = (axle === 'front' ? stance.rideHeightFrontMm : stance.rideHeightRearMm) / 1000;

  // Lowering the body reduces effective radial clearance in the well.
  const clearance = anchor.wellClearanceRadiusM + Math.min(0, rideDropM);
  if (radiusM > clearance) {
    warnings.push({
      id: `${axle}-radius`,
      severity: 'warning',
      message: `${axle === 'front' ? 'Front' : 'Rear'} tyre radius (~${Math.round(radiusM * 1000)} mm) likely exceeds wheel-well clearance (~${Math.round(clearance * 1000)} mm) at this ride height.`,
    });
  } else if (radiusM > clearance - 0.02) {
    warnings.push({
      id: `${axle}-radius-close`,
      severity: 'caution',
      message: `${axle === 'front' ? 'Front' : 'Rear'} tyre is within 20 mm of estimated wheel-well clearance — check bump travel.`,
    });
  }

  const offsetOutboardM = (-setup.offsetMm + setup.spacerMm) / 1000;
  const trackDeltaM =
    (axle === 'front' ? stance.trackWidthFrontMm : stance.trackWidthRearMm) / 1000;
  const effectiveWidth = widthM + Math.max(0, offsetOutboardM + trackDeltaM) * 2;
  if (effectiveWidth > anchor.wellClearanceWidthM + 0.06) {
    warnings.push({
      id: `${axle}-width`,
      severity: 'warning',
      message: `${axle === 'front' ? 'Front' : 'Rear'} tyre/offset combination likely pokes past the fender line.`,
    });
  } else if (widthM > anchor.wellClearanceWidthM) {
    warnings.push({
      id: `${axle}-width-inner`,
      severity: 'caution',
      message: `${axle === 'front' ? 'Front' : 'Rear'} tyre section is wider than the estimated well — possible frame/inner-fender rub.`,
    });
  }

  if (axle === 'front' && Math.abs(stance.steeringAngleDeg) > 20 && widthM > 0.245) {
    warnings.push({
      id: 'front-steering-rub',
      severity: 'caution',
      message: 'Wide front tyres may rub at full steering lock.',
    });
  }

  const camber = axle === 'front' ? stance.camberFrontDeg : stance.camberRearDeg;
  if (camber < -6) {
    warnings.push({
      id: `${axle}-camber`,
      severity: 'caution',
      message: `${axle === 'front' ? 'Front' : 'Rear'} camber beyond -6° accelerates inner tyre wear; shown for stance inspection only.`,
    });
  }

  return warnings;
}

/** Speedometer-style comparison between two overall diameters. */
export function diameterDeltaPct(referenceMm: number, actualMm: number): number {
  return ((actualMm - referenceMm) / referenceMm) * 100;
}
