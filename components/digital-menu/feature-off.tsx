"use client";

import Image from "next/image";
import { PearlsField } from "@/components/digital-menu/pearls-field";

/**
 * Graceful branded fallback shown when a feature flag is OFF (C9) or a
 * public menu route can't resolve — never a bare 404. Reuses the brand
 * hero so the shop name still shows.
 */
export function FeatureOff({ message = "هذه الخدمة غير متاحة حاليًا" }: { message?: string }) {
  return (
    <div
      className="bg-brand-red-bg flex min-h-dvh flex-col items-center justify-center px-6 text-center"
      dir="rtl"
      lang="ar"
    >
      <div className="relative w-full max-w-sm">
        <PearlsField className="opacity-60" />
        <div className="shadow-card relative rounded-2xl bg-white p-8">
          <Image
            src="/icons/logo-mono.svg"
            alt="أياسوفيا"
            width={48}
            height={48}
            className="mx-auto mb-4 h-12 w-auto"
          />
          <h1 className="font-heading text-brand-ink text-xl font-bold">أياسوفيا</h1>
          <p className="text-text-secondary mt-2 text-sm leading-relaxed">{message}</p>
        </div>
      </div>
    </div>
  );
}
