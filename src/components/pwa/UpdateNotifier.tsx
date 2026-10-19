"use client";

import React, { useState, useEffect, useRef } from "react";
import { RefreshCw, ArrowUpCircle } from "lucide-react";

export function UpdateNotifier() {
  const [upgradeAvailable, setUpgradeAvailable] = useState(false);
  const [newVersion, setNewVersion] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(4);
  const runningVersionRef = useRef<string | null>(null);
  const isRefreshingRef = useRef(false);

  const performHardRefresh = async (targetVer?: string) => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;

    // 1. Send purge and skip_waiting to all service workers
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          reg.active?.postMessage("PURGE_CACHE");
          reg.active?.postMessage("SKIP_WAITING");
          await reg.unregister();
        }
      } catch (err) {
        console.warn("Failed to unregister service worker:", err);
      }
    }

    // 2. Clear all CacheStorage keys
    if (typeof window !== "undefined" && "caches" in window) {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (err) {
        console.warn("Failed to delete cache keys:", err);
      }
    }

    // 2.5 In Electron desktop app, invoke native session cache wipe
    if (typeof window !== "undefined" && (window as any).electronAPI?.triggerDesktopUpgradeRefresh) {
      try {
        await (window as any).electronAPI.triggerDesktopUpgradeRefresh();
      } catch (err) {
        console.warn("Desktop refresh error:", err);
      }
    }

    // 3. Update session-stored version
    if (targetVer) {
      sessionStorage.setItem("app_running_version", targetVer);
    }

    // 4. Hard reload with cache-busting query parameter
    const currentPath = window.location.pathname;
    const cacheBuster = `upgraded=${Date.now()}`;
    window.location.replace(`${currentPath}?${cacheBuster}`);
  };

  const checkVersion = async () => {
    try {
      const res = await fetch("/api/version", {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
      });
      if (!res.ok) return;
      const data = await res.json();
      const serverVersion = data.version;

      if (!serverVersion) return;

      // If initial check, record active version
      if (!runningVersionRef.current) {
        const stored = sessionStorage.getItem("app_running_version");
        if (stored && stored !== serverVersion) {
          // Detected an upgrade that occurred while the tab was closed/sleeping
          runningVersionRef.current = stored;
          setNewVersion(serverVersion);
          setUpgradeAvailable(true);
          return;
        }
        runningVersionRef.current = serverVersion;
        sessionStorage.setItem("app_running_version", serverVersion);
        return;
      }

      // Check if server version differs from the version currently running in this client
      if (serverVersion !== runningVersionRef.current) {
        setNewVersion(serverVersion);
        setUpgradeAvailable(true);
      }
    } catch (err) {
      // Offline or network error - ignore and keep operating offline
    }
  };

  useEffect(() => {
    // Initial check on boot
    checkVersion();

    // Check periodically every 30 seconds
    const interval = setInterval(checkVersion, 30000);

    // Check on window focus or visibility resume (e.g. user unlocks phone or switches tabs)
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        checkVersion();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", checkVersion);

    // Also listen to Service Worker updates
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        checkVersion();
      });
    }

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", checkVersion);
    };
  }, []);

  // Countdown timer when upgrade is detected
  useEffect(() => {
    if (!upgradeAvailable) return;

    if (countdown <= 0) {
      performHardRefresh(newVersion || undefined);
      return;
    }

    const timer = setTimeout(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [upgradeAvailable, countdown, newVersion]);

  if (!upgradeAvailable) return null;

  return (
    <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4 pointer-events-auto animate-in slide-in-from-top duration-300">
      <div className="p-3.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 shadow-2xl border border-zinc-700 dark:border-zinc-300 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <ArrowUpCircle className="w-5 h-5 text-emerald-400 dark:text-emerald-600 shrink-0 animate-pulse" />
          <div className="min-w-0">
            <p className="text-xs font-bold leading-tight truncate">Platform Update Deployed</p>
            <p className="text-[11px] text-zinc-300 dark:text-zinc-600 leading-tight truncate">
              Refreshing cached assets in {countdown}s...
            </p>
          </div>
        </div>

        <button
          onClick={() => performHardRefresh(newVersion || undefined)}
          className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold shrink-0 flex items-center gap-1.5 transition-colors shadow-sm"
        >
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          <span>Refresh Now</span>
        </button>
      </div>
    </div>
  );
}
