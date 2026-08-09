import { useState } from 'react';
import { useBuildStore } from '@/state/buildStore';
import { useUiStore } from '@/state/uiStore';
import { getViewportApi, type SnapshotAspect } from '@/three/viewportApi';
import { DialogShell } from './Dialogs';

export function SnapshotDialog() {
  const build = useBuildStore((s) => s.build);
  const toast = useUiStore((s) => s.toast);
  const closeDialog = useUiStore((s) => s.closeDialog);
  const [aspect, setAspect] = useState<SnapshotAspect>('viewport');
  const [transparent, setTransparent] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const capture = async () => {
    const api = getViewportApi();
    if (!api) {
      toast('error', 'The 3D viewer is not active — open a vehicle with a 3D asset first.');
      return;
    }
    setBusy(true);
    try {
      setPreview(await api.captureSnapshot({ aspect, transparent }));
    } catch (e) {
      toast('error', `Snapshot failed: ${e instanceof Error ? e.message : 'unknown error'}`);
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!preview) return;
    const a = document.createElement('a');
    a.href = preview;
    a.download = `${(build?.name ?? 'build').replace(/\s+/g, '-').toLowerCase()}-snapshot.png`;
    a.click();
    toast('success', 'Snapshot downloaded.');
  };

  return (
    <DialogShell title="Viewport snapshot">
      <div className="flex flex-col gap-3 text-xs text-graphite-300">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="field-label">Aspect ratio</span>
            <select
              className="input-base w-32"
              value={aspect}
              onChange={(e) => setAspect(e.target.value as SnapshotAspect)}
            >
              <option value="viewport">Viewport</option>
              <option value="1:1">1 : 1</option>
              <option value="4:3">4 : 3</option>
              <option value="16:9">16 : 9</option>
            </select>
          </label>
          <label className="flex items-center gap-2 pb-1.5">
            <input
              type="checkbox"
              checked={transparent}
              onChange={(e) => setTransparent(e.target.checked)}
            />
            Transparent background
          </label>
          <button className="btn-accent" disabled={busy} onClick={() => void capture()}>
            {busy ? 'Capturing…' : preview ? 'Re-capture' : 'Capture'}
          </button>
        </div>
        {preview && (
          <div
            className="flex justify-center rounded p-2"
            style={{
              background:
                'repeating-conic-gradient(#2e323b 0% 25%, #22252c 0% 50%) 0 0 / 16px 16px',
            }}
          >
            <img src={preview} alt="Snapshot preview" className="max-h-64 object-contain" />
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button className="btn" onClick={closeDialog}>
            Close
          </button>
          <button className="btn-accent" disabled={!preview} onClick={download}>
            Download PNG
          </button>
        </div>
      </div>
    </DialogShell>
  );
}
