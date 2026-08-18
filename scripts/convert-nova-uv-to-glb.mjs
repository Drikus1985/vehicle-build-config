/**
 * Converts the seller's UV-mapped Nova package (OBJ + MTL, 3ds Max export:
 * centimetres, Z-up, nose at -Y) into a runtime GLB with the same coordinate
 * convention as the original Nova asset (metres, Y-up, nose at +Z).
 *
 * The source package is licensed (Standard License) and NOT committed; pass
 * the directory containing the extracted files. The output GLB is likewise
 * gitignored.
 *
 *   node scripts/convert-nova-uv-to-glb.mjs <dir-with-obj-and-mtl>
 *
 * Output: public/assets/vehicles/nova-1970-uv.glb
 *
 * Validation: prints node names, UV coverage and bounding box; the manifest
 * cross-check lives in src/lib/catalog/nova.test.ts (it accepts either the
 * original or the UV asset installed as nova-1970.glb).
 */
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

if (typeof globalThis.FileReader === 'undefined') {
  globalThis.FileReader = class FileReaderPolyfill {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = buffer;
        this.onloadend?.({ target: this });
      });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((buffer) => {
        this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString('base64')}`;
        this.onloadend?.({ target: this });
      });
    }
  };
}

const sourceDir = process.argv[2];
if (!sourceDir) {
  console.error('Usage: node scripts/convert-nova-uv-to-glb.mjs <dir-with-obj-and-mtl>');
  process.exit(1);
}

const entries = await readdir(sourceDir);
const objName = entries.find((f) => f.toLowerCase().endsWith('.obj'));
const mtlName = entries.find((f) => f.toLowerCase().endsWith('.mtl'));
if (!objName) {
  console.error(`No .obj file found in ${sourceDir}`);
  process.exit(1);
}

console.log(`Loading ${objName}${mtlName ? ` + ${mtlName}` : ''}…`);
const objText = await readFile(path.join(sourceDir, objName), 'utf8');

const objLoader = new OBJLoader();
if (mtlName) {
  const mtlText = await readFile(path.join(sourceDir, mtlName), 'utf8');
  const materials = new MTLLoader().parse(mtlText, '');
  materials.preload();
  objLoader.setMaterials(materials);
}
const parsed = objLoader.parse(objText);

// 3ds Max OBJ: centimetres, Z-up, nose at -Y  →  metres, Y-up, nose at +Z.
// Verified against the original GLB (tire_f_l lands at the same coordinates).
const transform = new THREE.Matrix4()
  .makeScale(0.01, 0.01, 0.01)
  .multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2));

// Group meshes by their OBJ object name (multi-material objects come out of
// OBJLoader as several meshes sharing one name), bake the transform, and
// rebuild a flat scene of named nodes matching the manifest convention.
// Convert MTL Phong materials to PBR so the exporter emits proper
// metallic-roughness materials (Kd → base colour, Ns → roughness, d → opacity).
const materialCache = new Map();
function toStandard(source) {
  if (materialCache.has(source)) return materialCache.get(source);
  const roughness = 1 - Math.min(1, Math.sqrt((source.shininess ?? 30) / 120));
  const standard = new THREE.MeshStandardMaterial({
    name: source.name,
    color: source.color?.clone() ?? new THREE.Color('#888888'),
    metalness: 0,
    roughness,
    transparent: source.transparent === true,
    opacity: source.opacity ?? 1,
  });
  materialCache.set(source, standard);
  return standard;
}

const byName = new Map();
parsed.traverse((o) => {
  if (o.isMesh) {
    o.geometry.applyMatrix4(transform);
    // OBJ triangles are unindexed; welding duplicate vertices indexes the
    // geometry and shrinks the export by ~3-4x.
    o.geometry = BufferGeometryUtils.mergeVertices(o.geometry);
    o.material = Array.isArray(o.material) ? o.material.map(toStandard) : toStandard(o.material);
    const list = byName.get(o.name) ?? [];
    list.push(o);
    byName.set(o.name, list);
  }
});

const root = new THREE.Group();
root.name = 'nova_uv_root';
let uvMissing = [];
for (const [name, meshes] of [...byName.entries()].sort(([a], [b]) => a.localeCompare(b))) {
  for (const mesh of meshes) {
    if (!mesh.geometry.getAttribute('uv')) uvMissing.push(name);
  }
  if (meshes.length === 1) {
    meshes[0].name = name;
    root.add(meshes[0]);
  } else {
    const group = new THREE.Group();
    group.name = name;
    meshes.forEach((m, i) => {
      m.name = `${name}_prim${i}`;
      group.add(m);
    });
    root.add(group);
  }
}

const exporter = new GLTFExporter();
const glb = await new Promise((resolve, reject) => {
  exporter.parse(root, resolve, reject, { binary: true });
});

const outPath = path.resolve(process.cwd(), 'public/assets/vehicles/nova-1970-uv.glb');
await writeFile(outPath, Buffer.from(glb));

const box = new THREE.Box3().setFromObject(root);
console.log(`Wrote ${outPath} (${(glb.byteLength / 1024 / 1024).toFixed(1)} MB)`);
console.log(`Named nodes: ${byName.size}`);
console.log(
  'bbox min',
  box.min.toArray().map((v) => v.toFixed(2)),
  'max',
  box.max.toArray().map((v) => v.toFixed(2)),
);
if (uvMissing.length) {
  console.warn('Nodes missing UVs:', [...new Set(uvMissing)].join(', '));
} else {
  console.log('UVs present on every node ✔');
}
