"use client";

import React, { useState, useEffect } from "react";
import { localDb, LocalPage } from "@/lib/dexie";
import { syncManager } from "@/lib/sync";
import { DocumentEditor } from "@/components/editor/DocumentEditor";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock } from "lucide-react";

export function DiaryView() {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [diaryPages, setDiaryPages] = useState<LocalPage[]>([]);
  const [currentPageId, setCurrentPageId] = useState<string | null>(null);

  const loadDiaryEntries = async () => {
    const pages = await localDb.pages.filter((p) => Boolean(p.isDiary) && !p.deletedAt).toArray();
    setDiaryPages(pages.sort((a, b) => new Date(b.diaryDate || 0).getTime() - new Date(a.diaryDate || 0).getTime()));

    // Find or create entry for selectedDate
    const existing = pages.find(
      (p) => p.diaryDate && new Date(p.diaryDate).toISOString().split("T")[0] === selectedDate
    );

    if (existing) {
      setCurrentPageId(existing.id);
    } else {
      // Auto-create diary entry for this date
      const newId = `diary_${selectedDate}_${Date.now()}`;
      const newDiary: LocalPage = {
        id: newId,
        title: `Operations Log - ${selectedDate}`,
        isDiary: true,
        diaryDate: new Date(selectedDate),
        workspaceId: pages[0]?.workspaceId || "default",
        content: {
          blocks: [
            { id: "d1", type: "heading", level: 2, text: `Daily Operations Log — ${selectedDate}` },
            { id: "d2", type: "check", checked: false, text: "Sprint standup & blocker review" },
            { id: "d3", type: "paragraph", text: "" },
          ],
        },
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await localDb.pages.put(newDiary);
      await syncManager.queueMutation("page", newId, "UPSERT", {
        title: newDiary.title,
        isDiary: true,
        diaryDate: newDiary.diaryDate,
        content: newDiary.content,
      });

      setCurrentPageId(newId);
      setDiaryPages([newDiary, ...pages]);
    }
  };

  useEffect(() => {
    loadDiaryEntries();
  }, [selectedDate]);

  const changeDateBy = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    setSelectedDate(current.toISOString().split("T")[0]);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-950 overflow-hidden">
      {/* Date Header Strip */}
      <div className="px-8 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarIcon className="w-4 h-4 text-zinc-500" />
          <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Operations Diary Timeline</h2>
          <span className="text-xs text-zinc-400">•</span>
          <span className="font-mono text-xs font-semibold text-zinc-600 dark:text-zinc-400">{selectedDate}</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => changeDateBy(-1)}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
            className="text-xs font-medium px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
          >
            Today
          </button>
          <button
            onClick={() => changeDateBy(1)}
            className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editor Canvas for this Diary Entry */}
      <div className="flex-1 overflow-y-auto">
        {currentPageId ? (
          <DocumentEditor key={currentPageId} pageId={currentPageId} />
        ) : (
          <div className="p-8 text-xs text-zinc-400">Loading daily log...</div>
        )}
      </div>
    </div>
  );
}
