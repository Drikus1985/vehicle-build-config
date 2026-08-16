import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  IMPORTED_WHEEL_PREFIX,
  importedWheelAssetId,
  isImportedWheelId,
  normalizeWheelObject,
} from './importedWheel';

function wheelMesh(radius: number, width: number, axis: 'x' | 'y' | 'z'): THREE.Object3D {
  // Cylinder axis is Y by default.
  const geometry = new THREE.CylinderGeometry(radius, radius, width, 24);
  if (axis === 'x') geometry.rotateZ(Math.PI / 2);
  if (axis === 'z') geometry.rotateX(Math.PI / 2);
  return new THREE.Mesh(geometry, new THREE.MeshStandardMaterial());
}

describe('imported wheel ids', () => {
  it('round-trips asset ids through the variant-id prefix', () => {
    const id = `${IMPORTED_WHEEL_PREFIX}asset-123`;
    expect(isImportedWheelId(id)).toBe(true);
    expect(importedWheelAssetId(id)).toBe('asset-123');
    expect(isImportedWheelId('var-wheel-steelie')).toBe(false);
  });
});

describe('normalizeWheelObject', () => {
  it.each(['x', 'y', 'z'] as const)('detects a %s-axis wheel and orients it to X', (axis) => {
    const object = wheelMesh(0.5, 0.25, axis);
    const { group, detectedAxis } = normalizeWheelObject(object, 0.7);
    expect(detectedAxis).toBe(axis);
    // After normalization the bounding sphere diameter matches the target...
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    expect(Math.max(size.y, size.z)).toBeCloseTo(0.7, 2);
    // ...and the small (width) extent lies along X.
    expect(size.x).toBeLessThan(size.y + 1e-6);
    expect(size.x).toBeLessThan(size.z + 1e-6);
  });

  it('centres off-origin geometry', () => {
    const object = wheelMesh(0.4, 0.2, 'y');
    object.position.set(3, 5, -2);
    object.updateMatrixWorld(true);
    const { group } = normalizeWheelObject(object, 0.8);
    const box = new THREE.Box3().setFromObject(group);
    const centre = box.getCenter(new THREE.Vector3());
    expect(centre.length()).toBeLessThan(0.01);
  });

  it('applies the diameter scale factor', () => {
    const object = wheelMesh(0.5, 0.25, 'y'); // diameter 1.0
    const { scale } = normalizeWheelObject(object, 0.65);
    expect(scale).toBeCloseTo(0.65, 5);
  });
});
