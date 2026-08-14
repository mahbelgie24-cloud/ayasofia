import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The canonical surface. Every card, panel, popover, and elevated block
 * uses this — never raw `bg-white rounded-2xl shadow-sm`.
 *
 * Variants:
 *   - default: low-elevation, for stacked content panels
 *   - pop:     higher-elevation, for hover/active cards and popovers
 *   - elev:    hero elevation, for top-of-page moments
 *   - muted:   secondary surface (cream wash) for grouping nested content
 *   - flat:    border only, no shadow
 *   - brand:   brand-red surface for hero CTAs
 *   - glass:   translucent + backdrop blur for overlays
 *   - outlined: hairline border, no shadow
 */
type CardVariant = "default" | "pop" | "elev" | "muted" | "flat" | "brand" | "glass";

const variantClasses: Record<CardVariant, string> = {
  default: "bg-card shadow-card",
  pop: "bg-card shadow-pop",
  elev: "bg-card shadow-elev",
  muted: "bg-brand-cream/60 border border-border-subtle",
  flat: "bg-card border border-border-subtle",
  brand: "bg-brand-red text-white shadow-brand-soft",
  glass: "glass shadow-pop",
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** When true, card slightly lifts on hover (use for clickable cards). */
  interactive?: boolean;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, variant = "default", interactive = false, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        "ease-spring rounded-2xl transition-all duration-300",
        variantClasses[variant],
        interactive && "hover:shadow-pop cursor-pointer hover:-translate-y-0.5",
        className,
      )}
      {...props}
    />
  );
});

/** Card content area with consistent padding. */
export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pt-5 pb-3", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-border-subtle border-t px-5 py-3", className)} {...props} />;
}
