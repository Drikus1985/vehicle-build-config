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

let volatileStorage = false;

/** True when IndexedDB was unavailable and the session runs on volatile,
 *  in-memory storage (sandboxed embeds, some private-browsing modes). */
export function isStorageVolatile(): boolean {
  return volatileStorage;
}

const KEY_PATHS: Record<string, string> = {
  builds: 'id',
  assets: 'id',
  userVehicles: 'vehicle.id',
};

/**
 * Minimal in-memory stand-in for the four IDB operations the repositories
 * use, so the app still works (without persistence) where IndexedDB is
 * blocked. The volatile flag lets the UI say so honestly.
 */
function createMemoryDB(): IDBPDatabase<VbcDB> {
  const stores = new Map<string, Map<unknown, unknown>>();
  const store = (name: string) => {
    if (!stores.has(name)) stores.set(name, new Map());
    return stores.get(name)!;
  };
  const keyOf = (name: string, value: unknown, key?: unknown): unknown => {
    if (key !== undefined) return key;
    const path = KEY_PATHS[name];
    let v: unknown = value;
    for (const part of path?.split('.') ?? []) v = (v as Record<string, unknown>)[part];
    return v;
  };
  const memory = {
    get: (name: string, key: unknown) => Promise.resolve(store(name).get(key)),
    getAll: (name: string) => Promise.resolve([...store(name).values()]),
    put: (name: string, value: unknown, key?: unknown) => {
      store(name).set(keyOf(name, value, key), value);
      return Promise.resolve(keyOf(name, value, key));
    },
    delete: (name: string, key: unknown) => {
      store(name).delete(key);
      return Promise.resolve();
    },
  };
  return memory as unknown as IDBPDatabase<VbcDB>;
}

let dbPromise: Promise<IDBPDatabase<VbcDB>> | null = null;

function db(): Promise<IDBPDatabase<VbcDB>> {
  dbPromise ??= (
    typeof indexedDB === 'undefined'
      ? Promise.reject(new Error('IndexedDB unavailable'))
      : openDB<VbcDB>(DB_NAME, DB_VERSION, {
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
        })
  ).catch(() => {
    volatileStorage = true;
    console.warn('IndexedDB unavailable — falling back to in-memory storage for this session.');
    return createMemoryDB();
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
