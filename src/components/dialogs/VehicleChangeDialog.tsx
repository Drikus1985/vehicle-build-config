import { useMemo } from 'react';
import { getPart, getVehicle } from '@/lib/catalog';
import { analyzeVehicleChange } from '@/lib/fitment/compat';
import { useBuildStore } from '@/state/buildStore';
import { useUiStore } from '@/state/uiStore';
import { DialogShell } from './Dialogs';

export function VehicleChangeDialog({ targetVehicleId }: { targetVehicleId: string }) {
  const build = useBuildStore((s) => s.build);
  const newBuildForVehicle = useBuildStore((s) => s.newBuildForVehicle);
  const closeDialog = useUiStore((s) => s.closeDialog);
  const toast = useUiStore((s) => s.toast);

  const target = getVehicle(targetVehicleId);
  const issues = useMemo(
    () => (build && target ? analyzeVehicleChange(build, target) : []),
    [build, target],
  );

  if (!target) return null;

  const proceed = () => {
    // Changing base vehicle starts a fresh stock build for the target;
    // incompatible installed parts are dropped (that is what we warn about).
    newBuildForVehicle(target);
    useUiStore.getState().select(null);
    useUiStore.getState().isolate(null);
    closeDialog();
    toast(
      'success',
      `Switched to the ${target.year} ${target.make} ${target.model}. Your previous build stays in Saved builds.`,
    );
  };

  return (
    <DialogShell title="Change base vehicle?">
      <p className="text-xs leading-relaxed text-graphite-300">
        You are switching to the{' '}
        <strong className="text-ivory-100">
          {target.year} {target.make} {target.model}
        </strong>
        . Your current build remains saved and can be reopened from the Build tab. A new stock build
        will be started for the target vehicle.
      </p>

      {issues.length > 0 ? (
        <div className="mt-3 rounded border border-warn-500/40 bg-warn-500/5 p-2.5">
          <p className="text-[11px] font-semibold text-warn-500">
            {issues.length} installed part{issues.length === 1 ? ' is' : 's are'} incompatible with
            the target vehicle and cannot be carried over:
          </p>
          <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-4 text-[11px] text-graphite-300">
            {issues.map((i) => (
              <li key={i.partId}>
                <strong>{getPart(i.partId)?.name ?? i.partId}</strong> — {i.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-graphite-400">
          {target.assetManifestId
            ? 'Parts are not carried across vehicles in this MVP; the new build starts from factory stock.'
            : 'The target vehicle has no 3D asset — you will get a metadata-only view.'}
        </p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button className="btn" onClick={closeDialog}>
          Cancel
        </button>
        <button className="btn-accent" onClick={proceed}>
          {issues.length > 0 ? 'Switch and drop incompatible parts' : 'Switch vehicle'}
        </button>
      </div>
    </DialogShell>
  );
}
