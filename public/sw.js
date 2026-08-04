/**
 * Ayasofia Sweet — Service Worker
 *
 * App-shell caching only.  All API calls (Supabase) bypass the cache
 * and use network-first strategy.  Offline orders are queued in
 * IndexedDB via the offline sync engine, not in this SW.
 *
 * Update CACHE_VERSION on every deploy to purge stale cache.
 */

const CACHE_VERSION = "ayasofia-v1";
const CACHE_NAME = `ayasofia-shell-${CACHE_VERSION}`;

// These are the static assets the SW catches on install.
// Everything else is network-first or network-only.
const APP_SHELL = ["/", "/login", "/pos", "/order"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch(() => {
        // Individual failures are OK — the SW will cache them on demand.
      });
    }),
  );
  // Claim clients immediately so the SW controls pages without reload.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    }),
  );
  // Take control of all clients immediately.
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache Supabase API calls — these go through the sync engine.
  if (
    url.hostname.includes("supabase.co") ||
    url.pathname.startsWith("/api/") ||
    event.request.method !== "GET"
  ) {
    return;
  }

  // App shell: stale-while-revalidate for HTML pages, cache-first for
  // static assets (JS, CSS, fonts, images).
  if (event.request.destination === "document") {
    event.respondWith(staleWhileRevalidate(event.request));
  } else if (
    event.request.destination === "style" ||
    event.request.destination === "script" ||
    event.request.destination === "font" ||
    event.request.destination === "image"
  ) {
    event.respondWith(cacheFirst(event.request));
  }
});

/** Stale-while-revalidate: serve from cache, update cache from network.
 * @param {Request} request
 * @returns {Promise<Response>} */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached ?? fetchPromise;
}

/** Cache-first: serve from cache, fall back to network.
 * @param {Request} request
 * @returns {Promise<Response>} */
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
