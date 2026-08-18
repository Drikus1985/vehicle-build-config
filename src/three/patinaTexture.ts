/**
 * Procedural patina/weathering drawn onto the livery canvas, on top of paint,
 * stripes and livery graphics. Effects are generated in car space through the
 * manifest's `liveryPanels` island frames, so they land where weathering
 * plausibly lives: rust biased to the lower body and panel edges, chalky fade
 * on the horizontal panels and upper sides, grime pooling along the rockers.
 * All randomness comes from one seeded PRNG, so a build's seed reproduces the
 * exact same pattern on every load.
 */
import type { AssetManifest, PatinaSetup } from '@/lib/schemas';
import { mulberry32, patinaActive } from '@/lib/patina';
import { projectToCanvas } from './uvProject';

/** Car-space sampling regions per island (metres, tuned like the schemes). */
const REGIONS: Record<
  string,
  {
    axis: 'side' | 'top';
    x?: readonly [number, number];
    y?: readonly [number, number];
    z: readonly [number, number];
  }
> = {
  'side-l': { axis: 'side', y: [0.3, 1.0], z: [-2.42, 2.42] },
  'side-r': { axis: 'side', y: [0.3, 1.0], z: [-2.42, 2.42] },
  hood: { axis: 'top', x: [-0.85, 0.85], z: [1.25, 2.1] },
  roof: { axis: 'top', x: [-0.62, 0.62], z: [-0.85, 0.42] },
  trunk: { axis: 'top', x: [-0.85, 0.85], z: [-2.15, -1.4] },
};

const RUST_RAMP = ['#5a2f1b', '#6f3f1f', '#7d4a22', '#8f5626', '#a0632a'];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function softBlob(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusPx: number,
  color: string,
  alpha: number,
  hold = 0.6, // how far the solid core reaches before fading (0..1)
) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radiusPx);
  g.addColorStop(0, color);
  g.addColorStop(hold, color);
  // Mid-stop keeps the falloff smooth so large faint blobs have no rim.
  g.addColorStop(hold + (1 - hold) * 0.5, `${color}80`);
  g.addColorStop(1, `${color}00`);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, radiusPx, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}

export function drawPatina(
  ctx: CanvasRenderingContext2D,
  manifest: AssetManifest,
  patina: PatinaSetup,
  size: number,
): void {
  if (!patinaActive(patina) || manifest.liveryPanels.length === 0) return;
  const rng = mulberry32(patina.seed);
  const amount = patina.amount;

  const toPt = (
    region: (typeof REGIONS)[string],
    a: number, // along x (top) / z (side)
    b: number, // along z (top) / y (side)
  ): [number, number, number] => (region.axis === 'side' ? [0, b, a] : [a, 0, b]);

  for (const panel of manifest.liveryPanels) {
    const region = REGIONS[panel.id];
    if (!region) continue;
    const pxPerM = Math.hypot(...panel.rightUvPerM) * size;
    const [a0, a1] = region.axis === 'side' ? region.z : region.x!;
    const [b0, b1] = region.axis === 'side' ? region.y! : region.z;

    // Chalky clear-coat fade: large, faint blobs — horizontal panels and the
    // upper half of the sides catch the sun.
    if (patina.fade) {
      const count = Math.round((region.axis === 'top' ? 11 : 7) * amount);
      for (let i = 0; i < count; i++) {
        const a = lerp(a0, a1, rng());
        const bLo = region.axis === 'side' ? lerp(b0, b1, 0.55) : b0;
        const b = lerp(bLo, b1, rng());
        const [x, y] = projectToCanvas(panel, toPt(region, a, b), size);
        softBlob(
          ctx,
          x,
          y,
          lerp(0.28, 0.6, rng()) * pxPerM,
          '#e8e5da',
          lerp(0.04, 0.1, rng()) * amount,
          0.05,
        );
      }
    }

    // Surface rust: small blotch clusters, biased low on the sides and toward
    // the edges of the horizontal panels.
    if (patina.rust) {
      const count = Math.round((region.axis === 'side' ? 46 : 24) * amount);
      for (let i = 0; i < count; i++) {
        const a = lerp(a0, a1, rng());
        const b =
          region.axis === 'side'
            ? lerp(b0, b1, Math.pow(rng(), 1.9)) // low on the body
            : lerp(b0, b1, rng() < 0.5 ? Math.pow(rng(), 0.45) : 1 - Math.pow(rng(), 0.45));
        const clusterR = lerp(0.02, 0.09, Math.pow(rng(), 1.6));
        const blobs = 2 + Math.floor(rng() * 4);
        for (let k = 0; k < blobs; k++) {
          const angle = rng() * Math.PI * 2;
          const dist = rng() * clusterR;
          const pt = toPt(region, a + Math.cos(angle) * dist, b + Math.sin(angle) * dist * 0.7);
          const [x, y] = projectToCanvas(panel, pt, size);
          const color = RUST_RAMP[Math.floor(rng() * RUST_RAMP.length)]!;
          softBlob(
            ctx,
            x,
            y,
            lerp(0.35, 0.8, rng()) * clusterR * pxPerM,
            color,
            lerp(0.4, 0.85, rng()) * Math.min(1, amount * 1.3),
          );
        }
      }
    }

    // Road grime pooling along the rockers (sides only).
    if (patina.grime && region.axis === 'side') {
      const [gx0, gy0] = projectToCanvas(panel, [0, 0.62, 0], size);
      const [gx1, gy1] = projectToCanvas(panel, [0, 0.3, 0], size);
      const grad = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
      grad.addColorStop(0, 'rgba(38,31,23,0)');
      grad.addColorStop(1, `rgba(38,31,23,${(0.45 * amount).toFixed(3)})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      for (const [i, corner] of [
        [a0, 0.62],
        [a1, 0.62],
        [a1, 0.28],
        [a0, 0.28],
      ].entries()) {
        const [x, y] = projectToCanvas(panel, toPt(region, corner[0]!, corner[1]!), size);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
    }
  }
}
