import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

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
