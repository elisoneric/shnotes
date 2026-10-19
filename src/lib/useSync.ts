"use client";

import { useEffect, useState } from "react";
import { syncManager, SyncStatus } from "@/lib/sync";

export function useSync() {
  const [status, setStatus] = useState<SyncStatus>("IDLE");
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    const unsubscribe = syncManager.subscribe((newStatus, count) => {
      setStatus(newStatus);
      setPendingCount(count);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const triggerSync = () => {
    syncManager.syncNow();
  };

  return {
    status,
    pendingCount,
    triggerSync,
    isOnline: status !== "OFFLINE",
    isSyncing: status === "SYNCING",
  };
}
