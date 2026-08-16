import { useEffect, useRef, useState } from 'react';
import { newId } from '@/lib/build/defaults';
import { sanitizeFilename, validateImportFile, type ValidationOk } from '@/lib/importing/validate';
import { repositories } from '@/lib/persistence/idb';
import type { ImportedAsset } from '@/lib/persistence/repositories';
import { useUiStore } from '@/state/uiStore';
import { DialogShell } from './Dialogs';
import { MiniModelPreview } from './MiniModelPreview';

type Stage =
  | { step: 'pick' }
  | { step: 'reading'; file: File; progress: number }
  | { step: 'invalid'; file: File; reason: string; hint: string }
  | { step: 'preview'; file: File; result: ValidationOk; data: Blob; url: string }
  | { step: 'done'; name: string };

interface RightsForm {
  sourceName: string;
  sourceUrl: string;
  creator: string;
  licence: string;
  attributionText: string;
  reuseConfirmed: boolean;
}

const EMPTY_RIGHTS: RightsForm = {
  sourceName: '',
  sourceUrl: '',
  creator: '',
  licence: '',
  attributionText: '',
  reuseConfirmed: false,
};

export function ImportDialog() {
  const toast = useUiStore((s) => s.toast);
  const closeDialog = useUiStore((s) => s.closeDialog);
  const [stage, setStage] = useState<Stage>({ step: 'pick' });
  const [rights, setRights] = useState<RightsForm>(EMPTY_RIGHTS);
  const [asWheel, setAsWheel] = useState(false);
  const [assets, setAssets] = useState<Omit<ImportedAsset, 'blob'>[]>([]);
  const readerRef = useRef<FileReader | null>(null);

  const refreshAssets = () =>
    void repositories.assets
      .list()
      .then(setAssets)
      .catch(() => {});
  useEffect(refreshAssets, []);

  // Revoke preview object URLs.
  useEffect(() => {
    return () => {
      if (stage.step === 'preview') URL.revokeObjectURL(stage.url);
    };
  }, [stage]);

  const startRead = async (file: File) => {
    const validation = await validateImportFile(file);
    if (!validation.ok) {
      setStage({ step: 'invalid', file, reason: validation.reason, hint: validation.hint });
      return;
    }
    // Read with real progress + cancellation support.
    setStage({ step: 'reading', file, progress: 0 });
    const reader = new FileReader();
    readerRef.current = reader;
    reader.onprogress = (e) => {
      if (e.lengthComputable) {
        setStage({ step: 'reading', file, progress: Math.round((e.loaded / e.total) * 100) });
      }
    };
    reader.onerror = () => {
      setStage({
        step: 'invalid',
        file,
        reason: 'Reading the file failed.',
        hint: 'Try again or pick another file.',
      });
    };
    reader.onabort = () => setStage({ step: 'pick' });
    reader.onload = () => {
      const data = new Blob([reader.result as ArrayBuffer], { type: validation.mime });
      setStage({ step: 'preview', file, result: validation, data, url: URL.createObjectURL(data) });
    };
    reader.readAsArrayBuffer(file);
  };

  const confirmAdd = async () => {
    if (stage.step !== 'preview') return;
    if (!rights.sourceName.trim() || !rights.licence.trim() || !rights.reuseConfirmed) {
      toast(
        'warning',
        'Source, licence and reuse confirmation are required before adding an asset.',
      );
      return;
    }
    const asset: ImportedAsset = {
      id: newId('asset'),
      name: sanitizeFilename(stage.file.name),
      kind: stage.result.kind,
      ...(asWheel && stage.result.kind !== 'image' ? { role: 'wheel' as const } : {}),
      mime: stage.result.mime,
      sizeBytes: stage.data.size,
      blob: stage.data,
      attribution: {
        sourceName: rights.sourceName.trim().slice(0, 200),
        sourceUrl: rights.sourceUrl.trim().slice(0, 500) || undefined,
        creator: rights.creator.trim().slice(0, 200) || undefined,
        licence: rights.licence.trim().slice(0, 120),
        attributionText: (
          rights.attributionText.trim() || `${rights.sourceName.trim()} (${rights.licence.trim()})`
        ).slice(0, 500),
        reuseConfirmed: true,
      },
      addedAt: new Date().toISOString(),
    };
    try {
      await repositories.assets.add(asset);
      setStage({ step: 'done', name: asset.name });
      setRights(EMPTY_RIGHTS);
      setAsWheel(false);
      refreshAssets();
      toast('success', `Added "${asset.name}" to the asset library.`);
    } catch {
      toast('error', 'Storing the asset failed — your browser storage may be full.');
    }
  };

  return (
    <DialogShell title="Import reference & assets">
      <div className="flex flex-col gap-3 text-xs text-graphite-300">
        <p className="text-[11px] leading-relaxed text-graphite-400">
          Reference images (PNG/JPEG/WebP), runtime 3D (glTF 2.0 .glb/.gltf) and STL for part
          inspection. Imported photos are visual references only — they are never treated as
          editable 3D geometry. Imported 3D files without component metadata load as monolithic
          models (no per-part editing). Remote URL scraping is not supported; import only files you
          have rights to reuse.
        </p>

        {stage.step === 'pick' && (
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed border-graphite-600 p-6 text-center hover:border-accent-500/60">
            <span className="text-ivory-200">Choose a file…</span>
            <span className="text-[10px] text-graphite-400">
              PNG · JPEG · WebP · GLB · glTF · STL (validated by content, not extension)
            </span>
            <input
              type="file"
              className="hidden"
              accept=".png,.jpg,.jpeg,.webp,.glb,.gltf,.stl"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void startRead(f);
                e.target.value = '';
              }}
            />
          </label>
        )}

        {stage.step === 'reading' && (
          <div className="panel flex flex-col gap-2 p-3" role="status">
            <span>Reading {stage.file.name}…</span>
            <div className="h-1.5 overflow-hidden rounded bg-graphite-700">
              <div className="h-full bg-accent-500" style={{ width: `${stage.progress}%` }} />
            </div>
            <button className="btn self-start" onClick={() => readerRef.current?.abort()}>
              Cancel
            </button>
          </div>
        )}

        {stage.step === 'invalid' && (
          <div className="rounded border border-danger-500/50 bg-danger-500/5 p-3">
            <p className="font-semibold text-danger-500">Rejected: {stage.reason}</p>
            <p className="mt-1 text-graphite-300">{stage.hint}</p>
            <div className="mt-2 flex gap-2">
              <button className="btn" onClick={() => setStage({ step: 'pick' })}>
                Choose another file
              </button>
              <button className="btn" onClick={() => void startRead(stage.file)}>
                Retry same file
              </button>
            </div>
          </div>
        )}

        {stage.step === 'preview' && (
          <>
            <div className="panel p-3">
              <p className="text-ivory-100">
                {stage.file.name}{' '}
                <span className="text-graphite-400">
                  — {stage.result.detail}, {(stage.data.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </p>
              <div className="mt-2 flex justify-center rounded bg-graphite-950 p-2">
                {stage.result.kind === 'image' ? (
                  <img
                    src={stage.url}
                    alt={`Preview of ${stage.file.name}`}
                    className="max-h-48 rounded object-contain"
                  />
                ) : (
                  <MiniModelPreview url={stage.url} kind={stage.result.kind} />
                )}
              </div>
            </div>

            {stage.result.kind !== 'image' && (
              <label className="flex items-start gap-2 text-[11px]">
                <input
                  type="checkbox"
                  checked={asWheel}
                  onChange={(e) => setAsWheel(e.target.checked)}
                />
                <span>
                  This is a <strong className="text-ivory-100">wheel model</strong> — offer it in
                  Wheels &amp; Tyres. It will be auto-oriented and scaled to the configured overall
                  tyre diameter (display fit, not an engineering fit).
                </span>
              </label>
            )}

            <fieldset className="flex flex-col gap-1.5">
              <legend className="field-label">Provenance &amp; rights (required)</legend>
              <input
                className="input-base"
                placeholder="Source / provider name *"
                value={rights.sourceName}
                onChange={(e) => setRights({ ...rights, sourceName: e.target.value })}
              />
              <input
                className="input-base"
                placeholder="Source URL (optional)"
                value={rights.sourceUrl}
                onChange={(e) => setRights({ ...rights, sourceUrl: e.target.value })}
              />
              <input
                className="input-base"
                placeholder="Creator (optional)"
                value={rights.creator}
                onChange={(e) => setRights({ ...rights, creator: e.target.value })}
              />
              <input
                className="input-base"
                placeholder="Licence, e.g. CC0, CC-BY-4.0, purchased *"
                value={rights.licence}
                onChange={(e) => setRights({ ...rights, licence: e.target.value })}
              />
              <input
                className="input-base"
                placeholder="Attribution text (optional)"
                value={rights.attributionText}
                onChange={(e) => setRights({ ...rights, attributionText: e.target.value })}
              />
              <label className="mt-1 flex items-start gap-2 text-[11px]">
                <input
                  type="checkbox"
                  checked={rights.reuseConfirmed}
                  onChange={(e) => setRights({ ...rights, reuseConfirmed: e.target.checked })}
                />
                I confirm I have the right to reuse this asset in this project. *
              </label>
            </fieldset>

            <div className="flex justify-end gap-2">
              <button className="btn" onClick={() => setStage({ step: 'pick' })}>
                Back
              </button>
              <button className="btn-accent" onClick={() => void confirmAdd()}>
                Add to library
              </button>
            </div>
          </>
        )}

        {stage.step === 'done' && (
          <div className="rounded border border-ok-500/40 bg-ok-500/5 p-3">
            <p className="text-ok-500">“{stage.name}” added to the library.</p>
            <button className="btn mt-2" onClick={() => setStage({ step: 'pick' })}>
              Import another
            </button>
          </div>
        )}

        <section>
          <h3 className="field-label">Library ({assets.length})</h3>
          {assets.length === 0 ? (
            <p className="text-[11px] text-graphite-400">No imported assets yet.</p>
          ) : (
            <ul className="flex max-h-40 flex-col gap-1 overflow-y-auto">
              {assets.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 rounded border border-graphite-700/60 px-2 py-1.5"
                >
                  <span className="chip">{a.role === 'wheel' ? 'wheel' : a.kind}</span>
                  <span className="min-w-0 flex-1 truncate text-ivory-100">{a.name}</span>
                  <span className="text-[10px] text-graphite-400">
                    {(a.sizeBytes / 1024 / 1024).toFixed(1)} MB · {a.attribution.licence}
                  </span>
                  <button
                    className="btn-ghost !p-1 text-danger-500"
                    aria-label={`Delete asset ${a.name}`}
                    onClick={async () => {
                      await repositories.assets.remove(a.id);
                      refreshAssets();
                    }}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex justify-end">
          <button className="btn" onClick={closeDialog}>
            Close
          </button>
        </div>
      </div>
    </DialogShell>
  );
}
