"use client";

import React, { useState } from "react";
import { LocalTask, LocalTaskComment, localDb } from "@/lib/dexie";
import { TaskStage, TaskPriority, WorkspaceRole, CommentType } from "@prisma/client";
import { syncManager } from "@/lib/sync";
import {
  X,
  CheckCircle2,
  Circle,
  Clock,
  Trash2,
  Send,
  Calendar,
  AlertCircle,
  MessageSquare,
  Sparkles,
} from "lucide-react";

interface TaskGovernanceModalProps {
  task: LocalTask;
  comments: LocalTaskComment[];
  currentRole: WorkspaceRole;
  currentUserId: string;
  currentUserName: string;
  onClose: () => void;
  onTaskUpdated: () => void;
}

export function TaskGovernanceModal({
  task,
  comments,
  currentRole,
  currentUserId,
  currentUserName,
  onClose,
  onTaskUpdated,
}: TaskGovernanceModalProps) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || "");
  const [priority, setPriority] = useState<TaskPriority>(task.priority);
  const [dueDate, setDueDate] = useState(
    task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""
  );
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Status mapping: 3 simple states
  const getSimpleStatus = (stage: TaskStage): "TODO" | "IN_PROGRESS" | "DONE" => {
    if (stage === "APPROVED_CLEARED" || stage === "ARCHIVED") return "DONE";
    if (stage === "IN_PROGRESS" || stage === "READY_FOR_TESTING") return "IN_PROGRESS";
    return "TODO";
  };

  const currentStatus = getSimpleStatus(task.stage);

  // Helper to persist task updates
  const saveTaskField = async (fields: Partial<LocalTask>) => {
    const updated: LocalTask = {
      ...task,
      ...fields,
      updatedAt: new Date(),
      version: task.version + 1,
    };

    await localDb.tasks.put(updated);
    await syncManager.queueMutation("task", task.id, "UPSERT", {
      title: updated.title,
      description: updated.description,
      priority: updated.priority,
      dueDate: updated.dueDate,
      stage: updated.stage,
    });

    onTaskUpdated();
  };

  const handleStatusChange = async (status: "TODO" | "IN_PROGRESS" | "DONE") => {
    let nextStage: TaskStage = "PROPOSED";
    if (status === "IN_PROGRESS") nextStage = "IN_PROGRESS";
    if (status === "DONE") nextStage = "APPROVED_CLEARED";

    await saveTaskField({ stage: nextStage });
  };

  const handleTitleBlur = () => {
    if (title.trim() && title !== task.title) {
      saveTaskField({ title: title.trim() });
    }
  };

  const handleDescriptionBlur = () => {
    if (description !== (task.description || "")) {
      saveTaskField({ description: description.trim() || null });
    }
  };

  const handlePriorityChange = (p: TaskPriority) => {
    setPriority(p);
    saveTaskField({ priority: p });
  };

  const handleDueDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setDueDate(val);
    saveTaskField({ dueDate: val ? new Date(val) : null });
  };

  const handleDeleteTask = async () => {
    await localDb.tasks.update(task.id, {
      deletedAt: new Date(),
      version: task.version + 1,
    });
    await syncManager.queueMutation("task", task.id, "DELETE", {});
    onTaskUpdated();
    onClose();
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmittingComment) return;

    setIsSubmittingComment(true);
    try {
      const commentItem: LocalTaskComment = {
        id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        taskId: task.id,
        userId: currentUserId,
        userName: currentUserName,
        userRole: currentRole,
        type: "STANDARD_CHAT",
        content: newComment.trim(),
        version: 1,
        createdAt: new Date(),
      };

      await localDb.taskComments.add(commentItem);
      await syncManager.queueMutation("taskComment", commentItem.id, "UPSERT", {
        taskId: task.id,
        type: "STANDARD_CHAT",
        content: newComment.trim(),
      });

      setNewComment("");
      onTaskUpdated();
    } finally {
      setIsSubmittingComment(false);
    }
  };

  // Filter out system audit logs to keep discussion stress-free and simple
  const userComments = comments.filter((c) => c.type === "STANDARD_CHAT");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold">
              {task.projectTaskId}
            </span>

            {/* 3 Simple Status Pills */}
            <div className="flex items-center bg-zinc-200/60 dark:bg-zinc-800/80 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => handleStatusChange("TODO")}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  currentStatus === "TODO"
                    ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                To Do
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange("IN_PROGRESS")}
                className={`px-3 py-1 rounded-md font-medium transition-all ${
                  currentStatus === "IN_PROGRESS"
                    ? "bg-blue-500 text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                In Progress
              </button>
              <button
                type="button"
                onClick={() => handleStatusChange("DONE")}
                className={`px-3 py-1 rounded-md font-medium transition-all flex items-center gap-1.5 ${
                  currentStatus === "DONE"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Done</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {showDeleteConfirm ? (
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-zinc-500">Delete task?</span>
                <button
                  type="button"
                  onClick={handleDeleteTask}
                  className="px-2 py-1 rounded bg-rose-600 text-white font-medium hover:bg-rose-700"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-2 py-1 rounded text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                title="Delete task"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Editable Title */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Task Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              placeholder="Task title"
              className="w-full text-base sm:text-lg font-semibold bg-transparent text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-800 pb-1.5 focus:border-zinc-400 dark:focus:border-zinc-600 focus:outline-none transition-colors"
            />
          </div>

          {/* Properties Grid: Priority & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-50 dark:bg-zinc-800/40 p-3.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
            {/* Priority Pills */}
            <div>
              <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                Priority
              </span>
              <div className="flex items-center gap-1.5">
                {(["LOW", "MEDIUM", "HIGH", "URGENT"] as TaskPriority[]).map((p) => {
                  const isSelected = priority === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => handlePriorityChange(p)}
                      className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                        isSelected
                          ? p === "URGENT"
                            ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30"
                            : p === "HIGH"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
                            : p === "MEDIUM"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30"
                            : "bg-zinc-200/70 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-200 border-zinc-300 dark:border-zinc-600"
                          : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
                      }`}
                    >
                      {p.toLowerCase()}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Due Date */}
            <div>
              <span className="block text-xs font-semibold text-zinc-500 dark:text-zinc-400 mb-1.5">
                Due Date
              </span>
              <div className="relative">
                <input
                  type="date"
                  value={dueDate}
                  onChange={handleDueDateChange}
                  className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
              </div>
            </div>
          </div>

          {/* Notes / Description */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Notes & Details
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              placeholder="Add details, notes, or checklist items"
              rows={4}
              className="w-full text-xs p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 leading-relaxed"
            />
          </div>

          {/* Simple Comments Section */}
          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-5 space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-zinc-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Comments ({userComments.length})
              </h4>
            </div>

            {/* Comments List */}
            <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
              {userComments.length === 0 ? (
                <p className="text-xs text-zinc-400 italic">No comments yet.</p>
              ) : (
                userComments.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800/80 text-xs"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                        {c.userName}
                      </span>
                      <span className="text-[10px] text-zinc-400">
                        {new Date(c.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className="text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap">
                      {c.content}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Add Comment Input */}
            <form onSubmit={handleAddComment} className="flex gap-2 pt-1">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="flex-1 text-xs px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              />
              <button
                type="submit"
                disabled={!newComment.trim() || isSubmittingComment}
                className="px-3 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between">
          <span className="text-[11px] text-zinc-400">
            Created by {task.creatorName || "Workspace member"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 shadow-sm"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
