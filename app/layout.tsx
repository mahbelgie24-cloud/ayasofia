import type { Metadata } from "next";
import { Baloo_2, Baloo_Bhaijaan_2, Inter, Noto_Sans_Arabic } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const baloo = Baloo_2({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["700"],
  display: "swap",
});

const balooAr = Baloo_Bhaijaan_2({
  variable: "--font-display-ar",
  subsets: ["arabic"],
  weight: ["700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const notoAr = Noto_Sans_Arabic({
  variable: "--font-body-ar",
  subsets: ["arabic"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ayasofia Sweet — حلويات آيا صوفيا",
  description:
    "Internal operations system for Ayasofia Sweet, Qalqilya — integrated POS, inventory, and ordering platform for Taiwanese bubble tea and Japanese/Korean desserts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ar"
      dir="rtl"
      className={`${baloo.variable} ${balooAr.variable} ${inter.variable} ${notoAr.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <a
          href="#main-content"
          className="focus:bg-brand-red sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-2xl focus:px-4 focus:py-3 focus:text-white focus:outline-none"
        >
          تجاوز إلى المحتوى الرئيسي
        </a>
        <ToastProvider>
          <AppShell />
          <main id="main-content" className="flex flex-1 flex-col">
            {children}
          </main>
        </ToastProvider>
      </body>
    </html>
  );
}
