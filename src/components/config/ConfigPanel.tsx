import { useBuildStore } from '@/state/buildStore';
import { useUiStore, type ConfigTab } from '@/state/uiStore';
import { BuildTab } from './BuildTab';
import { PaintTab } from './PaintTab';
import { WheelsTab } from './WheelsTab';
import { StanceTab } from './StanceTab';
import { ComponentsTab } from './ComponentsTab';
import { TitanforgeTab } from './TitanforgeTab';

const TABS: { id: ConfigTab; label: string }[] = [
  { id: 'build', label: 'Build' },
  { id: 'paint', label: 'Paint' },
  { id: 'wheels', label: 'Wheels' },
  { id: 'stance', label: 'Stance' },
  { id: 'components', label: 'Parts' },
  { id: 'titanforge', label: 'Titanforge' },
];

export function ConfigPanel() {
  const activeTab = useUiStore((s) => s.activeTab);
  const setActiveTab = useUiStore((s) => s.setActiveTab);
  const hasBuild = useBuildStore((s) => s.build !== null);

  return (
    <div className="flex h-full flex-col">
      <div
        role="tablist"
        aria-label="Configurator sections"
        className="flex flex-wrap border-b border-graphite-700/60"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            className={`px-2.5 py-2 text-[11px] font-medium tracking-wide uppercase transition-colors ${
              activeTab === t.id
                ? 'border-b-2 border-accent-500 text-accent-400'
                : 'text-graphite-400 hover:text-ivory-200'
            }`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3" role="tabpanel">
        {activeTab === 'build' && <BuildTab />}
        {!hasBuild && activeTab !== 'build' ? (
          <p className="p-3 text-xs text-graphite-400">
            Open a vehicle from the library first — configuration tools activate once a build
            exists.
          </p>
        ) : (
          <>
            {activeTab === 'paint' && <PaintTab />}
            {activeTab === 'wheels' && <WheelsTab />}
            {activeTab === 'stance' && <StanceTab />}
            {activeTab === 'components' && <ComponentsTab />}
            {activeTab === 'titanforge' && <TitanforgeTab />}
          </>
        )}
      </div>
    </div>
  );
}
