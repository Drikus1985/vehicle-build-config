import { Suspense, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Grid, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { AssetManifest, Build, Vehicle } from '@/lib/schemas';
import { useUiStore, type BackgroundId, type EnvironmentId } from '@/state/uiStore';
import { setCameraState } from '@/state/buildActions';
import { registerViewportApi, type SnapshotOptions } from './viewportApi';
import {
  getPrimaryCamera,
  notifyCameraChange,
  onCameraChange,
  setPrimaryCamera,
} from './cameraSync';
import { VehicleModel } from './VehicleModel';

const BACKGROUNDS: Record<BackgroundId, { color: string; fog: boolean; gridColor: string }> = {
  graphite: { color: '#191b1f', fog: true, gridColor: '#3a3e46' },
  paper: { color: '#e8e5dd', fog: false, gridColor: '#c4c0b4' },
  horizon: { color: '#232a33', fog: true, gridColor: '#39434f' },
};

const ENVIRONMENTS: Record<
  EnvironmentId,
  { envIntensity: number; keyIntensity: number; keyColor: string }
> = {
  studio: { envIntensity: 1.0, keyIntensity: 1.6, keyColor: '#ffffff' },
  warehouse: { envIntensity: 0.55, keyIntensity: 1.0, keyColor: '#ffe7c4' },
  night: { envIntensity: 0.16, keyIntensity: 0.5, keyColor: '#a8c4ff' },
};

/**
 * Everything both compare panes share: environment map, background/fog,
 * lights, contact shadows and the ground grid.
 */
function SceneChrome() {
  const { gl, scene } = useThree();
  const environment = useUiStore((s) => s.environment);
  const background = useUiStore((s) => s.background);
  const showGrid = useUiStore((s) => s.showGrid);

  // Environment map (generated locally — no network HDRs).
  const envTexture = useMemo(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const tex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    return tex;
  }, [gl]);

  useEffect(() => {
    scene.environment = envTexture;
    return () => {
      scene.environment = null;
      envTexture.dispose();
    };
  }, [scene, envTexture]);

  useEffect(() => {
    const bg = BACKGROUNDS[background];
    scene.background = new THREE.Color(bg.color);
    scene.fog = bg.fog ? new THREE.Fog(bg.color, 14, 34) : null;
    scene.environmentIntensity = ENVIRONMENTS[environment].envIntensity;
    return () => {
      scene.background = null;
      scene.fog = null;
    };
  }, [scene, background, environment]);

  const env = ENVIRONMENTS[environment];
  const bg = BACKGROUNDS[background];

  return (
    <>
      <directionalLight
        position={[5, 7, 4]}
        intensity={env.keyIntensity}
        color={env.keyColor}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
      />
      <directionalLight position={[-6, 3, -5]} intensity={env.keyIntensity * 0.25} />
      <ambientLight intensity={environment === 'night' ? 0.1 : 0.25} />

      <ContactShadows
        position={[0, 0.001, 0]}
        opacity={0.55}
        scale={12}
        blur={2.2}
        far={3}
        resolution={512}
        frames={Infinity}
      />
      {showGrid && (
        <Grid
          position={[0, 0.002, 0]}
          args={[30, 30]}
          cellSize={0.5}
          cellColor={bg.gridColor}
          sectionSize={2.5}
          sectionColor={bg.gridColor}
          fadeDistance={22}
          infiniteGrid
        />
      )}
    </>
  );
}

function SceneRig({ manifest, build }: { manifest: AssetManifest; build: Build }) {
  const { gl, scene, camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const turntable = useUiStore((s) => s.turntable);
  const reducedMotion = useUiStore((s) => s.reducedMotion);
  const cameraPresetRequest = useUiStore((s) => s.cameraPresetRequest);

  const flight = useRef<{ pos: THREE.Vector3; target: THREE.Vector3; t: number } | null>(null);

  // Register as the pose source for the compare follower pane.
  useEffect(() => {
    setPrimaryCamera(camera);
    return () => setPrimaryCamera(null);
  }, [camera]);

  // Restore a persisted camera pose once per build id.
  const restoredFor = useRef<string | null>(null);
  useEffect(() => {
    if (restoredFor.current === build.id) return;
    restoredFor.current = build.id;
    const state = build.cameraState;
    const controls = controlsRef.current;
    if (state && controls) {
      camera.position.set(...state.position);
      controls.target.set(...state.target);
      controls.update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [build.id, camera]);

  // Camera preset requests (front/rear/top/reset…).
  useEffect(() => {
    if (!cameraPresetRequest) return;
    const { presetId } = cameraPresetRequest;
    const preset =
      presetId === 'reset'
        ? {
            position: manifest.cameraTargets.defaultPosition,
            target: manifest.cameraTargets.defaultTarget,
          }
        : manifest.cameraTargets.presets.find((p) => p.id === presetId);
    if (!preset) return;
    const pos = new THREE.Vector3(...preset.position);
    const target = new THREE.Vector3(...preset.target);
    if (reducedMotion) {
      camera.position.copy(pos);
      controlsRef.current?.target.copy(target);
      controlsRef.current?.update();
      flight.current = null;
    } else {
      flight.current = { pos, target, t: 0 };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraPresetRequest]);

  useFrame((_, delta) => {
    const f = flight.current;
    const controls = controlsRef.current;
    if (f && controls) {
      f.t = Math.min(1, f.t + delta * 2.2);
      const ease = 1 - Math.pow(1 - f.t, 3);
      camera.position.lerp(f.pos, Math.min(1, ease * 0.35 + delta * 4));
      controls.target.lerp(f.target, Math.min(1, ease * 0.35 + delta * 4));
      controls.update();
      notifyCameraChange();
      if (f.t >= 1 && camera.position.distanceTo(f.pos) < 0.02) flight.current = null;
    }
  });

  // Imperative API: snapshots + camera control for the DOM UI.
  useEffect(() => {
    registerViewportApi({
      captureSnapshot: async (options: SnapshotOptions) => {
        const prevBackground = scene.background;
        if (options.transparent) {
          scene.background = null;
          gl.setClearColor(0x000000, 0);
        }
        gl.render(scene, camera);
        const full = gl.domElement;
        let sw = full.width;
        let sh = full.height;
        if (options.aspect !== 'viewport') {
          const [aw, ah] =
            options.aspect === '1:1' ? [1, 1] : options.aspect === '4:3' ? [4, 3] : [16, 9];
          if (sw / sh > aw / ah) sw = Math.round((sh * aw) / ah);
          else sh = Math.round((sw * ah) / aw);
        }
        const out = document.createElement('canvas');
        out.width = sw;
        out.height = sh;
        const ctx = out.getContext('2d');
        if (!ctx) throw new Error('2D context unavailable');
        ctx.drawImage(
          full,
          Math.round((full.width - sw) / 2),
          Math.round((full.height - sh) / 2),
          sw,
          sh,
          0,
          0,
          sw,
          sh,
        );
        if (options.transparent) {
          scene.background = prevBackground;
        }
        return out.toDataURL('image/png');
      },
      goToPreset: (presetId: string) => useUiStore.getState().requestCameraPreset(presetId),
      resetView: () => useUiStore.getState().requestCameraPreset('reset'),
    });
    return () => registerViewportApi(null);
  }, [gl, scene, camera]);

  return (
    <>
      <SceneChrome />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping={!reducedMotion}
        autoRotate={turntable && !reducedMotion}
        autoRotateSpeed={0.9}
        minDistance={1.6}
        maxDistance={18}
        maxPolarAngle={Math.PI / 2 + 0.05}
        target={manifest.cameraTargets.defaultTarget}
        onChange={notifyCameraChange}
        onEnd={() => {
          const controls = controlsRef.current;
          if (!controls) return;
          setCameraState(
            [camera.position.x, camera.position.y, camera.position.z],
            [controls.target.x, controls.target.y, controls.target.z],
          );
        }}
      />
    </>
  );
}

/**
 * Camera rig for the B pane of split-view Compare: no controls of its own —
 * it copies the primary camera's pose every frame (each pane keeps its own
 * aspect), and invalidates itself on camera-change notifications so the sync
 * also works in on-demand/reduced-motion rendering.
 */
function FollowerRig() {
  const { camera, invalidate } = useThree();
  useEffect(() => onCameraChange(() => invalidate()), [invalidate]);
  useFrame(() => {
    const primary = getPrimaryCamera();
    if (!primary) return;
    camera.position.copy(primary.position);
    camera.quaternion.copy(primary.quaternion);
  });
  return <SceneChrome />;
}

export interface ViewportSceneProps {
  vehicle: Vehicle;
  manifest: AssetManifest;
  build: Build;
}

export function ViewportScene({ manifest, build }: ViewportSceneProps) {
  const reducedMotion = useUiStore((s) => s.reducedMotion);
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      frameloop={reducedMotion ? 'demand' : 'always'}
      camera={{
        fov: 40,
        near: 0.1,
        far: 120,
        position: manifest.cameraTargets.defaultPosition,
      }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    >
      <Suspense fallback={null}>
        <SceneRig manifest={manifest} build={build} />
        <VehicleModel manifest={manifest} build={build} interactive />
      </Suspense>
    </Canvas>
  );
}

/**
 * The B pane of split-view Compare: renders any build (factory stock or a
 * saved variant) with the shared scene chrome, camera-synced to the primary
 * pane and non-interactive.
 */
export function CompareViewportScene({ manifest, build }: Omit<ViewportSceneProps, 'vehicle'>) {
  const reducedMotion = useUiStore((s) => s.reducedMotion);
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      frameloop={reducedMotion ? 'demand' : 'always'}
      camera={{
        fov: 40,
        near: 0.1,
        far: 120,
        position: manifest.cameraTargets.defaultPosition,
      }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
    >
      <Suspense fallback={null}>
        <FollowerRig />
        <VehicleModel manifest={manifest} build={build} interactive={false} />
      </Suspense>
    </Canvas>
  );
}
