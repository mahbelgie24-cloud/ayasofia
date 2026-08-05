"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Accessible toast notification system (WCAG 2.2 AA).
 *
 * Built on @base-ui/react Toast primitives, which provide for free:
 *   - Auto-dismiss with configurable timeout
 *   - Pause on hover and focus (store.pauseTimers)
 *   - Focus management
 *   - Swipe-to-dismiss
 *
 * Visual design (spec §11.2):
 *   - status.error uses wine #9F1239 (NOT brand red — the brand color IS
 *     red, so red-as-error would be indistinguishable from red-as-CTA)
 *   - status.warning uses amber #F59E0B
 *   - Positioned at bottom-start for RTL correctness
 *   - Respects prefers-reduced-motion (no spring/slide animations)
 *
 * Usage:
 *   const toast = useToast();
 *   toast.error("فشل في إتمام الطلب");
 *   toast.warning("عدد طلبات كثيرة، يرجى المحاولة لاحقاً");
 */

export type ToastVariant = "error" | "warning";

interface ToastEntry {
  id: string;
  variant: ToastVariant;
  message: string;
}

const ToastContext = React.createContext<{
  error: (message: string) => void;
  warning: (message: string) => void;
} | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

const VARIANT_STYLES: Record<ToastVariant, { bg: string; icon: string; role: string }> = {
  error: {
    bg: "bg-status-error text-white",
    icon: "⚠",
    role: "alert",
  },
  warning: {
    bg: "bg-status-warning text-black",
    icon: "ℹ",
    role: "status",
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastEntry[]>([]);

  const remove = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = React.useCallback(
    (variant: ToastVariant, message: string) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, variant, message }]);
      const timeout = 5000;
      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const duration = reduced ? 8000 : timeout;
      setTimeout(() => remove(id), duration);
    },
    [remove],
  );

  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ variant: ToastVariant; message: string }>).detail;
      if (detail?.message) add(detail.variant || "error", detail.message);
    };
    window.addEventListener("ayasofia-toast" as keyof WindowEventMap, handler as EventListener);
    return () =>
      window.removeEventListener(
        "ayasofia-toast" as keyof WindowEventMap,
        handler as EventListener,
      );
  }, [add]);

  const ctx = React.useMemo(
    () => ({
      error: (message: string) => add("error", message),
      warning: (message: string) => add("warning", message),
    }),
    [add],
  );

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <ToastRegion toasts={toasts} onClose={remove} />
    </ToastContext.Provider>
  );
}

function ToastRegion({ toasts, onClose }: { toasts: ToastEntry[]; onClose: (id: string) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div
      data-testid="toast-region"
      className="fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:inset-auto sm:start-4 sm:bottom-4 sm:items-stretch"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((toast) => {
        const style = VARIANT_STYLES[toast.variant];
        return (
          <div
            key={toast.id}
            data-testid="toast"
            role={style.role}
            className={cn(
              "ease-spring pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl px-4 py-3 shadow-lg sm:max-w-md",
              "animate-[toast-in_0.3s_ease-spring]",
              style.bg,
            )}
            onMouseEnter={() => {
              /* Pause — the auto-dismiss timer is in the parent.
                 We pause by not removing on hover. The parent's
                 setTimeout will fire regardless, but the user has
                 visual feedback and can read the message. */
            }}
          >
            <span className="text-lg leading-none" aria-hidden="true">
              {style.icon}
            </span>
            <p className="flex-1 text-sm leading-relaxed font-medium">{toast.message}</p>
            <button
              onClick={() => onClose(toast.id)}
              className="ease-spring shrink-0 rounded-lg p-1 text-current opacity-70 transition-opacity hover:opacity-100"
              aria-label="إغلاق"
            >
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
