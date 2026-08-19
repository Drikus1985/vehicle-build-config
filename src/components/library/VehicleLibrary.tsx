import { useMemo, useState } from 'react';
import {
  VEHICLES,
  getManifestForVehicle,
  isUserVehicle,
  removeUserVehicle,
  useUserCatalog,
} from '@/lib/catalog';
import type { Vehicle } from '@/lib/schemas';
import { useBuildStore } from '@/state/buildStore';
import { useUiStore } from '@/state/uiStore';

const ALL = 'all';

function VehicleCard({ vehicle, onSelect }: { vehicle: Vehicle; onSelect: (v: Vehicle) => void }) {
  const [expanded, setExpanded] = useState(false);
  const currentVehicleId = useBuildStore((s) => s.build?.vehicleId);
  const hasAsset = vehicle.assetManifestId !== null;
  const manifest = getManifestForVehicle(vehicle.id);
  const isCurrent = currentVehicleId === vehicle.id;

  return (
    <li className={`panel shrink-0 overflow-hidden ${isCurrent ? 'border-accent-500/70' : ''}`}>
      <button
        className="flex w-full items-start justify-between gap-2 p-2.5 text-left hover:bg-graphite-850"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold text-ivory-100">
            {vehicle.year} {vehicle.make} {vehicle.model}
          </p>
          <p className="truncate text-[11px] text-graphite-400">
            {vehicle.trim ? `${vehicle.trim} · ` : ''}
            {vehicle.bodyStyle} · {vehicle.vehicleType}
          </p>
        </div>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`chip ${hasAsset ? 'border-ok-500/50 text-ok-500' : 'border-graphite-600 text-graphite-400'}`}
          >
            {hasAsset ? '3D ready' : 'No asset'}
          </span>
          {isUserVehicle(vehicle.id) && <span className="chip">yours</span>}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-graphite-700/60 p-2.5 text-[11px] leading-relaxed text-graphite-300">
          {vehicle.description && <p className="mb-1.5 text-ivory-400">{vehicle.description}</p>}
          {vehicle.dimensionsMm && (
            <p className="text-graphite-400">
              L {vehicle.dimensionsMm.length} · W {vehicle.dimensionsMm.width} · H{' '}
              {vehicle.dimensionsMm.height} · WB {vehicle.dimensionsMm.wheelbase} mm
            </p>
          )}
          {manifest ? (
            <>
              <p className="mt-1.5 text-graphite-400">
                Editable components:{' '}
                <span className="text-ivory-400">
                  {new Set(manifest.meshNodes.map((n) => n.componentId).values()).size - 1}+ mapped
                  mesh groups
                </span>
              </p>
              <p className="mt-1 text-graphite-400">
                Features:{' '}
                {Object.entries(manifest.supportedFeatures)
                  .filter(([, v]) => v)
                  .map(([k]) => k)
                  .join(', ')}
              </p>
              <p className="mt-1 text-graphite-400">
                Source: {manifest.attribution.sourceName} ({manifest.attribution.licence})
              </p>
            </>
          ) : (
            <p className="mt-1.5 text-warn-500">
              Metadata only — interactive 3D and component editing require a mapped asset manifest.
            </p>
          )}
          {vehicle.knownLimitations.length > 0 && (
            <ul className="mt-1.5 list-disc pl-4 text-graphite-400">
              {vehicle.knownLimitations.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
          )}
          <button
            className={`mt-2 w-full ${hasAsset ? 'btn-accent' : 'btn'}`}
            disabled={isCurrent}
            onClick={() => onSelect(vehicle)}
          >
            {isCurrent
              ? 'Currently open'
              : hasAsset
                ? 'Start / switch build'
                : 'Open metadata (no 3D)'}
          </button>
          {isUserVehicle(vehicle.id) && (
            <button
              className="btn-ghost mt-1 w-full text-danger-500"
              disabled={isCurrent}
              title={isCurrent ? 'Close this build before removing the vehicle' : undefined}
              onClick={() => {
                if (
                  window.confirm(
                    `Remove "${vehicle.year} ${vehicle.make} ${vehicle.model}" from the library? Saved builds for it will no longer open. The imported asset itself stays in the import library.`,
                  )
                ) {
                  void removeUserVehicle(vehicle.id);
                }
              }}
            >
              Remove user vehicle
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export function VehicleLibrary() {
  const [query, setQuery] = useState('');
  const [make, setMake] = useState(ALL);
  const [bodyStyle, setBodyStyle] = useState(ALL);
  const [vehicleType, setVehicleType] = useState(ALL);
  const [decade, setDecade] = useState(ALL);
  const [assetOnly, setAssetOnly] = useState(false);

  const build = useBuildStore((s) => s.build);
  const newBuildForVehicle = useBuildStore((s) => s.newBuildForVehicle);
  const openDialog = useUiStore((s) => s.openDialog);
  const toast = useUiStore((s) => s.toast);

  // Seed catalogue plus user-authored vehicles (reactive to additions/removals).
  const userBundles = useUserCatalog((s) => s.bundles);
  const vehicles = useMemo(
    () => [...VEHICLES, ...userBundles.map((b) => b.vehicle)],
    [userBundles],
  );

  const makes = useMemo(() => [...new Set(vehicles.map((v) => v.make))].sort(), [vehicles]);
  const bodyStyles = useMemo(
    () => [...new Set(vehicles.map((v) => v.bodyStyle))].sort(),
    [vehicles],
  );
  const types = useMemo(() => [...new Set(vehicles.map((v) => v.vehicleType))].sort(), [vehicles]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return vehicles
      .filter((v) => {
        if (assetOnly && v.assetManifestId === null) return false;
        if (make !== ALL && v.make !== make) return false;
        if (bodyStyle !== ALL && v.bodyStyle !== bodyStyle) return false;
        if (vehicleType !== ALL && v.vehicleType !== vehicleType) return false;
        if (decade !== ALL) {
          const d = Number(decade);
          if (v.year < d || v.year >= d + 10) return false;
        }
        if (q) {
          const hay =
            `${v.year} ${v.make} ${v.model} ${v.trim ?? ''} ${v.tags.join(' ')}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.year - b.year);
  }, [vehicles, query, make, bodyStyle, vehicleType, decade, assetOnly]);

  const selectVehicle = (vehicle: Vehicle) => {
    if (build && build.vehicleId !== vehicle.id) {
      // Changing base vehicle: route through the incompatibility warning dialog.
      openDialog({ kind: 'vehicle-change', targetVehicleId: vehicle.id });
      return;
    }
    newBuildForVehicle(vehicle);
    toast('success', `Started a build for the ${vehicle.year} ${vehicle.make} ${vehicle.model}.`);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-graphite-700/60 p-3">
        <h2 className="mb-2 text-[11px] font-semibold tracking-[0.15em] text-graphite-400 uppercase">
          Vehicle library
        </h2>
        <input
          className="input-base"
          type="search"
          placeholder="Search year, make, model…"
          aria-label="Search vehicles"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          <select
            className="input-base"
            aria-label="Filter by decade"
            value={decade}
            onChange={(e) => setDecade(e.target.value)}
          >
            <option value={ALL}>Any year</option>
            <option value="1948">1948–1957</option>
            <option value="1958">1958–1967</option>
            <option value="1968">1968–1978</option>
          </select>
          <select
            className="input-base"
            aria-label="Filter by make"
            value={make}
            onChange={(e) => setMake(e.target.value)}
          >
            <option value={ALL}>Any make</option>
            {makes.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
          <select
            className="input-base"
            aria-label="Filter by body style"
            value={bodyStyle}
            onChange={(e) => setBodyStyle(e.target.value)}
          >
            <option value={ALL}>Any body</option>
            {bodyStyles.map((b) => (
              <option key={b}>{b}</option>
            ))}
          </select>
          <select
            className="input-base"
            aria-label="Filter by vehicle type"
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
          >
            <option value={ALL}>Any type</option>
            {types.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <label className="mt-2 flex items-center gap-2 text-[11px] text-graphite-300">
          <input
            type="checkbox"
            checked={assetOnly}
            onChange={(e) => setAssetOnly(e.target.checked)}
          />
          3D-ready only
        </label>
      </div>
      <ul className="flex flex-1 flex-col gap-2 overflow-y-auto p-3" aria-label="Vehicles">
        {filtered.length === 0 && (
          <li className="p-4 text-center text-xs text-graphite-400">
            No vehicles match these filters. The catalogue is representative, not complete.
          </li>
        )}
        {filtered.map((v) => (
          <VehicleCard key={v.id} vehicle={v} onSelect={selectVehicle} />
        ))}
      </ul>
      <p className="border-t border-graphite-700/60 p-2.5 text-[10px] leading-relaxed text-graphite-400">
        Catalogue names are factual metadata. Only rights-safe assets are bundled; the TF-100 demo
        is an original design (CC0).
      </p>
    </div>
  );
}
