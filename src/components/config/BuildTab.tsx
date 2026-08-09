import { useEffect, useRef, useState } from 'react';
import { getVehicle } from '@/lib/catalog';
import { parseBuildFile } from '@/lib/export/buildFile';
import { repositories } from '@/lib/persistence/idb';
import type { BuildSummary } from '@/lib/persistence/repositories';
import { newId } from '@/lib/build/defaults';
import { restoreBuild, useBuildStore } from '@/state/buildStore';
import { useUiStore } from '@/state/uiStore';

export function BuildTab() {
  const build = useBuildStore((s) => s.build);
  const dirtyCounter = useBuildStore((s) => s.dirtyCounter);
  const toast = useUiStore((s) => s.toast);
  const [savedBuilds, setSavedBuilds] = useState<BuildSummary[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void repositories.builds
      .list()
      .then(setSavedBuilds)
      .catch(() => setSavedBuilds([]));
  }, [dirtyCounter]);

  const vehicle = build ? getVehicle(build.vehicleId) : undefined;

  const openBuild = async (id: string) => {
    const saved = await repositories.builds.get(id);
    const v = saved ? getVehicle(saved.vehicleId) : undefined;
    if (!saved || !v) {
      toast('error', 'Could not open that build — it may reference a removed vehicle.');
      return;
    }
    restoreBuild(saved, v);
    await repositories.builds.setCurrentBuildId(saved.id);
    toast('success', `Opened "${saved.name}".`);
  };

  const duplicateBuild = async () => {
    if (!build) return;
    const copy = structuredClone(build);
    copy.id = newId('build');
    copy.name = `${build.name} (variant)`;
    copy.createdAt = new Date().toISOString();
    copy.updatedAt = copy.createdAt;
    await repositories.builds.save(copy);
    const v = getVehicle(copy.vehicleId);
    if (v) restoreBuild(copy, v);
    toast('success', 'Duplicated — you are now editing the new variant.');
  };

  const deleteBuild = async (id: string) => {
    await repositories.builds.remove(id);
    if (build?.id === id) {
      useBuildStore.getState().clear();
      await repositories.builds.setCurrentBuildId(null);
    }
    setSavedBuilds(await repositories.builds.list());
    toast('info', 'Build deleted.');
  };

  const importBuildFile = async (file: File) => {
    const result = parseBuildFile(await file.text());
    if (!result.ok) {
      toast('error', `Import failed: ${result.reason}`);
      return;
    }
    const v = getVehicle(result.build.vehicleId);
    if (!v) return;
    // Imported file may collide with an existing id — keep both.
    const incoming = structuredClone(result.build);
    const exists = await repositories.builds.get(incoming.id);
    if (exists) incoming.id = newId('build');
    await repositories.builds.save(incoming);
    restoreBuild(incoming, v);
    toast('success', `Imported build "${incoming.name}".`);
  };

  return (
    <div className="flex flex-col gap-4">
      {build && vehicle ? (
        <section className="panel p-3">
          <h3 className="field-label">Current vehicle</h3>
          <p className="text-sm font-semibold text-ivory-100">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </p>
          <p className="text-[11px] text-graphite-400">
            {vehicle.trim ? `${vehicle.trim} · ` : ''}
            {vehicle.bodyStyle}
            {vehicle.cabStyle ? ` · ${vehicle.cabStyle} cab` : ''}
            {vehicle.bedStyle && vehicle.bedStyle !== 'none' ? ` · ${vehicle.bedStyle} bed` : ''}
          </p>
          {vehicle.attribution && (
            <p className="mt-1.5 text-[10px] text-graphite-400">
              Asset: {vehicle.attribution.attributionText}
            </p>
          )}
          {vehicle.knownLimitations.length > 0 && (
            <details className="mt-1.5 text-[11px] text-graphite-400">
              <summary className="cursor-pointer">Known limitations</summary>
              <ul className="mt-1 list-disc pl-4">
                {vehicle.knownLimitations.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </details>
          )}
          <button className="btn mt-2 w-full" onClick={() => void duplicateBuild()}>
            Duplicate as new variant
          </button>
        </section>
      ) : (
        <p className="text-xs text-graphite-400">
          No build open. Choose a vehicle from the library — entries marked “3D ready” support the
          full configurator.
        </p>
      )}

      <section>
        <h3 className="field-label">Saved builds</h3>
        {savedBuilds.length === 0 ? (
          <p className="text-[11px] text-graphite-400">
            Nothing saved yet. Builds autosave to this browser (IndexedDB) as you work.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {savedBuilds.map((b) => {
              const v = getVehicle(b.vehicleId);
              return (
                <li
                  key={b.id}
                  className={`panel flex items-center gap-2 p-2 ${b.id === build?.id ? 'border-accent-500/70' : ''}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs text-ivory-100">{b.name}</p>
                    <p className="truncate text-[10px] text-graphite-400">
                      {v ? `${v.year} ${v.make} ${v.model}` : b.vehicleId} ·{' '}
                      {new Date(b.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  {b.id !== build?.id && (
                    <button className="btn !py-1" onClick={() => void openBuild(b.id)}>
                      Open
                    </button>
                  )}
                  <button
                    className="btn-ghost !py-1 text-danger-500"
                    aria-label={`Delete build ${b.name}`}
                    onClick={() => {
                      if (window.confirm(`Delete build "${b.name}"? This cannot be undone.`)) {
                        void deleteBuild(b.id);
                      }
                    }}
                  >
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <h3 className="field-label">Build files</h3>
        <p className="mb-1.5 text-[11px] text-graphite-400">
          Move builds between browsers/machines with versioned JSON files (see Export menu for
          export).
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importBuildFile(f);
            e.target.value = '';
          }}
        />
        <button className="btn w-full" onClick={() => fileRef.current?.click()}>
          Import build file (.json)
        </button>
      </section>
    </div>
  );
}
