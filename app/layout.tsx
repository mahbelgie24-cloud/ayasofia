import type { Metadata } from "next";
import {
  Baloo_2,
  Baloo_Bhaijaan_2,
  Inter,
  Noto_Sans_Arabic,
} from "next/font/google";
import "./globals.css";

const baloo = Baloo_2({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const balooAr = Baloo_Bhaijaan_2({
  variable: "--font-display-ar",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700", "800"],
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
  weight: ["400", "500", "600", "700"],
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
