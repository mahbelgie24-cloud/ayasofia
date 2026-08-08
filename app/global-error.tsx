"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCcw } from "lucide-react";
import * as Sentry from "@sentry/nextjs";
import { Logo } from "@/components/ui/logo";
import { Card, CardBody } from "@/components/ui/card";

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
      <body className="bg-brand-red-bg flex min-h-dvh items-center justify-center px-4 antialiased">
        <Card variant="pop" className="w-full max-w-md text-center">
          <CardBody className="space-y-5 p-8">
            <div className="flex justify-center">
              <div className="bg-status-error/[0.12] text-status-error flex size-14 items-center justify-center rounded-2xl">
                <AlertCircle className="size-7" />
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
              className="bg-brand-red hover:bg-brand-red-dark ease-spring shadow-brand-red/25 inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-base font-bold text-white shadow-md transition-all"
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
