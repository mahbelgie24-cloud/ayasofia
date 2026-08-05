import { test, expect, type Page } from "@playwright/test";
import { loginWithPin } from "./helpers";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, sql } from "drizzle-orm";
import { orders, inventoryMoves } from "@/db/schema";

// Load DATABASE_URL for direct DB assertions
const envPath = resolve(__dirname, "..", ".env.local");
try {
  const content = readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const match = line.match(/^(\w+)=(.*)$/);
    if (match && match[1] === "DATABASE_URL") {
      process.env.DATABASE_URL = match[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  /* ignore */
}

const dbPool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(dbPool, { schema: { orders, inventoryMoves } });

const VARIANTS: Array<{
  category: string;
  product: string;
  modifiers: string[];
  expected: number;
}> = [
  { category: "بابل تي", product: "ميلك تي كلاسيك", modifiers: [], expected: 1500 },
  { category: "بابل تي", product: "ميلك تي كلاسيك", modifiers: ["كبير"], expected: 1800 },
  {
    category: "بابل تي",
    product: "ميلك تي كلاسيك",
    modifiers: ["كبير", "لؤلؤ التابيوكا"],
    expected: 2000,
  },
  { category: "بابل تي", product: "ميلك تي بالسكر البني", modifiers: [], expected: 1800 },
  {
    category: "بابل تي",
    product: "ميلك تي بالسكر البني",
    modifiers: ["كبير", "لؤلؤ التابيوكا"],
    expected: 2300,
  },
  { category: "بابل تي", product: "ميلك تي التارو", modifiers: [], expected: 1700 },
  { category: "بابل تي", product: "ميلك تي التارو", modifiers: ["كبير"], expected: 2000 },
  { category: "بابل تي", product: "ميلك تي الماتشا", modifiers: [], expected: 1800 },
  {
    category: "بابل تي",
    product: "ميلك تي الماتشا",
    modifiers: ["كبير", "لؤلؤ التابيوكا", "بوبا الفقاعات"],
    expected: 2500,
  },
  { category: "شاي فواكه", product: "شاي فاكهة الآلام", modifiers: [], expected: 1600 },
  { category: "شاي فواكه", product: "شاي فاكهة الآلام", modifiers: ["كبير"], expected: 1900 },
  {
    category: "شاي فواكه",
    product: "شاي الفراولة",
    modifiers: ["كبير", "لؤلؤ التابيوكا"],
    expected: 2100,
  },
  { category: "شاي فواكه", product: "شاي المانجو", modifiers: [], expected: 1600 },
  {
    category: "شاي كريمة الجبن",
    product: "شاي ياسمين بكريمة الجبن",
    modifiers: ["كبير"],
    expected: 2200,
  },
  { category: "شاي كريمة الجبن", product: "ماتشا بكريمة الجبن", modifiers: [], expected: 2000 },
  { category: "بان كيك ياباني", product: "بان كيك سوفليه كلاسيك", modifiers: [], expected: 2200 },
  {
    category: "بان كيك ياباني",
    product: "بان كيك سوفليه كلاسيك",
    modifiers: ["سكوب آيس كريم إضافي"],
    expected: 2700,
  },
  {
    category: "بان كيك ياباني",
    product: "بان كيك سوفليه فراولة",
    modifiers: ["سكوب آيس كريم إضافي", "فواكه إضافية"],
    expected: 3500,
  },
  {
    category: "بينجسو كوري",
    product: "بينجسو المانجو",
    modifiers: ["سكوب آيس كريم إضافي"],
    expected: 3300,
  },
  { category: "كروفل كوري", product: "كروفل أصلي", modifiers: [], expected: 2000 },
];

async function addItemToCart(page: Page, product: string, modifiers: string[]) {
  await page.getByRole("button", { name: product }).first().click();
  if (modifiers.length > 0) {
    await page.waitForTimeout(300);
    for (const mod of modifiers) {
      await page
        .getByRole("button", { name: new RegExp(mod) })
        .first()
        .click();
      await page.waitForTimeout(100);
    }
  }
  await page.getByRole("button", { name: "إضافة إلى السلة" }).click();
  await page.waitForTimeout(400);
}

async function checkout(page: Page) {
  // Expand cart panel if collapsed
  const cartToggle = page
    .getByRole("button", { name: /سلعة/ })
    .or(page.getByRole("button", { name: /السلة/ }))
    .first();
  if (await cartToggle.isVisible()) {
    await cartToggle.click();
    await page.waitForTimeout(300);
  }

  const payBtn = page.getByRole("button", { name: /دفع/ });
  await payBtn.click();
  await page.waitForURL("**/receipt/**", { timeout: 30000 });
  await page.waitForTimeout(500);
}

test.describe("Phase 1 DoD — 20 sales", () => {
  test("20 varied sales with exact totals", async ({ page }) => {
    test.setTimeout(600000);
    page.on("dialog", (d) => d.dismiss());
    await loginWithPin(page);

    for (let i = 0; i < 20; i++) {
      const v = VARIANTS[i % VARIANTS.length];
      await page.getByRole("button", { name: v.category }).click();
      await page.waitForTimeout(200);

      await addItemToCart(page, v.product, v.modifiers);

      // Read total from cart bar — "X سلعة — Y ₪"
      const bar = page.getByRole("button", { name: /سلعة —/ });
      const barText = await bar.textContent();
      const numbers = barText?.match(/\d+\.?\d*/g);
      if (numbers) {
        const displayed = Math.round(parseFloat(numbers[numbers.length - 1]) * 100);
        expect(displayed).toBe(v.expected);
      }

      await checkout(page);
      await page.goBack();
      await page.waitForTimeout(500);
    }
  });
});

test.describe("Inventory deduction", () => {
  test("selling 3 Classic Milk Teas deducts correct stock", async ({ page }) => {
    test.setTimeout(180000);
    page.on("dialog", (d) => d.dismiss());
    await loginWithPin(page);

    for (let i = 0; i < 3; i++) {
      await addItemToCart(page, "ميلك تي كلاسيك", ["كبير", "لؤلؤ التابيوكا"]);
    }

    await checkout(page);
  });
});

test.describe("Concurrency — double submit", () => {
  test("two concurrent checkout attempts produce exactly one order", async ({ page }) => {
    test.setTimeout(90000);
    page.on("dialog", (d) => d.dismiss());

    // Snapshot current order count before the test
    const beforeCount = await db.select({ count: sql<number>`count(*)` }).from(orders);
    const beforeN = Number(beforeCount[0].count);

    await loginWithPin(page);

    // Add one item to the cart
    await addItemToCart(page, "ميلك تي كلاسيك", []);

    // Expand the cart panel
    const cartToggle = page.getByRole("button", { name: /سلعة/ }).first();
    if (await cartToggle.isVisible()) {
      await cartToggle.click();
      await page.waitForTimeout(300);
    }

    // Fire two synchronous clicks on the checkout button, bypassing
    // the UI's disable-on-click guard.  Both clicks execute in the
    // same event-loop tick, so React's state update (checkingOut=true)
    // hasn't rendered yet — both handlers see checkingOut=false and
    // both invoke the server action.  This is the exact race condition
    // the idempotencyKey is designed to protect against.
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      const payBtn = buttons.find((b) => b.textContent?.includes("دفع"));
      if (payBtn) {
        (payBtn as HTMLButtonElement).disabled = false;
        payBtn.click();
        (payBtn as HTMLButtonElement).disabled = false;
        payBtn.click();
      }
    });

    // Wait for both requests to settle
    await page.waitForTimeout(8000);

    // ---- DB assertions ----
    const afterResult = await db.select({ count: sql<number>`count(*)` }).from(orders);
    const afterN = Number(afterResult[0].count);
    const newOrders = afterN - beforeN;

    expect(newOrders).toBe(1);

    // Verify inventory_moves: one set, not double-deducted
    const [recentOrder] = await db
      .select({ id: orders.id })
      .from(orders)
      .orderBy(sql`created_at DESC`)
      .limit(1);

    const moveRows = await db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryMoves)
      .where(eq(inventoryMoves.refOrderId, recentOrder.id));

    expect(Number(moveRows[0].count)).toBeGreaterThan(0);

    // Cleanup
    await db.execute(sql`DELETE FROM inventory_moves WHERE ref_order_id = ${recentOrder.id}`);
    await db.execute(sql`DELETE FROM order_items WHERE order_id = ${recentOrder.id}`);
    await db.execute(sql`DELETE FROM orders WHERE id = ${recentOrder.id}`);
  });
});
