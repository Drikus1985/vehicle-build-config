/**
 * User-authored vehicles: imported GLB assets mapped into full catalogue
 * entries (vehicle + generated manifest + per-node parts) via the in-app
 * authoring flow. Bundles persist in IndexedDB and are merged into every
 * catalogue lookup after `loadUserCatalog()` runs at boot.
 */
import { create } from 'zustand';
import { z } from 'zod';
import { assetManifestSchema, partSchema, vehicleSchema } from '@/lib/schemas';
import { repositories } from '@/lib/persistence/idb';
import type { UserVehicleBundle } from '@/lib/persistence/repositories';

export const userVehicleBundleSchema = z.object({
  vehicle: vehicleSchema,
  manifest: assetManifestSchema,
  parts: z.array(partSchema),
});

interface UserCatalogState {
  bundles: UserVehicleBundle[];
  loaded: boolean;
}

export const useUserCatalog = create<UserCatalogState>(() => ({
  bundles: [],
  loaded: false,
}));

/** Load persisted user vehicles (invalid entries are skipped, not fatal). */
export async function loadUserCatalog(): Promise<void> {
  try {
    const raw = await repositories.userVehicles.list();
    const bundles = raw
      .map((b) => userVehicleBundleSchema.safeParse(b))
      .filter((r) => r.success)
      .map((r) => r.data as UserVehicleBundle);
    useUserCatalog.setState({ bundles, loaded: true });
  } catch {
    useUserCatalog.setState({ bundles: [], loaded: true });
  }
}

/** Validate, persist and register a new user vehicle. */
export async function saveUserVehicle(bundle: UserVehicleBundle): Promise<void> {
  const parsed = userVehicleBundleSchema.parse(bundle) as UserVehicleBundle;
  await repositories.userVehicles.save(parsed);
  useUserCatalog.setState((s) => ({
    bundles: [...s.bundles.filter((b) => b.vehicle.id !== parsed.vehicle.id), parsed],
  }));
}

export async function removeUserVehicle(vehicleId: string): Promise<void> {
  await repositories.userVehicles.remove(vehicleId);
  useUserCatalog.setState((s) => ({
    bundles: s.bundles.filter((b) => b.vehicle.id !== vehicleId),
  }));
}

export function getUserBundles(): UserVehicleBundle[] {
  return useUserCatalog.getState().bundles;
}

export function isUserVehicle(vehicleId: string): boolean {
  return getUserBundles().some((b) => b.vehicle.id === vehicleId);
}
