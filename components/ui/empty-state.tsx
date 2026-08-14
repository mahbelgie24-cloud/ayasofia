import * as React from "react";
import { cn } from "@/lib/utils";
import { PearlField } from "./pearl-field";

/**
 * Empty state — replaces the bare "لا توجد..." text pasted across the app.
 * Uses the brand's six-dot pearl grid as a visual anchor.
 */
export interface EmptyStateProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  size?: "sm" | "lg";
  className?: string;
  icon?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  action,
  size = "sm",
  className,
  icon,
}: EmptyStateProps) {
  return (
    <div
      role="status"
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "lg" ? "py-20" : "py-12",
        className,
      )}
    >
      {icon ? (
        <div
          className={cn(
            "bg-brand-red-soft text-brand-red mb-4 flex items-center justify-center rounded-3xl",
            size === "lg" ? "size-20" : "size-14",
          )}
        >
          {icon}
        </div>
      ) : (
        <PearlField
          variant="trail"
          tone="brand"
          size={size === "lg" ? "lg" : "md"}
          className="mb-5"
        />
      )}
      <p className={cn("text-brand-ink font-bold", size === "lg" ? "text-xl" : "text-base")}>
        {title}
      </p>
      {description && (
        <p
          className={cn(
            "text-text-secondary mt-1.5 max-w-sm",
            size === "lg" ? "text-sm" : "text-xs",
          )}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
