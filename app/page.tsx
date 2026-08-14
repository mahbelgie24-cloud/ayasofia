import { PinPad } from "@/components/pin-pad";
import { Logo } from "@/components/ui/logo";
import { PearlField } from "@/components/ui/pearl-field";
import { Sparkles } from "lucide-react";

export default function Home() {
  return (
    <div
      className="bg-brand-red-bg relative flex min-h-dvh flex-col overflow-hidden"
      dir="rtl"
      lang="ar"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="bg-brand-red/[0.08] absolute start-1/2 -top-40 size-[44rem] -translate-x-1/2 rounded-full blur-3xl" />
        <div className="bg-brand-red/[0.05] absolute end-1/4 -bottom-40 size-[32rem] rounded-full blur-3xl" />
        <PearlField variant="scatter" tone="muted" count={10} />
      </div>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm text-center">
          <Logo size="2xl" surface="halo" breathing className="mx-auto mb-6" />
          <div className="text-brand-red mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.18em] uppercase">
            <Sparkles className="size-3" />
            من تايوان إلى قلقيلية
          </div>
          <h1 className="display-1 gradient-text-brand">Ayasofia Sweet</h1>
          <p className="text-brand-ink/85 body mt-2 font-semibold">حلويات آيا صوفيا</p>
          <p className="text-text-secondary caption mt-1.5">Bubble Tea · Bingsu · Soufflé</p>

          <div className="bg-border-subtle mx-auto my-7 h-px w-16" />

          <p className="label text-text-secondary mb-4 tracking-[0.12em] uppercase">
            تسجيل دخول الموظفين
          </p>
          <div
            className="surface-elev noise animate-scale-in relative overflow-hidden p-6"
            style={{ animationDelay: "120ms" }}
          >
            <span
              aria-hidden="true"
              className="bg-brand-red/8 pointer-events-none absolute -end-20 -top-20 size-48 rounded-full blur-3xl"
            />
            <p className="text-text-secondary caption mb-4">أدخل رمز PIN المكوّن من 4 أرقام</p>
            <div className="relative">
              <PinPad redirectTo="/pos" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
