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

interface AdminMobileNavProps {
  digitalMenuOn: boolean;
  wifiPortalOn: boolean;
  isOwner: boolean;
}

interface NavLink {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export function AdminMobileNav({ digitalMenuOn, wifiPortalOn, isOwner }: AdminMobileNavProps) {
  const pathname = usePathname();

  const items: NavLink[] = [
    { href: "/admin", label: "الرئيسية", icon: LayoutDashboard },
    { href: "/admin/inventory", label: "المخزون", icon: Package },
    { href: "/admin/reports", label: "التقارير", icon: BarChart3 },
    { href: "/admin/menu", label: "القائمة", icon: UtensilsCrossed },
  ];

  if (isOwner) items.push({ href: "/admin/staff", label: "الموظفين", icon: Users });
  if (digitalMenuOn) items.push({ href: "/admin/digital-menu", label: "الرقمية", icon: MenuIcon });
  if (wifiPortalOn) items.push({ href: "/admin/wifi", label: "الواي فاي", icon: Wifi });

  return (
    <nav
      className="border-border-subtle/60 fixed inset-x-3 bottom-3 z-40 lg:hidden"
      aria-label="القائمة السريعة"
    >
      <div className="shadow-elev mx-auto max-w-md rounded-3xl border border-white/40 bg-white/85 px-1.5 py-1.5 backdrop-blur-xl">
        <ul className="flex items-stretch justify-around" role="list">
          {items.map((link) => {
            const active =
              link.href === "/admin" ? pathname === "/admin" : pathname.startsWith(link.href);
            const Icon = link.icon;
            return (
              <li key={link.href} className="flex-1">
                <a
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "ease-spring relative flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 text-[10px] font-semibold transition-all duration-300",
                    active ? "text-white" : "text-text-secondary hover:text-brand-ink",
                  )}
                >
                  {active && (
                    <span
                      aria-hidden="true"
                      className="bg-brand-red shadow-brand-soft absolute inset-0 rounded-2xl"
                    />
                  )}
                  <Icon
                    className={cn(
                      "relative z-10 size-5 shrink-0 transition-colors",
                      active ? "text-white" : "text-text-secondary",
                    )}
                  />
                  <span className="relative z-10 truncate">{link.label}</span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
