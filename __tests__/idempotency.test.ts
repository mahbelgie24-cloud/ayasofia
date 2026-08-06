/**
 * P1-M2 — idempotency key derivation unit tests.
 *
 * The key must be deterministic for a given (session, cart fingerprint) so an
 * identical cart resubmit dedupes, yet change when the cart changes so new/edited
 * items create a NEW order instead of silently attaching to an old one.
 */
import { describe, it, expect } from "vitest";
import {
  computeIdempotencyKey,
  cartFingerprint,
  type IdempotencyCartItem,
} from "@/lib/idempotency";

const cart = (over: IdempotencyCartItem[] = []): IdempotencyCartItem[] => [
  { productId: "p1", modifierIds: [], quantity: 1 },
  { productId: "p2", modifierIds: ["m1", "m2"], quantity: 2 },
  ...over,
];

describe("computeIdempotencyKey (P1-M2)", () => {
  it("same session + same cart → same key (dedupes a retried submit)", async () => {
    const a = await computeIdempotencyKey("session-1", cart());
    const b = await computeIdempotencyKey("session-1", cart());
    expect(a).toBe(b);
    expect(a.startsWith("k-")).toBe(true);
  });

  it("cart add-order does not change the key (canonical fingerprint)", async () => {
    const forward = await computeIdempotencyKey("s", cart());
    const reversed = await computeIdempotencyKey("s", [...cart()].reverse());
    expect(reversed).toBe(forward);
  });

  it("changing a quantity changes the key (modified cart → new order)", async () => {
    const a = await computeIdempotencyKey("s", cart());
    const b = await computeIdempotencyKey("s", cart([{ ...cart()[0], quantity: 3 }]));
    expect(b).not.toBe(a);
  });

  it("adding an item changes the key", async () => {
    const a = await computeIdempotencyKey("s", cart());
    const b = await computeIdempotencyKey(
      "s",
      cart([{ productId: "p9", modifierIds: [], quantity: 1 }]),
    );
    expect(b).not.toBe(a);
  });

  it("changing a modifier changes the key", async () => {
    const a = await computeIdempotencyKey("s", cart());
    const b = await computeIdempotencyKey("s", cart([{ ...cart()[1], modifierIds: ["m1"] }]));
    expect(b).not.toBe(a);
  });

  it("changing an item's note changes the key (note is part of cart content)", async () => {
    const a = await computeIdempotencyKey("s", cart());
    const b = await computeIdempotencyKey("s", cart([{ ...cart()[0], notes: "لا ثلج" }]));
    expect(b).not.toBe(a);
  });

  it("different sessions with identical carts produce different keys (no cross-device collision)", async () => {
    const a = await computeIdempotencyKey("device-A", cart());
    const b = await computeIdempotencyKey("device-B", cart());
    expect(b).not.toBe(a);
  });

  it("throws when session is missing", async () => {
    await expect(computeIdempotencyKey("", cart())).rejects.toThrow(/sessionId/);
  });
});

describe("cartFingerprint", () => {
  it("sorts modifiers within a line and normalizes notes", () => {
    const f1 = cartFingerprint([
      { productId: "p", modifierIds: ["b", "a"], quantity: 1, notes: "  x  " },
    ]);
    const f2 = cartFingerprint([
      { productId: "p", modifierIds: ["a", "b"], quantity: 1, notes: "x" },
    ]);
    expect(f1).toBe(f2);
  });
});
