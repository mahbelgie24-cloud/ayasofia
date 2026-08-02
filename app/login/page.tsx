import { PinPad } from "@/components/pin-pad";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-cream px-4">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-brand-ink">
          Ayasofia Sweet
        </h1>
        <p className="mt-2 text-sm text-zinc-500">Enter your 4-digit PIN</p>
      </div>
      <PinPad redirectTo="/pos" />
    </div>
  );
}
