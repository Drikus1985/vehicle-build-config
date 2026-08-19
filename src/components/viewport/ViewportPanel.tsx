import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react';
import { getManifestForVehicle, getVehicle } from '@/lib/catalog';
import { repositories } from '@/lib/persistence/idb';
import type { BuildSummary } from '@/lib/persistence/repositories';
import type { Build } from '@/lib/schemas';
import { useBuildStore } from '@/state/buildStore';
import { useUiStore, type BackgroundId, type EnvironmentId } from '@/state/uiStore';
import { getViewportApi } from '@/three/viewportApi';

// Heavy three.js code loads only when a vehicle with an asset is opened.
const ViewportScene = lazy(() =>
  import('@/three/ViewportScene').then((m) => ({ default: m.ViewportScene })),
);
const CompareViewportScene = lazy(() =>
  import('@/three/ViewportScene').then((m) => ({ default: m.CompareViewportScene })),
);
const LoadingOverlay = lazy(() => import('./LoadingOverlay'));

class ViewerErrorBoundary extends Component<
  { children: ReactNode; onRetry: () => void },
  { error: string | null }
> {
  state = { error: null as string | null };
  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : 'Unknown rendering error' };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
          <span className="text-2xl" aria-hidden>
            ⚠
          </span>
          <p className="max-w-sm text-sm text-ivory-200">
            The 3D viewer hit a problem and stopped:{' '}
            <span className="text-danger-500">{this.state.error}</span>
          </p>
          <p className="max-w-sm text-xs text-graphite-400">
            Your build data is safe — rendering and configuration are separate. Try reloading the
            viewer. If the error mentions a failed fetch, the vehicle&apos;s asset file may not be
            installed (some licensed assets are not bundled — see the vehicle&apos;s Known
            limitations in the library). Otherwise your browser/GPU may not support WebGL 2.
          </p>
          <button
            className="btn-accent"
            onClick={() => {
              this.setState({ error: null });
              this.props.onRetry();
            }}
          >
            Reload viewer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const CAMERA_PRESETS: { id: string; label: string }[] = [
  { id: 'front', label: 'Front' },
  { id: 'rear', label: 'Rear' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'three-quarter', label: '¾ Front' },
  { id: 'three-quarter-rear', label: '¾ Rear' },
  { id: 'top', label: 'Top' },
  { id: 'detail-front-wheel', label: 'Wheel' },
  { id: 'detail-grille', label: 'Grille' },
];

function ViewportToolbar({
  containerRef,
  currentBuildId,
  savedBuilds,
}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
  currentBuildId: string | null;
  savedBuilds: BuildSummary[];
}) {
  const ui = useUiStore();
  const mode = ui.mode;
  const [showView, setShowView] = useState(false);

  const fullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  };

  return (
    <>
      {/* Camera presets */}
      <div className="absolute left-1/2 top-3 z-10 flex max-w-[90%] -translate-x-1/2 flex-wrap justify-center gap-1 rounded-lg border border-graphite-700/50 bg-graphite-950/70 p-1 backdrop-blur">
        {CAMERA_PRESETS.map((p) => (
          <button
            key={p.id}
            className="btn-ghost !px-2 !py-1 text-[11px]"
            onClick={() => getViewportApi()?.goToPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
        <button
          className="btn-ghost !px-2 !py-1 text-[11px]"
          title="Reset view"
          onClick={() => getViewportApi()?.resetView()}
        >
          Reset view
        </button>
      </div>

      {/* View controls */}
      <div className="absolute right-3 top-3 z-10 flex flex-col items-end gap-1">
        <div className="flex gap-1 rounded-lg border border-graphite-700/50 bg-graphite-950/70 p-1 backdrop-blur">
          <button
            className={`btn-ghost !px-2 !py-1 text-[11px] ${ui.turntable ? 'btn-on' : ''}`}
            aria-pressed={ui.turntable}
            title={
              ui.reducedMotion
                ? 'Turntable disabled by reduced motion preference'
                : 'Auto-rotate turntable'
            }
            disabled={ui.reducedMotion}
            onClick={() => ui.setTurntable(!ui.turntable)}
          >
            Turntable
          </button>
          <button
            className={`btn-ghost !px-2 !py-1 text-[11px] ${ui.ghostMode ? 'btn-on' : ''}`}
            aria-pressed={ui.ghostMode}
            title="Ghost / x-ray mode"
            onClick={() => ui.setGhostMode(!ui.ghostMode)}
          >
            X-ray
          </button>
          <button
            className={`btn-ghost !px-2 !py-1 text-[11px] ${showView ? 'btn-on' : ''}`}
            onClick={() => setShowView((v) => !v)}
            aria-expanded={showView}
          >
            Scene ▾
          </button>
          <button
            className="btn-ghost !px-2 !py-1 text-[11px]"
            onClick={fullscreen}
            title="Toggle fullscreen"
          >
            ⛶
          </button>
        </div>
        {showView && (
          <div className="panel z-20 flex w-56 flex-col gap-3 p-3">
            <div>
              <span className="field-label">Environment</span>
              <div className="flex gap-1">
                {(['studio', 'warehouse', 'night'] as EnvironmentId[]).map((e) => (
                  <button
                    key={e}
                    className={`btn flex-1 capitalize ${ui.environment === e ? 'btn-on' : ''}`}
                    onClick={() => ui.setEnvironment(e)}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="field-label">Background</span>
              <div className="flex gap-1">
                {(['graphite', 'paper', 'horizon'] as BackgroundId[]).map((b) => (
                  <button
                    key={b}
                    className={`btn flex-1 capitalize ${ui.background === b ? 'btn-on' : ''}`}
                    onClick={() => ui.setBackground(b)}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="field-label">Exploded view</span>
              <input
                type="range"
                className="range-base"
                min={0}
                max={1}
                step={0.01}
                value={ui.explodeFactor}
                aria-label="Exploded view amount"
                onChange={(e) => ui.setExplodeFactor(Number(e.target.value))}
              />
            </div>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={ui.showGrid}
                onChange={(e) => ui.setShowGrid(e.target.checked)}
              />
              Show ground grid
            </label>
            <label
              className="flex items-center gap-2 text-xs"
              title="Disables camera animation, damping and turntable"
            >
              <input
                type="checkbox"
                checked={ui.reducedMotion}
                onChange={(e) => ui.setReducedMotion(e.target.checked)}
              />
              Reduced motion
            </label>
          </div>
        )}
      </div>

      {/* Compare B-side picker (cameras stay synchronised across the split) */}
      {mode === 'compare' && (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-graphite-700/50 bg-graphite-950/80 p-1.5 backdrop-blur">
          <label className="flex items-center gap-2 text-[11px] text-graphite-400">
            Compare against
            <select
              className="input-base !w-auto !py-1 text-xs"
              value={ui.compareBuildId ?? ''}
              onChange={(e) => ui.setCompareBuildId(e.target.value || null)}
            >
              <option value="">Factory stock</option>
              {savedBuilds
                .filter((b) => b.id !== currentBuildId)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
            </select>
          </label>
        </div>
      )}

      {/* Isolation / annotation hints */}
      {(ui.isolatedComponentId || ui.placingAnnotation) && (
        <div className="absolute bottom-3 right-3 z-10 flex flex-col items-end gap-1">
          {ui.isolatedComponentId && (
            <button className="btn" onClick={() => ui.isolate(null)}>
              Exit isolation ✕
            </button>
          )}
          {ui.placingAnnotation && (
            <span className="panel px-2 py-1 text-[11px] text-accent-400">
              Click the model to place the annotation (Esc to cancel)
            </span>
          )}
        </div>
      )}
    </>
  );
}

/** The B pane of split-view compare — resolves its own vehicle + manifest. */
function ComparePane({ build, label }: { build: Build | null; label: string }) {
  const vehicle = build ? getVehicle(build.vehicleId) : undefined;
  const manifest = vehicle ? getManifestForVehicle(vehicle.id) : undefined;
  return (
    <div className="relative min-h-0">
      {build && manifest ? (
        <Suspense fallback={null}>
          <CompareViewportScene manifest={manifest} build={build} />
        </Suspense>
      ) : (
        <div className="flex h-full items-center justify-center p-6 text-center text-xs text-graphite-400">
          {build
            ? 'This build’s vehicle has no 3D asset — it cannot be shown here.'
            : 'Loading the comparison build…'}
        </div>
      )}
      {/* Bottom-right keeps clear of the centred camera bar and view controls. */}
      <span className="absolute bottom-3 right-3 z-10 rounded border border-graphite-700/50 bg-graphite-950/80 px-2 py-0.5 text-[11px] text-ivory-200 backdrop-blur">
        B · {label}
      </span>
    </div>
  );
}

export function ViewportPanel() {
  const build = useBuildStore((s) => s.build);
  const stockBuild = useBuildStore((s) => s.stockBuild);
  const compareBuildId = useUiStore((s) => s.compareBuildId);
  const mode = useUiStore((s) => s.mode);
  const containerRef = useRef<HTMLDivElement>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [savedBuilds, setSavedBuilds] = useState<BuildSummary[]>([]);
  const [loadedCompareBuild, setLoadedCompareBuild] = useState<Build | null>(null);

  // Saved builds feed the compare picker; refresh on entering compare mode.
  useEffect(() => {
    if (mode !== 'compare') return;
    void repositories.builds
      .list()
      .then(setSavedBuilds)
      .catch(() => setSavedBuilds([]));
  }, [mode]);

  // Load the picked B-side build (null id = factory stock, nothing to load).
  useEffect(() => {
    if (mode !== 'compare' || !compareBuildId) {
      setLoadedCompareBuild(null);
      return;
    }
    let live = true;
    void repositories.builds
      .get(compareBuildId)
      .then((b) => {
        if (live) setLoadedCompareBuild(b);
      })
      .catch(() => {
        if (live) setLoadedCompareBuild(null);
      });
    return () => {
      live = false;
    };
  }, [mode, compareBuildId]);

  const vehicle = build ? getVehicle(build.vehicleId) : undefined;
  const manifest = vehicle ? getManifestForVehicle(vehicle.id) : undefined;

  let content: ReactNode;
  if (!build || !vehicle) {
    content = (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <svg width="72" height="40" viewBox="0 0 72 40" aria-hidden className="opacity-40">
          <path
            d="M6 30c3-10 8-14 16-14h28c8 0 13 4 16 14"
            fill="none"
            stroke="#f59e0b"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <circle cx="20" cy="32" r="6" fill="none" stroke="#e7e4db" strokeWidth="2.5" />
          <circle cx="52" cy="32" r="6" fill="none" stroke="#e7e4db" strokeWidth="2.5" />
        </svg>
        <p className="text-sm text-ivory-200">No vehicle loaded</p>
        <p className="max-w-xs text-xs text-graphite-400">
          Pick a vehicle from the library on the left to start a build. The Titanforge TF-100 demo
          pickup is fully component-mapped.
        </p>
      </div>
    );
  } else if (!manifest) {
    content = (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="text-2xl" aria-hidden>
          ▢
        </span>
        <p className="text-sm text-ivory-200">
          No 3D asset for {vehicle.year} {vehicle.make} {vehicle.model}
        </p>
        <p className="max-w-sm text-xs text-graphite-400">
          This catalogue entry is metadata only. Component editing needs a mapped 3D asset with
          separately named meshes — see the vehicle card for its limitations.
        </p>
      </div>
    );
  } else {
    const primary = (
      <Suspense fallback={null}>
        <ViewportScene vehicle={vehicle} manifest={manifest} build={build} />
        <LoadingOverlay />
      </Suspense>
    );
    const compareBuild = compareBuildId ? loadedCompareBuild : stockBuild;
    const compareLabel = compareBuildId
      ? (loadedCompareBuild?.name ?? 'Loading…')
      : 'Factory stock';
    content = (
      <ViewerErrorBoundary key={retryKey} onRetry={() => setRetryKey((k) => k + 1)}>
        {mode === 'compare' ? (
          <div className="grid h-full grid-cols-1 grid-rows-2 md:grid-cols-2 md:grid-rows-1">
            <div className="relative min-h-0 border-graphite-700/60 max-md:border-b md:border-r">
              {primary}
              <span className="absolute left-3 top-14 z-10 rounded border border-graphite-700/50 bg-graphite-950/80 px-2 py-0.5 text-[11px] text-ivory-200 backdrop-blur md:top-3">
                A · {build.name}
              </span>
            </div>
            <ComparePane build={compareBuild} label={compareLabel} />
          </div>
        ) : (
          primary
        )}
        <ViewportToolbar
          containerRef={containerRef}
          currentBuildId={build.id}
          savedBuilds={savedBuilds}
        />
      </ViewerErrorBoundary>
    );
  }

  return (
    <div ref={containerRef} className="relative min-h-0 flex-1 bg-graphite-950">
      {content}
    </div>
  );
}
