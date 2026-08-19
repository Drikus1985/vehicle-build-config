import type { AssetManifest, Build, Part, PartVariant, Vehicle } from '@/lib/schemas';
import { TF100_MANIFEST } from './tf100-manifest';
import { TF100_PARTS, TF100_VARIANTS } from './tf100-parts';
import { NOVA_MANIFEST } from './nova-manifest';
import { NOVA_PARTS, NOVA_VARIANTS } from './nova-parts';
import { VEHICLES } from './vehicles';

export { VEHICLES } from './vehicles';
export { TF100_MANIFEST } from './tf100-manifest';
export { TF100_PARTS, TF100_VARIANTS } from './tf100-parts';
export { NOVA_MANIFEST } from './nova-manifest';
export { NOVA_PARTS, NOVA_VARIANTS } from './nova-parts';
export { FACTORY_PALETTES, ALL_PALETTE_COLORS } from './palettes';
export {
  loadUserCatalog,
  saveUserVehicle,
  removeUserVehicle,
  isUserVehicle,
  useUserCatalog,
} from './userCatalog';
import { getUserBundles } from './userCatalog';

const MANIFESTS: Record<string, AssetManifest> = {
  [TF100_MANIFEST.id]: TF100_MANIFEST,
  [NOVA_MANIFEST.id]: NOVA_MANIFEST,
};

const PARTS: Part[] = [...TF100_PARTS, ...NOVA_PARTS];
const VARIANTS: PartVariant[] = [...TF100_VARIANTS, ...NOVA_VARIANTS];

/** Seed catalogue + any user-authored vehicles (see userCatalog.ts). */
export function getAllVehicles(): Vehicle[] {
  return [...VEHICLES, ...getUserBundles().map((b) => b.vehicle)];
}

export function getVehicle(id: string): Vehicle | undefined {
  return (
    VEHICLES.find((v) => v.id === id) ?? getUserBundles().find((b) => b.vehicle.id === id)?.vehicle
  );
}

export function getManifest(id: string | null | undefined): AssetManifest | undefined {
  if (!id) return undefined;
  return MANIFESTS[id] ?? getUserBundles().find((b) => b.manifest.id === id)?.manifest;
}

export function getManifestForVehicle(vehicleId: string): AssetManifest | undefined {
  return getManifest(getVehicle(vehicleId)?.assetManifestId);
}

export function getPart(id: string): Part | undefined {
  return (
    PARTS.find((p) => p.id === id) ??
    getUserBundles()
      .flatMap((b) => b.parts)
      .find((p) => p.id === id)
  );
}

export function getVariant(id: string): PartVariant | undefined {
  return VARIANTS.find((v) => v.id === id);
}

export function getVariantsForPart(partId: string): PartVariant[] {
  return VARIANTS.filter((v) => v.partId === partId);
}

/** All parts applicable to a vehicle (by explicit id, type/style or open compatibility). */
export function getPartsForVehicle(vehicle: Vehicle): Part[] {
  const pool = [...PARTS, ...getUserBundles().flatMap((b) => b.parts)];
  return pool.filter((p) => {
    const c = p.compatibility;
    if (c.vehicleIds && !c.vehicleIds.includes(vehicle.id)) return false;
    if (c.vehicleTypes && !c.vehicleTypes.includes(vehicle.vehicleType)) return false;
    if (c.bodyStyles && !c.bodyStyles.includes(vehicle.bodyStyle)) return false;
    if (c.yearRange && (vehicle.year < c.yearRange[0] || vehicle.year > c.yearRange[1]))
      return false;
    return true;
  });
}

export function getWheelVariants(): PartVariant[] {
  return getVariantsForPart('part-wheel');
}

/** Find which part owns a mesh node, via the manifest mapping. */
export function getComponentIdForNode(manifest: AssetManifest, nodeName: string): string | null {
  return manifest.meshNodes.find((n) => n.nodeName === nodeName)?.componentId ?? null;
}

/**
 * True when the build has an installed factory (in-model) wheel set — a wheel
 * part with real mesh nodes, like the Nova's. While active, the parametric
 * wheel/stance system is suspended so the two never render on top of each
 * other.
 */
export function hasActiveOemWheelset(build: Build): boolean {
  return build.installed.some((entry) => {
    if (entry.removed) return false;
    const part = getPart(entry.partId);
    return part?.category === 'wheel' && part.meshNodeIds.length > 0;
  });
}

/** The OEM wheelset part for a vehicle, if its asset provides one. */
export function getOemWheelsetPart(vehicle: Vehicle): Part | undefined {
  return getPartsForVehicle(vehicle).find(
    (p) => p.category === 'wheel' && p.meshNodeIds.length > 0,
  );
}
