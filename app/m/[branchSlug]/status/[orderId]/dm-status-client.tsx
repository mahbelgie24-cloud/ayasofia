"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { getOrderStatus } from "@/app/order/status/[orderId]/actions";
import { PearlsLoader } from "@/components/digital-menu/pearls-loader";
import { PearlsField } from "@/components/digital-menu/pearls-field";

interface DMStatusData {
  branchSlug: string;
  orderNumber: string;
  status: string;
  total: string;
  tableCode: string | null;
  channel: string;
  deliveryFee: string;
  items: Array<{
    productNameAr: string;
    quantity: number;
    modifierNames: string[];
    notes: string | null;
    lineTotal: string;
  }>;
}

const STATUS_STEPS = ["received", "preparing", "ready", "completed"] as const;
const STATUS_LABELS: Record<string, string> = {
  received: "تم الاستلام",
  preparing: "قيد التحضير",
  ready: "جاهز",
  completed: "مكتمل",
  cancelled: "ملغي",
};

function currentStep(status: string): number {
  const idx = STATUS_STEPS.indexOf(status as (typeof STATUS_STEPS)[number]);
  return idx === -1 ? 0 : idx;
}

export function DMStatusClient({
  orderId,
  accessToken,
  data: initial,
}: {
  orderId: string;
  accessToken: string;
  data: DMStatusData;
}) {
  const [status, setStatus] = useState(initial.status);
  const [loading, setLoading] = useState(true);
  const prevRef = useRef(initial.status);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const poll = async () => {
      if (cancelled) return;
      try {
        const result = await getOrderStatus(orderId, accessToken);
        if (!result || cancelled) return;
        if (result.status !== prevRef.current) {
          prevRef.current = result.status;
          setStatus(result.status);
        }
        setLoading(false);
      } catch {
        // silent — retry next tick
      }
    };

    const start = () => {
      poll();
      interval = setInterval(poll, 5000);
    };
    const stop = () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };

    const onVis = () => {
      if (document.visibilityState === "visible") {
        cancelled = false;
        start();
      } else {
        stop();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    start();
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [orderId, accessToken]);

  const step = currentStep(status);
  const cancelled = status === "cancelled";

  return (
    <div className="bg-brand-red-bg flex min-h-dvh flex-col" dir="rtl" lang="ar">
      <header className="bg-brand-red relative overflow-hidden px-4 pt-6 pb-10 text-center text-white">
        <PearlsField />
        <div className="relative z-10">
          <Image
            src="/icons/logo-mono.svg"
            alt=""
            width={40}
            height={40}
            className="mx-auto mb-2 h-10 w-auto invert"
          />
          <h1 className="font-heading text-xl font-bold">متابعة طلبك</h1>
          <p className="mt-1 text-sm text-white">رقم الطلب: {initial.orderNumber}</p>
          {initial.tableCode && (
            <span className="mt-3 inline-block rounded-full bg-white/20 px-3 py-1 text-xs font-semibold">
              الطاولة {initial.tableCode}
            </span>
          )}
        </div>
      </header>

      <main className="relative z-10 -mt-6 flex-1 px-4 pb-10">
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          {cancelled ? (
            <p className="text-status-error text-center font-bold">تم إلغاء الطلب</p>
          ) : (
            <>
              <p className="text-brand-red font-heading mb-4 text-center text-2xl font-bold">
                {STATUS_LABELS[status] ?? status}
              </p>
              <ol className="space-y-4" aria-label="تقدم الطلب">
                {STATUS_STEPS.map((s, i) => {
                  const done = i <= step;
                  return (
                    <li key={s} className="flex items-center gap-3">
                      <span
                        aria-hidden="true"
                        className={`size-3 shrink-0 rounded-full ${
                          done ? "bg-brand-red animate-pearl-bounce" : "bg-muted"
                        } ${i === step ? "[animation-delay:0s]" : ""}`}
                      />
                      <span
                        className={`text-sm font-medium ${
                          done ? "text-brand-ink" : "text-text-secondary"
                        }`}
                      >
                        {STATUS_LABELS[s]}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>

        <div className="mt-3 rounded-2xl bg-white p-5 shadow-sm">
          <ul className="space-y-3">
            {initial.items.map((item, i) => (
              <li key={i} className="flex items-start justify-between gap-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {item.productNameAr} × {item.quantity}
                  </p>
                  {item.modifierNames.length > 0 && (
                    <p className="text-text-secondary mt-0.5 text-xs">
                      {item.modifierNames.join("، ")}
                    </p>
                  )}
                  {item.notes && <p className="mt-0.5 text-xs italic">“{item.notes}”</p>}
                </div>
                <span className="shrink-0 font-medium">{item.lineTotal} ₪</span>
              </li>
            ))}
          </ul>
          <div className="border-border-subtle mt-4 space-y-1 border-t pt-3 text-sm">
            <div className="flex justify-between">
              <span className="text-text-secondary">المجموع</span>
              <span>{initial.total} ₪</span>
            </div>
          </div>
          <p className="text-text-secondary mt-4 text-center text-xs">
            المدة المتوقعة للتحضير 10–15 دقيقة
          </p>
        </div>

        {loading && <PearlsLoader label="جاري تحديث الحالة…" className="mt-4" />}
      </main>
    </div>
  );
}
