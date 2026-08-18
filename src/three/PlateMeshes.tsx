/**
 * Generated numberplates: canvas-textured plate meshes rendered at the
 * manifest's plate mounts, replacing the asset's baked plate meshes. Purely
 * decorative — generic colourways with the build's custom text, not a
 * reproduction of any official plate design.
 */
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { AssetManifest, Build, PlateMount } from '@/lib/schemas';
import { getPlateStyle, sanitizePlateText } from '@/lib/plates';
import { useUiStore } from '@/state/uiStore';

function makePlateTexture(text: string, styleId: string): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const style = getPlateStyle(styleId);
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 217; // 520 x 110 mm long-format ratio
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background + rounded border line.
  ctx.fillStyle = style.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = style.border;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.roundRect(14, 14, canvas.width - 28, canvas.height - 28, 18);
  ctx.stroke();

  // Mounting bolts.
  ctx.fillStyle = style.border;
  for (const x of [52, canvas.width - 52]) {
    ctx.beginPath();
    ctx.arc(x, canvas.height / 2, 9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Centred text, shrunk to fit if long.
  const display = sanitizePlateText(text) || ' ';
  ctx.fillStyle = style.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  let fontSize = 150;
  do {
    ctx.font = `700 ${fontSize}px "Arial Narrow", "Helvetica Neue", Arial, sans-serif`;
    if (ctx.measureText(display).width <= canvas.width - 200) break;
    fontSize -= 10;
  } while (fontSize > 60);
  ctx.fillText(display, canvas.width / 2, canvas.height / 2 + 6);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function GeneratedPlate({ mount, build }: { mount: PlateMount; build: Build }) {
  const texture = useMemo(
    () => makePlateTexture(build.plateSetup.text, build.plateSetup.styleId),
    [build.plateSetup.text, build.plateSetup.styleId],
  );
  const materials = useMemo(() => {
    const face = new THREE.MeshStandardMaterial({
      map: texture ?? undefined,
      color: texture ? '#ffffff' : '#cccccc',
      metalness: 0.1,
      roughness: 0.5,
    });
    const backing = new THREE.MeshStandardMaterial({
      color: '#9a9da3',
      metalness: 0.7,
      roughness: 0.45,
    });
    return { face, backing };
  }, [texture]);

  useEffect(() => {
    return () => {
      texture?.dispose();
      materials.face.dispose();
      materials.backing.dispose();
    };
  }, [texture, materials]);

  const rotation = mount.rotationDeg.map((d) => THREE.MathUtils.degToRad(d)) as [
    number,
    number,
    number,
  ];

  return (
    // Named after the hidden baked node so viewport clicks resolve to the
    // owning part through the manifest's node -> component mapping.
    <group
      name={mount.hideNodeNames[0] ?? `plate_${mount.id}`}
      position={mount.position}
      rotation={rotation}
    >
      <mesh material={materials.backing}>
        <boxGeometry args={[mount.widthM, mount.heightM, 0.006]} />
      </mesh>
      <mesh position={[0, 0, 0.0035]} material={materials.face}>
        <planeGeometry args={[mount.widthM * 0.985, mount.heightM * 0.94]} />
      </mesh>
    </group>
  );
}

export function GeneratedPlates({ manifest, build }: { manifest: AssetManifest; build: Build }) {
  const isolatedComponentId = useUiStore((s) => s.isolatedComponentId);
  if (manifest.plateMounts.length === 0) return null;
  return (
    <>
      {manifest.plateMounts.map((mount) => {
        const installed = build.installed.find((p) => p.partId === mount.componentId);
        const visible =
          installed !== undefined &&
          !installed.removed &&
          !installed.hidden &&
          (!isolatedComponentId || isolatedComponentId === mount.componentId);
        if (!visible) return null;
        return <GeneratedPlate key={mount.id} mount={mount} build={build} />;
      })}
    </>
  );
}
