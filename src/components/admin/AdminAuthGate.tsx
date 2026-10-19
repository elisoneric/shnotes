"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, Lock, ArrowRight, AlertTriangle, RefreshCw, KeyRound, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { SystemAdminPage } from "@/components/admin/SystemAdminPage";

export function AdminAuthGate() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  // Login form state
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const checkAdminStatus = async () => {
    setChecking(true);
    setAuthError(null);
    try {
      const res = await fetch("/api/admin/system");
      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setIsAdmin(true);
          return;
        }
      }
      setIsAdmin(false);
    } catch {
      setIsAdmin(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier || !password) {
      setAuthError("Username or email and password are required.");
      return;
    }

    setSubmitting(true);
    setAuthError(null);

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: identifier,
          username: identifier,
          password,
        }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        setIsAdmin(true);
      } else {
        setAuthError(data.error || "Authentication failed. Verify root credentials.");
      }
    } catch (err: any) {
      setAuthError(err.message || "Failed to connect to authentication server.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
      setIsAdmin(false);
    } catch {
      setIsAdmin(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
        <div className="flex items-center gap-2 text-zinc-400 text-xs">
          <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
          <span>Verifying administrator authorization...</span>
        </div>
      </div>
    );
  }

  if (isAdmin) {
    return <SystemAdminPage onSignOut={handleLogout} />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-center items-center p-4 sm:p-6 font-sans selection:bg-zinc-800">
      <div className="w-full max-w-md space-y-6">
        {/* Back Link */}
        <div className="flex items-center justify-between">
          <Link
            href="/login"
            className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Workspace Login</span>
          </Link>
          <span className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 border border-zinc-800 bg-zinc-900/60 px-2 py-0.5 rounded">
            Restricted Zone
          </span>
        </div>

        {/* Shield Container */}
        <div className="border border-zinc-800 bg-zinc-900/60 rounded-2xl p-6 sm:p-8 backdrop-blur-md shadow-2xl space-y-6">
          <div className="space-y-2 text-center">
            <div className="w-12 h-12 rounded-xl bg-zinc-800 border border-zinc-700/80 flex items-center justify-center mx-auto text-indigo-400 shadow-inner">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="text-lg font-bold text-zinc-100 tracking-tight">
              ShNotes System Administration
            </h1>
            <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
              Isolated superadmin console for infrastructure telemetry, SMTP delivery, and platform management.
            </p>
          </div>

          {authError && (
            <div className="p-3.5 rounded-xl border border-rose-800/80 bg-rose-950/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                Administrator Identifier
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 font-mono transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                Password
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 font-mono transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full text-xs font-semibold py-2.5 px-4 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            >
              {submitting ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <KeyRound className="w-3.5 h-3.5" />
              )}
              <span>{submitting ? "Authenticating..." : "Unlock Administrator Console"}</span>
            </button>
          </form>

          <div className="pt-2 border-t border-zinc-800/80 text-center">
            <p className="text-[11px] text-zinc-400">
              Configured via <code className="text-zinc-300 font-mono">ADMIN_EMAIL</code> and <code className="text-zinc-300 font-mono">ADMIN_PASSWORD</code>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
