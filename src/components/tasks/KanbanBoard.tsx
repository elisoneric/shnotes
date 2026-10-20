"use client";

import React, { useState, useEffect } from "react";
import { localDb, LocalTask, LocalTaskComment, LocalProject, LocalProjectStage } from "@/lib/dexie";
import { TaskStage, TaskPriority, WorkspaceRole, CommentType } from "@prisma/client";
import { KanbanCard } from "@/components/tasks/KanbanCard";
import { TaskGovernanceModal } from "@/components/tasks/TaskGovernanceModal";
import { syncManager } from "@/lib/sync";
import {
  Plus,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
} from "lucide-react";

interface KanbanBoardProps {
  currentProject: LocalProject | null;
  currentRole: WorkspaceRole;
  currentUserId: string;
  currentUserName: string;
}

export const DEFAULT_PROJECT_STAGES: {
  name: string;
  color: string;
  order: number;
  isCompleted: boolean;
}[] = [
  { name: "Backlog / Requests", color: "#94a3b8", order: 1, isCompleted: false },
  { name: "In Review & Spec", color: "#a855f7", order: 2, isCompleted: false },
  { name: "In Progress", color: "#3b82f6", order: 3, isCompleted: false },
  { name: "Ready for QA & Sign-Off", color: "#10b981", order: 4, isCompleted: true },
];

function mapStageToLegacyEnum(stageOrder: number, isCompleted: boolean): TaskStage {
  if (isCompleted) return "APPROVED_CLEARED";
  if (stageOrder <= 1) return "PROPOSED";
  if (stageOrder === 2) return "DEV_ASSESSMENT";
  if (stageOrder === 3) return "IN_PROGRESS";
  return "READY_FOR_TESTING";
}

function taskMatchesStage(task: LocalTask, stage: LocalProjectStage, allStages: LocalProjectStage[]): boolean {
  if (task.stageId) {
    return task.stageId === stage.id;
  }

  // Fallback mapping for existing tasks that don't have stageId set yet
  if (stage.order === 1) {
    return task.stage === "PROPOSED" || task.stage === "TA_REVIEW";
  }
  if (stage.order === 2) {
    return task.stage === "DEV_ASSESSMENT" || task.stage === "CONFIRMED_READY";
  }
  if (stage.order === 3) {
    return task.stage === "IN_PROGRESS";
  }
  if (stage.isCompleted || stage.order >= 4) {
    return task.stage === "READY_FOR_TESTING" || task.stage === "APPROVED_CLEARED" || task.stage === "ARCHIVED";
  }

  return false;
}

export function KanbanBoard({
  currentProject,
  currentRole,
  currentUserId,
  currentUserName,
}: KanbanBoardProps) {
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [stages, setStages] = useState<LocalProjectStage[]>([]);
  const [comments, setComments] = useState<LocalTaskComment[]>([]);
  const [selectedTask, setSelectedTask] = useState<LocalTask | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<string>("ALL");
  const [activeStageFilter, setActiveStageFilter] = useState<string>("ALL");
  const [toastError, setToastError] = useState<string | null>(null);

  // Drag and Drop state
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);

  // New task modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createStageId, setCreateStageId] = useState<string>("");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("MEDIUM");

  const loadData = async () => {
    try {
      // 1. Load or initialize project stages
      let projectStages: LocalProjectStage[] = [];
      if (currentProject) {
        projectStages = await localDb.projectStages
          .where("projectId")
          .equals(currentProject.id)
          .sortBy("order");

        if (projectStages.length === 0) {
          // Seed the 4 standard stages for this project
          const defaultStages: LocalProjectStage[] = DEFAULT_PROJECT_STAGES.map((s) => ({
            id: `stage_${currentProject.id}_${s.order}`,
            projectId: currentProject.id,
            name: s.name,
            color: s.color,
            order: s.order,
            isCompleted: s.isCompleted,
          }));

          await localDb.projectStages.bulkPut(defaultStages);
          projectStages = defaultStages;

          for (const stg of defaultStages) {
            await syncManager.queueMutation("projectStage", stg.id, "UPSERT", {
              projectId: stg.projectId,
              name: stg.name,
              color: stg.color,
              order: stg.order,
              isCompleted: stg.isCompleted,
            });
          }
        }
      } else {
        // Fallback stages for personal space
        projectStages = DEFAULT_PROJECT_STAGES.map((s) => ({
          id: `stage_personal_${s.order}`,
          projectId: "personal",
          name: s.name,
          color: s.color,
          order: s.order,
          isCompleted: s.isCompleted,
        }));
      }

      setStages(projectStages);

      // 2. Load tasks
      let query = localDb.tasks.filter((t) => !t.deletedAt);
      if (currentProject) {
        query = query.filter((t) => t.projectId === currentProject.id);
      }
      const loadedTasks = await query.toArray();
      const loadedComments = await localDb.taskComments.toArray();

      setTasks(loadedTasks);
      setComments(loadedComments);
    } catch (err) {
      console.warn("Failed to load local tasks or stages:", err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2500);
    return () => clearInterval(interval);
  }, [currentProject]);

  const showToast = (msg: string) => {
    setToastError(msg);
    setTimeout(() => setToastError(null), 4000);
  };

  // Perform optimistic stage update with audit log insertion
  const handleStageTransition = async (taskId: string, targetStage: LocalProjectStage, customOrder?: number) => {
    const existing = tasks.find((t) => t.id === taskId);
    if (!existing) return;

    if (existing.stageId === targetStage.id && customOrder === undefined) return;

    const previousStageName = stages.find((s) => s.id === existing.stageId)?.name || existing.stage.replace(/_/g, " ");
    const finalOrder = customOrder !== undefined ? customOrder : existing.order;
    const legacyStage = mapStageToLegacyEnum(targetStage.order, targetStage.isCompleted);

    // 1. Optimistic update
    const updatedTask: LocalTask = {
      ...existing,
      stageId: targetStage.id,
      stage: legacyStage,
      order: finalOrder,
      updatedAt: new Date(),
      version: existing.version + 1,
    };

    setTasks((prev) => prev.map((t) => (t.id === taskId ? updatedTask : t)));

    try {
      await localDb.tasks.put(updatedTask);

      // 2. Insert automated STAGE_CHANGE_AUDIT comment
      if (previousStageName !== targetStage.name) {
        const auditComment: LocalTaskComment = {
          id: `comment_audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          taskId,
          userId: currentUserId,
          userName: currentUserName,
          userRole: currentRole,
          type: CommentType.STAGE_CHANGE_AUDIT,
          content: `Stage transitioned from ${previousStageName} to ${targetStage.name} by ${currentUserName} (${currentRole.replace(/_/g, " ")}).`,
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
        stageId: targetStage.id,
        stage: legacyStage,
        order: finalOrder,
      });
    } catch (err: any) {
      setTasks((prev) => prev.map((t) => (t.id === taskId ? existing : t)));
      showToast(`Failed to update task stage: ${err?.message || "Storage error"}`);
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
    setDraggingTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    if (dragOverStageId !== stageId) {
      setDragOverStageId(stageId);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStage: LocalProjectStage) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("text/plain") || draggingTaskId;
    setDraggingTaskId(null);
    setDragOverStageId(null);

    if (!taskId) return;

    // Calculate fractional order in destination column
    const columnTasks = tasks
      .filter((t) => taskMatchesStage(t, targetStage, stages) && t.id !== taskId)
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

    const chosenStage = stages.find((s) => s.id === createStageId) || stages[0];
    const initialStageId = chosenStage?.id;
    const legacyStage = chosenStage ? mapStageToLegacyEnum(chosenStage.order, chosenStage.isCompleted) : TaskStage.PROPOSED;

    const taskItem: LocalTask = {
      id: newId,
      projectTaskId: humanId,
      title: newTitle.trim(),
      description: newDesc.trim() || null,
      stage: legacyStage,
      stageId: initialStageId,
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
      stageId: taskItem.stageId,
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

    if (activeStageFilter !== "ALL") {
      const targetStage = stages.find((s) => s.id === activeStageFilter);
      if (targetStage && !taskMatchesStage(task, targetStage, stages)) {
        return false;
      }
    }

    return true;
  });

  const columnsToRender = activeStageFilter === "ALL"
    ? stages
    : stages.filter((s) => s.id === activeStageFilter);

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
              aria-label="Search tickets"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs pl-8 pr-3 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 w-32 sm:w-44"
            />
          </div>

          {/* Priority Filter */}
          <select
            aria-label="Filter by priority"
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
              setCreateStageId(stages[0]?.id || "");
              setIsCreateOpen(true);
            }}
            className="text-xs font-semibold px-3 py-1 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 flex items-center gap-1 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">New Task</span>
          </button>
        </div>
      </div>

      {/* Dynamic Stage Quick Switcher Pills */}
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
        {stages.map((stage) => {
          const count = tasks.filter((t) => taskMatchesStage(t, stage, stages)).length;
          return (
            <button
              key={stage.id}
              onClick={() => setActiveStageFilter(stage.id)}
              className={`text-[11px] px-2.5 py-1 rounded-full whitespace-nowrap font-medium transition-colors flex items-center gap-1.5 ${
                activeStageFilter === stage.id
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold"
                  : "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800"
              }`}
            >
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: stage.color }}
              />
              <span>{stage.name}</span>
              <span className="opacity-70 text-[10px]">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Dynamic Columns Container */}
      <div className="flex-1 overflow-x-auto p-4 sm:p-6 flex items-start gap-3.5">
        {columnsToRender.map((stage) => {
          const colTasks = filteredTasks
            .filter((t) => taskMatchesStage(t, stage, stages))
            .sort((a, b) => a.order - b.order);

          const isOver = dragOverStageId === stage.id;

          return (
            <div
              key={stage.id}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDrop={(e) => handleDrop(e, stage)}
              className={`w-72 sm:w-80 shrink-0 flex flex-col max-h-full rounded-xl border bg-zinc-100/70 dark:bg-zinc-900/50 backdrop-blur-xs transition-all ${
                isOver
                  ? "border-blue-500 bg-blue-50/20 dark:bg-blue-950/20 shadow-md ring-1 ring-blue-400/30"
                  : "border-zinc-200/80 dark:border-zinc-800/80"
              }`}
            >
              {/* Column Header */}
              <div className="px-3.5 py-2.5 border-b border-zinc-200/80 dark:border-zinc-800/80 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: stage.color }}
                  />
                  <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 tracking-tight truncate">
                    {stage.name}
                  </h3>
                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    {colTasks.length}
                  </span>
                </div>

                <button
                  onClick={() => {
                    setCreateStageId(stage.id);
                    setIsCreateOpen(true);
                  }}
                  title={`Add task to ${stage.name}`}
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
                        stageName={stage.name}
                        stageColor={stage.color}
                        commentCount={taskComments.length}
                        userRole={currentRole}
                        isDragging={draggingTaskId === task.id}
                        onDragStart={(e) => handleDragStart(e, task.id)}
                        onDragEnd={() => setDraggingTaskId(null)}
                        onClick={() => setSelectedTask(task)}
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
          stages={stages}
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
                New Task Ticket
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
                    value={createStageId}
                    onChange={(e) => setCreateStageId(e.target.value)}
                    className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  >
                    {stages.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
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
