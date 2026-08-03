import { requireStaffSession } from "@/lib/auth";
import { MenuShell } from "./menu-shell";

export default async function MenuPage() {
  await requireStaffSession("manager");
  return <MenuShell />;
}
