"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ChevronDown,
  Building2,
  User,
  Plus,
  Settings,
  Check,
  Sparkles,
} from "lucide-react";

export interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  logoUrl?: string | null;
  role?: string;
  projects?: any[];
}

interface WorkspaceDropdownProps {
  currentWorkspaceId: string | null;
  currentWorkspaceName: string;
  currentWorkspaceSlug: string;
  onSelectWorkspace: (workspace: { id: string | null; name: string; slug: string }) => void;
  onOpenCreateModal: () => void;
  onOpenSettings: () => void;
}

export function WorkspaceDropdown({
  currentWorkspaceId,
  currentWorkspaceName,
  currentWorkspaceSlug,
  onSelectWorkspace,
  onOpenCreateModal,
  onOpenSettings,
}: WorkspaceDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isPersonalSpace = currentWorkspaceId === null || currentWorkspaceId === "personal";

  const fetchWorkspaces = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/workspace/list");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.workspaces)) {
          setWorkspaces(data.workspaces);
        }
      }
    } catch (err) {
      console.warn("Failed to fetch workspaces:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [currentWorkspaceId]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const displayName = isPersonalSpace
    ? "My Personal Space"
    : currentWorkspaceName || "Workspace";

  const initials = isPersonalSpace
    ? "PS"
    : (currentWorkspaceName || "WS").slice(0, 2).toUpperCase();

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/60 transition-colors flex items-center justify-between gap-2.5 text-left group cursor-pointer"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
              isPersonalSpace
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700"
                : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs"
            }`}
          >
            {isPersonalSpace ? <User className="w-3.5 h-3.5 text-zinc-600 dark:text-zinc-400" /> : initials}
          </div>
          <div className="min-w-0">
            <h2 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 leading-tight truncate">
              {displayName}
            </h2>
            <span className="text-[10px] text-zinc-400 font-medium truncate block">
              {isPersonalSpace ? "Private Notes & Tasks" : "Governed Workspace"}
            </span>
          </div>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-150 shrink-0 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 w-64 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl p-1.5 z-50 space-y-1 animate-in fade-in zoom-in-95 text-xs">
          {/* Section 1: Personal Scope */}
          <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
            Personal Space
          </div>
          <button
            type="button"
            onClick={() => {
              onSelectWorkspace({ id: null, name: "My Personal Space", slug: "personal" });
              setIsOpen(false);
            }}
            className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left transition-colors ${
              isPersonalSpace
                ? "bg-zinc-100 dark:bg-zinc-800 font-semibold text-zinc-900 dark:text-zinc-100"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <User className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span className="truncate">My Personal Space</span>
            </div>
            {isPersonalSpace && <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100 shrink-0" />}
          </button>

          {/* Section 2: Corporate Workspaces */}
          <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800 mt-1">
            <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-zinc-400">
              Workspaces
            </div>
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {workspaces.map((ws) => {
                const isSelected = !isPersonalSpace && currentWorkspaceId === ws.id;
                return (
                  <button
                    key={ws.id}
                    type="button"
                    onClick={() => {
                      onSelectWorkspace({ id: ws.id, name: ws.name, slug: ws.slug });
                      setIsOpen(false);
                    }}
                    className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-left transition-colors ${
                      isSelected
                        ? "bg-zinc-100 dark:bg-zinc-800 font-semibold text-zinc-900 dark:text-zinc-100"
                        : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-4 h-4 rounded bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 text-[9px] font-bold flex items-center justify-center shrink-0">
                        {ws.name.slice(0, 1).toUpperCase()}
                      </div>
                      <span className="truncate">{ws.name}</span>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-zinc-900 dark:text-zinc-100 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 3: Actions */}
          <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800 mt-1 space-y-0.5">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenCreateModal();
              }}
              className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5 shrink-0" />
              <span>Create New Workspace</span>
            </button>

            {!isPersonalSpace && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenSettings();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg flex items-center gap-2 text-left text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
              >
                <Settings className="w-3.5 h-3.5 shrink-0" />
                <span>Workspace Settings</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
