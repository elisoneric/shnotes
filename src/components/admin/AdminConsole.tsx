"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  FolderGit2,
  Settings,
  Download,
  Trash2,
  Plus,
  Copy,
  Check,
  Shield,
  Smartphone,
  Monitor,
  AlertCircle,
  RefreshCw,
} from "lucide-react";
import { WorkspaceRole } from "@prisma/client";

interface MemberItem {
  membershipId: string;
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: string;
  isCurrentUser: boolean;
}

interface AdminConsoleProps {
  currentWorkspaceId: string;
  currentWorkspaceName: string;
  onWorkspaceRenamed: (newName: string) => void;
  onNavigateToProjects: () => void;
}

export function AdminConsole({
  currentWorkspaceId,
  currentWorkspaceName,
  onWorkspaceRenamed,
  onNavigateToProjects,
}: AdminConsoleProps) {
  const [activeTab, setActiveTab] = useState<"MEMBERS" | "PROJECTS" | "SETTINGS" | "APPS">("MEMBERS");
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [stats, setStats] = useState<{ projects: number; tasks: number; pages: number; members: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  // Workspace settings state
  const [workspaceName, setWorkspaceName] = useState(currentWorkspaceName);
  const [savingWs, setSavingWs] = useState(false);

  // Invite modal state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>(WorkspaceRole.CONTRIBUTOR);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState(false);

  const loadAdminData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [membersRes, wsRes] = await Promise.all([
        fetch("/api/admin/members"),
        fetch("/api/admin/workspace"),
      ]);

      const membersData = await membersRes.json();
      const wsData = await wsRes.json();

      if (!membersRes.ok) throw new Error(membersData.error || "Failed to load members.");
      if (!wsRes.ok) throw new Error(wsData.error || "Failed to load workspace data.");

      setMembers(membersData.members || []);
      setPendingInvites(membersData.pendingInvites || []);
      setStats(wsData.stats || null);
      if (wsData.workspace?.name) {
        setWorkspaceName(wsData.workspace.name);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load admin console.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleRoleChange = async (targetUserId: string, newRole: WorkspaceRole) => {
    try {
      const res = await fetch("/api/admin/members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update role.");

      setMembers((prev) =>
        prev.map((m) => (m.userId === targetUserId ? { ...m, role: newRole } : m))
      );
      setActionMessage("Member role updated.");
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update role.");
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (!confirm("Are you sure you want to remove this member from the workspace?")) return;

    try {
      const res = await fetch(`/api/admin/members?userId=${targetUserId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove member.");

      setMembers((prev) => prev.filter((m) => m.userId !== targetUserId));
      setActionMessage("Member removed from workspace.");
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to remove member.");
    }
  };

  const handleCreateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratingInvite(true);
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role: inviteRole,
          email: inviteEmail || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create invite.");

      setGeneratedInviteUrl(data.invite.inviteUrl);
      setInviteEmail("");
      loadAdminData();
    } catch (err: any) {
      setError(err.message || "Failed to generate invite.");
    } finally {
      setGeneratingInvite(false);
    }
  };

  const handleRenameWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspaceName.trim()) return;

    setSavingWs(true);
    try {
      const res = await fetch("/api/admin/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: workspaceName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to rename workspace.");

      onWorkspaceRenamed(workspaceName.trim());
      setActionMessage("Workspace name updated.");
      setTimeout(() => setActionMessage(null), 3000);
    } catch (err: any) {
      setError(err.message || "Failed to update workspace.");
    } finally {
      setSavingWs(false);
    }
  };

  const handleExportBackup = () => {
    window.open("/api/admin/workspace?export=json", "_blank");
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-950/20 overflow-y-auto font-sans">
      {/* Header Bar */}
      <div className="px-8 py-5 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <Shield className="w-5 h-5 text-zinc-500" />
            <span>Workspace Administration</span>
          </h2>
          <span className="text-xs text-zinc-400 mt-0.5 block">{currentWorkspaceName}</span>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-medium">
          <button
            onClick={() => setActiveTab("MEMBERS")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "MEMBERS"
                ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            Members ({members.length})
          </button>
          <button
            onClick={() => setActiveTab("SETTINGS")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "SETTINGS"
                ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            Settings & Backup
          </button>
          <button
            onClick={() => setActiveTab("APPS")}
            className={`px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "APPS"
                ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            }`}
          >
            PWA & Apps
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div className="max-w-5xl w-full mx-auto p-8 space-y-6">
        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-xs font-semibold hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {actionMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4 shrink-0" />
            <span>{actionMessage}</span>
          </div>
        )}

        {/* Overview Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Total Members</span>
              <p className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 mt-1">{stats.members}</p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Projects</span>
              <p className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 mt-1">{stats.projects}</p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Active Tasks</span>
              <p className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 mt-1">{stats.tasks}</p>
            </div>
            <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Canvas Notes</span>
              <p className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-50 mt-1">{stats.pages}</p>
            </div>
          </div>
        )}

        {/* TAB 1: MEMBERS */}
        {activeTab === "MEMBERS" && (
          <div className="space-y-6">
            {/* Invite Form */}
            <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                Invite New Member
              </h3>
              <form onSubmit={handleCreateInvite} className="flex flex-wrap items-center gap-2">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 min-w-[200px] text-xs p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                />

                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                  className="text-xs p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                >
                  <option value={WorkspaceRole.CONTRIBUTOR}>Editor (Contributor)</option>
                  <option value={WorkspaceRole.REVIEWER_GUIDE}>Reviewer (Guide)</option>
                  <option value={WorkspaceRole.VIEWER}>Viewer (Read-only)</option>
                  <option value={WorkspaceRole.OWNER}>Co-Owner</option>
                </select>

                <button
                  type="submit"
                  disabled={generatingInvite}
                  className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{generatingInvite ? "Generating..." : "Generate Invite Link"}</span>
                </button>
              </form>

              {generatedInviteUrl && (
                <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 flex items-center justify-between gap-2 mt-2">
                  <span className="text-xs font-mono text-zinc-700 dark:text-zinc-300 truncate">
                    {generatedInviteUrl}
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(generatedInviteUrl);
                      setCopiedInvite(true);
                      setTimeout(() => setCopiedInvite(false), 2000);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold shrink-0 flex items-center gap-1"
                  >
                    {copiedInvite ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedInvite ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Members Table */}
            <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Workspace Members
                </h3>
                <button
                  onClick={loadAdminData}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  title="Refresh"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-950/50 text-[10px] font-bold uppercase text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                    <tr>
                      <th className="px-5 py-3">User</th>
                      <th className="px-5 py-3">Role</th>
                      <th className="px-5 py-3">Joined</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                    {members.map((m) => (
                      <tr key={m.userId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20">
                        <td className="px-5 py-3">
                          <div className="font-semibold text-zinc-900 dark:text-zinc-100">{m.name}</div>
                          <div className="text-[11px] text-zinc-400">{m.email}</div>
                        </td>
                        <td className="px-5 py-3">
                          {m.isCurrentUser ? (
                            <span className="font-medium text-zinc-700 dark:text-zinc-300 uppercase text-[10px]">
                              {m.role} (You)
                            </span>
                          ) : (
                            <select
                              value={m.role}
                              onChange={(e) => handleRoleChange(m.userId, e.target.value as WorkspaceRole)}
                              className="text-xs p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none"
                            >
                              <option value={WorkspaceRole.CONTRIBUTOR}>Editor (Contributor)</option>
                              <option value={WorkspaceRole.REVIEWER_GUIDE}>Reviewer (Guide)</option>
                              <option value={WorkspaceRole.VIEWER}>Viewer</option>
                              <option value={WorkspaceRole.OWNER}>Owner</option>
                            </select>
                          )}
                        </td>
                        <td className="px-5 py-3 text-zinc-400 text-[11px]">
                          {new Date(m.joinedAt).toLocaleDateString()}
                        </td>
                        <td className="px-5 py-3 text-right">
                          {!m.isCurrentUser && (
                            <button
                              onClick={() => handleRemoveMember(m.userId)}
                              title="Remove member"
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SETTINGS & BACKUP */}
        {activeTab === "SETTINGS" && (
          <div className="space-y-6">
            {/* Rename Workspace */}
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                Workspace Details
              </h3>
              <form onSubmit={handleRenameWorkspace} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                    Workspace Name
                  </label>
                  <input
                    type="text"
                    required
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={savingWs || workspaceName.trim() === currentWorkspaceName}
                  className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-sm"
                >
                  {savingWs ? "Saving..." : "Update Workspace Name"}
                </button>
              </form>
            </div>

            {/* Data Export & Backup */}
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                Data Backup & Export
              </h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Download a complete JSON export of all projects, tasks, comments, and document canvas notes in this workspace.
              </p>
              <button
                type="button"
                onClick={handleExportBackup}
                className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold flex items-center gap-2 transition-colors shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export Workspace JSON Backup</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: PWA & APPS */}
        {activeTab === "APPS" && (
          <div className="space-y-6">
            {/* Auto Upgrade & Cache Policy */}
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Automated Upgrade & Hard Refresh Policy
                </h3>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                All deployed clients (Desktop Windows .exe, Android APK, and PWA browsers) continuously monitor the server build identifier via the version endpoint. When a new release is deployed, clients automatically purge their local cache and perform a hard refresh. If no upgrade has been deployed, no reload occurs.
              </p>
            </div>

            {/* Desktop Windows Executable */}
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Monitor className="w-4 h-4 text-zinc-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Windows Desktop Application (.exe)
                </h3>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Packaged with Electron. Runs as a dedicated native desktop window with native window controls, offline Dexie persistence, and automated server upgrade detection.
              </p>
              <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs font-mono text-zinc-700 dark:text-zinc-300 select-all">
                npm run package:exe
              </div>
            </div>

            {/* Android APK */}
            <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-sm space-y-4">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-zinc-500" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Android Mobile Application (.apk)
                </h3>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Packaged with Capacitor. Runs fullscreen on Android phones and tablets, connects to your server, and auto-refreshes when updates are deployed without reinstalling the APK.
              </p>
              <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 text-xs font-mono text-zinc-700 dark:text-zinc-300 select-all">
                npm run package:apk
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
