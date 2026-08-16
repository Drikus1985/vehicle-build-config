/**
 * Support for user-imported wheel models (GLB/STL from the asset library).
 *
 * An imported model is treated as a COMPLETE wheel (rim + tyre): we detect its
 * rotation axis, orient that axis along +X (outboard), centre it, and scale it
 * so its overall diameter matches the configured tyre diameter. This is a
 * display-fit, not an engineering fit — the UI says so.
 */
import * as THREE from 'three';

export const IMPORTED_WHEEL_PREFIX = 'imported:';

export function isImportedWheelId(wheelVariantId: string): boolean {
  return wheelVariantId.startsWith(IMPORTED_WHEEL_PREFIX);
}

export function importedWheelAssetId(wheelVariantId: string): string {
  return wheelVariantId.slice(IMPORTED_WHEEL_PREFIX.length);
}

export interface NormalizedWheel {
  group: THREE.Group;
  /** Scale applied to reach the target diameter. */
  scale: number;
  /** Which source axis was detected as the rotation axis. */
  detectedAxis: 'x' | 'y' | 'z';
}

/**
 * Orient, centre and scale an arbitrary wheel model.
 * A wheel is round: two bounding-box extents are nearly equal (the diameter)
 * and the remaining one is the width — that one is the rotation axis.
 */
export function normalizeWheelObject(
  object: THREE.Object3D,
  targetDiameterM: number,
): NormalizedWheel {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const centre = box.getCenter(new THREE.Vector3());

  const extents: Array<{ axis: 'x' | 'y' | 'z'; value: number }> = [
    { axis: 'x', value: size.x },
    { axis: 'y', value: size.y },
    { axis: 'z', value: size.z },
  ];
  // The rotation axis is the smallest extent (wheel width < diameter).
  const detectedAxis = [...extents].sort((a, b) => a.value - b.value)[0]!.axis;
  const diameter = Math.max(...extents.filter((e) => e.axis !== detectedAxis).map((e) => e.value));

  const group = new THREE.Group();
  group.name = 'imported_wheel';
  const inner = new THREE.Group();
  inner.add(object);
  object.position.sub(centre);
  if (detectedAxis === 'y')
    inner.rotation.z = Math.PI / 2; // Y → X
  else if (detectedAxis === 'z') inner.rotation.y = Math.PI / 2; // Z → X
  const scale = diameter > 0 ? targetDiameterM / diameter : 1;
  group.scale.setScalar(scale);
  group.add(inner);

  return { group, scale, detectedAxis };
}

export function disposeObject(object: THREE.Object3D): void {
  object.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m) => m.dispose());
    }
  });
}
