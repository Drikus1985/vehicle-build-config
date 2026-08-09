import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { AssetManifest, AxleSetup, Build, WheelAnchor } from '@/lib/schemas';
import { getVariant } from '@/lib/catalog';
import { buildWheel, type WheelFinish } from './proceduralWheel';

function AnchoredWheel({
  anchor,
  setup,
  stance,
  bodyColorHex,
}: {
  anchor: WheelAnchor;
  setup: AxleSetup;
  stance: Build['stance'];
  bodyColorHex: string;
}) {
  const variant = getVariant(setup.wheelVariantId);
  const visual = variant?.visual.kind === 'procedural-wheel' ? variant.visual : null;

  const built = useMemo(() => {
    return buildWheel({
      style: visual?.style ?? 'steelie',
      finish: (visual?.finish ?? 'steel') as WheelFinish,
      widthIn: setup.wheelWidthIn,
      tyre: setup.tyre,
      bodyColorHex,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(setup), visual?.style, visual?.finish, bodyColorHex]);

  useEffect(() => () => built.dispose(), [built]);

  const isLeft = anchor.side === 'left';
  const camberDeg = anchor.axle === 'front' ? stance.camberFrontDeg : stance.camberRearDeg;
  const trackDeltaM =
    (anchor.axle === 'front' ? stance.trackWidthFrontMm : stance.trackWidthRearMm) / 1000;
  const outboardM = (setup.spacerMm - setup.offsetMm) / 1000 + trackDeltaM;
  const steerRad = anchor.axle === 'front' ? THREE.MathUtils.degToRad(stance.steeringAngleDeg) : 0;
  const camberRad = THREE.MathUtils.degToRad(camberDeg);

  const x = anchor.position[0] + (isLeft ? -outboardM : outboardM);

  return (
    <group position={[x, built.radiusM, anchor.position[2]]} rotation-y={steerRad}>
      <group rotation-z={isLeft ? camberRad : -camberRad}>
        <group rotation-y={isLeft ? Math.PI : 0}>
          <primitive object={built.group} />
        </group>
      </group>
    </group>
  );
}

export function Wheels({ manifest, build }: { manifest: AssetManifest; build: Build }) {
  if (!manifest.supportedFeatures.wheelSwap) return null;
  const bodyColorHex = build.paint['body']?.colorHex ?? '#888888';
  return (
    <>
      {manifest.wheelAnchors.map((anchor) => (
        <AnchoredWheel
          key={anchor.id}
          anchor={anchor}
          setup={anchor.axle === 'front' ? build.wheels.front : build.wheels.rear}
          stance={build.stance}
          bodyColorHex={bodyColorHex}
        />
      ))}
    </>
  );
}
