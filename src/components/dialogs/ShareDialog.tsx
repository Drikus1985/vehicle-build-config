import { downloadFile, serializeBuild } from '@/lib/export/buildFile';
import { useBuildStore } from '@/state/buildStore';
import { useUiStore } from '@/state/uiStore';
import { DialogShell } from './Dialogs';

export function ShareDialog() {
  const build = useBuildStore((s) => s.build);
  const toast = useUiStore((s) => s.toast);
  const closeDialog = useUiStore((s) => s.closeDialog);

  return (
    <DialogShell title="Share this build">
      <div className="flex flex-col gap-3 text-xs leading-relaxed text-graphite-300">
        <p>
          <strong className="text-ivory-100">Public share links are not available.</strong> This app
          currently stores builds locally in your browser (IndexedDB) and has no server backend, so
          a URL would not reproduce your build for someone else. We won&apos;t pretend otherwise.
        </p>
        <p>What works today:</p>
        <ul className="list-disc pl-4">
          <li>
            <strong className="text-ivory-100">Export a build file</strong> — a versioned JSON your
            recipient imports via the Build tab to get the exact same configuration.
          </li>
          <li>
            <strong className="text-ivory-100">Export a snapshot</strong> — a PNG of the current
            viewport (Export menu).
          </li>
          <li>
            <strong className="text-ivory-100">Printable summary</strong> — a spec sheet of parts,
            paint, wheels and Titanforge items.
          </li>
        </ul>
        <p className="text-[11px] text-graphite-400">
          When a persisted backend is connected (see <code>.env.example</code> and the repository
          interfaces in <code>src/lib/persistence</code>), real share links can be enabled here.
        </p>
        <div className="flex justify-end gap-2">
          <button className="btn" onClick={closeDialog}>
            Close
          </button>
          <button
            className="btn-accent"
            disabled={!build}
            onClick={() => {
              if (!build) return;
              downloadFile(
                `${build.name.replace(/\s+/g, '-').toLowerCase()}.build.json`,
                serializeBuild(build),
              );
              toast('success', 'Build file exported — send it to your collaborator.');
            }}
          >
            Export build file
          </button>
        </div>
      </div>
    </DialogShell>
  );
}
