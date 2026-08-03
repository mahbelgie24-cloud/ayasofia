import { requireStaffSession } from "@/lib/auth";
import { getMenuForPOS } from "@/lib/db/queries";
import { DriveThruShell } from "./drive-thru-shell";

export default async function DriveThruPage() {
  await requireStaffSession();
  const menu = await getMenuForPOS();

  return <DriveThruShell menu={menu} />;
}
