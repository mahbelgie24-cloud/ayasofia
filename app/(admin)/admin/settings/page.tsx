import { requireStaffSession } from "@/lib/auth";
import { SettingsShell } from "./settings-shell";

export default async function SettingsPage() {
  await requireStaffSession("owner");
  return <SettingsShell />;
}
