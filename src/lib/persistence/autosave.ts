import { useBuildStore } from '@/state/buildStore';
import { useUiStore } from '@/state/uiStore';
import { repositories } from './idb';

const DEBOUNCE_MS = 900;

/**
 * Starts autosave: any build change (dirtyCounter bump) schedules a debounced
 * save with visible status in the top bar. Returns a stop function.
 */
export function startAutosave(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastSavedCounter = useBuildStore.getState().dirtyCounter;

  const flush = async () => {
    const { build, dirtyCounter } = useBuildStore.getState();
    if (!build) return;
    const ui = useUiStore.getState();
    ui.setSaveStatus('saving');
    try {
      await repositories.builds.save(build);
      await repositories.builds.setCurrentBuildId(build.id);
      lastSavedCounter = dirtyCounter;
      useUiStore.getState().setSaveStatus('saved');
    } catch {
      useUiStore.getState().setSaveStatus('error');
      useUiStore.getState().toast('error', 'Autosave failed — your latest change is not stored.');
    }
  };

  const unsubscribe = useBuildStore.subscribe((state) => {
    if (state.dirtyCounter === lastSavedCounter || !state.build) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void flush(), DEBOUNCE_MS);
  });

  // Best-effort flush when the tab is being closed/hidden.
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') void flush();
  };
  document.addEventListener('visibilitychange', onVisibility);

  return () => {
    unsubscribe();
    document.removeEventListener('visibilitychange', onVisibility);
    if (timer) clearTimeout(timer);
  };
}
