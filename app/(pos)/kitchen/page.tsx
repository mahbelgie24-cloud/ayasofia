import { requireStaffSession } from "@/lib/auth";
import { fetchActiveOrders, type ActiveKitchenOrder } from "./actions";
import { KitchenShell } from "./kitchen-shell";

export type { ActiveKitchenOrder as KitchenOrder };

export default async function KitchenPage() {
  await requireStaffSession();
  const initialOrders = await fetchActiveOrders();
  return <KitchenShell initialOrders={initialOrders} />;
}
