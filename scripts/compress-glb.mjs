/**
 * Draco-compress a GLB in place (or to an explicit output path):
 *
 *   node scripts/compress-glb.mjs <input.glb> [output.glb]
 *   npm run compress:nova        # both Nova assets
 *
 * Uses KHR_draco_mesh_compression via gltf-transform. Node names, the scene
 * hierarchy and materials are untouched — only mesh primitives are encoded —
 * so the manifest's node mapping and the GLB↔manifest tests keep working.
 * Quantization: 14-bit positions (~0.3 mm on a 5 m car), 10-bit normals,
 * 12-bit UVs (1/4096 — one texel of the livery atlas at its native size).
 *
 * Run this AFTER scripts/convert-nova-uv-to-glb.mjs and (optionally)
 * scripts/probe-nova-livery-anchors.mjs — those read uncompressed GLBs.
 */
import { NodeIO } from '@gltf-transform/core';
// ALL_EXTENSIONS so existing material extensions (e.g. the original asset's
// KHR_materials_transmission glass) pass through instead of being dropped.
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { stat } from 'node:fs/promises';

const [input, output = input] = process.argv.slice(2);
if (!input) {
  console.error('usage: node scripts/compress-glb.mjs <input.glb> [output.glb]');
  process.exit(1);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder': await draco3d.createEncoderModule(),
  'draco3d.decoder': await draco3d.createDecoderModule(),
});

const before = (await stat(input)).size;
const document = await io.read(input);
await document.transform(
  draco({
    quantizePosition: 14,
    quantizeNormal: 10,
    quantizeTexcoord: 12,
  }),
);
await io.write(output, document);
const after = (await stat(output)).size;
const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
console.log(
  `${input} → ${output}: ${mb(before)} → ${mb(after)} (${Math.round((after / before) * 100)}%)`,
);
