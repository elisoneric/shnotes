"use client";

import React, { useState, useEffect } from "react";
import { Share, PlusSquare, X, Smartphone, ArrowDown } from "lucide-react";

export function IosInstallModal() {
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Only detect in browser
    if (typeof window === "undefined") return;

    const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);
    const isStandalone = (window.navigator as any).standalone === true;
    const dismissed = localStorage.getItem("shnotes_ios_prompt_dismissed");

    if (isIos && !isStandalone && !dismissed) {
      // Delay prompt slightly for clean UX
      const timer = setTimeout(() => setShowModal(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("shnotes_ios_prompt_dismissed", "true");
    setShowModal(false);
  };

  if (!showModal) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-5 space-y-4 text-center">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-zinc-500">
            <Smartphone className="w-4 h-4 text-zinc-400" />
            <span>Install Web App</span>
          </div>
          <button onClick={handleDismiss} className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Add to Home Screen</h3>
          <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
            Install this platform to run full-screen offline with instant zero-latency sync.
          </p>
        </div>

        {/* Step-by-Step Instructions */}
        <div className="bg-zinc-50 dark:bg-zinc-950/70 rounded-xl p-3.5 border border-zinc-100 dark:border-zinc-800/80 space-y-3 text-left text-xs">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0">
              <Share className="w-4 h-4 text-blue-500" />
            </div>
            <span className="text-zinc-700 dark:text-zinc-300">
              1. Tap the <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Share</strong> button in Safari toolbar below.
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center shrink-0">
              <PlusSquare className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
            </div>
            <span className="text-zinc-700 dark:text-zinc-300">
              2. Scroll down and select <strong className="font-semibold text-zinc-900 dark:text-zinc-100">Add to Home Screen</strong>.
            </span>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="w-full text-xs font-semibold py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 transition-opacity"
        >
          Got It
        </button>
      </div>
    </div>
  );
}
