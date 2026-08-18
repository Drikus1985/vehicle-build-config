/**
 * Dev tool: derive livery anchor data for the Nova's UV-mapped asset.
 *
 * For each named probe point (car space, metres) it finds the outermost
 * nearby vertex of the target node in `public/assets/vehicles/nova-1970-uv.glb`,
 * reads its UV, and computes the local UV-per-metre frame (how UV changes per
 * metre along the panel's "text right" and "text up" directions, as read from
 * outside the car). The output is pasted into the manifest's `liveryAnchors`.
 *
 *   node scripts/probe-nova-livery-anchors.mjs
 */
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const GLB = new URL('../public/assets/vehicles/nova-1970-uv.glb', import.meta.url);

// id, node, probe point, outward axis (+1 component index sign encoded), text
// directions per the reading convention (sides read from outside, hood/roof
// read from the front, trunk read from the rear).
const PROBES = [
  {
    id: 'door-l',
    node: 'door',
    p: [0.9, 0.75, 0.5],
    out: ['x', 1],
    right: [0, 0, -1],
    up: [0, 1, 0],
  },
  {
    id: 'door-r',
    node: 'door',
    p: [-0.9, 0.75, 0.5],
    out: ['x', -1],
    right: [0, 0, 1],
    up: [0, 1, 0],
  },
  {
    id: 'quarter-l',
    node: 'fender_b',
    p: [0.92, 0.8, -1.7],
    out: ['x', 1],
    right: [0, 0, -1],
    up: [0, 1, 0],
  },
  {
    id: 'quarter-r',
    node: 'fender_b',
    p: [-0.92, 0.8, -1.7],
    out: ['x', -1],
    right: [0, 0, 1],
    up: [0, 1, 0],
  },
  {
    id: 'fender-l',
    node: 'fender_f',
    p: [0.9, 0.78, 2.05],
    out: ['x', 1],
    right: [0, 0, -1],
    up: [0, 1, 0],
  },
  {
    id: 'fender-r',
    node: 'fender_f',
    p: [-0.9, 0.78, 2.05],
    out: ['x', -1],
    right: [0, 0, 1],
    up: [0, 1, 0],
  },
  { id: 'hood', node: 'hood', p: [0, 1.05, 1.35], out: ['y', 1], right: [1, 0, 0], up: [0, 0, -1] },
  {
    id: 'roof',
    node: 'fender_b',
    p: [0, 1.43, -0.15],
    out: ['y', 1],
    right: [1, 0, 0],
    up: [0, 0, -1],
  },
  {
    id: 'trunk',
    node: 'tailgate',
    p: [0, 1.07, -1.85],
    out: ['y', 1],
    right: [-1, 0, 0],
    up: [0, 0, 1],
  },
];

const buffer = await readFile(GLB);
const loader = new GLTFLoader();
const gltf = await new Promise((resolve, reject) =>
  loader.parse(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    '',
    resolve,
    reject,
  ),
);
gltf.scene.updateMatrixWorld(true);

function meshesOf(name) {
  const obj = gltf.scene.getObjectByName(name);
  if (!obj) throw new Error(`node not found: ${name}`);
  const meshes = [];
  obj.traverse((o) => o.isMesh && meshes.push(o));
  return meshes;
}

/** Least-squares d(uv)/d(direction) over a vertex's incident triangles. */
function uvGradient(mesh, vertexIndex, dir) {
  const pos = mesh.geometry.getAttribute('position');
  const uv = mesh.geometry.getAttribute('uv');
  const index = mesh.geometry.getIndex();
  const d = new THREE.Vector3(...dir);
  const results = [];
  for (let i = 0; i < index.count; i += 3) {
    const tri = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    if (!tri.includes(vertexIndex)) continue;
    const p = tri.map((v) =>
      new THREE.Vector3().fromBufferAttribute(pos, v).applyMatrix4(mesh.matrixWorld),
    );
    const t = tri.map((v) => new THREE.Vector2(uv.getX(v), uv.getY(v)));
    const e1 = p[1].clone().sub(p[0]);
    const e2 = p[2].clone().sub(p[0]);
    // Solve d ≈ a·e1 + b·e2 (least squares in the triangle plane).
    const g11 = e1.dot(e1),
      g12 = e1.dot(e2),
      g22 = e2.dot(e2);
    const det = g11 * g22 - g12 * g12;
    if (Math.abs(det) < 1e-12) continue;
    const b1 = d.dot(e1),
      b2 = d.dot(e2);
    const a = (g22 * b1 - g12 * b2) / det;
    const b = (g11 * b2 - g12 * b1) / det;
    // Skip triangles nearly perpendicular to the probe direction.
    const proj = e1.clone().multiplyScalar(a).add(e2.clone().multiplyScalar(b));
    if (proj.length() < 0.35) continue;
    results.push([
      a * (t[1].x - t[0].x) + b * (t[2].x - t[0].x),
      a * (t[1].y - t[0].y) + b * (t[2].y - t[0].y),
    ]);
  }
  if (results.length === 0) return null;
  const du = results.reduce((s, r) => s + r[0], 0) / results.length;
  const dv = results.reduce((s, r) => s + r[1], 0) / results.length;
  return [du, dv];
}

// Final decal centres (car space). The islands are affine (cross terms ~0.001),
// so the anchor UV is the probed vertex UV plus the Jacobian times the offset.
const ANCHORS = {
  'door-l': [0.93, 0.74, 0.5],
  'door-r': [-0.93, 0.74, 0.5],
  'quarter-l': [0.93, 0.84, -1.8],
  'quarter-r': [-0.93, 0.84, -1.8],
  'fender-l': [0.93, 0.8, 2.0],
  'fender-r': [-0.93, 0.8, 2.0],
  hood: [0, 1.0, 1.55],
  roof: [0, 1.44, -0.2],
  trunk: [0, 1.09, -1.85],
};

const AXIS = { x: 0, y: 1, z: 2 };
const results = new Map();
for (const probe of PROBES) {
  const target = new THREE.Vector3(...probe.p);
  let best = null; // outermost vertex within radius of the probe point
  for (const mesh of meshesOf(probe.node)) {
    const pos = mesh.geometry.getAttribute('position');
    const uv = mesh.geometry.getAttribute('uv');
    if (!uv) continue;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      const dist = v.distanceTo(target);
      if (dist > 0.22) continue;
      const outward = v.getComponent(AXIS[probe.out[0]]) * probe.out[1];
      if (
        !best ||
        outward > best.outward + 1e-4 ||
        (Math.abs(outward - best.outward) <= 1e-4 && dist < best.dist)
      ) {
        best = { mesh, i, dist, outward, pos: v.clone(), uv: [uv.getX(i), uv.getY(i)] };
      }
    }
  }
  if (!best) {
    console.log(`${probe.id}: NO VERTEX near probe`, probe.p);
    continue;
  }
  const right = uvGradient(best.mesh, best.i, probe.right);
  const up = uvGradient(best.mesh, best.i, probe.up);
  const fmt = (n) => Number(n.toFixed(4));
  if (!right || !up) {
    console.log(`${probe.id}: could not derive UV gradients`);
    continue;
  }
  const delta = new THREE.Vector3(...ANCHORS[probe.id]).sub(best.pos);
  const dr = delta.dot(new THREE.Vector3(...probe.right));
  const du = delta.dot(new THREE.Vector3(...probe.up));
  const anchorUv = [
    best.uv[0] + right[0] * dr + up[0] * du,
    best.uv[1] + right[1] * dr + up[1] * du,
  ];
  console.log(
    JSON.stringify({
      id: probe.id,
      vertex: best.pos.toArray().map(fmt),
      dist: fmt(best.dist),
      uv: anchorUv.map(fmt),
      rightUvPerM: right.map(fmt),
      upUvPerM: up.map(fmt),
    }),
  );
  results.set(probe.id, { probe, best, right, up });
}

// --- Panel frames (manifest `liveryPanels`) --------------------------------
// One affine car-space→UV frame per island, anchored at the probed vertex.
// Each body side (fender_f + door + fender_b) is a single affine island —
// verified by predicting the quarter/fender vertex UVs from the door frame
// (errors < 0.001 UV). Pre-designed schemes project car-space polygons
// through these frames.
console.log('\nliveryPanels:');
const PANEL_FROM_PROBE = {
  'side-l': 'door-l',
  'side-r': 'door-r',
  hood: 'hood',
  roof: 'roof',
  trunk: 'trunk',
};
for (const [panelId, probeId] of Object.entries(PANEL_FROM_PROBE)) {
  const r = results.get(probeId);
  if (!r) continue;
  const fmt = (n) => Number(n.toFixed(4));
  console.log(
    JSON.stringify({
      id: panelId,
      origin: r.best.pos.toArray().map(fmt),
      rightDir: r.probe.right,
      upDir: r.probe.up,
      uv: r.best.uv.map(fmt),
      rightUvPerM: r.right.map(fmt),
      upUvPerM: r.up.map(fmt),
    }),
  );
}
