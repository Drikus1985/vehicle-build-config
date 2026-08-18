/**
 * Draws the livery overlay (roundels + lettering) onto a transparent canvas
 * in the asset's UV space. Each manifest anchor supplies the decal centre UV
 * and the local UV-per-metre frame, so decals land upright, unstretched and
 * correctly mirrored on every panel without any knowledge of the 3D geometry.
 *
 * Canvas mapping: x = u · size, y = (1 − v) · size (the CanvasTexture keeps
 * three.js' default flipY upload). Decals are drawn in centimetre units via
 * setTransform — this keeps canvas font sizes comfortably above 1px, which
 * some engines rasterise poorly.
 */
import type { AssetManifest, LiveryAnchor, LiveryPanel, LiverySetup } from '@/lib/schemas';
import { getLiveryScheme, type SchemePoint } from '@/lib/liverySchemes';

export const LIVERY_TEXTURE_SIZE = 2048;

const FONT_STACK = '"Inter", "Helvetica Neue", Arial, sans-serif';

/** setTransform mapping decal-local centimetres (x right, y down) to canvas px. */
function enterAnchorFrame(ctx: CanvasRenderingContext2D, anchor: LiveryAnchor, size: number) {
  const [u0, v0] = anchor.uv;
  const [dru, drv] = anchor.rightUvPerM;
  const [duu, duv] = anchor.upUvPerM;
  const s = size / 100; // px per (UV-unit · metre) → per centimetre
  ctx.setTransform(dru * s, -drv * s, -duu * s, duv * s, u0 * size, (1 - v0) * size);
}

function drawRoundel(
  ctx: CanvasRenderingContext2D,
  anchor: LiveryAnchor,
  setup: LiverySetup['roundels'],
  size: number,
) {
  enterAnchorFrame(ctx, anchor, size);
  const d = anchor.sizeM * 100 * setup.sizeScale; // diameter, cm
  const ring = d * 0.04;
  ctx.beginPath();
  ctx.arc(0, 0, d / 2, 0, Math.PI * 2);
  ctx.fillStyle = setup.discHex;
  ctx.fill();
  ctx.lineWidth = ring;
  ctx.strokeStyle = setup.ringHex;
  ctx.stroke();
  if (setup.number.length > 0) {
    const fontSize = d * (setup.number.length >= 3 ? 0.4 : 0.52);
    ctx.font = `700 ${fontSize.toFixed(1)}px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = setup.ringHex;
    ctx.fillText(setup.number, 0, d * 0.02);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function drawLettering(
  ctx: CanvasRenderingContext2D,
  anchor: LiveryAnchor,
  setup: LiverySetup['lettering'],
  size: number,
) {
  const text = setup.text.trim();
  if (text.length === 0) return;
  enterAnchorFrame(ctx, anchor, size);
  const h = anchor.sizeM * 100 * setup.sizeScale; // cap height, cm
  ctx.font = `700 ${h.toFixed(1)}px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = setup.colorHex;
  ctx.fillText(text, 0, 0);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

/** Project a car-space point through an island frame to canvas pixels. */
function projectToCanvas(panel: LiveryPanel, pt: SchemePoint, size: number): [number, number] {
  const d = [pt[0] - panel.origin[0], pt[1] - panel.origin[1], pt[2] - panel.origin[2]];
  const r = d[0]! * panel.rightDir[0] + d[1]! * panel.rightDir[1] + d[2]! * panel.rightDir[2];
  const u = d[0]! * panel.upDir[0] + d[1]! * panel.upDir[1] + d[2]! * panel.upDir[2];
  const uvX = panel.uv[0] + panel.rightUvPerM[0] * r + panel.upUvPerM[0] * u;
  const uvY = panel.uv[1] + panel.rightUvPerM[1] * r + panel.upUvPerM[1] * u;
  return [uvX * size, (1 - uvY) * size];
}

/** Pre-designed scheme polygons — drawn first so decals sit on top. */
function drawScheme(
  ctx: CanvasRenderingContext2D,
  manifest: AssetManifest,
  setup: LiverySetup['scheme'],
  size: number,
) {
  const scheme = getLiveryScheme(setup.id);
  if (!scheme || manifest.liveryPanels.length === 0) return;
  const panels = new Map(manifest.liveryPanels.map((p) => [p.id, p]));
  for (const shape of scheme.shapes) {
    ctx.fillStyle = shape.fill === 'primary' ? setup.primaryHex : setup.accentHex;
    for (const panelId of shape.panels) {
      const panel = panels.get(panelId);
      if (!panel) continue;
      ctx.beginPath();
      shape.pts.forEach((pt, i) => {
        const [x, y] = projectToCanvas(panel, pt, size);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.fill();
    }
  }
}

/** Repaint the whole livery canvas from the build's livery setup. */
export function drawLiveryTexture(
  canvas: HTMLCanvasElement,
  manifest: AssetManifest,
  livery: LiverySetup,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const size = canvas.width;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, size, size);
  drawScheme(ctx, manifest, livery.scheme, size);
  const anchors = new Map(manifest.liveryAnchors.map((a) => [a.id, a]));
  for (const id of livery.roundels.anchorIds) {
    const anchor = anchors.get(id);
    if (anchor?.kind === 'roundel') drawRoundel(ctx, anchor, livery.roundels, size);
  }
  for (const id of livery.lettering.anchorIds) {
    const anchor = anchors.get(id);
    if (anchor?.kind === 'lettering') drawLettering(ctx, anchor, livery.lettering, size);
  }
}
