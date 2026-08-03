import { getMenuForPOS } from "@/lib/db/queries";
import { CustomerOrderShell } from "./order-shell";

export default async function OrderPage() {
  const menu = await getMenuForPOS();
  return <CustomerOrderShell menu={menu} />;
}
