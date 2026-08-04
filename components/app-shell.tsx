"use client";

import { useEffect } from "react";
import { ConnectivityIndicator } from "./connectivity-indicator";

/**
 * Registers the Service Worker for offline app-shell caching
 * and renders the connectivity status bar.
 *
 * SW registration is silent — failures are logged but never
 * surfaced to the user as errors.  The app works without it.
 */
export function AppShell() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              // New SW available — will activate on next navigation.
              // No forced reload; let the browser handle it naturally.
            }
          });
        });
      })
      .catch((err) => {
        console.warn("[sw] Registration failed — app runs without offline cache:", err.message);
      });
  }, []);

  return <ConnectivityIndicator />;
}
