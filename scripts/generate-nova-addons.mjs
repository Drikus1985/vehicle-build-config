/**
 * Generates ORIGINAL add-on geometry for the 1970 Nova SS 396: cowl-induction
 * hood scoops (2" and 4"), a chin spoiler, and trunk spoilers (ducktail and
 * wing). These are project-original CC0 meshes — unlike the purchased vehicle
 * GLB they ARE committed to the repository.
 *
 * Positions/sizes are fitted to the Nova asset's measured geometry:
 *   hood top ~y=0.98 around z 1.15..2.1, trunk top ~y=1.13 at z -1.99,
 *   front valance bottom ~y=0.33 at z ~2.35, body width ±0.95 m.
 *
 * Node names must match `src/lib/catalog/nova-manifest.ts` (tested).
 * Usage: npm run generate:nova-addons
 * Output: public/assets/vehicles/nova-addons.glb
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { mkdir, writeFile } from 'node:fs/promises';
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

const bodyMat = new THREE.MeshStandardMaterial({
  name: 'addon_body',
  color: 0x316f8b,
  metalness: 0.15,
  roughness: 0.4,
});

const root = new THREE.Group();
root.name = 'nova_addons_root';

function merge(geoms) {
  const merged = BufferGeometryUtils.mergeGeometries(
    geoms.map((g) => (g.index ? g.toNonIndexed() : g)),
    false,
  );
  geoms.forEach((g) => g.dispose());
  return merged;
}

function addMesh(name, geometry) {
  const mesh = new THREE.Mesh(geometry, bodyMat);
  mesh.name = name;
  root.add(mesh);
  return mesh;
}

/**
 * Cowl-induction scoop: wedge rising toward the windshield with side skirts.
 * heightM = scoop height at the rear (2" ≈ 0.05 m, 4" ≈ 0.10 m).
 */
function cowlScoop(name, heightM) {
  const L = 0.92; // length along Z
  const W = 0.56; // width
  const zRear = 1.18; // tall end near the cowl
  const yBase = 0.955; // sunk slightly into the hood to hide the curved gap

  // Side profile in (z,y): low at front, tall at rear, forward-raked lip.
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(L, 0);
  shape.lineTo(L, heightM * 0.22);
  shape.lineTo(0.16 * L, heightM);
  shape.lineTo(0, heightM * 0.92);
  shape.closePath();
  const wedge = new THREE.ExtrudeGeometry(shape, { depth: W, bevelEnabled: false });
  // Built in (x=z-profile, y=height, z=width) → rotate so profile runs along Z.
  wedge.rotateY(-Math.PI / 2); // width now along X, profile length along Z
  wedge.translate(W / 2, yBase, zRear);

  const base = new THREE.BoxGeometry(W + 0.08, 0.018, L + 0.1);
  base.translate(0, yBase + 0.004, zRear + L / 2);

  addMesh(name, merge([wedge, base]));
}

cowlScoop('cowl_scoop_2in', 0.051);
cowlScoop('cowl_scoop_4in', 0.102);

// --- Chin spoiler ------------------------------------------------------------
{
  const lip = new THREE.BoxGeometry(1.56, 0.15, 0.024);
  lip.rotateX(-0.62); // raked down-forward
  lip.translate(0, 0.255, 2.395);
  const mount = new THREE.BoxGeometry(1.5, 0.03, 0.1);
  mount.translate(0, 0.325, 2.34);
  const endL = new THREE.BoxGeometry(0.024, 0.12, 0.1);
  endL.translate(-0.77, 0.27, 2.36);
  const endR = endL.clone();
  endR.translate(1.54, 0, 0);
  addMesh('chin_spoiler', merge([lip, mount, endL, endR]));
}

// --- Trunk spoilers ----------------------------------------------------------
{
  // Ducktail: raked lip along the trunk's trailing edge.
  const tail = new THREE.BoxGeometry(1.5, 0.05, 0.2);
  tail.rotateX(-0.42);
  tail.translate(0, 1.155, -2.3);
  const tailBase = new THREE.BoxGeometry(1.46, 0.025, 0.12);
  tailBase.translate(0, 1.125, -2.24);
  addMesh('trunk_spoiler_ducktail', merge([tail, tailBase]));

  // Wing: blade on two struts.
  const blade = new THREE.BoxGeometry(1.52, 0.024, 0.3);
  blade.rotateX(-0.18);
  blade.translate(0, 1.26, -2.2);
  const strutL = new THREE.BoxGeometry(0.05, 0.13, 0.2);
  strutL.translate(-0.55, 1.185, -2.2);
  const strutR = strutL.clone();
  strutR.translate(1.1, 0, 0);
  const endPlateL = new THREE.BoxGeometry(0.02, 0.09, 0.32);
  endPlateL.translate(-0.75, 1.27, -2.2);
  const endPlateR = endPlateL.clone();
  endPlateR.translate(1.5, 0, 0);
  addMesh('trunk_spoiler_wing', merge([blade, strutL, strutR, endPlateL, endPlateR]));
}

// --- Export ------------------------------------------------------------------
const exporter = new GLTFExporter();
const glb = await new Promise((resolve, reject) => {
  exporter.parse(root, resolve, reject, { binary: true });
});

const outDir = path.resolve(process.cwd(), 'public/assets/vehicles');
await mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, 'nova-addons.glb');
await writeFile(outPath, Buffer.from(glb));
console.log(`Wrote ${outPath} (${(glb.byteLength / 1024).toFixed(1)} KiB)`);
for (const child of root.children) {
  const box = new THREE.Box3().setFromObject(child);
  console.log(
    child.name,
    'min',
    box.min.toArray().map((v) => v.toFixed(2)),
    'max',
    box.max.toArray().map((v) => v.toFixed(2)),
  );
}
