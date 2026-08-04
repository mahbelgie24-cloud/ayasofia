"use client";

import { useState, useEffect, useCallback } from "react";
import { flushQueue, type FlushResult } from "@/lib/offline/sync";
import { pendingCount } from "@/lib/offline/queue";

export interface ConnectivityState {
  online: boolean;
  pendingSyncCount: number;
  syncing: boolean;
  lastFlushResult: FlushResult | null;
  flushNow: () => Promise<FlushResult>;
  refreshPendingCount: () => Promise<void>;
}

export function useConnectivity(): ConnectivityState {
  const [online, setOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastFlushResult, setLastFlushResult] = useState<FlushResult | null>(null);

  const refreshPendingCount = useCallback(async () => {
    try {
      setPendingSyncCount(await pendingCount());
    } catch {
      // IndexedDB may be unavailable (SSR or private browsing)
    }
  }, []);

  const flushNow = useCallback(async (): Promise<FlushResult> => {
    setSyncing(true);
    try {
      const result = await flushQueue();
      setLastFlushResult(result);
      setPendingSyncCount(result.remaining);
      return result;
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      flushQueue().then((r) => {
        setLastFlushResult(r);
        setPendingSyncCount(r.remaining);
      });
    };

    const handleOffline = () => setOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Initialise pending count on mount — deferred to avoid sync setState.
  useEffect(() => {
    let ignore = false;
    pendingCount()
      .then((c) => {
        if (!ignore) setPendingSyncCount(c);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);

  return {
    online,
    pendingSyncCount,
    syncing,
    lastFlushResult,
    flushNow,
    refreshPendingCount,
  };
}
