import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { FileText, Calendar, Lock } from "lucide-react";

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
    <div className="min-h-screen bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 antialiased selection:bg-zinc-200 dark:selection:bg-zinc-800">
      {/* Top Read-Only Bar */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur px-6 py-3 flex items-center justify-between text-xs text-zinc-500">
        <div className="flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-zinc-400" />
          <span>Encrypted Share View</span>
          <span>•</span>
          <span className="font-medium text-zinc-700 dark:text-zinc-300">{page.workspace.name}</span>
        </div>
        <div>Last updated: {new Date(page.updatedAt).toLocaleDateString()}</div>
      </header>

      {/* Main Content Article */}
      <main className="max-w-3xl mx-auto px-6 py-12">
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
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-zinc-950 dark:text-zinc-50 mb-8">
          {page.title}
        </h1>

        <div className="space-y-4 leading-relaxed text-zinc-700 dark:text-zinc-300">
          {blocks.length === 0 ? (
            <p className="italic text-zinc-400">This document has no content blocks.</p>
          ) : (
            blocks.map((block: any, idx: number) => {
              if (block.type === "heading") {
                if (block.level === 1) {
                  return (
                    <h2 key={block.id || idx} className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 pt-6 pb-2">
                      {block.text}
                    </h2>
                  );
                }
                if (block.level === 2) {
                  return (
                    <h3 key={block.id || idx} className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 pt-4 pb-1">
                      {block.text}
                    </h3>
                  );
                }
                return (
                  <h4 key={block.id || idx} className="text-lg font-medium text-zinc-800 dark:text-zinc-200 pt-2">
                    {block.text}
                  </h4>
                );
              }

              if (block.type === "bullet") {
                return (
                  <div key={block.id || idx} className="flex items-start gap-2 pl-2">
                    <span className="text-zinc-400 select-none">•</span>
                    <span>{block.text}</span>
                  </div>
                );
              }

              if (block.type === "check") {
                return (
                  <div key={block.id || idx} className="flex items-center gap-3 pl-2">
                    <input
                      type="checkbox"
                      checked={Boolean(block.checked)}
                      readOnly
                      className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-800 focus:ring-0 cursor-default"
                    />
                    <span className={block.checked ? "line-through text-zinc-400 dark:text-zinc-500" : ""}>
                      {block.text}
                    </span>
                  </div>
                );
              }

              if (block.type === "callout") {
                return (
                  <div
                    key={block.id || idx}
                    className="p-4 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-medium text-zinc-800 dark:text-zinc-200"
                  >
                    {block.text}
                  </div>
                );
              }

              if (block.type === "quote") {
                return (
                  <blockquote
                    key={block.id || idx}
                    className="border-l-4 border-zinc-300 dark:border-zinc-700 pl-4 italic text-zinc-600 dark:text-zinc-400 my-2"
                  >
                    {block.text}
                  </blockquote>
                );
              }

              if (block.type === "code") {
                return (
                  <pre
                    key={block.id || idx}
                    className="p-4 rounded-lg bg-zinc-950 text-zinc-100 font-mono text-xs overflow-x-auto border border-zinc-800"
                  >
                    <code>{block.text}</code>
                  </pre>
                );
              }

              if (block.type === "divider") {
                return <hr key={block.id || idx} className="border-t border-zinc-200 dark:border-zinc-800 my-6" />;
              }

              return (
                <p key={block.id || idx} className="leading-relaxed">
                  {block.text}
                </p>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
