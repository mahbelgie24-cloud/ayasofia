import { db } from "@/lib/db";
import { ingredients, suppliers } from "@/db/schema";
import { asc } from "drizzle-orm";
import { InventoryClient } from "./inventory-client";

export default async function InventoryPage() {
  const [ingRows, supRows] = await Promise.all([
    db.select().from(ingredients).orderBy(asc(ingredients.name)),
    db
      .select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers)
      .orderBy(asc(suppliers.name)),
  ]);

  const data = ingRows.map((r) => ({
    id: r.id,
    name: r.name,
    unit: r.unit,
    currentStock: r.currentStock,
    reorderThreshold: r.reorderThreshold,
    costPerUnit: r.costPerUnit,
  }));

  return <InventoryClient ingredients={data} suppliers={supRows} />;
}
