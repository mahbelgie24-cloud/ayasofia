"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { authorizeGuest } from "@/app/wifi/actions";
import { PearlsField } from "@/components/digital-menu/pearls-field";
import { PearlsLoader } from "@/components/digital-menu/pearls-loader";

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
      className="bg-brand-red-bg flex min-h-dvh flex-col items-center justify-center px-6 text-center"
      dir="rtl"
      lang="ar"
    >
      <div className="relative w-full max-w-sm">
        <PearlsField className="opacity-50" />

        <div className="relative rounded-[1.5rem] bg-white p-8 shadow-lg">
          <div className="bg-brand-red relative mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full">
            <PearlsField />
            <Image
              src="/icons/logo-mono.svg"
              alt="شعار أياسوفيا"
              width={44}
              height={44}
              className="relative z-10 h-11 w-11 invert"
            />
          </div>

          <h1 className="font-heading text-brand-ink text-2xl font-bold">{title}</h1>
          <p className="text-text-secondary mt-2 text-sm leading-relaxed">{subtitle}</p>

          <button
            onClick={connect}
            disabled={busy}
            className="bg-brand-red hover:bg-brand-red-dark ease-spring mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-full px-6 text-base font-bold text-white transition-colors disabled:opacity-60"
          >
            {busy ? (
              <PearlsLoader label="جاري تأمين الاتصال…" className="!flex-row gap-3" />
            ) : (
              "اتصال بالإنترنت"
            )}
          </button>

          {error && (
            <p role="alert" className="text-status-error mt-3 text-sm">
              {error}
            </p>
          )}

          <p className="text-text-secondary mt-6 text-xs leading-relaxed">{privacyLine}</p>
        </div>
      </div>
    </div>
  );
}
