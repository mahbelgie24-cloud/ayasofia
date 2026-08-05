/**
 * Minimal in-memory TTL cache for the public digital-menu catalog (C2).
 *
 * Motivations:
 *   - The public /m catalog is read on every guest scan; it changes only
 *     on admin mutations (product/suggestion/upsell/table edits).
 *   - No Redis/Upstash dependency is justified at single-store scale, and
 *     there is no event bus in this codebase. Invalidation is therefore
 *     DIRECT: admin mutation actions call `invalidateCatalogCache()` after
 *     writing (same-process cache key). If the process ever runs
 *     multi-instance (e.g. serverless), _this_ instance's cache still
 *     self-heals within the TTL window — documented as an accepted
 *     limitation (deviation from an event-bus-driven invalidation).
 *
 * Concurrency: single serverless instance returns consistent data; a
 * stale read is better than a failed one and self-corrects inside TTL.
 */

type CacheEntry<T> = { value: T; expiresAt: number };

const store = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 60_000;

/**
 * Read a cached value, or compute + cache it via `loader`.
 * Returns `null` when no entry exists.
 */
export function cached<T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
  const hit = store.get(key);
  const now = Date.now();
  if (hit && hit.expiresAt > now) {
    return Promise.resolve(hit.value as T);
  }
  if (hit) store.delete(key);

  return Promise.resolve(loader()).then((value) => {
    store.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  });
}

/** Delete every cache entry whose key prefixes match `prefix` (whole-key or dotted). */
export function invalidateByPrefix(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

/** Nuke the whole cache (used by tests). */
export function clearCache(): void {
  store.clear();
}

/** Prime an entry directly (used by tests). */
export function cacheSetForTesting<T>(key: string, value: T, ttlMs = DEFAULT_TTL_MS): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}
