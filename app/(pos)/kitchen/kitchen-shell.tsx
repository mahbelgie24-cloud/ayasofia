"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  ArrowRight,
  Check,
  ChefHat,
  Clock,
  Coffee,
  MapPin,
  PackageCheck,
  Utensils,
  Bike,
  Car,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { updateOrderStatus, fetchActiveOrders, type ActiveKitchenOrder } from "./actions";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Logo } from "@/components/ui/logo";
import { PearlField } from "@/components/ui/pearl-field";

const CHANNEL_LABELS: Record<
  string,
  { label: string; icon: React.ReactNode; tone: "red" | "amber" | "ink" | "white" }
> = {
  dine_in: { label: "صالة", icon: <Utensils className="size-3" />, tone: "ink" },
  takeaway: { label: "خارجي", icon: <Coffee className="size-3" />, tone: "ink" },
  drive_thru: { label: "Drive-Thru", icon: <Car className="size-3" />, tone: "red" },
  delivery: { label: "توصيل", icon: <Bike className="size-3" />, tone: "amber" },
};

const STATUS_META: Record<
  string,
  {
    label: string;
    next: string | null;
    nextLabel: string;
    bar: string;
    chip: string;
    icon: React.ReactNode;
  }
> = {
  received: {
    label: "تم الاستلام",
    next: "preparing",
    nextLabel: "بدء التحضير",
    bar: "border-status-warning",
    chip: "bg-status-warning/15 text-status-warning",
    icon: <Clock className="size-3.5" />,
  },
  preparing: {
    label: "قيد التحضير",
    next: "ready",
    nextLabel: "جاهز",
    bar: "border-status-warning",
    chip: "bg-status-warning/20 text-status-warning",
    icon: <ChefHat className="size-3.5" />,
  },
  ready: {
    label: "جاهز للتسليم",
    next: "completed",
    nextLabel: "تم التسليم",
    bar: "border-status-success",
    chip: "bg-status-success/15 text-status-success",
    icon: <PackageCheck className="size-3.5" />,
  },
  completed: {
    label: "مكتمل",
    next: null,
    nextLabel: "",
    bar: "border-border-subtle",
    chip: "bg-muted text-text-secondary",
    icon: <Check className="size-3.5" />,
  },
};

export function KitchenShell({ initialOrders }: { initialOrders: ActiveKitchenOrder[] }) {
  const [orders, setOrders] = useState<ActiveKitchenOrder[]>(initialOrders);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const refreshingRef = useRef(false);

  const playBeep = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio(
        "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACAf39/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gIB/f3+AgH9/f4CAf39/gH",
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

    const pollId = setInterval(refreshOrders, 15_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollId);
    };
  }, [refreshOrders, playBeep]);

  const handleAdvance = async (orderId: string, currentStatus: string) => {
    const next = STATUS_META[currentStatus]?.next;
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
    <div className="bg-brand-cream flex h-dvh flex-col" dir="rtl" lang="ar">
      <header className="bg-brand-red shadow-brand relative shrink-0 overflow-hidden px-4 py-3.5 text-white">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -end-20 -top-20 size-72 rounded-full bg-white/10 blur-3xl"
        />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="sm" surface="glass" alt="المطبخ" />
            <div>
              <h1 className="heading-1 text-xl text-white">المطبخ</h1>
              <p className="caption font-medium text-white/85">
                {pending.length === 0
                  ? "لا طلبات قيد الانتظار"
                  : `${pending.length} طلب قيد الانتظار`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {orders.length > 0 && (
              <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-md">
                {orders.length} نشط
              </span>
            )}
            <PearlField variant="row" tone="white" count={3} size="sm" />
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-3">
        {orders.length === 0 ? (
          <EmptyState
            size="lg"
            title="لا توجد طلبات حالياً"
            description="ستظهر الطلبات الجديدة هنا فور وصولها."
            icon={<ChefHat className="size-8" />}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {orders.map((order) => {
              const meta = STATUS_META[order.status] ?? STATUS_META.received;
              const channel = CHANNEL_LABELS[order.channel];
              const channelBg =
                channel?.tone === "red"
                  ? "bg-brand-red text-white"
                  : channel?.tone === "amber"
                    ? "bg-status-warning text-black"
                    : "bg-brand-ink text-white";
              return (
                <Card
                  key={order.id}
                  variant="pop"
                  className={`overflow-hidden border-t-4 p-0 ${meta.bar}`}
                >
                  <div className="p-4">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div>
                        <p
                          className="display-2 text-brand-ink numeric tabular-nums"
                          style={{ fontSize: "1.875rem", lineHeight: 1 }}
                        >
                          {order.orderNumber}
                        </p>
                        <p className="text-text-secondary caption mt-1 flex items-center gap-1">
                          <Clock className="size-2.5" />
                          {new Date(order.createdAt).toLocaleTimeString("ar", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1.5">
                        {order.tableCode && (
                          <span
                            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${channelBg}`}
                          >
                            <MapPin className="size-3" />
                            {order.tableCode}
                          </span>
                        )}
                        {channel && (
                          <span
                            className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${meta.chip}`}
                          >
                            {channel.icon}
                            {channel.label}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="mb-3 space-y-1.5">
                      {order.items.map((item, i) => (
                        <div
                          key={i}
                          className="border-border-subtle/60 border-brand-red-soft/60 border-r-2 pr-2.5"
                        >
                          <p className="text-sm leading-relaxed">
                            <span className="text-brand-ink font-bold">{item.productNameAr}</span>
                            <span className="text-brand-red numeric ms-1.5 font-extrabold">
                              × {item.quantity}
                            </span>
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

                    <div className="border-border-subtle flex items-center justify-between border-t pt-3">
                      <span className="numeric text-brand-ink text-sm font-bold">
                        {order.total} ₪
                      </span>
                      {meta.next ? (
                        <button
                          onClick={() => handleAdvance(order.id, order.status)}
                          className="bg-brand-red hover:bg-brand-red-dark shadow-brand-soft ease-spring flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:-translate-y-0.5"
                        >
                          <span>{meta.nextLabel}</span>
                          <ArrowRight className="size-3.5 rtl:rotate-180" />
                        </button>
                      ) : (
                        <span className="caption text-text-secondary">مكتمل</span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
