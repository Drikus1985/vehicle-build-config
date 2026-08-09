import { create } from 'zustand';
import type { Build, Vehicle } from '@/lib/schemas';
import { createDefaultBuild } from '@/lib/build/defaults';

const HISTORY_LIMIT = 100;

export interface BuildStoreState {
  build: Build | null;
  /** Factory-stock reference build for the same vehicle (compare / reset). */
  stockBuild: Build | null;
  past: Build[];
  future: Build[];
  /** Monotonic counter bumped on any persistable change (autosave trigger). */
  dirtyCounter: number;

  newBuildForVehicle: (vehicle: Vehicle, name?: string) => Build;
  /**
   * Apply a change to the current build. `history: false` (e.g. camera moves)
   * updates state without creating an undo step.
   */
  update: (mutator: (draft: Build) => void, opts?: { history?: boolean }) => void;
  undo: () => void;
  redo: () => void;
  resetToStock: () => void;
  clear: () => void;
}

export const useBuildStore = create<BuildStoreState>((set, get) => ({
  build: null,
  stockBuild: null,
  past: [],
  future: [],
  dirtyCounter: 0,

  newBuildForVehicle: (vehicle, name) => {
    const build = createDefaultBuild(vehicle, name ?? `${vehicle.year} ${vehicle.model} build`);
    const stock = structuredClone(build);
    set({ build, stockBuild: stock, past: [], future: [], dirtyCounter: get().dirtyCounter + 1 });
    return build;
  },

  update: (mutator, opts) => {
    const { build, past, dirtyCounter } = get();
    if (!build) return;
    const draft = structuredClone(build);
    mutator(draft);
    draft.updatedAt = new Date().toISOString();
    if (opts?.history === false) {
      set({ build: draft, dirtyCounter: dirtyCounter + 1 });
    } else {
      set({
        build: draft,
        past: [...past.slice(-HISTORY_LIMIT + 1), build],
        future: [],
        dirtyCounter: dirtyCounter + 1,
      });
    }
  },

  undo: () => {
    const { build, past, future, dirtyCounter } = get();
    if (!build || past.length === 0) return;
    const previous = past[past.length - 1]!;
    set({
      build: previous,
      past: past.slice(0, -1),
      future: [build, ...future].slice(0, HISTORY_LIMIT),
      dirtyCounter: dirtyCounter + 1,
    });
  },

  redo: () => {
    const { build, past, future, dirtyCounter } = get();
    if (!build || future.length === 0) return;
    const next = future[0]!;
    set({
      build: next,
      past: [...past.slice(-HISTORY_LIMIT + 1), build],
      future: future.slice(1),
      dirtyCounter: dirtyCounter + 1,
    });
  },

  resetToStock: () => {
    const { build, stockBuild, past, dirtyCounter } = get();
    if (!build || !stockBuild) return;
    const reset = structuredClone(stockBuild);
    // Keep identity and timestamps of the working build.
    reset.id = build.id;
    reset.name = build.name;
    reset.createdAt = build.createdAt;
    reset.updatedAt = new Date().toISOString();
    set({
      build: reset,
      past: [...past.slice(-HISTORY_LIMIT + 1), build],
      future: [],
      dirtyCounter: dirtyCounter + 1,
    });
  },

  clear: () => set({ build: null, stockBuild: null, past: [], future: [] }),
}));

/**
 * Restore a persisted build (e.g. after refresh) along with a regenerated
 * stock reference for its vehicle.
 */
export function restoreBuild(build: Build, vehicle: Vehicle): void {
  const stock = createDefaultBuild(vehicle, build.name);
  useBuildStore.setState({
    build,
    stockBuild: stock,
    past: [],
    future: [],
    dirtyCounter: useBuildStore.getState().dirtyCounter + 1,
  });
}
