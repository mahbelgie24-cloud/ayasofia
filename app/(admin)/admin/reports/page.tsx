import { requireStaffSession } from "@/lib/auth";
import { ReportsShell } from "./reports-shell";

export default async function ReportsPage() {
  await requireStaffSession("manager");
  return <ReportsShell />;
}
