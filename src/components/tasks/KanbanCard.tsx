"use client";

import React from "react";
import { LocalTask } from "@/lib/dexie";
import { TaskPriority, TaskStage, WorkspaceRole } from "@prisma/client";
import { MessageSquare, ArrowRight, ShieldCheck, Check } from "lucide-react";

interface KanbanCardProps {
  task: LocalTask;
  commentCount?: number;
  userRole: WorkspaceRole;
  onClick: () => void;
  onStageChange?: (taskId: string, newStage: TaskStage) => void;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

export function KanbanCard({
  task,
  commentCount = 0,
  userRole,
  onClick,
  onStageChange,
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

  const getStageLabel = (stage: TaskStage) => {
    switch (stage) {
      case "PROPOSED":
        return "Proposed";
      case "TA_REVIEW":
        return "TA Review";
      case "DEV_ASSESSMENT":
        return "Dev Assessment";
      case "CONFIRMED_READY":
        return "Confirmed Ready";
      case "IN_PROGRESS":
        return "In Progress";
      case "READY_FOR_TESTING":
        return "QA Testing";
      case "APPROVED_CLEARED":
        return "Approved";
      case "ARCHIVED":
        return "Archived";
      default:
        return stage;
    }
  };

  const getStageTagColor = (stage: TaskStage) => {
    switch (stage) {
      case "PROPOSED":
        return "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
      case "TA_REVIEW":
        return "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400";
      case "DEV_ASSESSMENT":
        return "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400";
      case "CONFIRMED_READY":
        return "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400";
      case "IN_PROGRESS":
        return "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400";
      case "READY_FOR_TESTING":
        return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400";
      case "APPROVED_CLEARED":
        return "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-400";
      case "ARCHIVED":
      default:
        return "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500";
    }
  };

  // Determine allowed stage quick moves based on role
  // HOO: PROPOSED -> TA_REVIEW or READY_FOR_TESTING -> APPROVED_CLEARED
  // Developer: CONFIRMED_READY -> IN_PROGRESS -> READY_FOR_TESTING
  const getQuickAction = () => {
    if (!onStageChange) return null;

    if (userRole === "HOO" || userRole === "OWNER") {
      if (task.stage === "PROPOSED") {
        return {
          target: "TA_REVIEW" as TaskStage,
          label: "Move to TA Review",
        };
      }
      if (task.stage === "READY_FOR_TESTING") {
        return {
          target: "APPROVED_CLEARED" as TaskStage,
          label: "Sign Off QA",
        };
      }
    }

    if (userRole === "DEVELOPER" || userRole === "OWNER") {
      if (task.stage === "CONFIRMED_READY") {
        return {
          target: "IN_PROGRESS" as TaskStage,
          label: "Start Dev",
        };
      }
      if (task.stage === "IN_PROGRESS") {
        return {
          target: "READY_FOR_TESTING" as TaskStage,
          label: "Submit for QA",
        };
      }
    }

    return null;
  };

  const quickAction = getQuickAction();
  const assigneeInitial = (task.assigneeName || task.creatorName || "U").slice(0, 1).toUpperCase();

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={`group relative select-none rounded-lg border bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800 shadow-xs hover:shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer p-2.5 ${
        isDragging ? "opacity-40 scale-[0.98]" : "opacity-100"
      }`}
    >
      {/* Header Line: Ticket ID (EQ-104) in monospace bold + priority indicator */}
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {getPriorityDot(task.priority)}
          <span className="font-mono text-[11px] font-bold text-zinc-500 dark:text-zinc-400 tracking-tight truncate">
            {task.projectTaskId}
          </span>
        </div>

        {/* Quick Role-Action Trigger if applicable */}
        {quickAction && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onStageChange?.(task.id, quickAction.target);
            }}
            title={quickAction.label}
            className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-medium px-1.5 py-0.5 rounded bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 flex items-center gap-0.5"
          >
            <span>{quickAction.label}</span>
            <ArrowRight className="w-2.5 h-2.5" />
          </button>
        )}
      </div>

      {/* Task Title: Strict 2-line clamp */}
      <h4 className="line-clamp-2 text-xs font-medium text-neutral-900 dark:text-neutral-100 leading-snug mb-2">
        {task.title}
      </h4>

      {/* Footer Line: Single horizontal flex line with text-[11px] */}
      <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-zinc-100 dark:border-zinc-800/80">
        <div className="flex items-center gap-2 min-w-0">
          {/* Micro stage tag */}
          <span
            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-sm tracking-tight truncate ${getStageTagColor(
              task.stage
            )}`}
          >
            {getStageLabel(task.stage)}
          </span>

          {/* Comment Count Icon & Number */}
          {commentCount > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-zinc-400">
              <MessageSquare className="w-3 h-3 text-zinc-400" />
              <span>{commentCount}</span>
            </span>
          )}
        </div>

        {/* Far Right: Micro 18px Assignee Avatar */}
        <div
          title={task.assigneeName || task.creatorName || "Unassigned"}
          className="w-[18px] h-[18px] rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 flex items-center justify-center text-[9px] font-bold shrink-0 ring-1 ring-white dark:ring-zinc-900"
        >
          {assigneeInitial}
        </div>
      </div>
    </div>
  );
}
