import type { LiveryPanel } from '@/lib/schemas';

/**
 * Project a car-space point through a `liveryPanels` island frame to canvas
 * pixels (canvas x = u · size, y = (1 − v) · size, matching the CanvasTexture
 * upload orientation). Shared by the livery scheme and patina painters.
 */
export function projectToCanvas(
  panel: LiveryPanel,
  pt: readonly [number, number, number],
  size: number,
): [number, number] {
  const d = [pt[0] - panel.origin[0], pt[1] - panel.origin[1], pt[2] - panel.origin[2]];
  const r = d[0]! * panel.rightDir[0] + d[1]! * panel.rightDir[1] + d[2]! * panel.rightDir[2];
  const u = d[0]! * panel.upDir[0] + d[1]! * panel.upDir[1] + d[2]! * panel.upDir[2];
  const uvX = panel.uv[0] + panel.rightUvPerM[0] * r + panel.upUvPerM[0] * u;
  const uvY = panel.uv[1] + panel.rightUvPerM[1] * r + panel.upUvPerM[1] * u;
  return [uvX * size, (1 - uvY) * size];
}
