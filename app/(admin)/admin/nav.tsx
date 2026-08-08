"use client";

import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Package,
  BarChart3,
  UtensilsCrossed,
  Users,
  Menu as MenuIcon,
  Wifi,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";

interface AdminNavProps {
  digitalMenuOn: boolean;
  wifiPortalOn: boolean;
  isOwner: boolean;
}

interface NavLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  label: string;
  items: NavLink[];
}

export function AdminNav({ digitalMenuOn, wifiPortalOn, isOwner }: AdminNavProps) {
  const pathname = usePathname();

  // Build groups inside the component so the boolean flags (closure vars)
  // can gate the conditional links. T-B15: staff management is owner-only.
  const navGroups: NavGroup[] = [
    {
      label: "عام",
      items: [
        { href: "/admin", label: "لوحة التحكم", icon: LayoutDashboard },
        { href: "/admin/inventory", label: "المخزون", icon: Package },
        { href: "/admin/reports", label: "التقارير", icon: BarChart3 },
        { href: "/admin/menu", label: "القائمة", icon: UtensilsCrossed },
      ],
    },
    {
      label: "إدارة",
      items: [
        ...(isOwner ? [{ href: "/admin/staff", label: "الموظفين", icon: Users }] : []),
        ...(digitalMenuOn
          ? [{ href: "/admin/digital-menu", label: "القائمة الرقمية", icon: MenuIcon }]
          : []),
        ...(wifiPortalOn ? [{ href: "/admin/wifi", label: "الواي فاي", icon: Wifi }] : []),
      ],
    },
  ];

  return (
    <nav
      className="border-border-subtle hidden w-60 shrink-0 flex-col border-l bg-white/80 backdrop-blur-sm lg:flex"
      aria-label="قائمة الإدارة"
    >
      {/* Brand */}
      <div className="border-border-subtle flex items-center gap-3 border-b px-5 py-4">
        <Logo size="sm" surface="tile" />
        <div className="min-w-0">
          <h2 className="heading-3 text-brand-ink text-sm">الإدارة</h2>
          <p className="text-text-secondary caption">Ayasofia Sweet</p>
        </div>
      </div>

      {/* Nav groups */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            {group.items.length > 0 && (
              <p className="text-text-secondary/60 mb-2 px-2 text-[10px] font-semibold tracking-wider uppercase">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5" role="list">
              {group.items.map((link) => {
                const active =
                  link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
                const Icon = link.icon;
                return (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200",
                        active
                          ? "bg-brand-red shadow-brand-red/20 text-white shadow-sm"
                          : "text-brand-ink hover:bg-brand-red/5",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0 transition-colors",
                          active
                            ? "text-white/90"
                            : "text-text-secondary group-hover:text-brand-red",
                        )}
                      />
                      <span className="truncate">{link.label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="border-border-subtle border-t px-4 py-3">
        <p className="text-text-secondary/60 text-center text-[10px]">
          Ayasofia Sweet © {new Date().getFullYear()}
        </p>
      </div>
    </nav>
  );
}
