import * as React from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * The single source of truth for the Ayasofia logo. Renders the existing
 * `public/icons/logo-mono.svg` at the right size and contrast for the
 * surface it sits on.
 *
 * Sizes (px box):
 *   xs = 20, sm = 28, md = 40, lg = 56, xl = 80
 *
 * `invert` flips the monochrome SVG to white for dark surfaces.
 * `surface="tile"` wraps the logo in a brand-red rounded square — the
 * canonical treatment for the login screen hero.
 */
type LogoSize = "xs" | "sm" | "md" | "lg" | "xl";

const sizeMap: Record<LogoSize, { box: number; img: number; tileRadius: string }> = {
  xs: { box: 20, img: 20, tileRadius: "rounded-md" },
  sm: { box: 28, img: 28, tileRadius: "rounded-xl" },
  md: { box: 40, img: 40, tileRadius: "rounded-2xl" },
  lg: { box: 56, img: 56, tileRadius: "rounded-3xl" },
  xl: { box: 80, img: 80, tileRadius: "rounded-[1.75rem]" },
};

export interface LogoProps {
  size?: LogoSize;
  invert?: boolean;
  surface?: "plain" | "tile" | "soft";
  className?: string;
  /** Accessible label. Defaults to "Ayasofia Sweet". */
  alt?: string;
}

export function Logo({
  size = "md",
  invert = false,
  surface = "plain",
  className,
  alt = "Ayasofia Sweet",
}: LogoProps) {
  const s = sizeMap[size];

  if (surface === "tile") {
    return (
      <div
        className={cn(
          "bg-brand-red shadow-brand-red/25 flex shrink-0 items-center justify-center shadow-md",
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
          style={{ width: s.img * 0.55, height: s.img * 0.55 }}
        />
      </div>
    );
  }

  if (surface === "soft") {
    return (
      <div
        className={cn(
          "bg-brand-red-soft flex items-center justify-center",
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
