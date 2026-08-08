import { PinPad } from "@/components/pin-pad";
import { Logo } from "@/components/ui/logo";

/**
 * Friendly reason the proxy redirected the user here with a hard
 * session error (corrupt cookie, JWT rejected, network/auth outage).
 * The proxy URL-encodes the original Supabase error message into
 * `?reason=` so we can show it verbatim without leaking sensitive
 * internals — a cashier sees "Session refresh failed: ..." rather than
 * a raw stack trace. See proxy.ts for the redirect that sets this.
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
    <div className="bg-brand-red-bg relative flex min-h-dvh flex-col" dir="rtl" lang="ar">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="bg-brand-red/[0.06] absolute start-1/2 -top-32 size-[40rem] -translate-x-1/2 rounded-full blur-3xl" />
        <div className="bg-brand-red/[0.04] absolute end-1/4 -bottom-40 size-[28rem] rounded-full blur-3xl" />
      </div>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <Logo size="lg" surface="tile" className="mb-5" />
            <h1 className="heading-1 text-brand-ink">Ayasofia Sweet</h1>
            <p className="body text-brand-ink/80 mt-1 font-medium">حلويات آيا صوفيا</p>
            <div className="bg-border-subtle my-4 h-px w-12" />
            <p className="body-sm text-text-secondary">أدخل رمز PIN المكوّن من 4 أرقام</p>
          </div>

          {friendlyReason && (
            <div
              role="alert"
              aria-live="polite"
              className="bg-status-warning/10 border-status-warning/30 text-status-warning mb-4 rounded-2xl border px-4 py-3 text-sm"
            >
              {friendlyReason}
            </div>
          )}

          <div className="surface-pop p-6 sm:p-8">
            <PinPad redirectTo="/pos" />
          </div>
        </div>
      </main>

      <footer className="relative z-10 shrink-0 pt-2 pb-6 text-center">
        <p className="caption text-text-secondary/70">من تايوان إلى قلقيلية 🇹🇼</p>
      </footer>
    </div>
  );
}
