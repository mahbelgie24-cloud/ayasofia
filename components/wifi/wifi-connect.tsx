"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { endWifiSession } from "@/app/wifi/actions";
import { PearlsField } from "@/components/digital-menu/pearls-field";

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
    // Log and navigate to the menu.
    const durationSec = Math.round((Date.now() - startedAt) / 1000);
    void endWifiSession({ deviceId: deviceId(), durationSec });
  }, [startedAt]);

  return (
    <div
      className="bg-brand-red-bg flex min-h-dvh flex-col items-center justify-center px-6 py-10 text-center"
      dir="rtl"
      lang="ar"
    >
      <div className="relative w-full max-w-sm">
        <PearlsField className="opacity-50" />

        <div className="relative rounded-[1.5rem] bg-white p-8 shadow-lg">
          <div className="bg-status-success/10 mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-2xl">
            ✓
          </div>
          <h1 className="font-heading text-brand-ink text-xl font-bold">أصبحت متصلًا!</h1>
          <p className="text-text-secondary mt-1 text-sm">استمتع بالإنترنت مع أياسوفيا</p>

          {suggestion.product && (
            <div className="bg-brand-red-soft mt-5 rounded-2xl p-4">
              <p className="text-brand-red-dark text-xs font-bold">اقتراح اليوم</p>
              <div className="mt-2 flex items-center justify-center gap-3">
                <Image
                  src={suggestion.product.imageUrl ?? "/icons/icon-bubbletea.svg"}
                  alt=""
                  width={44}
                  height={44}
                  className="h-11 w-11 object-contain"
                />
                <div className="text-start">
                  <p className="font-heading text-brand-ink text-sm font-semibold">
                    {suggestion.product.titleAr ?? suggestion.product.nameAr}
                  </p>
                  <p className="text-brand-red-dark text-sm font-bold">
                    {suggestion.product.basePrice} ₪
                  </p>
                </div>
              </div>
            </div>
          )}

          <Link
            href={menuHref}
            onClick={handleMenu}
            className="bg-brand-red hover:bg-brand-red-dark ease-spring mt-5 flex min-h-14 w-full items-center justify-center rounded-full px-6 text-base font-bold text-white transition-colors"
          >
            تصفّح القائمة
          </Link>

          <a
            href="https://instagram.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-text-secondary hover:text-brand-red mt-4 inline-flex items-center gap-2 text-sm"
          >
            <span aria-hidden="true">📸</span> تابعنا على إنستغرام
          </a>
        </div>
      </div>
    </div>
  );
}
