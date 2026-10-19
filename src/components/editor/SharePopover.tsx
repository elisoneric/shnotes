"use client";

import React, { useState, useEffect } from "react";
import { LocalPage } from "@/lib/dexie";
import {
  Globe,
  Users,
  Copy,
  Check,
  Link as LinkIcon,
  Mail,
  Shield,
  X,
  UserPlus,
  Trash2,
  Lock,
  Send,
  RefreshCw,
  ExternalLink,
} from "lucide-react";

interface SharePopoverProps {
  page: LocalPage;
  workspaceId: string;
  onUpdatePage: (updated: Partial<LocalPage>) => Promise<void>;
  onClose: () => void;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface PendingInvite {
  id: string;
  token: string;
  email: string | null;
  role: string;
  allowGuest: boolean;
  expiresAt: string;
  inviteUrl: string;
}

export function SharePopover({
  page,
  workspaceId,
  onUpdatePage,
  onClose,
}: SharePopoverProps) {
  const [activeTab, setActiveTab] = useState<"INVITE" | "COLLABORATORS" | "PUBLIC">("INVITE");
  const [isPublished, setIsPublished] = useState<boolean>(Boolean(page.secretToken));
  const [secretToken, setSecretToken] = useState<string>(page.secretToken || "");
  const [copied, setCopied] = useState(false);
  const [subscriberEmail, setSubscriberEmail] = useState("");
  const [subscribeStatus, setSubscribeStatus] = useState<string | null>(null);
  const [isSubmittingSubscriber, setIsSubmittingSubscriber] = useState(false);

  // Email Invite Tab State
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"CONTRIBUTOR" | "REVIEWER_GUIDE" | "VIEWER">("CONTRIBUTOR");
  const [allowGuest, setAllowGuest] = useState(true);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<{ ok: boolean; message: string; inviteUrl?: string } | null>(null);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [loadingInvites, setLoadingInvites] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Collaborators tab state
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [selectedStaffEmail, setSelectedStaffEmail] = useState("");
  const [selectedPermission, setSelectedPermission] = useState<"CONTRIBUTOR" | "REVIEWER_GUIDE" | "VIEWER">("CONTRIBUTOR");
  const [collaborators, setCollaborators] = useState<{ id: string; name: string; email: string; role: string }[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [collaboratorStatus, setCollaboratorStatus] = useState<string | null>(null);

  // Generate 256-bit cryptographically secure token
  const generate256BitToken = (): string => {
    if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
      const array = new Uint8Array(32);
      window.crypto.getRandomValues(array);
      return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
    }
    return Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2) + Date.now().toString(36);
  };

  const getPublicUrl = () => {
    const origin = typeof window !== "undefined" && window.location.origin ? window.location.origin : "https://note.esam.com.ng";
    return `${origin}/shared/${secretToken}`;
  };

  // Fetch pending invites for this document
  const fetchInvites = async () => {
    setLoadingInvites(true);
    try {
      const res = await fetch(`/api/invite?pageId=${page.id}`);
      if (res.ok) {
        const data = await res.json();
        if (data.invites) {
          setPendingInvites(data.invites);
        }
      }
    } catch (err) {
      console.warn("Could not load invitations:", err);
    } finally {
      setLoadingInvites(false);
    }
  };

  // Load workspace staff
  useEffect(() => {
    async function loadStaff() {
      setLoadingStaff(true);
      try {
        const res = await fetch("/api/admin/users");
        if (res.ok) {
          const data = await res.json();
          if (data.users) {
            setStaffList(data.users);
          }
        }
      } catch (err) {
        console.warn("Could not load staff members:", err);
      } finally {
        setLoadingStaff(false);
      }
    }
    loadStaff();
    fetchInvites();
  }, [workspaceId, page.id]);

  // Handle Send Email Invite
  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteEmail.includes("@")) return;

    setSendingInvite(true);
    setInviteStatus(null);

    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: page.id,
          email: inviteEmail.trim(),
          role: inviteRole,
          allowGuest,
        }),
      });

      const data = await res.json();

      if (res.ok && data.ok) {
        const emailSent = data.invite?.emailSent;
        const msg = emailSent
          ? `Invitation email dispatched to ${inviteEmail}.`
          : `Invitation generated! Copy direct link below (SMTP unconfigured).`;

        setInviteStatus({
          ok: true,
          message: msg,
          inviteUrl: data.invite?.inviteUrl,
        });

        setInviteEmail("");
        fetchInvites();
      } else {
        setInviteStatus({
          ok: false,
          message: data.error || "Failed to create invitation.",
        });
      }
    } catch (err: any) {
      setInviteStatus({
        ok: false,
        message: err.message || "Failed to dispatch invitation request.",
      });
    } finally {
      setSendingInvite(false);
    }
  };

  // Revoke an invitation
  const handleRevokeInvite = async (inviteId: string) => {
    try {
      const res = await fetch("/api/invite", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      if (res.ok) {
        setPendingInvites((prev) => prev.filter((inv) => inv.id !== inviteId));
      }
    } catch (err) {
      console.warn("Failed to revoke invite:", err);
    }
  };

  const handleCopyInviteUrl = (url: string, token: string) => {
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  // Toggle "Publish to Web"
  const handleTogglePublish = async () => {
    if (!isPublished) {
      const newToken = secretToken || generate256BitToken();
      setSecretToken(newToken);
      setIsPublished(true);
      await onUpdatePage({ secretToken: newToken });
    } else {
      setIsPublished(false);
      setSecretToken("");
      await onUpdatePage({ secretToken: null });
    }
  };

  const handleCopyLink = () => {
    if (!secretToken) return;
    const url = getPublicUrl();
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subscriberEmail || !subscriberEmail.includes("@")) return;

    setIsSubmittingSubscriber(true);
    setSubscribeStatus(null);
    try {
      const res = await fetch("/api/share/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId: page.id,
          secretToken: secretToken || undefined,
          email: subscriberEmail.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setSubscribeStatus("Subscribed to update notifications.");
        setSubscriberEmail("");
      } else {
        setSubscribeStatus(data.error || "Subscription failed.");
      }
    } catch (err: any) {
      setSubscribeStatus(err.message || "Failed to subscribe.");
    } finally {
      setIsSubmittingSubscriber(false);
    }
  };

  const handleAddCollaborator = async () => {
    if (!selectedStaffEmail) return;
    const member = staffList.find((s) => s.email === selectedStaffEmail);
    if (!member) return;

    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: member.email,
          role: selectedPermission,
          pageId: page.id,
          workspaceId,
        }),
      });
      if (res.ok) {
        setCollaborators((prev) => [
          ...prev.filter((c) => c.email !== member.email),
          { id: member.id, name: member.name, email: member.email, role: selectedPermission },
        ]);
        setCollaboratorStatus(`Granted ${member.name} page access.`);
        setSelectedStaffEmail("");
      }
    } catch (err: any) {
      setCollaboratorStatus("Failed to add collaborator.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-200">
              <LinkIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 leading-none">
                Share Document
              </h3>
              <p className="text-[11px] text-zinc-400 mt-0.5 truncate max-w-xs">{page.title}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Three Structured Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 px-5 pt-2">
          <button
            onClick={() => setActiveTab("INVITE")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === "INVITE"
                ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Invite via Email</span>
          </button>

          <button
            onClick={() => setActiveTab("COLLABORATORS")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === "COLLABORATORS"
                ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Workspace Staff</span>
          </button>

          <button
            onClick={() => setActiveTab("PUBLIC")}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === "PUBLIC"
                ? "border-zinc-900 text-zinc-900 dark:border-zinc-100 dark:text-zinc-100"
                : "border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Public Link</span>
            {isPublished && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
            )}
          </button>
        </div>

        {/* Tab 1: Invite via Email */}
        {activeTab === "INVITE" && (
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Send an email invitation. The recipient receives a cryptographic access link to collaborate as a guest or sign in.
            </p>

            {inviteStatus && (
              <div
                className={`p-3 rounded-lg text-xs space-y-1.5 animate-in fade-in border ${
                  inviteStatus.ok
                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                    : "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                }`}
              >
                <p className="font-medium">{inviteStatus.message}</p>
                {inviteStatus.inviteUrl && (
                  <div className="flex items-center gap-1.5 pt-1">
                    <input
                      type="text"
                      readOnly
                      value={inviteStatus.inviteUrl}
                      className="flex-1 font-mono text-[10px] px-2 py-1 rounded bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-700 text-zinc-800 dark:text-zinc-200 select-all"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyInviteUrl(inviteStatus.inviteUrl!, "new")}
                      className="px-2 py-1 text-[10px] font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-500 cursor-pointer"
                    >
                      {copiedToken === "new" ? "Copied" : "Copy Link"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Email Invite Form */}
            <form onSubmit={handleSendInvite} className="space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="collaborator@organization.com"
                  className="flex-1 text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none"
                />

                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                >
                  <option value="CONTRIBUTOR">Can edit</option>
                  <option value="REVIEWER_GUIDE">Can comment</option>
                  <option value="VIEWER">Can view</option>
                </select>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowGuest}
                    onChange={(e) => setAllowGuest(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-0"
                  />
                  <span>Allow instant guest entry without registration</span>
                </label>

                <button
                  type="submit"
                  disabled={sendingInvite || !inviteEmail}
                  className="text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 disabled:opacity-40 hover:opacity-90 flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  {sendingInvite ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>{sendingInvite ? "Sending..." : "Send Invite"}</span>
                </button>
              </div>
            </form>

            {/* Pending Document Invites List */}
            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
              <div className="flex items-center justify-between text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                <span>Active Document Invitations</span>
                {loadingInvites && <RefreshCw className="w-3 h-3 animate-spin" />}
              </div>

              {pendingInvites.length === 0 ? (
                <div className="p-3 text-xs text-zinc-400 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
                  No pending email invitations for this document.
                </div>
              ) : (
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg divide-y divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
                  {pendingInvites.map((inv) => (
                    <div key={inv.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                      <div className="space-y-0.5 truncate max-w-[220px]">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {inv.email || "Direct Link Token"}
                        </p>
                        <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                          <span className="px-1.5 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-medium">
                            {inv.role === "CONTRIBUTOR" ? "Can edit" : inv.role === "REVIEWER_GUIDE" ? "Can comment" : "Can view"}
                          </span>
                          <span>•</span>
                          <span>{inv.allowGuest ? "Guest entry" : "Sign in required"}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyInviteUrl(inv.inviteUrl, inv.token)}
                          className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Copy Invitation Link"
                        >
                          {copiedToken === inv.token ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRevokeInvite(inv.id)}
                          className="p-1 rounded text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                          title="Revoke Invitation"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Workspace Staff */}
        {activeTab === "COLLABORATORS" && (
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Grant permissions to existing workspace staff members to collaborate directly on this document.
            </p>

            {collaboratorStatus && (
              <div className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 p-2 rounded-lg border border-emerald-200 dark:border-emerald-800">
                {collaboratorStatus}
              </div>
            )}

            {/* Selector Row */}
            <div className="flex items-center gap-2">
              <select
                value={selectedStaffEmail}
                onChange={(e) => setSelectedStaffEmail(e.target.value)}
                className="flex-1 text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none"
              >
                <option value="">Select staff member...</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.email}>
                    {s.name} ({s.email}) - {s.role}
                  </option>
                ))}
              </select>

              <select
                value={selectedPermission}
                onChange={(e) => setSelectedPermission(e.target.value as any)}
                className="text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none"
              >
                <option value="CONTRIBUTOR">Can edit</option>
                <option value="REVIEWER_GUIDE">Can comment</option>
                <option value="VIEWER">Can view</option>
              </select>

              <button
                type="button"
                onClick={handleAddCollaborator}
                disabled={!selectedStaffEmail}
                className="text-xs font-semibold px-3 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 disabled:opacity-40 hover:opacity-90 flex items-center gap-1 shadow-xs cursor-pointer shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>

            {/* Active Collaborators List */}
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg divide-y divide-zinc-100 dark:divide-zinc-800">
              <div className="p-2.5 bg-zinc-50 dark:bg-zinc-800/40 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Staff with Access
              </div>
              {collaborators.length === 0 ? (
                <div className="p-3 text-xs text-zinc-400 text-center">
                  All workspace members can view. Explicit collaborators will be listed here.
                </div>
              ) : (
                collaborators.map((c) => (
                  <div key={c.email} className="p-2.5 flex items-center justify-between text-xs">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">{c.name}</p>
                      <p className="text-[10px] text-zinc-400">{c.email}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-medium">
                      {c.role === "CONTRIBUTOR" ? "Can edit" : c.role === "REVIEWER_GUIDE" ? "Can comment" : "Can view"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Tab 3: Public / Secret Link */}
        {activeTab === "PUBLIC" && (
          <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Publish Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-zinc-700 dark:text-zinc-300" />
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                    Publish to Web
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Anyone with this 256-bit secure link can view this document without signing in.
                </p>
              </div>

              <button
                type="button"
                onClick={handleTogglePublish}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isPublished ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                    isPublished ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Secret URL Display & Copy */}
            {isPublished && (
              <div className="space-y-2">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
                  256-Bit Cryptographic URL
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={getPublicUrl()}
                    className="flex-1 font-mono text-[11px] px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 select-all"
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="text-xs font-semibold px-3 py-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 flex items-center gap-1.5 shadow-xs shrink-0 cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Reader Subscriber Section */}
            {isPublished && (
              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  <Mail className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Reader Update Notifications</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Register a subscriber email for automated update notifications whenever this document is modified.
                </p>

                <form onSubmit={handleSubscribe} className="flex items-center gap-2">
                  <input
                    type="email"
                    required
                    value={subscriberEmail}
                    onChange={(e) => setSubscriberEmail(e.target.value)}
                    placeholder="reader@organization.com"
                    className="flex-1 text-xs px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSubmittingSubscriber}
                    className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingSubscriber ? "Subscribing..." : "Subscribe"}
                  </button>
                </form>

                {subscribeStatus && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    {subscribeStatus}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 flex items-center justify-between text-xs text-zinc-400">
          <span className="flex items-center gap-1 text-[11px]">
            <Lock className="w-3 h-3" />
            <span>Cryptographically governed access</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-zinc-600 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-zinc-50 cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
