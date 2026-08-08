"use client";

import { Clock, Sparkles } from "lucide-react";
import { PearlsField } from "@/components/digital-menu/pearls-field";
import { Card, CardBody } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";

/**
 * Graceful branded fallback shown when a feature flag is OFF (C9) or a
 * public menu route can't resolve — never a bare 404. Reuses the brand
 * hero so the shop name still shows.
 */
export function FeatureOff({ message = "هذه الخدمة غير متاحة حاليًا" }: { message?: string }) {
  return (
    <div
      className="bg-brand-red-bg relative flex min-h-dvh flex-col items-center justify-center px-6 py-10"
      dir="rtl"
      lang="ar"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="bg-brand-red/[0.06] absolute start-1/2 -top-24 size-[32rem] -translate-x-1/2 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <PearlsField className="opacity-60" />

        <Card variant="pop" className="text-center">
          <CardBody className="space-y-4 p-8">
            <div className="flex justify-center">
              <Logo size="lg" surface="tile" />
            </div>
            <div>
              <h1 className="heading-1 text-brand-ink">أياسوفيا</h1>
              <p className="caption text-text-secondary/70 mt-1 tracking-wider uppercase">
                حلويات آيا صوفيا
              </p>
            </div>
            <div className="bg-status-warning/[0.1] text-status-warning inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold">
              <Clock className="size-3" />
              <span>قريباً</span>
            </div>
            <p className="body text-text-secondary leading-relaxed">{message}</p>
            <p className="caption text-text-secondary/70 flex items-center justify-center gap-1">
              <Sparkles className="size-3" />
              <span>من تايوان إلى قلقيلية 🇹🇼</span>
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
