"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import * as Sentry from "@sentry/nextjs";
import { Logo } from "@/components/ui/logo";
import { Card, CardBody } from "@/components/ui/card";
import { PearlField } from "@/components/ui/pearl-field";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      Sentry.captureException(error);
    }
  }, [error]);

  return (
    <html lang="ar" dir="rtl">
      <body className="bg-brand-red-bg relative flex min-h-dvh items-center justify-center overflow-hidden px-4 antialiased">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="bg-status-error/[0.06] absolute start-1/2 -top-32 size-[40rem] -translate-x-1/2 rounded-full blur-3xl" />
          <PearlField variant="scatter" tone="muted" count={6} />
        </div>
        <Card
          variant="elev"
          className="noise animate-scale-in relative w-full max-w-md overflow-hidden text-center"
        >
          <span
            aria-hidden="true"
            className="bg-status-error/10 pointer-events-none absolute -end-16 -top-16 size-44 rounded-full blur-3xl"
          />
          <CardBody className="relative space-y-5 p-8">
            <div className="flex justify-center">
              <div className="bg-status-error/[0.12] text-status-error flex size-16 items-center justify-center rounded-3xl">
                <AlertCircle className="size-8" />
              </div>
            </div>
            <div>
              <h1 className="heading-1 text-brand-ink">عذراً، حدث خطأ غير متوقع</h1>
              <p className="body text-text-secondary mt-2">
                حدث خطأ تقني. يمكنك المحاولة مرة أخرى، أو التواصل مع مدير النظام إن استمرّ.
              </p>
            </div>
            <button
              onClick={reset}
              className="bg-brand-red hover:bg-brand-red-dark ease-spring shadow-brand inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3.5 text-base font-bold text-white transition-all hover:-translate-y-0.5"
            >
              <RotateCcw className="size-4" />
              <span>حاول مجدداً</span>
            </button>
            <p className="caption text-text-secondary/70 inline-flex items-center justify-center gap-1.5">
              <Logo size="xs" />
              <span>Ayasofia Sweet</span>
            </p>
          </CardBody>
        </Card>
      </body>
    </html>
  );
}
