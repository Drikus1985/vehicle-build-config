/**
 * Resolves manifest source URIs to loadable URLs. Catalogue assets use plain
 * paths; user-authored vehicles reference imported library blobs with
 * `asset:<id>` URIs, which resolve to object URLs (cached for the session —
 * the loader caches by URL, so the URL must stay stable). Suspense-style so
 * the viewer can resolve before the GLB load starts.
 */
import { repositories } from '@/lib/persistence/idb';

type CacheEntry = { promise: Promise<string>; url: string | null; error: Error | null };
const cache = new Map<string, CacheEntry>();

function resolve(uri: string): CacheEntry {
  let entry = cache.get(uri);
  if (!entry) {
    const created: CacheEntry = {
      promise: repositories.assets.get(uri.slice('asset:'.length)).then((asset) => {
        if (!asset) {
          created.error = new Error(
            'The imported asset backing this vehicle is no longer in the library. Re-import the file or remove the vehicle.',
          );
          throw created.error;
        }
        created.url = URL.createObjectURL(asset.blob);
        return created.url;
      }),
      url: null,
      error: null,
    };
    created.promise.catch(() => {}); // errors re-thrown at use sites
    entry = created;
    cache.set(uri, entry);
  }
  return entry;
}

/** Suspense hook mapping manifest URIs (asset: or plain) to loadable URLs. */
export function useResolvedAssetUrls(uris: string[]): string[] {
  const pending: Promise<string>[] = [];
  const resolved = uris.map((uri) => {
    if (!uri.startsWith('asset:')) return uri;
    const entry = resolve(uri);
    if (entry.error) throw entry.error;
    if (entry.url === null) {
      pending.push(entry.promise);
      return uri;
    }
    return entry.url;
  });
  if (pending.length > 0) throw Promise.all(pending);
  return resolved;
}
