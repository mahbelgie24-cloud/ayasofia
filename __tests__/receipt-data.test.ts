/**
 * Gap #2 — getReceiptData line-total recomputation (WEB-DATA-002).
 *
 * The existing receipt.test.ts tests buildReceiptText *formatting* by
 * supplying lineTotal directly.  No test calls getReceiptData itself,
 * so the bug where modifier deltas were dropped from line totals
 * (calculateLineTotal called with []) went undetected.  These tests
 * mock @/lib/db and call getReceiptData end-to-end, asserting that
 * line items with priced modifiers sum exactly to order.subtotal.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockDbSelect } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: { select: mockDbSelect },
}));

import { getReceiptData } from "@/lib/db/queries";

/** Chainable helper: from().where() → thenable-with-limit. */
function chain(rows: unknown[], hasLimit = false) {
  const thenable = Object.assign(Promise.resolve(rows), {
    limit: () => Promise.resolve(rows),
  });
  return {
    from: () => (hasLimit ? { where: () => thenable } : { where: () => Promise.resolve(rows) }),
  };
}

/** from() with no .where() — used by settings select. */
function chainNoWhere(rows: unknown[]) {
  return { from: () => Promise.resolve(rows) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getReceiptData — line totals include modifier deltas (WEB-DATA-002)", () => {
  it("line items with priced modifiers sum to order subtotal", async () => {
    // Item 1: base 15.00 + Pearls 2.00 + Large 1.00 = 18.00 × 2 = 36.00
    // Item 2: base 22.00 (no mods) × 1 = 22.00
    // Subtotal = 36.00 + 22.00 = 58.00
    const order = {
      id: "o1",
      orderNumber: "POS-58",
      channel: "dine_in",
      status: "completed",
      paymentMethod: "cash",
      staffId: null,
      customerName: null,
      customerPhone: null,
      subtotal: "58.00",
      tax: "0.00",
      discount: "0.00",
      total: "58.00",
      createdAt: new Date("2026-01-01T12:00:00Z"),
    };
    const items = [
      {
        id: "oi1",
        orderId: "o1",
        productId: "p1",
        selectedModifiers: [
          { modifierId: "m1", nameAr: "لؤلؤ", nameEn: "Pearls", priceDelta: "2.00" },
          { modifierId: "m2", nameAr: "كبير", nameEn: "Large", priceDelta: "1.00" },
        ],
        quantity: 2,
        unitPrice: "15.00",
      },
      {
        id: "oi2",
        orderId: "o1",
        productId: "p2",
        selectedModifiers: [],
        quantity: 1,
        unitPrice: "22.00",
      },
    ];
    const products = [
      { id: "p1", nameAr: "ميلك تي", nameEn: "Milk Tea" },
      { id: "p2", nameAr: "بان كيك", nameEn: "Pancake" },
    ];
    const settings = [
      { key: "shop_name", value: "Ayasofia Sweet" },
      { key: "shop_address", value: "Qalqilya" },
      { key: "shop_phone", value: "+972" },
      { key: "receipt_footer", value: "Thank you" },
    ];

    // Call order matches getReceiptData: orders, orderItems, products, settings
    mockDbSelect
      .mockReturnValueOnce(chain([order], true)) // orders.where.limit
      .mockReturnValueOnce(chain(items)) // orderItems.where
      .mockReturnValueOnce(chain(products)) // products.where (inArray)
      .mockReturnValueOnce(chainNoWhere(settings)); // settings (no where)

    const data = await getReceiptData("o1");
    expect(data).not.toBeNull();
    if (!data) return;

    // The core assertion: line totals must sum to subtotal
    const lineSum = data.items.reduce((s, i) => s + parseFloat(i.lineTotal), 0);
    expect(lineSum).toBeCloseTo(parseFloat(data.subtotal), 2);

    // Per-line correctness: deltas included
    expect(data.items[0].lineTotal).toBe("36.00");
    expect(data.items[1].lineTotal).toBe("22.00");
  });

  it("single item with no modifiers — line total equals unit price × qty", async () => {
    const order = {
      id: "o2",
      orderNumber: "POS-SINGLE",
      channel: "takeaway",
      status: "completed",
      paymentMethod: "card",
      staffId: null,
      customerName: null,
      customerPhone: null,
      subtotal: "45.00",
      tax: "0.00",
      discount: "0.00",
      total: "45.00",
      createdAt: new Date("2026-01-01"),
    };
    const items = [
      {
        id: "oi1",
        orderId: "o2",
        productId: "p1",
        selectedModifiers: [],
        quantity: 3,
        unitPrice: "15.00",
      },
    ];
    const products = [{ id: "p1", nameAr: "شاي", nameEn: "Tea" }];
    const settings: { key: string; value: string }[] = [];

    mockDbSelect
      .mockReturnValueOnce(chain([order], true))
      .mockReturnValueOnce(chain(items))
      .mockReturnValueOnce(chain(products))
      .mockReturnValueOnce(chainNoWhere(settings));

    const data = await getReceiptData("o2");
    expect(data).not.toBeNull();
    if (!data) return;

    expect(data.items[0].lineTotal).toBe("45.00");
    expect(parseFloat(data.items[0].lineTotal)).toBeCloseTo(parseFloat(data.subtotal), 2);
  });

  it("legacy snapshot format (plain modifier IDs) — deltas default to 0, no crash", async () => {
    const order = {
      id: "o3",
      orderNumber: "POS-LEGACY",
      channel: "dine_in",
      status: "completed",
      paymentMethod: "cash",
      staffId: null,
      customerName: null,
      customerPhone: null,
      subtotal: "15.00",
      tax: "0.00",
      discount: "0.00",
      total: "15.00",
      createdAt: new Date("2026-01-01"),
    };
    const items = [
      {
        id: "oi1",
        orderId: "o3",
        productId: "p1",
        selectedModifiers: ["m1", "m2"], // legacy format — no priceDelta info
        quantity: 1,
        unitPrice: "15.00",
      },
    ];
    const products = [{ id: "p1", nameAr: "شاي", nameEn: "Tea" }];
    const settings: { key: string; value: string }[] = [];

    mockDbSelect
      .mockReturnValueOnce(chain([order], true))
      .mockReturnValueOnce(chain(items))
      .mockReturnValueOnce(chain(products))
      .mockReturnValueOnce(chainNoWhere(settings));

    const data = await getReceiptData("o3");
    expect(data).not.toBeNull();
    if (!data) return;

    // Legacy format has no delta info → line total is just base × qty
    expect(data.items[0].lineTotal).toBe("15.00");
    expect(parseFloat(data.items[0].lineTotal)).toBeCloseTo(parseFloat(data.subtotal), 2);
  });

  it("returns null for unknown order ID", async () => {
    mockDbSelect.mockReturnValueOnce(chain([], true)); // orders.where.limit → empty

    const data = await getReceiptData("nonexistent");
    expect(data).toBeNull();
  });

  it("resolves staff name when order has staffId", async () => {
    const order = {
      id: "o4",
      orderNumber: "POS-STAFF",
      channel: "dine_in",
      status: "completed",
      paymentMethod: "cash",
      staffId: "s1",
      customerName: null,
      customerPhone: null,
      subtotal: "15.00",
      tax: "0.00",
      discount: "0.00",
      total: "15.00",
      createdAt: new Date("2026-01-01"),
    };
    const items = [
      {
        id: "oi1",
        orderId: "o4",
        productId: "p1",
        selectedModifiers: [],
        quantity: 1,
        unitPrice: "15.00",
      },
    ];
    const products = [{ id: "p1", nameAr: "شاي", nameEn: "Tea" }];
    const staff = [{ name: "Osama" }];
    const settings: { key: string; value: string }[] = [];

    mockDbSelect
      .mockReturnValueOnce(chain([order], true)) // orders
      .mockReturnValueOnce(chain(items)) // orderItems
      .mockReturnValueOnce(chain(products)) // products
      .mockReturnValueOnce(chain(staff, true)) // staff.where.limit
      .mockReturnValueOnce(chainNoWhere(settings)); // settings

    const data = await getReceiptData("o4");
    expect(data).not.toBeNull();
    if (!data) return;
    expect(data.staffName).toBe("Osama");
  });
});
