import { useUiStore } from '@/state/uiStore';

const KIND_STYLES = {
  info: 'border-graphite-600 text-ivory-200',
  success: 'border-ok-500/60 text-ok-500',
  warning: 'border-warn-500/60 text-warn-500',
  error: 'border-danger-500/60 text-danger-500',
};

export function Toasts() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);
  if (toasts.length === 0) return null;
  return (
    <div
      className="pointer-events-none fixed bottom-4 left-1/2 z-50 flex w-full max-w-sm -translate-x-1/2 flex-col gap-2 px-4"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`panel pointer-events-auto flex items-start gap-2 p-2.5 text-xs shadow-xl ${KIND_STYLES[t.kind]}`}
        >
          <span className="flex-1">{t.message}</span>
          <button
            className="text-graphite-400 hover:text-ivory-100"
            aria-label="Dismiss notification"
            onClick={() => dismiss(t.id)}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
