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

  // Outboard direction comes from the anchor's X sign — different assets put
  // "left" on different sides of the X axis.
  const outboardSign = Math.sign(anchor.position[0]) || 1;
  const camberDeg = anchor.axle === 'front' ? stance.camberFrontDeg : stance.camberRearDeg;
  const trackDeltaM =
    (anchor.axle === 'front' ? stance.trackWidthFrontMm : stance.trackWidthRearMm) / 1000;
  const outboardM = (setup.spacerMm - setup.offsetMm) / 1000 + trackDeltaM;
  const steerRad = anchor.axle === 'front' ? THREE.MathUtils.degToRad(stance.steeringAngleDeg) : 0;
  const camberRad = THREE.MathUtils.degToRad(camberDeg);

  const x = anchor.position[0] + outboardSign * outboardM;

  return (
    <group position={[x, built.radiusM, anchor.position[2]]} rotation-y={steerRad}>
      {/* Negative camber leans the wheel top inboard on either side. */}
      <group rotation-z={outboardSign > 0 ? -camberRad : camberRad}>
        {/* The procedural wheel's face points +X; flip it on the -X side. */}
        <group rotation-y={outboardSign > 0 ? 0 : Math.PI}>
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
