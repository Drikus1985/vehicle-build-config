import { getManifestForVehicle, getPartsForVehicle } from '@/lib/catalog';
import type { AxleSetup, Build, PaintZoneSetting, Stance, Vehicle } from '@/lib/schemas';
import { SCHEMA_VERSION } from '@/lib/schemas';

export function newId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export const STOCK_STANCE: Stance = {
  rideHeightFrontMm: 0,
  rideHeightRearMm: 0,
  camberFrontDeg: 0,
  camberRearDeg: 0,
  trackWidthFrontMm: 0,
  trackWidthRearMm: 0,
  steeringAngleDeg: 0,
};

export const STOCK_AXLE: AxleSetup = {
  wheelVariantId: 'var-wheel-steelie',
  wheelWidthIn: 6,
  offsetMm: 0,
  spacerMm: 0,
  tyre: {
    type: 'bias-ply',
    widthMm: 205,
    aspectPct: 75,
    rimIn: 16,
    whitewall: true,
    raisedLetters: false,
  },
};

export interface StancePreset {
  id: string;
  label: string;
  description: string;
  stance: Stance;
  front: Partial<AxleSetup> & { tyre?: AxleSetup['tyre'] };
  rear: Partial<AxleSetup> & { tyre?: AxleSetup['tyre'] };
  /** Vehicle types the preset makes sense for; empty = all. */
  vehicleTypes: Vehicle['vehicleType'][];
}

export const STANCE_PRESETS: StancePreset[] = [
  {
    id: 'stock',
    label: 'Stock',
    description: 'Factory ride height and wheel/tyre package.',
    stance: STOCK_STANCE,
    front: { ...STOCK_AXLE },
    rear: { ...STOCK_AXLE },
    vehicleTypes: [],
  },
  {
    id: 'street',
    label: 'Street',
    description: 'Mild drop, slightly wider radials.',
    stance: { ...STOCK_STANCE, rideHeightFrontMm: -35, rideHeightRearMm: -25, camberFrontDeg: -1 },
    front: {
      wheelVariantId: 'var-wheel-smoothie',
      wheelWidthIn: 7,
      tyre: {
        type: 'radial',
        widthMm: 215,
        aspectPct: 70,
        rimIn: 15,
        whitewall: false,
        raisedLetters: false,
      },
    },
    rear: {
      wheelVariantId: 'var-wheel-smoothie',
      wheelWidthIn: 8,
      tyre: {
        type: 'radial',
        widthMm: 235,
        aspectPct: 70,
        rimIn: 15,
        whitewall: false,
        raisedLetters: false,
      },
    },
    vehicleTypes: [],
  },
  {
    id: 'pro-touring',
    label: 'Pro Touring',
    description: 'Low, wide, negative camber, large-diameter wheels.',
    stance: {
      ...STOCK_STANCE,
      rideHeightFrontMm: -70,
      rideHeightRearMm: -60,
      camberFrontDeg: -2.5,
      camberRearDeg: -1.5,
      trackWidthFrontMm: 15,
      trackWidthRearMm: 20,
    },
    front: {
      wheelVariantId: 'var-wheel-five-spoke',
      wheelWidthIn: 9,
      offsetMm: -6,
      tyre: {
        type: 'radial',
        widthMm: 255,
        aspectPct: 40,
        rimIn: 18,
        whitewall: false,
        raisedLetters: false,
      },
    },
    rear: {
      wheelVariantId: 'var-wheel-five-spoke',
      wheelWidthIn: 10,
      offsetMm: -12,
      tyre: {
        type: 'radial',
        widthMm: 285,
        aspectPct: 40,
        rimIn: 18,
        whitewall: false,
        raisedLetters: false,
      },
    },
    vehicleTypes: [],
  },
  {
    id: 'drag',
    label: 'Drag',
    description: 'Nose-up rake, skinnies front, slicks rear.',
    stance: { ...STOCK_STANCE, rideHeightFrontMm: 25, rideHeightRearMm: -15 },
    front: {
      wheelVariantId: 'var-wheel-slot-mag',
      wheelWidthIn: 4.5,
      tyre: {
        type: 'radial',
        widthMm: 165,
        aspectPct: 80,
        rimIn: 15,
        whitewall: false,
        raisedLetters: false,
      },
    },
    rear: {
      wheelVariantId: 'var-wheel-slot-mag',
      wheelWidthIn: 10,
      offsetMm: -20,
      tyre: {
        type: 'drag-slick',
        widthMm: 295,
        aspectPct: 65,
        rimIn: 15,
        whitewall: false,
        raisedLetters: true,
      },
    },
    vehicleTypes: [],
  },
  {
    id: 'lowrider',
    label: 'Lowrider',
    description: 'Slammed, small-diameter wire-look wheels, whitewalls.',
    stance: { ...STOCK_STANCE, rideHeightFrontMm: -95, rideHeightRearMm: -95 },
    front: {
      wheelVariantId: 'var-wheel-rally',
      wheelWidthIn: 5.5,
      tyre: {
        type: 'radial',
        widthMm: 175,
        aspectPct: 75,
        rimIn: 13,
        whitewall: true,
        raisedLetters: false,
      },
    },
    rear: {
      wheelVariantId: 'var-wheel-rally',
      wheelWidthIn: 5.5,
      tyre: {
        type: 'radial',
        widthMm: 175,
        aspectPct: 75,
        rimIn: 13,
        whitewall: true,
        raisedLetters: false,
      },
    },
    vehicleTypes: ['car', 'wagon'],
  },
  {
    id: 'restomod',
    label: 'Restomod',
    description: 'Stock-adjacent look with modern radials and subtle drop.',
    stance: {
      ...STOCK_STANCE,
      rideHeightFrontMm: -45,
      rideHeightRearMm: -40,
      camberFrontDeg: -1.2,
    },
    front: {
      wheelVariantId: 'var-wheel-rally',
      wheelWidthIn: 8,
      tyre: {
        type: 'radial',
        widthMm: 235,
        aspectPct: 55,
        rimIn: 17,
        whitewall: false,
        raisedLetters: false,
      },
    },
    rear: {
      wheelVariantId: 'var-wheel-rally',
      wheelWidthIn: 8,
      tyre: {
        type: 'radial',
        widthMm: 255,
        aspectPct: 55,
        rimIn: 17,
        whitewall: false,
        raisedLetters: false,
      },
    },
    vehicleTypes: [],
  },
  {
    id: 'off-road',
    label: 'Off-road',
    description: 'Lifted with all-terrains. Trucks and wagons.',
    stance: { ...STOCK_STANCE, rideHeightFrontMm: 70, rideHeightRearMm: 70 },
    front: {
      wheelVariantId: 'var-wheel-steelie',
      wheelWidthIn: 8,
      offsetMm: -15,
      tyre: {
        type: 'all-terrain',
        widthMm: 265,
        aspectPct: 75,
        rimIn: 16,
        whitewall: false,
        raisedLetters: true,
      },
    },
    rear: {
      wheelVariantId: 'var-wheel-steelie',
      wheelWidthIn: 8,
      offsetMm: -15,
      tyre: {
        type: 'all-terrain',
        widthMm: 265,
        aspectPct: 75,
        rimIn: 16,
        whitewall: false,
        raisedLetters: true,
      },
    },
    vehicleTypes: ['pickup', 'panel-truck', 'van', 'wagon'],
  },
];

/** Build the factory-stock Build for a vehicle from its manifest + part data. */
export function createDefaultBuild(vehicle: Vehicle, name = 'Untitled build'): Build {
  const manifest = getManifestForVehicle(vehicle.id);
  const paint: Record<string, PaintZoneSetting> = {};
  if (manifest) {
    for (const zone of manifest.materialZones) {
      if (!zone.paintable) continue;
      paint[zone.id] = {
        colorHex: zone.defaultColorHex,
        metallic: zone.defaultFinish.metallic,
        roughness: Math.max(0.02, zone.defaultFinish.roughness),
        clearcoat: zone.defaultFinish.clearcoat,
      };
    }
  }
  const now = new Date().toISOString();
  return {
    id: newId('build'),
    schemaVersion: SCHEMA_VERSION,
    name,
    vehicleId: vehicle.id,
    installed: getPartsForVehicle(vehicle)
      .filter((p) => p.meshNodeIds.length > 0)
      .map((p) => ({
        partId: p.id,
        variantId: p.defaultVariantId,
        // Parts with variants but no default (e.g. stripe kit) start uninstalled.
        removed: p.variantIds.length > 0 && p.defaultVariantId === null,
        hidden: false,
      })),
    paint,
    glassTint: 0.35,
    wheels: {
      linked: true,
      front: structuredClone(STOCK_AXLE),
      rear: structuredClone(STOCK_AXLE),
    },
    stance: { ...STOCK_STANCE },
    annotations: [],
    fabricationRecords: {},
    cameraState: null,
    createdAt: now,
    updatedAt: now,
  };
}
