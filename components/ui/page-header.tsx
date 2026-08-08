import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * The page-level header for every admin/management surface. Replaces the
 * raw `<h1 className="font-heading text-2xl font-bold">` pattern pasted
 * across the app.
 *
 * Anatomy:
 *   ┌──────────────────────────────────────────┬──────────────┐
 *   │  [eyebrow]                               │              │
 *   │  Display Title                           │   Actions    │
 *   │  Subtitle (optional)                     │              │
 *   └──────────────────────────────────────────┴──────────────┘
 */
export interface PageHeaderProps {
  /** Small uppercase label above the title (e.g. "إدارة", "تقارير"). */
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ eyebrow, title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        "border-border-subtle flex flex-col gap-4 border-b pb-6 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-text-secondary/70 mb-1.5 text-[11px] font-semibold tracking-[0.08em] uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="heading-1 text-brand-ink">{title}</h1>
        {subtitle && <p className="text-text-secondary body mt-1.5 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/**
 * Section header — for dividing a page into named sections. Smaller than
 * a page header; no bottom border.
 */
export function SectionHeader({ title, subtitle, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="heading-3 text-brand-ink">{title}</h2>
        {subtitle && <p className="text-text-secondary body-sm mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
