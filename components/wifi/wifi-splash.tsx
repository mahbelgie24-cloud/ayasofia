"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Wifi, Shield, Sparkles } from "lucide-react";
import { authorizeGuest } from "@/app/wifi/actions";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { PearlField, PearlDivider } from "@/components/ui/pearl-field";

/**
 * Branded wifi splash (WF-01). ONE-TAP "اتصال بالإنترنت" — zero-field guest
 * access is the default and always works (C5). No third-party trackers.
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
        consent: false,
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
      className="bg-brand-red-bg relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-6 py-10"
      dir="rtl"
      lang="ar"
    >
      {/* Ambient backdrop */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="bg-brand-red/[0.08] absolute start-1/2 -top-32 size-[40rem] -translate-x-1/2 rounded-full blur-3xl" />
        <div className="bg-brand-red/[0.05] absolute end-1/4 -bottom-32 size-[28rem] rounded-full blur-3xl" />
        <PearlField variant="scatter" tone="muted" count={8} />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="animate-fade-in mb-6 flex justify-center">
          <Logo size="xl" surface="halo" breathing />
        </div>

        <Card
          variant="elev"
          className="noise animate-scale-in relative overflow-hidden p-7 sm:p-8"
          style={{ animationDelay: "120ms" }}
        >
          <span
            aria-hidden="true"
            className="bg-brand-red/10 pointer-events-none absolute -end-16 -top-16 size-44 rounded-full blur-3xl"
          />

          <div className="relative">
            <div className="mb-4 flex justify-center">
              <div className="bg-brand-red-soft text-brand-red flex size-14 items-center justify-center rounded-3xl shadow-inner">
                <Wifi className="size-6" />
              </div>
            </div>

            <p className="text-brand-red mb-1.5 flex items-center justify-center gap-1.5 text-[10px] font-bold tracking-[0.18em] uppercase">
              <Sparkles className="size-3" />
              واي فاي مجاني
            </p>
            <h1 className="heading-1 text-brand-ink text-center">{title}</h1>
            <p className="text-text-secondary body mt-2 text-center leading-relaxed">{subtitle}</p>

            <button
              onClick={connect}
              disabled={busy}
              className="bg-brand-red hover:bg-brand-red-dark ease-spring shadow-brand mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-full px-6 text-base font-bold text-white transition-all hover:-translate-y-0.5 disabled:opacity-60"
            >
              {busy ? (
                <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  جاري تأمين الاتصال…
                </span>
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

            <PearlDivider tone="muted" className="mt-6 mb-5" />

            <div className="flex items-start gap-2.5">
              <div className="bg-brand-red-soft text-brand-red flex size-7 shrink-0 items-center justify-center rounded-xl">
                <Shield className="size-3.5" aria-hidden="true" />
              </div>
              <p className="text-text-secondary caption leading-relaxed">{privacyLine}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
