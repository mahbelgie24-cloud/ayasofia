"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { verifyStaffPin } from "@/app/login/actions";

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9, null, 0, "⌫"] as const;

interface Props {
  /** Route to navigate to after a successful PIN match. */
  redirectTo: string;
}

export function PinPad({ redirectTo }: Props) {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

      // Guardrail: anonymous sign-in happens ONLY here, inside the
      // PIN submit handler — never on page load or elsewhere (§2).
      const { data: anonData, error: anonErr } =
        await supabase.auth.signInAnonymously();

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

      // Refresh the session so the JWT picks up the new app_metadata
      // claims (staff_id, role) set by the server action (§2 guardrail).
      await supabase.auth.refreshSession();

      router.push(redirectTo);
    } catch {
      setError("Something went wrong");
      setLoading(false);
    }
  }, [pin, loading, redirectTo, router]);

  const filled = pin.length;
  const canSubmit = filled === 4 && !loading;

  return (
    <div className="mx-auto flex w-full max-w-xs flex-col items-center gap-6">
      {/* PIN display — 4 dots */}
      <div aria-label={`${filled} digits entered`} className="flex gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-5 w-5 rounded-full border-2 transition-colors ${
              i < filled
                ? "border-brand-red bg-brand-red"
                : "border-brand-ink/20"
            }`}
          />
        ))}
      </div>

      {error && (
        <p className="text-sm text-status-error" role="alert">
          {error}
        </p>
      )}

      {/* Keypad grid */}
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
                aria-label="Delete last digit"
                className="flex h-14 items-center justify-center rounded-2xl border border-brand-ink/10 text-xl text-brand-ink transition-colors hover:bg-brand-ink/5 disabled:opacity-30"
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
              aria-label={`Digit ${digit}`}
              className="flex h-14 items-center justify-center rounded-2xl border border-brand-ink/10 text-2xl font-medium text-brand-ink transition-colors hover:bg-brand-ink/5 active:bg-brand-red/10 disabled:opacity-30"
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
          className="flex-1 rounded-full border border-brand-ink/10 px-4 py-3 text-sm font-medium text-brand-ink transition-colors hover:bg-brand-ink/5 disabled:opacity-30"
        >
          Clear
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex-1 rounded-full bg-brand-red px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-red/90 disabled:opacity-50"
        >
          {loading ? "..." : "Enter"}
        </button>
      </div>
    </div>
  );
}
