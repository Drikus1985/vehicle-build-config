import { useEffect, useRef, useState } from 'react';

/**
 * Minimal self-contained 3D preview for imported GLB/STL files.
 * Uses plain three.js (lazy-loaded); no editing, just an auto-rotating look.
 */
export function MiniModelPreview({ url, kind }: { url: string; kind: 'gltf' | 'stl' }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposed = false;
    let cleanup: (() => void) | undefined;

    void (async () => {
      try {
        const THREE = await import('three');
        const mount = mountRef.current;
        if (!mount || disposed) return;
        const width = 320;
        const height = 200;
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        mount.appendChild(renderer.domElement);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, width / height, 0.01, 100);
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const key = new THREE.DirectionalLight(0xffffff, 1.4);
        key.position.set(3, 4, 2);
        scene.add(key);

        let object: import('three').Object3D;
        if (kind === 'gltf') {
          const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
          const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');
          // Locally hosted decoder so Draco-compressed imports preview too.
          const dracoLoader = new DRACOLoader().setDecoderPath('/draco/');
          const loader = new GLTFLoader().setDRACOLoader(dracoLoader);
          try {
            object = (await loader.loadAsync(url)).scene;
          } finally {
            dracoLoader.dispose();
          }
        } else {
          const { STLLoader } = await import('three/addons/loaders/STLLoader.js');
          const geometry = await new STLLoader().loadAsync(url);
          geometry.computeVertexNormals();
          object = new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({ color: 0x9aa0aa, metalness: 0.2, roughness: 0.6 }),
          );
        }
        if (disposed) return;

        // Frame the object.
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        object.position.sub(center);
        scene.add(object);
        const radius = Math.max(size.x, size.y, size.z) || 1;
        camera.position.set(radius * 1.6, radius * 0.9, radius * 1.6);
        camera.lookAt(0, 0, 0);

        let raf = 0;
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const tick = () => {
          if (!reduced) object.rotation.y += 0.008;
          renderer.render(scene, camera);
          raf = requestAnimationFrame(tick);
        };
        tick();

        cleanup = () => {
          cancelAnimationFrame(raf);
          renderer.dispose();
          scene.traverse((o) => {
            if (o instanceof THREE.Mesh) {
              o.geometry.dispose();
              const mats = Array.isArray(o.material) ? o.material : [o.material];
              mats.forEach((m) => m.dispose());
            }
          });
          renderer.domElement.remove();
        };
      } catch (e) {
        if (!disposed) setError(e instanceof Error ? e.message : 'Could not preview this model.');
      }
    })();

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [url, kind]);

  if (error) {
    return (
      <p className="p-4 text-[11px] text-danger-500">
        Preview failed: {error}. The file passed signature checks but may contain malformed geometry
        — it was not added to the library.
      </p>
    );
  }
  return <div ref={mountRef} aria-label="3D preview" />;
}
