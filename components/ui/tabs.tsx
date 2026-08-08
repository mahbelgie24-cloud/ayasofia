"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Pill-style tab bar. The single source of truth for category tabs in the
 * POS, Drive-Thru, and Digital Menu, and for navigation tabs in the admin
 * reports/inventory/menu pages.
 *
 * Use as:
 *   const [tab, setTab] = useState("sales");
 *   <Tabs value={tab} onValueChange={setTab} items={[
 *     { value: "sales", label: "مبيعات" },
 *     { value: "bestsellers", label: "الأكثر مبيعاً" },
 *   ]} />
 */
export interface TabItem {
  value: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  /** Show a small count badge on the right side. */
  count?: React.ReactNode;
}

export interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  items: TabItem[];
  /** Visually denser tabs (e.g. Drive-Thru). */
  size?: "sm" | "md";
  /** "pills" (default) | "underline" — admin sections use underline. */
  variant?: "pills" | "underline";
  className?: string;
  "aria-label"?: string;
}

export function Tabs({
  value,
  onValueChange,
  items,
  size = "md",
  variant = "pills",
  className,
  ...aria
}: TabsProps) {
  return (
    <div
      role="tablist"
      aria-label={aria["aria-label"]}
      className={cn(
        variant === "pills"
          ? "flex flex-wrap items-center gap-1.5"
          : "border-border-subtle flex items-center gap-4 border-b",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onValueChange(item.value)}
            className={cn(
              "ease-spring inline-flex shrink-0 items-center gap-2 font-medium transition-colors",
              size === "sm" ? "body-sm" : "body",
              variant === "pills"
                ? cn(
                    "rounded-full",
                    size === "sm" ? "px-3 py-1.5" : "px-4 py-2",
                    active
                      ? "bg-brand-red shadow-brand-red/20 text-white shadow-sm"
                      : "bg-muted text-brand-ink hover:bg-muted/80",
                  )
                : cn(
                    "-mb-px border-b-2 px-1 pb-3",
                    active
                      ? "border-brand-red text-brand-red"
                      : "text-text-secondary hover:text-brand-ink border-transparent",
                  ),
            )}
          >
            {item.icon && (
              <span
                className={cn(
                  "size-4 shrink-0 [&_svg]:size-4",
                  active && variant === "pills" ? "text-white" : "",
                )}
                aria-hidden="true"
              >
                {item.icon}
              </span>
            )}
            <span>{item.label}</span>
            {item.count != null && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                  active && variant === "pills"
                    ? "bg-white/20 text-white"
                    : "bg-muted text-text-secondary",
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
