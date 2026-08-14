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
import { PearlDivider } from "@/components/ui/pearl-field";

interface AdminNavProps {
  digitalMenuOn: boolean;
  wifiPortalOn: boolean;
  isOwner: boolean;
}

interface NavLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
}

interface NavGroup {
  label: string;
  items: NavLink[];
}

export function AdminNav({ digitalMenuOn, wifiPortalOn, isOwner }: AdminNavProps) {
  const pathname = usePathname();

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
      className="border-border-subtle/60 hidden w-64 shrink-0 flex-col bg-white/70 backdrop-blur-md lg:flex"
      aria-label="قائمة الإدارة"
    >
      {/* Brand */}
      <div className="border-border-subtle/60 relative flex items-center gap-3 border-b px-5 py-5">
        <span
          aria-hidden="true"
          className="bg-brand-red/10 absolute -end-8 -top-8 size-24 rounded-full blur-2xl"
        />
        <Logo size="md" surface="tile" className="relative" />
        <div className="relative min-w-0">
          <h2 className="heading-3 text-brand-ink text-base leading-tight">الإدارة</h2>
          <p className="text-text-secondary caption">Ayasofia Sweet</p>
        </div>
      </div>

      {/* Nav groups */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-6 last:mb-0">
            {group.items.length > 0 && (
              <p className="text-text-secondary/60 mb-2.5 px-3 text-[10px] font-bold tracking-[0.14em] uppercase">
                {group.label}
              </p>
            )}
            <ul className="space-y-1" role="list">
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
                        "group ease-spring relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-medium transition-all duration-300",
                        active
                          ? "bg-brand-red shadow-brand-soft text-white"
                          : "text-brand-ink/80 hover:bg-brand-red-soft hover:text-brand-red",
                      )}
                    >
                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute end-1 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-white/20"
                        />
                      )}
                      <span
                        className={cn(
                          "flex size-7 items-center justify-center rounded-xl transition-colors",
                          active
                            ? "bg-white/15 text-white"
                            : "bg-muted text-text-secondary group-hover:text-brand-red group-hover:bg-white",
                        )}
                      >
                        <Icon className="size-4" />
                      </span>
                      <span className="truncate">{link.label}</span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {/* Footer with brand mark */}
      <div className="border-border-subtle/60 border-t px-4 py-4">
        <PearlDivider tone="muted" className="mb-3" />
        <p className="text-text-secondary/60 text-center text-[10px] font-medium tracking-wider uppercase">
          Ayasofia Sweet · {new Date().getFullYear()}
        </p>
      </div>
    </nav>
  );
}
