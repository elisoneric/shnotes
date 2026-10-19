"use client";

import React from "react";
import { LocalTask } from "@/lib/dexie";
import { TaskPriority, TaskStage } from "@prisma/client";
import {
  Clock,
  User,
  AlertCircle,
  CheckCircle2,
  Code2,
  FileCheck2,
  MessageSquare,
} from "lucide-react";

interface TaskCardProps {
  task: LocalTask;
  onClick: () => void;
  commentCount?: number;
}

export function TaskCard({ task, onClick, commentCount = 0 }: TaskCardProps) {
  const getPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case "URGENT":
        return "bg-rose-500/10 text-rose-500 border-rose-500/20";
      case "HIGH":
        return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "MEDIUM":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-500 border-zinc-500/20";
    }
  };

  const hasDevRecommendation = Boolean(task.devRecommendation?.trim());
  const hasQaNotes = Boolean(task.qaTestNotes?.trim());

  return (
    <div
      onClick={onClick}
      className="group relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-3.5 shadow-sm hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer select-none"
    >
      {/* Top Header: ID & Priority */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-xs font-semibold text-zinc-500 dark:text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-zinc-200 transition-colors">
          {task.projectTaskId}
        </span>
        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getPriorityBadge(
            task.priority
          )}`}
        >
          {task.priority}
        </span>
      </div>

      {/* Task Title */}
      <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2 mb-2 leading-snug">
        {task.title}
      </h4>

      {/* Governed Stage Badges */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {hasDevRecommendation && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            <Code2 className="w-3 h-3 text-zinc-400" />
            <span>Tech Spec</span>
          </span>
        )}
        {hasQaNotes && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <FileCheck2 className="w-3 h-3" />
            <span>QA Ready</span>
          </span>
        )}
      </div>

      {/* Footer Info: Assignee & Meta */}
      <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-xs text-zinc-400">
        <div className="flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-zinc-400" />
          <span className="truncate max-w-[110px] text-zinc-600 dark:text-zinc-400 font-medium">
            {task.assigneeName || "Unassigned"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {commentCount > 0 && (
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              <span>{commentCount}</span>
            </span>
          )}
          {task.dueDate && (
            <span className="flex items-center gap-1 text-[11px]">
              <Clock className="w-3 h-3" />
              <span>{new Date(task.dueDate).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
