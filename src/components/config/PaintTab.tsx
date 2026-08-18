import { useEffect, useState } from 'react';
import { FACTORY_PALETTES, getManifestForVehicle } from '@/lib/catalog';
import { repositories } from '@/lib/persistence/idb';
import type { SavedColor } from '@/lib/persistence/repositories';
import {
  resetPaintToStock,
  setGlassTint,
  setLivery,
  setPaintZone,
  setPlateSetup,
  setStripes,
  toggleLiveryAnchor,
} from '@/state/buildActions';
import { PLATE_STYLES, PLATE_TEXT_MAX } from '@/lib/plates';
import { STRIPE_COLORS, STRIPE_STYLES } from '@/lib/stripes';
import { LIVERY_COLORS, LIVERY_NUMBER_MAX, LIVERY_TEXT_MAX } from '@/lib/livery';
import { useLiveryAssetStatus } from '@/three/liveryAsset';
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

function LiveryColorRow({
  label,
  value,
  onPick,
}: {
  label: string;
  value: string;
  onPick: (hex: string) => void;
}) {
  return (
    <div className="mt-1.5 flex items-center gap-1.5">
      <span className="w-20 text-[11px] text-graphite-300">{label}</span>
      {LIVERY_COLORS.map((c) => (
        <button
          key={c.hex}
          className={`h-5 w-5 rounded-full border-2 transition-transform hover:scale-110 ${
            value.toLowerCase() === c.hex.toLowerCase()
              ? 'border-accent-500'
              : 'border-graphite-600/60'
          }`}
          style={{ background: c.hex }}
          title={c.name}
          aria-label={`${label} colour ${c.name}`}
          onClick={() => onPick(c.hex)}
        />
      ))}
      <input
        type="color"
        className="h-5 w-7 cursor-pointer rounded border border-graphite-600 bg-graphite-850"
        value={value}
        aria-label={`Custom ${label.toLowerCase()} colour`}
        onChange={(e) => onPick(e.target.value)}
      />
    </div>
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

  const manifest = (build ? getManifestForVehicle(build.vehicleId) : null) ?? null;
  // null while the (fast) check for the UV-mapped livery asset is running.
  const liveryReady = useLiveryAssetStatus(manifest);

  if (!build) return null;
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

      {manifest.stripeZones.length > 0 && (
        <div>
          <span className="field-label">Racing stripes</span>
          <div className="flex flex-wrap gap-1">
            {STRIPE_STYLES.map((style) => (
              <button
                key={style.id}
                className={`btn !py-1 ${build.stripes.styleId === style.id ? 'btn-on' : ''}`}
                aria-pressed={build.stripes.styleId === style.id}
                title={style.description}
                onClick={() => setStripes({ styleId: style.id })}
              >
                {style.label}
              </button>
            ))}
          </div>
          {build.stripes.styleId !== 'none' && (
            <>
              <div className="mt-1.5 flex items-center gap-1.5">
                {STRIPE_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    className={`h-6 w-6 rounded-full border-2 transition-transform hover:scale-110 ${
                      build.stripes.colorHex.toLowerCase() === c.hex.toLowerCase()
                        ? 'border-accent-500'
                        : 'border-graphite-600/60'
                    }`}
                    style={{ background: c.hex }}
                    title={c.name}
                    aria-label={`Stripe colour ${c.name}`}
                    onClick={() => setStripes({ colorHex: c.hex })}
                  />
                ))}
                <input
                  type="color"
                  className="h-6 w-8 cursor-pointer rounded border border-graphite-600 bg-graphite-850"
                  value={build.stripes.colorHex}
                  aria-label="Custom stripe colour"
                  onChange={(e) => setStripes({ colorHex: e.target.value })}
                />
              </div>
              <label className="mt-1.5 block">
                <span className="flex justify-between text-[11px] text-graphite-300">
                  Stripe width
                  <span className="font-mono text-graphite-400">
                    {Math.round(build.stripes.widthScale * 100)}%
                  </span>
                </span>
                <input
                  type="range"
                  className="range-base"
                  min={0.5}
                  max={1.5}
                  step={0.05}
                  value={build.stripes.widthScale}
                  onChange={(e) => setStripes({ widthScale: Number(e.target.value) })}
                />
              </label>
            </>
          )}
          <p className="mt-1 text-[10px] text-graphite-400">
            Painted in the shader over the body and hood zones — follows scoops and panels, no decal
            file needed.
          </p>
        </div>
      )}

      {manifest.liveryAnchors.length > 0 && (
        <div>
          <span className="field-label">Livery</span>
          {liveryReady === false ? (
            <p className="text-[10px] text-graphite-400">
              Liveries draw onto the UV-mapped asset, which is not installed. Convert the
              seller&apos;s UV package with{' '}
              <code>node scripts/convert-nova-uv-to-glb.mjs &lt;dir&gt;</code> and place{' '}
              <code>nova-1970-uv.glb</code> next to the base model (see README) to enable them.
            </p>
          ) : (
            <>
              <div className="mt-1 flex items-end gap-2">
                <label className="block">
                  <span className="text-[11px] text-graphite-300">Racing number</span>
                  <input
                    className="input-base w-20 font-mono tracking-widest uppercase"
                    value={build.livery.roundels.number}
                    maxLength={LIVERY_NUMBER_MAX}
                    placeholder="11"
                    aria-label="Roundel racing number"
                    onChange={(e) => setLivery({ roundels: { number: e.target.value } })}
                  />
                </label>
                <div className="flex flex-wrap gap-1">
                  {manifest.liveryAnchors
                    .filter((a) => a.kind === 'roundel')
                    .map((a) => (
                      <button
                        key={a.id}
                        className={`btn !py-1 ${
                          build.livery.roundels.anchorIds.includes(a.id) ? 'btn-on' : ''
                        }`}
                        aria-pressed={build.livery.roundels.anchorIds.includes(a.id)}
                        onClick={() => toggleLiveryAnchor('roundels', a.id)}
                      >
                        {a.label}
                      </button>
                    ))}
                </div>
              </div>
              {build.livery.roundels.anchorIds.length > 0 && (
                <>
                  <LiveryColorRow
                    label="Disc"
                    value={build.livery.roundels.discHex}
                    onPick={(hex) => setLivery({ roundels: { discHex: hex } })}
                  />
                  <LiveryColorRow
                    label="Ring & number"
                    value={build.livery.roundels.ringHex}
                    onPick={(hex) => setLivery({ roundels: { ringHex: hex } })}
                  />
                  <label className="mt-1.5 block">
                    <span className="flex justify-between text-[11px] text-graphite-300">
                      Roundel size
                      <span className="font-mono text-graphite-400">
                        {Math.round(build.livery.roundels.sizeScale * 100)}%
                      </span>
                    </span>
                    <input
                      type="range"
                      className="range-base"
                      min={0.6}
                      max={1.3}
                      step={0.05}
                      value={build.livery.roundels.sizeScale}
                      onChange={(e) =>
                        setLivery({ roundels: { sizeScale: Number(e.target.value) } })
                      }
                    />
                  </label>
                </>
              )}
              <div className="mt-2">
                <label className="block">
                  <span className="text-[11px] text-graphite-300">Lettering</span>
                  <input
                    className="input-base"
                    value={build.livery.lettering.text}
                    maxLength={LIVERY_TEXT_MAX}
                    placeholder="TEAM OR SPONSOR"
                    aria-label="Livery lettering text"
                    onChange={(e) => setLivery({ lettering: { text: e.target.value } })}
                  />
                </label>
                <div className="mt-1 flex flex-wrap gap-1">
                  {manifest.liveryAnchors
                    .filter((a) => a.kind === 'lettering')
                    .map((a) => (
                      <button
                        key={a.id}
                        className={`btn !py-1 ${
                          build.livery.lettering.anchorIds.includes(a.id) ? 'btn-on' : ''
                        }`}
                        aria-pressed={build.livery.lettering.anchorIds.includes(a.id)}
                        onClick={() => toggleLiveryAnchor('lettering', a.id)}
                      >
                        {a.label}
                      </button>
                    ))}
                </div>
                {build.livery.lettering.anchorIds.length > 0 && (
                  <>
                    <LiveryColorRow
                      label="Lettering"
                      value={build.livery.lettering.colorHex}
                      onPick={(hex) => setLivery({ lettering: { colorHex: hex } })}
                    />
                    <label className="mt-1.5 block">
                      <span className="flex justify-between text-[11px] text-graphite-300">
                        Lettering size
                        <span className="font-mono text-graphite-400">
                          {Math.round(build.livery.lettering.sizeScale * 100)}%
                        </span>
                      </span>
                      <input
                        type="range"
                        className="range-base"
                        min={0.6}
                        max={1.3}
                        step={0.05}
                        value={build.livery.lettering.sizeScale}
                        onChange={(e) =>
                          setLivery({ lettering: { sizeScale: Number(e.target.value) } })
                        }
                      />
                    </label>
                  </>
                )}
              </div>
              <p className="mt-1 text-[10px] text-graphite-400">
                Roundels and lettering are drawn onto the vehicle&apos;s UV atlas at measured panel
                anchors — they follow the doors, hood, roof and quarters exactly.
              </p>
            </>
          )}
        </div>
      )}

      {manifest.plateMounts.length > 0 && (
        <div>
          <span className="field-label">Numberplate</span>
          <input
            className="input-base font-mono tracking-widest uppercase"
            value={build.plateSetup.text}
            maxLength={PLATE_TEXT_MAX}
            placeholder="PLATE TEXT"
            aria-label="Numberplate text"
            onChange={(e) => setPlateSetup({ text: e.target.value })}
          />
          <div className="mt-1.5 flex flex-wrap gap-1">
            {PLATE_STYLES.map((style) => (
              <button
                key={style.id}
                className={`btn !py-1 ${build.plateSetup.styleId === style.id ? 'btn-on' : ''}`}
                aria-pressed={build.plateSetup.styleId === style.id}
                onClick={() => setPlateSetup({ styleId: style.id })}
              >
                <span
                  className="h-3 w-5 rounded-sm border"
                  style={{ background: style.background, borderColor: style.text }}
                  aria-hidden
                />
                {style.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-[10px] text-graphite-400">
            Decorative display plate (front &amp; rear) — generic colourways, not an official plate
            design. Remove via the "Licence plates" part.
          </p>
        </div>
      )}

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
