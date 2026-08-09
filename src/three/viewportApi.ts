/**
 * Imperative bridge to the live viewport (snapshot capture, camera control).
 * Registered by the Canvas scene on mount; UI code calls through `viewportApi`.
 */

export type SnapshotAspect = 'viewport' | '1:1' | '4:3' | '16:9';

export interface SnapshotOptions {
  aspect: SnapshotAspect;
  transparent: boolean;
}

export interface ViewportApi {
  /** Renders a frame and returns a PNG data URL, cropped to the aspect. */
  captureSnapshot(options: SnapshotOptions): Promise<string>;
  /** Move camera to a manifest preset id. */
  goToPreset(presetId: string): void;
  resetView(): void;
}

let current: ViewportApi | null = null;

export function registerViewportApi(api: ViewportApi | null): void {
  current = api;
}

export function getViewportApi(): ViewportApi | null {
  return current;
}
