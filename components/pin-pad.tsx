"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { verifyStaffPin } from "@/app/login/actions";
import { openShift } from "@/lib/shifts";
import { flushQueue } from "@/lib/offline/sync";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "⌫"] as const;

interface Props {
  redirectTo: string;
}

type FlowState = "pin" | "opening-cash";

export function PinPad({ redirectTo }: Props) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [flow, setFlow] = useState<FlowState>("pin");
  const [openingCash, setOpeningCash] = useState("");

  const handleDigit = useCallback(
    (digit: string) => {
      setError(null);
      if (pin.length < 4) setPin((p) => p + digit);
    },
    [pin.length],
  );

  const handleBackspace = useCallback(() => {
    setError(null);
    if (loading) return;
    setPin((p) => p.slice(0, -1));
  }, [loading]);

  const handleClear = useCallback(() => {
    setError(null);
    if (loading) return;
    setPin("");
  }, [loading]);

  const handleSubmit = useCallback(async () => {
    if (pin.length !== 4 || loading) return;
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const { data: anonData, error: anonErr } = await supabase.auth.signInAnonymously();

      if (anonErr || !anonData.user) {
        setError("Connection failed. Try again.");
        setLoading(false);
        return;
      }

      const result = await verifyStaffPin(pin, anonData.user.id);

      if (!result.success) {
        setError(result.error);
        setLoading(false);
        return;
      }

      await supabase.auth.refreshSession();

      // A successful login carries a fresh staff session.  Flush any
      // orders queued during an earlier offline session (or an expired
      // session) so they sync exactly once now that auth is valid
      // (review finding C5).  Fire-and-forget — never block entry.
      flushQueue().catch(() => {});

      if (!result.hasOpenShift) {
        setFlow("opening-cash");
        setLoading(false);
        return;
      }

      router.push(redirectTo);
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }, [pin, loading, redirectTo, router]);

  const handleOpenShift = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const cash = openingCash.trim() === "" ? 0 : parseFloat(openingCash);
      const shiftResult = await openShift(isNaN(cash) ? 0 : cash);

      if (!shiftResult.success) {
        setError(shiftResult.error);
        setLoading(false);
        return;
      }

      router.push(redirectTo);
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }, [openingCash, redirectTo, router]);

  const filled = pin.length;
  const canSubmit = filled === 4 && !loading;

  if (flow === "opening-cash") {
    return (
      <div className="mx-auto flex w-full max-w-xs flex-col items-center gap-5">
        <p className="text-brand-ink text-center text-sm font-medium">الرصيد الافتتاحي للوردية</p>
        <p className="text-text-secondary text-center text-xs">
          أدخل المبلغ النقدي الموجود في الدرج عند بداية الوردية (اختياري)
        </p>
        <input
          type="number"
          inputMode="decimal"
          value={openingCash}
          onChange={(e) => setOpeningCash(e.target.value)}
          placeholder="0.00"
          className="border-border-subtle text-brand-ink focus:border-brand-red/50 ease-spring w-full rounded-full border bg-white px-4 py-3 text-center text-lg font-medium transition-colors outline-none"
          dir="ltr"
          autoFocus
        />
        {error && (
          <p className="text-status-error text-sm" role="alert">
            {error}
          </p>
        )}
        <div className="flex w-full gap-3">
          <button
            type="button"
            onClick={() => router.push(redirectTo)}
            className="border-brand-ink/10 text-text-secondary hover:bg-muted ease-spring flex-1 rounded-full border px-4 py-3 text-sm font-medium transition-colors"
          >
            تخطي
          </button>
          <button
            type="button"
            onClick={handleOpenShift}
            disabled={loading}
            className="bg-brand-red hover:bg-brand-red/90 ease-spring flex-1 rounded-full px-4 py-3 text-sm font-medium text-white transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "بدء الوردية"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-xs flex-col items-center gap-6">
      <div role="group" aria-label={`${filled} digits entered`} className="flex gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`ease-spring h-5 w-5 rounded-full border-2 transition-colors ${
              i < filled ? "border-brand-red bg-brand-red" : "border-brand-ink/20"
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="text-status-error text-sm" role="alert">
          {error}
        </p>
      )}

      <div className="grid w-full grid-cols-3 gap-3">
        {DIGITS.map((key) => {
          if (key === null) return <div key="spacer" />;

          if (key === "⌫") {
            return (
              <button
                key="backspace"
                type="button"
                onClick={handleBackspace}
                disabled={filled === 0 || loading}
                aria-label="حذف الرقم الأخير"
                className="border-brand-ink/10 text-brand-ink hover:bg-brand-ink/5 ease-spring flex h-12 items-center justify-center rounded-2xl border text-xl transition-colors disabled:opacity-30"
              >
                ⌫
              </button>
            );
          }

          const digit = String(key);
          return (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              disabled={filled === 4 || loading}
              aria-label={`رقم ${digit}`}
              className="border-brand-ink/10 text-brand-ink hover:bg-brand-ink/5 active:bg-brand-red/10 ease-spring flex h-12 items-center justify-center rounded-2xl border text-2xl font-medium transition-colors disabled:opacity-30"
            >
              {digit}
            </button>
          );
        })}
      </div>

      <div className="flex w-full gap-3">
        <button
          type="button"
          onClick={handleClear}
          disabled={filled === 0 || loading}
          className="border-brand-ink/10 text-brand-ink hover:bg-brand-ink/5 ease-spring flex-1 rounded-full border px-4 py-3 text-sm font-medium transition-colors disabled:opacity-30"
        >
          مسح
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="bg-brand-red hover:bg-brand-red/90 ease-spring flex-1 rounded-full px-4 py-3 text-sm font-medium text-white transition-colors disabled:opacity-50"
        >
          {loading ? "..." : "تأكيد"}
        </button>
      </div>
    </div>
  );
}
