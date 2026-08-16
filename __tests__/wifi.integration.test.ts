/**
 * Integration test: wifi guest authorization via MockAdapter.
 *
 * Requires DATABASE_URL (from .env.local). Self-cleaning: enables the
 * feature flag, authorizes a guest, asserts the session row is anonymous
 * (no PII without consent), then cleans up.
 */

import { describe, it, expect, afterEach, afterAll, beforeEach } from "vitest";
import { vi } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, gte } from "drizzle-orm";
import { wifiSessions, settings } from "@/db/schema";
import { loadTestEnv } from "@/lib/test-env";

// Mock next/headers — the wifi actions call headers() for IP rate-limiting.
// Outside a request scope, provide a stable test IP (mirrors phase3 test).
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ "x-forwarded-for": "127.0.0.1" })),
}));

// Load the isolated staging credentials + assert not the production project.
loadTestEnv();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: { wifiSessions, settings } });

let createdHashes: string[] = [];

beforeEach(() => {
  createdHashes = [];
});

afterEach(async () => {
  for (const h of createdHashes) {
    try {
      await db.delete(wifiSessions).where(eq(wifiSessions.deviceIdHash, h));
    } catch {
      /* ignore */
    }
  }
});

afterAll(async () => {
  await pool.end();
});

describe("wifi guest authorization (integration)", () => {
  it(
    "authorizes via MockAdapter and logs an anonymous session (no PII without consent)",
    { timeout: 30000 },
    async () => {
      // Enable the feature flag for the row.
      await db
        .insert(settings)
        .values({ key: "feature.wifi_portal", value: "1" })
        .onConflictDoUpdate({ target: settings.key, set: { value: "1" } });

      const { authorizeGuest } = await import("@/app/wifi/actions");
      const deviceId = `test-device-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Scope the row lookup to this run: the shared integration DB carries
      // sessions from previous runs/e2e, and an unordered select().from()
      // can hand back one of those (expired) rows instead of ours.
      const startedAt = new Date(Date.now() - 1000);
      const res = await authorizeGuest({ deviceId });
      expect(res.success).toBe(true);
      if (!res.success) return;

      // The stored session must be anonymous when consent is not given.
      const rows = await db
        .select()
        .from(wifiSessions)
        .where(gte(wifiSessions.authorizedAt, startedAt));
      expect(rows.length).toBeGreaterThanOrEqual(1);
      const session = rows[rows.length - 1];
      createdHashes.push(session!.deviceIdHash);

      // Never store the raw device id.
      expect(session?.deviceIdHash).not.toContain(deviceId);
      // No PII without consent.
      expect(session?.guestName).toBeNull();
      expect(session?.guestPhone).toBeNull();
      expect(session?.consented).toBe(false);
      expect(session?.expiresAt.getTime()).toBeGreaterThan(Date.now());
    },
  );
});
