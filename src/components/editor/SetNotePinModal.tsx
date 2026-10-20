"use client";

import React, { useState, useRef, useEffect } from "react";
import { Lock, Check, AlertCircle, X, RefreshCw, KeyRound } from "lucide-react";

interface SetNotePinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  description?: string;
}

export function SetNotePinModal({
  isOpen,
  onClose,
  onSuccess,
  title = "Set Note Lock PIN",
  description = "Create a 4-digit security PIN to lock confidential documents. You can unlock them instantly without pressing Enter.",
}: SetNotePinModalProps) {
  const [pinDigits, setPinDigits] = useState<string[]>(["", "", "", ""]);
  const [confirmDigits, setConfirmDigits] = useState<string[]>(["", "", "", ""]);
  const [currentPinDigits, setCurrentPinDigits] = useState<string[]>(["", "", "", ""]);
  const [hasExistingPin, setHasExistingPin] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pinRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmRefs = useRef<(HTMLInputElement | null)[]>([]);
  const currentRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setPinDigits(["", "", "", ""]);
    setConfirmDigits(["", "", "", ""]);
    setCurrentPinDigits(["", "", "", ""]);

    // Check if user already has a PIN
    setLoadingInitial(true);
    fetch("/api/user/pin")
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.hasPin) {
          setHasExistingPin(true);
          setTimeout(() => currentRefs.current[0]?.focus(), 60);
        } else {
          setHasExistingPin(false);
          setTimeout(() => pinRefs.current[0]?.focus(), 60);
        }
      })
      .catch(() => {
        setHasExistingPin(false);
        setTimeout(() => pinRefs.current[0]?.focus(), 60);
      })
      .finally(() => setLoadingInitial(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSavePin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);

    const pin = pinDigits.join("");
    const confirm = confirmDigits.join("");
    const currentPin = currentPinDigits.join("");

    if (hasExistingPin && currentPin.length !== 4) {
      setError("Please enter your current 4-digit PIN.");
      return;
    }

    if (pin.length !== 4) {
      setError("Please enter a 4-digit PIN.");
      return;
    }

    if (pin !== confirm) {
      setError("PIN and confirmation do not match.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/user/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin,
          currentPin: hasExistingPin ? currentPin : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to update PIN");
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save PIN");
    } finally {
      setSaving(false);
    }
  };

  const handlePinDigit = (index: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const updated = [...pinDigits];
    updated[index] = digit;
    setPinDigits(updated);
    setError(null);

    if (digit && index < 3) {
      pinRefs.current[index + 1]?.focus();
    } else if (digit && index === 3) {
      confirmRefs.current[0]?.focus();
    }
  };

  const handleConfirmDigit = (index: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const updated = [...confirmDigits];
    updated[index] = digit;
    setConfirmDigits(updated);
    setError(null);

    if (digit && index < 3) {
      confirmRefs.current[index + 1]?.focus();
    } else if (digit && index === 3) {
      const pinStr = pinDigits.join("");
      const confirmStr = updated.join("");
      if (pinStr.length === 4 && confirmStr.length === 4 && pinStr === confirmStr) {
        // Auto trigger save when confirm completes!
        setTimeout(() => handleSavePin(), 50);
      }
    }
  };

  const handleCurrentDigit = (index: number, val: string) => {
    const digit = val.replace(/\D/g, "").slice(-1);
    const updated = [...currentPinDigits];
    updated[index] = digit;
    setCurrentPinDigits(updated);
    setError(null);

    if (digit && index < 3) {
      currentRefs.current[index + 1]?.focus();
    } else if (digit && index === 3) {
      pinRefs.current[0]?.focus();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-5 text-center">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-zinc-100">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-zinc-400 text-left">{description}</p>

        {error && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {loadingInitial ? (
          <div className="flex items-center justify-center gap-2 py-4 text-xs text-zinc-400">
            <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
            <span>Checking security configuration...</span>
          </div>
        ) : (
          <form onSubmit={handleSavePin} className="space-y-4">
            {hasExistingPin && (
              <div className="space-y-1.5 text-left">
                <label className="block text-xs font-semibold text-zinc-300">
                  Current 4-Digit PIN
                </label>
                <div className="flex items-center justify-center gap-2">
                  {currentPinDigits.map((d, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        currentRefs.current[i] = el;
                      }}
                      type="password"
                      inputMode="numeric"
                      maxLength={1}
                      value={d}
                      onChange={(e) => handleCurrentDigit(i, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Backspace" && !currentPinDigits[i] && i > 0) {
                          currentRefs.current[i - 1]?.focus();
                        }
                      }}
                      aria-label={`Current PIN Digit ${i + 1}`}
                      className="w-10 h-12 text-center text-lg font-bold font-mono rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-100 focus:outline-none focus:border-amber-400"
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-semibold text-zinc-300">
                {hasExistingPin ? "New 4-Digit PIN" : "Enter 4-Digit PIN"}
              </label>
              <div className="flex items-center justify-center gap-2">
                {pinDigits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      pinRefs.current[i] = el;
                    }}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={(e) => handlePinDigit(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !pinDigits[i] && i > 0) {
                        pinRefs.current[i - 1]?.focus();
                      }
                    }}
                    aria-label={`New PIN Digit ${i + 1}`}
                    className="w-10 h-12 text-center text-lg font-bold font-mono rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <label className="block text-xs font-semibold text-zinc-300">
                Confirm 4-Digit PIN
              </label>
              <div className="flex items-center justify-center gap-2">
                {confirmDigits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      confirmRefs.current[i] = el;
                    }}
                    type="password"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    onChange={(e) => handleConfirmDigit(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Backspace" && !confirmDigits[i] && i > 0) {
                        confirmRefs.current[i - 1]?.focus();
                      }
                    }}
                    aria-label={`Confirm PIN Digit ${i + 1}`}
                    className="w-10 h-12 text-center text-lg font-bold font-mono rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-100 focus:outline-none focus:border-amber-400"
                  />
                ))}
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={
                  saving ||
                  pinDigits.join("").length !== 4 ||
                  confirmDigits.join("").length !== 4
                }
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-zinc-950 transition-colors disabled:opacity-40 flex items-center gap-1.5 shadow-sm"
              >
                {saving ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Check className="w-3.5 h-3.5" />
                )}
                <span>{hasExistingPin ? "Update PIN" : "Save Lock PIN"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
