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
  FileText,
  Smartphone,
  Columns3,
  Calendar,
  Share2,
  Zap,
  Check,
  Laptop,
} from "lucide-react";

interface LandingPageProps {
  isAuthenticated?: boolean;
}

export function LandingPage({ isAuthenticated = false }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 font-sans selection:bg-zinc-200 dark:selection:bg-zinc-800">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-40 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur px-4 sm:px-8 py-3.5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center font-bold text-sm tracking-wider">
              SH
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-zinc-950 dark:text-zinc-50">ShNotes</span>
              <span className="text-xs text-zinc-400 font-medium ml-2 hidden sm:inline">Workspace for Notes & Tasks</span>
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
                  className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 px-3 py-1.5 transition-colors hidden sm:inline-block"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="text-xs font-semibold px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 transition-opacity shadow-sm flex items-center gap-1.5"
                >
                  <span>Get Started Free</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-4 sm:px-6 pt-16 sm:pt-24 pb-16 max-w-4xl mx-auto text-center space-y-6">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-xs text-zinc-600 dark:text-zinc-400 font-medium shadow-xs">
          <Zap className="w-3.5 h-3.5 text-amber-500" />
          <span>Fast • Local-First • Frictionless Sharing</span>
        </div>

        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-zinc-950 dark:text-zinc-50 leading-[1.15]">
          Where ideas turn into clear notes and finished tasks.
        </h1>

        <p className="text-sm sm:text-lg text-zinc-600 dark:text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          A distraction-free canvas for your docs, daily thoughts, and project tasks. Built local-first for zero-latency writing, background synchronization, and instant link sharing.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          <Link
            href="/signup"
            className="w-full sm:w-auto text-sm font-semibold px-6 py-3 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 transition-all shadow-md flex items-center justify-center gap-2"
          >
            <span>Start Free Workspace</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/login"
            className="w-full sm:w-auto text-sm font-semibold px-6 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-800 dark:text-zinc-200 transition-colors flex items-center justify-center"
          >
            Sign In to Existing Workspace
          </Link>
        </div>

        <div className="pt-4 flex items-center justify-center gap-4 sm:gap-6 text-xs text-zinc-400">
          <div className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-500" />
            <span>0ms local latency</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-500" />
            <span>Offline-first storage</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5 text-emerald-500" />
            <span>Zero cloud tracking</span>
          </div>
        </div>
      </section>

      {/* Visual Product Showcase: Document Canvas + Task Flow */}
      <section className="px-4 sm:px-6 py-8 max-w-6xl mx-auto">
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/40 p-4 sm:p-6 shadow-xl space-y-4">
          {/* Simulated App Header */}
          <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
              <span className="ml-2 font-mono text-[11px] text-zinc-500 hidden sm:inline">ShNotes Workspace</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[10px] font-semibold">
                Saved & Synced (0ms)
              </span>
            </div>
          </div>

          {/* Interactive Split Mockup: Canvas on Left, Tasks on Right */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 pt-2">
            {/* Note Canvas View */}
            <div className="lg:col-span-7 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-zinc-400" />
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Product Specification & Launch Notes</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                  <Share2 className="w-3 h-3 text-emerald-500" />
                  <span>Shared</span>
                </div>
              </div>

              <div className="space-y-3 text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-sans">
                <h3 className="text-base font-bold text-zinc-950 dark:text-zinc-50">
                  Q4 Release Architecture
                </h3>
                <p className="text-zinc-500 dark:text-zinc-400">
                  A high-craft documentation canvas built with markdown shortcuts, nested checklists, and offline persistence.
                </p>

                <div className="space-y-2 pt-1">
                  <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Compile native Tauri v2 lightweight desktop shell</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span>Cryptographic 256-bit instant collaboration link sharing</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-500 line-through">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500/60 shrink-0" />
                    <span>Zero-latency local outbox mutation queue</span>
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 font-mono text-[11px] text-zinc-600 dark:text-zinc-400">
                  <span>/tasks convert line to trackable kanban item</span>
                </div>
              </div>
            </div>

            {/* Task Flow View */}
            <div className="lg:col-span-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <Columns3 className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Active Task Flow</span>
                </div>
                <span className="text-[10px] font-mono text-zinc-400">3 Open</span>
              </div>

              <div className="space-y-2.5">
                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-mono text-zinc-400 font-bold">DEV-101</span>
                    <span className="px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-medium">In Progress</span>
                  </div>
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">PWA standalone responsive shell</p>
                  <p className="text-[11px] text-zinc-500">Optimized for smooth mobile gestures and safe viewport areas.</p>
                </div>

                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-mono text-zinc-400 font-bold">DOC-104</span>
                    <span className="px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 font-medium">Review</span>
                  </div>
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">Secret token document publishing</p>
                  <p className="text-[11px] text-zinc-500">Read-only link generation with multi-line text preservation.</p>
                </div>

                <div className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 space-y-1.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-mono text-zinc-400 font-bold">SYNC-108</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-medium">Done</span>
                  </div>
                  <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">IndexedDB local mutation queue</p>
                  <p className="text-[11px] text-zinc-500">Instant offline read and write mutations with auto sync.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid: 6 Pillars */}
      <section className="px-4 sm:px-6 py-16 max-w-5xl mx-auto space-y-12">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50">
            Designed for Speed, Focus & Simplicity
          </h2>
          <p className="text-sm text-zinc-500 max-w-xl mx-auto">
            Everything you need to write notes and organize daily tasks without the clutter of heavyweight enterprise software.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Card 1 */}
          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <FileText className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Block Canvas Notes</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Slash commands, checklists, quotes, code blocks, attached pictures, and custom typography (Sans, Serif, Mono).
            </p>
          </div>

          {/* Card 2 */}
          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <Columns3 className="w-5 h-5 text-blue-500" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Visual Task Boards</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Move effortlessly from taking notes to tracking execution. Drag, filter, and organize tasks across fluid stages.
            </p>
          </div>

          {/* Card 3 */}
          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <Wifi className="w-5 h-5 text-emerald-500" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">100% Offline-First</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Every keystroke and task change saves instantly to local IndexedDB. Works on flights, commutes, and poor connections.
            </p>
          </div>

          {/* Card 4 */}
          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <Share2 className="w-5 h-5 text-purple-500" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">1-Click Link Sharing</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Create instant collaboration links with custom viewer or editor permissions, or publish to private web links.
            </p>
          </div>

          {/* Card 5 */}
          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-500" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Indunix AI Copilot</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Smart assistant to outline plans, summarize lengthy threads, and generate actionable checklists with live context.
            </p>
          </div>

          {/* Card 6 */}
          <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 space-y-3 shadow-xs">
            <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-indigo-500" />
            </div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Daily Operations Diary</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              Timeline view for daily standups, operational diaries, and quick notes organized chronologically by date.
            </p>
          </div>
        </div>
      </section>

      {/* Call to Action Section */}
      <section className="px-4 sm:px-6 py-16 max-w-4xl mx-auto">
        <div className="rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-900 dark:via-zinc-900/60 dark:to-zinc-950 p-8 sm:p-12 text-center space-y-6 shadow-sm">
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-zinc-950 dark:text-zinc-50">
            Ready to write and organize with speed?
          </h2>
          <p className="text-sm sm:text-base text-zinc-600 dark:text-zinc-400 max-w-lg mx-auto leading-relaxed">
            Create your workspace in seconds. Free, local-first, and private.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/signup"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs sm:text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm flex items-center justify-center gap-2"
            >
              <span>Create Free Workspace</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-6 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs sm:text-sm font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 px-4 sm:px-8 py-8 text-xs text-zinc-400">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center font-bold text-[10px]">
              SH
            </div>
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">ShNotes</span>
            <span>•</span>
            <span>Clean Notes & Visual Tasks</span>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              Sign In
            </Link>
            <Link href="/signup" className="hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors">
              Create Workspace
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
