import { describe, it, expect, beforeEach } from "vitest";
import { cached, invalidateByPrefix, clearCache, cacheSetForTesting } from "@/lib/cache";

describe("lib/cache", () => {
  beforeEach(() => clearCache());

  it("computes on miss, serves on hit", async () => {
    let calls = 0;
    const load = async () => {
      calls++;
      return { n: calls };
    };
    const a = await cached("k", load);
    const b = await cached("k", load);
    expect(a.n).toBe(1);
    expect(b.n).toBe(1);
    expect(calls).toBe(1);
  });

  it("respects TTL and re-computes after expiry", async () => {
    cacheSetForTesting("k", "stale", 1);
    const immediate = await cached("k", async () => "fresh", 1);
    expect(immediate).toBe("stale");
    await new Promise((r) => setTimeout(r, 5));
    const after = await cached("k", async () => "fresh", 1);
    expect(after).toBe("fresh");
  });

  it("invalidates by prefix", async () => {
    await cached("catalog:main:a", async () => 1);
    await cached("catalog:main:b", async () => 2);
    invalidateByPrefix("catalog:main");
    expect(await cached("catalog:main:a", async () => 10)).toBe(10);
    expect(await cached("catalog:main:b", async () => 20)).toBe(20);
  });

  it("does not invalidate unrelated prefixes", async () => {
    await cached("other:x", async () => 1);
    invalidateByPrefix("catalog:main");
    expect(await cached("other:x", async () => 99)).toBe(1);
  });
});
