"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Wifi, Shield } from "lucide-react";
import { authorizeGuest } from "@/app/wifi/actions";
import { PearlsField } from "@/components/digital-menu/pearls-field";
import { PearlsLoader } from "@/components/digital-menu/pearls-loader";
import { Card } from "@/components/ui/card";
import { IconBadge } from "@/components/ui/icon-badge";

/**
 * Branded wifi splash (WF-01). ONE-TAP "اتصال بالإنترنت" — zero-field guest
 * access is the default and always works (C5). No third-party trackers.
 *
 * Critical-path asset policy (NFR-WF-01): only inline CSS/JS + local
 * images; fonts come from next/font (self-hosted at build time, no runtime
 * third-party request).
 */

function deviceId(): string {
  if (typeof window === "undefined") return "unknown";
  const KEY = "ayasofia-device-id";
  try {
    const existing = window.localStorage.getItem(KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    window.localStorage.setItem(KEY, id);
    return id;
  } catch {
    // storage unavailable (private mode) — session still works, just
    // anonymously and without cross-visit dedup.
    return crypto.randomUUID();
  }
}

export function WifiSplash({
  title = "أياسوفيا ترحّب بك",
  subtitle = "واي فاي مجاني للضيوف — نسبة السكر على مزاجك 🤍",
  privacyLine = "لا نشارك بياناتك مع أي طرف ثالث، ولا نطلب اسمك أو رقمك للاتصال.",
}: {
  title?: string;
  subtitle?: string;
  privacyLine?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connect = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await authorizeGuest({
        deviceId: deviceId(),
        consent: false, // zero-field default (C5)
      });
      if (result.success) {
        router.push("/wifi/connect");
      } else {
        setError(result.error);
      }
    } catch {
      setError("تعذر الاتصال، حاول مرة أخرى");
    } finally {
      setBusy(false);
    }
  }, [busy, router]);

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
        <PearlsField className="opacity-50" />

        <Card variant="pop" className="relative p-7 sm:p-8">
          <div className="mb-5 flex justify-center">
            <IconBadge icon={<Wifi />} variant="brand" size="xl" aria-label="Wi-Fi" />
          </div>

          <h1 className="heading-1 text-brand-ink text-center">{title}</h1>
          <p className="body text-text-secondary mt-2 text-center leading-relaxed">{subtitle}</p>

          <button
            onClick={connect}
            disabled={busy}
            className="bg-brand-red hover:bg-brand-red-dark ease-spring shadow-brand-red/25 mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-full px-6 text-base font-bold text-white shadow-md transition-all disabled:opacity-60"
          >
            {busy ? (
              <PearlsLoader
                label="جاري تأمين الاتصال…"
                className="!flex-row gap-3 text-white [&_span]:bg-white"
              />
            ) : (
              <>
                <Wifi className="size-5" />
                <span>اتصال بالإنترنت</span>
              </>
            )}
          </button>

          {error && (
            <p role="alert" className="text-status-error mt-3 text-center text-sm">
              {error}
            </p>
          )}

          <div className="border-border-subtle mt-6 flex items-start gap-2 border-t pt-4">
            <Shield className="text-text-secondary/70 mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="caption text-text-secondary leading-relaxed">{privacyLine}</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
