/**
 * Storage abstraction. The app talks only to these interfaces; the MVP binds
 * them to IndexedDB (`idb.ts`). A production backend (auth + database + object
 * storage) can implement the same interfaces without UI changes.
 */
import type { Build } from '@/lib/schemas';

export interface BuildSummary {
  id: string;
  name: string;
  vehicleId: string;
  updatedAt: string;
}

export interface BuildRepository {
  list(): Promise<BuildSummary[]>;
  get(id: string): Promise<Build | null>;
  save(build: Build): Promise<void>;
  remove(id: string): Promise<void>;
  getCurrentBuildId(): Promise<string | null>;
  setCurrentBuildId(id: string | null): Promise<void>;
}

export interface ImportedAsset {
  id: string;
  name: string;
  kind: 'image' | 'gltf' | 'stl';
  /** Optional role: 'wheel' makes a 3D asset selectable in Wheels & Tyres. */
  role?: 'wheel';
  mime: string;
  sizeBytes: number;
  blob: Blob;
  attribution: {
    sourceName: string;
    sourceUrl?: string;
    creator?: string;
    licence: string;
    attributionText: string;
    reuseConfirmed: boolean;
  };
  addedAt: string;
}

export interface AssetRepository {
  list(): Promise<Omit<ImportedAsset, 'blob'>[]>;
  get(id: string): Promise<ImportedAsset | null>;
  add(asset: ImportedAsset): Promise<void>;
  remove(id: string): Promise<void>;
}

/** A user-authored vehicle: metadata + generated manifest + per-node parts. */
export interface UserVehicleBundle {
  vehicle: import('@/lib/schemas').Vehicle;
  manifest: import('@/lib/schemas').AssetManifest;
  parts: import('@/lib/schemas').Part[];
}

export interface UserVehicleRepository {
  list(): Promise<UserVehicleBundle[]>;
  save(bundle: UserVehicleBundle): Promise<void>;
  remove(vehicleId: string): Promise<void>;
}

export interface SavedColor {
  hex: string;
  name: string;
  savedAt: string;
}

export interface SettingsRepository {
  getSavedColors(): Promise<SavedColor[]>;
  addSavedColor(color: SavedColor): Promise<void>;
  removeSavedColor(hex: string): Promise<void>;
}

export interface Repositories {
  builds: BuildRepository;
  assets: AssetRepository;
  settings: SettingsRepository;
  userVehicles: UserVehicleRepository;
}
