import { requireStaffSession } from "@/lib/auth";
import { notFound } from "next/navigation";
import { AdminNav } from "./nav";
import { AdminMobileNav } from "./mobile-nav";
import { Logo } from "@/components/ui/logo";
import { isFeatureEnabled, FEATURE_DIGITAL_MENU, FEATURE_WIFI_PORTAL } from "@/lib/features";

// Admin pages always need fresh, auth-gated data — never prerender them
// at build time (they query Postgres directly).  This also prevents a
// placeholder DATABASE_URL from breaking `next build` (CI).
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  let session;
  try {
    session = await requireStaffSession("manager");
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
    <div className="bg-brand-cream flex min-h-dvh" dir="rtl" lang="ar">
      <AdminNav
        digitalMenuOn={digitalMenuOn}
        wifiPortalOn={wifiPortalOn}
        isOwner={session.role === "owner"}
      />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar — only on small screens. The desktop nav is the
            full sidebar in `AdminNav`. */}
        <header className="border-border-subtle sticky top-0 z-30 flex items-center gap-3 border-b bg-white/90 px-4 py-3 backdrop-blur-md lg:hidden">
          <Logo size="sm" surface="tile" />
          <div className="min-w-0 flex-1">
            <h1 className="heading-3 text-brand-ink text-sm">لوحة الإدارة</h1>
            <p className="caption text-text-secondary">Ayasofia Sweet</p>
          </div>
        </header>

        <main className="flex-1 px-4 py-6 pb-24 sm:px-6 sm:py-8 lg:pb-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>

      <AdminMobileNav
        digitalMenuOn={digitalMenuOn}
        wifiPortalOn={wifiPortalOn}
        isOwner={session.role === "owner"}
      />
    </div>
  );
}
