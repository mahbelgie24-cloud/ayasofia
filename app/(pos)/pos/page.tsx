import { requireStaffSession } from "@/lib/auth";
import { getMenuForPOS } from "@/lib/db/queries";
import { POSShell } from "@/app/(pos)/pos/pos-shell";

export default async function POSPage() {
  await requireStaffSession();
  const menu = await getMenuForPOS();

  return <POSShell menu={menu} />;
}
