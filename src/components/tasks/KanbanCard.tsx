"use client";

import React from "react";
import { LocalTask } from "@/lib/dexie";
import { TaskPriority, TaskStage, WorkspaceRole } from "@prisma/client";
import { MessageSquare, ShieldCheck, CheckCircle2, User } from "lucide-react";

interface KanbanCardProps {
  task: LocalTask;
  stageName?: string;
  stageColor?: string;
  commentCount?: number;
  userRole: WorkspaceRole;
  onClick: () => void;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

export function KanbanCard({
  task,
  stageName,
  stageColor,
  commentCount = 0,
  userRole,
  onClick,
  isDragging = false,
  onDragStart,
  onDragEnd,
}: KanbanCardProps) {
  // Priority dot indicator
  const getPriorityDot = (priority: TaskPriority) => {
    switch (priority) {
      case "URGENT":
        return <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" title="Urgent priority" />;
      case "HIGH":
        return <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" title="High priority" />;
      case "MEDIUM":
        return <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" title="Medium priority" />;
      case "LOW":
      default:
        return <span className="w-2 h-2 rounded-full bg-zinc-400 dark:bg-zinc-600 shrink-0" title="Low priority" />;
    }
  };

  const assigneeInitial = (task.assigneeName || task.creatorName || "U").slice(0, 1).toUpperCase();

  // Multi-stakeholder clearance indicator
  const signoffs = task.signoffs || [];
  const clearedCount = signoffs.filter((s) => s.cleared).length;
  const isFullyCleared = signoffs.length > 0 && clearedCount === signoffs.length;

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`group relative select-none rounded-xl border bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 shadow-2xs hover:shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer py-2 px-3 ${
        isDragging ? "opacity-30 scale-[0.98]" : "opacity-100"
      }`}
    >
      {/* Header Line: Ticket ID (EQ-42) in monospace bold + priority indicator */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {getPriorityDot(task.priority)}
          <span className="font-mono text-[11px] font-bold text-zinc-600 dark:text-zinc-400 tracking-tight truncate">
            {task.projectTaskId}
          </span>
        </div>

        {/* Clearance Badge if signoffs exist */}
        {signoffs.length > 0 && (
          <div
            title={`${clearedCount} of ${signoffs.length} sign-offs cleared`}
            className={`flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
              isFullyCleared
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
            }`}
          >
            <ShieldCheck className="w-3 h-3" />
            <span>
              {clearedCount}/{signoffs.length}
            </span>
          </div>
        )}
      </div>

      {/* Task Title: Strict 2-line clamp */}
      <h4 className="line-clamp-2 text-xs font-medium text-zinc-900 dark:text-zinc-100 leading-snug mb-2">
        {task.title}
      </h4>

      {/* Footer Line: Single compact horizontal line */}
      <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-zinc-100 dark:border-zinc-800/80">
        <div className="flex items-center gap-2 min-w-0">
          {/* Stage badge pill */}
          {stageName && (
            <span
              className="text-[9px] font-semibold px-1.5 py-0.5 rounded tracking-tight truncate"
              style={{
                backgroundColor: `${stageColor || "#94a3b8"}20`,
                color: stageColor || "#94a3b8",
              }}
            >
              {stageName}
            </span>
          )}

          {/* Comment Count */}
          {commentCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-zinc-400">
              <MessageSquare className="w-3 h-3" />
              <span>{commentCount}</span>
            </span>
          )}
        </div>

        {/* Far Right: Assignee Avatar */}
        <div
          title={task.assigneeName || task.creatorName || "Unassigned"}
          className="w-4.5 h-4.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 flex items-center justify-center text-[9px] font-bold shrink-0 ring-1 ring-white dark:ring-zinc-900"
        >
          {assigneeInitial}
        </div>
      </div>
    </div>
  );
}
