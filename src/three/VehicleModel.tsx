import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGLTF, Html } from '@react-three/drei';
import type { ThreeEvent } from '@react-three/fiber';
import type { AssetManifest, Build } from '@/lib/schemas';
import { getPart, getVariant } from '@/lib/catalog';
import { computeTyreSpec } from '@/lib/fitment/tyres';
import { statusMeta } from '@/lib/titanforge';
import { newId } from '@/lib/build/defaults';
import { useUiStore } from '@/state/uiStore';
import { addAnnotation } from '@/state/buildActions';
import { Wheels } from './Wheels';

const ACCENT = new THREE.Color('#f59e0b');
const HOVER = new THREE.Color('#f5cf8b');

interface NodeEntry {
  mesh: THREE.Mesh;
  material: THREE.MeshPhysicalMaterial;
  zoneId: string | null;
  componentId: string | null;
  basePosition: THREE.Vector3;
  explodeOffset: THREE.Vector3 | null;
  baseOpacity: number;
}

interface VehicleModelProps {
  manifest: AssetManifest;
  /** The build to display (current build, or stock reference in compare mode). */
  build: Build;
  interactive: boolean;
}

export function VehicleModel({ manifest, build, interactive }: VehicleModelProps) {
  const gltf = useGLTF(manifest.source.uri);
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

  // Clone the cached scene and give every mapped node its own physical
  // material so zones, overrides, ghosting and highlights are per-node.
  const { root, nodes } = useMemo(() => {
    const root = gltf.scene.clone(true);
    const nodes = new Map<string, NodeEntry>();
    const zoneById = new Map(manifest.materialZones.map((z) => [z.id, z]));
    for (const nodeDef of manifest.meshNodes) {
      const obj = root.getObjectByName(nodeDef.nodeName);
      if (!(obj instanceof THREE.Mesh)) continue;
      const zone = nodeDef.materialZoneId ? zoneById.get(nodeDef.materialZoneId) : undefined;
      const material = new THREE.MeshPhysicalMaterial({
        color: zone?.defaultColorHex ?? '#888888',
        metalness: zone?.defaultFinish.metallic ?? 0.2,
        roughness: zone?.defaultFinish.roughness ?? 0.5,
        clearcoat: zone?.defaultFinish.clearcoat ?? 0,
        side: THREE.DoubleSide,
      });
      const baseOpacity = nodeDef.materialZoneId === 'glass' ? 0.45 : 1;
      if (baseOpacity < 1) {
        material.transparent = true;
        material.opacity = baseOpacity;
      }
      obj.material = material;
      obj.castShadow = true;
      obj.receiveShadow = true;
      nodes.set(nodeDef.nodeName, {
        mesh: obj,
        material,
        zoneId: nodeDef.materialZoneId,
        componentId: nodeDef.componentId,
        basePosition: obj.position.clone(),
        explodeOffset: nodeDef.explodeOffset ? new THREE.Vector3(...nodeDef.explodeOffset) : null,
        baseOpacity,
      });
    }
    return { root, nodes };
  }, [gltf.scene, manifest]);

  useEffect(() => {
    return () => {
      // Cloned materials are ours to dispose; geometries belong to the loader cache.
      for (const entry of nodes.values()) entry.material.dispose();
    };
  }, [nodes]);

  // Per-part variant lookup for the displayed build.
  const installedByPart = useMemo(() => {
    const map = new Map<string, { removed: boolean; hidden: boolean; variantId: string | null }>();
    for (const p of build.installed) map.set(p.partId, p);
    return map;
  }, [build.installed]);

  // --- Paint & material overrides ------------------------------------------
  useEffect(() => {
    const bodyColor = build.paint['body']?.colorHex ?? '#888888';
    for (const entry of nodes.values()) {
      const zone = manifest.materialZones.find((z) => z.id === entry.zoneId);
      let color = zone?.defaultColorHex ?? '#888888';
      let metallic = zone?.defaultFinish.metallic ?? 0.2;
      let roughness = zone?.defaultFinish.roughness ?? 0.5;
      let clearcoat = zone?.defaultFinish.clearcoat ?? 0;
      const paint = entry.zoneId ? build.paint[entry.zoneId] : undefined;
      if (paint) {
        color = paint.colorHex;
        metallic = paint.metallic;
        roughness = paint.roughness;
        clearcoat = paint.clearcoat;
      }
      // material-override variants (e.g. painted bumpers) take precedence.
      const installed = entry.componentId ? installedByPart.get(entry.componentId) : undefined;
      const variant = installed?.variantId ? getVariant(installed.variantId) : undefined;
      if (variant?.visual.kind === 'material-override') {
        const v = variant.visual;
        if (v.useBodyColor) color = bodyColor;
        else if (v.colorHex) color = v.colorHex;
        if (v.metallic !== undefined) metallic = v.metallic;
        if (v.roughness !== undefined) roughness = v.roughness;
      }
      if (entry.zoneId === 'glass') {
        const tint = build.glassTint;
        const base = new THREE.Color(color);
        base.lerp(new THREE.Color('#090b0d'), tint);
        entry.material.color.copy(base);
        entry.material.opacity = Math.min(0.92, entry.baseOpacity + tint * 0.55);
      } else {
        entry.material.color.set(color);
      }
      entry.material.metalness = metallic;
      entry.material.roughness = Math.max(0.02, roughness);
      entry.material.clearcoat = clearcoat;
      entry.material.clearcoatRoughness = 0.08;
      entry.material.needsUpdate = false;
    }
  }, [nodes, manifest, build.paint, build.glassTint, installedByPart]);

  // --- Visibility (install/remove, variants, isolate) -----------------------
  useEffect(() => {
    for (const [nodeName, entry] of nodes) {
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
      entry.mesh.visible = visible;
    }
  }, [nodes, installedByPart, isolatedComponentId]);

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

      entry.material.emissive.copy(emissive ?? new THREE.Color(0x000000));
      entry.material.emissiveIntensity = intensity;

      // Ghost/x-ray: everything except the selected component becomes translucent.
      const ghosted =
        (ghostMode && !isSelected) ||
        (mode === 'fabrication' &&
          fabFilter !== 'all' &&
          !(record && record.status !== 'stock' && emissive));
      if (ghosted) {
        entry.material.transparent = true;
        entry.material.opacity = Math.min(entry.baseOpacity, 0.14);
        entry.material.depthWrite = false;
      } else {
        const glassOpacity = Math.min(0.92, entry.baseOpacity + build.glassTint * 0.55);
        entry.material.opacity = entry.zoneId === 'glass' ? glassOpacity : entry.baseOpacity;
        entry.material.transparent = entry.baseOpacity < 1;
        entry.material.depthWrite = true;
      }
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
        entry.mesh.position
          .copy(entry.basePosition)
          .addScaledVector(entry.explodeOffset, explodeFactor);
      }
    }
  }, [nodes, explodeFactor]);

  // --- Stance: body lift/rake from ride height + tyre diameter --------------
  const frontAnchor = manifest.wheelAnchors.find((a) => a.axle === 'front');
  const rearAnchor = manifest.wheelAnchors.find((a) => a.axle === 'rear');
  const stancePose = useMemo(() => {
    if (!frontAnchor || !rearAnchor) return { lift: 0, pitch: 0, pivotZ: 0 };
    const frontR = computeTyreSpec(build.wheels.front.tyre).diameterMm / 2000;
    const rearR = computeTyreSpec(build.wheels.rear.tyre).diameterMm / 2000;
    const frontLift = frontR - frontAnchor.position[1] + build.stance.rideHeightFrontMm / 1000;
    const rearLift = rearR - rearAnchor.position[1] + build.stance.rideHeightRearMm / 1000;
    const wheelbase = Math.abs(frontAnchor.position[2] - rearAnchor.position[2]);
    return {
      lift: (frontLift + rearLift) / 2,
      pitch: Math.atan2(rearLift - frontLift, wheelbase),
      pivotZ: (frontAnchor.position[2] + rearAnchor.position[2]) / 2,
    };
  }, [frontAnchor, rearAnchor, build.wheels.front.tyre, build.wheels.rear.tyre, build.stance]);

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
      <Wheels manifest={manifest} build={build} />
    </group>
  );
}
