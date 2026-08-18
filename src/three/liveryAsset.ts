/**
 * Availability check for a manifest's optional UV-mapped `liverySource`
 * asset. Like the base asset it may be licensed and therefore not present
 * (see README): the viewer prefers it when it exists and falls back to the
 * base asset — with liveries truthfully unavailable — when it does not.
 */
import { useEffect, useState } from 'react';
import type { AssetManifest } from '@/lib/schemas';

type CacheEntry = { promise: Promise<boolean>; result: boolean | null };
const cache = new Map<string, CacheEntry>();

function check(uri: string): CacheEntry {
  let entry = cache.get(uri);
  if (!entry) {
    const created: CacheEntry = {
      promise: fetch(uri, { method: 'HEAD' })
        .then((res) => res.ok)
        .catch(() => false)
        .then((ok) => {
          created.result = ok;
          return ok;
        }),
      result: null,
    };
    entry = created;
    cache.set(uri, entry);
  }
  return entry;
}

/**
 * Suspense hook: true when the manifest's livery asset is installed. Suspends
 * on the first (fast HEAD) check so the caller can pick the asset URL before
 * loading any GLB.
 */
export function useLiveryAssetAvailable(manifest: AssetManifest): boolean {
  const uri = manifest.liverySource?.uri;
  if (!uri) return false;
  const entry = check(uri);
  if (entry.result === null) throw entry.promise;
  return entry.result;
}

/** Non-suspending variant for UI panels (null while still checking). */
export function useLiveryAssetStatus(manifest: AssetManifest | null): boolean | null {
  const uri = manifest?.liverySource?.uri ?? null;
  const [status, setStatus] = useState<boolean | null>(() =>
    uri ? (cache.get(uri)?.result ?? null) : false,
  );
  useEffect(() => {
    if (!uri) {
      setStatus(false);
      return;
    }
    let mounted = true;
    void check(uri).promise.then((ok) => {
      if (mounted) setStatus(ok);
    });
    return () => {
      mounted = false;
    };
  }, [uri]);
  return status;
}
