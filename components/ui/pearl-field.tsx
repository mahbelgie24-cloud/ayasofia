"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * PearlField — the brand's signature 6-dot motif from the logo, used
 * everywhere as a decorative brand element: empty states, loading
 * indicators, section dividers, login hero, customer hero.
 *
 * Variants:
 *   - "grid":    the literal logo 3×2 grid (default)
 *   - "trail":   3×2 grid with staggered floating animation
 *   - "scatter": random-feeling scatter of pearls (sized via container)
 *   - "loading": triple-bounce loader using the pearl motif
 *
 * Tones:
 *   - "brand":  brand red
 *   - "ink":    brand ink
 *   - "white":  white (on dark/red surfaces)
 *   - "muted":  faded for backgrounds
 */
type Variant = "grid" | "trail" | "scatter" | "loading" | "row";
type Tone = "brand" | "ink" | "white" | "muted" | "soft";

const toneClasses: Record<Tone, string> = {
  brand: "bg-brand-red",
  ink: "bg-brand-ink",
  white: "bg-white",
  muted: "bg-brand-red/30",
  soft: "bg-brand-red-soft",
};

export interface PearlFieldProps {
  variant?: Variant;
  tone?: Tone;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  /** Number of pearls to render in scatter/row variants. */
  count?: number;
}

const sizeMap: Record<NonNullable<PearlFieldProps["size"]>, string> = {
  sm: "gap-1 [&>span]:size-1.5",
  md: "gap-1.5 [&>span]:size-2.5",
  lg: "gap-2 [&>span]:size-3.5",
  xl: "gap-2.5 [&>span]:size-5",
};

export function PearlField({
  variant = "grid",
  tone = "brand",
  size = "md",
  className,
  count = 6,
}: PearlFieldProps) {
  if (variant === "grid" || variant === "trail") {
    return (
      <div
        aria-hidden="true"
        className={cn("grid grid-cols-3", toneClasses[tone].replace("bg-", "text-"), className)}
        style={{ gap: sizeMap[size].match(/gap-[\d.]+/)?.[0] }}
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "block rounded-full",
              toneClasses[tone],
              variant === "trail" && "animate-pearl-pulse",
            )}
            style={variant === "trail" ? { animationDelay: `${(i * 150) % 900}ms` } : undefined}
          />
        ))}
      </div>
    );
  }

  if (variant === "row") {
    return (
      <div
        aria-hidden="true"
        className={cn("flex items-center", toneClasses[tone].replace("bg-", "text-"), className)}
        style={{ gap: sizeMap[size].match(/gap-[\d.]+/)?.[0] }}
      >
        {Array.from({ length: count }).map((_, i) => (
          <span
            key={i}
            className={cn("block rounded-full", toneClasses[tone], "animate-pearl-pulse")}
            style={{ animationDelay: `${(i * 120) % 960}ms` }}
          />
        ))}
      </div>
    );
  }

  if (variant === "loading") {
    return (
      <div aria-hidden="true" className={cn("flex items-center gap-1.5", className)}>
        {Array.from({ length: 3 }).map((_, i) => (
          <span
            key={i}
            className={cn("block size-2.5 rounded-full", toneClasses[tone], "animate-pearl-bounce")}
            style={{ animationDelay: `${i * 160}ms` }}
          />
        ))}
      </div>
    );
  }

  // scatter — random-feeling placement across a container
  const positions = [
    { top: "8%", start: "12%" },
    { top: "20%", start: "78%" },
    { top: "40%", start: "20%" },
    { top: "55%", start: "60%" },
    { top: "70%", start: "85%" },
    { top: "85%", start: "32%" },
    { top: "12%", start: "50%" },
    { top: "78%", start: "12%" },
    { top: "32%", start: "92%" },
    { top: "62%", start: "8%" },
  ];
  return (
    <div aria-hidden="true" className={cn("pointer-events-none absolute inset-0", className)}>
      {positions.slice(0, count).map((p, i) => (
        <span
          key={i}
          className={cn(
            "absolute block rounded-full",
            toneClasses[tone],
            tone === "muted" ? "size-2" : tone === "white" ? "size-3" : "size-2.5",
            "animate-pearl-float",
          )}
          style={{
            top: p.top,
            insetInlineStart: p.start,
            animationDelay: `${(i * 220) % 1800}ms`,
            animationDuration: `${4 + (i % 3)}s`,
          }}
        />
      ))}
    </div>
  );
}

/** A small inline brand-mark divider: two pearls on each side of a line. */
export function PearlDivider({ tone = "muted", className }: { tone?: Tone; className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex items-center justify-center gap-2", className)}>
      <span className={cn("h-px flex-1", tone === "muted" ? "bg-border-subtle" : "bg-white/20")} />
      <div className="flex items-center gap-1">
        <span className={cn("block size-1.5 rounded-full", toneClasses[tone])} />
        <span className={cn("block size-2 rounded-full", toneClasses[tone])} />
        <span className={cn("block size-1.5 rounded-full", toneClasses[tone])} />
      </div>
      <span className={cn("h-px flex-1", tone === "muted" ? "bg-border-subtle" : "bg-white/20")} />
    </div>
  );
}
