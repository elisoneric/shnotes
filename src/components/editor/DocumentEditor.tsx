"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { localDb, LocalPage } from "@/lib/dexie";
import { syncManager } from "@/lib/sync";
import {
  FileText,
  Share2,
  Lock,
  Plus,
  Trash2,
  Heading1,
  Heading2,
  List,
  CheckSquare,
  Quote,
  Code,
  Divide,
  Info,
  Check,
  Copy,
  Users,
  X,
  Link2,
  Shield,
  Eye,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Type,
  AlignLeft,
} from "lucide-react";
import { SharePopover } from "./SharePopover";

interface BlockItem {
  id: string;
  type: "paragraph" | "heading" | "bullet" | "check" | "quote" | "code" | "callout" | "divider";
  level?: number;
  text?: string;
  checked?: boolean;
}

interface DocumentEditorProps {
  pageId: string;
}

export function DocumentEditor({ pageId }: DocumentEditorProps) {
  const [page, setPage] = useState<LocalPage | null>(null);
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<BlockItem[]>([]);
  const [secretToken, setSecretToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [slashMenuIndex, setSlashMenuIndex] = useState<number | null>(null);

  // Document Preferences State (persisted per page)
  const [layout, setLayout] = useState<"centered" | "full">("centered");
  const [fontFamily, setFontFamily] = useState<"sans" | "serif" | "mono">("sans");
  const [fontSize, setFontSize] = useState<"small" | "normal">("normal");
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [sharePopoverOpen, setSharePopoverOpen] = useState(false);

  const autoResizeTextarea = (el: HTMLTextAreaElement | null) => {
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  };

  // Invite Modal State
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteRole, setInviteRole] = useState<"CONTRIBUTOR" | "REVIEWER_GUIDE" | "VIEWER">("CONTRIBUTOR");
  const [inviteAllowGuest, setInviteAllowGuest] = useState(true);
  const [createdInviteUrl, setCreatedInviteUrl] = useState<string | null>(null);
  const [inviteCopied, setInviteCopied] = useState(false);
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [collaborators, setCollaborators] = useState<{ id: string; name: string; email: string; role: string }[]>([]);

  useEffect(() => {
    async function loadPage() {
      const p = await localDb.pages.get(pageId);
      if (p) {
        setPage(p);
        setTitle(p.title);
        setSecretToken(p.secretToken || null);
        if (p.layout) setLayout(p.layout as any);
        if (p.fontFamily) setFontFamily(p.fontFamily as any);
        if (p.fontSize) setFontSize(p.fontSize as any);
        const b = p.content?.blocks || [
          { id: "b1", type: "heading", level: 1, text: p.title || "Untitled Document" },
          { id: "b2", type: "paragraph", text: "" },
        ];
        setBlocks(b);
      }
    }
    loadPage();
  }, [pageId]);

  const handleUpdatePreferences = async (
    newLayout?: "centered" | "full",
    newFont?: "sans" | "serif" | "mono",
    newSize?: "small" | "normal"
  ) => {
    const nextLayout = newLayout ?? layout;
    const nextFont = newFont ?? fontFamily;
    const nextSize = newSize ?? fontSize;
    if (newLayout) setLayout(nextLayout);
    if (newFont) setFontFamily(nextFont);
    if (newSize) setFontSize(nextSize);

    if (page) {
      const updatedPage: LocalPage = {
        ...page,
        layout: nextLayout,
        fontFamily: nextFont,
        fontSize: nextSize,
        version: page.version + 1,
        updatedAt: new Date(),
      };
      setPage(updatedPage);
      await localDb.pages.put(updatedPage);
      await syncManager.queueMutation("page", page.id, "UPSERT", {
        title,
        content: { blocks },
        layout: nextLayout,
        fontFamily: nextFont,
        fontSize: nextSize,
        secretToken,
        workspaceId: page.workspaceId,
      });
    }
  };

  const handleUpdateFromSharePopover = async (delta: Partial<LocalPage>) => {
    if (!page) return;
    const updatedPage: LocalPage = {
      ...page,
      ...delta,
      version: page.version + 1,
      updatedAt: new Date(),
    };
    setPage(updatedPage);
    if (delta.secretToken !== undefined) {
      setSecretToken(delta.secretToken);
    }
    await localDb.pages.put(updatedPage);
    await syncManager.queueMutation("page", page.id, "UPSERT", {
      title,
      content: { blocks },
      ...delta,
      workspaceId: page.workspaceId,
    });
  };

  const loadCollaborators = useCallback(async () => {
    try {
      const res = await fetch(`/api/invite?pageId=${pageId}`);
      const data = await res.json();
      if (data.ok && Array.isArray(data.members)) {
        setCollaborators(data.members);
      }
    } catch (err) {
      console.warn("Failed to fetch collaborators:", err);
    }
  }, [pageId]);

  useEffect(() => {
    if (inviteModalOpen) {
      loadCollaborators();
    }
  }, [inviteModalOpen, loadCollaborators]);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedVersionRef = useRef<number>(0);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);

  // Poll for remote updates so changes typed on another device sync in real-time
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      if (!pageId) return;
      const remote = await localDb.pages.get(pageId);
      if (!remote) return;

      if (remote.version > lastSavedVersionRef.current) {
        lastSavedVersionRef.current = remote.version;
        setPage(remote);

        // Sync title if user is not currently typing in title input
        if (remote.title && remote.title !== title && document.activeElement?.id !== "doc-title-input") {
          setTitle(remote.title);
        }

        // Merge remote blocks smoothly
        const remoteBlocks = remote.content?.blocks;
        if (Array.isArray(remoteBlocks) && remoteBlocks.length > 0) {
          setBlocks((currentBlocks) => {
            if (JSON.stringify(currentBlocks) === JSON.stringify(remoteBlocks)) {
              return currentBlocks;
            }

            // If user is actively typing in a block, don't overwrite that specific block
            if (focusedBlockId) {
              const activeCurrent = currentBlocks.find((b) => b.id === focusedBlockId);
              return remoteBlocks.map((rb) => {
                if (rb.id === focusedBlockId && activeCurrent) {
                  return activeCurrent;
                }
                return rb;
              });
            }

            return remoteBlocks;
          });
        }
      }
    }, 1500);

    return () => clearInterval(pollInterval);
  }, [pageId, focusedBlockId, title]);

  // Debounced autosave to local Dexie and sync queue
  const saveContent = useCallback(
    async (updatedTitle: string, updatedBlocks: BlockItem[], currentToken: string | null) => {
      if (!page) return;

      const nextVersion = (page.version || 1) + 1;
      lastSavedVersionRef.current = nextVersion;

      const updatedPage: LocalPage = {
        ...page,
        title: updatedTitle,
        secretToken: currentToken,
        content: { blocks: updatedBlocks },
        version: nextVersion,
        updatedAt: new Date(),
      };

      await localDb.pages.put(updatedPage);
      await syncManager.queueMutation("page", page.id, "UPSERT", {
        title: updatedTitle,
        content: { blocks: updatedBlocks },
        secretToken: currentToken,
        workspaceId: page.workspaceId,
      });
    },
    [page]
  );

  const scheduleSave = (updatedTitle: string, updatedBlocks: BlockItem[]) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveContent(updatedTitle, updatedBlocks, secretToken);
    }, 350);
  };

  const handleTitleChange = (val: string) => {
    setTitle(val);
    scheduleSave(val, blocks);
  };

  const handleBlockTextChange = (id: string, text: string) => {
    const updated = blocks.map((b) => (b.id === id ? { ...b, text } : b));
    setBlocks(updated);
    scheduleSave(title, updated);
  };

  const handleToggleCheck = (id: string) => {
    const updated = blocks.map((b) => (b.id === id ? { ...b, checked: !b.checked } : b));
    setBlocks(updated);
    saveContent(title, updated, secretToken);
  };

  // Keyboard navigation & block management
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    block: BlockItem,
    idx: number
  ) => {
    // 1. ENTER KEY: Create new block below
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      // If in an empty bullet or check item, revert to standard paragraph
      if ((block.type === "bullet" || block.type === "check") && (!block.text || block.text.trim() === "")) {
        const updated = blocks.map((b, i) => (i === idx ? { ...b, type: "paragraph" as const } : b));
        setBlocks(updated);
        saveContent(title, updated, secretToken);
        return;
      }

      // If bullet or check, continue the list type; otherwise create paragraph
      const nextType: BlockItem["type"] =
        block.type === "bullet" || block.type === "check" ? block.type : "paragraph";

      const newBlock: BlockItem = {
        id: `b_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: nextType,
        text: "",
        checked: false,
      };

      const updated = [...blocks.slice(0, idx + 1), newBlock, ...blocks.slice(idx + 1)];
      setBlocks(updated);
      saveContent(title, updated, secretToken);

      setTimeout(() => {
        const el = document.getElementById(`block-input-${newBlock.id}`);
        if (el) el.focus();
      }, 20);
      return;
    }

    // 2. BACKSPACE KEY: Delete empty block and focus previous
    if (e.key === "Backspace" && (!block.text || block.text === "")) {
      if (blocks.length > 1) {
        e.preventDefault();
        const prevBlock = blocks[idx - 1];
        const updated = blocks.filter((b) => b.id !== block.id);
        setBlocks(updated);
        saveContent(title, updated, secretToken);

        if (prevBlock) {
          setTimeout(() => {
            const el = document.getElementById(`block-input-${prevBlock.id}`) as HTMLInputElement | HTMLTextAreaElement | null;
            if (el) {
              el.focus();
              const len = el.value.length;
              if ("setSelectionRange" in el) {
                el.setSelectionRange(len, len);
              }
            }
          }, 20);
        }
      }
      return;
    }

    // 3. ARROW UP: Focus previous block
    if (e.key === "ArrowUp" && idx > 0) {
      const target = e.currentTarget;
      if ("selectionStart" in target && target.selectionStart === 0) {
        e.preventDefault();
        const prevBlock = blocks[idx - 1];
        const el = document.getElementById(`block-input-${prevBlock.id}`);
        if (el) el.focus();
      }
    }

    // 4. ARROW DOWN: Focus next block
    if (e.key === "ArrowDown" && idx < blocks.length - 1) {
      const target = e.currentTarget;
      if ("selectionEnd" in target && target.selectionEnd === target.value.length) {
        e.preventDefault();
        const nextBlock = blocks[idx + 1];
        const el = document.getElementById(`block-input-${nextBlock.id}`);
        if (el) el.focus();
      }
    }
  };

  const addBlock = (type: BlockItem["type"], level = 1, afterIndex?: number) => {
    const newBlock: BlockItem = {
      id: `b_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      level,
      text: "",
      checked: false,
    };

    let updated: BlockItem[];
    if (afterIndex !== undefined) {
      updated = [...blocks.slice(0, afterIndex + 1), newBlock, ...blocks.slice(afterIndex + 1)];
    } else {
      updated = [...blocks, newBlock];
    }

    setBlocks(updated);
    setSlashMenuIndex(null);
    saveContent(title, updated, secretToken);

    setTimeout(() => {
      const el = document.getElementById(`block-input-${newBlock.id}`);
      if (el) el.focus();
    }, 20);
  };

  const removeBlock = (id: string) => {
    if (blocks.length <= 1) return;
    const updated = blocks.filter((b) => b.id !== id);
    setBlocks(updated);
    saveContent(title, updated, secretToken);
  };

  const toggleShare = () => {
    let token = secretToken;
    if (token) {
      token = null; // Unpublish
    } else {
      token = Array.from(crypto.getRandomValues(new Uint8Array(24)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
    setSecretToken(token);
    saveContent(title, blocks, token);
  };

  const copyShareLink = () => {
    if (!secretToken) return;
    const url = `${window.location.origin}/shared/${secretToken}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateInvite = async () => {
    setGeneratingInvite(true);
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pageId,
          role: inviteRole,
          allowGuest: inviteAllowGuest,
        }),
      });
      const data = await res.json();
      if (data.ok && data.invite?.inviteUrl) {
        setCreatedInviteUrl(data.invite.inviteUrl);
      }
    } catch (err) {
      console.warn("Failed to generate invite:", err);
    } finally {
      setGeneratingInvite(false);
    }
  };

  const copyInviteLink = () => {
    if (!createdInviteUrl) return;
    navigator.clipboard.writeText(createdInviteUrl);
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2000);
  };

  if (!page) {
    return <div className="p-8 text-xs text-zinc-400">Loading document...</div>;
  }

  const fontClass = fontFamily === "serif" ? "font-serif" : fontFamily === "mono" ? "font-mono" : "font-sans";
  const sizeClass = fontSize === "small" ? "text-xs" : "text-sm";
  const containerWidth = layout === "full" ? "max-w-6xl w-full px-4 sm:px-10" : "max-w-3xl w-full px-4 sm:px-8";

  return (
    <div className={`flex-1 flex flex-col h-full bg-white dark:bg-zinc-950 overflow-y-auto ${fontClass}`}>
      {/* Editor Top Bar: Share & Status */}
      <div className="sticky top-0 z-20 px-4 sm:px-8 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-zinc-400 min-w-0">
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Notion Document Canvas</span>
          <span>•</span>
          <span className="text-zinc-500 shrink-0">{blocks.length} blocks</span>
        </div>

        {/* Consolidated Action Controls: Share & Preferences Menu (•••) */}
        <div className="flex items-center gap-2 relative">
          {/* Consolidated Share Button */}
          <button
            onClick={() => setSharePopoverOpen(true)}
            className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-200 font-semibold flex items-center gap-1.5 transition-colors shadow-xs"
          >
            <Share2 className="w-3.5 h-3.5 text-zinc-500" />
            <span>Share</span>
            {page?.secretToken && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Published to web" />
            )}
          </button>

          {/* Document Preferences Menu (••• Top-Right) */}
          <div className="relative">
            <button
              onClick={() => setPreferencesOpen(!preferencesOpen)}
              title="Document Preferences"
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {preferencesOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-56 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl p-2 z-30 space-y-2 animate-in fade-in zoom-in-95 text-xs">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-2">Page Layout</span>
                  <div className="grid grid-cols-2 gap-1 mt-1">
                    <button
                      onClick={() => handleUpdatePreferences("centered")}
                      className={`px-2 py-1.5 rounded-lg text-left font-medium transition-colors ${
                        layout === "centered"
                          ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      Centered
                    </button>
                    <button
                      onClick={() => handleUpdatePreferences("full")}
                      className={`px-2 py-1.5 rounded-lg text-left font-medium transition-colors ${
                        layout === "full"
                          ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      Full Width
                    </button>
                  </div>
                </div>

                <div className="pt-1.5 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-2">Font Family</span>
                  <div className="space-y-0.5 mt-1">
                    <button
                      onClick={() => handleUpdatePreferences(undefined, "sans")}
                      className={`w-full px-2 py-1 rounded-lg text-left font-sans flex items-center justify-between ${
                        fontFamily === "sans"
                          ? "bg-zinc-100 dark:bg-zinc-800 font-bold text-zinc-900 dark:text-zinc-100"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                      }`}
                    >
                      <span>Sans (Inter)</span>
                      {fontFamily === "sans" && <Check className="w-3.5 h-3.5 text-zinc-500" />}
                    </button>
                    <button
                      onClick={() => handleUpdatePreferences(undefined, "serif")}
                      className={`w-full px-2 py-1 rounded-lg text-left font-serif flex items-center justify-between ${
                        fontFamily === "serif"
                          ? "bg-zinc-100 dark:bg-zinc-800 font-bold text-zinc-900 dark:text-zinc-100"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                      }`}
                    >
                      <span>Serif</span>
                      {fontFamily === "serif" && <Check className="w-3.5 h-3.5 text-zinc-500" />}
                    </button>
                    <button
                      onClick={() => handleUpdatePreferences(undefined, "mono")}
                      className={`w-full px-2 py-1 rounded-lg text-left font-mono flex items-center justify-between ${
                        fontFamily === "mono"
                          ? "bg-zinc-100 dark:bg-zinc-800 font-bold text-zinc-900 dark:text-zinc-100"
                          : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                      }`}
                    >
                      <span>Monospace</span>
                      {fontFamily === "mono" && <Check className="w-3.5 h-3.5 text-zinc-500" />}
                    </button>
                  </div>
                </div>

                <div className="pt-1.5 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-2">Font Size</span>
                  <div className="grid grid-cols-2 gap-1 mt-1">
                    <button
                      onClick={() => handleUpdatePreferences(undefined, undefined, "small")}
                      className={`px-2 py-1 rounded-lg text-left font-medium transition-colors ${
                        fontSize === "small"
                          ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      Small
                    </button>
                    <button
                      onClick={() => handleUpdatePreferences(undefined, undefined, "normal")}
                      className={`px-2 py-1 rounded-lg text-left font-medium transition-colors ${
                        fontSize === "normal"
                          ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      Normal
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Canvas Document Area */}
      <div
        className={`${containerWidth} ${sizeClass} mx-auto py-8 sm:py-10 space-y-4 transition-all duration-200`}
      >
        {/* Document Title Input */}
        <textarea
          id="doc-title-input"
          value={title}
          rows={1}
          ref={autoResizeTextarea}
          onInput={(e) => autoResizeTextarea(e.currentTarget)}
          onChange={(e) => {
            handleTitleChange(e.target.value);
            autoResizeTextarea(e.currentTarget);
          }}
          className="w-full text-3xl sm:text-4xl font-bold tracking-tight bg-transparent text-zinc-900 dark:text-zinc-50 border-none outline-none resize-none overflow-hidden break-words whitespace-pre-wrap placeholder:text-zinc-300 dark:placeholder:text-zinc-700 mb-6 leading-tight"
        />

        {/* Blocks Rendering with Enter and Keyboard Navigation */}
        <div className="space-y-2">
          {blocks.map((block, idx) => (
            <div key={block.id} className="group relative flex items-start">
              {/* Block Handle / Add Button strictly placed before typing start */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -left-11 top-1.5 flex items-center gap-0.5 z-10 select-none">
                <button
                  type="button"
                  onClick={() => setSlashMenuIndex(slashMenuIndex === idx ? null : idx)}
                  title="Add block below"
                  className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeBlock(block.id)}
                  title="Delete block"
                  className="p-1 rounded text-zinc-400 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Block Content by Type */}
              <div className="flex-1 min-w-0">
                {block.type === "heading" && block.level === 1 && (
                  <textarea
                    id={`block-input-${block.id}`}
                    value={block.text || ""}
                    rows={1}
                    ref={autoResizeTextarea}
                    onInput={(e) => autoResizeTextarea(e.currentTarget)}
                    onFocus={() => setFocusedBlockId(block.id)}
                    onBlur={() => setFocusedBlockId(null)}
                    onChange={(e) => {
                      handleBlockTextChange(block.id, e.target.value);
                      autoResizeTextarea(e.currentTarget);
                    }}
                    onKeyDown={(e) => handleKeyDown(e, block, idx)}
                    className="w-full text-2xl font-bold bg-transparent text-zinc-900 dark:text-zinc-50 outline-none resize-none overflow-hidden break-words whitespace-pre-wrap pt-4 pb-1 leading-snug"
                  />
                )}

                {block.type === "heading" && block.level === 2 && (
                  <textarea
                    id={`block-input-${block.id}`}
                    value={block.text || ""}
                    rows={1}
                    ref={autoResizeTextarea}
                    onInput={(e) => autoResizeTextarea(e.currentTarget)}
                    onFocus={() => setFocusedBlockId(block.id)}
                    onBlur={() => setFocusedBlockId(null)}
                    onChange={(e) => {
                      handleBlockTextChange(block.id, e.target.value);
                      autoResizeTextarea(e.currentTarget);
                    }}
                    onKeyDown={(e) => handleKeyDown(e, block, idx)}
                    className="w-full text-xl font-semibold bg-transparent text-zinc-900 dark:text-zinc-100 outline-none resize-none overflow-hidden break-words whitespace-pre-wrap pt-3 pb-1 leading-snug"
                  />
                )}

                {block.type === "paragraph" && (
                  <textarea
                    id={`block-input-${block.id}`}
                    value={block.text || ""}
                    rows={1}
                    ref={autoResizeTextarea}
                    onInput={(e) => autoResizeTextarea(e.currentTarget)}
                    onFocus={() => setFocusedBlockId(block.id)}
                    onBlur={() => setFocusedBlockId(null)}
                    onChange={(e) => {
                      handleBlockTextChange(block.id, e.target.value);
                      autoResizeTextarea(e.currentTarget);
                    }}
                    onKeyDown={(e) => handleKeyDown(e, block, idx)}
                    className="w-full text-sm bg-transparent text-zinc-800 dark:text-zinc-200 outline-none resize-none overflow-hidden break-words whitespace-pre-wrap leading-relaxed placeholder:text-zinc-400 block"
                  />
                )}

                {block.type === "bullet" && (
                  <div className="flex items-start gap-2">
                    <span className="text-zinc-400 select-none mt-0.5">•</span>
                    <textarea
                      id={`block-input-${block.id}`}
                      value={block.text || ""}
                      rows={1}
                      ref={autoResizeTextarea}
                      onInput={(e) => autoResizeTextarea(e.currentTarget)}
                      onFocus={() => setFocusedBlockId(block.id)}
                      onBlur={() => setFocusedBlockId(null)}
                      onChange={(e) => {
                        handleBlockTextChange(block.id, e.target.value);
                        autoResizeTextarea(e.currentTarget);
                      }}
                      onKeyDown={(e) => handleKeyDown(e, block, idx)}
                      className="w-full text-sm bg-transparent text-zinc-800 dark:text-zinc-200 outline-none resize-none overflow-hidden break-words whitespace-pre-wrap leading-relaxed"
                    />
                  </div>
                )}

                {block.type === "check" && (
                  <div className="flex items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={Boolean(block.checked)}
                      onChange={() => handleToggleCheck(block.id)}
                      className="mt-1 rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-0 cursor-pointer"
                    />
                    <textarea
                      id={`block-input-${block.id}`}
                      value={block.text || ""}
                      rows={1}
                      ref={autoResizeTextarea}
                      onInput={(e) => autoResizeTextarea(e.currentTarget)}
                      onFocus={() => setFocusedBlockId(block.id)}
                      onBlur={() => setFocusedBlockId(null)}
                      onChange={(e) => {
                        handleBlockTextChange(block.id, e.target.value);
                        autoResizeTextarea(e.currentTarget);
                      }}
                      onKeyDown={(e) => handleKeyDown(e, block, idx)}
                      className={`w-full text-sm bg-transparent outline-none resize-none overflow-hidden break-words whitespace-pre-wrap leading-relaxed ${
                        block.checked
                          ? "line-through text-zinc-400 dark:text-zinc-500"
                          : "text-zinc-800 dark:text-zinc-200"
                      }`}
                    />
                  </div>
                )}

                {block.type === "callout" && (
                  <div className="p-3.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
                    <textarea
                      id={`block-input-${block.id}`}
                      value={block.text || ""}
                      rows={1}
                      ref={autoResizeTextarea}
                      onInput={(e) => autoResizeTextarea(e.currentTarget)}
                      onFocus={() => setFocusedBlockId(block.id)}
                      onBlur={() => setFocusedBlockId(null)}
                      onChange={(e) => {
                        handleBlockTextChange(block.id, e.target.value);
                        autoResizeTextarea(e.currentTarget);
                      }}
                      onKeyDown={(e) => handleKeyDown(e, block, idx)}
                      className="w-full text-xs font-medium bg-transparent text-zinc-800 dark:text-zinc-200 outline-none resize-none overflow-hidden break-words whitespace-pre-wrap leading-relaxed"
                    />
                  </div>
                )}

                {block.type === "quote" && (
                  <div className="border-l-4 border-zinc-300 dark:border-zinc-700 pl-4 py-1">
                    <textarea
                      id={`block-input-${block.id}`}
                      value={block.text || ""}
                      rows={1}
                      ref={autoResizeTextarea}
                      onInput={(e) => autoResizeTextarea(e.currentTarget)}
                      onFocus={() => setFocusedBlockId(block.id)}
                      onBlur={() => setFocusedBlockId(null)}
                      onChange={(e) => {
                        handleBlockTextChange(block.id, e.target.value);
                        autoResizeTextarea(e.currentTarget);
                      }}
                      onKeyDown={(e) => handleKeyDown(e, block, idx)}
                      className="w-full text-sm italic bg-transparent text-zinc-600 dark:text-zinc-400 outline-none resize-none overflow-hidden break-words whitespace-pre-wrap leading-relaxed"
                    />
                  </div>
                )}

                {block.type === "code" && (
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                    <textarea
                      id={`block-input-${block.id}`}
                      value={block.text || ""}
                      rows={2}
                      ref={autoResizeTextarea}
                      onInput={(e) => autoResizeTextarea(e.currentTarget)}
                      onFocus={() => setFocusedBlockId(block.id)}
                      onBlur={() => setFocusedBlockId(null)}
                      onChange={(e) => {
                        handleBlockTextChange(block.id, e.target.value);
                        autoResizeTextarea(e.currentTarget);
                      }}
                      onKeyDown={(e) => handleKeyDown(e, block, idx)}
                      className="w-full font-mono text-xs bg-transparent text-zinc-100 outline-none resize-none overflow-hidden break-words whitespace-pre-wrap leading-relaxed"
                    />
                  </div>
                )}

                {block.type === "divider" && (
                  <hr className="border-t border-zinc-200 dark:border-zinc-800 my-4" />
                )}
              </div>

              {/* Slash Command Quick Popup */}
              {slashMenuIndex === idx && (
                <div className="absolute left-6 top-8 z-30 w-52 p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl space-y-0.5 animate-in fade-in duration-100">
                  <button
                    onClick={() => addBlock("paragraph", 1, idx)}
                    className="w-full px-2.5 py-1.5 text-xs text-left rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 text-zinc-700 dark:text-zinc-300"
                  >
                    <FileText className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Text Paragraph</span>
                  </button>
                  <button
                    onClick={() => addBlock("heading", 1, idx)}
                    className="w-full px-2.5 py-1.5 text-xs text-left rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 text-zinc-700 dark:text-zinc-300"
                  >
                    <Heading1 className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Heading 1</span>
                  </button>
                  <button
                    onClick={() => addBlock("heading", 2, idx)}
                    className="w-full px-2.5 py-1.5 text-xs text-left rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 text-zinc-700 dark:text-zinc-300"
                  >
                    <Heading2 className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Heading 2</span>
                  </button>
                  <button
                    onClick={() => addBlock("check", 1, idx)}
                    className="w-full px-2.5 py-1.5 text-xs text-left rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 text-zinc-700 dark:text-zinc-300"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-zinc-400" />
                    <span>To-do List</span>
                  </button>
                  <button
                    onClick={() => addBlock("bullet", 1, idx)}
                    className="w-full px-2.5 py-1.5 text-xs text-left rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 text-zinc-700 dark:text-zinc-300"
                  >
                    <List className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Bullet List</span>
                  </button>
                  <button
                    onClick={() => addBlock("callout", 1, idx)}
                    className="w-full px-2.5 py-1.5 text-xs text-left rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 text-zinc-700 dark:text-zinc-300"
                  >
                    <Info className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Callout Box</span>
                  </button>
                  <button
                    onClick={() => addBlock("quote", 1, idx)}
                    className="w-full px-2.5 py-1.5 text-xs text-left rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 text-zinc-700 dark:text-zinc-300"
                  >
                    <Quote className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Quote</span>
                  </button>
                  <button
                    onClick={() => addBlock("code", 1, idx)}
                    className="w-full px-2.5 py-1.5 text-xs text-left rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 text-zinc-700 dark:text-zinc-300"
                  >
                    <Code className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Code Snippet</span>
                  </button>
                  <button
                    onClick={() => addBlock("divider", 1, idx)}
                    className="w-full px-2.5 py-1.5 text-xs text-left rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 text-zinc-700 dark:text-zinc-300"
                  >
                    <Divide className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Divider</span>
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Bottom Add Block Trigger */}
        <div className="pt-6">
          <button
            onClick={() => addBlock("paragraph")}
            className="text-xs px-3 py-1.5 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 flex items-center gap-1.5 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add block</span>
          </button>
        </div>
      </div>

      {/* Invite Collaborator Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-bold text-zinc-950 dark:text-zinc-50">Invite Note Collaborator</h3>
              </div>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1.5">
                  Access Level / Role
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setInviteRole("CONTRIBUTOR")}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      inviteRole === "CONTRIBUTOR"
                        ? "border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        : "border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <div className="text-xs font-bold">Editor</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">Can edit canvas & add blocks</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInviteRole("REVIEWER_GUIDE")}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      inviteRole === "REVIEWER_GUIDE"
                        ? "border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        : "border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <div className="text-xs font-bold">Commenter</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">Can review & add guidance</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setInviteRole("VIEWER")}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      inviteRole === "VIEWER"
                        ? "border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                        : "border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    <div className="text-xs font-bold">Viewer</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">Read-only document access</div>
                  </button>
                </div>
              </div>

              {/* Guest View Permission */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
                <div className="space-y-0.5">
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    Allow Guest Access
                  </div>
                  <div className="text-[11px] text-zinc-400">
                    Invited users can read this canvas note immediately without creating an account.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={inviteAllowGuest}
                  onChange={(e) => setInviteAllowGuest(e.target.checked)}
                  className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-0 cursor-pointer"
                />
              </div>

              {/* Link Generator */}
              <div className="space-y-2">
                <button
                  onClick={handleGenerateInvite}
                  disabled={generatingInvite}
                  className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  <span>{generatingInvite ? "Generating Invite Link..." : "Generate Invite Link"}</span>
                </button>

                {createdInviteUrl && (
                  <div className="p-3 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 flex items-center justify-between gap-2">
                    <span className="text-xs font-mono truncate text-zinc-700 dark:text-zinc-300">
                      {createdInviteUrl}
                    </span>
                    <button
                      onClick={copyInviteLink}
                      className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold shrink-0 flex items-center gap-1"
                    >
                      {inviteCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{inviteCopied ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Existing Workspace Collaborators */}
              <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                <div className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                  Current Workspace Members
                </div>
                <div className="max-h-36 overflow-y-auto space-y-1">
                  {collaborators.length === 0 ? (
                    <div className="text-xs text-zinc-400 py-1">Loading members...</div>
                  ) : (
                    collaborators.map((c) => (
                      <div
                        key={c.id}
                        className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 flex items-center justify-between text-xs"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold text-zinc-800 dark:text-zinc-200 truncate block">
                            {c.name}
                          </span>
                          <span className="text-[10px] text-zinc-400 truncate block">{c.email}</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 capitalize font-medium">
                          {c.role.toLowerCase().replace(/_/g, " ")}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Consolidated Share Popover */}
      {sharePopoverOpen && page && (
        <SharePopover
          page={page}
          workspaceId={page.workspaceId}
          onUpdatePage={handleUpdateFromSharePopover}
          onClose={() => setSharePopoverOpen(false)}
        />
      )}
    </div>
  );
}
