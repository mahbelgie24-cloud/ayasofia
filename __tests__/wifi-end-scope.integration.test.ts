/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * T-B3 — endWifiSession scopes its update to the LATEST non-revoked session.
 *
 * A logout must mark only the newest still-active session for a device as
 * revoked (with its duration) and must NOT clobber an older/newer sibling.
 */
import { describe, it, expect, afterAll, afterEach, beforeEach } from "vitest";
import { vi } from "vitest";
import { createHash } from "node:crypto";

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers({ "x-forwarded-for": "127.0.0.1" })),
}));

await vi.hoisted(async () => {
  const fs = require("node:fs") as typeof import("node:fs");
  const path = require("node:path") as typeof import("node:path");
  const testEnvFile = path.resolve(__dirname, "..", ".env.test.local");
  const envPath = fs.existsSync(testEnvFile)
    ? testEnvFile
    : path.resolve(__dirname, "..", ".env.local");
  try {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const match = line.match(/^(\w+)=(.*)$/);
      if (match && match[1] === "DATABASE_URL") {
        process.env.DATABASE_URL = match[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* ignore */
  }
});
// Step-3 guard: refuse to run against the production project host.
if ((process.env.DATABASE_URL ?? "").includes("aws-0-ap-northeast-1.pooler.supabase.com")) {
  throw new Error(
    `[test-env] REFUSED: DATABASE_URL points at the PRODUCTION project. ` +
      `Use the isolated staging .env.test.local.`,
  );
}

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, desc, and, isNull } from "drizzle-orm";
import { wifiSessions, settings } from "@/db/schema";
import { endWifiSession } from "@/app/wifi/actions";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: { wifiSessions, settings } });

let createdHashes: string[] = [];

function hashOf(raw: string): string {
  return createHash("sha256").update(`ayasofia-wifi:${raw}`).digest("hex").slice(0, 32);
}

beforeEach(() => {
  createdHashes = [];
});

afterEach(async () => {
  for (const h of createdHashes) {
    try {
      await db.delete(wifiSessions).where(eq(wifiSessions.deviceIdHash, h));
    } catch {
      /* */
    }
  }
});

afterAll(async () => {
  await pool.end();
});

describe("endWifiSession scopes to latest session (T-B3)", () => {
  it("revokes only the newest non-revoked session for a device", { timeout: 30000 }, async () => {
    await db
      .insert(settings)
      .values({ key: "feature.wifi_portal", value: "1" })
      .onConflictDoUpdate({ target: settings.key, set: { value: "1" } });

    const deviceId = `t3-device-${Date.now()}`;
    const hash = hashOf(deviceId);
    createdHashes.push(hash);

    const beginsAt = Date.now() - 60_000;
    await db.insert(wifiSessions).values({
      deviceIdHash: hash,
      authorizedAt: new Date(beginsAt),
      expiresAt: new Date(beginsAt + 10 * 60 * 1000),
      routerSessionId: "sess-old",
    });
    await db.insert(wifiSessions).values({
      deviceIdHash: hash,
      authorizedAt: new Date(beginsAt + 30_000),
      expiresAt: new Date(beginsAt + 30_000 + 10 * 60 * 1000),
      routerSessionId: "sess-new",
    });

    const res = await endWifiSession({ deviceId, durationSec: 120 });
    expect(res.success).toBe(true);

    const rows = await db
      .select()
      .from(wifiSessions)
      .where(eq(wifiSessions.deviceIdHash, hash))
      .orderBy(desc(wifiSessions.authorizedAt));

    // Oldest stays active/non-revoked, no duration written.
    expect(rows).toHaveLength(2);
    const older = rows[1];
    expect(older.revokedAt).toBeNull();
    expect(older.durationSec).toBeNull();

    // Newest gets revoked with the reported duration.
    const newest = rows[0];
    expect(newest.revokedAt).not.toBeNull();
    expect(newest.durationSec).toBe(120);
  });

  it(
    "is a no-op (no error) when there is no active session for the device",
    { timeout: 30000 },
    async () => {
      await db
        .insert(settings)
        .values({ key: "feature.wifi_portal", value: "1" })
        .onConflictDoUpdate({ target: settings.key, set: { value: "1" } });

      const ghostHash = hashOf(`nobody-${Date.now()}`);
      const stillActive = await db
        .select({ id: wifiSessions.id })
        .from(wifiSessions)
        .where(and(eq(wifiSessions.deviceIdHash, ghostHash), isNull(wifiSessions.revokedAt)));
      expect(stillActive).toHaveLength(0);

      const res = await endWifiSession({ deviceId: `nobody-${Date.now()}` });
      expect(res.success).toBe(true);
    },
  );
});
