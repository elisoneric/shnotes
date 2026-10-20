"use client";

import React, { useState } from "react";
import { LocalTask, LocalTaskComment, LocalProjectStage, LocalTaskSignoff, localDb } from "@/lib/dexie";
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
  ShieldCheck,
  Check,
  UserCheck,
} from "lucide-react";

interface TaskGovernanceModalProps {
  task: LocalTask;
  stages?: LocalProjectStage[];
  comments: LocalTaskComment[];
  currentRole: WorkspaceRole;
  currentUserId: string;
  currentUserName: string;
  onClose: () => void;
  onTaskUpdated: () => void;
}

const GOVERNANCE_ROLES: { role: WorkspaceRole; title: string; desc: string }[] = [
  { role: "TECH_ASSISTANT", title: "Technical Assistant", desc: "Triage & Spec Verification" },
  { role: "DEVELOPER", title: "Engineering Lead", desc: "Build & Implementation Verification" },
  { role: "HOO", title: "Head of Operations", desc: "Scope & Resource Clearance" },
  { role: "OWNER", title: "Executive Sign-Off", desc: "Final Release Authorization" },
];

export function TaskGovernanceModal({
  task,
  stages = [],
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
  const [selectedStageId, setSelectedStageId] = useState<string>(task.stageId || (stages[0]?.id || ""));
  const [dueDate, setDueDate] = useState(
    task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : ""
  );
  const [newComment, setNewComment] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [signoffNotes, setSignoffNotes] = useState("");

  const signoffs = task.signoffs || [];
  const currentSignoff = signoffs.find((s) => s.userId === currentUserId);
  const isCurrentCleared = Boolean(currentSignoff?.cleared);

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
      stage: updated.stage,
      stageId: updated.stageId,
      dueDate: updated.dueDate,
    });

    onTaskUpdated();
  };

  const handleStageSelect = async (newStageId: string) => {
    const targetStage = stages.find((s) => s.id === newStageId);
    if (!targetStage) return;

    setSelectedStageId(newStageId);

    let legacyStage: TaskStage = "PROPOSED";
    if (targetStage.isCompleted) legacyStage = "APPROVED_CLEARED";
    else if (targetStage.order === 2) legacyStage = "DEV_ASSESSMENT";
    else if (targetStage.order === 3) legacyStage = "IN_PROGRESS";
    else if (targetStage.order >= 4) legacyStage = "READY_FOR_TESTING";

    const updated: LocalTask = {
      ...task,
      stageId: targetStage.id,
      stage: legacyStage,
      updatedAt: new Date(),
      version: task.version + 1,
    };

    await localDb.tasks.put(updated);

    // Add audit comment
    const auditComment: LocalTaskComment = {
      id: `comment_audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      taskId: task.id,
      userId: currentUserId,
      userName: currentUserName,
      userRole: currentRole,
      type: CommentType.STAGE_CHANGE_AUDIT,
      content: `Stage set to "${targetStage.name}" by ${currentUserName}.`,
      version: 1,
      createdAt: new Date(),
    };
    await localDb.taskComments.add(auditComment);

    await syncManager.queueMutation("taskComment", auditComment.id, "UPSERT", {
      taskId: task.id,
      content: auditComment.content,
      type: auditComment.type,
    });

    await syncManager.queueMutation("task", task.id, "STAGE_CHANGE", {
      stageId: targetStage.id,
      stage: legacyStage,
      order: task.order,
    });

    onTaskUpdated();
  };

  const handleToggleSignoff = async () => {
    const nextCleared = !isCurrentCleared;
    const now = new Date();

    const newSignoff: LocalTaskSignoff = {
      id: currentSignoff?.id || `signoff_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      taskId: task.id,
      userId: currentUserId,
      userName: currentUserName,
      cleared: nextCleared,
      notes: signoffNotes.trim() || null,
      clearedAt: nextCleared ? now : null,
    };

    const updatedSignoffs = signoffs.filter((s) => s.userId !== currentUserId).concat(newSignoff);

    const updatedTask: LocalTask = {
      ...task,
      signoffs: updatedSignoffs,
      updatedAt: now,
      version: task.version + 1,
    };

    await localDb.tasks.put(updatedTask);

    // Queue sync mutation
    await syncManager.queueMutation("task", task.id, "SIGNOFF_CHANGE", {
      taskId: task.id,
      userId: currentUserId,
      cleared: nextCleared,
      notes: signoffNotes.trim() || null,
    });

    // Add audit comment
    const auditMsg = nextCleared
      ? `Clearance sign-off completed by ${currentUserName} (${currentRole.replace(/_/g, " ")}).`
      : `Clearance sign-off revoked by ${currentUserName} (${currentRole.replace(/_/g, " ")}).`;

    const auditComment: LocalTaskComment = {
      id: `comment_audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      taskId: task.id,
      userId: currentUserId,
      userName: currentUserName,
      userRole: currentRole,
      type: CommentType.STAGE_CHANGE_AUDIT,
      content: auditMsg,
      version: 1,
      createdAt: now,
    };
    await localDb.taskComments.add(auditComment);

    await syncManager.queueMutation("taskComment", auditComment.id, "UPSERT", {
      taskId: task.id,
      content: auditComment.content,
      type: auditComment.type,
    });

    setSignoffNotes("");
    onTaskUpdated();
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

  const userComments = comments.filter((c) => c.type === "STANDARD_CHAT");
  const auditLogs = comments.filter((c) => c.type !== "STANDARD_CHAT");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between gap-4 bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0">
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold">
              {task.projectTaskId}
            </span>

            {/* Dynamic Stage Selector */}
            {stages.length > 0 ? (
              <select
                aria-label="Current Stage"
                value={selectedStageId}
                onChange={(e) => handleStageSelect(e.target.value)}
                className="text-xs px-3 py-1 font-semibold rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none cursor-pointer"
              >
                {stages.map((stg) => (
                  <option key={stg.id} value={stg.id}>
                    {stg.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                {task.stage.replace(/_/g, " ")}
              </span>
            )}
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
              aria-label="Task Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
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
                Target Due Date
              </span>
              <input
                type="date"
                aria-label="Target Due Date"
                value={dueDate}
                onChange={handleDueDateChange}
                className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              />
            </div>
          </div>

          {/* Multi-Stakeholder Clearance Matrix */}
          <div className="bg-zinc-50 dark:bg-zinc-850/60 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Stakeholder Clearance Matrix
                </h4>
              </div>
              <span className="text-[10px] text-zinc-400 font-mono">
                {signoffs.filter((s) => s.cleared).length} cleared
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {GOVERNANCE_ROLES.map((gov) => {
                const userSignoff = signoffs.find((s) => s.userId === currentUserId && currentRole === gov.role)
                  || signoffs.find((s) => s.cleared);
                const hasCleared = Boolean(userSignoff?.cleared);

                return (
                  <div
                    key={gov.role}
                    className={`p-3 rounded-lg border flex flex-col justify-between transition-all ${
                      hasCleared
                        ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-500/30"
                        : "bg-white dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 block">
                          {gov.title}
                        </span>
                        <span className="text-[10px] text-zinc-400 block">
                          {gov.desc}
                        </span>
                      </div>
                      {hasCleared ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0">
                          <Check className="w-3 h-3" /> Cleared
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full shrink-0">
                          <Clock className="w-3 h-3" /> Pending
                        </span>
                      )}
                    </div>

                    {hasCleared && userSignoff?.userName && (
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-1">
                        Signed off by {userSignoff.userName}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Current User Clearance Action Button */}
            <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                Operating as <strong className="text-zinc-800 dark:text-zinc-200">{currentUserName}</strong> ({currentRole.replace(/_/g, " ")})
              </span>
              <button
                type="button"
                onClick={handleToggleSignoff}
                className={`text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all shadow-xs ${
                  isCurrentCleared
                    ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{isCurrentCleared ? "Revoke My Sign-off" : "Mark Clearance Sign-Off"}</span>
              </button>
            </div>
          </div>

          {/* Notes / Description */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
              Task Notes & Details
            </label>
            <textarea
              aria-label="Task Notes and Details"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              onBlur={handleDescriptionBlur}
              rows={4}
              className="w-full text-xs p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 leading-relaxed"
            />
          </div>

          {/* Comments Section */}
          <div className="border-t border-zinc-100 dark:border-zinc-800 pt-5 space-y-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-zinc-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Discussion ({userComments.length})
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
                aria-label="Add a comment"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="flex-1 text-xs px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
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
        <div className="px-6 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex items-center justify-between shrink-0">
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
