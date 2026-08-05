"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateOrderStatus, fetchActiveOrders, type ActiveKitchenOrder } from "./actions";

const CHANNEL_LABELS: Record<string, string> = {
  dine_in: "🥤 صالة",
  takeaway: "📱 طلب خارجي",
  drive_thru: "🚘 Drive-Thru",
  delivery: "🛵 توصيل",
};

const STATUS_COLORS: Record<string, string> = {
  received: "border-status-warning bg-status-warning/5",
  preparing: "border-status-warning bg-status-warning/10",
  ready: "border-status-success bg-status-success/5",
  completed: "border-border-subtle bg-brand-cream/50 opacity-50",
};

export function KitchenShell({ initialOrders }: { initialOrders: ActiveKitchenOrder[] }) {
  const [orders, setOrders] = useState<ActiveKitchenOrder[]>(initialOrders);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const refreshingRef = useRef(false);

  const playBeep = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(
        "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/g",
      );
    }
    audioRef.current.play().catch(() => {});
  }, []);

  const refreshOrders = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    try {
      const fresh = await fetchActiveOrders();
      setOrders(fresh);
    } catch {
      // silent — keep current state on error
    } finally {
      refreshingRef.current = false;
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("kitchen-orders")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "orders" }, () => {
        refreshOrders();
        playBeep();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders" }, () => {
        refreshOrders();
      })
      .subscribe();

    // Realtime fallback — if the WebSocket drops or an event is missed
    // during a brief disconnect, no new order would ever appear.  A
    // periodic refetch (every 15s) is a cheap belt-and-suspenders guard
    // for a live KDS on flaky in-store Wi-Fi (see review R-M3).
    const pollId = setInterval(refreshOrders, 15_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollId);
    };
  }, [refreshOrders, playBeep]);

  const handleAdvance = async (orderId: string, currentStatus: string) => {
    const transitions: Record<string, string> = {
      received: "preparing",
      preparing: "ready",
      ready: "completed",
    };
    const next = transitions[currentStatus];
    if (!next) return;

    const result = await updateOrderStatus(orderId, next);
    if (result.success) {
      setOrders((prev) => {
        if (next === "completed") return prev.filter((o) => o.id !== orderId);
        return prev.map((o) => (o.id === orderId ? { ...o, status: next } : o));
      });
    }
  };

  const pending = orders.filter((o) => o.status !== "completed" && o.status !== "cancelled");

  return (
    <div className="bg-brand-cream flex h-screen flex-col" dir="rtl" lang="ar">
      <div className="bg-brand-red shrink-0 px-4 py-3 text-center text-white">
        <h1 className="font-heading text-xl font-bold">المطبخ</h1>
        <p className="text-sm text-white/80">{pending.length} طلب قيد الانتظار</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {orders.length === 0 ? (
          <p className="text-text-secondary py-16 text-center">لا توجد طلبات حالياً</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {orders.map((order) => (
              <div
                key={order.id}
                className={`rounded-xl border-2 bg-white p-4 ${STATUS_COLORS[order.status] ?? ""}`}
              >
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <p className="font-heading text-brand-ink text-2xl font-bold">
                      {order.orderNumber}
                    </p>
                    <p className="text-text-secondary text-xs">
                      {new Date(order.createdAt).toLocaleTimeString("ar")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {order.tableCode && (
                      <span className="bg-brand-red rounded-full px-2 py-1 text-xs font-bold text-white">
                        طاولة {order.tableCode}
                      </span>
                    )}
                    <span className="bg-muted rounded-full px-2 py-1 text-xs font-medium">
                      {CHANNEL_LABELS[order.channel] ?? order.channel}
                    </span>
                  </div>
                </div>

                <div className="mb-3 space-y-0.5">
                  {order.items.map((item, i) => (
                    <div key={i}>
                      <p className="text-sm">
                        <span className="font-semibold">{item.productNameAr}</span>
                        <span className="text-text-secondary"> × {item.quantity}</span>
                      </p>
                      {item.modifierNames.length > 0 && (
                        <p className="text-text-secondary text-xs">
                          {item.modifierNames.join("، ")}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-status-warning text-xs italic">“{item.notes}”</p>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-brand-ink text-sm font-bold">{order.total} ₪</span>
                  <button
                    onClick={() => handleAdvance(order.id, order.status)}
                    className="bg-brand-red rounded-full px-3 py-1.5 text-xs font-bold text-white"
                  >
                    {order.status === "received"
                      ? "بدء التحضير"
                      : order.status === "preparing"
                        ? "جاهز"
                        : order.status === "ready"
                          ? "تم التسليم"
                          : ""}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
