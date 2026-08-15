import { getManifestForVehicle, getVehicle, hasActiveOemWheelset } from '@/lib/catalog';
import { STANCE_PRESETS } from '@/lib/build/defaults';
import { checkAxleFitment } from '@/lib/fitment/tyres';
import { applyStancePreset, setStance } from '@/state/buildActions';
import { useBuildStore } from '@/state/buildStore';
import { useUiStore } from '@/state/uiStore';
import { OemWheelsetNotice } from './WheelsTab';

function StanceSlider({
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
          {value > 0 ? '+' : ''}
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

export function StanceTab() {
  const build = useBuildStore((s) => s.build);
  const toast = useUiStore((s) => s.toast);
  if (!build) return null;
  if (hasActiveOemWheelset(build)) {
    return (
      <div className="flex flex-col gap-3">
        <OemWheelsetNotice context="stance" />
      </div>
    );
  }
  const vehicle = getVehicle(build.vehicleId);
  const manifest = getManifestForVehicle(build.vehicleId);
  if (!manifest?.supportedFeatures.stance || !vehicle) {
    return (
      <p className="text-xs text-graphite-400">
        Stance tools need a vehicle asset with wheel anchors and fitment bounds.
      </p>
    );
  }
  const s = build.stance;
  const warnings = [
    ...checkAxleFitment('front', build.wheels.front, s, manifest),
    ...checkAxleFitment('rear', build.wheels.rear, s, manifest),
  ];

  return (
    <div className="flex flex-col gap-4">
      <section>
        <span className="field-label">Presets</span>
        <div className="grid grid-cols-2 gap-1.5">
          {STANCE_PRESETS.map((p) => {
            const compatible =
              p.vehicleTypes.length === 0 || p.vehicleTypes.includes(vehicle.vehicleType);
            return (
              <button
                key={p.id}
                className="btn flex-col !items-start !py-1.5"
                disabled={!compatible}
                title={
                  compatible ? p.description : `${p.description} Not offered for this vehicle type.`
                }
                onClick={() => {
                  applyStancePreset(p.id);
                  toast('success', `Applied ${p.label} preset (wheels, tyres and stance).`);
                }}
              >
                <span>{p.label}</span>
                <span className="text-[9px] font-normal normal-case text-graphite-400">
                  {compatible ? p.description : 'Not for this vehicle type'}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <span className="field-label">Ride height (vs stock)</span>
        <StanceSlider
          label="Front"
          value={s.rideHeightFrontMm}
          min={-150}
          max={150}
          step={5}
          unit=" mm"
          onChange={(v) => setStance({ rideHeightFrontMm: v })}
        />
        <StanceSlider
          label="Rear"
          value={s.rideHeightRearMm}
          min={-150}
          max={150}
          step={5}
          unit=" mm"
          onChange={(v) => setStance({ rideHeightRearMm: v })}
        />
        <p className="text-[10px] text-graphite-400">
          Rake:{' '}
          {s.rideHeightRearMm - s.rideHeightFrontMm > 0
            ? 'nose-down'
            : s.rideHeightRearMm - s.rideHeightFrontMm < 0
              ? 'tail-down'
              : 'level'}{' '}
          ({Math.abs(s.rideHeightRearMm - s.rideHeightFrontMm)} mm)
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <span className="field-label">Camber</span>
        <StanceSlider
          label="Front"
          value={s.camberFrontDeg}
          min={-10}
          max={2}
          step={0.5}
          unit="°"
          onChange={(v) => setStance({ camberFrontDeg: v })}
        />
        <StanceSlider
          label="Rear"
          value={s.camberRearDeg}
          min={-10}
          max={2}
          step={0.5}
          unit="°"
          onChange={(v) => setStance({ camberRearDeg: v })}
        />
      </section>

      <section className="flex flex-col gap-2">
        <span className="field-label">Track width (per side)</span>
        <StanceSlider
          label="Front"
          value={s.trackWidthFrontMm}
          min={-30}
          max={75}
          step={5}
          unit=" mm"
          onChange={(v) => setStance({ trackWidthFrontMm: v })}
        />
        <StanceSlider
          label="Rear"
          value={s.trackWidthRearMm}
          min={-30}
          max={75}
          step={5}
          unit=" mm"
          onChange={(v) => setStance({ trackWidthRearMm: v })}
        />
      </section>

      <section className="flex flex-col gap-2">
        <span className="field-label">Inspection</span>
        <StanceSlider
          label="Steering angle"
          value={s.steeringAngleDeg}
          min={-35}
          max={35}
          step={1}
          unit="°"
          onChange={(v) => setStance({ steeringAngleDeg: v })}
        />
        <p className="text-[10px] text-graphite-400">
          Turns the front wheels in the viewport to inspect clearance at lock. Not saved as part of
          the driving stance.
        </p>
      </section>

      {warnings.length > 0 && (
        <section className="panel border-warn-500/40 p-2.5" aria-live="polite">
          <h3 className="mb-1 text-[11px] font-semibold text-warn-500">
            ▲ Interference warnings (indicative)
          </h3>
          <ul className="flex list-disc flex-col gap-1 pl-4 text-[11px] text-graphite-300">
            {warnings.map((w) => (
              <li key={w.id}>{w.message}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
