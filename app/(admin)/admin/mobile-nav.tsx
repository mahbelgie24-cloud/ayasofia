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
      className="border-border-subtle fixed inset-x-0 bottom-0 z-40 border-t bg-white/95 backdrop-blur-md lg:hidden"
      aria-label="القائمة السريعة"
    >
      <ul className="flex items-stretch justify-around px-1 py-1" role="list">
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
                  "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[10px] font-medium transition-colors",
                  active ? "text-brand-red" : "text-text-secondary hover:text-brand-ink",
                )}
              >
                <Icon
                  className={cn("size-5 shrink-0 transition-colors", active && "text-brand-red")}
                />
                <span className="truncate">{link.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
