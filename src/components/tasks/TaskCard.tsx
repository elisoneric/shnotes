"use client";

import React from "react";
import { LocalTask, localDb } from "@/lib/dexie";
import { TaskPriority, TaskStage } from "@prisma/client";
import { syncManager } from "@/lib/sync";
import {
  Clock,
  CheckCircle2,
  Circle,
  MessageSquare,
  Calendar,
  User,
} from "lucide-react";

interface TaskCardProps {
  task: LocalTask;
  onClick: () => void;
  commentCount?: number;
}

export function TaskCard({ task, onClick, commentCount = 0 }: TaskCardProps) {
  const isDone = task.stage === "APPROVED_CLEARED" || task.stage === "ARCHIVED";

  const getPriorityStyle = (priority: TaskPriority) => {
    switch (priority) {
      case "URGENT":
        return "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
      case "HIGH":
        return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      case "MEDIUM":
        return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
      default:
        return "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20";
    }
  };

  const handleToggleDone = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStage: TaskStage = isDone ? "PROPOSED" : "APPROVED_CLEARED";
    const updated: LocalTask = {
      ...task,
      stage: nextStage,
      updatedAt: new Date(),
      version: task.version + 1,
    };

    await localDb.tasks.put(updated);
    await syncManager.queueMutation("task", task.id, "STAGE_CHANGE", {
      stage: nextStage,
    });
  };

  return (
    <div
      onClick={onClick}
      className={`group relative bg-white dark:bg-zinc-900 border rounded-xl p-3.5 shadow-sm hover:shadow-md transition-all cursor-pointer ${
        isDone
          ? "border-zinc-200/60 dark:border-zinc-800/60 opacity-80"
          : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
      }`}
    >
      <div className="flex items-start gap-2.5">
        {/* 1-Click Quick Done Checkbox */}
        <button
          type="button"
          onClick={handleToggleDone}
          className="mt-0.5 text-zinc-400 hover:text-emerald-500 transition-colors shrink-0"
          title={isDone ? "Mark as To Do" : "Mark as Done"}
        >
          {isDone ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          ) : (
            <Circle className="w-4 h-4 text-zinc-300 dark:text-zinc-600 group-hover:text-zinc-400" />
          )}
        </button>

        <div className="flex-1 min-w-0">
          {/* Title */}
          <h4
            className={`text-xs sm:text-sm font-medium leading-snug break-words ${
              isDone
                ? "line-through text-zinc-400 dark:text-zinc-500"
                : "text-zinc-900 dark:text-zinc-100"
            }`}
          >
            {task.title}
          </h4>

          {/* Description snippet if any */}
          {task.description && !isDone && (
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
              {task.description}
            </p>
          )}

          {/* Card Footer: Priority, ID, Date & Comments */}
          <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[10px] text-zinc-400 font-semibold">
                {task.projectTaskId}
              </span>
              <span
                className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md border uppercase tracking-wider ${getPriorityStyle(
                  task.priority
                )}`}
              >
                {task.priority.toLowerCase()}
              </span>
            </div>

            <div className="flex items-center gap-2 text-zinc-400">
              {task.dueDate && (
                <span className="flex items-center gap-1 text-[10px]">
                  <Calendar className="w-3 h-3 text-zinc-400" />
                  <span>
                    {new Date(task.dueDate).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </span>
              )}

              {commentCount > 0 && (
                <span className="flex items-center gap-1 text-[10px]">
                  <MessageSquare className="w-3 h-3 text-zinc-400" />
                  <span>{commentCount}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
