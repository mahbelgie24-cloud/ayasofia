import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { createClient } from "@/lib/supabase/server";

const KEY_LENGTH = 64;
const SALT_LENGTH = 32;
const SEPARATOR = ":";

function toHex(buf: Buffer): string {
  return buf.toString("hex");
}

function fromHex(hex: string): Buffer {
  return Buffer.from(hex, "hex");
}

/**
 * Hash a PIN for storage. Returns `salt:hash` — a hex-encoded salt
 * and scrypt-derived key separated by a colon.
 */
export function hashPin(pin: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const hash = scryptSync(pin, salt, KEY_LENGTH);
  return `${toHex(salt)}${SEPARATOR}${toHex(hash)}`;
}

/**
 * Verify a PIN against a stored `salt:hash` string.  Constant-time
 * comparison so the caller doesn't leak whether the PIN itself was
 * close to correct.
 */
export function verifyPin(pin: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(SEPARATOR);
  if (!saltHex || !hashHex) return false;

  try {
    const salt = fromHex(saltHex);
    const expected = fromHex(hashHex);
    const actual = scryptSync(pin, salt, KEY_LENGTH);
    // In Node ≥16.15 the buffers from scryptSync are zero-padded to
    // KEY_LENGTH, so timingSafeEqual works without slicing.
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

// ---------- Server-side authorization (§12, spec) ----------

export type StaffRole = "owner" | "manager" | "cashier" | "barista";

const ROLE_RANK: Record<StaffRole, number> = {
  barista: 0,
  cashier: 1,
  manager: 2,
  owner: 3,
};

export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: "NO_SESSION" | "NO_STAFF_ID" | "INSUFFICIENT_ROLE",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export interface StaffSession {
  staffId: string;
  role: StaffRole;
}

/**
 * Verify that the incoming request carries a valid staff session with
 * the required minimum role.
 *
 * Must be the **first call** in every Server Action that reads or
 * mutates staff-scoped, margin, or inventory-cost data (§12 guardrail).
 * The one exception is `verifyStaffPin` itself — it is the auth gate
 * that establishes the session, so it cannot require one beforehand.
 *
 * `proxy.ts` handles UX-level redirects for unauthenticated users but
 * is NOT the security boundary — this function is.
 */
export async function requireStaffSession(
  minRole?: StaffRole,
): Promise<StaffSession> {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new AuthError(
      "No authenticated session",
      "NO_SESSION",
    );
  }

  const staffId = user.app_metadata?.staff_id as string | undefined;
  const role = user.app_metadata?.role as StaffRole | undefined;

  if (!staffId || !role) {
    throw new AuthError(
      "Session is not linked to a staff member",
      "NO_STAFF_ID",
    );
  }

  if (minRole && ROLE_RANK[role] < ROLE_RANK[minRole]) {
    throw new AuthError(
      `Role "${role}" does not meet the required minimum "${minRole}"`,
      "INSUFFICIENT_ROLE",
    );
  }

  return { staffId, role };
}

// TODO(cleanup): failed/superseded anonymous sessions accumulate in
// auth.users indefinitely — needs a scheduled cleanup job before real
// launch, see docs/technical-spec.md §15.
