"use client";

import React, { useState, useEffect } from "react";
import { localDb, LocalProject, LocalPage } from "@/lib/dexie";
import { useSync } from "@/lib/useSync";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { DocumentEditor } from "@/components/editor/DocumentEditor";
import { DiaryView } from "@/components/diary/DiaryView";
import { AiChatDrawer } from "@/components/ai/AiChatDrawer";
import { IosInstallModal } from "@/components/pwa/IosInstallModal";
import { RegisterSw } from "@/components/pwa/RegisterSw";
import { WorkspaceRole } from "@prisma/client";
import {
  FolderGit2,
  FileText,
  Calendar,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  WifiOff,
  Moon,
  Sun,
  Plus,
  ChevronDown,
  Columns3,
  PanelLeftClose,
  PanelLeft,
  UserCheck,
  Building2,
  Trash2,
  LogOut,
} from "lucide-react";

export interface ShellProps {
  initialUser?: {
    id: string;
    name: string;
    email: string;
    role: WorkspaceRole;
  };
}

export function Shell({ initialUser }: ShellProps = {}) {
  const { status, pendingCount, triggerSync, isSyncing } = useSync();

  // Navigation State
  const [currentView, setCurrentView] = useState<"TASKS" | "PAGE" | "DIARY">("TASKS");
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<LocalProject | null>(null);
  const [pages, setPages] = useState<LocalPage[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  // User, Workspace & Role State
  const [currentRole, setCurrentRole] = useState<WorkspaceRole>(initialUser?.role || "OWNER");
  const [userName, setUserName] = useState(initialUser?.name || "Project Owner");
  const [userId, setUserId] = useState(initialUser?.id || "user_admin");
  const [workspaceName, setWorkspaceName] = useState("Enterprise Operations");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  // Initialize and load local Dexie data scoped to active workspace
  const refreshLocalData = async (targetWsId?: string) => {
    try {
      const activeWsId = targetWsId || workspaceId;
      const allProjects = await localDb.projects.filter((x) => !x.deletedAt).toArray();
      const p = activeWsId ? allProjects.filter((x) => x.workspaceId === activeWsId) : allProjects;

      const allPages = await localDb.pages.filter((x) => !x.isDiary && !x.deletedAt).toArray();
      setProjects(p);
      setPages(allPages);

      if (p.length > 0 && (!selectedProject || (activeWsId && selectedProject.workspaceId !== activeWsId))) {
        setSelectedProject(p[0]);
      }
      if (allPages.length > 0 && !selectedPageId) {
        setSelectedPageId(allPages[0].id);
      }
    } catch (err) {
      console.warn("Failed to read local Dexie data:", err);
    }
  };

  useEffect(() => {
    // Initial sync trigger on boot
    triggerSync();
    refreshLocalData();

    // Check dark mode
    if (typeof window !== "undefined") {
      const isDark = document.documentElement.classList.contains("dark") || true;
      setDarkMode(isDark);
      if (isDark) document.documentElement.classList.add("dark");

      // Check URL query param ?page=...
      const urlParams = new URLSearchParams(window.location.search);
      const pageParam = urlParams.get("page");
      if (pageParam) {
        setSelectedPageId(pageParam);
        setCurrentView("PAGE");
      }
    }

    const interval = setInterval(() => refreshLocalData(), 3000);
    return () => clearInterval(interval);
  }, [workspaceId]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then(async (data) => {
        if (data.authenticated) {
          if (data.user?.name) setUserName(data.user.name);
          if (data.user?.id) setUserId(data.user.id);
          if (data.user?.role) setCurrentRole(data.user.role);
          if (data.workspace) {
            setWorkspaceName(data.workspace.name);
            setWorkspaceId(data.workspace.id);

            // Clean up stale Dexie projects belonging to other foreign workspaces
            try {
              const wsId = data.workspace.id;
              await localDb.projects.filter((p) => Boolean(p.workspaceId && p.workspaceId !== wsId)).delete();
              refreshLocalData(wsId);
            } catch (err) {
              console.warn("Cleanup error:", err);
            }
          }
        }
      })
      .catch((err) => console.warn("Failed to load user session:", err));
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      await localDb.projects.clear();
      await localDb.pages.clear();
      await localDb.tasks.clear();
      await localDb.taskComments.clear();
      await localDb.syncMeta.clear();
    } catch (err) {
      console.warn("Logout error:", err);
    }
    window.location.href = "/";
  };

  const toggleDarkMode = () => {
    const next = !darkMode;
    setDarkMode(next);
    if (next) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const handleCreatePage = async () => {
    const activeWsId = workspaceId || projects[0]?.workspaceId || "default";
    const newId = `page_${Date.now()}`;
    const newPage: LocalPage = {
      id: newId,
      title: "Untitled Document",
      workspaceId: activeWsId,
      isDiary: false,
      content: {
        blocks: [
          { id: "b1", type: "heading", level: 1, text: "Untitled Document" },
          { id: "b2", type: "paragraph", text: "" },
        ],
      },
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await localDb.pages.put(newPage);
    setPages((prev) => [...prev, newPage]);
    setSelectedPageId(newId);
    setCurrentView("PAGE");

    // Queue sync
    await localDb.mutationQueue.add({
      clientMutationId: `mut_${Date.now()}`,
      entity: "page",
      entityId: newId,
      action: "UPSERT",
      payload: { title: newPage.title, content: newPage.content, workspaceId: activeWsId },
      createdAt: Date.now(),
      attempts: 0,
    });
    triggerSync();
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 antialiased font-sans">
      <RegisterSw />
      <IosInstallModal />

      {/* LEFT SIDEBAR */}
      <aside
        className={`${
          sidebarOpen ? "w-64" : "w-0 -translate-x-full"
        } transition-all duration-200 ease-in-out shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 flex flex-col z-30 overflow-hidden`}
      >
        {/* Workspace Brand Header */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 flex items-center justify-center font-bold text-xs shrink-0">
              {(workspaceName || "SH").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-none truncate">
                {workspaceName}
              </h1>
              <span className="text-[10px] text-zinc-400 font-medium truncate block mt-0.5">Workspace</span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 shrink-0 ml-1"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Sidebar Nav Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-6">
          {/* Projects */}
          <div className="space-y-1">
            <div className="px-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Projects</div>
            {projects.length === 0 ? (
              <div className="px-2 py-1 text-xs text-zinc-400">Loading projects...</div>
            ) : (
              projects.map((proj) => {
                const isSelected = currentView === "TASKS" && selectedProject?.id === proj.id;
                return (
                  <button
                    key={proj.id}
                    onClick={() => {
                      setSelectedProject(proj);
                      setCurrentView("TASKS");
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors ${
                      isSelected
                        ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Columns3 className="w-3.5 h-3.5 text-zinc-400" />
                      <span className="truncate">{proj.name}</span>
                    </div>
                    <span className="font-mono text-[10px] px-1 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-500 dark:text-zinc-300">
                      {proj.key}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Daily Log Section */}
          <div className="space-y-1">
            <div className="px-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">Daily Log</div>
            <button
              onClick={() => setCurrentView("DIARY")}
              className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors ${
                currentView === "DIARY"
                  ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              <span>Daily Diary</span>
            </button>
          </div>

          {/* Documentation Canvas Section */}
          <div className="space-y-1">
            <div className="px-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              <span>My Notes</span>
              <button
                onClick={handleCreatePage}
                title="Create new note"
                className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {pages
              .filter((p) => !workspaceId || p.workspaceId === workspaceId)
              .map((p) => {
                const isSelected = currentView === "PAGE" && selectedPageId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPageId(p.id);
                      setCurrentView("PAGE");
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 truncate transition-colors ${
                      isSelected
                        ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                    <span className="truncate">{p.title || "Untitled Document"}</span>
                  </button>
                );
              })}
          </div>

          {/* Shared with Me Notes Section */}
          {workspaceId && pages.some((p) => p.workspaceId !== workspaceId) && (
            <div className="space-y-1">
              <div className="px-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Shared With Me
              </div>
              {pages
                .filter((p) => p.workspaceId !== workspaceId)
                .map((p) => {
                  const isSelected = currentView === "PAGE" && selectedPageId === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => {
                        setSelectedPageId(p.id);
                        setCurrentView("PAGE");
                      }}
                      className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between truncate transition-colors ${
                        isSelected
                          ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <FileText className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="truncate">{p.title || "Shared Note"}</span>
                      </div>
                      <span className="text-[9px] px-1 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-500">
                        Shared
                      </span>
                    </button>
                  );
                })}
            </div>
          )}
        </div>

        {/* Sync Status Badge (Bottom of Sidebar) */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90">
          <button
            onClick={triggerSync}
            disabled={isSyncing}
            className="w-full p-2 rounded-lg bg-zinc-100 dark:bg-zinc-800/70 border border-zinc-200/60 dark:border-zinc-700/60 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors"
          >
            <div className="flex items-center gap-2">
              {status === "SYNCING" ? (
                <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
              ) : status === "OFFLINE" ? (
                <WifiOff className="w-3.5 h-3.5 text-amber-500" />
              ) : pendingCount > 0 ? (
                <RefreshCw className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
              )}

              <span className="font-medium text-[11px]">
                {status === "SYNCING"
                  ? "Syncing changes..."
                  : status === "OFFLINE"
                  ? `Offline (${pendingCount} pending)`
                  : pendingCount > 0
                  ? `${pendingCount} local edits queued`
                  : "All changes saved & synced"}
              </span>
            </div>

            <span className="text-[10px] text-zinc-400 uppercase font-mono">Sync</span>
          </button>
        </div>

        {/* User Account & Logout Footer */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 flex items-center justify-between">
          <div className="min-w-0 flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-700 dark:text-zinc-200 shrink-0">
              {(userName || "U").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{userName}</p>
              <p className="text-[10px] text-zinc-400 truncate capitalize">{currentRole.toLowerCase().replace(/_/g, " ")}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign Out"
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* MAIN RIGHT CONTAINER */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Navbar */}
        <header className="px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}

            <div className="flex items-center gap-2">
              {currentView === "TASKS" && (
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                  <Columns3 className="w-4 h-4 text-zinc-400" />
                  <span>{selectedProject?.name || "Tasks"}</span>
                </div>
              )}
              {currentView === "PAGE" && (
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                  <FileText className="w-4 h-4 text-zinc-400" />
                  <span>{pages.find((p) => p.id === selectedPageId)?.title || "Notes"}</span>
                </div>
              )}
              {currentView === "DIARY" && (
                <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                  <Calendar className="w-4 h-4 text-zinc-400" />
                  <span>Daily Diary</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Indunix AI Copilot Slide-over Button */}
            <button
              onClick={() => setAiDrawerOpen(true)}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5 transition-colors border border-zinc-200 dark:border-zinc-700"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>Indunix AI Copilot</span>
            </button>

            {/* Sign Out Button in Header */}
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Content View Router */}
        <div className="flex-1 flex overflow-hidden">
          {currentView === "TASKS" && (
            <TaskBoard
              currentProject={selectedProject}
              currentRole={currentRole}
              currentUserId={userId}
              currentUserName={userName}
            />
          )}

          {currentView === "PAGE" && selectedPageId && (
            <DocumentEditor key={selectedPageId} pageId={selectedPageId} />
          )}

          {currentView === "DIARY" && <DiaryView />}
        </div>
      </main>

      {/* Indunix AI Assistant Slide-over Drawer */}
      <AiChatDrawer isOpen={aiDrawerOpen} onClose={() => setAiDrawerOpen(false)} />
    </div>
  );
}
