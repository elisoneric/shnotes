"use client";

import React, { useState } from "react";
import { LocalTask, LocalTaskComment, localDb } from "@/lib/dexie";
import { TaskStage, TaskPriority, WorkspaceRole, CommentType } from "@prisma/client";
import { syncManager } from "@/lib/sync";
import {
  X,
  CheckCircle2,
  Clock,
  ArrowRight,
  ShieldCheck,
  Code2,
  FileCheck2,
  Sparkles,
  Send,
  MessageSquare,
  History,
  Lock,
  ExternalLink,
  ChevronRight,
  User,
  AlertTriangle,
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

const STAGES: { key: TaskStage; label: string; role: string }[] = [
  { key: "PROPOSED", label: "Proposed", role: "HOO" },
  { key: "TA_REVIEW", label: "TA Review", role: "TA" },
  { key: "DEV_ASSESSMENT", label: "Dev Assessment", role: "Dev" },
  { key: "CONFIRMED_READY", label: "Confirmed", role: "HOO / TA" },
  { key: "IN_PROGRESS", label: "In Progress", role: "Dev" },
  { key: "READY_FOR_TESTING", label: "Ready for QA", role: "Dev" },
  { key: "APPROVED_CLEARED", label: "Approved & Cleared", role: "HOO" },
];

export function TaskGovernanceModal({
  task,
  comments,
  currentRole,
  currentUserId,
  currentUserName,
  onClose,
  onTaskUpdated,
}: TaskGovernanceModalProps) {
  // Local editable state for governed fields
  const [taNotes, setTaNotes] = useState(task.taReviewNotes || "");
  const [devRec, setDevRec] = useState(task.devRecommendation || "");
  const [qaNotes, setQaNotes] = useState(task.qaTestNotes || "");
  const [signoffNote, setSignoffNote] = useState(task.approvalSignoffNote || "");
  const [newComment, setNewComment] = useState("");
  const [commentFilter, setCommentFilter] = useState<"ALL" | "AUDIT" | "TECH">("ALL");
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"GOVERNANCE" | "COMMENTS">("GOVERNANCE");

  const currentStageIndex = STAGES.findIndex((s) => s.key === task.stage);

  // Helper to transition task stage with optimistic write to local Dexie + sync queue
  const transitionStage = async (nextStage: TaskStage, extraFields: Partial<LocalTask> = {}) => {
    const updated: LocalTask = {
      ...task,
      stage: nextStage,
      taReviewNotes: taNotes,
      devRecommendation: devRec,
      qaTestNotes: qaNotes,
      approvalSignoffNote: signoffNote,
      updatedAt: new Date(),
      version: task.version + 1,
      ...extraFields,
    };

    // 1. Optimistic write to local Dexie
    await localDb.tasks.put(updated);

    // 2. Add audit comment to local Dexie
    const auditComment: LocalTaskComment = {
      id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      taskId: task.id,
      userId: currentUserId,
      userName: currentUserName,
      userRole: currentRole,
      type: "STAGE_CHANGE_AUDIT",
      content: `Ball-in-Court transition: Moved stage to ${nextStage.replace(/_/g, " ")}.`,
      version: 1,
      createdAt: new Date(),
    };
    await localDb.taskComments.add(auditComment);

    // 3. Queue mutation for server sync
    await syncManager.queueMutation("task", task.id, "STAGE_CHANGE", {
      stage: nextStage,
      taReviewNotes: taNotes,
      devRecommendation: devRec,
      qaTestNotes: qaNotes,
      approvalSignoffNote: signoffNote,
      ...extraFields,
    });

    onTaskUpdated();
  };

  // Submit comment
  const handleAddComment = async (type: CommentType = "STANDARD_CHAT") => {
    if (!newComment.trim()) return;

    const commentItem: LocalTaskComment = {
      id: `comm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      taskId: task.id,
      userId: currentUserId,
      userName: currentUserName,
      userRole: currentRole,
      type,
      content: newComment.trim(),
      version: 1,
      createdAt: new Date(),
    };

    await localDb.taskComments.add(commentItem);
    await syncManager.queueMutation("taskComment", commentItem.id, "UPSERT", {
      taskId: task.id,
      type,
      content: newComment.trim(),
    });

    setNewComment("");
    onTaskUpdated();
  };

  // Indunix AI Triggers
  const triggerAiAction = async (action: "draft-recommendation" | "qa-checklist" | "summarize-thread") => {
    setIsAiLoading(true);
    try {
      const res = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          taskId: task.id,
          context: {
            title: task.title,
            description: task.description,
            qaTestNotes: qaNotes,
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (action === "draft-recommendation" && data.result) {
          setDevRec(data.result);
        } else if (action === "qa-checklist" && data.result) {
          setQaNotes(data.result);
        } else if (action === "summarize-thread" && data.result) {
          // Append summary to chat thread
          const summaryComment: LocalTaskComment = {
            id: `comm_ai_${Date.now()}`,
            taskId: task.id,
            userId: currentUserId,
            userName: "Indunix AI Copilot",
            type: "AI_COPILOT_OUTPUT",
            content: data.result,
            version: 1,
            createdAt: new Date(),
          };
          await localDb.taskComments.add(summaryComment);
          onTaskUpdated();
        }
      }
    } catch (err) {
      console.warn("AI copilot error:", err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const filteredComments = comments.filter((c) => {
    if (commentFilter === "AUDIT") return c.type === "STAGE_CHANGE_AUDIT";
    if (commentFilter === "TECH") return c.type === "TA_SPEC_NOTE" || c.type === "DEV_RECOMMENDATION";
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-zinc-950/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-5xl max-h-[92vh] flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-bold px-2.5 py-1 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100">
              {task.projectTaskId}
            </span>
            <span className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
              {STAGES.find((s) => s.key === task.stage)?.label}
            </span>
            <span className="text-xs px-2 py-0.5 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-500">
              Ball-in-Court: {STAGES.find((s) => s.key === task.stage)?.role}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 7-Stage Pipeline Visualizer */}
        <div className="px-6 py-3 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-100/50 dark:bg-zinc-950/40 overflow-x-auto">
          <div className="flex items-center gap-1.5 min-w-[700px]">
            {STAGES.map((s, idx) => {
              const isPast = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;
              return (
                <React.Fragment key={s.key}>
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                      isCurrent
                        ? "bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 shadow-sm"
                        : isPast
                        ? "text-emerald-600 dark:text-emerald-400 font-semibold"
                        : "text-zinc-400 dark:text-zinc-500"
                    }`}
                  >
                    {isPast ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span>{idx + 1}.</span>}
                    <span>{s.label}</span>
                  </div>
                  {idx < STAGES.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-700" />}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Main Body: 3-Tier Governance (Left) + Slack-in-a-Card Chat Drawer (Right) */}
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-y-auto divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 dark:divide-zinc-800">
          {/* Left Column: The 3 Governance Panels (Span 7) */}
          <div className="lg:col-span-7 p-6 space-y-6 overflow-y-auto">
            <div>
              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight mb-2">{task.title}</h2>
              <div className="flex items-center gap-4 text-xs text-zinc-500">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5" />
                  <span>Assignee: {task.assigneeName || "Unassigned"}</span>
                </span>
                <span>Priority: {task.priority}</span>
              </div>
            </div>

            {/* TIER 1: HOO Request & Business Rationale Card */}
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-zinc-400" />
                  <span>Tier 1: Operational Request (HOO / TA)</span>
                </span>
                {task.stage === "PROPOSED" && (
                  <button
                    onClick={() => transitionStage("TA_REVIEW")}
                    className="text-xs font-semibold px-2.5 py-1 rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90"
                  >
                    Accept for TA Review
                  </button>
                )}
              </div>

              <div className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap leading-relaxed">
                {task.description || "No operational description provided."}
              </div>

              {/* TA Review Notes Sub-box */}
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <label className="block text-xs font-semibold text-zinc-500 mb-1">
                  Technical Assistant (TA) Triage & Spec Notes:
                </label>
                <textarea
                  value={taNotes}
                  onChange={(e) => setTaNotes(e.target.value)}
                  placeholder="Note dependencies, API considerations, or assign to developer..."
                  rows={2}
                  className="w-full text-xs p-2.5 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
                {task.stage === "TA_REVIEW" && (
                  <div className="mt-2 flex justify-end">
                    <button
                      onClick={() => transitionStage("DEV_ASSESSMENT")}
                      className="text-xs font-semibold px-3 py-1.5 rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center gap-1"
                    >
                      <span>Assign & Send to Dev Assessment</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* TIER 2: Developer Architecture & Recommendation Box */}
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5">
                  <Code2 className="w-4 h-4 text-blue-500" />
                  <span>Tier 2: Developer Technical Recommendation & Scope</span>
                </span>

                <button
                  onClick={() => triggerAiAction("draft-recommendation")}
                  disabled={isAiLoading}
                  className="text-xs font-medium px-2.5 py-1 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>{isAiLoading ? "Drafting..." : "AI Draft Recommendation"}</span>
                </button>
              </div>

              <textarea
                value={devRec}
                onChange={(e) => setDevRec(e.target.value)}
                placeholder="State your technical approach, database changes, trade-offs, and estimated days..."
                rows={4}
                className="w-full text-xs font-mono p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              />

              {/* Action Buttons: Scope Approval and Lock */}
              <div className="flex items-center justify-between pt-2">
                <div className="text-[11px] text-zinc-500">
                  {task.devConfirmedAt ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                      <Lock className="w-3 h-3" />
                      <span>Scope locked on {new Date(task.devConfirmedAt).toLocaleDateString()}</span>
                    </span>
                  ) : (
                    <span>Scope not yet confirmed</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {task.stage === "DEV_ASSESSMENT" && (
                    <button
                      onClick={() =>
                        transitionStage("CONFIRMED_READY", { devConfirmedAt: new Date(), devRecommendation: devRec })
                      }
                      className="text-xs font-semibold px-3 py-1.5 rounded bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Approve Scope & Lock (HOO / TA)</span>
                    </button>
                  )}

                  {task.stage === "CONFIRMED_READY" && (
                    <button
                      onClick={() => transitionStage("IN_PROGRESS")}
                      className="text-xs font-semibold px-3 py-1.5 rounded bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90"
                    >
                      Start Development (In Progress)
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* TIER 3: QA Verification, Staging Demo & Sign-off Box */}
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-600 dark:text-zinc-300 flex items-center gap-1.5">
                  <FileCheck2 className="w-4 h-4 text-emerald-500" />
                  <span>Tier 3: QA Verification & Sign-off (HOO)</span>
                </span>

                <button
                  onClick={() => triggerAiAction("qa-checklist")}
                  disabled={isAiLoading}
                  className="text-xs font-medium px-2.5 py-1 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="w-3 h-3 text-amber-500" />
                  <span>AI Generate QA Checklist</span>
                </button>
              </div>

              <textarea
                value={qaNotes}
                onChange={(e) => setQaNotes(e.target.value)}
                placeholder="Staging demo URL, test credentials, and steps for the Head of Operations to test..."
                rows={3}
                className="w-full text-xs font-mono p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              />

              <div className="flex items-center justify-between pt-2">
                {task.stage === "IN_PROGRESS" && (
                  <button
                    onClick={() => transitionStage("READY_FOR_TESTING", { qaTestNotes: qaNotes })}
                    className="text-xs font-semibold px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1"
                  >
                    <span>Submit for Testing (Ready for QA)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {task.stage === "READY_FOR_TESTING" && (
                  <button
                    onClick={() =>
                      transitionStage("APPROVED_CLEARED", {
                        approvalSignoffNote: signoffNote || "Tested and accepted by HOO.",
                        isArchived: true,
                      })
                    }
                    className="text-xs font-semibold px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors flex items-center gap-1.5 ml-auto shadow-sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve Acceptance & Clear to Archive</span>
                  </button>
                )}

                {task.stage === "APPROVED_CLEARED" && (
                  <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Task Cleared & Archived</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Embedded Task Conversation Drawer ("Slack-in-a-Card") (Span 5) */}
          <div className="lg:col-span-5 flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950/30">
            {/* Drawer Top Navigation & Filter */}
            <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs">
                <button
                  onClick={() => setCommentFilter("ALL")}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    commentFilter === "ALL"
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  }`}
                >
                  All ({comments.length})
                </button>
                <button
                  onClick={() => setCommentFilter("AUDIT")}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    commentFilter === "AUDIT"
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  }`}
                >
                  Audit Trail
                </button>
                <button
                  onClick={() => setCommentFilter("TECH")}
                  className={`px-2.5 py-1 rounded font-medium transition-colors ${
                    commentFilter === "TECH"
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                  }`}
                >
                  Tech Notes
                </button>
              </div>

              <button
                onClick={() => triggerAiAction("summarize-thread")}
                disabled={isAiLoading || comments.length === 0}
                title="AI Summarize Conversation"
                className="text-xs p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors flex items-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span className="text-[11px] font-medium hidden sm:inline">Summarize</span>
              </button>
            </div>

            {/* Comment Thread List */}
            <div className="flex-1 p-4 space-y-3 overflow-y-auto min-h-[300px] max-h-[500px]">
              {filteredComments.length === 0 ? (
                <div className="text-center py-10 text-xs text-zinc-400">
                  <MessageSquare className="w-6 h-6 mx-auto mb-2 opacity-40" />
                  <p>No comments in this filter yet.</p>
                </div>
              ) : (
                filteredComments.map((c) => {
                  const isAudit = c.type === "STAGE_CHANGE_AUDIT";
                  const isAi = c.type === "AI_COPILOT_OUTPUT";

                  if (isAudit) {
                    return (
                      <div
                        key={c.id}
                        className="flex items-center gap-2 p-2 rounded bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200/60 dark:border-zinc-800/60 text-[11px] text-zinc-500"
                      >
                        <History className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="font-medium text-zinc-700 dark:text-zinc-300">{c.content}</span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={c.id}
                      className={`p-3 rounded-lg border text-xs space-y-1.5 ${
                        isAi
                          ? "bg-amber-500/5 border-amber-500/20 text-zinc-800 dark:text-zinc-200"
                          : "bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 shadow-sm"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[11px] text-zinc-400">
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{c.userName || "Team"}</span>
                        <span>{new Date(c.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed">{c.content}</p>
                    </div>
                  );
                })
              )}
            </div>

            {/* Chat Input */}
            <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                  placeholder="Type a message or technical note..."
                  className="flex-1 text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
                <button
                  onClick={() => handleAddComment()}
                  disabled={!newComment.trim()}
                  className="px-3 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
