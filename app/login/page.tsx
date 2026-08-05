import { PinPad } from "@/components/pin-pad";

export default function LoginPage() {
  return (
    <div className="bg-brand-cream flex min-h-screen flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <h1 className="text-brand-ink text-2xl font-semibold">Ayasofia Sweet</h1>
        <p className="text-text-secondary mt-2 text-sm">Enter your 4-digit PIN</p>
      </div>
      <PinPad redirectTo="/pos" />
    </div>
  );
}
