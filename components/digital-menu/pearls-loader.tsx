"use client";

/**
 * Bouncing-pearls loader — the brand loading indicator (spec §11.5).
 *
 * Three pearls bound in a staggered rhythm. Used wherever the digital
 * menu or wifi portal loads async content. Disabled under
 * prefers-reduced-motion via the global rule in app/globals.css.
 * Screen readers are told the content is loading via aria-live.
 */

export function PearlsLoader({
  label = "جاري التحميل…",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 ${className}`}
    >
      <div className="flex items-center gap-2" aria-hidden="true">
        <span className="animate-pearl-bounce bg-brand-red size-3 rounded-full [animation-delay:0s]" />
        <span className="animate-pearl-bounce bg-brand-red size-3 rounded-full [animation-delay:0.2s]" />
        <span className="animate-pearl-bounce bg-brand-red size-3 rounded-full [animation-delay:0.4s]" />
      </div>
      <span className="text-text-secondary text-sm">{label}</span>
    </div>
  );
}
