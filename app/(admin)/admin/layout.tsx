import { requireStaffSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import { AdminNav } from "./nav";
import { isFeatureEnabled, FEATURE_DIGITAL_MENU, FEATURE_WIFI_PORTAL } from "@/lib/features";

// Admin pages always need fresh, auth-gated data — never prerender them
// at build time (they query Postgres directly).  This also prevents a
// placeholder DATABASE_URL from breaking `next build` (CI).
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  try {
    await requireStaffSession("manager");
  } catch {
    notFound();
  }

  // Resolve feature flags server-side so the nav can hide digital-menu/
  // wifi items when the corresponding feature is OFF (C9). Never trust a
  // client-side flag for authorization — these only control visibility.
  const [digitalMenuOn, wifiPortalOn] = await Promise.all([
    isFeatureEnabled(FEATURE_DIGITAL_MENU),
    isFeatureEnabled(FEATURE_WIFI_PORTAL),
  ]);

  return (
    <div className="bg-brand-cream flex min-h-screen" dir="rtl" lang="ar">
      <AdminNav digitalMenuOn={digitalMenuOn} wifiPortalOn={wifiPortalOn} />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
