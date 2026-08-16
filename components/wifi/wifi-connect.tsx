"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, AtSign, ArrowLeft, Sparkles, Wifi } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { endWifiSession } from "@/app/wifi/actions";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { PearlField, PearlDivider } from "@/components/ui/pearl-field";
import { formatPrice, toMinorUnits } from "@/lib/pricing";

interface Suggestion {
  success: boolean;
  product: {
    id: string;
    nameAr: string;
    basePrice: string;
    imageUrl: string | null;
    titleAr: string | null;
  } | null;
  branchSlug: string | null;
}

function deviceId(): string {
  if (typeof window === "undefined") return "unknown";
  try {
    return window.localStorage.getItem("ayasofia-device-id") ?? crypto.randomUUID();
  } catch {
    return crypto.randomUUID();
  }
}

/**
 * Post-connect screen (WF-03): confirms the connection, shows Today's
 * Suggestion and a "تصفّح القائمة" CTA, plus the Instagram link. Ends the
 * session (logs duration) when the guest leaves.
 */
export function WifiConnect({ suggestion }: { suggestion: Suggestion }) {
  const [startedAt] = useState(() => Date.now());
  const menuHref = suggestion.branchSlug ? `/m/${suggestion.branchSlug}` : "/m";

  useEffect(() => {
    const end = () => {
      const durationSec = Math.round((Date.now() - startedAt) / 1000);
      if (typeof window !== "undefined") {
        void endWifiSession({ deviceId: deviceId(), durationSec });
      }
    };
    document.addEventListener("pagehide", end);
    return () => document.removeEventListener("pagehide", end);
  }, [startedAt]);

  const handleMenu = useCallback(() => {
    const durationSec = Math.round((Date.now() - startedAt) / 1000);
    void endWifiSession({ deviceId: deviceId(), durationSec });
  }, [startedAt]);

  return (
    <div
      className="bg-brand-red-bg relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-10"
      dir="rtl"
      lang="ar"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="bg-status-success/[0.1] absolute start-1/2 -top-32 size-[40rem] -translate-x-1/2 rounded-full blur-3xl" />
        <div className="bg-brand-red/[0.05] absolute end-1/4 -bottom-32 size-[28rem] rounded-full blur-3xl" />
        <PearlField variant="scatter" tone="muted" count={8} />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="animate-fade-in mb-6 flex justify-center">
          <Logo size="xl" surface="halo" />
        </div>

        <Card
          variant="elev"
          className="noise animate-scale-in relative overflow-hidden p-7 text-center sm:p-8"
          style={{ animationDelay: "120ms" }}
        >
          <span
            aria-hidden="true"
            className="bg-status-success/10 pointer-events-none absolute -end-16 -top-16 size-44 rounded-full blur-3xl"
          />

          <div className="relative">
            <div className="mb-4 flex justify-center">
              <div className="bg-status-success/15 text-status-success relative flex size-16 items-center justify-center rounded-3xl">
                <span
                  aria-hidden="true"
                  className="bg-status-success/20 animate-pearl-pulse absolute inset-0 rounded-3xl"
                />
                <Check className="relative size-8" strokeWidth={3} />
              </div>
            </div>

            <p className="text-status-success mb-1.5 flex items-center justify-center gap-1.5 text-[10px] font-bold tracking-[0.18em] uppercase">
              <Wifi className="size-3" />
              متصل
            </p>
            <h1 className="heading-1 text-brand-ink">أصبحت متصلًا!</h1>
            <p className="text-text-secondary body mt-1.5">استمتع بالإنترنت مع أياسوفيا</p>

            {suggestion.product && (
              <div className="bg-brand-red-soft/60 relative mt-5 overflow-hidden rounded-2xl p-3.5 text-start">
                <p className="text-brand-red flex items-center gap-1.5 text-[10px] font-bold tracking-[0.16em] uppercase">
                  <Sparkles className="size-3" />
                  اقتراح اليوم
                </p>
                <div className="mt-2.5 flex items-center gap-3">
                  <div className="bg-brand-red-bg relative flex size-12 shrink-0 items-center justify-center rounded-2xl">
                    <Image
                      src={suggestion.product.imageUrl ?? "/icons/icon-bubbletea.svg"}
                      alt=""
                      width={40}
                      height={40}
                      className="h-9 w-9 object-contain"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="heading-3 text-brand-ink truncate text-sm">
                      {suggestion.product.titleAr ?? suggestion.product.nameAr}
                    </p>
                    <p className="text-brand-red numeric text-sm font-bold">
                      {formatPrice(toMinorUnits(suggestion.product.basePrice))} ₪
                    </p>
                  </div>
                </div>
              </div>
            )}

            <Link
              href={menuHref}
              onClick={handleMenu}
              className="bg-brand-red hover:bg-brand-red-dark ease-spring shadow-brand mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-full px-6 text-base font-bold text-white transition-all hover:-translate-y-0.5"
            >
              <span>تصفّح القائمة</span>
              <ArrowLeft className="size-5 rtl:rotate-180" />
            </Link>

            <PearlDivider tone="muted" className="mt-5 mb-4" />

            <a
              href="https://instagram.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary hover:text-brand-red ease-spring inline-flex min-h-11 items-center gap-2 py-2 text-sm font-medium transition-colors"
            >
              <AtSign className="size-4" />
              <span>تابعنا على إنستغرام</span>
            </a>
          </div>
        </Card>
      </div>
    </div>
  );
}
