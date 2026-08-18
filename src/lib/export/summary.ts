import { getManifestForVehicle, getPart, getVariant, getVehicle } from '@/lib/catalog';
import { checkAxleFitment, computeTyreSpec } from '@/lib/fitment/tyres';
import { statusMeta } from '@/lib/titanforge';
import { getPlateStyle } from '@/lib/plates';
import { STRIPE_STYLES } from '@/lib/stripes';
import { liveryHasContent } from '@/lib/livery';
import { getLiveryScheme } from '@/lib/liverySchemes';
import { patinaActive } from '@/lib/patina';
import type { Build } from '@/lib/schemas';

function esc(s: string): string {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Printable build summary as a standalone HTML document (opened for print). */
export function buildSummaryHtml(build: Build): string {
  const vehicle = getVehicle(build.vehicleId);
  const manifest = getManifestForVehicle(build.vehicleId);
  const frontSpec = computeTyreSpec(build.wheels.front.tyre);
  const rearSpec = computeTyreSpec(build.wheels.rear.tyre);
  const warnings = manifest
    ? [
        ...checkAxleFitment('front', build.wheels.front, build.stance, manifest),
        ...checkAxleFitment('rear', build.wheels.rear, build.stance, manifest),
      ]
    : [];

  const partsRows = build.installed
    .filter((p) => !p.removed)
    .map((p) => {
      const part = getPart(p.partId);
      const variant = p.variantId ? getVariant(p.variantId) : null;
      return `<tr><td>${esc(part?.name ?? p.partId)}</td><td>${esc(part?.category ?? '')}</td><td>${esc(variant?.name ?? '—')}</td><td>${p.hidden ? 'hidden' : 'shown'}</td></tr>`;
    })
    .join('');

  const removedRows = build.installed
    .filter((p) => p.removed)
    .map((p) => `<li>${esc(getPart(p.partId)?.name ?? p.partId)}</li>`)
    .join('');

  const paintRows = Object.entries(build.paint)
    .map(([zone, s]) => {
      const zoneLabel = manifest?.materialZones.find((z) => z.id === zone)?.label ?? zone;
      return `<tr><td>${esc(zoneLabel)}</td><td><span class="swatch" style="background:${esc(s.colorHex)}"></span> ${esc(s.colorHex)}</td><td>${Math.round(s.metallic * 100)}%</td><td>${Math.round(s.roughness * 100)}%</td><td>${Math.round(s.clearcoat * 100)}%</td></tr>`;
    })
    .join('');

  const fabRows = Object.values(build.fabricationRecords)
    .map((r) => {
      const meta = statusMeta(r.status);
      return `<tr><td>${esc(getPart(r.componentId)?.name ?? r.componentId)}</td><td>[${esc(meta.glyph)}] ${esc(meta.label)}</td><td>${esc(r.priority)}</td><td>${esc(r.process)}</td><td>${r.scanRequired ? 'yes' : 'no'}</td><td>${esc(r.notes || '—')}</td></tr>`;
    })
    .join('');

  const warningItems = warnings
    .map((w) => `<li class="${w.severity}">${esc(w.message)}</li>`)
    .join('');

  const attribution = manifest
    ? `${esc(manifest.attribution.attributionText)} (licence: ${esc(manifest.attribution.licence)})`
    : 'No 3D asset attribution — vehicle has no loaded asset.';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(build.name)} — build summary</title>
<style>
  body { font: 13px/1.5 system-ui, sans-serif; color: #1c1c1e; margin: 2rem; }
  h1 { font-size: 1.4rem; margin-bottom: 0; } h2 { font-size: 1rem; margin-top: 1.6em; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
  table { border-collapse: collapse; width: 100%; margin-top: .5em; }
  th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid #e2e2e2; font-size: 12px; }
  .muted { color: #666; } .swatch { display: inline-block; width: 12px; height: 12px; border: 1px solid #999; vertical-align: -1px; }
  li.warning { color: #a33; } li.caution { color: #96690f; }
  .note { background: #f5f2ea; border: 1px solid #ddd; padding: 8px 10px; font-size: 12px; margin-top: 1em; }
  @media print { body { margin: 0.5in; } }
</style></head><body>
<h1>${esc(build.name)}</h1>
<p class="muted">${vehicle ? esc(`${vehicle.year} ${vehicle.make} ${vehicle.model}${vehicle.trim ? ' ' + vehicle.trim : ''} — ${vehicle.bodyStyle}`) : esc(build.vehicleId)} · exported ${esc(new Date().toLocaleString())}</p>

<h2>Installed components</h2>
<table><thead><tr><th>Part</th><th>Category</th><th>Variant</th><th>Visibility</th></tr></thead><tbody>${partsRows}</tbody></table>
${removedRows ? `<p><strong>Removed:</strong></p><ul>${removedRows}</ul>` : ''}

<h2>Paint &amp; finish</h2>
<table><thead><tr><th>Zone</th><th>Colour</th><th>Metallic</th><th>Roughness</th><th>Clear coat</th></tr></thead><tbody>${paintRows}</tbody></table>
<p class="muted">Glass tint: ${Math.round(build.glassTint * 100)}%</p>

<h2>Wheels &amp; tyres</h2>
<table><thead><tr><th>Axle</th><th>Wheel</th><th>Width</th><th>Offset</th><th>Spacer</th><th>Tyre</th><th>Overall Ø</th></tr></thead><tbody>
<tr><td>Front</td><td>${esc(getVariant(build.wheels.front.wheelVariantId)?.name ?? '')}</td><td>${build.wheels.front.wheelWidthIn}"</td><td>${build.wheels.front.offsetMm} mm</td><td>${build.wheels.front.spacerMm} mm</td><td>${esc(frontSpec.designation)}</td><td>${Math.round(frontSpec.diameterMm)} mm</td></tr>
<tr><td>Rear</td><td>${esc(getVariant(build.wheels.rear.wheelVariantId)?.name ?? '')}</td><td>${build.wheels.rear.wheelWidthIn}"</td><td>${build.wheels.rear.offsetMm} mm</td><td>${build.wheels.rear.spacerMm} mm</td><td>${esc(rearSpec.designation)}</td><td>${Math.round(rearSpec.diameterMm)} mm</td></tr>
</tbody></table>

<h2>Stance</h2>
<p>Ride height F/R: ${build.stance.rideHeightFrontMm} / ${build.stance.rideHeightRearMm} mm ·
Camber F/R: ${build.stance.camberFrontDeg}° / ${build.stance.camberRearDeg}° ·
Track F/R: +${build.stance.trackWidthFrontMm} / +${build.stance.trackWidthRearMm} mm</p>

${
  manifest && manifest.stripeZones.length > 0 && build.stripes.styleId !== 'none'
    ? `<h2>Racing stripes</h2>
<p>${esc(STRIPE_STYLES.find((s) => s.id === build.stripes.styleId)?.label ?? build.stripes.styleId)} — <span class="swatch" style="background:${esc(build.stripes.colorHex)}"></span> ${esc(build.stripes.colorHex)} at ${Math.round(build.stripes.widthScale * 100)}% width</p>
`
    : ''
}
${
  manifest && manifest.liveryAnchors.length > 0 && liveryHasContent(build.livery)
    ? `<h2>Livery</h2>
<p>${[
        getLiveryScheme(build.livery.scheme.id)
          ? `${esc(getLiveryScheme(build.livery.scheme.id)!.label)} scheme — <span class="swatch" style="background:${esc(build.livery.scheme.primaryHex)}"></span> ${esc(build.livery.scheme.primaryHex)} / <span class="swatch" style="background:${esc(build.livery.scheme.accentHex)}"></span> ${esc(build.livery.scheme.accentHex)}`
          : '',
        build.livery.roundels.anchorIds.length > 0 && build.livery.roundels.number
          ? `Roundel #${esc(build.livery.roundels.number)} on ${esc(
              build.livery.roundels.anchorIds
                .map(
                  (id) =>
                    manifest.liveryAnchors.find((a) => a.id === id)?.label.toLowerCase() ?? id,
                )
                .join(', '),
            )}`
          : '',
        build.livery.lettering.anchorIds.length > 0 && build.livery.lettering.text.trim()
          ? `Lettering "${esc(build.livery.lettering.text)}" on ${esc(
              build.livery.lettering.anchorIds
                .map(
                  (id) =>
                    manifest.liveryAnchors.find((a) => a.id === id)?.label.toLowerCase() ?? id,
                )
                .join(', '),
            )}`
          : '',
      ]
        .filter(Boolean)
        .join(' · ')}</p>
`
    : ''
}
${
  manifest && manifest.liveryPanels.length > 0 && patinaActive(build.patina)
    ? `<h2>Patina</h2>
<p>${Math.round(build.patina.amount * 100)}% — ${[
        build.patina.fade ? 'faded paint' : '',
        build.patina.rust ? 'surface rust' : '',
        build.patina.grime ? 'grime' : '',
      ]
        .filter(Boolean)
        .join(', ')} (pattern seed ${build.patina.seed}; cosmetic display effect)</p>
`
    : ''
}
${
  manifest && manifest.plateMounts.length > 0
    ? `<h2>Numberplate</h2>
<p>"${esc(build.plateSetup.text)}" — ${esc(getPlateStyle(build.plateSetup.styleId).label)} (decorative display plate)</p>
`
    : ''
}
<h2>Fitment warnings (indicative)</h2>
${warningItems ? `<ul>${warningItems}</ul>` : '<p class="muted">None at current settings.</p>'}

<h2>Titanforge fabrication items</h2>
${fabRows ? `<table><thead><tr><th>Component</th><th>Status</th><th>Priority</th><th>Process</th><th>Scan</th><th>Notes</th></tr></thead><tbody>${fabRows}</tbody></table>` : '<p class="muted">No fabrication records.</p>'}

<h2>Source attribution</h2>
<p>${attribution}</p>
<div class="note"><strong>Note:</strong> all dimensions, clearances and fitment warnings derive from display geometry and are indicative only — not validated for manufacturing. Titanforge items require calibrated scans or engineering models before production.</div>
</body></html>`;
}
