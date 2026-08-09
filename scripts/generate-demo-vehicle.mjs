/**
 * Generates the rights-safe demo vehicle GLB: an ORIGINAL stylised
 * late-40s/early-50s style stepside pickup ("Titanforge TF-100").
 * It is not modelled on any specific production vehicle.
 *
 * Every mesh is separately named; names must match
 * `src/lib/catalog/tf100-manifest.ts` (verified by unit tests that parse the
 * emitted GLB JSON header).
 *
 * Usage: npm run generate:demo-vehicle
 * Output: public/assets/vehicles/tf100-stepside.glb
 *
 * Units: metres. Y up, +Z forward (nose), +X right (driver side on the left).
 */
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

// GLTFExporter uses FileReader (a browser API) to assemble the binary; give
// Node a minimal equivalent.
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

const materials = {
  body: new THREE.MeshStandardMaterial({
    name: 'zone_body',
    color: 0x8f1f27,
    metalness: 0.1,
    roughness: 0.35,
  }),
  roof: new THREE.MeshStandardMaterial({
    name: 'zone_roof',
    color: 0xeceae2,
    metalness: 0.1,
    roughness: 0.35,
  }),
  stripes: new THREE.MeshStandardMaterial({
    name: 'zone_stripes',
    color: 0xf0eee6,
    metalness: 0,
    roughness: 0.4,
  }),
  bed: new THREE.MeshStandardMaterial({
    name: 'zone_bed',
    color: 0x7a5a3a,
    metalness: 0,
    roughness: 0.8,
  }),
  accent: new THREE.MeshStandardMaterial({
    name: 'zone_accent',
    color: 0x1a1b1e,
    metalness: 0.2,
    roughness: 0.55,
  }),
  interior: new THREE.MeshStandardMaterial({
    name: 'zone_interior',
    color: 0x6d3f2a,
    metalness: 0,
    roughness: 0.75,
  }),
  chrome: new THREE.MeshStandardMaterial({
    name: 'zone_chrome',
    color: 0xd8dadf,
    metalness: 1,
    roughness: 0.12,
  }),
  glass: new THREE.MeshStandardMaterial({
    name: 'zone_glass',
    color: 0x9db2b8,
    metalness: 0,
    roughness: 0.05,
    transparent: true,
    opacity: 0.35,
  }),
  lights: new THREE.MeshStandardMaterial({
    name: 'zone_lights',
    color: 0xe8e6d8,
    metalness: 0.3,
    roughness: 0.2,
  }),
  lightsRed: new THREE.MeshStandardMaterial({
    name: 'zone_lights_red',
    color: 0xa01522,
    metalness: 0.2,
    roughness: 0.25,
  }),
  chassis: new THREE.MeshStandardMaterial({
    name: 'zone_chassis',
    color: 0x232529,
    metalness: 0.3,
    roughness: 0.7,
  }),
  steel: new THREE.MeshStandardMaterial({
    name: 'zone_steel',
    color: 0x6e7076,
    metalness: 0.7,
    roughness: 0.45,
  }),
};

const root = new THREE.Group();
root.name = 'tf100_root';

function box(w, h, d) {
  return new THREE.BoxGeometry(w, h, d);
}

function merge(geoms) {
  const merged = BufferGeometryUtils.mergeGeometries(
    geoms.map((g) => g.toNonIndexed()),
    false,
  );
  geoms.forEach((g) => g.dispose());
  return merged;
}

function addMesh(name, geometry, material) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  root.add(mesh);
  return mesh;
}

/** Wheel-arch shell: an open half-tube over the wheel position. */
function arch(radius, width, thickness = 0.05) {
  const outer = new THREE.CylinderGeometry(radius, radius, width, 24, 1, true, 0, Math.PI);
  outer.rotateZ(Math.PI / 2); // axis along X
  outer.rotateX(-Math.PI / 2); // opening faces down
  const lip = new THREE.CylinderGeometry(
    radius + thickness,
    radius + thickness,
    width * 0.92,
    24,
    1,
    true,
    0,
    Math.PI,
  );
  lip.rotateZ(Math.PI / 2);
  lip.rotateX(-Math.PI / 2);
  return merge([outer, lip]);
}

// --- Chassis -----------------------------------------------------------------
{
  const railL = box(0.09, 0.14, 4.4);
  railL.translate(-0.42, 0.34, 0);
  const railR = box(0.09, 0.14, 4.4);
  railR.translate(0.42, 0.34, 0);
  const crossmembers = [-1.8, -0.9, 0, 0.9, 1.8].map((z) => {
    const g = box(0.86, 0.1, 0.09);
    g.translate(0, 0.34, z);
    return g;
  });
  const axleF = new THREE.CylinderGeometry(0.05, 0.05, 1.5, 10);
  axleF.rotateZ(Math.PI / 2);
  axleF.translate(0, 0.36, 1.42);
  const axleR = new THREE.CylinderGeometry(0.05, 0.05, 1.5, 10);
  axleR.rotateZ(Math.PI / 2);
  axleR.translate(0, 0.36, -1.42);
  addMesh('chassis_frame', merge([railL, railR, ...crossmembers, axleF, axleR]), materials.chassis);
}

// --- Cab ---------------------------------------------------------------------
{
  // Lower cab body (belt line at y=1.22), cowl, rear wall and pillars.
  const lower = box(1.7, 0.68, 1.35);
  lower.translate(0, 0.88, 0.325);
  const cowl = box(1.6, 0.14, 0.3);
  cowl.translate(0, 1.13, 1.05);
  const rearWall = box(1.62, 0.52, 0.08);
  rearWall.translate(0, 1.48, -0.31);
  const pillarFL = box(0.07, 0.55, 0.09);
  pillarFL.translate(-0.76, 1.48, 0.93);
  const pillarFR = pillarFL.clone();
  pillarFR.translate(1.52, 0, 0);
  const pillarBL = box(0.07, 0.55, 0.1);
  pillarBL.translate(-0.78, 1.48, -0.28);
  const pillarBR = pillarBL.clone();
  pillarBR.translate(1.56, 0, 0);
  const floor = box(1.6, 0.06, 1.3);
  floor.translate(0, 0.56, 0.32);
  const header = box(1.62, 0.1, 0.12);
  header.translate(0, 1.72, 0.88);
  addMesh(
    'cab_shell',
    merge([lower, cowl, rearWall, pillarFL, pillarFR, pillarBL, pillarBR, floor, header]),
    materials.body,
  );

  const roof = box(1.66, 0.07, 1.28);
  roof.translate(0, 1.765, 0.3);
  addMesh('roof_panel', roof, materials.roof);
}

// --- Doors -------------------------------------------------------------------
for (const side of [-1, 1]) {
  const name = side < 0 ? 'door_left' : 'door_right';
  const panel = box(0.05, 0.66, 0.88);
  panel.translate(side * 0.865, 0.9, 0.42);
  const upper = box(0.05, 0.5, 0.1);
  upper.translate(side * 0.855, 1.47, 0.02);
  const handle = box(0.03, 0.04, 0.16);
  handle.translate(side * 0.9, 1.08, 0.25);
  addMesh(name, merge([panel, upper, handle]), materials.body);
}

// --- Hood (two variants) & stripe -------------------------------------------
{
  const hoodTop = box(1.44, 0.1, 1.12);
  hoodTop.translate(0, 1.135, 1.68);
  const nose = box(1.3, 0.34, 0.18);
  nose.translate(0, 0.96, 2.2);
  const sideL = box(0.06, 0.3, 1.06);
  sideL.translate(-0.68, 0.95, 1.66);
  const sideR = sideL.clone();
  sideR.translate(1.36, 0, 0);
  addMesh('hood_stock', merge([hoodTop, nose, sideL, sideR]), materials.body);

  const hoodTop2 = hoodTop.clone();
  const nose2 = nose.clone();
  const sideL2 = sideL.clone();
  const sideR2 = sideR.clone();
  const scoop = box(0.52, 0.12, 0.7);
  scoop.translate(0, 1.24, 1.62);
  const scoopLip = box(0.6, 0.06, 0.16);
  scoopLip.translate(0, 1.21, 1.98);
  addMesh(
    'hood_scooped',
    merge([hoodTop2, nose2, sideL2, sideR2, scoop, scoopLip]),
    materials.body,
  );

  const stripe = box(0.3, 0.012, 1.14);
  stripe.translate(0, 1.19, 1.68);
  addMesh('stripe_hood', stripe, materials.stripes);
}

// --- Front fenders -----------------------------------------------------------
for (const side of [-1, 1]) {
  const name = side < 0 ? 'fender_front_left' : 'fender_front_right';
  const shell = arch(0.5, 0.3);
  shell.translate(side * 0.79, 0.42, 1.42);
  const skirt = box(0.28, 0.18, 0.5);
  skirt.translate(side * 0.79, 0.86, 1.9);
  const headlightPod = new THREE.SphereGeometry(0.13, 16, 12);
  headlightPod.scale(1, 1, 1.3);
  headlightPod.translate(side * 0.62, 1.0, 2.18);
  addMesh(name, merge([shell, skirt, headlightPod]), materials.body);
}

// --- Grille (two variants), bumpers, lights ---------------------------------
{
  const bars = [];
  for (let i = 0; i < 5; i++) {
    const bar = box(1.06, 0.045, 0.05);
    bar.translate(0, 0.78 + i * 0.09, 2.3);
    bars.push(bar);
  }
  const surround = box(1.14, 0.06, 0.05);
  surround.translate(0, 1.2, 2.3);
  addMesh('grille_bars', merge([...bars, surround]), materials.chrome);

  const meshPanel = box(1.08, 0.44, 0.04);
  meshPanel.translate(0, 0.97, 2.29);
  const frame = box(1.14, 0.05, 0.05);
  frame.translate(0, 1.2, 2.3);
  const frameB = box(1.14, 0.05, 0.05);
  frameB.translate(0, 0.75, 2.3);
  addMesh('grille_mesh', merge([meshPanel, frame, frameB]), materials.chrome);

  for (const [name, z] of [
    ['bumper_front', 2.42],
    ['bumper_rear', -2.42],
  ]) {
    const blade = box(1.86, 0.14, 0.09);
    blade.translate(0, 0.5, z);
    const overriderL = box(0.09, 0.2, 0.1);
    overriderL.translate(-0.55, 0.53, z);
    const overriderR = overriderL.clone();
    overriderR.translate(1.1, 0, 0);
    addMesh(name, merge([blade, overriderL, overriderR]), materials.chrome);
  }

  for (const side of [-1, 1]) {
    const lens = new THREE.SphereGeometry(0.09, 16, 12);
    lens.translate(side * 0.62, 1.0, 2.3);
    addMesh(side < 0 ? 'headlight_left' : 'headlight_right', lens, materials.lights);

    const tail = box(0.08, 0.16, 0.05);
    tail.translate(side * 0.7, 0.95, -2.31);
    addMesh(side < 0 ? 'taillight_left' : 'taillight_right', tail, materials.lightsRed);
  }
}

// --- Glass -------------------------------------------------------------------
{
  const windshield = box(1.42, 0.48, 0.03);
  windshield.rotateX(-0.12);
  windshield.translate(0, 1.47, 0.92);
  addMesh('glass_windshield', windshield, materials.glass);

  const rear = box(1.2, 0.4, 0.03);
  rear.translate(0, 1.47, -0.29);
  addMesh('glass_rear', rear, materials.glass);

  for (const side of [-1, 1]) {
    const g = box(0.03, 0.44, 0.98);
    g.translate(side * 0.82, 1.47, 0.31);
    addMesh(side < 0 ? 'glass_side_left' : 'glass_side_right', g, materials.glass);
  }
}

// --- Mirror ------------------------------------------------------------------
{
  const arm = new THREE.CylinderGeometry(0.015, 0.015, 0.14, 8);
  arm.rotateZ(Math.PI / 2);
  arm.translate(-0.95, 1.35, 0.82);
  const head = box(0.03, 0.14, 0.1);
  head.translate(-1.02, 1.36, 0.82);
  addMesh('mirror_left', merge([arm, head]), materials.chrome);
}

// --- Running boards ----------------------------------------------------------
for (const side of [-1, 1]) {
  const name = side < 0 ? 'running_board_left' : 'running_board_right';
  const board = box(0.26, 0.05, 1.3);
  board.translate(side * 0.84, 0.52, 0.3);
  addMesh(name, board, materials.accent);
}

// --- Bed (sides, floor, rear fenders), tailgate ------------------------------
{
  for (const side of [-1, 1]) {
    const name = side < 0 ? 'bed_side_left' : 'bed_side_right';
    const panel = box(0.06, 0.5, 1.78);
    panel.translate(side * 0.7, 0.86, -1.39);
    const rail = box(0.1, 0.06, 1.78);
    rail.translate(side * 0.7, 1.14, -1.39);
    addMesh(name, merge([panel, rail]), materials.body);

    const fname = side < 0 ? 'rear_fender_left' : 'rear_fender_right';
    const shell = arch(0.46, 0.24);
    shell.translate(side * 0.85, 0.4, -1.42);
    addMesh(fname, shell, materials.body);
  }

  const floor = box(1.34, 0.05, 1.78);
  floor.translate(0, 0.63, -1.39);
  const front = box(1.34, 0.46, 0.05);
  front.translate(0, 0.88, -0.52);
  addMesh('bed_floor', merge([floor, front]), materials.bed);

  const gate = box(1.34, 0.48, 0.06);
  gate.translate(0, 0.87, -2.3);
  addMesh('tailgate', gate, materials.body);
}

// --- Exhaust (two variants) --------------------------------------------------
{
  const run = new THREE.CylinderGeometry(0.035, 0.035, 2.4, 10);
  run.rotateX(Math.PI / 2);
  run.translate(0.32, 0.3, -1.0);
  const tip = new THREE.CylinderGeometry(0.045, 0.045, 0.25, 10);
  tip.rotateX(Math.PI / 2);
  tip.translate(0.32, 0.3, -2.35);
  addMesh('exhaust_stock', merge([run, tip]), materials.steel);

  for (const side of [-1, 1]) {
    const name = side < 0 ? 'exhaust_side_left' : 'exhaust_side_right';
    const pipe = new THREE.CylinderGeometry(0.05, 0.06, 1.5, 12);
    pipe.rotateX(Math.PI / 2);
    pipe.translate(side * 0.9, 0.45, 0.15);
    const header = new THREE.CylinderGeometry(0.04, 0.05, 0.4, 10);
    header.rotateX(Math.PI / 2);
    header.rotateY(side * -0.5);
    header.translate(side * 0.78, 0.5, 1.0);
    addMesh(name, merge([pipe, header]), materials.chrome);
  }
}

// --- Interior & engine -------------------------------------------------------
{
  const base = box(1.4, 0.24, 0.5);
  base.translate(0, 0.72, -0.02);
  const back = box(1.4, 0.42, 0.14);
  back.translate(0, 1.02, -0.22);
  addMesh('seat_bench', merge([base, back]), materials.interior);

  const rim = new THREE.TorusGeometry(0.19, 0.02, 8, 24);
  rim.rotateX(-1.15);
  rim.translate(-0.38, 1.12, 0.72);
  const column = new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8);
  column.rotateX(0.42);
  column.translate(-0.38, 1.05, 0.8);
  addMesh('steering_wheel', merge([rim, column]), materials.interior);

  const blockG = box(0.62, 0.5, 0.8);
  blockG.translate(0, 0.85, 1.62);
  const fan = new THREE.CylinderGeometry(0.16, 0.16, 0.06, 16);
  fan.rotateX(Math.PI / 2);
  fan.translate(0, 0.9, 2.06);
  addMesh('engine_block', merge([blockG, fan]), materials.steel);
}

// --- Export ------------------------------------------------------------------

const exporter = new GLTFExporter();
const glb = await new Promise((resolve, reject) => {
  exporter.parse(root, resolve, reject, { binary: true });
});

const outDir = path.resolve(process.cwd(), 'public/assets/vehicles');
await mkdir(outDir, { recursive: true });
const outPath = path.join(outDir, 'tf100-stepside.glb');
await writeFile(outPath, Buffer.from(glb));

const meshCount = root.children.length;
console.log(
  `Wrote ${outPath} (${(glb.byteLength / 1024).toFixed(1)} KiB, ${meshCount} named meshes)`,
);
console.log(root.children.map((c) => c.name).join(', '));
