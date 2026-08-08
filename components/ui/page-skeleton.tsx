import * as React from "react";
import { Skeleton } from "./skeleton";
import { cn } from "@/lib/utils";

/**
 * Page-loading skeleton — replaces the bare "جاري التحميل..." text used
 * across the app. Mimics a real page layout: title bar, content cards,
 * optional grid of cards.
 */
export interface PageSkeletonProps {
  variant?: "dashboard" | "list" | "detail" | "form";
  className?: string;
}

export function PageSkeleton({ variant = "dashboard", className }: PageSkeletonProps) {
  return (
    <div className={cn("space-y-6", className)} aria-busy="true" aria-live="polite">
      <div className="space-y-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {variant === "dashboard" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-64" />
        </>
      )}

      {variant === "list" && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      )}

      {variant === "detail" && (
        <>
          <Skeleton className="h-40" />
          <Skeleton className="h-32" />
        </>
      )}

      {variant === "form" && (
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-10 w-1/3" />
        </div>
      )}
    </div>
  );
}
