"use client";

/**
 * Brand signature decorative field of floating pearls (spec §11.5).
 *
 * A lightweight, dependency-free backdrop used in the customer-facing
 * digital menu hero and the wifi splash. Pearls are pure CSS spheres —
 * no images, no third-party requests — so they satisfy the "critical/
 * inline assets only" rule for the wifi captive network (NFR-WF-01).
 *
 * Motion is a gentle spring float; it is globally disabled under
 * prefers-reduced-motion (see app/globals.css).
 */

const PEARL_VARIANTS = [
  "top-[8%] start-[6%] size-2.5 [animation-delay:0s]",
  "top-[18%] end-[12%] size-3.5 [animation-delay:0.8s]",
  "top-[6%] start-[42%] size-2 [animation-delay:1.6s]",
  "bottom-[12%] start-[14%] size-3 [animation-delay:0.4s]",
  "bottom-[6%] end-[8%] size-2 [animation-delay:2.1s]",
  "top-[38%] start-[80%] size-2.5 [animation-delay:1.2s]",
];

export function PearlsField({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      {PEARL_VARIANTS.map((variant, i) => (
        <span
          key={i}
          className={`animate-pearl-float absolute rounded-full bg-white/70 shadow-[0_2px_6px_rgba(0,0,0,0.12)] ${variant}`}
        />
      ))}
    </div>
  );
}
