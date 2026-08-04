"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

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
      <body className="bg-brand-cream font-body text-brand-ink flex min-h-screen items-center justify-center">
        <div className="mx-4 max-w-md text-center">
          <h1 className="font-display text-brand-red text-2xl font-bold">
            عذراً، حدث خطأ غير متوقع
          </h1>
          <p className="text-text-secondary mt-4">
            حدث خطأ تقني. يرجى المحاولة مرة أخرى أو التواصل مع مدير النظام.
          </p>
          <button
            onClick={reset}
            className="bg-brand-red font-display mt-8 rounded-2xl px-8 py-3 text-white transition hover:opacity-90"
          >
            حاول مجدداً
          </button>
        </div>
      </body>
    </html>
  );
}
