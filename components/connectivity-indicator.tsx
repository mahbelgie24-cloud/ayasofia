"use client";

import { useConnectivity } from "@/hooks/useConnectivity";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";

/**
 * A subtle connectivity indicator bar shown at the top of POS/Drive-Thru pages.
 *
 * - Green bar + check: online, 0 pending
 * - Amber bar + counter: online, N orders pending sync
 * - Red bar + icon: offline — POS continues working via queue
 */
export function ConnectivityIndicator() {
  const { online, pendingSyncCount, syncing } = useConnectivity();

  // Don't render anything when online with no pending — keep it clean.
  if (online && pendingSyncCount === 0) return null;

  return (
    <div
      className={`flex items-center justify-center gap-2 px-3 py-1.5 text-sm font-medium transition-colors ${
        !online
          ? "bg-status-error text-white"
          : pendingSyncCount > 0
            ? "bg-status-warning text-black"
            : "bg-status-success text-white"
      }`}
    >
      {!online ? (
        <>
          <WifiOff className="h-4 w-4" />
          <span>غير متصل — سيتم حفظ الطلبات تلقائياً</span>
        </>
      ) : syncing ? (
        <>
          <RefreshCw className="h-4 w-4 animate-spin" />
          <span>جاري المزامنة...</span>
        </>
      ) : (
        <>
          <Wifi className="h-4 w-4" />
          <span>
            {pendingSyncCount === 1
              ? "طلب واحد بانتظار المزامنة"
              : `${pendingSyncCount} طلبات بانتظار المزامنة`}
          </span>
        </>
      )}
    </div>
  );
}
