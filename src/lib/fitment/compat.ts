import { getPart, getPartsForVehicle, getVariant } from '@/lib/catalog';
import type { Build, Compatibility, Vehicle } from '@/lib/schemas';

export interface CompatIssue {
  partId: string;
  variantId: string | null;
  reason: string;
}

function compatibilityAllows(c: Compatibility | undefined, vehicle: Vehicle): string | null {
  if (!c) return null;
  if (c.vehicleIds && !c.vehicleIds.includes(vehicle.id)) {
    return `Not listed for ${vehicle.year} ${vehicle.make} ${vehicle.model}.`;
  }
  if (c.vehicleTypes && !c.vehicleTypes.includes(vehicle.vehicleType)) {
    return `Only fits vehicle types: ${c.vehicleTypes.join(', ')}.`;
  }
  if (c.bodyStyles && !c.bodyStyles.includes(vehicle.bodyStyle)) {
    return `Only fits body styles: ${c.bodyStyles.join(', ')}.`;
  }
  if (c.yearRange && (vehicle.year < c.yearRange[0] || vehicle.year > c.yearRange[1])) {
    return `Only fits model years ${c.yearRange[0]}–${c.yearRange[1]}.`;
  }
  return null;
}

/** Check a single part+variant against a vehicle. Returns null when compatible. */
export function checkPartCompatibility(
  partId: string,
  variantId: string | null,
  vehicle: Vehicle,
): CompatIssue | null {
  const part = getPart(partId);
  if (!part) return { partId, variantId, reason: 'Unknown part.' };
  const partIssue = compatibilityAllows(part.compatibility, vehicle);
  if (partIssue) return { partId, variantId, reason: partIssue };
  if (variantId) {
    const variant = getVariant(variantId);
    if (!variant) return { partId, variantId, reason: 'Unknown variant.' };
    const variantIssue = compatibilityAllows(variant.compatibility, vehicle);
    if (variantIssue) return { partId, variantId, reason: variantIssue };
    // Socket check: the target vehicle must expose the socket the part mounts to.
    if (part.socketId) {
      const targetSockets = new Set(
        getPartsForVehicle(vehicle)
          .map((p) => p.socketId)
          .filter(Boolean),
      );
      if (!targetSockets.has(part.socketId)) {
        return {
          partId,
          variantId,
          reason: `No ${part.socketId} attachment point on this vehicle.`,
        };
      }
    }
  }
  return null;
}

/**
 * Analyse what would break if `build` were moved onto `target`.
 * Used by the base-vehicle-change warning dialog.
 */
export function analyzeVehicleChange(build: Build, target: Vehicle): CompatIssue[] {
  const issues: CompatIssue[] = [];
  for (const installed of build.installed) {
    if (installed.removed) continue;
    const issue = checkPartCompatibility(installed.partId, installed.variantId, target);
    if (issue) issues.push(issue);
  }
  return issues;
}
