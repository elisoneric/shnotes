"use client";

import React, { useState, useEffect, useRef } from "react";
import { localDb, LocalProject, LocalPage, LocalTask } from "@/lib/dexie";
import { useSync } from "@/lib/useSync";
import { TaskBoard } from "@/components/tasks/TaskBoard";
import { DocumentEditor } from "@/components/editor/DocumentEditor";
import { DiaryView } from "@/components/diary/DiaryView";
import { AiChatDrawer } from "@/components/ai/AiChatDrawer";
import { IosInstallModal } from "@/components/pwa/IosInstallModal";
import { RegisterSw } from "@/components/pwa/RegisterSw";
import { UpdateNotifier } from "@/components/pwa/UpdateNotifier";
import { SyncIndicator } from "@/components/layout/SyncIndicator";
import { WorkspaceRole } from "@prisma/client";
import { CreateProjectModal } from "@/components/projects/CreateProjectModal";
import { ProjectSettingsModal } from "@/components/projects/ProjectSettingsModal";
import { ProfileSettingsModal } from "@/components/settings/ProfileSettingsModal";
import { WorkspaceDashboard } from "@/components/dashboard/WorkspaceDashboard";
import { WorkspaceSettings } from "@/components/settings/WorkspaceSettings";
import { WorkspaceDropdown } from "@/components/workspace/WorkspaceDropdown";
import { CreateWorkspaceModal } from "@/components/workspace/CreateWorkspaceModal";
import {
  FolderGit2,
  FileText,
  Lock,
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
  Building2,
  Trash2,
  LogOut,
  Settings,
  ShieldCheck,
  User,
  LayoutDashboard,
  Sliders,
  X,
  Share2,
} from "lucide-react";

export interface ShellProps {
  initialUser?: {
    id: string;
    name: string;
    email: string;
    role: WorkspaceRole;
  };
  initialView?: "DASHBOARD" | "TASKS" | "PAGE" | "DIARY" | "ADMIN";
}

export function Shell({ initialUser, initialView = "DASHBOARD" }: ShellProps = {}) {
  const { triggerSync } = useSync();

  // Navigation State
  const [currentView, setCurrentView] = useState<"DASHBOARD" | "TASKS" | "PAGE" | "DIARY" | "ADMIN">(initialView);
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<LocalProject | null>(null);
  const [pages, setPages] = useState<LocalPage[]>([]);
  const [sharedPageIds, setSharedPageIds] = useState<string[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [openPageIds, setOpenPageIds] = useState<string[]>([]);
  const [allTasks, setAllTasks] = useState<LocalTask[]>([]);

  // User, Workspace & Role State
  const [currentRole, setCurrentRole] = useState<WorkspaceRole>(initialUser?.role || "OWNER");
  const [userName, setUserName] = useState(initialUser?.name || "Workspace Lead");
  const [userEmail, setUserEmail] = useState(initialUser?.email || "");
  const [userId, setUserId] = useState(initialUser?.id || "user_admin");
  const [workspaceName, setWorkspaceName] = useState("Trust Bricks");
  const [workspaceSlug, setWorkspaceSlug] = useState("trust-bricks");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  // Modals state
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const [isProjectSettingsOpen, setIsProjectSettingsOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isCreateWorkspaceOpen, setIsCreateWorkspaceOpen] = useState(false);

  // UI state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(true);

  // Refs always hold the latest selection so polling timer never sees stale state
  const selectedPageIdRef = useRef<string | null>(null);
  const selectedProjectRef = useRef<LocalProject | null>(null);
  const workspaceIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedPageIdRef.current = selectedPageId;
    if (selectedPageId) {
      if (typeof window !== "undefined") {
        localStorage.setItem("shnotes_last_page", selectedPageId);
      }
      setOpenPageIds((prev) => (prev.includes(selectedPageId) ? prev : [...prev, selectedPageId]));
    }
  }, [selectedPageId]);

  const handleCloseTab = (pId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenPageIds((prev) => {
      const next = prev.filter((id) => id !== pId);
      if (selectedPageId === pId) {
        if (next.length > 0) {
          const nextId = next[next.length - 1];
          setSelectedPageId(nextId);
          setCurrentView("PAGE");
        } else {
          setSelectedPageId(null);
          setCurrentView("DASHBOARD");
        }
      }
      return next;
    });
  };

  useEffect(() => {
    selectedProjectRef.current = selectedProject;
  }, [selectedProject]);

  useEffect(() => {
    workspaceIdRef.current = workspaceId;
  }, [workspaceId]);

  // Load local Dexie data scoped to active workspace
  const refreshLocalData = async (targetWsId?: string) => {
    try {
      const activeWsId = targetWsId || workspaceIdRef.current;
      const allProjects = await localDb.projects.filter((x) => !x.deletedAt).toArray();
      const p = activeWsId ? allProjects.filter((x) => x.workspaceId === activeWsId) : allProjects;

      const allPages = await localDb.pages.filter((x) => !x.isDiary && !x.deletedAt).toArray();
      const tasks = await localDb.tasks.filter((x) => !x.deletedAt).toArray();

      const sharedMeta = await localDb.syncMeta.get("sharedPageIds");
      const sharedIds: string[] = Array.isArray(sharedMeta?.value) ? sharedMeta.value : [];
      setSharedPageIds((prev) => (JSON.stringify(prev) === JSON.stringify(sharedIds) ? prev : sharedIds));

      setProjects((prev) => (JSON.stringify(prev) === JSON.stringify(p) ? prev : p));
      setPages((prev) => (JSON.stringify(prev) === JSON.stringify(allPages) ? prev : allPages));
      setAllTasks((prev) => (JSON.stringify(prev) === JSON.stringify(tasks) ? prev : tasks));

      const currentProject = selectedProjectRef.current;
      const projectStillValid = currentProject && p.some((x) => x.id === currentProject.id);
      if (p.length > 0 && !projectStillValid) {
        setSelectedProject(p[0]);
      }

      const currentPageId = selectedPageIdRef.current;
      const pageStillValid = currentPageId && allPages.some((x) => x.id === currentPageId);
      if (allPages.length > 0 && !currentPageId) {
        const saved = typeof window !== "undefined" ? localStorage.getItem("shnotes_last_page") : null;
        const restored = allPages.find((x) => x.id === saved);
        setSelectedPageId((restored || allPages[0]).id);
      } else if (currentPageId && !pageStillValid && allPages.length === 0) {
        setSelectedPageId(null);
      }
    } catch (err) {
      console.warn("Failed to read local Dexie data:", err);
    }
  };

  // One-time boot
  useEffect(() => {
    triggerSync();
    refreshLocalData();

    if (typeof window !== "undefined") {
      document.documentElement.classList.add("dark");
      setDarkMode(true);
      setSidebarOpen(window.innerWidth >= 1024);

      const pageParam = new URLSearchParams(window.location.search).get("page");
      if (pageParam) {
        setSelectedPageId(pageParam);
        setCurrentView("PAGE");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling timer
  useEffect(() => {
    const interval = setInterval(() => refreshLocalData(), 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        let res = await fetch("/api/auth/me");
        let data = await res.json();

        // If cookie is absent/expired, attempt native rehydration handshake
        if (!data.authenticated && typeof window !== "undefined") {
          const nativeToken = localStorage.getItem("shnotes_native_token");
          if (nativeToken) {
            const rehydrateRes = await fetch("/api/auth/rehydrate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ sessionToken: nativeToken }),
            });
            const rehydrateData = await rehydrateRes.json();
            if (rehydrateData.authenticated) {
              data = rehydrateData;
            }
          }
        }

        if (data.authenticated) {
          if (data.user?.name) setUserName(data.user.name);
          if (data.user?.email) setUserEmail(data.user.email);
          if (data.user?.id) setUserId(data.user.id);
          if (data.user?.role) setCurrentRole(data.user.role);
          if (data.workspace) {
            setWorkspaceName(data.workspace.name);
            setWorkspaceSlug(data.workspace.slug);
            setWorkspaceId(data.workspace.id);

            try {
              const wsId = data.workspace.id;
              await localDb.projects.filter((p) => Boolean(p.workspaceId && p.workspaceId !== wsId)).delete();
              refreshLocalData(wsId);
            } catch (err) {
              console.warn("Cleanup error:", err);
            }
          }
        }
      } catch (err) {
        console.warn("Failed to load user session:", err);
      }
    };

    bootstrapAuth();
  }, []);

  const closeSidebarOnMobile = () => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  };

  const handleProjectCreated = (newProject: LocalProject) => {
    setProjects((prev) => [newProject, ...prev]);
    setSelectedProject(newProject);
    setCurrentView("TASKS");
  };

  const handleLogout = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("shnotes_native_token");
      }
      await fetch("/api/auth/me", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  };

  const toggleDarkMode = () => {
    if (darkMode) {
      document.documentElement.classList.remove("dark");
      setDarkMode(false);
    } else {
      document.documentElement.classList.add("dark");
      setDarkMode(true);
    }
  };

  const handleCreateNewPage = async () => {
    const activeWsId = workspaceIdRef.current || workspaceId || "default_ws";
    const newId = `page_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newPage: LocalPage = {
      id: newId,
      title: "Untitled Document",
      content: {
        blocks: [
          { id: "b1", type: "heading", level: 1, text: "Untitled Document" },
          { id: "b2", type: "paragraph", text: "" },
        ],
      },
      isDiary: false,
      workspaceId: activeWsId,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await localDb.pages.add(newPage);
    setPages((prev) => [newPage, ...prev]);
    setSelectedPageId(newId);
    setCurrentView("PAGE");
    closeSidebarOnMobile();

    await localDb.mutationQueue.add({
      clientMutationId: `mut_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      entity: "page",
      entityId: newId,
      action: "UPSERT",
      payload: { title: newPage.title, content: newPage.content, workspaceId: activeWsId },
      createdAt: Date.now(),
      attempts: 0,
    });
    triggerSync();
  };

  const handleDeletePage = async (pageIdToDelete: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const p = await localDb.pages.get(pageIdToDelete);
      if (p) {
        await localDb.pages.put({ ...p, deletedAt: new Date(), version: p.version + 1 });
      }
      setPages((prev) => prev.filter((item) => item.id !== pageIdToDelete));
      if (selectedPageId === pageIdToDelete) {
        const remaining = pages.filter((item) => item.id !== pageIdToDelete);
        setSelectedPageId(remaining.length > 0 ? remaining[0].id : null);
      }
      await localDb.mutationQueue.add({
        clientMutationId: `mut_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        entity: "page",
        entityId: pageIdToDelete,
        action: "DELETE",
        payload: {},
        createdAt: Date.now(),
        attempts: 0,
      });
      triggerSync();
    } catch (err) {
      console.warn("Failed to delete page:", err);
    }
  };

  const activeWsId = workspaceIdRef.current || workspaceId;
  const myPages = pages.filter((p) => {
    if (sharedPageIds.includes(p.id)) return false;
    if (activeWsId) {
      return p.workspaceId === activeWsId && !p.isPrivate;
    }
    return !p.workspaceId || p.isPrivate;
  });
  const sharedPages = pages.filter((p) => sharedPageIds.includes(p.id) || (activeWsId ? p.workspaceId !== activeWsId && !p.isPrivate : false));

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100 antialiased font-sans">
      <RegisterSw />
      <IosInstallModal />
      <UpdateNotifier />

      {/* MOBILE BACKDROP OVERLAY */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-30 lg:hidden animate-in fade-in duration-200"
        />
      )}

      {/* FLOATING RESPONSIVE SIDEBAR */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-72 lg:static lg:w-64 transition-transform duration-200 ease-in-out shrink-0 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/95 flex flex-col shadow-2xl lg:shadow-none ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full lg:hidden"
        }`}
      >
        {/* Workspace Brand Header & Interactive Dropdown */}
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-1.5">
          <div className="flex-1 min-w-0">
            <WorkspaceDropdown
              currentWorkspaceId={workspaceId}
              currentWorkspaceName={workspaceName}
              currentWorkspaceSlug={workspaceSlug}
              onSelectWorkspace={(ws) => {
                setWorkspaceId(ws.id);
                setWorkspaceName(ws.name);
                setWorkspaceSlug(ws.slug);
                refreshLocalData(ws.id || undefined);
              }}
              onOpenCreateModal={() => setIsCreateWorkspaceOpen(true)}
              onOpenSettings={() => setCurrentView("ADMIN")}
            />
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0 lg:hidden cursor-pointer"
            title="Close sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Sidebar Nav Items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-5">
          {/* Executive Dashboard Link */}
          <div>
            <button
              onClick={() => {
                setCurrentView("DASHBOARD");
                closeSidebarOnMobile();
              }}
              className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-colors ${
                currentView === "DASHBOARD"
                  ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5 text-blue-500" />
              <span>Overview</span>
            </button>
          </div>

          {/* Projects */}
          <div className="space-y-1">
            <div className="px-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              <span>Projects</span>
              <button
                onClick={() => setIsCreateProjectOpen(true)}
                title="Create project"
                className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {projects.length === 0 ? (
              <div className="px-2 py-1 text-xs text-zinc-400">Loading projects...</div>
            ) : (
              projects.map((proj) => {
                const isSelected = currentView === "TASKS" && selectedProject?.id === proj.id;
                return (
                  <div key={proj.id} className="group/item flex items-center justify-between gap-1">
                    <button
                      onClick={() => {
                        setSelectedProject(proj);
                        setCurrentView("TASKS");
                        closeSidebarOnMobile();
                      }}
                      className={`flex-1 px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors min-w-0 ${
                        isSelected
                          ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: proj.colorAccent || "#2563eb" }}
                        />
                        <span className="truncate">{proj.name}</span>
                      </div>
                      <span className="text-[10px] font-mono opacity-60 ml-1 font-bold shrink-0">
                        {proj.key}
                      </span>
                    </button>

                    {/* Project Settings trigger */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedProject(proj);
                        setIsProjectSettingsOpen(true);
                      }}
                      title="Project Settings"
                      className="opacity-0 group-hover/item:opacity-100 p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-opacity"
                    >
                      <Sliders className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Daily Operations Diary */}
          <div className="space-y-1">
            <div className="px-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Operations Diary
            </div>
            <button
              onClick={() => {
                setCurrentView("DIARY");
                closeSidebarOnMobile();
              }}
              className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors ${
                currentView === "DIARY"
                  ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
              }`}
            >
              <Calendar className="w-3.5 h-3.5 text-indigo-500" />
              <span>Daily Diary Log</span>
            </button>
          </div>

          {/* My Notes */}
          <div className="space-y-1">
            <div className="px-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              <span>My Notes</span>
              <button
                onClick={handleCreateNewPage}
                title="Create note"
                className="p-0.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            {myPages.length === 0 ? (
              <div className="px-2 py-1 text-xs text-zinc-400">No notes yet</div>
            ) : (
              myPages.map((p) => {
                const isSelected = currentView === "PAGE" && selectedPageId === p.id;
                return (
                  <div key={p.id} className="group flex items-center justify-between">
                    <button
                      onClick={() => {
                        setSelectedPageId(p.id);
                        setCurrentView("PAGE");
                        closeSidebarOnMobile();
                      }}
                      className={`flex-1 px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors min-w-0 ${
                        isSelected
                          ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      {p.isPrivate ? (
                        <Lock className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                      )}
                      <span className="truncate">{p.title || "Untitled Document"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDeletePage(p.id, e)}
                      title="Delete note"
                      className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-rose-500 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Shared with Me */}
          {sharedPages.length > 0 && (
            <div className="space-y-1 pt-2">
              <div className="px-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <Share2 className="w-3 h-3 text-emerald-500" />
                  <span>Shared with Me</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-bold">
                  {sharedPages.length}
                </span>
              </div>

              {sharedPages.map((p) => {
                const isSelected = currentView === "PAGE" && selectedPageId === p.id;
                return (
                  <div key={p.id} className="group flex items-center justify-between">
                    <button
                      onClick={() => {
                        setSelectedPageId(p.id);
                        setCurrentView("PAGE");
                        closeSidebarOnMobile();
                      }}
                      className={`flex-1 px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between gap-2 transition-colors min-w-0 ${
                        isSelected
                          ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate min-w-0">
                        <FileText className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        <span className="truncate">{p.title || "Untitled Shared Note"}</span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 shrink-0 font-medium">
                        Shared
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Workspace Settings (OWNER and HOO only) */}
          {(currentRole === "OWNER" || currentRole === "HOO") && (
            <div className="space-y-1">
              <div className="px-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                Administration
              </div>
              <button
                onClick={() => {
                  setCurrentView("ADMIN");
                  closeSidebarOnMobile();
                }}
                className={`w-full px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition-colors ${
                  currentView === "ADMIN"
                    ? "bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                }`}
              >
                <Settings className="w-3.5 h-3.5 text-zinc-400" />
                <span>Workspace Settings</span>
              </button>
            </div>
          )}
        </div>

        {/* User Account & Logout Footer */}
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 flex items-center justify-between">
          <button
            onClick={() => setIsProfileModalOpen(true)}
            title="Profile & Preferences"
            className="min-w-0 flex items-center gap-2 text-left hover:opacity-80 transition-opacity"
          >
            <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-[10px] font-bold text-zinc-700 dark:text-zinc-200 shrink-0">
              {(userName || "U").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate">{userName}</p>
              <p className="text-[10px] text-zinc-400 truncate capitalize">{currentRole.toLowerCase().replace(/_/g, " ")}</p>
            </div>
          </button>
          <div className="flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => setIsProfileModalOpen(true)}
              title="Profile Settings"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTAINER */}
      <main className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Top Navbar & Active Tabs Bar */}
        <header className="px-3 sm:px-4 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 shrink-0 cursor-pointer"
              title="Toggle Sidebar"
            >
              <PanelLeft className="w-4 h-4" />
            </button>

            {/* Active Tabs Strip: Shown prominently in full screen mode and adaptable */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar min-w-0 py-0.5">
              {/* Executive Overview Tab */}
              <button
                onClick={() => setCurrentView("DASHBOARD")}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors border cursor-pointer ${
                  currentView === "DASHBOARD"
                    ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                    : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40"
                }`}
              >
                <LayoutDashboard className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                <span className="hidden sm:inline">Overview</span>
              </button>

              {/* Tasks Tab (if a project is selected) */}
              {selectedProject && (
                <button
                  onClick={() => setCurrentView("TASKS")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors border cursor-pointer ${
                    currentView === "TASKS"
                      ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                      : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40"
                  }`}
                >
                  <Columns3 className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="truncate max-w-[110px]">{selectedProject.name}</span>
                </button>
              )}

              {/* Open Document Tabs */}
              {openPageIds.map((pId) => {
                const pageItem = pages.find((p) => p.id === pId);
                const isActive = currentView === "PAGE" && selectedPageId === pId;
                const pageTitle = pageItem?.title || "Untitled Document";
                return (
                  <div
                    key={pId}
                    onClick={() => {
                      setSelectedPageId(pId);
                      setCurrentView("PAGE");
                    }}
                    className={`group px-2 sm:px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 shrink-0 transition-colors border cursor-pointer max-w-[130px] sm:max-w-[190px] ${
                      isActive
                        ? "bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-xs font-semibold"
                        : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/40"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                    <span className="truncate">{pageTitle}</span>
                    <button
                      type="button"
                      onClick={(e) => handleCloseTab(pId, e)}
                      className="p-0.5 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 shrink-0 opacity-60 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Close tab"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}

              {/* Plus Button to Add New Document Tab */}
              <button
                onClick={handleCreateNewPage}
                title="Add new document"
                className="p-1.5 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors flex items-center justify-center shrink-0 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Minimalist Micro-Sync Status Badge */}
            <SyncIndicator />

            {/* Indunix AI Copilot Launcher */}
            <button
              onClick={() => setAiDrawerOpen(true)}
              className="px-2.5 py-1.5 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Indunix AI Copilot</span>
            </button>

            {/* Dark / Light Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors cursor-pointer"
              title="Toggle theme"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* View Routing */}
        <div className="flex-1 overflow-hidden relative flex flex-col">
          {currentView === "DASHBOARD" && (
            <WorkspaceDashboard
              workspaceName={workspaceName}
              workspaceSlug={workspaceSlug}
              currentUser={{
                id: userId,
                name: userName,
                email: userEmail,
                role: currentRole,
              }}
              projects={projects}
              tasks={allTasks}
              pages={pages}
              onSelectProject={(proj) => {
                setSelectedProject(proj);
                setCurrentView("TASKS");
              }}
              onSelectPage={(pId) => {
                setSelectedPageId(pId);
                setCurrentView("PAGE");
              }}
              onOpenDiary={() => setCurrentView("DIARY")}
              onNewTask={(pId) => {
                if (pId) {
                  const target = projects.find((x) => x.id === pId);
                  if (target) setSelectedProject(target);
                }
                setCurrentView("TASKS");
              }}
              onOpenTask={(task) => {
                const proj = projects.find((p) => p.id === task.projectId);
                if (proj) setSelectedProject(proj);
                setCurrentView("TASKS");
              }}
            />
          )}

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

          {currentView === "PAGE" && !selectedPageId && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-400">
              <FileText className="w-12 h-12 mb-3 stroke-1 text-zinc-300 dark:text-zinc-700" />
              <h2 className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">No document selected</h2>
              <button
                onClick={handleCreateNewPage}
                className="mt-3 px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold shadow-xs"
              >
                Create new document
              </button>
            </div>
          )}

          {currentView === "DIARY" && (
            <DiaryView />
          )}

          {currentView === "ADMIN" && (
            <WorkspaceSettings
              workspaceId={workspaceIdRef.current || workspaceId || "ws"}
              workspaceSlug={workspaceSlug}
              workspaceName={workspaceName}
              currentUserRole={currentRole}
            />
          )}
        </div>
      </main>

      {/* Indunix AI Assistant Drawer */}
      <AiChatDrawer
        isOpen={aiDrawerOpen}
        onClose={() => setAiDrawerOpen(false)}
      />

      {/* Create Project Modal */}
      {isCreateProjectOpen && (
        <CreateProjectModal
          workspaceId={workspaceIdRef.current || workspaceId || "ws"}
          currentUserId={userId}
          currentUserName={userName}
          onClose={() => setIsCreateProjectOpen(false)}
          onProjectCreated={handleProjectCreated}
        />
      )}

      {/* Create Workspace Modal */}
      <CreateWorkspaceModal
        isOpen={isCreateWorkspaceOpen}
        onClose={() => setIsCreateWorkspaceOpen(false)}
        onWorkspaceCreated={(newWs) => {
          setWorkspaceId(newWs.id);
          setWorkspaceName(newWs.name);
          setWorkspaceSlug(newWs.slug);
          if (newWs.projects && newWs.projects.length > 0) {
            setProjects(newWs.projects);
            setSelectedProject(newWs.projects[0]);
          }
          refreshLocalData(newWs.id);
        }}
      />

      {/* Project Settings Modal */}
      {isProjectSettingsOpen && selectedProject && (
        <ProjectSettingsModal
          project={selectedProject}
          onClose={() => setIsProjectSettingsOpen(false)}
          onProjectUpdated={(updated) => {
            setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
            setSelectedProject(updated);
          }}
        />
      )}

      {/* Profile & Settings Modal */}
      {isProfileModalOpen && (
        <ProfileSettingsModal
          currentUserName={userName}
          currentUserEmail={userEmail}
          currentRole={currentRole}
          darkMode={darkMode}
          onToggleDarkMode={toggleDarkMode}
          onClose={() => setIsProfileModalOpen(false)}
          onProfileUpdated={(newName) => {
            setUserName(newName);
          }}
        />
      )}
    </div>
  );
}
