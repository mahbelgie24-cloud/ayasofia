import { PinPad } from "@/components/pin-pad";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-brand-cream px-4">
      <div className="mb-8 text-center">
        <h1 className="font-display text-3xl font-bold text-brand-ink">
          Ayasofia Sweet
        </h1>
        <p className="mt-1 text-sm text-text-secondary">
          حلويات آيا صوفيا
        </p>
        <p className="mt-4 text-sm text-text-secondary">
          من تايوان إلى قلقيلية 🇹🇼
        </p>
      </div>
      <PinPad redirectTo="/pos" />
    </div>
  );
}
