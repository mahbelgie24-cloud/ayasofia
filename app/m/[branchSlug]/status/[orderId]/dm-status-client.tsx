"use client";

import { useState, useEffect, useRef } from "react";
import { Check, ChefHat, Clock, PackageCheck, MapPin, Receipt, Sparkles } from "lucide-react";
import { getOrderStatus } from "@/app/order/status/[orderId]/actions";
import { Card } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { PearlField } from "@/components/ui/pearl-field";

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

type StepStatus = "received" | "preparing" | "ready" | "completed";

const STATUS_STEPS: { key: StepStatus; label: string; icon: React.ReactNode }[] = [
  { key: "received", label: "تم الاستلام", icon: <Clock className="size-4" /> },
  { key: "preparing", label: "قيد التحضير", icon: <ChefHat className="size-4" /> },
  { key: "ready", label: "جاهز", icon: <PackageCheck className="size-4" /> },
  { key: "completed", label: "مكتمل", icon: <Check className="size-4" /> },
];

const STATUS_LABELS: Record<string, string> = {
  received: "تم الاستلام",
  preparing: "قيد التحضير",
  ready: "جاهز للتسليم",
  completed: "مكتمل",
  cancelled: "ملغي",
};

function currentStep(status: string): number {
  const idx = STATUS_STEPS.findIndex((s) => s.key === status);
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
      <header className="bg-brand-red relative overflow-hidden px-4 pt-7 pb-14 text-center text-white">
        <PearlField variant="scatter" tone="white" count={10} />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at 20% 10%, rgba(255,255,255,0.18) 0%, transparent 50%), radial-gradient(ellipse at 80% 90%, rgba(0,0,0,0.18) 0%, transparent 60%)",
          }}
        />
        <div className="relative z-10">
          <div className="mb-4 flex justify-center">
            <Logo size="md" surface="glass" alt="متابعة الطلب" />
          </div>
          <p className="eyebrow flex items-center justify-center gap-1.5 tracking-[0.18em] text-white/85">
            <Sparkles className="size-3" />
            تحديث لحظي
          </p>
          <h1 className="display-1 mt-1.5 text-white">متابعة طلبك</h1>
          <p className="body mt-1.5 font-medium text-white/90">رقم الطلب: {initial.orderNumber}</p>
          {initial.tableCode && (
            <span className="mt-3.5 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3.5 py-1.5 text-xs font-bold backdrop-blur-md">
              <MapPin className="size-3.5" />
              الطاولة {initial.tableCode}
            </span>
          )}
        </div>
      </header>

      <main className="relative z-10 -mt-7 flex-1 space-y-3 px-4 pb-10">
        <Card variant="elev" className="noise animate-scale-in relative overflow-hidden p-5">
          <span
            aria-hidden="true"
            className="bg-brand-red/10 pointer-events-none absolute -end-16 -top-16 size-44 rounded-full blur-3xl"
          />
          {cancelled ? (
            <p className="text-status-error text-center text-lg font-bold">تم إلغاء الطلب</p>
          ) : (
            <div className="relative">
              <p className="text-text-secondary caption mb-3 text-center">الحالة الحالية</p>
              <p className="display-2 text-brand-red text-center text-2xl">
                {STATUS_LABELS[status] ?? status}
              </p>
              <ol className="relative mt-7 space-y-0" aria-label="تقدم الطلب">
                {/* connector line */}
                <div
                  aria-hidden="true"
                  className="bg-border-subtle absolute start-[15px] top-3 bottom-3 w-0.5"
                />
                <div
                  aria-hidden="true"
                  className="bg-brand-red absolute start-[15px] top-3 w-0.5 transition-all duration-700 ease-out"
                  style={{ height: `calc(${(step / (STATUS_STEPS.length - 1)) * 100}% - 0px)` }}
                />
                {STATUS_STEPS.map((s, i) => {
                  const done = i <= step;
                  const current = i === step;
                  return (
                    <li key={s.key} className="relative flex items-center gap-3.5 py-2.5">
                      <span
                        aria-hidden="true"
                        className={`relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
                          done
                            ? "bg-brand-red shadow-brand-soft text-white"
                            : "bg-card border-border-subtle text-text-secondary border-2"
                        } ${current ? "ring-brand-red/20 scale-110 ring-4" : ""}`}
                      >
                        {s.icon}
                      </span>
                      <span
                        className={`text-sm font-semibold ${
                          done ? "text-brand-ink" : "text-text-secondary"
                        }`}
                      >
                        {s.label}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}
        </Card>

        <Card variant="default" className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <div className="bg-brand-red-soft text-brand-red flex size-7 items-center justify-center rounded-xl">
              <Receipt className="size-3.5" />
            </div>
            <h2 className="heading-3 text-brand-ink text-sm">تفاصيل الطلب</h2>
          </div>
          <ul className="space-y-3">
            {initial.items.map((item, i) => (
              <li key={i} className="flex items-start justify-between gap-2 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="text-brand-ink font-semibold">
                    {item.productNameAr} × {item.quantity}
                  </p>
                  {item.modifierNames.length > 0 && (
                    <p className="text-text-secondary mt-0.5 text-xs">
                      {item.modifierNames.join("، ")}
                    </p>
                  )}
                  {item.notes && (
                    <p className="text-status-warning mt-0.5 text-xs italic">“{item.notes}”</p>
                  )}
                </div>
                <span className="numeric shrink-0 font-bold">{item.lineTotal} ₪</span>
              </li>
            ))}
          </ul>
          <div className="border-border-subtle mt-4 flex items-center justify-between border-t pt-3">
            <span className="text-text-secondary text-sm font-medium">المجموع</span>
            <span className="numeric text-brand-red text-base font-extrabold">
              {initial.total} ₪
            </span>
          </div>
          <p className="text-text-secondary/80 mt-3 text-center text-xs">
            المدة المتوقعة للتحضير 10–15 دقيقة
          </p>
        </Card>

        {loading && (
          <div className="text-text-secondary caption flex items-center justify-center gap-2 py-3">
            <span className="flex gap-1">
              <span className="bg-brand-red animate-pearl-bounce size-1.5 rounded-full" />
              <span
                className="bg-brand-red animate-pearl-bounce size-1.5 rounded-full"
                style={{ animationDelay: "120ms" }}
              />
              <span
                className="bg-brand-red animate-pearl-bounce size-1.5 rounded-full"
                style={{ animationDelay: "240ms" }}
              />
            </span>
            <span>جاري تحديث الحالة…</span>
          </div>
        )}
      </main>
    </div>
  );
}
