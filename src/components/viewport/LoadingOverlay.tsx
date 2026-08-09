import { useProgress } from '@react-three/drei';

/** Asset-loading progress overlay; lazy-loaded with the rest of the 3D code. */
export default function LoadingOverlay() {
  const { active, progress } = useProgress();
  if (!active) return null;
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-graphite-950/60">
      <div className="panel flex w-56 flex-col gap-2 p-4" role="status" aria-live="polite">
        <span className="text-xs text-ivory-200">Loading vehicle asset…</span>
        <div className="h-1.5 overflow-hidden rounded bg-graphite-700">
          <div
            className="h-full bg-accent-500 transition-[width]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-[10px] text-graphite-400">{Math.round(progress)}%</span>
      </div>
    </div>
  );
}
