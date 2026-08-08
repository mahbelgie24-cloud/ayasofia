import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Empty state — replaces the bare "لا توجد..." text pasted across the app.
 *
 * Uses the brand's six-dot pearl grid as a visual anchor. Sized small by
 * default; `size="lg"` for full-page empty states.
 */
export interface EmptyStateProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  size?: "sm" | "lg";
  className?: string;
}

export function EmptyState({
  title,
  description,
  action,
  size = "sm",
  className,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "lg" ? "py-16" : "py-10",
        className,
      )}
    >
      <PearlGrid
        className={cn(
          "text-brand-red/40 mb-4",
          size === "lg" ? "[&>span]:size-2.5" : "[&>span]:size-2",
        )}
      />
      <p className={cn("text-brand-ink font-semibold", size === "lg" ? "text-lg" : "text-base")}>
        {title}
      </p>
      {description && (
        <p
          className={cn("text-text-secondary mt-1 max-w-sm", size === "lg" ? "text-sm" : "text-xs")}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Brand six-dot pearl grid — the empty state anchor. */
function PearlGrid({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("grid grid-cols-3 gap-1", className)}>
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} className="block rounded-full bg-current" />
      ))}
    </div>
  );
}
