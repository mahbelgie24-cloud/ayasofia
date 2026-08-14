import type { MetadataRoute } from "next";

/**
 * PWA manifest for Ayasofia Sweet.
 *
 * Icons are derived from `public/icons/mark-canonical.svg` and live in `app/`
 * per the App Router file conventions. `app/favicon.ico` is the
 * `image/x-icon` fallback; `app/icon1.png` (192×192) and `app/icon2.png`
 * (512×512) are the dedicated PWA sizes. `app/apple-icon.png` (180×180) is
 * picked up automatically by the App Router for the iOS home-screen link.
 *
 * All colors are exact brand tokens (spec §11.2) — #DC0000, #2B1D1D,
 * #FAF6F3. No new hex values are introduced here.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ayasofia Sweet — حلويات آيا صوفيا",
    short_name: "Ayasofia",
    description:
      "حلويات آيا صوفيا، قلقيلية — بابل تي تايواني، حلويات يابانية وكورية. اطلب من QR، تابع حالتك لحظة بلحظة.",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#DC0000",
    theme_color: "#DC0000",
    categories: ["food", "lifestyle", "shopping"],
    icons: [
      {
        src: "/favicon.ico",
        sizes: "16x16 32x32",
        type: "image/x-icon",
        purpose: "any",
      },
      {
        src: "/icon1.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon2.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
