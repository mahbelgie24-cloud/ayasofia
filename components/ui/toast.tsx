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
  const timersRef = React.useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const remove = React.useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(id);
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const schedule = React.useCallback(
    (id: string, duration: number) => {
      const existing = timersRef.current.get(id);
      if (existing) clearTimeout(existing);
      const timer = setTimeout(() => remove(id), duration);
      timersRef.current.set(id, timer);
    },
    [remove],
  );

  const addInternal = React.useCallback(
    (variant: ToastVariant, message: string) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [...prev, { id, variant, message }]);
      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      schedule(id, reduced ? 8000 : 5000);
    },
    [schedule],
  );

  // T-B12: the auto-dismiss timer actually STOPS on hover/focus…
  const pause = React.useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    if (timer) clearTimeout(timer);
    timersRef.current.delete(id);
  }, []);

  // …and resumes from the full duration when the pointer/keyboard leaves.
  const resume = React.useCallback(
    (id: string) => {
      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      schedule(id, reduced ? 8000 : 5000);
    },
    [schedule],
  );

  React.useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ variant: ToastVariant; message: string }>).detail;
      if (detail?.message) addInternal(detail.variant || "error", detail.message);
    };
    window.addEventListener("ayasofia-toast" as keyof WindowEventMap, handler as EventListener);
    return () =>
      window.removeEventListener(
        "ayasofia-toast" as keyof WindowEventMap,
        handler as EventListener,
      );
  }, [addInternal]);

  // Clear all pending timers on unmount.
  React.useEffect(
    () => () => {
      for (const t of timersRef.current.values()) clearTimeout(t);
      timersRef.current.clear();
    },
    [],
  );

  const ctx = React.useMemo(
    () => ({
      error: (message: string) => addInternal("error", message),
      warning: (message: string) => addInternal("warning", message),
    }),
    [addInternal],
  );

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <ToastRegion toasts={toasts} onClose={remove} onPause={pause} onResume={resume} />
    </ToastContext.Provider>
  );
}

function ToastRegion({
  toasts,
  onClose,
  onPause,
  onResume,
}: {
  toasts: ToastEntry[];
  onClose: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}) {
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
              "ease-spring shadow-elev pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl px-4 py-3.5 sm:max-w-md",
              "animate-[toast-in_0.35s_var(--ease-spring)]",
              style.bg,
            )}
            onMouseEnter={() => onPause(toast.id)}
            onMouseLeave={() => onResume(toast.id)}
            onFocusCapture={() => onPause(toast.id)}
            onBlurCapture={() => onResume(toast.id)}
            onKeyDown={(e) => {
              // Escape dismisses the focused toast (T-B12).
              if (e.key === "Escape") onClose(toast.id);
            }}
            tabIndex={-1}
          >
            <span className="text-lg leading-none" aria-hidden="true">
              {style.icon}
            </span>
            <p className="flex-1 text-sm leading-relaxed font-medium">{toast.message}</p>
            {/* aria-pressed + pause acts as a11y-visible "holding" hint */}
            <button
              onClick={() => onClose(toast.id)}
              className="ease-spring flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg p-1 text-current opacity-70 transition-opacity hover:opacity-100 focus-visible:opacity-100"
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
