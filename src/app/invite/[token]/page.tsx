"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ShieldCheck,
  User,
  Mail,
  Lock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileText,
  Building2,
  Users,
  Eye,
} from "lucide-react";

interface InviteInfo {
  token: string;
  role: string;
  allowGuest: boolean;
  isExpired: boolean;
  isAccepted: boolean;
  workspaceName: string;
  workspaceId: string;
  pageId: string | null;
  pageTitle: string | null;
  pageSecretToken: string | null;
}

export default function InviteAcceptPage() {
  const params = useParams();
  const token = params?.token as string;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form states for new user registration
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!token) return;

    fetch(`/api/invite/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Invite not found.");
        }
        setInvite(data.invite);
      })
      .catch((err) => {
        setError(err.message || "Invalid or expired invitation.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [token]);

  const handleAccept = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch(`/api/invite/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to accept invite.");
      }

      router.push(data.redirectUrl || "/app");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Failed to accept invitation.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center font-sans text-xs text-zinc-500">
        Loading collaboration invitation...
      </div>
    );
  }

  if (error && !invite) {
    return (
      <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-center py-12 px-6 lg:px-8 font-sans">
        <div className="sm:mx-auto sm:w-full sm:max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">Invalid or Expired Invite</h1>
          <p className="text-xs text-zinc-500">{error}</p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
            >
              <span>Return to Home</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const roleLabel =
    invite?.role === "CONTRIBUTOR" || invite?.role === "DEVELOPER"
      ? "Editor (Full editing rights)"
      : invite?.role === "REVIEWER_GUIDE" || invite?.role === "TECH_ASSISTANT"
      ? "Commenter (Reviewer & guidance)"
      : "Viewer (Read-only access)";

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col justify-center py-12 px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex items-center justify-center gap-2.5 mb-6">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center font-bold text-sm">
            {(invite?.workspaceName || "SH").slice(0, 2).toUpperCase()}
          </div>
          <div>
            <span className="font-bold text-base text-zinc-950 dark:text-zinc-50 leading-none block">
              {invite?.workspaceName}
            </span>
            <span className="text-[11px] text-zinc-400 font-medium">Collaboration Invitation</span>
          </div>
        </div>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 py-8 px-6 shadow-sm rounded-2xl sm:px-8 space-y-6">
          {/* Invitation Banner */}
          <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-900 dark:text-zinc-100">
              <Users className="w-4 h-4 text-amber-500" />
              <span>Workspace Collaboration</span>
            </div>
            {invite?.pageTitle && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                <span className="font-medium truncate">Note: {invite.pageTitle}</span>
              </div>
            )}
            <div className="text-[11px] text-zinc-500">
              Access level granted: <span className="font-semibold text-zinc-800 dark:text-zinc-200">{roleLabel}</span>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Guest Access Button (if permitted) */}
          {invite?.allowGuest && invite.pageSecretToken && (
            <div className="space-y-2">
              <Link
                href={`/shared/${invite.pageSecretToken}`}
                className="w-full py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Eye className="w-4 h-4 text-zinc-500" />
                <span>View Note Canvas as Guest</span>
              </Link>
              <div className="relative text-center py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
                </div>
                <span className="relative bg-white dark:bg-zinc-900 px-2 text-[10px] text-zinc-400 uppercase font-medium">
                  Or sign up to collaborate
                </span>
              </div>
            </div>
          )}

          {/* Registration Form to Accept Invite */}
          <form onSubmit={handleAccept} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Your Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full text-xs pl-9 pr-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm mt-4"
            >
              <span>{submitting ? "Joining Workspace..." : "Accept Invitation & Enter"}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 text-center text-xs text-zinc-500">
            <span>Already have an account? </span>
            <Link
              href="/login"
              className="font-semibold text-zinc-900 dark:text-zinc-100 hover:underline"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
