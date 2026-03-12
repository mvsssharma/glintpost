/**
 * Org-level in-memory cache for widget API responses.
 * Keyed by "{orgId}:{namespace}". No TTL — cache lives until
 * explicitly updated or invalidated by mutations.
 */

const store = new Map<string, unknown>();

function key(orgId: string, namespace: string): string {
  return `${orgId}:${namespace}`;
}

/** Get cached data, or null if not cached. */
export function cacheGet<T>(orgId: string, namespace: string): T | null {
  const k = key(orgId, namespace);
  const data = store.get(k);
  return data !== undefined ? (data as T) : null;
}

/** Store data in cache. */
export function cacheSet(orgId: string, namespace: string, data: unknown): void {
  store.set(key(orgId, namespace), data);
}

/** Clear cache for a specific org + namespace. */
export function cacheInvalidate(orgId: string, namespace: string): void {
  store.delete(key(orgId, namespace));
}

/**
 * In-place update of cached data. Runs updater function on the
 * current cached value. No-op if cache is empty for this key.
 */
export function cacheUpdate<T>(
  orgId: string,
  namespace: string,
  updater: (data: T) => T
): void {
  const k = key(orgId, namespace);
  const current = store.get(k);
  if (current !== undefined) {
    store.set(k, updater(current as T));
  }
}
