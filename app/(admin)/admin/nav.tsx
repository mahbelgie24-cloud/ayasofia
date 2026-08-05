"use client";

import { usePathname } from "next/navigation";

interface AdminNavProps {
  digitalMenuOn: boolean;
  wifiPortalOn: boolean;
}

export function AdminNav({ digitalMenuOn, wifiPortalOn }: AdminNavProps) {
  const pathname = usePathname();

  const baseLinks = [
    { href: "/admin", label: "لوحة التحكم" },
    { href: "/admin/inventory", label: "المخزون" },
    { href: "/admin/reports", label: "التقارير" },
    { href: "/admin/menu", label: "القائمة" },
    { href: "/admin/staff", label: "الموظفين" },
  ];

  // Feature-gated links — hidden when the feature flag is OFF (C9).
  const featureLinks = [
    ...(digitalMenuOn ? [{ href: "/admin/digital-menu", label: "القائمة الرقمية" }] : []),
    ...(wifiPortalOn ? [{ href: "/admin/wifi", label: "الواي فاي" }] : []),
  ];

  const links = [...baseLinks, ...featureLinks];

  return (
    <nav
      className="border-border-subtle flex w-48 shrink-0 flex-col border-l bg-white p-4"
      aria-label="قائمة الإدارة"
    >
      <h2 className="font-heading text-brand-ink mb-4 text-lg font-semibold">الإدارة</h2>
      <ul className="space-y-1" role="list">
        {links.map((link) => {
          const active =
            link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <a
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`ease-spring block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active ? "bg-brand-red text-white" : "text-brand-ink hover:bg-muted"
                }`}
              >
                {link.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
