import { useMemo } from 'react';
import { getManifestForVehicle, getPart, getVehicle } from '@/lib/catalog';
import type { FabricationRecord, FabricationStatus } from '@/lib/schemas';
import { FABRICATION_STATUSES, statusMeta, titanforgeAdapter } from '@/lib/titanforge';
import {
  removeAnnotation,
  removeFabricationRecord,
  setFabricationStatus,
  updateAnnotationText,
  upsertFabricationRecord,
} from '@/state/buildActions';
import { useBuildStore } from '@/state/buildStore';
import { useUiStore, type FabFilter } from '@/state/uiStore';

function RecordEditor({ record }: { record: FabricationRecord }) {
  const part = getPart(record.componentId);
  const patch = (p: Parameters<typeof upsertFabricationRecord>[1]) =>
    upsertFabricationRecord(record.componentId, p);

  return (
    <div className="panel flex flex-col gap-2.5 border-accent-500/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-ivory-100">{part?.name ?? record.componentId}</h3>
        <span
          className="chip"
          style={{
            borderColor: statusMeta(record.status).colorHex,
            color: statusMeta(record.status).colorHex,
          }}
        >
          {statusMeta(record.status).glyph}
        </span>
      </div>

      <label className="block">
        <span className="field-label">Status</span>
        <select
          className="input-base"
          value={record.status}
          onChange={(e) =>
            setFabricationStatus(record.componentId, e.target.value as FabricationStatus)
          }
        >
          {FABRICATION_STATUSES.map((s) => (
            <option key={s.id} value={s.id}>
              [{s.glyph}] {s.label}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-2 gap-1.5">
        <label className="block">
          <span className="field-label">Priority</span>
          <select
            className="input-base"
            value={record.priority}
            onChange={(e) => patch({ priority: e.target.value as FabricationRecord['priority'] })}
          >
            {(['low', 'medium', 'high', 'critical'] as const).map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Process</span>
          <select
            className="input-base"
            value={record.process}
            onChange={(e) => patch({ process: e.target.value as FabricationRecord['process'] })}
          >
            {(
              [
                'none',
                'fdm-print',
                'sla-print',
                'cnc-mill',
                'sheet-metal',
                'cast',
                'hand-fabricate',
              ] as const
            ).map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Assignee</span>
          <input
            className="input-base"
            value={record.assignee}
            maxLength={60}
            onChange={(e) => patch({ assignee: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="field-label">Supplier</span>
          <input
            className="input-base"
            value={record.supplier}
            maxLength={80}
            onChange={(e) => patch({ supplier: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="field-label">Material</span>
          <input
            className="input-base"
            value={record.proposedMaterial}
            maxLength={60}
            placeholder="e.g. 304 stainless"
            onChange={(e) => patch({ proposedMaterial: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="field-label">Quantity</span>
          <input
            className="input-base"
            type="number"
            min={1}
            max={999}
            value={record.quantity}
            onChange={(e) =>
              patch({ quantity: Math.max(1, Math.floor(Number(e.target.value) || 1)) })
            }
          />
        </label>
        <label className="block">
          <span className="field-label">Est. cost (USD)</span>
          <input
            className="input-base"
            type="number"
            min={0}
            value={record.estimatedCostUsd ?? ''}
            placeholder="—"
            onChange={(e) =>
              patch({
                estimatedCostUsd:
                  e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
              })
            }
          />
        </label>
        <label className="block">
          <span className="field-label">Tolerance (mm)</span>
          <input
            className="input-base"
            type="number"
            min={0}
            step={0.05}
            value={record.toleranceMm ?? ''}
            placeholder="—"
            onChange={(e) =>
              patch({
                toleranceMm: e.target.value === '' ? null : Math.max(0, Number(e.target.value)),
              })
            }
          />
        </label>
      </div>

      <fieldset>
        <legend className="field-label">Dimensions (mm) — unverified</legend>
        <div className="grid grid-cols-3 gap-1.5">
          {(['x', 'y', 'z'] as const).map((axis) => (
            <input
              key={axis}
              className="input-base"
              type="number"
              min={0}
              aria-label={`Dimension ${axis.toUpperCase()} in millimetres`}
              placeholder={axis.toUpperCase()}
              value={record.dimensionsMm?.[axis] ?? ''}
              onChange={(e) => {
                const dims = { x: 0, y: 0, z: 0, ...record.dimensionsMm };
                dims[axis] = Math.max(0, Number(e.target.value) || 0);
                patch({ dimensionsMm: dims });
              }}
            />
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-[11px]">
        <input
          type="checkbox"
          checked={record.scanRequired}
          onChange={(e) => patch({ scanRequired: e.target.checked })}
        />
        Calibrated 3D scan required before manufacture
      </label>

      <label className="block">
        <span className="field-label">Print orientation notes</span>
        <input
          className="input-base"
          value={record.printOrientationNotes}
          maxLength={200}
          onChange={(e) => patch({ printOrientationNotes: e.target.value })}
        />
      </label>

      <label className="block">
        <span className="field-label">Notes</span>
        <textarea
          className="input-base min-h-16"
          value={record.notes}
          maxLength={2000}
          onChange={(e) => patch({ notes: e.target.value })}
        />
      </label>

      <p className="rounded border border-warn-500/40 bg-warn-500/5 p-2 text-[10px] leading-relaxed text-warn-500">
        manufacturingValidated: false — display geometry is not calibrated. Dimensions here are
        planning inputs until verified from a scan or engineering model.
      </p>

      <button
        className="btn-ghost self-start text-danger-500"
        onClick={() => removeFabricationRecord(record.componentId)}
      >
        Delete record
      </button>
    </div>
  );
}

const FILTERS: { id: FabFilter; label: string }[] = [
  { id: 'all', label: 'All parts' },
  { id: 'affected', label: 'Affected' },
  { id: 'scan', label: 'Scan items' },
  { id: 'print', label: 'Print candidates' },
];

export function TitanforgeTab() {
  const build = useBuildStore((s) => s.build);
  const mode = useUiStore((s) => s.mode);
  const setMode = useUiStore((s) => s.setMode);
  const select = useUiStore((s) => s.select);
  const selectedComponentId = useUiStore((s) => s.selectedComponentId);
  const fabFilter = useUiStore((s) => s.fabFilter);
  const setFabFilter = useUiStore((s) => s.setFabFilter);
  const placingAnnotation = useUiStore((s) => s.placingAnnotation);
  const setPlacingAnnotation = useUiStore((s) => s.setPlacingAnnotation);

  const vehicle = build ? getVehicle(build.vehicleId) : undefined;
  const manifest = vehicle ? getManifestForVehicle(vehicle.id) : undefined;

  const records = useMemo(
    () =>
      Object.values(build?.fabricationRecords ?? {}).sort((a, b) =>
        a.componentId.localeCompare(b.componentId),
      ),
    [build?.fabricationRecords],
  );
  const selectedRecord = selectedComponentId
    ? build?.fabricationRecords[selectedComponentId]
    : undefined;

  if (!build || !vehicle) return null;
  if (!manifest?.supportedFeatures.componentEditing) {
    return (
      <p className="text-xs text-graphite-400">
        Titanforge needs component-mapped 3D geometry. This vehicle has no mapped asset.
      </p>
    );
  }

  const startRecordForSelection = () => {
    if (!selectedComponentId) return;
    setFabricationStatus(selectedComponentId, 'modify-existing');
  };

  return (
    <div className="flex flex-col gap-4">
      {mode !== 'fabrication' && (
        <button className="btn-accent" onClick={() => setMode('fabrication')}>
          Enter Fabrication mode
        </button>
      )}

      <section>
        <span className="field-label">Adapter</span>
        <p className="text-[11px] text-graphite-300">
          {titanforgeAdapter.label}
          <span className="block text-[10px] text-graphite-400">
            No external Titanforge API is connected; records live with the build and export as
            JSON/CSV (Export menu).
          </span>
        </p>
      </section>

      <section>
        <span className="field-label">Filter overlay</span>
        <div className="flex flex-wrap gap-1">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`btn !py-1 ${fabFilter === f.id ? 'btn-on' : ''}`}
              aria-pressed={fabFilter === f.id}
              onClick={() => setFabFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
          <select
            className="input-base w-auto"
            aria-label="Filter by a single status"
            value={FABRICATION_STATUSES.some((s) => s.id === fabFilter) ? fabFilter : ''}
            onChange={(e) => setFabFilter((e.target.value || 'all') as FabFilter)}
          >
            <option value="">By status…</option>
            {FABRICATION_STATUSES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <section>
        <span className="field-label">Legend</span>
        <ul className="grid grid-cols-1 gap-1">
          {FABRICATION_STATUSES.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2 text-[11px] text-graphite-300"
              title={s.description}
            >
              <span
                className="h-2.5 w-2.5 rounded-sm border"
                style={{ background: s.colorHex, borderColor: s.colorHex }}
                aria-hidden
              />
              <span className="w-10 font-mono text-[10px] text-graphite-400">{s.glyph}</span>
              {s.label}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-[10px] text-graphite-400">
          Overlay uses colour + the glyph shown beside each record, never colour alone.
        </p>
      </section>

      <section className="flex flex-col gap-1.5">
        <span className="field-label">Selected component</span>
        {selectedComponentId ? (
          selectedRecord ? (
            <RecordEditor record={selectedRecord} />
          ) : (
            <button className="btn" onClick={startRecordForSelection}>
              Open Titanforge record for “
              {getPart(selectedComponentId)?.name ?? selectedComponentId}”
            </button>
          )
        ) : (
          <p className="text-[11px] text-graphite-400">
            {mode === 'fabrication'
              ? 'Click a component in the viewport (or the list below) to open its record.'
              : 'Enter Fabrication mode, then click a component to open its record.'}
          </p>
        )}
      </section>

      <section>
        <span className="field-label">Records ({records.length})</span>
        {records.length === 0 ? (
          <p className="text-[11px] text-graphite-400">No fabrication records yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {records.map((r) => {
              const meta = statusMeta(r.status);
              return (
                <li key={r.componentId}>
                  <button
                    className={`flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left text-[11px] ${
                      selectedComponentId === r.componentId
                        ? 'border-accent-500/70'
                        : 'border-graphite-700/60 hover:bg-graphite-850'
                    }`}
                    onClick={() => select(r.componentId)}
                  >
                    <span
                      className="chip shrink-0"
                      style={{ borderColor: meta.colorHex, color: meta.colorHex }}
                    >
                      {meta.glyph}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-ivory-100">
                      {getPart(r.componentId)?.name ?? r.componentId}
                    </span>
                    <span className="text-graphite-400">{r.priority}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <span className="field-label">Annotations ({build.annotations.length})</span>
        <button
          className={`btn w-full ${placingAnnotation ? 'btn-on' : ''}`}
          aria-pressed={placingAnnotation}
          onClick={() => setPlacingAnnotation(!placingAnnotation)}
        >
          {placingAnnotation ? 'Click the model… (Esc to cancel)' : 'Place annotation hotspot'}
        </button>
        {build.annotations.length > 0 && (
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {build.annotations.map((a, i) => (
              <li key={a.id} className="panel flex items-start gap-2 p-2">
                <span className="annotation-marker !static shrink-0">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] text-graphite-400">
                    {a.componentId ? (getPart(a.componentId)?.name ?? a.componentId) : 'Unattached'}
                  </p>
                  <input
                    className="input-base mt-1"
                    placeholder="Annotation text…"
                    value={a.text}
                    maxLength={500}
                    onChange={(e) => updateAnnotationText(a.id, e.target.value)}
                  />
                </div>
                <button
                  className="btn-ghost !p-1 text-danger-500"
                  aria-label={`Delete annotation ${i + 1}`}
                  onClick={() => removeAnnotation(a.id)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <span className="field-label">Geometry export</span>
        <p className="text-[11px] leading-relaxed text-graphite-400">
          Per-part mesh export is not enabled in this MVP: the display meshes are not watertight or
          dimensionally calibrated, so exporting them for printing would be misleading. Export the
          JSON/CSV manifest instead and attach calibrated scans downstream.
        </p>
      </section>
    </div>
  );
}
