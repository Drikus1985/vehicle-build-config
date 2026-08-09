import { useEffect, useState } from 'react';
import { FACTORY_PALETTES, getManifestForVehicle } from '@/lib/catalog';
import { repositories } from '@/lib/persistence/idb';
import type { SavedColor } from '@/lib/persistence/repositories';
import { resetPaintToStock, setGlassTint, setPaintZone } from '@/state/buildActions';
import { useBuildStore } from '@/state/buildStore';
import { useUiStore } from '@/state/uiStore';

function FinishSlider({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex justify-between text-[11px] text-graphite-300">
        {label}
        <span className="font-mono text-graphite-400">{Math.round(value * 100)}%</span>
      </span>
      <input
        type="range"
        className="range-base"
        min={min}
        max={max}
        step={0.01}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

export function PaintTab() {
  const build = useBuildStore((s) => s.build);
  const toast = useUiStore((s) => s.toast);
  const setMode = useUiStore((s) => s.setMode);
  const [zoneId, setZoneId] = useState('body');
  const [savedColors, setSavedColors] = useState<SavedColor[]>([]);

  useEffect(() => {
    void repositories.settings
      .getSavedColors()
      .then(setSavedColors)
      .catch(() => {});
  }, []);

  if (!build) return null;
  const manifest = getManifestForVehicle(build.vehicleId);
  if (!manifest) {
    return <p className="text-xs text-graphite-400">Paint requires a vehicle with a 3D asset.</p>;
  }
  const zones = manifest.materialZones.filter((z) => z.paintable && build.paint[z.id]);
  const activeZone = zones.find((z) => z.id === zoneId) ?? zones[0];
  if (!activeZone)
    return <p className="text-xs text-graphite-400">This asset exposes no paintable zones.</p>;
  const setting = build.paint[activeZone.id]!;

  const saveCurrentColor = async () => {
    const color: SavedColor = {
      hex: setting.colorHex,
      name: setting.colorHex,
      savedAt: new Date().toISOString(),
    };
    await repositories.settings.addSavedColor(color);
    setSavedColors(await repositories.settings.getSavedColors());
    toast('success', `Saved ${setting.colorHex} to your colours.`);
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <span className="field-label">Material zone</span>
        <div className="flex flex-wrap gap-1">
          {zones.map((z) => (
            <button
              key={z.id}
              className={`btn !py-1 ${activeZone.id === z.id ? 'btn-on' : ''}`}
              aria-pressed={activeZone.id === z.id}
              onClick={() => setZoneId(z.id)}
            >
              <span
                className="h-3 w-3 rounded-full border border-graphite-600"
                style={{ background: build.paint[z.id]?.colorHex }}
                aria-hidden
              />
              {z.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-graphite-400">
          Zones come from the asset manifest; chrome, glass and lights are fixed-finish zones on
          this vehicle.
        </p>
      </div>

      {FACTORY_PALETTES.map((palette) => (
        <div key={palette.id}>
          <span className="field-label">{palette.label}</span>
          <div className="flex flex-wrap gap-1.5">
            {palette.colors.map((c) => (
              <button
                key={c.id}
                className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
                  setting.colorHex.toLowerCase() === c.hex.toLowerCase()
                    ? 'border-accent-500'
                    : 'border-graphite-600/60'
                }`}
                style={{ background: c.hex }}
                title={`${c.name} (${c.era})`}
                aria-label={`${palette.label}: ${c.name}`}
                onClick={() => setPaintZone(activeZone.id, { colorHex: c.hex })}
              />
            ))}
          </div>
        </div>
      ))}

      <div className="flex items-end gap-2">
        <label className="block flex-1">
          <span className="field-label">Custom colour</span>
          <input
            type="color"
            className="h-8 w-full cursor-pointer rounded border border-graphite-600 bg-graphite-850"
            value={setting.colorHex}
            aria-label={`Custom colour for ${activeZone.label}`}
            onChange={(e) => setPaintZone(activeZone.id, { colorHex: e.target.value })}
          />
        </label>
        <button className="btn" onClick={() => void saveCurrentColor()}>
          Save colour
        </button>
      </div>

      {savedColors.length > 0 && (
        <div>
          <span className="field-label">Saved colours</span>
          <div className="flex flex-wrap gap-1.5">
            {savedColors.map((c) => (
              <span key={c.hex} className="relative">
                <button
                  className="h-7 w-7 rounded-full border-2 border-graphite-600/60 hover:scale-110"
                  style={{ background: c.hex }}
                  title={c.hex}
                  aria-label={`Apply saved colour ${c.hex}`}
                  onClick={() => setPaintZone(activeZone.id, { colorHex: c.hex })}
                />
                <button
                  className="absolute -top-1 -right-1 hidden h-3.5 w-3.5 items-center justify-center rounded-full bg-graphite-700 text-[8px] leading-none hover:flex"
                  aria-label={`Forget saved colour ${c.hex}`}
                  onClick={async () => {
                    await repositories.settings.removeSavedColor(c.hex);
                    setSavedColors(await repositories.settings.getSavedColors());
                  }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="field-label">Finish — {activeZone.label}</span>
        <FinishSlider
          label="Metallic"
          value={setting.metallic}
          min={0}
          max={1}
          onChange={(v) => setPaintZone(activeZone.id, { metallic: v })}
        />
        <FinishSlider
          label="Roughness"
          value={setting.roughness}
          min={0.02}
          max={1}
          onChange={(v) => setPaintZone(activeZone.id, { roughness: v })}
        />
        <FinishSlider
          label="Clear coat"
          value={setting.clearcoat}
          min={0}
          max={1}
          onChange={(v) => setPaintZone(activeZone.id, { clearcoat: v })}
        />
      </div>

      <div>
        <FinishSlider
          label="Glass tint"
          value={build.glassTint}
          min={0}
          max={0.85}
          onChange={setGlassTint}
        />
      </div>

      <div className="flex gap-2">
        <button className="btn flex-1" onClick={resetPaintToStock}>
          Reset paint to stock
        </button>
        <button
          className="btn flex-1"
          title="Opens Compare mode to toggle this build against factory stock"
          onClick={() => setMode('compare')}
        >
          Before / after
        </button>
      </div>
    </div>
  );
}
