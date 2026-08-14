"use client";

import { Clock, Sparkles } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { PearlField, PearlDivider } from "@/components/ui/pearl-field";

/**
 * Graceful branded fallback shown when a feature flag is OFF (C9) or a
 * public menu route can't resolve — never a bare 404. Reuses the brand
 * hero so the shop name still shows.
 */
export function FeatureOff({ message = "هذه الخدمة غير متاحة حاليًا" }: { message?: string }) {
  return (
    <div
      className="bg-brand-red-bg relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-10"
      dir="rtl"
      lang="ar"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="bg-brand-red/[0.08] absolute start-1/2 -top-32 size-[40rem] -translate-x-1/2 rounded-full blur-3xl" />
        <PearlField variant="scatter" tone="muted" count={8} />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="animate-fade-in mb-6 flex justify-center">
          <Logo size="xl" surface="halo" />
        </div>

        <Card
          variant="elev"
          className="noise animate-scale-in relative overflow-hidden text-center"
          style={{ animationDelay: "120ms" }}
        >
          <CardBody className="relative space-y-4 p-8">
            <div className="flex justify-center">
              <Logo size="md" surface="tile" />
            </div>
            <div>
              <h1 className="heading-1 text-brand-ink">أياسوفيا</h1>
              <p className="caption text-text-secondary/70 mt-1.5 tracking-[0.14em] uppercase">
                حلويات آيا صوفيا
              </p>
            </div>
            <div className="bg-status-warning/[0.12] text-status-warning inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold tracking-wider uppercase">
              <Clock className="size-3" />
              <span>قريباً</span>
            </div>
            <p className="body text-text-secondary leading-relaxed">{message}</p>
            <PearlDivider tone="muted" className="my-2" />
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
