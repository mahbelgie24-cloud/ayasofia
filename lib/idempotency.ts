/**
 * Idempotency-key derivation (P1-M2).
 *
 * The POS/digital-menu single-pipeline checkout keyed orders by a per-cart
 * UUID minted once for the whole cart lifecycle. That let a modified cart be
 * silently deduped into the OLD order — new items were lost on resubmit.
 *
 * New semantics: the key is a DETERMINISTIC hash of
 *     sessionId + canonical cart fingerprint
 * computed at submit time for the CURRENT cart snapshot. Consequences:
 *   - identical cart resubmitted (network retry / double-click) → same key
 *     → executeCheckout returns the existing order exactly once;
 *   - a modified cart (different items / quantities / modifiers / notes)
 *     → different fingerprint → a NEW order is created.
 *
 * The sessionId disambiguator (a per-mount random id, or the staff id) keeps
 * two different browsers from colliding on the same fingerprint. The key is a
 * hex SHA-256, so it is opaque, stable, and unguessable. This is a pure
 * (crypto.subtle) function usable on client and server and in tests.
 */

export interface IdempotencyCartItem {
  productId: string;
  modifierIds?: string[];
  quantity: number;
  notes?: string;
}

/**
 * Canonical, order-insensitive fingerprint of a cart snapshot.
 * Lines are sorted so two carts with the same content in a different
 * add-order produce the same key (true "same cart" for dedup purposes).
 */
export function cartFingerprint(cartItems: IdempotencyCartItem[]): string {
  return cartItems
    .map((item) => {
      const mods = (item.modifierIds ?? []).slice().sort().join(",");
      const notes = (item.notes ?? "").trim();
      return [item.productId, item.quantity, mods, notes].join("|");
    })
    .sort()
    .join("\n");
}

/** SHA-256 hex digest of `input`. */
export async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Deterministic idempotency key for a submit click: hash(session + cart).
 * Same session + same cart ⇒ same key. Any cart change ⇒ a different key.
 */
export async function computeIdempotencyKey(
  sessionId: string,
  cartItems: IdempotencyCartItem[],
): Promise<string> {
  if (!sessionId) throw new Error("computeIdempotencyKey requires a sessionId");
  const digest = await sha256Hex([sessionId, cartFingerprint(cartItems)].join("\n"));
  return `k-${digest}`;
}
