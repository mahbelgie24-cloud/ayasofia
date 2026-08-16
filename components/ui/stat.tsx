import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Stat / KPI card. The single source for the five-up KPI row on the
 * admin dashboard, and for inline stats inside reports.
 *
 * `tone` controls the value color and surface tint.
 * `featured` paints the entire card with a brand-red hero treatment —
 * use for the single most-important stat on the page.
 */
type Tone = "default" | "warning" | "success" | "brand";

const toneClasses: Record<Tone, string> = {
  default: "text-brand-ink",
  warning: "text-status-warning-ink",
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
  hint?: React.ReactNode;
  tone?: Tone;
  icon?: React.ReactNode;
  /** When true, paints the whole card with a brand-red gradient hero. */
  featured?: boolean;
  className?: string;
  /** Trailing element (e.g. trend indicator). */
  trend?: React.ReactNode;
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
  icon,
  featured = false,
  className,
  trend,
}: StatProps) {
  if (featured) {
    return (
      <div
        className={cn(
          "shadow-brand relative overflow-hidden rounded-3xl p-5 text-white transition-shadow",
          "from-brand-red-bright via-brand-red to-brand-red-dark bg-gradient-to-br",
          className,
        )}
      >
        <span
          aria-hidden="true"
          className="absolute -end-12 -top-12 size-40 rounded-full bg-white/10 blur-2xl"
        />
        <span
          aria-hidden="true"
          className="absolute -start-16 -bottom-16 size-48 rounded-full bg-white/5 blur-3xl"
        />
        <div className="relative flex items-center gap-2">
          {icon && <span className="text-white/90">{icon}</span>}
          <span className="eyebrow tracking-[0.14em] text-white/85">{label}</span>
        </div>
        <div className="relative mt-3 flex items-baseline gap-2">
          <span
            className="display-1 numeric text-white"
            style={{ fontSize: "2.25rem", lineHeight: 1 }}
          >
            {value}
          </span>
          {trend && <span className="text-sm font-medium text-white/85">{trend}</span>}
        </div>
        {hint && <span className="caption relative mt-1.5 block text-white/80">{hint}</span>}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "shadow-card group/stat flex flex-col gap-1 rounded-2xl p-5 transition-shadow",
        toneBgs[tone],
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {icon && (
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-lg",
              tone === "default" ? "bg-brand-red-soft text-brand-red" : "bg-white/60",
              tone === "brand" && "bg-brand-red-soft text-brand-red",
              tone === "warning" && "bg-status-warning/10 text-status-warning-ink",
              tone === "success" && "bg-status-success/10 text-status-success",
            )}
          >
            {icon}
          </span>
        )}
        <span className="label text-text-secondary tracking-wider uppercase">{label}</span>
      </div>
      <span
        className={cn("display-2 numeric mt-1.5", toneClasses[tone])}
        style={{ lineHeight: 1.05 }}
      >
        {value}
      </span>
      {hint && <span className="caption text-text-secondary mt-1">{hint}</span>}
    </div>
  );
}
