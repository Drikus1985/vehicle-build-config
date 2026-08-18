import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGLTF, Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { AssetManifest, Build } from '@/lib/schemas';
import { getPart, getVariant, hasActiveOemWheelset } from '@/lib/catalog';
import { computeTyreSpec } from '@/lib/fitment/tyres';
import { statusMeta } from '@/lib/titanforge';
import { newId } from '@/lib/build/defaults';
import { useUiStore } from '@/state/uiStore';
import { addAnnotation } from '@/state/buildActions';
import { Wheels } from './Wheels';
import { GeneratedPlates } from './PlateMeshes';

const ACCENT = new THREE.Color('#f59e0b');
const HOVER = new THREE.Color('#f5cf8b');

/** Original material values captured at load, used to reset after paint/ghost. */
interface MaterialSnapshot {
  color: THREE.Color;
  metalness: number;
  roughness: number;
  opacity: number;
  transparent: boolean;
}

interface NodeEntry {
  /** The named node — a Mesh, or a Group for multi-primitive glTF nodes. */
  object: THREE.Object3D;
  meshes: THREE.Mesh[];
  /** Our per-node material clones (paintable zones get fresh physical materials,
   *  everything else keeps a clone of the asset's original PBR material). */
  materials: THREE.MeshStandardMaterial[];
  originals: MaterialSnapshot[];
  paintable: boolean;
  zoneId: string | null;
  componentId: string | null;
  basePosition: THREE.Vector3;
  explodeOffset: THREE.Vector3 | null;
}

interface VehicleModelProps {
  manifest: AssetManifest;
  /** The build to display (current build, or stock reference in compare mode). */
  build: Build;
  interactive: boolean;
}

function collectMeshes(object: THREE.Object3D): THREE.Mesh[] {
  const meshes: THREE.Mesh[] = [];
  object.traverse((o) => {
    if (o instanceof THREE.Mesh) meshes.push(o);
  });
  return meshes;
}

export function VehicleModel({ manifest, build, interactive }: VehicleModelProps) {
  // Load the base asset plus the optional add-on asset (e.g. project-original
  // scoops/spoilers fitted to a licensed base model). Node names from both
  // files share one namespace, defined by the manifest.
  const assetUrls = manifest.addonSource
    ? [manifest.source.uri, manifest.addonSource.uri]
    : [manifest.source.uri];
  const gltfs = useGLTF(assetUrls);
  const mainScene = gltfs[0]!.scene;
  const addonScene = gltfs[1]?.scene ?? null;
  const bodyRef = useRef<THREE.Group>(null);

  const select = useUiStore((s) => s.select);
  const hover = useUiStore((s) => s.hover);
  const selectedComponentId = useUiStore((s) => s.selectedComponentId);
  const hoveredComponentId = useUiStore((s) => s.hoveredComponentId);
  const isolatedComponentId = useUiStore((s) => s.isolatedComponentId);
  const ghostMode = useUiStore((s) => s.ghostMode);
  const explodeFactor = useUiStore((s) => s.explodeFactor);
  const mode = useUiStore((s) => s.mode);
  const fabFilter = useUiStore((s) => s.fabFilter);
  const placingAnnotation = useUiStore((s) => s.placingAnnotation);
  const setPlacingAnnotation = useUiStore((s) => s.setPlacingAnnotation);
  const toast = useUiStore((s) => s.toast);

  // Clone the cached scene and give every mapped node its own materials.
  // Paintable zones get fresh physical materials driven by build paint;
  // non-paintable zones keep clones of the asset's original PBR materials
  // (preserving chrome/glass/transmission looks from real assets).
  const { root, nodes } = useMemo(() => {
    const root = new THREE.Group();
    root.add(mainScene.clone(true));
    if (addonScene) root.add(addonScene.clone(true));
    const nodes = new Map<string, NodeEntry>();
    const zoneById = new Map(manifest.materialZones.map((z) => [z.id, z]));
    for (const nodeDef of manifest.meshNodes) {
      const obj = root.getObjectByName(nodeDef.nodeName);
      if (!obj) continue;
      const meshes = collectMeshes(obj);
      if (meshes.length === 0) continue;
      const zone = nodeDef.materialZoneId ? zoneById.get(nodeDef.materialZoneId) : undefined;
      const paintable = zone?.paintable === true;
      const materials: THREE.MeshStandardMaterial[] = [];
      const originals: MaterialSnapshot[] = [];
      for (const mesh of meshes) {
        let material: THREE.MeshStandardMaterial;
        if (paintable && zone) {
          material = new THREE.MeshPhysicalMaterial({
            color: zone.defaultColorHex,
            metalness: zone.defaultFinish.metallic,
            roughness: zone.defaultFinish.roughness,
            clearcoat: zone.defaultFinish.clearcoat,
            side: THREE.DoubleSide,
          });
        } else {
          const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
          material =
            source instanceof THREE.MeshStandardMaterial
              ? (source.clone() as THREE.MeshStandardMaterial)
              : new THREE.MeshStandardMaterial({
                  color: zone?.defaultColorHex ?? '#888888',
                  metalness: zone?.defaultFinish.metallic ?? 0.2,
                  roughness: zone?.defaultFinish.roughness ?? 0.5,
                });
        }
        mesh.material = material;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        materials.push(material);
        originals.push({
          color: material.color.clone(),
          metalness: material.metalness,
          roughness: material.roughness,
          opacity: material.opacity,
          transparent: material.transparent,
        });
      }
      nodes.set(nodeDef.nodeName, {
        object: obj,
        meshes,
        materials,
        originals,
        paintable,
        zoneId: nodeDef.materialZoneId,
        componentId: nodeDef.componentId,
        basePosition: obj.position.clone(),
        explodeOffset: nodeDef.explodeOffset ? new THREE.Vector3(...nodeDef.explodeOffset) : null,
      });
    }
    return { root, nodes };
  }, [mainScene, addonScene, manifest]);

  useEffect(() => {
    return () => {
      // Cloned materials are ours to dispose; geometries belong to the loader cache.
      for (const entry of nodes.values()) entry.materials.forEach((m) => m.dispose());
    };
  }, [nodes]);

  // Per-part variant lookup for the displayed build.
  const installedByPart = useMemo(() => {
    const map = new Map<string, { removed: boolean; hidden: boolean; variantId: string | null }>();
    for (const p of build.installed) map.set(p.partId, p);
    return map;
  }, [build.installed]);

  const oemWheelsActive = useMemo(() => hasActiveOemWheelset(build), [build]);

  // --- Paint & material overrides ------------------------------------------
  useEffect(() => {
    const bodyColor = build.paint['body']?.colorHex ?? '#888888';
    for (const entry of nodes.values()) {
      const paint = entry.zoneId ? build.paint[entry.zoneId] : undefined;
      const installed = entry.componentId ? installedByPart.get(entry.componentId) : undefined;
      const variant = installed?.variantId ? getVariant(installed.variantId) : undefined;
      const override = variant?.visual.kind === 'material-override' ? variant.visual : null;

      entry.materials.forEach((material, i) => {
        const original = entry.originals[i]!;
        // Base state: build paint for paintable zones, asset original otherwise.
        if (entry.paintable && paint) {
          material.color.set(paint.colorHex);
          material.metalness = paint.metallic;
          material.roughness = Math.max(0.02, paint.roughness);
          if (material instanceof THREE.MeshPhysicalMaterial) {
            material.clearcoat = paint.clearcoat;
            material.clearcoatRoughness = 0.08;
          }
        } else {
          material.color.copy(original.color);
          material.metalness = original.metalness;
          material.roughness = original.roughness;
        }
        // material-override variants (e.g. painted bumpers) take precedence.
        if (override) {
          if (override.useBodyColor) material.color.set(bodyColor);
          else if (override.colorHex) material.color.set(override.colorHex);
          if (override.metallic !== undefined) material.metalness = override.metallic;
          if (override.roughness !== undefined) material.roughness = override.roughness;
        }
        // Glass tint darkens and thickens the glass zone.
        if (entry.zoneId === 'glass') {
          material.color.lerp(new THREE.Color('#090b0d'), build.glassTint);
        }
      });
    }
  }, [nodes, build.paint, build.glassTint, installedByPart]);

  // Baked plate meshes are replaced by generated plates (PlateMeshes).
  const replacedPlateNodes = useMemo(
    () => new Set(manifest.plateMounts.flatMap((m) => m.hideNodeNames)),
    [manifest],
  );

  // --- Visibility (install/remove, variants, isolate) -----------------------
  useEffect(() => {
    for (const [nodeName, entry] of nodes) {
      if (replacedPlateNodes.has(nodeName)) {
        entry.object.visible = false;
        continue;
      }
      let visible = true;
      if (entry.componentId) {
        const part = getPart(entry.componentId);
        const installed = installedByPart.get(entry.componentId);
        if (!installed || installed.removed || installed.hidden) visible = false;
        // Mesh-swap variants decide which of the part's nodes shows.
        if (visible && part && part.variantIds.length > 0) {
          const variant = installed?.variantId ? getVariant(installed.variantId) : undefined;
          if (variant?.visual.kind === 'mesh-swap') {
            visible = variant.visual.visibleNodeIds.includes(nodeName);
          }
        }
        if (visible && isolatedComponentId && entry.componentId !== isolatedComponentId) {
          visible = false;
        }
      }
      entry.object.visible = visible;
    }
  }, [nodes, installedByPart, isolatedComponentId, replacedPlateNodes]);

  // --- Highlights, fabrication overlay, ghost mode --------------------------
  useEffect(() => {
    for (const entry of nodes.values()) {
      const componentId = entry.componentId;
      const isSelected = componentId !== null && componentId === selectedComponentId;
      const isHovered = componentId !== null && componentId === hoveredComponentId;
      const record = componentId ? build.fabricationRecords[componentId] : undefined;

      let emissive: THREE.Color | null = null;
      let intensity = 0;
      if (mode === 'fabrication' && record && record.status !== 'stock') {
        const matches =
          fabFilter === 'all' ||
          fabFilter === 'affected' ||
          (fabFilter === 'scan' && (record.status === 'needs-3d-scan' || record.scanRequired)) ||
          (fabFilter === 'print' && record.status === 'print-candidate') ||
          fabFilter === record.status;
        if (matches) {
          emissive = new THREE.Color(statusMeta(record.status).colorHex);
          intensity = isSelected ? 0.85 : 0.4;
        }
      }
      if (isSelected && !emissive) {
        emissive = ACCENT;
        intensity = 0.5;
      } else if (isHovered && !emissive && interactive) {
        emissive = HOVER;
        intensity = 0.25;
      } else if (isHovered && emissive) {
        intensity = Math.min(1, intensity + 0.2);
      }

      // Ghost/x-ray: everything except the selected component becomes translucent.
      const ghosted =
        (ghostMode && !isSelected) ||
        (mode === 'fabrication' &&
          fabFilter !== 'all' &&
          !(record && record.status !== 'stock' && emissive));

      entry.materials.forEach((material, i) => {
        const original = entry.originals[i]!;
        material.emissive.copy(emissive ?? new THREE.Color(0x000000));
        material.emissiveIntensity = intensity;
        if (ghosted) {
          material.transparent = true;
          material.opacity = Math.min(original.opacity, 0.14);
          material.depthWrite = false;
        } else if (entry.zoneId === 'glass') {
          material.opacity = Math.min(0.92, original.opacity + build.glassTint * 0.55);
          material.transparent = true;
          material.depthWrite = false;
        } else {
          material.opacity = original.opacity;
          material.transparent = original.transparent;
          material.depthWrite = !original.transparent;
        }
      });
    }
  }, [
    nodes,
    selectedComponentId,
    hoveredComponentId,
    ghostMode,
    mode,
    fabFilter,
    build.fabricationRecords,
    build.glassTint,
    interactive,
  ]);

  // --- Exploded view --------------------------------------------------------
  useEffect(() => {
    for (const entry of nodes.values()) {
      if (entry.explodeOffset) {
        entry.object.position
          .copy(entry.basePosition)
          .addScaledVector(entry.explodeOffset, explodeFactor);
      }
    }
  }, [nodes, explodeFactor]);

  // --- Stance: body lift/rake from ride height + tyre diameter --------------
  // Suspended while a factory (in-model) wheel set is installed, because the
  // baked wheels cannot follow the parametric stance rig.
  const frontAnchor = manifest.wheelAnchors.find((a) => a.axle === 'front');
  const rearAnchor = manifest.wheelAnchors.find((a) => a.axle === 'rear');
  const stancePose = useMemo(() => {
    if (!frontAnchor || !rearAnchor || oemWheelsActive) return { lift: 0, pitch: 0 };
    const frontR = computeTyreSpec(build.wheels.front.tyre).diameterMm / 2000;
    const rearR = computeTyreSpec(build.wheels.rear.tyre).diameterMm / 2000;
    const frontLift = frontR - frontAnchor.position[1] + build.stance.rideHeightFrontMm / 1000;
    const rearLift = rearR - rearAnchor.position[1] + build.stance.rideHeightRearMm / 1000;
    const wheelbase = Math.abs(frontAnchor.position[2] - rearAnchor.position[2]);
    return {
      lift: (frontLift + rearLift) / 2,
      pitch: Math.atan2(rearLift - frontLift, wheelbase),
    };
  }, [
    frontAnchor,
    rearAnchor,
    oemWheelsActive,
    build.wheels.front.tyre,
    build.wheels.rear.tyre,
    build.stance,
  ]);

  // --- Pointer interaction --------------------------------------------------
  const resolveComponent = (
    object: THREE.Object3D,
  ): { componentId: string | null; nodeName: string } | null => {
    let o: THREE.Object3D | null = object;
    while (o) {
      const entry = nodes.get(o.name);
      if (entry) return { componentId: entry.componentId, nodeName: o.name };
      o = o.parent;
    }
    return null;
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    const hit = resolveComponent(e.object);
    if (placingAnnotation) {
      const body = bodyRef.current;
      if (body) {
        const local = body.worldToLocal(e.point.clone());
        addAnnotation({
          id: newId('ann'),
          componentId: hit?.componentId ?? null,
          position: [local.x, local.y, local.z],
          text: '',
          createdAt: new Date().toISOString(),
        });
        toast('success', 'Annotation placed — add text in the Titanforge tab.');
      }
      setPlacingAnnotation(false);
      return;
    }
    select(hit?.componentId ?? null);
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    const hit = resolveComponent(e.object);
    hover(hit?.componentId ?? null);
  };

  const onPointerOut = () => {
    if (interactive) hover(null);
  };

  return (
    <group>
      <group
        ref={bodyRef}
        position={[0, stancePose.lift, 0]}
        rotation={[stancePose.pitch, 0, 0]}
        onClick={onClick}
        onPointerMove={onPointerMove}
        onPointerOut={onPointerOut}
        onPointerMissed={() => {
          if (interactive && !placingAnnotation) select(null);
        }}
      >
        <primitive object={root} />
        <GeneratedPlates manifest={manifest} build={build} />
        {build.annotations.map((ann, index) => (
          <Html
            key={ann.id}
            position={ann.position}
            center
            distanceFactor={6}
            zIndexRange={[10, 0]}
          >
            <div className="annotation-marker" title={ann.text || 'Annotation'}>
              {index + 1}
            </div>
          </Html>
        ))}
      </group>
      {!oemWheelsActive && <Wheels manifest={manifest} build={build} />}
    </group>
  );
}
