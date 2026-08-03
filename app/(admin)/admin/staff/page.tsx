import { requireStaffSession } from "@/lib/auth";
import { StaffShell } from "./staff-shell";

export default async function StaffPage() {
  await requireStaffSession("owner");
  return <StaffShell />;
}
