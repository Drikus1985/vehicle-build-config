import { useEffect, useState } from 'react';
import { getVehicle } from '@/lib/catalog';
import { startAutosave } from '@/lib/persistence/autosave';
import { repositories } from '@/lib/persistence/idb';
import { restoreBuild, useBuildStore } from '@/state/buildStore';
import { useUiStore } from '@/state/uiStore';
import { TopBar } from '@/components/TopBar';
import { VehicleLibrary } from '@/components/library/VehicleLibrary';
import { ConfigPanel } from '@/components/config/ConfigPanel';
import { ViewportPanel } from '@/components/viewport/ViewportPanel';
import { BottomTray } from '@/components/BottomTray';
import { Toasts } from '@/components/Toasts';
import { Dialogs } from '@/components/dialogs/Dialogs';

export default function App() {
  const build = useBuildStore((s) => s.build);
  const undo = useBuildStore((s) => s.undo);
  const redo = useBuildStore((s) => s.redo);
  const leftPanelOpen = useUiStore((s) => s.leftPanelOpen);
  const rightPanelOpen = useUiStore((s) => s.rightPanelOpen);
  const [booted, setBooted] = useState(false);

  // Restore the last-open build, then begin autosaving.
  useEffect(() => {
    let stop: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      try {
        const currentId = await repositories.builds.getCurrentBuildId();
        if (currentId) {
          const saved = await repositories.builds.get(currentId);
          const vehicle = saved ? getVehicle(saved.vehicleId) : undefined;
          if (saved && vehicle && !cancelled) restoreBuild(saved, vehicle);
        }
      } catch (err) {
        console.error('Failed to restore last build', err);
        useUiStore
          .getState()
          .toast('error', 'Could not restore your last build from local storage.');
      } finally {
        if (!cancelled) {
          setBooted(true);
          stop = startAutosave();
        }
      }
    })();
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  // Global keyboard shortcuts.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        (mod && e.key.toLowerCase() === 'z' && e.shiftKey) ||
        (mod && e.key.toLowerCase() === 'y')
      ) {
        e.preventDefault();
        redo();
      } else if (e.key === 'Escape') {
        const ui = useUiStore.getState();
        if (ui.dialog.kind !== 'none') ui.closeDialog();
        else if (ui.placingAnnotation) ui.setPlacingAnnotation(false);
        else if (ui.isolatedComponentId) ui.isolate(null);
        else ui.select(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <TopBar />
      <div className="relative flex min-h-0 flex-1">
        {/* Left: vehicle library */}
        <aside
          aria-label="Vehicle library"
          className={`z-20 h-full w-72 shrink-0 border-r border-graphite-700/60 bg-graphite-900 transition-[margin] max-lg:absolute max-lg:left-0 max-lg:top-0 max-lg:shadow-2xl ${
            leftPanelOpen ? '' : 'max-lg:hidden lg:-ml-72'
          }`}
        >
          <VehicleLibrary />
        </aside>

        {/* Centre: viewport + tray */}
        <main className="flex min-w-0 flex-1 flex-col" aria-label="3D viewport">
          {booted ? <ViewportPanel /> : <div className="flex-1" />}
          {build && <BottomTray />}
        </main>

        {/* Right: configurator */}
        <aside
          aria-label="Configurator"
          className={`z-20 h-full w-80 shrink-0 border-l border-graphite-700/60 bg-graphite-900 transition-[margin] max-lg:absolute max-lg:right-0 max-lg:top-0 max-lg:shadow-2xl ${
            rightPanelOpen ? '' : 'max-lg:hidden lg:-mr-80'
          }`}
        >
          <ConfigPanel />
        </aside>
      </div>
      <Toasts />
      <Dialogs />
    </div>
  );
}
