"use client";

import React, { useState, useEffect } from "react";
import { LocalProject, LocalTask, localDb } from "@/lib/dexie";
import { syncManager } from "@/lib/sync";
import {
  FolderGit2,
  X,
  Palette,
  Archive,
  RotateCcw,
  Check,
  Trash2,
} from "lucide-react";

interface ProjectSettingsModalProps {
  project: LocalProject;
  onClose: () => void;
  onProjectUpdated: (updated: LocalProject) => void;
}

const PRESET_COLORS = [
  "#2563eb", // Blue
  "#7c3aed", // Purple
  "#059669", // Emerald
  "#d97706", // Amber
  "#e11d48", // Rose
  "#0891b2", // Cyan
  "#4f46e5", // Indigo
  "#52525b", // Zinc
];

export function ProjectSettingsModal({
  project,
  onClose,
  onProjectUpdated,
}: ProjectSettingsModalProps) {
  const [name, setName] = useState(project.name);
  const [key, setKey] = useState(project.key);
  const [description, setDescription] = useState(project.description || "");
  const [colorAccent, setColorAccent] = useState(project.colorAccent || "#2563eb");
  const [archivedTasks, setArchivedTasks] = useState<LocalTask[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Load archived tasks for this project
  const loadArchived = async () => {
    try {
      const archived = await localDb.tasks
        .filter((t) => t.projectId === project.id && (t.isArchived || t.stage === "ARCHIVED"))
        .toArray();
      setArchivedTasks(archived);
    } catch (err) {
      console.warn("Could not load archived tasks:", err);
    }
  };

  useEffect(() => {
    loadArchived();
  }, [project.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !key.trim()) return;

    setIsSaving(true);
    try {
      const updated: LocalProject = {
        ...project,
        name: name.trim(),
        key: key.trim().toUpperCase(),
        description: description.trim() || null,
        colorAccent,
        updatedAt: new Date(),
        version: project.version + 1,
      };

      await localDb.projects.put(updated);
      await syncManager.queueMutation("project", project.id, "UPSERT", {
        name: updated.name,
        key: updated.key,
        description: updated.description,
        colorAccent: updated.colorAccent,
        workspaceId: project.workspaceId,
      });

      onProjectUpdated(updated);
      setStatusMessage("Project settings saved.");
      setTimeout(onClose, 1000);
    } catch (err: any) {
      setStatusMessage(err.message || "Failed to save project.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRestoreTask = async (taskId: string) => {
    try {
      const t = await localDb.tasks.get(taskId);
      if (!t) return;

      const restored: LocalTask = {
        ...t,
        isArchived: false,
        stage: "PROPOSED",
        updatedAt: new Date(),
        version: t.version + 1,
      };

      await localDb.tasks.put(restored);
      await syncManager.queueMutation("task", taskId, "STAGE_CHANGE", {
        stage: "PROPOSED",
        isArchived: false,
      });

      setArchivedTasks((prev) => prev.filter((item) => item.id !== taskId));
      setStatusMessage(`Restored ${t.projectTaskId} to To Do.`);
    } catch (err) {
      console.warn("Failed to restore task:", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: colorAccent }}
            />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Project Settings: {project.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-4">
          {statusMessage && (
            <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-500" />
              <span>{statusMessage}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Project Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Ticket Key Prefix
              </label>
              <input
                type="text"
                required
                maxLength={5}
                value={key}
                onChange={(e) => setKey(e.target.value.toUpperCase())}
                className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Color Accent
              </label>
              <div className="flex items-center gap-1.5 pt-1">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColorAccent(c)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      colorAccent === c ? "border-zinc-900 dark:border-white scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none resize-none"
            />
          </div>

          {/* Archived Tasks Registry */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1">
                <Archive className="w-3.5 h-3.5" />
                <span>Archived Tasks Registry ({archivedTasks.length})</span>
              </span>
            </div>

            <div className="max-h-32 overflow-y-auto space-y-1 border border-zinc-100 dark:border-zinc-800 rounded-lg p-2">
              {archivedTasks.length === 0 ? (
                <div className="text-[11px] text-zinc-400 text-center py-2">
                  No archived tasks in this project.
                </div>
              ) : (
                archivedTasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between text-xs p-1.5 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800"
                  >
                    <span className="truncate font-mono text-[11px] text-zinc-500">
                      [{t.projectTaskId}] {t.title}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRestoreTask(t.id)}
                      className="text-[10px] text-blue-500 hover:underline flex items-center gap-1 shrink-0 ml-2"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Restore</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="text-xs font-semibold px-4 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
