import { requireStaffSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import { AdminNav } from "./nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireStaffSession("manager");
  } catch {
    notFound();
  }

  return (
    <div className="bg-brand-cream flex min-h-screen" dir="rtl" lang="ar">
      <AdminNav />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
