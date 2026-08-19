import { useEffect, useRef, type ReactNode } from 'react';
import { useUiStore } from '@/state/uiStore';
import { VehicleChangeDialog } from './VehicleChangeDialog';
import { ShareDialog } from './ShareDialog';
import { ImportDialog } from './ImportDialog';
import { SnapshotDialog } from './SnapshotDialog';
import { VehicleAuthoringDialog } from './VehicleAuthoringDialog';

export function DialogShell({ title, children }: { title: string; children: ReactNode }) {
  const closeDialog = useUiStore((s) => s.closeDialog);
  const ref = useRef<HTMLDivElement>(null);

  // Rudimentary focus trap entry: focus the dialog when it opens.
  useEffect(() => {
    ref.current?.focus();
  }, []);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-graphite-950/70 p-4 backdrop-blur-sm"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) closeDialog();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="panel max-h-[85vh] w-full max-w-lg overflow-y-auto p-4 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ivory-100">{title}</h2>
          <button className="btn-ghost" aria-label="Close dialog" onClick={closeDialog}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Dialogs() {
  const dialog = useUiStore((s) => s.dialog);
  switch (dialog.kind) {
    case 'vehicle-change':
      return <VehicleChangeDialog targetVehicleId={dialog.targetVehicleId} />;
    case 'share':
      return <ShareDialog />;
    case 'import':
      return <ImportDialog />;
    case 'vehicle-authoring':
      return <VehicleAuthoringDialog assetId={dialog.assetId} />;
    case 'snapshot':
      return <SnapshotDialog />;
    default:
      return null;
  }
}
