"use client";

import React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  Wifi,
  Sparkles,
  ArrowRight,
  Layers,
  FileText,
  Smartphone,
  Monitor,
  Terminal,
  FolderGit2,
  Users,
  BadgeCheck,
} from "lucide-react";

interface LandingPageProps {
  isAuthenticated?: boolean;
}

export function LandingPage({ isAuthenticated = false }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 font-sans selection:bg-zinc-200 dark:selection:bg-zinc-800">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center font-bold text-sm tracking-wider">
              SH
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-zinc-950 dark:text-zinc-50">ShNotes</span>
              <span className="text-xs text-zinc-400 font-medium ml-2 hidden sm:inline">Workspace & Notes</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                href="/app"
                className="text-xs font-semibold px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 transition-opacity shadow-sm flex items-center gap-1.5"
              >
                <span>Enter Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-xs font-semibold px-4 py-2 rounded-lg text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-50 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="text-xs font-semibold px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 transition-opacity shadow-sm flex items-center gap-1.5"
                >
                  <span>Create Workspace</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-6 pt-20 pb-16 max-w-5xl mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-xs text-zinc-600 dark:text-zinc-400 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-zinc-500" />
          <span>Self-Hosted Workspace & Task Management</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-zinc-950 dark:text-zinc-50 max-w-4xl mx-auto leading-tight">
          Clean Notes & Stress-Free Tasking.
        </h1>

        <p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          Unifying Notion-style document canvases with fast 3-stage task tracking, zero-latency local-first offline synchronization, and native Indunix AI.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
          <Link
            href="/signup"
            className="text-sm font-semibold px-6 py-3 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 transition-all shadow-md flex items-center gap-2"
          >
            <span>Start Free Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/login"
            className="text-sm font-semibold px-6 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-800 dark:text-zinc-200 transition-colors"
          >
            Sign In to Existing Workspace
          </Link>
        </div>
      </section>

      {/* The 7-Stage Pipeline Visualizer */}
      <section className="px-6 py-12 max-w-5xl mx-auto">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-zinc-950 dark:text-zinc-50">
                The 7-Stage Governed Task Lifecycle
              </h2>
              <p className="text-xs text-zinc-500">
                Transparent Ball-in-Court accountability eliminates vague requirements and unverified releases.
              </p>
            </div>
            <span className="text-xs font-mono font-medium text-zinc-400">Strict Sign-off Pipeline</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-1">
              <span className="font-mono text-[10px] text-zinc-400 font-bold uppercase">1. Proposed</span>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Objective & Requirements</h3>
              <p className="text-[11px] text-zinc-500">Logged by Initiator with operational need and business rationale.</p>
            </div>

            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-1">
              <span className="font-mono text-[10px] text-zinc-400 font-bold uppercase">2. Under Review</span>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Guidance & Triage</h3>
              <p className="text-[11px] text-zinc-500">Project Guide inspects dependencies and verifies scope.</p>
            </div>

            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-1">
              <span className="font-mono text-[10px] text-zinc-400 font-bold uppercase">3. Plan & Scope</span>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Architecture Proposal</h3>
              <p className="text-[11px] text-zinc-500">Specialist submits execution methodology and estimated timeline.</p>
            </div>

            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-1">
              <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">4. Confirmed</span>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Scope Locked</h3>
              <p className="text-[11px] text-zinc-500">Stakeholder formally approves proposal; active development begins.</p>
            </div>

            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-1">
              <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase">5. In Progress</span>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Active Execution</h3>
              <p className="text-[11px] text-zinc-500">Scope is frozen; active development and implementation occurs.</p>
            </div>

            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-1">
              <span className="font-mono text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase">6. Verification</span>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Deliverables & Staging</h3>
              <p className="text-[11px] text-zinc-500">Preview links, credentials, and evidence criteria submitted.</p>
            </div>

            <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-1 sm:col-span-2">
              <span className="font-mono text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">7. Completed & Approved</span>
              <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">Final Acceptance Sign-off</h3>
              <p className="text-[11px] text-zinc-500">Authorized project owner signs off and archives task with permanent ledger record.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section className="px-6 py-16 max-w-5xl mx-auto space-y-12">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            Engineered for Independence & Reliability
          </h2>
          <p className="text-sm text-zinc-500 max-w-xl mx-auto">
            Zero third-party cloud analytics, zero external tracking fonts, 100% self-hosted on Coolify with persistent storage.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <Wifi className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">100% Offline-First</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Every edit, task transition, and document note writes instantly to IndexedDB with 0ms latency. Queued outbox mutations sync automatically when connectivity returns.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-500" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Indunix AI Copilot</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Native triggers to draft technical architecture plans, generate step-by-step acceptance checklists, and summarize 20+ comment threads with live RAG workspace context.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <Lock className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Secret Token Sharing</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Publish any document or operations log to a cryptographic 256-bit URL for read-only viewing without requiring reader accounts or passwords.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <FileText className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Notion Block Canvas</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Interactive document canvas supporting slash commands, checklists, code snippets, callouts, and daily operations logs with timeline navigation.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <Monitor className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Native Windows Client</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Ultra-lightweight native client compiled via Tauri v2 under 15 MB footprint, consuming just 35 MB RAM via Windows WebView2.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Mobile PWA & TWA</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Full-screen standalone execution with an iOS onboarding guide and Android TWA packaging for direct home screen installation.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-8 text-center text-xs text-zinc-400">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center font-bold text-[10px]">
              SH
            </div>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">ShNotes</span>
            <span>•</span>
            <span>Self-Hosted Workspace & Notes Platform</span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              Sign In
            </Link>
            <Link href="/signup" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              Create Workspace
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
