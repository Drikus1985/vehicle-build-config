/**
 * Camera sync between the primary (interactive) viewport and the follower
 * pane in split-view Compare mode. The primary registers its camera; the
 * follower copies its pose every frame, and change notifications let the
 * follower invalidate itself when running on-demand (reduced motion).
 */
import type * as THREE from 'three';

let primaryCamera: THREE.Camera | null = null;
const listeners = new Set<() => void>();

export function setPrimaryCamera(camera: THREE.Camera | null): void {
  primaryCamera = camera;
}

export function getPrimaryCamera(): THREE.Camera | null {
  return primaryCamera;
}

/** Called by the primary rig whenever its controls move the camera. */
export function notifyCameraChange(): void {
  for (const listener of listeners) listener();
}

export function onCameraChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
