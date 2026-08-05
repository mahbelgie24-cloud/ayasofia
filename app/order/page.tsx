import { getMenuForPOS } from "@/lib/db/queries";
import { CustomerOrderShell } from "./order-shell";

// Customer menu is fetched from Postgres per request (live prices/availability)
// — must not be statically prerendered at build time.
export const dynamic = "force-dynamic";

export default async function OrderPage() {
  const menu = await getMenuForPOS();
  return <CustomerOrderShell menu={menu} />;
}
