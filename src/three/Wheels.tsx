import { useEffect, useMemo, useState, type ReactNode } from 'react';
import * as THREE from 'three';
import type { AssetManifest, AxleSetup, Build, WheelAnchor } from '@/lib/schemas';
import { getVariant } from '@/lib/catalog';
import { computeTyreSpec } from '@/lib/fitment/tyres';
import { repositories } from '@/lib/persistence/idb';
import { buildWheel, type WheelFinish } from './proceduralWheel';
import {
  disposeObject,
  importedWheelAssetId,
  isImportedWheelId,
  normalizeWheelObject,
} from './importedWheel';

/**
 * Loads a user-imported wheel model from the asset library and normalizes it
 * (axis, centre, overall diameter). Falls back to null while loading or when
 * the asset is missing in this browser (the axle then shows a steelie).
 */
function useImportedWheel(assetId: string | null, targetDiameterM: number) {
  const [wheel, setWheel] = useState<{ group: THREE.Group; radiusM: number } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!assetId) {
      setWheel(null);
      setFailed(false);
      return;
    }
    let disposed = false;
    let cleanup: (() => void) | undefined;
    void (async () => {
      try {
        const asset = await repositories.assets.get(assetId);
        if (!asset || (asset.kind !== 'gltf' && asset.kind !== 'stl')) {
          if (!disposed) setFailed(true);
          return;
        }
        const url = URL.createObjectURL(asset.blob);
        try {
          let object: THREE.Object3D;
          if (asset.kind === 'gltf') {
            const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
            object = (await new GLTFLoader().loadAsync(url)).scene;
          } else {
            const { STLLoader } = await import('three/addons/loaders/STLLoader.js');
            const geometry = await new STLLoader().loadAsync(url);
            geometry.computeVertexNormals();
            object = new THREE.Mesh(
              geometry,
              new THREE.MeshStandardMaterial({ color: '#9a9da3', metalness: 0.8, roughness: 0.35 }),
            );
          }
          if (disposed) {
            disposeObject(object);
            return;
          }
          const normalized = normalizeWheelObject(object, targetDiameterM);
          normalized.group.traverse((o) => {
            if (o instanceof THREE.Mesh) o.castShadow = true;
          });
          setWheel({ group: normalized.group, radiusM: targetDiameterM / 2 });
          setFailed(false);
          cleanup = () => disposeObject(normalized.group);
        } finally {
          URL.revokeObjectURL(url);
        }
      } catch {
        if (!disposed) setFailed(true);
      }
    })();
    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [assetId, targetDiameterM]);

  return { wheel, failed };
}

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
  const imported = isImportedWheelId(setup.wheelVariantId);
  const targetDiameterM = computeTyreSpec(setup.tyre).diameterMm / 1000;
  const { wheel: importedWheel, failed: importFailed } = useImportedWheel(
    imported ? importedWheelAssetId(setup.wheelVariantId) : null,
    targetDiameterM,
  );

  const variant = getVariant(setup.wheelVariantId);
  const visual = variant?.visual.kind === 'procedural-wheel' ? variant.visual : null;

  // Procedural wheel — also the fallback while an import loads or is missing.
  const useProcedural = !imported || importFailed || !importedWheel;
  const built = useMemo(() => {
    if (!useProcedural) return null;
    return buildWheel({
      style: visual?.style ?? 'steelie',
      finish: (visual?.finish ?? 'steel') as WheelFinish,
      widthIn: setup.wheelWidthIn,
      tyre: setup.tyre,
      bodyColorHex,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useProcedural, JSON.stringify(setup), visual?.style, visual?.finish, bodyColorHex]);

  useEffect(() => () => built?.dispose(), [built]);

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

  let wheelObject: ReactNode = null;
  let radiusM = targetDiameterM / 2;
  if (!useProcedural && importedWheel) {
    wheelObject = <primitive object={importedWheel.group} />;
    radiusM = importedWheel.radiusM;
  } else if (built) {
    wheelObject = <primitive object={built.group} />;
    radiusM = built.radiusM;
  }

  return (
    <group position={[x, radiusM, anchor.position[2]]} rotation-y={steerRad}>
      {/* Negative camber leans the wheel top inboard on either side. */}
      <group rotation-z={outboardSign > 0 ? -camberRad : camberRad}>
        {/* Wheel faces point +X after normalization; flip on the -X side. */}
        <group rotation-y={outboardSign > 0 ? 0 : Math.PI}>{wheelObject}</group>
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
