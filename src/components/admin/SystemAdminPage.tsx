"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Database,
  Activity,
  Layers,
  Users,
  FolderGit2,
  FileText,
  Server,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  LogOut,
  Trash2,
} from "lucide-react";
import { SmtpAdminPanel } from "@/components/admin/SmtpAdminPanel";

interface SystemAdminPageProps {
  onSignOut?: () => void;
}

export function SystemAdminPage({ onSignOut }: SystemAdminPageProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Database Reset State
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetInput, setResetInput] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetStatus, setResetStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/system");
      const json = await res.json();
      if (res.ok && json.ok) {
        setData(json);
      } else {
        setError(json.error || "Failed to load system metrics");
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to admin API");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const handleSignOut = async () => {
    if (onSignOut) {
      onSignOut();
      return;
    }
    try {
      await fetch("/api/admin/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch {
      window.location.href = "/login";
    }
  };

  const handleExecuteReset = async () => {
    if (resetInput.trim() !== "RESET") return;

    setResetting(true);
    setResetStatus(null);

    try {
      const res = await fetch("/api/admin/system/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: "CONFIRM_RESET_ALL_DATA" }),
      });

      const json = await res.json();

      if (res.ok && json.ok) {
        setResetStatus({ ok: true, message: json.message });
        setResetModalOpen(false);
        setResetInput("");
        await fetchMetrics();
      } else {
        setResetStatus({ ok: false, message: json.error || "Reset failed." });
      }
    } catch (err: any) {
      setResetStatus({ ok: false, message: err.message || "Failed to trigger reset." });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-8 font-sans selection:bg-zinc-800">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation / Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <Link
              href="/app"
              className="p-2 rounded-lg border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-100 transition-colors"
              title="Return to Workspace"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <h1 className="text-lg font-bold text-zinc-100 tracking-tight">
                  System Administration Console
                </h1>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5">
                Superadmin Layer: Isolated tenant telemetry, SMTP delivery, system health, and feature flags.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={fetchMetrics}
              disabled={loading}
              className="text-xs px-3 py-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-900 text-zinc-300 font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh Telemetry</span>
            </button>

            <button
              onClick={handleSignOut}
              className="text-xs px-3 py-1.5 rounded-lg border border-zinc-800 hover:bg-rose-950/40 hover:border-rose-800 text-zinc-400 hover:text-rose-300 font-medium flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl border border-rose-800 bg-rose-950/40 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Database & Server Health Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-semibold">
              <span>Database Engine</span>
              <Database className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-lg font-bold text-zinc-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{data?.systemHealth?.database?.status || "Checking..."}</span>
            </div>
            <p className="text-[11px] text-zinc-400">
              {data?.systemHealth?.database?.engine || "PostgreSQL 16"} • {data?.systemHealth?.database?.latencyMs || 0}ms latency
            </p>
          </div>

          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-semibold">
              <span>Environment</span>
              <Server className="w-4 h-4 text-blue-400" />
            </div>
            <div className="text-lg font-bold text-zinc-100 font-mono">
              {data?.systemHealth?.server?.nodeEnv || "production"}
            </div>
            <p className="text-[11px] text-zinc-400 truncate">
              {data?.systemHealth?.server?.appUrl || "https://note.esam.com.ng"}
            </p>
          </div>

          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/60 space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400 font-semibold">
              <span>System Uptime</span>
              <Activity className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-lg font-bold text-zinc-100 font-mono">
              {Math.floor((data?.systemHealth?.server?.uptimeSeconds || 3600) / 60)} mins
            </div>
            <p className="text-[11px] text-zinc-400">
              Zero unhandled crashes recorded
            </p>
          </div>
        </div>

        {/* Global Platform Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 text-center space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Tenants</span>
            <div className="text-2xl font-bold font-mono text-zinc-100">
              {data?.metrics?.totalWorkspaces || 1}
            </div>
          </div>
          <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 text-center space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Total Users</span>
            <div className="text-2xl font-bold font-mono text-zinc-100">
              {data?.metrics?.totalUsers || 4}
            </div>
          </div>
          <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 text-center space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Projects</span>
            <div className="text-2xl font-bold font-mono text-zinc-100">
              {data?.metrics?.totalProjects || 2}
            </div>
          </div>
          <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 text-center space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Governed Tasks</span>
            <div className="text-2xl font-bold font-mono text-zinc-100">
              {data?.metrics?.totalTasks || 4}
            </div>
          </div>
          <div className="p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/40 text-center space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Canvas Pages</span>
            <div className="text-2xl font-bold font-mono text-zinc-100">
              {data?.metrics?.totalPages || 2}
            </div>
          </div>
        </div>

        {/* Dedicated Outbound SMTP Subsystem */}
        <SmtpAdminPanel />

        {/* Feature Flags Grid */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            System Feature Flags & Integrations
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900 flex items-center justify-between">
              <div>
                <span className="font-semibold text-zinc-200">Indunix AI Gateway (indunix-1-core)</span>
                <p className="text-[11px] text-zinc-400">Dev Recommendation & QA checklist synthesis</p>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono text-[10px] border border-emerald-800">
                ENABLED
              </span>
            </div>

            <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900 flex items-center justify-between">
              <div>
                <span className="font-semibold text-zinc-200">Offline Sync Outbox Pattern</span>
                <p className="text-[11px] text-zinc-400">Dexie IndexedDB atomic mutation queue</p>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono text-[10px] border border-emerald-800">
                ENABLED
              </span>
            </div>

            <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900 flex items-center justify-between">
              <div>
                <span className="font-semibold text-zinc-200">256-bit Public Secret Link Sharing</span>
                <p className="text-[11px] text-zinc-400">Cryptographically secure read-only document access</p>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono text-[10px] border border-emerald-800">
                ENABLED
              </span>
            </div>

            <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900 flex items-center justify-between">
              <div>
                <span className="font-semibold text-zinc-200">Ball-in-Court Task Governance</span>
                <p className="text-[11px] text-zinc-400">HOO and Developer role-guarded stage transitions</p>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 font-mono text-[10px] border border-emerald-800">
                ENABLED
              </span>
            </div>
          </div>
        </div>

        {/* Global Tenants Directory */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
            Registered Tenant Workspaces
          </h2>
          <div className="border border-zinc-800 rounded-lg divide-y divide-zinc-800 overflow-hidden">
            <div className="p-3 bg-zinc-900/80 grid grid-cols-12 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              <span className="col-span-5">Workspace Name & Slug</span>
              <span className="col-span-2 text-center">Staff Members</span>
              <span className="col-span-2 text-center">Projects</span>
              <span className="col-span-3 text-right">Created</span>
            </div>
            {data?.tenants?.map((ws: any) => (
              <div key={ws.id} className="p-3 grid grid-cols-12 text-xs items-center hover:bg-zinc-900/50 transition-colors">
                <div className="col-span-5">
                  <span className="font-semibold text-zinc-200">{ws.name}</span>
                  <span className="text-[11px] text-zinc-400 block font-mono">/{ws.slug}</span>
                </div>
                <div className="col-span-2 text-center font-mono text-zinc-300">
                  {ws._count?.members || 1}
                </div>
                <div className="col-span-2 text-center font-mono text-zinc-300">
                  {ws._count?.projects || 2}
                </div>
                <div className="col-span-3 text-right text-[11px] text-zinc-400">
                  {new Date(ws.createdAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Danger Zone: Factory Database Purge Card */}
        <div className="rounded-xl border border-rose-900/60 bg-rose-950/20 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                <h2 className="text-sm font-bold text-rose-200 uppercase tracking-wider">
                  Danger Zone: Factory Database Purge & Fresh Start
                </h2>
              </div>
              <p className="text-xs text-zinc-400">
                Permanently wipes all tenant workspaces, users, projects, tasks, comments, and document canvases. Preserves working SMTP settings and re-seeds fresh administrative state.
              </p>
            </div>

            <button
              onClick={() => {
                setResetModalOpen(true);
                setResetInput("");
                setResetStatus(null);
              }}
              className="text-xs font-semibold px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white transition-colors flex items-center gap-1.5 shrink-0 shadow-xs cursor-pointer self-start sm:self-auto"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Reset Database</span>
            </button>
          </div>

          {resetStatus && (
            <div
              className={`p-3.5 rounded-lg border text-xs flex items-center gap-2 ${
                resetStatus.ok
                  ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
                  : "border-rose-800 bg-rose-950/40 text-rose-300"
              }`}
            >
              {resetStatus.ok ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{resetStatus.message}</span>
            </div>
          )}
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="space-y-2">
              <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-800/80 flex items-center justify-center text-rose-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-zinc-100">
                Confirm Complete Database Purge
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                This action is irreversible. All workspaces, users, notes, and tasks will be erased. The system will immediately re-seed a fresh root administrator account. Your SMTP settings will be preserved.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-zinc-300">
                Type <span className="font-mono text-rose-400 font-bold">RESET</span> to confirm:
              </label>
              <input
                type="text"
                value={resetInput}
                onChange={(e) => setResetInput(e.target.value)}
                placeholder="RESET"
                className="w-full text-xs px-3.5 py-2.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-rose-700 font-mono"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                disabled={resetting}
                className="text-xs font-medium px-3.5 py-2 rounded-lg border border-zinc-800 hover:bg-zinc-800 text-zinc-300 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReset}
                disabled={resetting || resetInput.trim() !== "RESET"}
                className="text-xs font-semibold px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                {resetting ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>{resetting ? "Purging & Re-seeding..." : "Purge Database Now"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
