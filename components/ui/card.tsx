import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The canonical surface. Every card, panel, popover, and elevated block
 * uses this — never raw `bg-white rounded-2xl shadow-sm`.
 *
 * Two variants:
 *   - default: low-elevation, for stacked content panels
 *   - pop:     higher-elevation, for hover/active cards and popovers
 *   - muted:   secondary surface (cream wash) for grouping nested content
 *   - flat:    border only, no shadow
 */
type CardVariant = "default" | "pop" | "muted" | "flat";

const variantClasses: Record<CardVariant, string> = {
  default: "bg-card shadow-card",
  pop: "bg-card shadow-pop",
  muted: "bg-brand-cream/60 border border-border-subtle",
  flat: "bg-card border border-border-subtle",
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, variant = "default", ...props },
  ref,
) {
  return (
    <div ref={ref} className={cn("rounded-2xl", variantClasses[variant], className)} {...props} />
  );
});

/**
 * Card content area with consistent padding. Use for the body of a card.
 */
export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pt-5 pb-3", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("border-border-subtle border-t px-5 py-3", className)} {...props} />;
}
