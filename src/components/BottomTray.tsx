import { getPart, getVariant, getVariantsForPart } from '@/lib/catalog';
import { statusMeta } from '@/lib/titanforge';
import { setPartHidden, setPartRemoved, setPartVariant } from '@/state/buildActions';
import { useBuildStore } from '@/state/buildStore';
import { useUiStore } from '@/state/uiStore';

export function BottomTray() {
  const build = useBuildStore((s) => s.build);
  const past = useBuildStore((s) => s.past.length);
  const future = useBuildStore((s) => s.future.length);
  const trayOpen = useUiStore((s) => s.trayOpen);
  const setTrayOpen = useUiStore((s) => s.setTrayOpen);
  const selectedComponentId = useUiStore((s) => s.selectedComponentId);
  const isolate = useUiStore((s) => s.isolate);
  const isolatedComponentId = useUiStore((s) => s.isolatedComponentId);
  const mode = useUiStore((s) => s.mode);

  if (!build) return null;
  const part = selectedComponentId ? getPart(selectedComponentId) : undefined;
  const installed = part ? build.installed.find((p) => p.partId === part.id) : undefined;
  const variants = part ? getVariantsForPart(part.id) : [];
  const record = selectedComponentId ? build.fabricationRecords[selectedComponentId] : undefined;

  return (
    <div className="shrink-0 border-t border-graphite-700/60 bg-graphite-900">
      <div className="flex items-center justify-between px-3 py-1">
        <span className="text-[10px] tracking-wider text-graphite-400 uppercase">
          {part ? `Selected: ${part.name}` : 'Part tray'}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-graphite-400" title="Build history depth">
            History: {past} back · {future} forward
          </span>
          <button
            className="btn-ghost !py-0.5 text-[10px]"
            aria-expanded={trayOpen}
            onClick={() => setTrayOpen(!trayOpen)}
          >
            {trayOpen ? 'Collapse ▾' : 'Expand ▴'}
          </button>
        </div>
      </div>
      {trayOpen && (
        <div className="flex min-h-16 items-center gap-4 overflow-x-auto px-3 pb-2">
          {!part ? (
            <p className="text-xs text-graphite-400">
              Click a part in the viewport or the Parts tab to see its details and variants here.
            </p>
          ) : (
            <>
              <div className="min-w-40 shrink-0">
                <p className="text-xs font-semibold text-ivory-100">{part.name}</p>
                <p className="text-[10px] text-graphite-400">
                  {part.category} · {part.meshNodeIds.length} mesh node
                  {part.meshNodeIds.length === 1 ? '' : 's'}
                  {part.socketId ? ` · ${part.socketId}` : ''}
                </p>
                {record && record.status !== 'stock' && (
                  <span
                    className="chip mt-1"
                    style={{
                      borderColor: statusMeta(record.status).colorHex,
                      color: statusMeta(record.status).colorHex,
                    }}
                  >
                    {statusMeta(record.status).glyph} {statusMeta(record.status).label}
                  </span>
                )}
              </div>
              {variants.length > 0 && (
                <div
                  className="flex shrink-0 items-center gap-1.5"
                  role="group"
                  aria-label={`${part.name} variants`}
                >
                  {variants.map((v) => (
                    <button
                      key={v.id}
                      className={`btn ${installed?.variantId === v.id && !installed?.removed ? 'btn-on' : ''}`}
                      onClick={() => setPartVariant(part.id, v.id)}
                    >
                      {v.name}
                      {v.priceEstimateUsd ? (
                        <span className="text-[9px] text-graphite-400">
                          {' '}
                          ~${v.priceEstimateUsd}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  className={`btn ${isolatedComponentId === part.id ? 'btn-on' : ''}`}
                  onClick={() => isolate(isolatedComponentId === part.id ? null : part.id)}
                >
                  {isolatedComponentId === part.id ? 'Un-isolate' : 'Isolate'}
                </button>
                {!installed?.removed && (
                  <button
                    className="btn"
                    onClick={() => setPartHidden(part.id, !installed?.hidden)}
                  >
                    {installed?.hidden ? 'Show' : 'Hide'}
                  </button>
                )}
                {part.removable && (
                  <button
                    className="btn"
                    onClick={() => setPartRemoved(part.id, !installed?.removed)}
                  >
                    {installed?.removed ? 'Install' : 'Remove'}
                  </button>
                )}
              </div>
              {installed?.variantId && (
                <p className="min-w-40 text-[10px] leading-relaxed text-graphite-400">
                  Variant: {getVariant(installed.variantId)?.name}
                  {mode === 'fabrication'
                    ? ' · open its Titanforge record in the Titanforge tab.'
                    : ''}
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
