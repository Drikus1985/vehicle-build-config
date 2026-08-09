import { useEffect, useRef, useState } from 'react';
import { getManifestForVehicle, getVehicle } from '@/lib/catalog';
import { downloadFile, serializeBuild } from '@/lib/export/buildFile';
import { buildSummaryHtml } from '@/lib/export/summary';
import { buildTitanforgeManifest, titanforgeManifestToCsv } from '@/lib/titanforge';
import { renameBuild } from '@/state/buildActions';
import { useBuildStore } from '@/state/buildStore';
import { useUiStore, type WorkspaceMode } from '@/state/uiStore';

const MODES: { id: WorkspaceMode; label: string }[] = [
  { id: 'design', label: 'Design' },
  { id: 'fabrication', label: 'Fabrication' },
  { id: 'compare', label: 'Compare' },
];

function SaveStatusBadge() {
  const status = useUiStore((s) => s.saveStatus);
  const map = {
    idle: { label: 'Not saved yet', cls: 'bg-graphite-600' },
    saving: { label: 'Saving…', cls: 'bg-warn-500 animate-pulse' },
    saved: { label: 'Saved locally', cls: 'bg-ok-500' },
    error: { label: 'Save failed', cls: 'bg-danger-500' },
  }[status];
  return (
    <span className="flex items-center gap-1.5 text-[11px] text-graphite-400" role="status">
      <span className={`h-2 w-2 rounded-full ${map.cls}`} aria-hidden />
      {map.label}
    </span>
  );
}

function ExportMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const build = useBuildStore((s) => s.build);
  const toast = useUiStore((s) => s.toast);
  const openDialog = useUiStore((s) => s.openDialog);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [open]);

  if (!build) return null;
  const vehicle = getVehicle(build.vehicleId);

  const exportBuildJson = () => {
    downloadFile(
      `${build.name.replace(/\s+/g, '-').toLowerCase()}.build.json`,
      serializeBuild(build),
    );
    toast('success', 'Build JSON exported.');
    setOpen(false);
  };
  const exportTitanforge = (as: 'json' | 'csv') => {
    if (!vehicle) return;
    const manifest = buildTitanforgeManifest(build, vehicle, getManifestForVehicle(vehicle.id));
    if (manifest.items.length === 0) {
      toast('warning', 'No Titanforge records yet — mark components in Fabrication mode first.');
      setOpen(false);
      return;
    }
    if (as === 'json') {
      downloadFile(`${build.name}-titanforge.json`, JSON.stringify(manifest, null, 2));
    } else {
      downloadFile(`${build.name}-titanforge.csv`, titanforgeManifestToCsv(manifest), 'text/csv');
    }
    toast('success', `Titanforge manifest exported (${as.toUpperCase()}).`);
    setOpen(false);
  };
  const printSummary = () => {
    const win = window.open('', '_blank');
    if (!win) {
      toast('error', 'Pop-up blocked — allow pop-ups to print the summary.');
      return;
    }
    win.document.write(buildSummaryHtml(build));
    win.document.close();
    win.focus();
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        className="btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        Export ▾
      </button>
      {open && (
        <div
          role="menu"
          className="panel absolute right-0 top-full z-40 mt-1 flex w-56 flex-col p-1 shadow-xl"
        >
          <button role="menuitem" className="btn-ghost justify-start" onClick={exportBuildJson}>
            Build file (.json)
          </button>
          <button
            role="menuitem"
            className="btn-ghost justify-start"
            onClick={() => {
              openDialog({ kind: 'snapshot' });
              setOpen(false);
            }}
          >
            Viewport snapshot (PNG)…
          </button>
          <button role="menuitem" className="btn-ghost justify-start" onClick={printSummary}>
            Printable build summary
          </button>
          <div className="mx-2 my-1 border-t border-graphite-700/60" />
          <button
            role="menuitem"
            className="btn-ghost justify-start"
            onClick={() => exportTitanforge('json')}
          >
            Titanforge manifest (JSON)
          </button>
          <button
            role="menuitem"
            className="btn-ghost justify-start"
            onClick={() => exportTitanforge('csv')}
          >
            Titanforge manifest (CSV)
          </button>
        </div>
      )}
    </div>
  );
}

export function TopBar() {
  const build = useBuildStore((s) => s.build);
  const canUndo = useBuildStore((s) => s.past.length > 0);
  const canRedo = useBuildStore((s) => s.future.length > 0);
  const undo = useBuildStore((s) => s.undo);
  const redo = useBuildStore((s) => s.redo);
  const resetToStock = useBuildStore((s) => s.resetToStock);
  const mode = useUiStore((s) => s.mode);
  const setMode = useUiStore((s) => s.setMode);
  const openDialog = useUiStore((s) => s.openDialog);
  const toast = useUiStore((s) => s.toast);
  const leftPanelOpen = useUiStore((s) => s.leftPanelOpen);
  const setLeftPanelOpen = useUiStore((s) => s.setLeftPanelOpen);
  const rightPanelOpen = useUiStore((s) => s.rightPanelOpen);
  const setRightPanelOpen = useUiStore((s) => s.setRightPanelOpen);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 overflow-x-auto border-b border-graphite-700/60 bg-graphite-900 px-3 [&>*]:shrink-0">
      <button
        className="btn-ghost lg:hidden"
        aria-label={leftPanelOpen ? 'Hide vehicle library' : 'Show vehicle library'}
        onClick={() => setLeftPanelOpen(!leftPanelOpen)}
      >
        ☰
      </button>
      <div className="flex items-baseline gap-2 select-none">
        <span className="font-mono text-sm font-bold tracking-tight text-accent-500">WB</span>
        <span className="hidden text-xs font-semibold tracking-[0.2em] text-ivory-100 uppercase sm:block">
          Workbench 48–78
        </span>
      </div>

      <div className="mx-2 h-5 w-px bg-graphite-700/70" aria-hidden />

      {build ? (
        editingName ? (
          <form
            className="min-w-0"
            onSubmit={(e) => {
              e.preventDefault();
              renameBuild(draftName);
              setEditingName(false);
            }}
          >
            <input
              className="input-base w-48"
              value={draftName}
              autoFocus
              aria-label="Build name"
              onBlur={() => {
                renameBuild(draftName);
                setEditingName(false);
              }}
              onChange={(e) => setDraftName(e.target.value)}
            />
          </form>
        ) : (
          <button
            className="truncate text-sm font-medium text-ivory-100 hover:text-accent-400"
            title="Rename build"
            onClick={() => {
              setDraftName(build.name);
              setEditingName(true);
            }}
          >
            {build.name}
          </button>
        )
      ) : (
        <span className="text-sm text-graphite-400">No build open</span>
      )}

      {build && <SaveStatusBadge />}

      <div className="flex-1" />

      <div className="flex items-center gap-1" role="group" aria-label="Workspace mode">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`btn ${mode === m.id ? 'btn-on' : ''}`}
            aria-pressed={mode === m.id}
            disabled={!build}
            onClick={() => setMode(m.id)}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="mx-1 h-5 w-px bg-graphite-700/70" aria-hidden />

      <button
        className="btn"
        onClick={undo}
        disabled={!canUndo}
        aria-label="Undo"
        title="Undo (Ctrl+Z)"
      >
        ⟲
      </button>
      <button
        className="btn"
        onClick={redo}
        disabled={!canRedo}
        aria-label="Redo"
        title="Redo (Ctrl+Shift+Z)"
      >
        ⟳
      </button>
      <button
        className="btn"
        disabled={!build}
        title="Reset build to factory stock (undoable)"
        onClick={() => {
          resetToStock();
          toast('info', 'Build reset to stock. Undo to go back.');
        }}
      >
        Reset
      </button>

      <div className="mx-1 h-5 w-px bg-graphite-700/70" aria-hidden />

      <button className="btn" disabled={!build} onClick={() => openDialog({ kind: 'import' })}>
        Import
      </button>
      <button className="btn" onClick={() => openDialog({ kind: 'share' })}>
        Share
      </button>
      <ExportMenu />

      <button
        className="btn-ghost lg:hidden"
        aria-label={rightPanelOpen ? 'Hide configurator' : 'Show configurator'}
        onClick={() => setRightPanelOpen(!rightPanelOpen)}
      >
        ⚙
      </button>
    </header>
  );
}
