"use client";

import React, { useState } from "react";
import { LocalProject, LocalTask, LocalPage } from "@/lib/dexie";
import { WorkspaceRole, TaskStage } from "@prisma/client";
import {
  FolderGit2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Code2,
  ShieldCheck,
  Plus,
  ArrowRight,
  FileText,
  Calendar,
  Layers,
  ChevronRight,
  User,
  Users,
} from "lucide-react";

interface WorkspaceDashboardProps {
  workspaceName: string;
  workspaceSlug: string;
  currentUser: {
    id: string;
    name: string;
    email: string;
    role: WorkspaceRole;
  };
  projects: LocalProject[];
  tasks: LocalTask[];
  pages: LocalPage[];
  onSelectProject: (project: LocalProject) => void;
  onSelectPage: (pageId: string) => void;
  onOpenDiary: () => void;
  onNewTask: (projectId?: string) => void;
  onOpenTask: (task: LocalTask) => void;
}

export function WorkspaceDashboard({
  workspaceName,
  workspaceSlug,
  currentUser,
  projects,
  tasks,
  pages,
  onSelectProject,
  onSelectPage,
  onOpenDiary,
  onNewTask,
  onOpenTask,
}: WorkspaceDashboardProps) {
  // 1. Status Strip Calculations
  const activeProjectsCount = projects.filter((p) => !p.deletedAt).length;
  const openTasks = tasks.filter((t) => !t.deletedAt && t.stage !== "APPROVED_CLEARED" && t.stage !== "ARCHIVED");
  const devAssessmentTasks = tasks.filter((t) => !t.deletedAt && t.stage === "DEV_ASSESSMENT");
  const hooApprovalTasks = tasks.filter((t) => !t.deletedAt && t.stage === "READY_FOR_TESTING");

  // 2. Action Queue ("Ball-in-Court") Filtering
  const getBallInCourtTasks = (): LocalTask[] => {
    switch (currentUser.role) {
      case "DEVELOPER":
        return tasks.filter((t) => t.stage === "DEV_ASSESSMENT" || t.stage === "IN_PROGRESS");
      case "HOO":
        return tasks.filter((t) => t.stage === "READY_FOR_TESTING" || t.stage === "PROPOSED");
      case "TECH_ASSISTANT":
        return tasks.filter((t) => t.stage === "TA_REVIEW");
      case "OWNER":
      default:
        // Owner sees all tasks awaiting action across all stages
        return tasks.filter((t) => t.stage === "DEV_ASSESSMENT" || t.stage === "READY_FOR_TESTING" || t.stage === "TA_REVIEW");
    }
  };

  const ballInCourtTasks = getBallInCourtTasks();

  // 3. Today's Diary and Recent Docs
  const recentPages = pages
    .filter((p) => !p.deletedAt && !p.isDiary)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const todayIso = new Date().toISOString().split("T")[0];
  const todayDiary = pages.find((p) => p.isDiary && p.diaryDate && new Date(p.diaryDate).toISOString().startsWith(todayIso));

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50/60 dark:bg-zinc-950 p-4 sm:p-8 space-y-6">
      {/* Top Welcome & Executive Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
              {workspaceName} Operations Overview
            </h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Logged in as <strong className="text-zinc-700 dark:text-zinc-300">{currentUser.name}</strong> ({currentUser.role.replace(/_/g, " ")})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNewTask()}
            className="text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create Governed Ticket</span>
          </button>
        </div>
      </div>

      {/* 1. AGGREGATED STATUS STRIP */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Active Projects */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-semibold">
            <span>Active Streams</span>
            <FolderGit2 className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 font-mono">
            {activeProjectsCount}
          </div>
          <p className="text-[10px] text-zinc-400">Equity & HR Operations streams</p>
        </div>

        {/* Metric 2: Open Tasks */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 text-xs font-semibold">
            <span>Open Tasks</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 font-mono">
            {openTasks.length}
          </div>
          <p className="text-[10px] text-zinc-400">Across all projects</p>
        </div>

        {/* Metric 3: Dev Recommendation Queue */}
        <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/30 dark:bg-purple-950/20 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-purple-700 dark:text-purple-300 text-xs font-semibold">
            <span>Dev Recommendations</span>
            <Code2 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-2xl font-bold text-purple-900 dark:text-purple-100 font-mono">
            {devAssessmentTasks.length}
          </div>
          <p className="text-[10px] text-purple-600/70 dark:text-purple-400/70">Awaiting architecture plan</p>
        </div>

        {/* Metric 4: HOO QA Approval Queue */}
        <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/20 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300 text-xs font-semibold">
            <span>HOO QA Approval</span>
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100 font-mono">
            {hooApprovalTasks.length}
          </div>
          <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70">Staging verification sign-off</p>
        </div>
      </div>

      {/* 2. PROJECT CARDS MATRIX */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Governed Project Streams
          </h2>
          <span className="text-[11px] text-zinc-400 font-medium">Click card to open Kanban</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((proj) => {
            const projectTasks = tasks.filter((t) => t.projectId === proj.id && !t.deletedAt);
            const clearedCount = projectTasks.filter((t) => t.stage === "APPROVED_CLEARED").length;
            const velocity = projectTasks.length > 0 ? Math.round((clearedCount / projectTasks.length) * 100) : 0;
            const blockers = projectTasks.filter(
              (t) => (t.priority === "URGENT" || t.priority === "HIGH") && t.stage !== "APPROVED_CLEARED" && t.stage !== "ARCHIVED"
            ).length;

            return (
              <div
                key={proj.id}
                onClick={() => onSelectProject(proj)}
                className="group relative rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-xs hover:shadow-md hover:border-zinc-300 dark:hover:border-zinc-700 transition-all cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Color Accent Indicator & Key */}
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="px-2 py-0.5 rounded text-[11px] font-bold font-mono text-white shadow-xs"
                      style={{ backgroundColor: proj.colorAccent || "#2563eb" }}
                    >
                      {proj.key}
                    </span>
                    {blockers > 0 && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/60 px-2 py-0.5 rounded-full border border-rose-200 dark:border-rose-800">
                        <AlertTriangle className="w-3 h-3" />
                        <span>{blockers} High Priority</span>
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {proj.name}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 mt-1 leading-relaxed">
                    {proj.description || "Active operational delivery workspace."}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                  {/* Completion Velocity Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px] text-zinc-400">
                      <span>Velocity</span>
                      <span className="font-mono font-semibold text-zinc-700 dark:text-zinc-300">{velocity}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${velocity}%`,
                          backgroundColor: proj.colorAccent || "#2563eb",
                        }}
                      />
                    </div>
                  </div>

                  {/* Footer with tasks count and quick actions */}
                  <div className="flex items-center justify-between pt-1 text-[11px] text-zinc-400">
                    <span>{projectTasks.length} tickets</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNewTask(proj.id);
                      }}
                      className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white flex items-center gap-0.5"
                    >
                      <span>+ Ticket</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. ACTION QUEUE ("BALL-IN-COURT") */}
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 sm:p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              Action Queue (Ball-in-Court: {currentUser.role.replace(/_/g, " ")})
            </h2>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Tasks requiring direct action, review, architecture specification, or sign-off from your role.
            </p>
          </div>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-semibold">
            {ballInCourtTasks.length} action items
          </span>
        </div>

        {ballInCourtTasks.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-400">
            <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5 opacity-80" />
            <span>No bottleneck tasks pending your role. All systems in flow.</span>
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {ballInCourtTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => onOpenTask(task)}
                className="py-2.5 flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 px-2 rounded-lg cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-mono text-xs font-bold text-zinc-600 dark:text-zinc-300 shrink-0">
                    {task.projectTaskId}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                      {task.title}
                    </p>
                    <span className="text-[10px] text-zinc-400 capitalize">
                      {task.stage.replace(/_/g, " ").toLowerCase()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[9px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      task.priority === "URGENT"
                        ? "bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                        : task.priority === "HIGH"
                        ? "bg-amber-50 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
                        : "bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
                    }`}
                  >
                    {task.priority}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenTask(task);
                    }}
                    className="text-xs px-2.5 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-semibold flex items-center gap-1"
                  >
                    <span>Inspect</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. WORKSPACE DIARY & SPECIFICATION HUB */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Diary Widget */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-xs flex flex-col justify-between space-y-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-800 dark:text-zinc-200">
              <Calendar className="w-4 h-4 text-indigo-500" />
              <span>Today&apos;s Daily Operations Diary</span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1">
              Maintain daily execution logs, standup records, and blocker checklists.
            </p>
          </div>

          <button
            onClick={onOpenDiary}
            className="w-full py-2.5 px-3 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 text-xs font-semibold text-zinc-800 dark:text-zinc-200 flex items-center justify-between transition-colors"
          >
            <span>{todayDiary?.title || "Open Today's Diary"}</span>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        </div>

        {/* Specification Documents Hub */}
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-xs space-y-2">
          <div className="flex items-center justify-between pb-1 border-b border-zinc-100 dark:border-zinc-800">
            <div className="flex items-center gap-2 text-xs font-bold text-zinc-800 dark:text-zinc-200">
              <FileText className="w-4 h-4 text-blue-500" />
              <span>Organization Specifications</span>
            </div>
            <span className="text-[10px] text-zinc-400">{recentPages.length} docs</span>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {recentPages.length === 0 ? (
              <div className="py-4 text-center text-xs text-zinc-400">No specifications created yet.</div>
            ) : (
              recentPages.map((p) => (
                <div
                  key={p.id}
                  onClick={() => onSelectPage(p.id)}
                  className="py-2 flex items-center justify-between text-xs hover:text-blue-500 cursor-pointer transition-colors"
                >
                  <span className="truncate font-medium text-zinc-800 dark:text-zinc-200">
                    {p.title || "Untitled Document"}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
