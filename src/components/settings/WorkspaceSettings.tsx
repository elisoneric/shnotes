"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  FolderGit2,
  Settings,
  Shield,
  Plus,
  Trash2,
  Check,
  X,
  AlertCircle,
  RefreshCw,
  Building2,
  Lock,
  ArrowLeft,
  UserCheck,
} from "lucide-react";
import { WorkspaceRole, ProjectAccessLevel } from "@prisma/client";

interface StaffMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
}

interface ProjectItem {
  id: string;
  name: string;
  key: string;
  colorAccent?: string | null;
}

interface ProjectMemberGrant {
  id: string;
  projectId: string;
  userId: string;
  accessLevel: ProjectAccessLevel;
}

interface WorkspaceSettingsProps {
  workspaceId: string;
  workspaceSlug: string;
  workspaceName: string;
  currentUserRole: WorkspaceRole;
}

export function WorkspaceSettings({
  workspaceId,
  workspaceSlug,
  workspaceName,
  currentUserRole,
}: WorkspaceSettingsProps) {
  const [activeTab, setActiveTab] = useState<"STAFF" | "ACCESS_MATRIX" | "GENERAL">("STAFF");
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [grants, setGrants] = useState<ProjectMemberGrant[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>("DEVELOPER");
  const [inviting, setInviting] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/workspace/project-access?workspaceId=${workspaceId}`);
      const json = await res.json();
      if (res.ok && json.ok) {
        setStaff(json.members || []);
        setProjects(json.projects || []);
        setGrants(json.projectMembers || []);
      }
    } catch (err) {
      console.warn("Failed to load workspace settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  const showStatus = (msg: string) => {
    setStatusMessage(msg);
    setTimeout(() => setStatusMessage(null), 3500);
  };

  // Toggle Project Access for a user
  const handleToggleProjectAccess = async (userId: string, projectId: string, currentlyGranted: boolean) => {
    const nextGranted = !currentlyGranted;

    // Optimistic update
    if (nextGranted) {
      setGrants((prev) => [
        ...prev,
        {
          id: `temp_${Date.now()}`,
          userId,
          projectId,
          accessLevel: "CONTRIBUTOR" as ProjectAccessLevel,
        },
      ]);
    } else {
      setGrants((prev) => prev.filter((g) => !(g.userId === userId && g.projectId === projectId)));
    }

    try {
      const res = await fetch("/api/workspace/project-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          projectId,
          grant: nextGranted,
          accessLevel: "CONTRIBUTOR",
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        // Rollback on failure
        loadData();
        showStatus("Failed to update access grant.");
      } else {
        showStatus("Project access updated.");
      }
    } catch (err) {
      loadData();
      showStatus("Connection error updating access.");
    }
  };

  // Update Project Access Level
  const handleChangeAccessLevel = async (userId: string, projectId: string, level: ProjectAccessLevel) => {
    setGrants((prev) =>
      prev.map((g) => (g.userId === userId && g.projectId === projectId ? { ...g, accessLevel: level } : g))
    );

    try {
      await fetch("/api/workspace/project-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          projectId,
          grant: true,
          accessLevel: level,
        }),
      });
      showStatus("Access level changed.");
    } catch (err) {
      loadData();
    }
  };

  // Invite Staff
  const handleInviteStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteEmail.includes("@")) return;

    setInviting(true);
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          email: inviteEmail.trim(),
          role: inviteRole,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        showStatus(`Invitation sent to ${inviteEmail}`);
        setInviteEmail("");
        loadData();
      } else {
        showStatus(data.error || "Failed to invite staff member.");
      }
    } catch (err) {
      showStatus("Failed to invite staff member.");
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-950 p-4 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <Link
            href="/app"
            className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-500" />
              <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 tracking-tight">
                {workspaceName} Settings
              </h1>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Workspace Administration: Staff directory and project access mappings.
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-medium flex items-center gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {statusMessage && (
        <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 text-xs border border-zinc-200 dark:border-zinc-800 flex items-center gap-2 animate-in fade-in">
          <Check className="w-4 h-4 text-emerald-500 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-4 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("STAFF")}
          className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === "STAFF"
              ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
              : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Staff Directory ({staff.length})</span>
        </button>

        <button
          onClick={() => setActiveTab("ACCESS_MATRIX")}
          className={`pb-3 border-b-2 flex items-center gap-1.5 transition-colors ${
            activeTab === "ACCESS_MATRIX"
              ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
              : "border-transparent text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          <FolderGit2 className="w-4 h-4" />
          <span>Project Access Mapping</span>
        </button>
      </div>

      {/* TAB 1: STAFF DIRECTORY */}
      {activeTab === "STAFF" && (
        <div className="space-y-6">
          {/* Invite Form */}
          <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              Onboard Organization Staff
            </h3>
            <form onSubmit={handleInviteStaff} className="flex flex-wrap items-center gap-2">
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="staff@organization.com"
                className="flex-1 min-w-[200px] text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none"
              />

              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                className="text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none"
              >
                <option value="HOO">Head of Operations (HOO)</option>
                <option value="TECH_ASSISTANT">Technical Assistant</option>
                <option value="DEVELOPER">Developer</option>
                <option value="COLLABORATOR">Collaborator</option>
              </select>

              <button
                type="submit"
                disabled={inviting}
                className="text-xs font-semibold px-4 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 flex items-center gap-1.5 disabled:opacity-50 shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{inviting ? "Inviting..." : "Add Member"}</span>
              </button>
            </form>
          </div>

          {/* Members Table */}
          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-200 dark:divide-zinc-800">
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900/80 grid grid-cols-12 text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
              <span className="col-span-5">Staff Member</span>
              <span className="col-span-4">Organizational Role</span>
              <span className="col-span-3 text-right">Actions</span>
            </div>

            {staff.map((m) => (
              <div
                key={m.id}
                className="p-3 grid grid-cols-12 text-xs items-center hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors"
              >
                <div className="col-span-5 flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200 font-bold flex items-center justify-center text-[10px] shrink-0">
                    {m.name.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{m.name}</p>
                    <p className="text-[10px] text-zinc-400 truncate">{m.email}</p>
                  </div>
                </div>

                <div className="col-span-4">
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                      m.role === "OWNER"
                        ? "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-400 border border-purple-200 dark:border-purple-800"
                        : m.role === "HOO"
                        ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200 dark:border-blue-800"
                        : m.role === "DEVELOPER"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                        : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    }`}
                  >
                    {m.role.replace(/_/g, " ")}
                  </span>
                </div>

                <div className="col-span-3 text-right text-zinc-400 text-[11px]">
                  {m.role === "OWNER" ? "Primary Authority" : "Active Member"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: PROJECT ACCESS MAPPING */}
      {activeTab === "ACCESS_MATRIX" && (
        <div className="space-y-4">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Control which operational project portals (e.g., Equity Portal, HR Portal) each staff member can access, and define their role level in each stream.
          </p>

          <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-zinc-50 dark:bg-zinc-900/80 border-b border-zinc-200 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="p-3.5 min-w-[180px]">Staff Member</th>
                  <th className="p-3.5">Org Role</th>
                  {projects.map((proj) => (
                    <th key={proj.id} className="p-3.5 min-w-[200px]">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: proj.colorAccent || "#2563eb" }}
                        />
                        <span>{proj.name} ({proj.key})</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {staff.map((member) => (
                  <tr key={member.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-900/40 transition-colors">
                    <td className="p-3.5">
                      <p className="font-semibold text-zinc-900 dark:text-zinc-100">{member.name}</p>
                      <p className="text-[10px] text-zinc-400">{member.email}</p>
                    </td>
                    <td className="p-3.5">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-medium">
                        {member.role.replace(/_/g, " ")}
                      </span>
                    </td>
                    {projects.map((proj) => {
                      const grant = grants.find((g) => g.userId === member.userId && g.projectId === proj.id);
                      const isGranted = Boolean(grant);

                      return (
                        <td key={proj.id} className="p-3.5">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={isGranted}
                              onChange={() => handleToggleProjectAccess(member.userId, proj.id, isGranted)}
                              className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-0 cursor-pointer"
                            />
                            {isGranted ? (
                              <select
                                value={grant?.accessLevel || "CONTRIBUTOR"}
                                onChange={(e) =>
                                  handleChangeAccessLevel(
                                    member.userId,
                                    proj.id,
                                    e.target.value as ProjectAccessLevel
                                  )
                                }
                                className="text-[11px] px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none"
                              >
                                <option value="LEAD">Lead</option>
                                <option value="CONTRIBUTOR">Contributor</option>
                                <option value="OBSERVER">Observer</option>
                              </select>
                            ) : (
                              <span className="text-[10px] text-zinc-400 italic">No access</span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
