import { PinPad } from "@/components/pin-pad";
import { Logo } from "@/components/ui/logo";

export default function Home() {
  return (
    <div className="bg-brand-red-bg relative flex min-h-dvh flex-col" dir="rtl" lang="ar">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="bg-brand-red/[0.06] absolute start-1/2 -top-32 size-[40rem] -translate-x-1/2 rounded-full blur-3xl" />
      </div>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm text-center">
          <Logo size="xl" surface="tile" className="mx-auto mb-6" />
          <h1 className="display-1 text-brand-ink">Ayasofia Sweet</h1>
          <p className="body-lg text-text-secondary mt-1.5">حلويات آيا صوفيا</p>
          <p className="caption text-text-secondary/70 mt-3 text-sm">من تايوان إلى قلقيلية 🇹🇼</p>

          <div className="bg-border-subtle mx-auto my-8 h-px w-12" />

          <p className="label text-text-secondary mb-4 tracking-wider uppercase">
            تسجيل دخول الموظفين
          </p>
          <div className="surface-pop p-5">
            <PinPad redirectTo="/pos" />
          </div>
        </div>
      </main>
    </div>
  );
}
