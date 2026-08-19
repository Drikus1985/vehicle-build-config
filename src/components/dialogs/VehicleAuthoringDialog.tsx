import { useEffect, useState } from 'react';
import * as THREE from 'three';
import type { BodyStyle, VehicleType } from '@/lib/schemas';
import { repositories } from '@/lib/persistence/idb';
import type { ImportedAsset } from '@/lib/persistence/repositories';
import {
  buildUserVehicleBundle,
  guessZoneForNode,
  inferScale,
  KEEP_ORIGINAL,
  USER_ZONES,
  type AuthoringNode,
} from '@/lib/importing/vehicleAuthoring';
import { saveUserVehicle } from '@/lib/catalog';
import { useUiStore } from '@/state/uiStore';
import { DialogShell } from './Dialogs';

const VEHICLE_TYPES: VehicleType[] = ['car', 'pickup', 'panel-truck', 'van', 'wagon'];
const BODY_STYLES: BodyStyle[] = [
  'coupe',
  'sedan',
  'hardtop',
  'convertible',
  'fastback',
  'wagon',
  'panel',
  'van',
  'stepside',
  'fleetside',
];

interface Inspection {
  asset: ImportedAsset;
  nodes: AuthoringNode[];
  bboxMin: [number, number, number];
  bboxMax: [number, number, number];
}

/**
 * Collect mappable node names at the granularity the viewer uses
 * (getObjectByName + all meshes underneath). Named groups that merely wrap
 * other named mesh nodes (e.g. a single root group around the whole model)
 * are treated as containers and descended through; a node is a mapping leaf
 * when nothing named-with-meshes exists below it.
 */
function collectNamedNodes(root: THREE.Object3D): string[] {
  const names: string[] = [];
  const hasMesh = (o: THREE.Object3D): boolean => {
    let found = false;
    o.traverse((c) => {
      if ((c as THREE.Mesh).isMesh) found = true;
    });
    return found;
  };
  const namedMeshDescendants = (o: THREE.Object3D): number => {
    let count = 0;
    o.traverse((c) => {
      if (c !== o && c.name && hasMesh(c)) count++;
    });
    return count;
  };
  const visit = (o: THREE.Object3D) => {
    if (o.name && hasMesh(o) && namedMeshDescendants(o) === 0) {
      if (!names.includes(o.name)) names.push(o.name);
      return; // leaf: unnamed meshes below belong to this node
    }
    for (const child of o.children) visit(child);
  };
  for (const child of root.children) visit(child);
  return names;
}

export function VehicleAuthoringDialog({ assetId }: { assetId: string }) {
  const toast = useUiStore((s) => s.toast);
  const closeDialog = useUiStore((s) => s.closeDialog);
  const [state, setState] = useState<
    | { step: 'loading' }
    | { step: 'error'; message: string }
    | { step: 'map'; inspection: Inspection }
    | { step: 'saving'; inspection: Inspection }
  >({ step: 'loading' });
  const [meta, setMeta] = useState({
    year: 1965,
    make: '',
    model: '',
    trim: '',
    vehicleType: 'car' as VehicleType,
    bodyStyle: 'coupe' as BodyStyle,
  });

  // Load the GLB once to read its node tree and bounding box.
  useEffect(() => {
    let live = true;
    let url: string | null = null;
    void (async () => {
      try {
        const asset = await repositories.assets.get(assetId);
        if (!asset) throw new Error('Asset not found in the library.');
        if (asset.kind !== 'gltf') {
          throw new Error(
            'Only glTF/GLB assets can be mapped to vehicles (STL has no named nodes).',
          );
        }
        url = URL.createObjectURL(asset.blob);
        const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
        const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');
        const dracoLoader = new DRACOLoader().setDecoderPath('/draco/');
        const loader = new GLTFLoader().setDRACOLoader(dracoLoader);
        const gltf = await loader.loadAsync(url).finally(() => dracoLoader.dispose());
        const names = collectNamedNodes(gltf.scene);
        const box = new THREE.Box3().setFromObject(gltf.scene);
        if (!live) return;
        if (names.length === 0) {
          throw new Error(
            'This model has no named mesh nodes — per-part mapping is impossible. Re-export it with separately named meshes.',
          );
        }
        setState({
          step: 'map',
          inspection: {
            asset,
            nodes: names.map((name) => ({ name, zoneId: guessZoneForNode(name) })),
            bboxMin: box.min.toArray() as [number, number, number],
            bboxMax: box.max.toArray() as [number, number, number],
          },
        });
      } catch (err) {
        if (live) {
          setState({ step: 'error', message: err instanceof Error ? err.message : String(err) });
        }
      }
    })();
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [assetId]);

  const create = async (inspection: Inspection) => {
    if (!meta.make.trim() || !meta.model.trim()) {
      toast('warning', 'Make and model are required.');
      return;
    }
    setState({ step: 'saving', inspection });
    try {
      const bundle = buildUserVehicleBundle({
        asset: inspection.asset,
        meta: {
          year: Math.min(1978, Math.max(1948, Math.round(meta.year))),
          make: meta.make.trim(),
          model: meta.model.trim(),
          trim: meta.trim.trim() || undefined,
          vehicleType: meta.vehicleType,
          bodyStyle: meta.bodyStyle,
        },
        nodes: inspection.nodes,
        bboxMin: inspection.bboxMin,
        bboxMax: inspection.bboxMax,
      });
      await saveUserVehicle(bundle);
      toast(
        'success',
        `"${bundle.vehicle.year} ${bundle.vehicle.make} ${bundle.vehicle.model}" added to the library — 3D ready.`,
      );
      closeDialog();
    } catch (err) {
      toast('error', `Creating the vehicle failed: ${err instanceof Error ? err.message : err}`);
      setState({ step: 'map', inspection });
    }
  };

  const inspection = state.step === 'map' || state.step === 'saving' ? state.inspection : null;
  const size = inspection
    ? inspection.bboxMax.map((v, i) => v - inspection.bboxMin[i]!)
    : ([0, 0, 0] as number[]);
  const scale = inspection ? inferScale(Math.max(...size)) : 1;

  return (
    <DialogShell title="Map imported model to a vehicle">
      <div className="flex flex-col gap-3 text-xs text-graphite-300">
        {state.step === 'loading' && <p role="status">Reading the model&apos;s node tree…</p>}
        {state.step === 'error' && (
          <div className="rounded border border-danger-500/50 bg-danger-500/5 p-3">
            <p className="text-danger-500">{state.message}</p>
            <button className="btn mt-2" onClick={closeDialog}>
              Close
            </button>
          </div>
        )}
        {inspection && (
          <>
            <p className="text-[11px] leading-relaxed text-graphite-400">
              {inspection.nodes.length} named mesh nodes found. Each becomes a removable, selectable
              part; assign a material zone (paintable: Body, Trim, Interior) or keep the
              asset&apos;s original materials. Cameras, dimensions and grounding are derived from
              the geometry
              {scale !== 1
                ? ` (units auto-normalised ×${scale} — model appears to be off metre scale)`
                : ''}
              . Wheels/stance, stripes and liveries stay unavailable for user-mapped assets.
            </p>

            <fieldset className="grid grid-cols-2 gap-1.5">
              <legend className="field-label">Vehicle metadata</legend>
              <input
                className="input-base"
                type="number"
                min={1948}
                max={1978}
                value={meta.year}
                aria-label="Year (1948–1978)"
                onChange={(e) => setMeta({ ...meta, year: Number(e.target.value) })}
              />
              <input
                className="input-base"
                placeholder="Make *"
                value={meta.make}
                aria-label="Make"
                onChange={(e) => setMeta({ ...meta, make: e.target.value })}
              />
              <input
                className="input-base"
                placeholder="Model *"
                value={meta.model}
                aria-label="Model"
                onChange={(e) => setMeta({ ...meta, model: e.target.value })}
              />
              <input
                className="input-base"
                placeholder="Trim (optional)"
                value={meta.trim}
                aria-label="Trim"
                onChange={(e) => setMeta({ ...meta, trim: e.target.value })}
              />
              <select
                className="input-base"
                value={meta.vehicleType}
                aria-label="Vehicle type"
                onChange={(e) => setMeta({ ...meta, vehicleType: e.target.value as VehicleType })}
              >
                {VEHICLE_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <select
                className="input-base"
                value={meta.bodyStyle}
                aria-label="Body style"
                onChange={(e) => setMeta({ ...meta, bodyStyle: e.target.value as BodyStyle })}
              >
                {BODY_STYLES.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </fieldset>

            <div>
              <span className="field-label">Node → material zone mapping</span>
              <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto pr-1">
                {inspection.nodes.map((node, i) => (
                  <li key={node.name} className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-ivory-100">
                      {node.name}
                    </span>
                    <select
                      className="input-base !w-36 !py-1"
                      value={node.zoneId}
                      aria-label={`Zone for node ${node.name}`}
                      onChange={(e) => {
                        const nodes = [...inspection.nodes];
                        nodes[i] = { ...node, zoneId: e.target.value };
                        setState({ step: 'map', inspection: { ...inspection, nodes } });
                      }}
                    >
                      {USER_ZONES.map((z) => (
                        <option key={z.id} value={z.id}>
                          {z.label}
                          {z.paintable ? ' (paintable)' : ''}
                        </option>
                      ))}
                      <option value={KEEP_ORIGINAL}>Keep original</option>
                    </select>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-[10px] text-graphite-400">
              Derived size: {size.map((v) => (v * scale).toFixed(2)).join(' × ')} m · attribution
              carries over from the import ({inspection.asset.attribution.licence}).
            </p>

            <div className="flex justify-end gap-2">
              <button className="btn" onClick={closeDialog}>
                Cancel
              </button>
              <button
                className="btn-accent"
                disabled={state.step === 'saving'}
                onClick={() => void create(inspection)}
              >
                {state.step === 'saving' ? 'Creating…' : 'Create vehicle'}
              </button>
            </div>
          </>
        )}
      </div>
    </DialogShell>
  );
}
