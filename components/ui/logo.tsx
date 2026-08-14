import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The single source of truth for the Ayasofia logo. Renders the existing
 * `public/icons/logo-mono.svg` at the right size and contrast for the
 * surface it sits on.
 *
 * Sizes (px box):
 *   xs = 20, sm = 28, md = 40, lg = 56, xl = 80, 2xl = 112
 *
 * Surfaces:
 *   - "plain": no container
 *   - "tile":  brand-red rounded square (canonical login hero)
 *   - "soft":  brand-red soft wash
 *   - "ring":  brand-ink ring around the brand-red tile (premium / owner)
 *   - "glass": glassy white tile with shadow (sits on brand surfaces)
 *   - "halo":  brand-red tile with outer glow + animated pulse
 */
type LogoSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
type Surface = "plain" | "tile" | "soft" | "ring" | "glass" | "halo";

const sizeMap: Record<LogoSize, { box: number; img: number; tileRadius: string }> = {
  xs: { box: 20, img: 20, tileRadius: "rounded-md" },
  sm: { box: 28, img: 28, tileRadius: "rounded-xl" },
  md: { box: 40, img: 40, tileRadius: "rounded-2xl" },
  lg: { box: 56, img: 56, tileRadius: "rounded-3xl" },
  xl: { box: 80, img: 80, tileRadius: "rounded-[1.75rem]" },
  "2xl": { box: 112, img: 112, tileRadius: "rounded-[2.25rem]" },
};

export interface LogoProps {
  size?: LogoSize;
  invert?: boolean;
  surface?: Surface;
  className?: string;
  alt?: string;
  /** When true, logo gently breathes (used for hero moments only). */
  breathing?: boolean;
}

export function Logo({
  size = "md",
  invert = false,
  surface = "plain",
  className,
  alt = "Ayasofia Sweet",
  breathing = false,
}: LogoProps) {
  const s = sizeMap[size];
  const innerImgStyle = {
    width: s.img * 0.55,
    height: s.img * 0.55,
  };

  if (surface === "halo") {
    return (
      <div className={cn("relative inline-flex", className)}>
        <span
          aria-hidden="true"
          className="bg-brand-red/20 animate-pearl-pulse absolute inset-0 rounded-[2.5rem] blur-xl"
          style={{ transform: "scale(1.18)" }}
        />
        <div
          className={cn(
            "bg-brand-red shadow-brand relative flex shrink-0 items-center justify-center",
            s.tileRadius,
            breathing && "animate-pearl-pulse",
          )}
          style={{ width: s.box, height: s.box }}
          aria-label={alt}
          role="img"
        >
          <Image
            src="/icons/logo-mono.svg"
            alt=""
            width={s.img}
            height={s.img}
            className="invert"
            style={innerImgStyle}
          />
        </div>
      </div>
    );
  }

  if (surface === "ring") {
    return (
      <div
        className={cn(
          "bg-brand-red shadow-brand-soft ring-brand-ink/10 ring-offset-brand-cream flex shrink-0 items-center justify-center ring-2 ring-offset-2",
          s.tileRadius,
          className,
        )}
        style={{ width: s.box, height: s.box }}
        aria-label={alt}
        role="img"
      >
        <Image
          src="/icons/logo-mono.svg"
          alt=""
          width={s.img}
          height={s.img}
          className="invert"
          style={innerImgStyle}
        />
      </div>
    );
  }

  if (surface === "glass") {
    return (
      <div
        className={cn(
          "glass shadow-pop flex shrink-0 items-center justify-center",
          s.tileRadius,
          className,
        )}
        style={{ width: s.box, height: s.box }}
        aria-label={alt}
        role="img"
      >
        <Image
          src="/icons/logo-mono.svg"
          alt=""
          width={s.img}
          height={s.img}
          className="text-brand-red"
          style={{ width: s.img * 0.58, height: s.img * 0.58 }}
        />
      </div>
    );
  }

  if (surface === "tile") {
    return (
      <div
        className={cn(
          "bg-brand-red shadow-brand-soft relative flex shrink-0 items-center justify-center overflow-hidden",
          s.tileRadius,
          className,
        )}
        style={{ width: s.box, height: s.box }}
        aria-label={alt}
        role="img"
      >
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"
        />
        <Image
          src="/icons/logo-mono.svg"
          alt=""
          width={s.img}
          height={s.img}
          className="relative invert"
          style={innerImgStyle}
        />
      </div>
    );
  }

  if (surface === "soft") {
    return (
      <div
        className={cn(
          "bg-brand-red-soft relative flex items-center justify-center",
          s.tileRadius,
          className,
        )}
        style={{ width: s.box, height: s.box }}
        aria-label={alt}
        role="img"
      >
        <Image
          src="/icons/logo-mono.svg"
          alt=""
          width={s.img}
          height={s.img}
          className="text-brand-red"
          style={{ width: s.img * 0.65, height: s.img * 0.65 }}
        />
      </div>
    );
  }

  return (
    <Image
      src="/icons/logo-mono.svg"
      alt={alt}
      width={s.img}
      height={s.img}
      className={cn(invert && "invert", "shrink-0", className)}
    />
  );
}

/** A horizontal wordmark + logo lockup for headers. */
export function LogoLockup({
  size = "md",
  className,
}: {
  size?: "sm" | "md" | "lg";
  variant?: "default" | "stacked";
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Logo size={size} surface="tile" />
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="text-brand-ink font-bold tracking-tight">Ayasofia</span>
        <span className="text-text-secondary text-xs">حلويات آيا صوفيا</span>
      </div>
    </div>
  );
}
