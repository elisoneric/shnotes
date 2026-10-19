"use client";

import React, { useState, useEffect, useTransition } from "react";
import { localDb, LocalTask, LocalTaskComment, LocalProject } from "@/lib/dexie";
import { TaskStage, TaskPriority, WorkspaceRole, CommentType } from "@prisma/client";
import { KanbanCard } from "@/components/tasks/KanbanCard";
import { TaskGovernanceModal } from "@/components/tasks/TaskGovernanceModal";
import { syncManager } from "@/lib/sync";
import {
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Layers,
  ArrowRight,
  AlertCircle,
  X,
} from "lucide-react";

interface KanbanBoardProps {
  currentProject: LocalProject | null;
  currentRole: WorkspaceRole;
  currentUserId: string;
  currentUserName: string;
}

export const GOVERNED_STAGES: {
  stage: TaskStage;
  label: string;
  accent: string;
  allowedRoles: WorkspaceRole[];
}[] = [
  {
    stage: "PROPOSED",
    label: "Proposed",
    accent: "border-zinc-300 dark:border-zinc-700",
    allowedRoles: ["OWNER", "HOO"],
  },
  {
    stage: "TA_REVIEW",
    label: "TA Review",
    accent: "border-amber-400 dark:border-amber-600",
    allowedRoles: ["OWNER", "TECH_ASSISTANT", "HOO"],
  },
  {
    stage: "DEV_ASSESSMENT",
    label: "Dev Assessment",
    accent: "border-purple-400 dark:border-purple-600",
    allowedRoles: ["OWNER", "DEVELOPER", "TECH_ASSISTANT"],
  },
  {
    stage: "CONFIRMED_READY",
    label: "Confirmed Ready",
    accent: "border-blue-400 dark:border-blue-600",
    allowedRoles: ["OWNER", "HOO"],
  },
  {
    stage: "IN_PROGRESS",
    label: "In Progress",
    accent: "border-indigo-400 dark:border-indigo-600",
    allowedRoles: ["OWNER", "DEVELOPER"],
  },
  {
    stage: "READY_FOR_TESTING",
    label: "Ready for Testing",
    accent: "border-emerald-400 dark:border-emerald-600",
    allowedRoles: ["OWNER", "DEVELOPER"],
  },
  {
    stage: "APPROVED_CLEARED",
    label: "Approved & Cleared",
    accent: "border-teal-400 dark:border-teal-600",
    allowedRoles: ["OWNER", "HOO"],
  },
];

export function KanbanBoard({
  currentProject,
  currentRole,
  currentUserId,
  currentUserName,
}: KanbanBoardProps) {
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [comments, setComments] = useState<LocalTaskComment[]>([]);
  const [selectedTask, setSelectedTask] = useState<LocalTask | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<string>("ALL");
  const [activeStageFilter, setActiveStageFilter] = useState<string>("ALL");
  const [toastError, setToastError] = useState<string | null>(null);

  // Drag and Drop state
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<TaskStage | null>(null);

  // New task modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStage, setCreateStage] = useState<TaskStage>("PROPOSED");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("MEDIUM");

  const loadData = async () => {
    try {
      let query = localDb.tasks.filter((t) => !t.deletedAt);
      if (currentProject) {
        query = query.filter((t) => t.projectId === currentProject.id);
      }
      const loadedTasks = await query.toArray();
      const loadedComments = await localDb.taskComments.toArray();
      setTasks(loadedTasks);
      setComments(loadedComments);
    } catch (err) {
      console.warn("Failed to load local tasks:", err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, [currentProject]);

  const showToast = (msg: string) => {
    setToastError(msg);
    setTimeout(() => setToastError(null), 4000);
  };

  // Guard stage transitions by role permissions
  const validateStagePermission = (targetStage: TaskStage, currentTaskStage: TaskStage): boolean => {
    if (currentRole === "OWNER") return true;

    // HOO permissions:
    // Can move PROPOSED -> TA_REVIEW
    // Can move CONFIRMED_READY (approves scope)
    // Can move READY_FOR_TESTING -> APPROVED_CLEARED (signs off QA)
    if (currentRole === "HOO") {
      if (currentTaskStage === "PROPOSED" && targetStage === "TA_REVIEW") return true;
      if (targetStage === "CONFIRMED_READY") return true;
      if (currentTaskStage === "READY_FOR_TESTING" && targetStage === "APPROVED_CLEARED") return true;
      if (targetStage === "ARCHIVED") return true;
      return false;
    }

    // Developer permissions:
    // Can move CONFIRMED_READY -> IN_PROGRESS
    // Can move IN_PROGRESS -> READY_FOR_TESTING
    if (currentRole === "DEVELOPER") {
      if (currentTaskStage === "CONFIRMED_READY" && targetStage === "IN_PROGRESS") return true;
      if (currentTaskStage === "IN_PROGRESS" && targetStage === "READY_FOR_TESTING") return true;
      if (currentTaskStage === "DEV_ASSESSMENT" && targetStage === "CONFIRMED_READY") return false; // Needs approval
      return false;
    }

    // Technical Assistant permissions:
    // Can triage TA_REVIEW -> DEV_ASSESSMENT
    if (currentRole === "TECH_ASSISTANT") {
      if (currentTaskStage === "PROPOSED" || currentTaskStage === "TA_REVIEW") {
        if (targetStage === "TA_REVIEW" || targetStage === "DEV_ASSESSMENT") return true;
      }
      return false;
    }

    return false;
  };

  // Perform optimistic stage update with audit log insertion
  const handleStageTransition = async (taskId: string, newStage: TaskStage, customOrder?: number) => {
    const existing = tasks.find((t) => t.id === taskId);
    if (!existing) return;

    if (existing.stage === newStage && customOrder === undefined) return;

    // Check permissions
    if (existing.stage !== newStage && !validateStagePermission(newStage, existing.stage)) {
      showToast(`Permission denied: Your role (${currentRole.replace(/_/g, " ")}) cannot transition task to ${newStage.replace(/_/g, " ")}.`);
      return;
    }

    const previousStage = existing.stage;
    const finalOrder = customOrder !== undefined ? customOrder : existing.order;

    // 1. Optimistic update
    const updatedTask: LocalTask = {
      ...existing,
      stage: newStage,
      order: finalOrder,
      updatedAt: new Date(),
      version: existing.version + 1,
    };

    setTasks((prev) => prev.map((t) => (t.id === taskId ? updatedTask : t)));

    try {
      await localDb.tasks.put(updatedTask);

      // 2. Insert automated STAGE_CHANGE_AUDIT comment
      if (previousStage !== newStage) {
        const auditComment: LocalTaskComment = {
          id: `comment_audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          taskId,
          userId: currentUserId,
          userName: currentUserName,
          userRole: currentRole,
          type: CommentType.STAGE_CHANGE_AUDIT,
          content: `Stage updated from ${previousStage.replace(/_/g, " ")} to ${newStage.replace(/_/g, " ")} by ${currentUserName} (${currentRole.replace(/_/g, " ")}).`,
          version: 1,
          createdAt: new Date(),
        };
        await localDb.taskComments.add(auditComment);
        setComments((prev) => [...prev, auditComment]);

        await syncManager.queueMutation("taskComment", auditComment.id, "UPSERT", {
          taskId,
          content: auditComment.content,
          type: auditComment.type,
        });
      }

      // 3. Queue server sync
      await syncManager.queueMutation("task", taskId, "STAGE_CHANGE", {
        stage: newStage,
        order: finalOrder,
      });
    } catch (err: any) {
      // Rollback on failure
      setTasks((prev) => prev.map((t) => (t.id === taskId ? existing : t)));
      showToast(`Failed to update task stage: ${err?.message || "Storage error"}`);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
    setDraggingTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent, stage: TaskStage) => {
    e.preventDefault();
    if (dragOverStage !== stage) {
      setDragOverStage(stage);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStage: TaskStage) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain") || draggingTaskId;
    setDraggingTaskId(null);
    setDragOverStage(null);

    if (!taskId) return;

    // Calculate fractional order in destination column
    const columnTasks = tasks
      .filter((t) => t.stage === targetStage && t.id !== taskId)
      .sort((a, b) => a.order - b.order);

    let newOrder = 1.0;
    if (columnTasks.length > 0) {
      newOrder = columnTasks[columnTasks.length - 1].order + 1.0;
    }

    await handleStageTransition(taskId, targetStage, newOrder);
  };

  // Create Task Submission
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !currentProject) return;

    const count = tasks.filter((t) => t.projectId === currentProject.id).length;
    const humanId = `${currentProject.key}-${count + 101}`;
    const newId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const taskItem: LocalTask = {
      id: newId,
      projectTaskId: humanId,
      title: newTitle.trim(),
      description: newDesc.trim() || null,
      stage: createStage,
      priority: newPriority,
      creatorId: currentUserId,
      creatorName: currentUserName,
      projectId: currentProject.id,
      order: count + 1.0,
      isArchived: false,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await localDb.tasks.add(taskItem);
    setTasks((prev) => [...prev, taskItem]);

    await syncManager.queueMutation("task", newId, "UPSERT", {
      projectId: currentProject.id,
      title: taskItem.title,
      description: taskItem.description,
      priority: taskItem.priority,
      stage: taskItem.stage,
      order: taskItem.order,
    });

    setNewTitle("");
    setNewDesc("");
    setIsCreateOpen(false);
  };

  // Filter tasks by search query, priority, and stage
  const filteredTasks = tasks.filter((task) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(q);
      const matchId = task.projectTaskId.toLowerCase().includes(q);
      const matchDesc = task.description?.toLowerCase().includes(q) || false;
      if (!matchTitle && !matchId && !matchDesc) return false;
    }

    if (selectedPriority !== "ALL" && task.priority !== selectedPriority) {
      return false;
    }

    if (activeStageFilter !== "ALL" && task.stage !== activeStageFilter) {
      return false;
    }

    return true;
  });

  const columnsToRender = activeStageFilter === "ALL"
    ? GOVERNED_STAGES
    : GOVERNED_STAGES.filter((s) => s.stage === activeStageFilter);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-50/50 dark:bg-zinc-950/50">
      {/* Toast Error Alert */}
      {toastError && (
        <div className="absolute top-4 right-4 z-50 bg-rose-900/90 text-white border border-rose-700 px-4 py-2.5 rounded-lg text-xs shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-4 h-4 text-rose-300 shrink-0" />
          <span>{toastError}</span>
          <button onClick={() => setToastError(null)} className="ml-2 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Kanban Sub-Header & Controls */}
      <div className="px-4 sm:px-6 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider font-mono">
            {currentProject?.key || "EQ"}
          </span>
          <span className="text-xs text-zinc-400 font-medium truncate">
            {currentProject?.name || "Enterprise Operations"}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-semibold">
            {filteredTasks.length} tasks
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs pl-8 pr-3 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 w-32 sm:w-44"
            />
          </div>

          {/* Priority Filter */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="text-xs px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 focus:outline-none"
          >
            <option value="ALL">All Priorities</option>
            <option value="URGENT">Urgent</option>
            <option value="HIGH">High</option>
            <option value="MEDIUM">Medium</option>
            <option value="LOW">Low</option>
          </select>

          {/* New Task Button */}
          <button
            onClick={() => {
              setCreateStage("PROPOSED");
              setIsCreateOpen(true);
            }}
            className="text-xs font-semibold px-3 py-1 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 flex items-center gap-1 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Task</span>
          </button>
        </div>
      </div>

      {/* Stage Quick Switcher Pills (Mobile Friendly) */}
      <div className="px-4 sm:px-6 py-2 border-b border-zinc-200/60 dark:border-zinc-800/60 bg-white/50 dark:bg-zinc-900/50 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
        <button
          onClick={() => setActiveStageFilter("ALL")}
          className={`text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition-colors ${
            activeStageFilter === "ALL"
              ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
              : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
          }`}
        >
          All Stages ({tasks.length})
        </button>
        {GOVERNED_STAGES.map((col) => {
          const count = tasks.filter((t) => t.stage === col.stage).length;
          return (
            <button
              key={col.stage}
              onClick={() => setActiveStageFilter(col.stage)}
              className={`text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition-colors flex items-center gap-1 ${
                activeStageFilter === col.stage
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                  : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
              }`}
            >
              <span>{col.label}</span>
              <span className="opacity-70 text-[10px]">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Columns Container: Information-Dense, Smooth Horizontal Scroll */}
      <div className="flex-1 overflow-x-auto p-4 sm:p-6 flex items-start gap-3.5">
        {columnsToRender.map((col) => {
          const colTasks = filteredTasks
            .filter((t) => t.stage === col.stage)
            .sort((a, b) => a.order - b.order);

          const isOver = dragOverStage === col.stage;

          return (
            <div
              key={col.stage}
              onDragOver={(e) => handleDragOver(e, col.stage)}
              onDrop={(e) => handleDrop(e, col.stage)}
              className={`w-72 sm:w-80 shrink-0 flex flex-col max-h-full rounded-xl border bg-zinc-100/70 dark:bg-zinc-900/50 backdrop-blur-xs transition-all ${
                isOver
                  ? "border-blue-500 bg-blue-50/20 dark:bg-blue-950/20 shadow-md ring-1 ring-blue-400/30"
                  : "border-zinc-200/80 dark:border-zinc-800/80"
              }`}
            >
              {/* Column Header */}
              <div className="px-3.5 py-2.5 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full border-2 ${col.accent}`} />
                  <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 tracking-tight">
                    {col.label}
                  </h3>
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    {colTasks.length}
                  </span>
                </div>

                <button
                  onClick={() => {
                    setCreateStage(col.stage);
                    setIsCreateOpen(true);
                  }}
                  title={`Add task to ${col.label}`}
                  className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Tasks List */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-2 min-h-[140px]">
                {colTasks.length === 0 ? (
                  <div className="h-28 border border-dashed border-zinc-300 dark:border-zinc-800/80 rounded-lg flex flex-col items-center justify-center text-zinc-400 text-center p-3">
                    <span className="text-[11px] font-medium">No tasks in this stage</span>
                    <span className="text-[10px] text-zinc-400/80 mt-0.5">Drag tickets here</span>
                  </div>
                ) : (
                  colTasks.map((task) => {
                    const taskComments = comments.filter((c) => c.taskId === task.id);
                    return (
                      <KanbanCard
                        key={task.id}
                        task={task}
                        commentCount={taskComments.length}
                        userRole={currentRole}
                        isDragging={draggingTaskId === task.id}
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onDragEnd={() => setDraggingTaskId(null)}
                        onClick={() => setSelectedTask(task)}
                        onStageChange={(tId, nextStage) => handleStageTransition(tId, nextStage)}
                      />
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Governance Detail / Edit Modal */}
      {selectedTask && (
        <TaskGovernanceModal
          task={selectedTask}
          comments={comments.filter((c) => c.taskId === selectedTask.id)}
          currentRole={currentRole}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          onClose={() => {
            setSelectedTask(null);
            loadData();
          }}
          onTaskUpdated={() => loadData()}
        />
      )}

      {/* New Task Quick Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                New Governed Ticket ({createStage.replace(/_/g, " ")})
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Objective & Description
                </label>
                <textarea
                  rows={3}
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Priority
                  </label>
                  <select
                    value={newPriority}
                    onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Initial Stage
                  </label>
                  <select
                    value={createStage}
                    onChange={(e) => setCreateStage(e.target.value as TaskStage)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  >
                    {GOVERNED_STAGES.map((s) => (
                      <option key={s.stage} value={s.stage}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 shadow-sm"
                >
                  Create Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
