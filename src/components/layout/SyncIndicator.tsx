"use client";

import React, { useState, useEffect } from "react";
import { syncManager, SyncStatus } from "@/lib/sync";
import { Loader2, Check, CloudOff } from "lucide-react";

export function SyncIndicator() {
  const [status, setStatus] = useState<SyncStatus>("IDLE");
  const [pendingCount, setPendingCount] = useState<number>(0);

  useEffect(() => {
    const unsubscribe = syncManager.subscribe((newStatus, count) => {
      setStatus(newStatus);
      setPendingCount(count);
    });
    return () => unsubscribe();
  }, []);

  if (status === "SYNCING") {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-zinc-400 dark:text-zinc-500 text-xs font-medium cursor-default"
        title="Syncing modifications with server..."
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400" />
        <span className="hidden sm:inline text-[11px]">Syncing</span>
      </div>
    );
  }

  if (status === "OFFLINE" || status === "ERROR") {
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs font-medium cursor-default"
        title="Saved locally. Syncing when connection restores."
      >
        <CloudOff className="w-3.5 h-3.5" />
        <span className="hidden sm:inline text-[11px]">
          Offline {pendingCount > 0 ? `(${pendingCount})` : ""}
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1 px-1.5 py-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium cursor-default"
      title="All changes saved and synchronized"
    >
      <Check className="w-3.5 h-3.5 text-emerald-500" />
      <span className="sr-only">In Sync</span>
    </div>
  );
}
