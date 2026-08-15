import {
  getManifestForVehicle,
  getOemWheelsetPart,
  getVehicle,
  getWheelVariants,
  hasActiveOemWheelset,
} from '@/lib/catalog';
import { checkAxleFitment, computeTyreSpec, diameterDeltaPct } from '@/lib/fitment/tyres';
import { STOCK_AXLE } from '@/lib/build/defaults';
import type { AxleSetup, TyreSetup } from '@/lib/schemas';
import { setAxleSetup, setPartRemoved, setTyre, setWheelsLinked } from '@/state/buildActions';
import { useBuildStore } from '@/state/buildStore';

/** Banner shown while a factory (in-model) wheel set suspends the parametric system. */
export function OemWheelsetNotice({ context }: { context: 'wheels' | 'stance' }) {
  const build = useBuildStore((s) => s.build);
  if (!build || !hasActiveOemWheelset(build)) return null;
  const vehicle = getVehicle(build.vehicleId);
  const oemPart = vehicle ? getOemWheelsetPart(vehicle) : undefined;
  return (
    <div className="panel border-accent-500/40 p-3">
      <p className="text-[11px] leading-relaxed text-graphite-300">
        <strong className="text-ivory-100">
          {oemPart?.name ?? 'Factory wheel set'} is installed.
        </strong>{' '}
        {context === 'wheels'
          ? 'The configurable wheel/tyre system is suspended so the two never overlap.'
          : 'Stance preview is suspended because the baked factory wheels cannot follow the stance rig.'}
      </p>
      {oemPart && (
        <button className="btn-accent mt-2 w-full" onClick={() => setPartRemoved(oemPart.id, true)}>
          Remove factory set &amp; use configurable wheels
        </button>
      )}
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="flex justify-between text-[11px] text-graphite-300">
        {label}
        <span className="font-mono text-graphite-400">
          {value}
          {unit}
        </span>
      </span>
      <input
        type="range"
        className="range-base"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function AxleEditor({ axle, setup }: { axle: 'front' | 'rear'; setup: AxleSetup }) {
  const wheelVariants = getWheelVariants();
  const spec = computeTyreSpec(setup.tyre);
  const stockSpec = computeTyreSpec(STOCK_AXLE.tyre);
  const delta = diameterDeltaPct(stockSpec.diameterMm, spec.diameterMm);

  const patchTyre = (patch: Partial<TyreSetup>) => setTyre(axle, patch);

  return (
    <div className="flex flex-col gap-2.5">
      <div>
        <span className="field-label">Wheel style</span>
        <div className="flex flex-wrap gap-1">
          {wheelVariants.map((v) => (
            <button
              key={v.id}
              className={`btn !py-1 ${setup.wheelVariantId === v.id ? 'btn-on' : ''}`}
              aria-pressed={setup.wheelVariantId === v.id}
              onClick={() => setAxleSetup(axle, { wheelVariantId: v.id })}
            >
              {v.name}
            </button>
          ))}
        </div>
      </div>
      <NumberField
        label="Wheel width"
        value={setup.wheelWidthIn}
        min={4}
        max={14}
        step={0.5}
        unit='"'
        onChange={(v) => setAxleSetup(axle, { wheelWidthIn: v })}
      />
      <NumberField
        label="Offset (ET)"
        value={setup.offsetMm}
        min={-75}
        max={60}
        step={1}
        unit=" mm"
        onChange={(v) => setAxleSetup(axle, { offsetMm: v })}
      />
      <NumberField
        label="Spacer"
        value={setup.spacerMm}
        min={0}
        max={50}
        step={1}
        unit=" mm"
        onChange={(v) => setAxleSetup(axle, { spacerMm: v })}
      />

      <div>
        <span className="field-label">Tyre</span>
        <div className="grid grid-cols-2 gap-1.5">
          <select
            className="input-base"
            aria-label={`${axle} tyre type`}
            value={setup.tyre.type}
            onChange={(e) => patchTyre({ type: e.target.value as TyreSetup['type'] })}
          >
            <option value="radial">Radial</option>
            <option value="bias-ply">Bias-ply</option>
            <option value="drag-slick">Drag slick</option>
            <option value="all-terrain">All-terrain</option>
          </select>
          <select
            className="input-base"
            aria-label={`${axle} rim diameter`}
            value={setup.tyre.rimIn}
            onChange={(e) => patchTyre({ rimIn: Number(e.target.value) })}
          >
            {[13, 14, 15, 16, 17, 18, 19, 20, 22].map((d) => (
              <option key={d} value={d}>
                {d}" rim
              </option>
            ))}
          </select>
        </div>
        <div className="mt-1.5 flex flex-col gap-1.5">
          <NumberField
            label="Section width"
            value={setup.tyre.widthMm}
            min={125}
            max={455}
            step={10}
            unit=" mm"
            onChange={(v) => patchTyre({ widthMm: v })}
          />
          <NumberField
            label="Aspect ratio (sidewall)"
            value={setup.tyre.aspectPct}
            min={25}
            max={90}
            step={5}
            unit="%"
            onChange={(v) => patchTyre({ aspectPct: v })}
          />
        </div>
        <div className="mt-1.5 flex gap-3">
          <label className="flex items-center gap-1.5 text-[11px]">
            <input
              type="checkbox"
              checked={setup.tyre.whitewall}
              onChange={(e) =>
                patchTyre({
                  whitewall: e.target.checked,
                  ...(e.target.checked ? { raisedLetters: false } : {}),
                })
              }
            />
            Whitewall
          </label>
          <label className="flex items-center gap-1.5 text-[11px]">
            <input
              type="checkbox"
              checked={setup.tyre.raisedLetters}
              onChange={(e) =>
                patchTyre({
                  raisedLetters: e.target.checked,
                  ...(e.target.checked ? { whitewall: false } : {}),
                })
              }
            />
            Raised letters
          </label>
        </div>
      </div>

      <div className="panel p-2 font-mono text-[11px] text-graphite-300">
        <p>
          {spec.designation} → Ø {Math.round(spec.diameterMm)} mm (
          {(spec.diameterMm / 25.4).toFixed(1)}")
        </p>
        <p className="text-graphite-400">
          Sidewall {Math.round(spec.sidewallMm)} mm · vs stock {delta >= 0 ? '+' : ''}
          {delta.toFixed(1)}% Ø
        </p>
      </div>
    </div>
  );
}

export function WheelsTab() {
  const build = useBuildStore((s) => s.build);
  if (!build) return null;
  if (hasActiveOemWheelset(build)) {
    return (
      <div className="flex flex-col gap-3">
        <OemWheelsetNotice context="wheels" />
      </div>
    );
  }
  const manifest = getManifestForVehicle(build.vehicleId);
  if (!manifest?.supportedFeatures.wheelSwap) {
    return (
      <p className="text-xs text-graphite-400">
        Wheel configuration needs a vehicle asset with wheel anchors. This vehicle&apos;s manifest
        does not support it.
      </p>
    );
  }

  const warnings = [
    ...checkAxleFitment('front', build.wheels.front, build.stance, manifest),
    ...checkAxleFitment('rear', build.wheels.rear, build.stance, manifest),
  ];

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={build.wheels.linked}
          onChange={(e) => setWheelsLinked(e.target.checked)}
        />
        Same setup front &amp; rear
      </label>

      <section>
        <h3 className="mb-2 text-xs font-semibold text-ivory-100">
          {build.wheels.linked ? 'All four wheels' : 'Front axle'}
        </h3>
        <AxleEditor axle="front" setup={build.wheels.front} />
      </section>

      {!build.wheels.linked && (
        <section className="border-t border-graphite-700/60 pt-3">
          <h3 className="mb-2 text-xs font-semibold text-ivory-100">Rear axle</h3>
          <AxleEditor axle="rear" setup={build.wheels.rear} />
        </section>
      )}

      {warnings.length > 0 && (
        <section className="panel border-warn-500/40 p-2.5" aria-live="polite">
          <h3 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-warn-500">
            <span aria-hidden>▲</span> Fitment warnings (indicative)
          </h3>
          <ul className="flex list-disc flex-col gap-1 pl-4 text-[11px] text-graphite-300">
            {warnings.map((w) => (
              <li key={w.id} className={w.severity === 'warning' ? 'text-warn-500' : ''}>
                {w.message}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-[10px] text-graphite-400">
            Estimated from display-asset bounds, not engineering measurements. Verify on the real
            vehicle before buying parts.
          </p>
        </section>
      )}
    </div>
  );
}
