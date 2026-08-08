import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Stat / KPI card. The single source for the five-up KPI row on the
 * admin dashboard, and for inline stats inside reports.
 *
 * `tone="warning"` paints the value amber to flag an actionable state
 * (e.g. low stock count).  All other tones use ink.
 */
type Tone = "default" | "warning" | "success" | "brand";

const toneClasses: Record<Tone, string> = {
  default: "text-brand-ink",
  warning: "text-status-warning",
  success: "text-status-success",
  brand: "text-brand-red",
};

const toneBgs: Record<Tone, string> = {
  default: "bg-card",
  warning: "bg-status-warning/[0.08]",
  success: "bg-status-success/[0.08]",
  brand: "bg-brand-red/[0.06]",
};

export interface StatProps {
  label: React.ReactNode;
  value: React.ReactNode;
  /** Small hint line under the value (e.g. unit, comparison). */
  hint?: React.ReactNode;
  tone?: Tone;
  /** Optional lucide icon shown above the label. */
  icon?: React.ReactNode;
  className?: string;
}

export function Stat({ label, value, hint, tone = "default", icon, className }: StatProps) {
  return (
    <div
      className={cn(
        "shadow-card flex flex-col gap-1 rounded-2xl p-5 transition-shadow",
        toneBgs[tone],
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {icon && <span className="text-text-secondary">{icon}</span>}
        <span className="label text-text-secondary tracking-wider uppercase">{label}</span>
      </div>
      <span
        className={cn("display-1 numeric mt-1", toneClasses[tone])}
        style={{ fontSize: "1.875rem", lineHeight: 1.1 }}
      >
        {value}
      </span>
      {hint && <span className="caption text-text-secondary/80 mt-0.5">{hint}</span>}
    </div>
  );
}
