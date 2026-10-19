"use client";

import React, { useState, useEffect } from "react";
import { localDb, LocalTask, LocalTaskComment, LocalProject } from "@/lib/dexie";
import { TaskStage, TaskPriority, WorkspaceRole } from "@prisma/client";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskGovernanceModal } from "@/components/tasks/TaskGovernanceModal";
import { syncManager } from "@/lib/sync";
import {
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Circle,
  FolderGit2,
  X,
} from "lucide-react";

interface TaskBoardProps {
  currentProject: LocalProject | null;
  currentRole: WorkspaceRole;
  currentUserId: string;
  currentUserName: string;
}

const COLUMNS: {
  id: string;
  title: string;
  stages: TaskStage[];
  defaultStage: TaskStage;
}[] = [
  {
    id: "TODO",
    title: "To Do",
    stages: ["PROPOSED", "TA_REVIEW", "DEV_ASSESSMENT", "CONFIRMED_READY"],
    defaultStage: "PROPOSED",
  },
  {
    id: "IN_PROGRESS",
    title: "In Progress",
    stages: ["IN_PROGRESS", "READY_FOR_TESTING"],
    defaultStage: "IN_PROGRESS",
  },
  {
    id: "DONE",
    title: "Done",
    stages: ["APPROVED_CLEARED", "ARCHIVED"],
    defaultStage: "APPROVED_CLEARED",
  },
];

export function TaskBoard({
  currentProject,
  currentRole,
  currentUserId,
  currentUserName,
}: TaskBoardProps) {
  const [tasks, setTasks] = useState<LocalTask[]>([]);
  const [comments, setComments] = useState<LocalTaskComment[]>([]);
  const [selectedTask, setSelectedTask] = useState<LocalTask | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<string>("ALL");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createStage, setCreateStage] = useState<TaskStage>("PROPOSED");

  // New task form state
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
    const interval = setInterval(loadData, 2500);
    return () => clearInterval(interval);
  }, [currentProject]);

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

    await syncManager.queueMutation("task", newId, "UPSERT", {
      projectId: currentProject.id,
      title: newTitle.trim(),
      description: newDesc.trim() || null,
      stage: createStage,
      priority: newPriority,
      order: count + 1.0,
    });

    setNewTitle("");
    setNewDesc("");
    setNewPriority("MEDIUM");
    setCreateStage("PROPOSED");
    setIsCreateModalOpen(false);
    loadData();
  };

  const openCreateForColumn = (stage: TaskStage) => {
    setCreateStage(stage);
    setIsCreateModalOpen(true);
  };

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch =
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.projectTaskId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority =
      selectedPriority === "ALL" || t.priority === selectedPriority;
    return matchesSearch && matchesPriority;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-50/50 dark:bg-zinc-950/20 font-sans">
      {/* Top Filter & Action Bar */}
      <div className="px-6 py-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-5 h-5 text-zinc-500" />
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50">
              {currentProject?.name || "Tasks"}
            </h2>
            {currentProject && (
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold">
                {currentProject.key}
              </span>
            )}
          </div>

          <span className="text-xs text-zinc-300 dark:text-zinc-700">•</span>
          <span className="text-xs text-zinc-500 font-medium">
            {filteredTasks.length} {filteredTasks.length === 1 ? "task" : "tasks"}
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="text-xs pl-8 pr-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 w-44 sm:w-56"
            />
          </div>

          {/* Priority Filter */}
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 focus:outline-none"
          >
            <option value="ALL">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>

          {/* New Task Button */}
          <button
            onClick={() => openCreateForColumn("PROPOSED")}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 transition-opacity flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Task</span>
          </button>
        </div>
      </div>

      {/* 3-Column Simple Task Board */}
      <div className="flex-1 overflow-x-auto p-6 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto w-full">
        {COLUMNS.map((col) => {
          const colTasks = filteredTasks.filter((t) =>
            col.stages.includes(t.stage)
          );

          return (
            <div
              key={col.id}
              className="flex flex-col rounded-2xl bg-zinc-100/70 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800/80 p-3.5 max-h-full"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-zinc-200/80 dark:border-zinc-800/80">
                <div className="flex items-center gap-2">
                  {col.id === "TODO" && (
                    <Circle className="w-3.5 h-3.5 text-zinc-400" />
                  )}
                  {col.id === "IN_PROGRESS" && (
                    <Clock className="w-3.5 h-3.5 text-blue-500" />
                  )}
                  {col.id === "DONE" && (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  )}

                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider">
                    {col.title}
                  </span>
                  <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-zinc-200/80 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                    {colTasks.length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => openCreateForColumn(col.defaultStage)}
                  title={`Add task to ${col.title}`}
                  className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Tasks Cards Stream */}
              <div className="flex-1 overflow-y-auto space-y-2.5 pr-0.5">
                {colTasks.length === 0 ? (
                  <div className="py-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800/60 rounded-xl text-xs text-zinc-400">
                    No tasks in {col.title}
                  </div>
                ) : (
                  colTasks.map((t) => {
                    const taskComments = comments.filter((c) => c.taskId === t.id);
                    return (
                      <TaskCard
                        key={t.id}
                        task={t}
                        commentCount={taskComments.length}
                        onClick={() => setSelectedTask(t)}
                      />
                    );
                  })
                )}
              </div>

              {/* Quick Add Button at bottom of column */}
              <button
                type="button"
                onClick={() => openCreateForColumn(col.defaultStage)}
                className="mt-3 w-full py-2 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add task</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Task Detail Modal */}
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
          onTaskUpdated={() => {
            loadData();
            localDb.tasks.get(selectedTask.id).then((t) => {
              if (t) setSelectedTask(t);
            });
          }}
        />
      )}

      {/* Create New Task Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <form
            onSubmit={handleCreateTask}
            className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
                <span>Create New Task</span>
                {currentProject && (
                  <span className="font-mono text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold">
                    {currentProject.key}
                  </span>
                )}
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Task Title *
              </label>
              <input
                type="text"
                required
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="What needs to be done?"
                className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Notes & Description
              </label>
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Add notes, details, or steps"
                rows={3}
                className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Status
                </label>
                <select
                  value={
                    createStage === "APPROVED_CLEARED"
                      ? "DONE"
                      : createStage === "IN_PROGRESS"
                      ? "IN_PROGRESS"
                      : "TODO"
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "DONE") setCreateStage("APPROVED_CLEARED");
                    else if (val === "IN_PROGRESS") setCreateStage("IN_PROGRESS");
                    else setCreateStage("PROPOSED");
                  }}
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                >
                  <option value="TODO">To Do</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="DONE">Done</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Priority
                </label>
                <select
                  value={newPriority}
                  onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                  className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-xs px-4 py-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="text-xs font-semibold px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 shadow-sm"
              >
                Create Task
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
