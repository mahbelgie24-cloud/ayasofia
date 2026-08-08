"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, AtSign, ArrowLeft, Sparkles } from "lucide-react";
import Link from "next/link";
import { endWifiSession } from "@/app/wifi/actions";
import { PearlsField } from "@/components/digital-menu/pearls-field";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
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
      className="bg-brand-red-bg relative flex min-h-dvh flex-col items-center justify-center px-6 py-10"
      dir="rtl"
      lang="ar"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="bg-status-success/[0.08] absolute start-1/2 -top-24 size-[32rem] -translate-x-1/2 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        <PearlsField className="opacity-30" />

        <Card variant="pop" className="relative p-7 text-center sm:p-8">
          <div className="mb-5 flex justify-center">
            <div className="bg-status-success/15 text-status-success flex size-14 items-center justify-center rounded-2xl">
              <Check className="size-7" />
            </div>
          </div>

          <h1 className="heading-1 text-brand-ink">أصبحت متصلًا!</h1>
          <p className="body text-text-secondary mt-1.5">استمتع بالإنترنت مع أياسوفيا</p>

          {suggestion.product && (
            <div className="bg-brand-red-soft mt-5 rounded-2xl p-4 text-start">
              <p className="text-brand-red-dark flex items-center gap-1.5 text-xs font-bold">
                <Sparkles className="size-3.5" />
                اقتراح اليوم
              </p>
              <div className="mt-2.5 flex items-center gap-3">
                <Logo size="sm" surface="soft" />
                <div className="min-w-0 flex-1">
                  <p className="heading-3 text-brand-ink truncate text-sm">
                    {suggestion.product.titleAr ?? suggestion.product.nameAr}
                  </p>
                  <p className="text-brand-red-dark numeric text-sm font-bold">
                    {formatPrice(toMinorUnits(suggestion.product.basePrice))} ₪
                  </p>
                </div>
              </div>
            </div>
          )}

          <Link
            href={menuHref}
            onClick={handleMenu}
            className="bg-brand-red hover:bg-brand-red-dark ease-spring shadow-brand-red/25 mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-full px-6 text-base font-bold text-white shadow-md transition-all"
          >
            <span>تصفّح القائمة</span>
            <ArrowLeft className="size-5 rtl:rotate-180" />
          </Link>

          <a
            href="https://instagram.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-secondary hover:text-brand-red mt-4 inline-flex items-center gap-2 text-sm transition-colors"
          >
            <AtSign className="size-4" />
            <span>تابعنا على إنستغرام</span>
          </a>
        </Card>
      </div>
    </div>
  );
}
