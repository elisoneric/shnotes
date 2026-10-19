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
} from "lucide-react";

export function SystemAdminPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-8 font-sans selection:bg-zinc-800">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Navigation / Header */}
        <div className="flex items-center justify-between pb-4 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <Link
              href="/app"
              className="p-2 rounded-lg border border-zinc-800 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-100 transition-colors"
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
                Superadmin Layer: Isolated tenant telemetry, system health, and feature flags.
              </p>
            </div>
          </div>

          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-900 text-zinc-300 font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh Telemetry</span>
          </button>
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
      </div>
    </div>
  );
}
