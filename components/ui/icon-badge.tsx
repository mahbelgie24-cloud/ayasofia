import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * IconBadge — the canonical icon container. Used in the login hero,
 * admin nav brand block, and as inline status indicators.
 *
 * Variants:
 *   - brand:  brand-red tile (primary CTAs / brand anchor)
 *   - soft:   brand-red soft wash
 *   - ink:    brand-ink (premium / owner surfaces)
 *   - muted:  cream wash (neutral inline icons)
 *   - success / warning / error:  status tiles
 */
type Variant = "brand" | "soft" | "ink" | "muted" | "success" | "warning" | "error";

const variantClasses: Record<Variant, string> = {
  brand: "bg-brand-red text-white shadow-md shadow-brand-red/20",
  soft: "bg-brand-red-soft text-brand-red",
  ink: "bg-brand-ink text-white shadow-md shadow-brand-ink/20",
  muted: "bg-brand-cream text-brand-ink border border-border-subtle",
  success: "bg-status-success/[0.12] text-status-success",
  warning: "bg-status-warning/[0.12] text-status-warning",
  error: "bg-status-error/[0.12] text-status-error",
};

const sizeMap = {
  sm: "size-8 rounded-xl",
  md: "size-10 rounded-2xl",
  lg: "size-12 rounded-2xl",
  xl: "size-16 rounded-3xl",
};

export interface IconBadgeProps {
  icon: React.ReactNode;
  variant?: Variant;
  size?: keyof typeof sizeMap;
  className?: string;
  "aria-label"?: string;
}

export function IconBadge({
  icon,
  variant = "brand",
  size = "md",
  className,
  ...aria
}: IconBadgeProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center [&_svg]:size-1/2",
        variantClasses[variant],
        sizeMap[size],
        className,
      )}
      aria-label={aria["aria-label"]}
      role={aria["aria-label"] ? "img" : undefined}
    >
      {icon}
    </div>
  );
}
