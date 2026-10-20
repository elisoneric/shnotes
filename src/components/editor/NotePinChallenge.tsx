"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Lock,
  KeyRound,
  Mail,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  ShieldCheck,
} from "lucide-react";

interface NotePinChallengeProps {
  pageId: string;
  pageTitle?: string;
  onUnlock: () => void;
  onCancel?: () => void;
}

export function NotePinChallenge({
  pageId,
  pageTitle,
  onUnlock,
  onCancel,
}: NotePinChallengeProps) {
  // Mode: "pin" challenge or "recovery" (email 6-digit code)
  const [view, setView] = useState<"pin" | "recovery">("pin");

  // 4-Digit PIN State
  const [pinDigits, setPinDigits] = useState<string[]>(["", "", "", ""]);
  const pinInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isShaking, setIsShaking] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Recovery State
  const [recoveryDigits, setRecoveryDigits] = useState<string[]>([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  const recoveryInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [isSendingRecovery, setIsSendingRecovery] = useState(false);
  const [isVerifyingRecovery, setIsVerifyingRecovery] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Optional new PIN setting on recovery
  const [resetPin, setResetPin] = useState(false);
  const [newPinDigits, setNewPinDigits] = useState<string[]>(["", "", "", ""]);
  const newPinInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first PIN input on mount and on view switch
  useEffect(() => {
    if (view === "pin") {
      setTimeout(() => {
        pinInputRefs.current[0]?.focus();
      }, 50);
    } else {
      setTimeout(() => {
        recoveryInputRefs.current[0]?.focus();
      }, 50);
    }
  }, [view]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Trigger PIN verification immediately when 4th digit is entered
  const verifyPinValue = async (pinValue: string) => {
    if (pinValue.length !== 4) return;
    setIsVerifying(true);
    setPinError(null);

    try {
      const res = await fetch("/api/user/pin/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageId, pin: pinValue }),
      });

      const data = await res.json();

      if (res.ok && data.verified) {
        onUnlock();
      } else {
        // Shake and reset PIN inputs
        setIsShaking(true);
        setPinError(data.error || "Incorrect PIN. Try again or recover via email.");
        setTimeout(() => {
          setIsShaking(false);
          setPinDigits(["", "", "", ""]);
          pinInputRefs.current[0]?.focus();
        }, 400);
      }
    } catch (err: any) {
      setPinError(err.message || "Failed to verify PIN. Please try again.");
      setPinDigits(["", "", "", ""]);
      pinInputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDigitChange = (index: number, value: string) => {
    // Only accept numeric single digit
    const cleaned = value.replace(/\D/g, "");
    if (!cleaned) {
      const updated = [...pinDigits];
      updated[index] = "";
      setPinDigits(updated);
      return;
    }

    const digit = cleaned[cleaned.length - 1];
    const updated = [...pinDigits];
    updated[index] = digit;
    setPinDigits(updated);
    setPinError(null);

    if (index < 3) {
      pinInputRefs.current[index + 1]?.focus();
    } else {
      // 4th digit filled: immediately verify! No need for enter key
      const fullPin = updated.join("");
      if (fullPin.length === 4) {
        verifyPinValue(fullPin);
      }
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !pinDigits[index] && index > 0) {
      pinInputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (!pasteData) return;

    const updated = ["", "", "", ""];
    for (let i = 0; i < pasteData.length; i++) {
      updated[i] = pasteData[i];
    }
    setPinDigits(updated);

    if (pasteData.length === 4) {
      verifyPinValue(pasteData);
    } else {
      pinInputRefs.current[pasteData.length]?.focus();
    }
  };

  // Dispatch 6-digit recovery code via SMTP
  const handleRequestRecovery = async () => {
    setIsSendingRecovery(true);
    setRecoveryError(null);
    try {
      const res = await fetch("/api/user/pin/recover", {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setRecoveryMessage(data.message || "Verification code dispatched to your email address.");
        setView("recovery");
        setResendCooldown(45);
      } else {
        setPinError(data.error || "Unable to dispatch recovery code at this time.");
      }
    } catch (err: any) {
      setPinError(err.message || "Network error while requesting recovery.");
    } finally {
      setIsSendingRecovery(false);
    }
  };

  // Recovery digits handlers
  const handleRecoveryDigitChange = (index: number, value: string) => {
    const cleaned = value.replace(/\D/g, "");
    if (!cleaned) {
      const updated = [...recoveryDigits];
      updated[index] = "";
      setRecoveryDigits(updated);
      return;
    }

    const digit = cleaned[cleaned.length - 1];
    const updated = [...recoveryDigits];
    updated[index] = digit;
    setRecoveryDigits(updated);
    setRecoveryError(null);

    if (index < 5) {
      recoveryInputRefs.current[index + 1]?.focus();
    } else {
      // 6th digit entered: auto-trigger recovery verification if not resetting pin
      const fullCode = updated.join("");
      if (fullCode.length === 6 && !resetPin) {
        verifyRecoveryCode(fullCode);
      }
    }
  };

  const handleRecoveryKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Backspace" && !recoveryDigits[index] && index > 0) {
      recoveryInputRefs.current[index - 1]?.focus();
    }
  };

  const handleRecoveryPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasteData) return;

    const updated = ["", "", "", "", "", ""];
    for (let i = 0; i < pasteData.length; i++) {
      updated[i] = pasteData[i];
    }
    setRecoveryDigits(updated);

    if (pasteData.length === 6 && !resetPin) {
      verifyRecoveryCode(pasteData);
    } else if (pasteData.length < 6) {
      recoveryInputRefs.current[pasteData.length]?.focus();
    }
  };

  const verifyRecoveryCode = async (codeValue: string) => {
    if (codeValue.length !== 6) {
      setRecoveryError("Please enter the complete 6-digit recovery code.");
      return;
    }

    let newPinStr: string | undefined = undefined;
    if (resetPin) {
      newPinStr = newPinDigits.join("");
      if (newPinStr.length !== 4) {
        setRecoveryError("Please provide a new 4-digit PIN.");
        return;
      }
    }

    setIsVerifyingRecovery(true);
    setRecoveryError(null);

    try {
      const res = await fetch("/api/user/pin/verify-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: codeValue,
          newPin: newPinStr,
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        onUnlock();
      } else {
        setRecoveryError(data.error || "Invalid or expired recovery code.");
      }
    } catch (err: any) {
      setRecoveryError(err.message || "Failed to verify recovery code.");
    } finally {
      setIsVerifyingRecovery(false);
    }
  };

  return (
    <div className="min-h-[500px] flex items-center justify-center p-6 bg-zinc-950/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900/95 p-6 shadow-2xl space-y-6 text-center animate-in fade-in zoom-in-95 duration-200">
        {/* Header Icon */}
        <div className="mx-auto w-14 h-14 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center shadow-inner">
          {view === "pin" ? (
            <Lock className={`w-7 h-7 text-amber-400 ${isVerifying ? "animate-pulse" : ""}`} />
          ) : (
            <Mail className="w-7 h-7 text-sky-400" />
          )}
        </div>

        {/* Title & Description */}
        <div className="space-y-1.5">
          <h2 className="text-base font-bold text-zinc-100 tracking-wide">
            {view === "pin" ? "Protected Document" : "Email Security Recovery"}
          </h2>
          <p className="text-xs text-zinc-400 line-clamp-2 px-2">
            {view === "pin"
              ? pageTitle
                ? `Enter 4-digit PIN to access "${pageTitle}"`
                : "Enter your 4-digit PIN to unlock this note"
              : "Enter the 6-digit code delivered to your registered email account to unlock."}
          </p>
        </div>

        {/* View 1: 4-Digit Instant PIN Challenge */}
        {view === "pin" && (
          <div className="space-y-5">
            <div
              className={`flex items-center justify-center gap-3 ${
                isShaking ? "animate-shake" : ""
              }`}
            >
              {pinDigits.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    pinInputRefs.current[index] = el;
                  }}
                  type="password"
                  inputMode="numeric"
                  maxLength={1}
                  disabled={isVerifying}
                  value={digit}
                  onChange={(e) => handleDigitChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  aria-label={`PIN Digit ${index + 1}`}
                  className="w-12 h-14 text-center text-xl font-bold font-mono rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-100 focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 transition-all disabled:opacity-50"
                />
              ))}
            </div>

            {pinError && (
              <div className="p-2.5 rounded-lg border border-rose-800/60 bg-rose-950/40 text-rose-300 text-xs flex items-center justify-center gap-1.5 animate-in fade-in">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            {isVerifying && (
              <div className="flex items-center justify-center gap-2 text-xs text-amber-400 animate-in fade-in">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Validating PIN...</span>
              </div>
            )}

            <div className="pt-2 border-t border-zinc-800/80 space-y-3">
              <button
                type="button"
                onClick={handleRequestRecovery}
                disabled={isSendingRecovery || isVerifying}
                className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors flex items-center justify-center gap-1.5 mx-auto disabled:opacity-50"
              >
                {isSendingRecovery ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <KeyRound className="w-3.5 h-3.5 text-zinc-400" />
                )}
                <span>Forgot PIN? Send recovery code to email</span>
              </button>

              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  className="text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
                >
                  Return to workspace
                </button>
              )}
            </div>
          </div>
        )}

        {/* View 2: Email Recovery Flow */}
        {view === "recovery" && (
          <div className="space-y-4 text-left">
            {recoveryMessage && (
              <div className="p-2.5 rounded-lg border border-sky-800/60 bg-sky-950/40 text-sky-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="leading-relaxed">{recoveryMessage}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-zinc-300 text-center">
                6-Digit Verification Code
              </label>
              <div className="flex items-center justify-center gap-2">
                {recoveryDigits.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => {
                      recoveryInputRefs.current[index] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    disabled={isVerifyingRecovery}
                    value={digit}
                    onChange={(e) => handleRecoveryDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleRecoveryKeyDown(index, e)}
                    onPaste={handleRecoveryPaste}
                    aria-label={`Recovery Code Digit ${index + 1}`}
                    className="w-10 h-12 text-center text-lg font-bold font-mono rounded-lg border border-zinc-700 bg-zinc-950 text-zinc-100 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 transition-all disabled:opacity-50"
                  />
                ))}
              </div>
            </div>

            {/* Option to set a new PIN during recovery */}
            <div className="pt-2 border-t border-zinc-800">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={resetPin}
                  onChange={(e) => setResetPin(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-sky-500 focus:ring-0"
                />
                <span>Set a new 4-digit PIN while unlocking</span>
              </label>

              {resetPin && (
                <div className="mt-3 p-3 rounded-xl border border-zinc-800 bg-zinc-950 space-y-2">
                  <label className="block text-[11px] font-semibold text-zinc-400 text-center">
                    New 4-Digit PIN
                  </label>
                  <div className="flex items-center justify-center gap-2">
                    {newPinDigits.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => {
                          newPinInputRefs.current[index] = el;
                        }}
                        type="password"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, "");
                          const updated = [...newPinDigits];
                          updated[index] = val ? val[val.length - 1] : "";
                          setNewPinDigits(updated);
                          if (val && index < 3) {
                            newPinInputRefs.current[index + 1]?.focus();
                          }
                        }}
                        aria-label={`New PIN Digit ${index + 1}`}
                        className="w-9 h-11 text-center text-base font-bold font-mono rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 focus:outline-none focus:border-sky-400"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            {recoveryError && (
              <div className="p-2.5 rounded-lg border border-rose-800/60 bg-rose-950/40 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{recoveryError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => verifyRecoveryCode(recoveryDigits.join(""))}
              disabled={isVerifyingRecovery || recoveryDigits.join("").length !== 6}
              className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 shadow-sm"
            >
              {isVerifyingRecovery ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5" />
              )}
              <span>Verify Code & Unlock Note</span>
            </button>

            <div className="pt-2 flex items-center justify-between text-xs text-zinc-400">
              <button
                type="button"
                onClick={() => {
                  setView("pin");
                  setRecoveryError(null);
                }}
                className="hover:text-zinc-200 transition-colors flex items-center gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to PIN</span>
              </button>

              <button
                type="button"
                onClick={handleRequestRecovery}
                disabled={resendCooldown > 0 || isSendingRecovery}
                className="hover:text-zinc-200 transition-colors disabled:opacity-50"
              >
                {resendCooldown > 0
                  ? `Resend code in ${resendCooldown}s`
                  : "Resend Code"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
