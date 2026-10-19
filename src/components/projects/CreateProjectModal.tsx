"use client";

import React, { useState } from "react";
import { localDb, LocalProject } from "@/lib/dexie";
import { syncManager } from "@/lib/sync";
import { FolderGit2, X } from "lucide-react";

interface CreateProjectModalProps {
  workspaceId: string;
  currentUserId: string;
  currentUserName: string;
  onClose: () => void;
  onProjectCreated: (project: LocalProject) => void;
}

export function CreateProjectModal({
  workspaceId,
  currentUserId,
  currentUserName,
  onClose,
  onProjectCreated,
}: CreateProjectModalProps) {
  const [name, setName] = useState("");
  const [key, setKey] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!key || key === autoKey(name)) {
      setKey(autoKey(val));
    }
  };

  const autoKey = (str: string) => {
    const clean = str.replace(/[^a-zA-Z]/g, "").toUpperCase();
    return clean.slice(0, 3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || submitting) return;

    setSubmitting(true);
    try {
      const finalKey = (key.trim() || autoKey(name) || "PRJ").slice(0, 4).toUpperCase();
      const newId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      const newProject: LocalProject = {
        id: newId,
        name: name.trim(),
        key: finalKey,
        description: description.trim() || null,
        workspaceId,
        ownerName: currentUserName,
        guideName: null,
        version: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await localDb.projects.add(newProject);
      await syncManager.queueMutation("project", newId, "UPSERT", {
        name: newProject.name,
        key: newProject.key,
        description: newProject.description,
        workspaceId,
        ownerName: currentUserName,
      });

      onProjectCreated(newProject);
      onClose();
    } catch (err) {
      console.warn("Failed to create project:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl p-6 space-y-4"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-4 h-4 text-zinc-500" />
            <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Create Project</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
            Project Name *
          </label>
          <input
            type="text"
            required
            autoFocus
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Project title"
            className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
            Key Prefix (up to 4 letters) *
          </label>
          <input
            type="text"
            required
            maxLength={4}
            value={key}
            onChange={(e) => setKey(e.target.value.toUpperCase())}
            placeholder="KEY"
            className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-mono uppercase focus:outline-none focus:ring-1 focus:ring-zinc-400"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            rows={2}
            className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
          />
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-4 py-2 rounded-xl text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || submitting}
            className="text-xs font-semibold px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
          >
            {submitting ? "Creating..." : "Create Project"}
          </button>
        </div>
      </form>
    </div>
  );
}
