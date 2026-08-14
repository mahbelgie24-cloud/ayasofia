import type { Metadata, Viewport } from "next";
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
  title: {
    default: "Ayasofia Sweet — حلويات آيا صوفيا",
    template: "%s · Ayasofia Sweet",
  },
  description:
    "حلويات آيا صوفيا، قلقيلية — بابل تي تايواني، حلويات يابانية وكورية. اطلب من QR، تابع حالتك لحظة بلحظة.",
  applicationName: "Ayasofia Sweet",
  keywords: [
    "Ayasofia",
    "Qalqilya",
    "bubble tea",
    "boba",
    "bingsu",
    "حلويات",
    "قلقيليا",
    "بابل تي",
  ],
  authors: [{ name: "Ayasofia Sweet" }],
  creator: "Ayasofia Sweet",
  publisher: "Ayasofia Sweet",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml", sizes: "any" },
      { url: "/favicon.ico", sizes: "16x16 32x32" },
      { url: "/icon1.png", type: "image/png", sizes: "192x192" },
      { url: "/icon2.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "ar_PS",
    siteName: "Ayasofia Sweet",
    title: "Ayasofia Sweet — حلويات آيا صوفيا",
    description:
      "حلويات آيا صوفيا، قلقيلية — بابل تي تايواني، حلويات يابانية وكورية. اطلب من QR، تابع حالتك لحظة بلحظة.",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "Ayasofia Sweet — Bubble Tea & Sweets",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Ayasofia Sweet — حلويات آيا صوفيا",
    description:
      "حلويات آيا صوفيا، قلقيلية — بابل تي تايواني، حلويات يابانية وكورية. اطلب من QR، تابع حالتك لحظة بلحظة.",
    images: ["/opengraph-image.png"],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#DC0000" },
    { media: "(prefers-color-scheme: dark)", color: "#2B1D1D" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
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
