import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { FileText, Calendar, Lock, Sparkles, ArrowRight, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

interface SharedPageProps {
  params: Promise<{ token: string }>;
}

export default async function SharedDocPage({ params }: SharedPageProps) {
  const { token } = await params;
  if (!token) return notFound();

  const page = await prisma.page.findUnique({
    where: { secretToken: token },
    include: { workspace: true },
  });

  if (!page || page.deletedAt) {
    return notFound();
  }

  const blocks = (page.content as any)?.blocks || [];

  return (
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 antialiased selection:bg-zinc-200 dark:selection:bg-zinc-800 flex flex-col">
      {/* Top Read-Only Bar */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/90 backdrop-blur px-4 sm:px-8 py-3 flex items-center justify-between text-xs sticky top-0 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 shrink-0">
            <Lock className="w-3.5 h-3.5" />
          </div>
          <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{page.workspace.name}</span>
          <span className="text-zinc-300 dark:text-zinc-700 hidden sm:inline">•</span>
          <span className="text-zinc-500 hidden sm:inline">View Only</span>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <Link
            href="/login"
            className="text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors hidden sm:inline"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 transition-opacity shadow-xs flex items-center gap-1.5"
          >
            <span>Sign Up</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </header>

      {/* Main Content Article */}
      <main className="max-w-3xl w-full mx-auto px-4 sm:px-8 py-8 sm:py-12 flex-1">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-zinc-400 mb-3">
          {page.isDiary ? (
            <>
              <Calendar className="w-4 h-4" />
              <span>Operations Diary</span>
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              <span>Document</span>
            </>
          )}
          <span>•</span>
          <span>Last modified {new Date(page.updatedAt).toLocaleDateString()}</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 mb-8 break-words leading-tight">
          {page.title}
        </h1>

        <div className="space-y-4 leading-relaxed text-zinc-800 dark:text-zinc-200 text-sm sm:text-base">
          {blocks.length === 0 ? (
            <p className="italic text-zinc-400">This document has no content blocks.</p>
          ) : (
            blocks.map((block: any, idx: number) => {
              if (block.type === "heading") {
                if (block.level === 1) {
                  return (
                    <h2
                      key={block.id || idx}
                      className="text-2xl sm:text-3xl font-bold text-zinc-950 dark:text-zinc-50 pt-6 pb-1 whitespace-pre-wrap break-words leading-snug"
                    >
                      {block.text}
                    </h2>
                  );
                }
                if (block.level === 2) {
                  return (
                    <h3
                      key={block.id || idx}
                      className="text-xl sm:text-2xl font-semibold text-zinc-950 dark:text-zinc-50 pt-4 pb-1 whitespace-pre-wrap break-words leading-snug"
                    >
                      {block.text}
                    </h3>
                  );
                }
                return (
                  <h4
                    key={block.id || idx}
                    className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 pt-2 whitespace-pre-wrap break-words leading-snug"
                  >
                    {block.text}
                  </h4>
                );
              }

              if (block.type === "bullet") {
                return (
                  <div key={block.id || idx} className="flex items-start gap-2.5 pl-2 leading-relaxed">
                    <span className="text-zinc-400 select-none mt-1">•</span>
                    <span className="whitespace-pre-wrap break-words flex-1">{block.text}</span>
                  </div>
                );
              }

              if (block.type === "check") {
                return (
                  <div key={block.id || idx} className="flex items-start gap-3 pl-2 leading-relaxed">
                    <input
                      type="checkbox"
                      checked={Boolean(block.checked)}
                      readOnly
                      className="mt-1 rounded border-zinc-300 dark:border-zinc-700 text-zinc-800 focus:ring-0 cursor-default"
                    />
                    <span
                      className={`whitespace-pre-wrap break-words flex-1 ${
                        block.checked ? "line-through text-zinc-400 dark:text-zinc-500" : ""
                      }`}
                    >
                      {block.text}
                    </span>
                  </div>
                );
              }

              if (block.type === "callout") {
                return (
                  <div
                    key={block.id || idx}
                    className="p-4 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs sm:text-sm font-medium text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap break-words"
                  >
                    {block.text}
                  </div>
                );
              }

              if (block.type === "quote") {
                return (
                  <blockquote
                    key={block.id || idx}
                    className="border-l-4 border-zinc-300 dark:border-zinc-700 pl-4 italic text-zinc-600 dark:text-zinc-400 my-2 whitespace-pre-wrap break-words"
                  >
                    {block.text}
                  </blockquote>
                );
              }

              if (block.type === "code") {
                return (
                  <pre
                    key={block.id || idx}
                    className="p-4 rounded-xl bg-zinc-950 text-zinc-100 font-mono text-xs overflow-x-auto border border-zinc-800 whitespace-pre-wrap break-words"
                  >
                    <code>{block.text}</code>
                  </pre>
                );
              }

              if (block.type === "image" && block.url) {
                return (
                  <div key={block.id || idx} className="my-6 space-y-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={block.url}
                      alt={block.text || "Attached Picture"}
                      className="w-full max-h-[600px] object-contain rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
                      loading="lazy"
                    />
                    {block.text && (
                      <p className="text-center text-xs text-zinc-500 dark:text-zinc-400 italic">
                        {block.text}
                      </p>
                    )}
                  </div>
                );
              }

              if (block.type === "divider") {
                return <hr key={block.id || idx} className="border-t border-zinc-200 dark:border-zinc-800 my-6" />;
              }

              // Standard paragraph: if empty, render a neat spacing line
              if (!block.text || block.text.trim() === "") {
                return <div key={block.id || idx} className="h-4" />;
              }

              return (
                <p key={block.id || idx} className="leading-relaxed whitespace-pre-wrap break-words">
                  {block.text}
                </p>
              );
            })
          )}
        </div>

        {/* Call to Action: Sign Up for Full Access */}
        <div className="mt-16 pt-8 border-t border-zinc-200 dark:border-zinc-800">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-zinc-50 via-white to-zinc-100/60 dark:from-zinc-900/90 dark:via-zinc-900/60 dark:to-zinc-950 p-6 sm:p-8 text-center space-y-4 shadow-sm">
            <div className="inline-flex p-3 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>

            <div className="space-y-1.5 max-w-md mx-auto">
              <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
                Collaborate & build in ShNotes
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Experience fast offline-first notes, visual task boards, and effortless team collaboration with ShNotes.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2 max-w-sm mx-auto">
              <Link
                href="/signup"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm flex items-center justify-center gap-2"
              >
                <span>Create Workspace — Free</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
              <Link
                href="/login"
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center"
              >
                Sign In
              </Link>
            </div>

            <div className="flex items-center justify-center gap-4 text-[11px] text-zinc-400 pt-2">
              <div className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                <span>Zero configuration</span>
              </div>
              <span>•</span>
              <div>Instant offline access</div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 py-6 text-center text-xs text-zinc-400">
        Powered by ShNotes Enterprise Workspace
      </footer>
    </div>
  );
}
