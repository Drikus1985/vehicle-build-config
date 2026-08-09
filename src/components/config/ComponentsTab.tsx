import { useMemo, useState } from 'react';
import { getPartsForVehicle, getVariantsForPart, getVehicle } from '@/lib/catalog';
import type { Part, PartCategory } from '@/lib/schemas';
import {
  restoreAllParts,
  setPartHidden,
  setPartRemoved,
  setPartVariant,
} from '@/state/buildActions';
import { useBuildStore } from '@/state/buildStore';
import { useUiStore } from '@/state/uiStore';

const CATEGORY_LABELS: Partial<Record<PartCategory, string>> = {
  'body-panel': 'Body panels',
  hood: 'Hood',
  roof: 'Roof',
  door: 'Doors',
  fender: 'Fenders',
  'quarter-panel': 'Quarter panels',
  bumper: 'Bumpers',
  grille: 'Grille',
  lights: 'Lights',
  mirror: 'Mirrors',
  glass: 'Glass',
  trim: 'Trim',
  aero: 'Aero',
  chassis: 'Chassis',
  suspension: 'Suspension',
  brakes: 'Brakes',
  exhaust: 'Exhaust',
  wheel: 'Wheels',
  tyre: 'Tyres',
  interior: 'Interior',
  'engine-bay': 'Engine bay',
  cab: 'Truck cab',
  bed: 'Bed',
  tailgate: 'Tailgate',
  accessory: 'Accessories',
};

function PartRow({ part }: { part: Part }) {
  const build = useBuildStore((s) => s.build);
  const select = useUiStore((s) => s.select);
  const selected = useUiStore((s) => s.selectedComponentId === part.id);
  const isolatedComponentId = useUiStore((s) => s.isolatedComponentId);
  const isolate = useUiStore((s) => s.isolate);

  const installed = build?.installed.find((p) => p.partId === part.id);
  const removed = installed?.removed ?? true;
  const hidden = installed?.hidden ?? false;
  const variants = getVariantsForPart(part.id);
  const isolatedHere = isolatedComponentId === part.id;

  return (
    <li
      className={`rounded-md border px-2 py-1.5 ${
        selected
          ? 'border-accent-500/70 bg-accent-500/5'
          : 'border-transparent hover:bg-graphite-850'
      }`}
    >
      <div className="flex items-center gap-1.5">
        <button
          className={`min-w-0 flex-1 truncate text-left text-xs ${removed ? 'text-graphite-400 line-through' : 'text-ivory-100'}`}
          title={`Select ${part.name}`}
          onClick={() => select(selected ? null : part.id)}
        >
          {part.name}
        </button>
        {!removed && (
          <>
            <button
              className={`btn-ghost !p-1 text-[10px] ${isolatedHere ? 'btn-on' : ''}`}
              aria-pressed={isolatedHere}
              title={isolatedHere ? 'Exit isolation' : 'Isolate this part'}
              onClick={() => isolate(isolatedHere ? null : part.id)}
            >
              ◎
            </button>
            <button
              className={`btn-ghost !p-1 text-[10px] ${hidden ? 'btn-on' : ''}`}
              aria-pressed={hidden}
              title={hidden ? 'Show part' : 'Hide part'}
              onClick={() => setPartHidden(part.id, !hidden)}
            >
              {hidden ? '◌' : '👁'}
            </button>
          </>
        )}
        {part.removable ? (
          <button
            className="btn-ghost !p-1 text-[10px]"
            title={removed ? 'Install / restore part' : 'Remove part'}
            onClick={() => setPartRemoved(part.id, !removed)}
          >
            {removed ? '＋' : '－'}
          </button>
        ) : (
          <span
            className="text-[9px] text-graphite-600"
            title="Structural part — cannot be removed"
          >
            fixed
          </span>
        )}
      </div>
      {!removed && variants.length > 0 && (
        <select
          className="input-base mt-1 !py-1"
          aria-label={`${part.name} variant`}
          value={installed?.variantId ?? ''}
          onChange={(e) => setPartVariant(part.id, e.target.value)}
        >
          {variants.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
              {v.priceEstimateUsd ? ` (~$${v.priceEstimateUsd})` : ''}
            </option>
          ))}
        </select>
      )}
    </li>
  );
}

export function ComponentsTab() {
  const build = useBuildStore((s) => s.build);
  const [query, setQuery] = useState('');
  const vehicle = build ? getVehicle(build.vehicleId) : undefined;

  const groups = useMemo(() => {
    if (!vehicle) return [];
    const q = query.trim().toLowerCase();
    const parts = getPartsForVehicle(vehicle)
      .filter((p) => p.meshNodeIds.length > 0)
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.category.includes(q));
    const byCategory = new Map<PartCategory, Part[]>();
    for (const p of parts) {
      const list = byCategory.get(p.category) ?? [];
      list.push(p);
      byCategory.set(p.category, list);
    }
    return [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [vehicle, query]);

  if (!build || !vehicle) return null;
  if (vehicle.assetManifestId === null) {
    return (
      <p className="text-xs text-graphite-400">
        Component editing needs a 3D asset with separately named meshes and compatibility metadata.
        This vehicle is metadata-only.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        className="input-base"
        type="search"
        placeholder="Search components…"
        aria-label="Search components"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <p className="text-[10px] text-graphite-400">
        Select to inspect · ◎ isolate · 👁 hide · － remove. Variants come from catalogue data, not
        hard-coded UI.
      </p>
      {groups.map(([category, parts]) => (
        <section key={category}>
          <h3 className="field-label">{CATEGORY_LABELS[category] ?? category}</h3>
          <ul className="flex flex-col gap-0.5">
            {parts.map((p) => (
              <PartRow key={p.id} part={p} />
            ))}
          </ul>
        </section>
      ))}
      <button className="btn" onClick={restoreAllParts}>
        Restore all hidden/removed parts
      </button>
    </div>
  );
}
