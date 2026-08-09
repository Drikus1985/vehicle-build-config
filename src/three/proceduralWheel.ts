/**
 * Parametric wheel + tyre builder. Wheels are generated at runtime from the
 * axle setup (style, finish, sizes) so no external wheel assets are needed and
 * geometry updates are non-destructive to the source vehicle model.
 *
 * Wheel axis is +X (outboard face at +X); callers mirror for the left side.
 */
import * as THREE from 'three';
import type { TyreSetup, WheelStyle } from '@/lib/schemas';
import { computeTyreSpec, MM_PER_IN } from '@/lib/fitment/tyres';

export type WheelFinish =
  'chrome' | 'polished' | 'satin-black' | 'gloss-black' | 'body-color' | 'steel';

export interface WheelParams {
  style: WheelStyle;
  finish: WheelFinish;
  widthIn: number;
  tyre: TyreSetup;
  /** Used when finish === 'body-color'. */
  bodyColorHex: string;
}

const FINISHES: Record<
  Exclude<WheelFinish, 'body-color'>,
  { color: string; metalness: number; roughness: number }
> = {
  chrome: { color: '#e8eaee', metalness: 1, roughness: 0.08 },
  polished: { color: '#cfd2d8', metalness: 1, roughness: 0.18 },
  'satin-black': { color: '#2a2c30', metalness: 0.6, roughness: 0.55 },
  'gloss-black': { color: '#131417', metalness: 0.4, roughness: 0.18 },
  steel: { color: '#8f939b', metalness: 0.85, roughness: 0.4 },
};

export interface BuiltWheel {
  group: THREE.Group;
  /** Overall tyre radius in metres (wheel centre height when on the ground). */
  radiusM: number;
  dispose: () => void;
}

export function buildWheel(params: WheelParams): BuiltWheel {
  const spec = computeTyreSpec(params.tyre);
  const tyreR = spec.diameterMm / 2000;
  const rimR = (params.tyre.rimIn * MM_PER_IN) / 2000;
  const width = Math.max((params.widthIn * MM_PER_IN) / 1000, params.tyre.widthMm / 1000) * 0.92;

  const group = new THREE.Group();
  group.name = 'procedural_wheel';
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  const track = <T extends THREE.BufferGeometry>(g: T): T => {
    geometries.push(g);
    return g;
  };
  const mat = (opts: THREE.MeshStandardMaterialParameters): THREE.MeshStandardMaterial => {
    const m = new THREE.MeshStandardMaterial(opts);
    materials.push(m);
    return m;
  };

  const finishSpec =
    params.finish === 'body-color'
      ? { color: params.bodyColorHex, metalness: 0.3, roughness: 0.35 }
      : FINISHES[params.finish];
  const faceMat = mat(finishSpec);
  const rubberMat = mat({
    color: '#17181a',
    metalness: 0,
    roughness: params.tyre.type === 'drag-slick' ? 0.95 : 0.85,
  });
  const darkMat = mat({ color: '#0c0d0f', metalness: 0.2, roughness: 0.7 });

  // Tyre: outer cylinder + sidewall tori for a rounded shoulder.
  const tyreBody = new THREE.Mesh(
    track(new THREE.CylinderGeometry(tyreR, tyreR, width, 40, 1, true)),
    rubberMat,
  );
  tyreBody.rotation.z = Math.PI / 2;
  group.add(tyreBody);
  for (const side of [-1, 1]) {
    const sidewall = new THREE.Mesh(
      track(new THREE.TorusGeometry(tyreR - (tyreR - rimR) * 0.35, (tyreR - rimR) * 0.38, 12, 40)),
      rubberMat,
    );
    sidewall.rotation.y = Math.PI / 2;
    sidewall.position.x = side * width * 0.42;
    group.add(sidewall);
  }

  // Whitewall / raised-letter treatments on the outboard sidewall.
  if (params.tyre.whitewall) {
    const ring = new THREE.Mesh(
      track(new THREE.RingGeometry(rimR + 0.01, rimR + (tyreR - rimR) * 0.55, 40)),
      mat({ color: '#efeee6', metalness: 0, roughness: 0.7, side: THREE.DoubleSide }),
    );
    ring.rotation.y = Math.PI / 2;
    ring.position.x = width * 0.5 + 0.001;
    group.add(ring);
  } else if (params.tyre.raisedLetters) {
    const band = new THREE.Mesh(
      track(new THREE.TorusGeometry(tyreR - (tyreR - rimR) * 0.3, 0.004, 6, 40)),
      mat({ color: '#d9d7ce', metalness: 0, roughness: 0.8 }),
    );
    band.rotation.y = Math.PI / 2;
    band.position.x = width * 0.44;
    group.add(band);
  }

  // Rim barrel.
  const barrel = new THREE.Mesh(
    track(new THREE.CylinderGeometry(rimR, rimR, width * 0.86, 32, 1, true)),
    faceMat,
  );
  barrel.rotation.z = Math.PI / 2;
  group.add(barrel);

  // Face per style.
  const faceX = width * 0.42;
  const addFaceDisc = (inset = 0) => {
    const disc = new THREE.Mesh(
      track(new THREE.CylinderGeometry(rimR * 0.98, rimR * 0.98, 0.015, 32)),
      faceMat,
    );
    disc.rotation.z = Math.PI / 2;
    disc.position.x = faceX - inset;
    group.add(disc);
    return disc;
  };

  switch (params.style) {
    case 'steelie': {
      addFaceDisc(0.008);
      const cap = new THREE.Mesh(track(new THREE.SphereGeometry(rimR * 0.32, 20, 12)), faceMat);
      cap.scale.set(0.5, 1, 1);
      cap.position.x = faceX;
      group.add(cap);
      break;
    }
    case 'smoothie': {
      const moon = new THREE.Mesh(track(new THREE.SphereGeometry(rimR * 0.97, 28, 14)), faceMat);
      moon.scale.set(0.22, 1, 1);
      moon.position.x = faceX - 0.004;
      group.add(moon);
      break;
    }
    case 'five-spoke': {
      addFaceDisc(rimR * 0.9); // deep inner disc
      for (let i = 0; i < 5; i++) {
        const spoke = new THREE.Mesh(
          track(new THREE.BoxGeometry(0.02, rimR * 1.8, rimR * 0.3)),
          faceMat,
        );
        spoke.position.x = faceX - 0.01;
        spoke.rotation.x = (i / 5) * Math.PI * 2;
        group.add(spoke);
      }
      const hub = new THREE.Mesh(
        track(new THREE.CylinderGeometry(rimR * 0.24, rimR * 0.24, 0.03, 16)),
        faceMat,
      );
      hub.rotation.z = Math.PI / 2;
      hub.position.x = faceX;
      group.add(hub);
      break;
    }
    case 'slot-mag': {
      addFaceDisc(0.006);
      for (let i = 0; i < 6; i++) {
        const slot = new THREE.Mesh(
          track(new THREE.CylinderGeometry(rimR * 0.16, rimR * 0.16, 0.02, 12)),
          darkMat,
        );
        slot.rotation.z = Math.PI / 2;
        const angle = (i / 6) * Math.PI * 2;
        slot.position.set(
          faceX + 0.002,
          Math.cos(angle) * rimR * 0.55,
          Math.sin(angle) * rimR * 0.55,
        );
        group.add(slot);
      }
      break;
    }
    case 'rally': {
      addFaceDisc(0.006);
      for (let i = 0; i < 4; i++) {
        const slot = new THREE.Mesh(
          track(new THREE.BoxGeometry(0.02, rimR * 0.28, rimR * 0.5)),
          darkMat,
        );
        const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
        slot.position.set(
          faceX + 0.002,
          Math.cos(angle) * rimR * 0.58,
          Math.sin(angle) * rimR * 0.58,
        );
        slot.rotation.x = angle;
        group.add(slot);
      }
      const trimRing = new THREE.Mesh(
        track(new THREE.TorusGeometry(rimR * 0.92, 0.006, 8, 32)),
        mat(FINISHES.chrome),
      );
      trimRing.rotation.y = Math.PI / 2;
      trimRing.position.x = faceX + 0.004;
      group.add(trimRing);
      break;
    }
  }

  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
    }
  });

  return {
    group,
    radiusM: tyreR,
    dispose: () => {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    },
  };
}
