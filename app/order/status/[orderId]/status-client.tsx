"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { getOrderStatus } from "./actions";

interface OrderData {
  orderNumber: string;
  status: string;
  total: string;
  createdAt: string;
  items: Array<{
    productNameAr: string;
    quantity: number;
    modifierNames: string[];
    lineTotal: string;
  }>;
}

const STATUS_LABELS: Record<string, string> = {
  received: "تم الاستلام",
  preparing: "قيد التحضير",
  ready: "جاهز",
  completed: "مكتمل",
  cancelled: "ملغي",
};

export function OrderStatusClient({
  orderId,
  accessToken,
  data: initialData,
}: {
  orderId: string;
  accessToken: string;
  data: OrderData;
}) {
  const [status, setStatus] = useState(initialData.status);
  const [transitioning, setTransitioning] = useState(false);
  const prevStatusRef = useRef(initialData.status);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    let stopped = false;

    const poll = async () => {
      if (stopped) return;
      try {
        const result = await getOrderStatus(orderId, accessToken);
        if (!result || stopped) return;

        if (result.status !== prevStatusRef.current) {
          setTransitioning(true);
          prevStatusRef.current = result.status;

          setTimeout(() => {
            setStatus(result.status);
            setTransitioning(false);
          }, 200);

          if (result.status === "completed" || result.status === "cancelled") {
            stopPolling();
          }
        }
      } catch {
        // silent — retry on next interval
      }
    };

    const startPolling = () => {
      if (stopped) return;
      poll(); // immediate first poll
      interval = setInterval(poll, 5000);
    };

    const stopPolling = () => {
      stopped = true;
      if (interval) clearInterval(interval);
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        stopped = false;
        startPolling();
      } else {
        stopPolling();
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);

    // Don't start polling if already in terminal state
    if (initialData.status === "completed" || initialData.status === "cancelled") {
      return () => document.removeEventListener("visibilitychange", handleVisibility);
    }

    startPolling();

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [orderId, accessToken, initialData.status]);

  const statusLabel = STATUS_LABELS[status] ?? status;

  return (
    <div className="mx-auto max-w-lg px-4 py-8" dir="rtl" lang="ar">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-4 text-center">
          <Image
            src="/icons/logo-mono.svg"
            alt=""
            width={40}
            height={40}
            className="mx-auto mb-3 h-10 w-auto invert"
          />
          <h1 className="font-heading text-brand-ink text-xl font-bold">حالة الطلب</h1>
        </div>

        <div
          className={`bg-brand-cream ease-spring mb-4 rounded-xl p-4 text-center transition-all duration-300 ${
            transitioning ? "scale-105 opacity-80" : "scale-100 opacity-100"
          }`}
        >
          <p className="text-text-secondary text-sm">رقم الطلب: {initialData.orderNumber}</p>
          <p className="font-heading text-brand-red mt-1 text-2xl font-bold">{statusLabel}</p>
        </div>

        <div className="mb-4 space-y-2">
          {initialData.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span>
                {item.productNameAr} × {item.quantity}
                {item.modifierNames.length > 0 && (
                  <span className="text-text-secondary mr-1 text-xs">
                    ({item.modifierNames.join("، ")})
                  </span>
                )}
              </span>
              <span className="font-medium">{item.lineTotal} ₪</span>
            </div>
          ))}
        </div>

        <div className="border-border-subtle border-t pt-3 text-center">
          <p className="text-brand-ink text-sm font-bold">الإجمالي: {initialData.total} ₪</p>
        </div>
      </div>
    </div>
  );
}
