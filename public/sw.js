/**
 * Ayasofia Sweet — Service Worker
 *
 * Caching strategy (see docs/reports/discovery-2026-08-08.md §D1 for the bug
 * this replaces):
 *   - NAVIGATIONS (document requests, including /pos and /login): network-first
 *     with cache fallback. This preserves offline resilience (a cached shell is
 *     served when offline) while eliminating the stale-shell trap that used to
 *     serve /pos a cached redirect after checkout. A navigation always tries the
 *     network first, so the latest server response — including auth redirects —
 *     is what the user sees.
 *   - STATIC ASSETS (JS/CSS/fonts/images): cache-first with a versioned precache
 *     (CACHE_VERSION). Bump CACHE_VERSION on every deploy to purge the old
 *     precache; the activate handler deletes any cache other than the current
 *     CACHE_NAME.
 *
 * All API calls (Supabase, /api) bypass the cache entirely and use the network.
 * Offline orders are queued in IndexedDB via the offline sync engine, not here.
 */

const CACHE_VERSION = "ayasofia-v2";
const CACHE_NAME = `ayasofia-shell-${CACHE_VERSION}`;

// Static assets precached on install. Documents are NOT precached — they are
// stored on-demand as network-first fallbacks, never eagerly.
const PRECACHE_ASSETS = [
  "/icons/logo-mono.svg",
  "/icons/icon-bubbletea.svg",
  "/icons/icon-fruittea.svg",
  "/icons/icon-cheesefoam.svg",
  "/icons/icon-souffle.svg",
  "/icons/icon-bingsu.svg",
  "/icons/icon-croffle.svg",
];

// Never cache these (they are session/API traffic).
const BYPASS_PATHS = ["/api/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .catch(() => {
        // Individual failures are OK — assets are fetched on demand.
      }),
  );
  // Claim the new SW immediately so updated caching rules take effect
  // without a reload.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Never cache Supabase API calls, Next.js API routes, or non-GET requests.
  if (
    url.hostname.includes("supabase.co") ||
    BYPASS_PATHS.some((p) => url.pathname.startsWith(p)) ||
    request.method !== "GET"
  ) {
    return;
  }

  // Navigations (documents): network-first with cached fallback.
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(networkFirst(request));
    return;
  }

  // Static assets: cache-first with network fallback.
  if (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "font" ||
    request.destination === "image"
  ) {
    event.respondWith(cacheFirst(request));
  }
});

/**
 * Network-first: try the network, and only fall back to the cache when the
 * network is unavailable (offline). The successful response is written to the
 * cache so it is available for offline navigation later.
 */
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    return new Response("", { status: 408, statusText: "Offline" });
  }
}

/** Cache-first: serve from cache, fall back to network, then cache it. */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 408, statusText: "Offline" });
  }
}
