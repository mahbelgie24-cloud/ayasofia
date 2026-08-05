import { PinPad } from "@/components/pin-pad";
import Image from "next/image";

export default function LoginPage() {
  return (
    <div className="bg-brand-cream flex min-h-screen flex-col items-center justify-center px-4">
      <div className="mb-8 text-center">
        <Image
          src="/icons/logo-mono.svg"
          alt=""
          width={48}
          height={48}
          className="mx-auto mb-3 h-12 w-auto"
        />
        <h1 className="font-heading text-brand-ink text-2xl font-bold">Ayasofia Sweet</h1>
        <p className="text-text-secondary mt-1 text-sm">حلويات آيا صوفيا</p>
        <p className="text-text-secondary text-sm">أدخل رمز PIN المكون من 4 أرقام</p>
      </div>
      <PinPad redirectTo="/pos" />
    </div>
  );
}
