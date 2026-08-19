/** IndexedDB implementation of the storage interfaces (local-first MVP). */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import { buildSchema, type Build } from '@/lib/schemas';
import type {
  AssetRepository,
  BuildRepository,
  BuildSummary,
  ImportedAsset,
  Repositories,
  SavedColor,
  SettingsRepository,
  UserVehicleBundle,
  UserVehicleRepository,
} from './repositories';

interface VbcDB extends DBSchema {
  builds: { key: string; value: Build };
  assets: { key: string; value: ImportedAsset };
  meta: { key: string; value: string | SavedColor[] };
  userVehicles: { key: string; value: UserVehicleBundle };
}

const DB_NAME = 'vehicle-build-config';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<VbcDB>> | null = null;

function db(): Promise<IDBPDatabase<VbcDB>> {
  dbPromise ??= openDB<VbcDB>(DB_NAME, DB_VERSION, {
    upgrade(database) {
      // Guarded creates so the upgrade works from any prior version.
      if (!database.objectStoreNames.contains('builds')) {
        database.createObjectStore('builds', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('assets')) {
        database.createObjectStore('assets', { keyPath: 'id' });
      }
      if (!database.objectStoreNames.contains('meta')) {
        database.createObjectStore('meta');
      }
      if (!database.objectStoreNames.contains('userVehicles')) {
        database.createObjectStore('userVehicles', { keyPath: 'vehicle.id' });
      }
    },
  });
  return dbPromise;
}

class IdbBuildRepository implements BuildRepository {
  async list(): Promise<BuildSummary[]> {
    const all = await (await db()).getAll('builds');
    return all
      .map(({ id, name, vehicleId, updatedAt }) => ({ id, name, vehicleId, updatedAt }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async get(id: string): Promise<Build | null> {
    const raw = await (await db()).get('builds', id);
    if (!raw) return null;
    const parsed = buildSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }

  async save(build: Build): Promise<void> {
    await (await db()).put('builds', structuredClone(build));
  }

  async remove(id: string): Promise<void> {
    await (await db()).delete('builds', id);
  }

  async getCurrentBuildId(): Promise<string | null> {
    const v = await (await db()).get('meta', 'currentBuildId');
    return typeof v === 'string' ? v : null;
  }

  async setCurrentBuildId(id: string | null): Promise<void> {
    const d = await db();
    if (id === null) await d.delete('meta', 'currentBuildId');
    else await d.put('meta', id, 'currentBuildId');
  }
}

class IdbAssetRepository implements AssetRepository {
  async list(): Promise<Omit<ImportedAsset, 'blob'>[]> {
    const all = await (await db()).getAll('assets');
    return all
      .map(({ blob: _blob, ...rest }) => rest)
      .sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  }

  async get(id: string): Promise<ImportedAsset | null> {
    return (await (await db()).get('assets', id)) ?? null;
  }

  async add(asset: ImportedAsset): Promise<void> {
    await (await db()).put('assets', asset);
  }

  async remove(id: string): Promise<void> {
    await (await db()).delete('assets', id);
  }
}

class IdbSettingsRepository implements SettingsRepository {
  async getSavedColors(): Promise<SavedColor[]> {
    const v = await (await db()).get('meta', 'savedColors');
    return Array.isArray(v) ? v : [];
  }

  async addSavedColor(color: SavedColor): Promise<void> {
    const colors = (await this.getSavedColors()).filter((c) => c.hex !== color.hex);
    colors.unshift(color);
    await (await db()).put('meta', colors.slice(0, 24), 'savedColors');
  }

  async removeSavedColor(hex: string): Promise<void> {
    const colors = (await this.getSavedColors()).filter((c) => c.hex !== hex);
    await (await db()).put('meta', colors, 'savedColors');
  }
}

class IdbUserVehicleRepository implements UserVehicleRepository {
  async list(): Promise<UserVehicleBundle[]> {
    return (await (await db()).getAll('userVehicles')) ?? [];
  }

  async save(bundle: UserVehicleBundle): Promise<void> {
    await (await db()).put('userVehicles', structuredClone(bundle));
  }

  async remove(vehicleId: string): Promise<void> {
    await (await db()).delete('userVehicles', vehicleId);
  }
}

export const repositories: Repositories = {
  builds: new IdbBuildRepository(),
  assets: new IdbAssetRepository(),
  settings: new IdbSettingsRepository(),
  userVehicles: new IdbUserVehicleRepository(),
};
