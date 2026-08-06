/**
 * T-A2 (Q1=B) — /order retirement as a 308 permanent redirect.
 *
 * The legacy /order ordering surface must issue a permanent redirect (308) to
 * the digital menu (`/m/{defaultBranchSlug}`) so legacy printed QR URLs keep
 * working (not 404). The default branch resolves from `default_branch_slug`
 * first, else the first branch alphabetically.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSelect } = vi.hoisted(() => ({ mockSelect: vi.fn() }));

vi.mock("@/lib/db", () => ({
  db: {
    select: mockSelect,
  },
}));

import OrderPage from "@/app/order/page";

const from = { from: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  from.from.mockReset();
  mockSelect.mockReturnValue(from);
});

/** Call the page and capture the thrown Next redirect error. */
async function captureRedirect() {
  try {
    await OrderPage();
  } catch (e) {
    return e as unknown as { digest?: string };
  }
  throw new Error("OrderPage did not redirect");
}

describe("/order retirement (Q1=B)", () => {
  it("uses default_branch_slug setting when present (308 → /m/{slug})", async () => {
    from.from
      .mockReturnValueOnce({
        where: vi
          .fn()
          .mockReturnValue({ limit: vi.fn().mockResolvedValue([{ value: "qalqilya" }]) }),
      })
      .mockReturnValueOnce({});

    const err = await captureRedirect();
    expect(err?.digest).toContain("/m/qalqilya");
    // permanentRedirect encodes status 308 in the digest (…;url;308;)
    expect(err?.digest).toContain(";308;");
  });

  it("falls back to the first branch alphabetically when no setting", async () => {
    from.from
      .mockReturnValueOnce({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      })
      .mockReturnValueOnce({
        orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ slug: "jaffa" }]) }),
      });

    const err = await captureRedirect();
    expect(err?.digest).toContain("/m/jaffa");
    expect(err?.digest).toContain(";308;");
  });

  it("notFound (no branch configured)", async () => {
    from.from
      .mockReturnValueOnce({
        where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      })
      .mockReturnValueOnce({
        orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([]) }),
      });

    let thrown: unknown = null;
    try {
      await OrderPage();
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeTruthy();
    // Not a redirect to /m/ — it 404s instead.
    if (thrown && typeof (thrown as { digest?: string }).digest === "string") {
      expect((thrown as { digest: string }).digest).not.toContain("/m/");
    }
  });
});
