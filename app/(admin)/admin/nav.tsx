"use client";

import { usePathname } from "next/navigation";

const links = [
  { href: "/admin/inventory", label: "المخزون" },
  { href: "/admin/reports", label: "التقارير" },
  { href: "/admin/menu", label: "القائمة" },
  { href: "/admin/staff", label: "الموظفين" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="border-border-subtle flex w-48 shrink-0 flex-col border-l bg-white p-4">
      <h2 className="font-heading text-brand-ink mb-4 text-lg font-semibold">الإدارة</h2>
      <ul className="space-y-1">
        {links.map((link) => {
          const active = pathname.startsWith(link.href);
          const built = true;
          return (
            <li key={link.href}>
              <a
                href={built ? link.href : "#"}
                className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-brand-red text-white"
                    : built
                      ? "text-brand-ink hover:bg-muted"
                      : "text-text-secondary cursor-not-allowed opacity-50"
                }`}
                onClick={(e) => {
                  if (!built) e.preventDefault();
                }}
              >
                {link.label}
                {!built && <span className="mr-1 text-xs">(قريباً)</span>}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
