/**
 * Unit test for the service-worker caching strategy (H3).
 *
 * public/sw.js is plain JS (not a module), so we read it and assert the
 * strategy contract that replaces the stale-shell bug (D1):
 *   - Navigations are network-first (a navigation always tries the network,
 *     so /pos never gets a stale cached redirect after checkout).
 *   - The stale-while-revalidate path for documents is gone.
 *   - Static assets are cache-first with a versioned precache, and the activate
 *     handler purges any cache other than the current CACHE_NAME.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const swPath = resolve(import.meta.dirname ?? __dirname, "..", "public", "sw.js");
const sw = readFileSync(swPath, "utf-8");

describe("service worker caching strategy (H3)", () => {
  it("navigations are network-first", () => {
    expect(sw).toMatch(/networkFirst\(request\)/);
    expect(sw).toMatch(/request\.mode === "navigate"/);
  });

  it("no stale-while-revalidate for document navigations (the D1 bug)", () => {
    // The old buggy strategy served documents via staleWhileRevalidate. That
    // must be gone: /pos could be served a stale cached redirect to /login.
    expect(sw).not.toMatch(/staleWhileRevalidate/);
    expect(sw).not.toMatch(/stale-while-revalidate/);
  });

  it("static assets are cache-first", () => {
    expect(sw).toMatch(/cacheFirst\(request\)/);
  });

  it("has a versioned precache and purges old caches on activate", () => {
    expect(sw).toMatch(/CACHE_VERSION\s*=\s*"ayasofia-v\d+"/);
    expect(sw).toMatch(/caches\s*\.\s*keys\s*\(\)/);
    expect(sw).toMatch(/key !== CACHE_NAME/);
  });

  it("document navigations are not eagerly precached", () => {
    // Only static assets are in PRECACHE_ASSETS, never / or /pos.
    const precache = sw.match(/const PRECACHE_ASSETS = (\[[^\]]*\])/);
    expect(precache).not.toBeNull();
    const assets = precache![1];
    expect(assets).not.toMatch(/\"\/pos\"/);
    expect(assets).not.toMatch(/\"\/\"/);
  });
});
