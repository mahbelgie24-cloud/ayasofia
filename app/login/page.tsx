import { PinPad } from "@/components/pin-pad";
import { Logo } from "@/components/ui/logo";
import { PearlField } from "@/components/ui/pearl-field";
import { Sparkles } from "lucide-react";

/**
 * Friendly reason the proxy redirected the user here with a hard
 * session error (corrupt cookie, JWT rejected, network/auth outage).
 */
const FRIENDLY_REASONS: Record<string, string> = {
  session_check_failed: "تعذّر التحقق من الجلسة. يرجى تسجيل الدخول مرة أخرى.",
  refresh_token_already_used: "انتهت صلاحية الجلسة السابقة. يرجى تسجيل الدخول من جديد.",
  session_expired: "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.",
  invalid_token: "رمز الجلسة غير صالح. يرجى تسجيل الدخول من جديد.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ reason?: string | string[] }>;
}) {
  const params = (await searchParams) ?? {};
  const rawReason = Array.isArray(params.reason) ? params.reason[0] : params.reason;
  const friendlyReason =
    (rawReason && FRIENDLY_REASONS[rawReason]) ||
    (rawReason
      ? `تعذّر استكمال جلستك السابقة (${decodeURIComponent(rawReason)}). يرجى تسجيل الدخول مرة أخرى.`
      : null);

  return (
    <div
      className="bg-brand-red-bg relative flex min-h-dvh flex-col overflow-hidden"
      dir="rtl"
      lang="ar"
    >
      {/* Layered ambient backdrop */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="bg-brand-red/[0.08] absolute start-1/2 -top-40 size-[44rem] -translate-x-1/2 rounded-full blur-3xl" />
        <div className="bg-brand-red/[0.05] absolute end-1/4 -bottom-40 size-[32rem] rounded-full blur-3xl" />
        <div className="bg-brand-red/[0.04] absolute start-1/4 top-1/2 size-[24rem] -translate-y-1/2 rounded-full blur-3xl" />
        <PearlField variant="scatter" tone="muted" count={10} />
      </div>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-5">
        <div className="w-full max-w-sm">
          {/* Brand block */}
          <div className="animate-fade-in-up mb-6 flex flex-col items-center text-center">
            <Logo size="xl" surface="halo" breathing className="mb-4" />
            <div className="text-brand-red mb-2 inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.18em] uppercase">
              <Sparkles className="size-3" />
              من تايوان إلى قلقيلية
            </div>
            <h1 className="display-1 gradient-text-brand mt-1">Ayasofia Sweet</h1>
            <p className="text-brand-ink/85 body mt-2 font-semibold">حلويات آيا صوفيا</p>
            <p className="text-text-secondary caption mt-1.5">Bubble Tea · Bingsu · Soufflé</p>
          </div>

          {/* Friendly reason (session error) */}
          {friendlyReason && (
            <div
              role="alert"
              aria-live="polite"
              className="border-status-warning/40 bg-status-warning/10 text-status-warning animate-fade-in mb-5 flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm shadow-sm"
            >
              <span aria-hidden="true" className="mt-0.5">
                ⚠
              </span>
              <span>{friendlyReason}</span>
            </div>
          )}

          {/* PIN card */}
          <div
            className="surface-elev noise animate-scale-in relative overflow-hidden px-6 py-5 sm:px-8 sm:py-6"
            style={{ animationDelay: "120ms" }}
          >
            <span
              aria-hidden="true"
              className="bg-brand-red/8 pointer-events-none absolute -end-20 -top-20 size-48 rounded-full blur-3xl"
            />
            <div className="relative">
              <p className="label text-text-secondary mb-4 text-center tracking-wider uppercase">
                تسجيل دخول الموظفين
              </p>
              <p className="text-text-secondary caption mb-4 text-center">
                أدخل رمز PIN المكوّن من 4 أرقام
              </p>
              <PinPad redirectTo="/pos" />
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 shrink-0 pt-1 pb-4 text-center">
        <div className="text-text-secondary/70 caption flex items-center justify-center gap-1.5">
          <PearlField variant="row" tone="muted" size="sm" />
        </div>
      </footer>
    </div>
  );
}
