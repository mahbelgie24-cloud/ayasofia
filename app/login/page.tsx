import { PinPad } from "@/components/pin-pad";
import { Logo } from "@/components/ui/logo";

export default function LoginPage() {
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
