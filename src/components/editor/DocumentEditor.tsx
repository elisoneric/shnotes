"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { localDb, LocalPage, LocalTask, LocalProjectStage } from "@/lib/dexie";
import { TaskStage } from "@prisma/client";
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
  X,
  MoreHorizontal,
  Image as ImageIcon,
  Upload,
  Sparkles,
  CheckCheck,
  ShieldCheck,
  ChevronRight,
  Search,
} from "lucide-react";
import { SharePopover } from "./SharePopover";
import { autoCorrectOnInput } from "@/lib/autocorrect";
import { TaskGovernanceModal } from "@/components/tasks/TaskGovernanceModal";

interface BlockItem {
  id: string;
  type: "paragraph" | "heading" | "bullet" | "check" | "quote" | "code" | "callout" | "divider" | "image" | "task";
  level?: number;
  text?: string;
  url?: string;
  checked?: boolean;
  taskId?: string;
}

interface DocumentEditorProps {
  pageId: string;
}

export function DocumentEditor({ pageId }: DocumentEditorProps) {
  const [page, setPage] = useState<LocalPage | null>(null);
  const [title, setTitle] = useState("");
  const [blocks, setBlocks] = useState<BlockItem[]>([]);
  const [secretToken, setSecretToken] = useState<string | null>(null);
  const [slashMenuIndex, setSlashMenuIndex] = useState<number | null>(null);

  // Document Preferences & Autocorrect State
  const [layout, setLayout] = useState<"centered" | "full">("centered");
  const [fontFamily, setFontFamily] = useState<"sans" | "serif" | "mono">("sans");
  const [fontSize, setFontSize] = useState<"small" | "normal">("normal");
  const [autoCorrectEnabled, setAutoCorrectEnabled] = useState(true);
  const [isFixingGrammar, setIsFixingGrammar] = useState(false);
  const [grammarStatus, setGrammarStatus] = useState<string | null>(null);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [sharePopoverOpen, setSharePopoverOpen] = useState(false);

  // Project Tasks & Stages for Interactive Task Blocks
  const [availableTasks, setAvailableTasks] = useState<LocalTask[]>([]);
  const [availableStages, setAvailableStages] = useState<LocalProjectStage[]>([]);
  const [activeTaskPickerBlockId, setActiveTaskPickerBlockId] = useState<string | null>(null);
  const [taskSearchQuery, setTaskSearchQuery] = useState("");
  const [editingTask, setEditingTask] = useState<LocalTask | null>(null);
  const [hoveredCardTaskId, setHoveredCardTaskId] = useState<string | null>(null);

  // Auto-resize for textareas to prevent scroll jumps
  const textareaRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());

  const autoResizeTextarea = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    const container = el.closest(".overflow-y-auto");
    const prevScrollTop = container ? container.scrollTop : 0;

    el.style.height = "0px";
    const targetHeight = Math.max(el.scrollHeight, 24);
    el.style.height = `${targetHeight}px`;

    if (container && container.scrollTop !== prevScrollTop) {
      container.scrollTop = prevScrollTop;
    }
  }, []);

  const registerTextarea = useCallback(
    (id: string, el: HTMLTextAreaElement | null) => {
      if (el) {
        const isFirst = !textareaRefs.current.has(id);
        textareaRefs.current.set(id, el);
        if (isFirst) {
          autoResizeTextarea(el);
        }
      } else {
        textareaRefs.current.delete(id);
      }
    },
    [autoResizeTextarea]
  );

  const loadProjectData = useCallback(async () => {
    try {
      const tasks = await localDb.tasks.filter((t) => !t.deletedAt).toArray();
      const stages = await localDb.projectStages.toArray();
      setAvailableTasks(tasks);
      setAvailableStages(stages);
    } catch (err) {
      console.warn("Failed to load tasks/stages in editor:", err);
    }
  }, []);

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
    loadProjectData();

    const interval = setInterval(loadProjectData, 3000);
    return () => clearInterval(interval);
  }, [pageId, loadProjectData]);

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
        isPrivate: page.isPrivate,
        workspaceId: page.workspaceId,
      });
    }
  };

  const handleTogglePrivate = async () => {
    if (!page) return;
    const nextPrivate = !page.isPrivate;
    const updatedPage: LocalPage = {
      ...page,
      isPrivate: nextPrivate,
      version: (page.version || 1) + 1,
      updatedAt: new Date(),
    };
    setPage(updatedPage);
    await localDb.pages.put(updatedPage);
    await syncManager.queueMutation("page", page.id, "UPSERT", {
      title,
      content: { blocks },
      isPrivate: nextPrivate,
      layout,
      fontFamily,
      fontSize,
      secretToken,
      workspaceId: page.workspaceId,
    });
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
      isPrivate: page.isPrivate,
      workspaceId: page.workspaceId,
    });
  };

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedVersionRef = useRef<number>(0);
  const [focusedBlockId, setFocusedBlockId] = useState<string | null>(null);

  // Poll for remote page updates
  useEffect(() => {
    const pollInterval = setInterval(async () => {
      if (!pageId) return;
      const remote = await localDb.pages.get(pageId);
      if (!remote) return;

      if (remote.version > lastSavedVersionRef.current) {
        lastSavedVersionRef.current = remote.version;
        setPage(remote);

        if (remote.title && remote.title !== title && document.activeElement?.id !== "doc-title-input") {
          setTitle(remote.title);
        }

        const remoteBlocks = remote.content?.blocks;
        if (Array.isArray(remoteBlocks) && remoteBlocks.length > 0) {
          setBlocks((currentBlocks) => {
            if (JSON.stringify(currentBlocks) === JSON.stringify(remoteBlocks)) {
              return currentBlocks;
            }

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

  // Debounced autosave
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
        isPrivate: page.isPrivate,
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
    let finalVal = val;
    if (autoCorrectEnabled) {
      const res = autoCorrectOnInput(val);
      if (res.corrected) {
        finalVal = res.text;
      }
    }
    setTitle(finalVal);
    scheduleSave(finalVal, blocks);
  };

  const handleBlockTextChange = (id: string, text: string) => {
    // Check for /task slash command typed directly into block
    if (text.trim() === "/task") {
      const updated = blocks.map((b) => (b.id === id ? { ...b, type: "task" as const, text: "" } : b));
      setBlocks(updated);
      setActiveTaskPickerBlockId(id);
      scheduleSave(title, updated);
      return;
    }

    let finalText = text;
    if (autoCorrectEnabled) {
      const res = autoCorrectOnInput(text);
      if (res.corrected) {
        finalText = res.text;
      }
    }
    const updated = blocks.map((b) => (b.id === id ? { ...b, text: finalText } : b));
    setBlocks(updated);
    scheduleSave(title, updated);
  };

  const handleFixDocumentGrammar = async () => {
    if (isFixingGrammar) return;
    setIsFixingGrammar(true);
    setGrammarStatus("Checking grammar & spelling...");

    try {
      const res = await fetch("/api/grammar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          blocks,
        }),
      });

      if (!res.ok) {
        setGrammarStatus("Grammar service unavailable");
        setTimeout(() => setGrammarStatus(null), 3000);
        return;
      }

      const data = await res.json();
      if (data.totalChanges > 0) {
        const nextTitle = data.title || title;
        const nextBlocks = Array.isArray(data.blocks) ? data.blocks : blocks;
        setTitle(nextTitle);
        setBlocks(nextBlocks);

        if (page) {
          const updatedPage: LocalPage = {
            ...page,
            title: nextTitle,
            content: { blocks: nextBlocks },
            version: (page.version || 1) + 1,
            updatedAt: new Date(),
          };
          setPage(updatedPage);
          await localDb.pages.put(updatedPage);
          await syncManager.queueMutation("page", page.id, "UPSERT", {
            title: nextTitle,
            content: { blocks: nextBlocks },
            layout,
            fontFamily,
            fontSize,
            secretToken,
            isPrivate: page.isPrivate,
            workspaceId: page.workspaceId,
          });
        }
        setGrammarStatus(`Fixed ${data.totalChanges} issue${data.totalChanges === 1 ? "" : "s"}`);
      } else {
        setGrammarStatus("Spelling & grammar are clean");
      }
    } catch {
      setGrammarStatus("Grammar service unavailable");
    } finally {
      setIsFixingGrammar(false);
      setTimeout(() => setGrammarStatus(null), 3500);
    }
  };

  const handleToggleCheck = (id: string) => {
    const updated = blocks.map((b) => (b.id === id ? { ...b, checked: !b.checked } : b));
    setBlocks(updated);
    saveContent(title, updated, secretToken);
  };

  const applyImageUrl = (url: string, afterIndex?: number, existingBlockId?: string) => {
    if (existingBlockId) {
      const updated = blocks.map((b) => (b.id === existingBlockId ? { ...b, url } : b));
      setBlocks(updated);
      saveContent(title, updated, secretToken);
    } else {
      const newBlock: BlockItem = {
        id: `b_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        type: "image",
        url,
        text: "",
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
    }
  };

  const handleImageUpload = (file: File, afterIndex?: number, existingBlockId?: string) => {
    if (!file.type.startsWith("image/")) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return;

      const img = new (window as any).Image();
      img.onload = () => {
        let { width, height } = img;
        const maxDim = 1600;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            applyImageUrl(canvas.toDataURL("image/jpeg", 0.85), afterIndex, existingBlockId);
            return;
          }
        }
        applyImageUrl(dataUrl, afterIndex, existingBlockId);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleCanvasPaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith("image/")) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          handleImageUpload(file);
          return;
        }
      }
    }
  };

  // Keyboard navigation & block management
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>,
    block: BlockItem,
    idx: number
  ) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();

      if ((block.type === "bullet" || block.type === "check") && (!block.text || block.text.trim() === "")) {
        const updated = blocks.map((b, i) => (i === idx ? { ...b, type: "paragraph" as const } : b));
        setBlocks(updated);
        saveContent(title, updated, secretToken);
        return;
      }

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

    if (e.key === "ArrowUp" && idx > 0) {
      const target = e.currentTarget;
      if ("selectionStart" in target && target.selectionStart === 0) {
        e.preventDefault();
        const prevBlock = blocks[idx - 1];
        const el = document.getElementById(`block-input-${prevBlock.id}`);
        if (el) el.focus();
      }
    }

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
    const newId = `b_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const newBlock: BlockItem = {
      id: newId,
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
    if (type === "task") {
      setActiveTaskPickerBlockId(newId);
    }
    saveContent(title, updated, secretToken);

    if (type !== "task") {
      setTimeout(() => {
        const el = document.getElementById(`block-input-${newBlock.id}`);
        if (el) el.focus();
      }, 20);
    }
  };

  const removeBlock = (id: string) => {
    if (blocks.length <= 1) return;
    const updated = blocks.filter((b) => b.id !== id);
    setBlocks(updated);
    saveContent(title, updated, secretToken);
  };

  // Direct status cycling from inside note
  const cycleTaskStage = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const t = availableTasks.find((x) => x.id === taskId);
    if (!t) return;

    const projectStages = availableStages
      .filter((s) => s.projectId === t.projectId)
      .sort((a, b) => a.order - b.order);

    const stagesToCycle =
      projectStages.length > 0
        ? projectStages
        : [
            { id: "stage_def_1", name: "Backlog", color: "#94a3b8", order: 1, isCompleted: false, projectId: t.projectId },
            { id: "stage_def_2", name: "In Review", color: "#a855f7", order: 2, isCompleted: false, projectId: t.projectId },
            { id: "stage_def_3", name: "In Progress", color: "#3b82f6", order: 3, isCompleted: false, projectId: t.projectId },
            { id: "stage_def_4", name: "Done", color: "#10b981", order: 4, isCompleted: true, projectId: t.projectId },
          ];

    const currentIndex = stagesToCycle.findIndex((s) => s.id === t.stageId);
    const nextStage = stagesToCycle[(currentIndex + 1) % stagesToCycle.length];

    let legacyStage: TaskStage = "PROPOSED";
    if (nextStage.isCompleted) legacyStage = "APPROVED_CLEARED";
    else if (nextStage.order === 2) legacyStage = "DEV_ASSESSMENT";
    else if (nextStage.order === 3) legacyStage = "IN_PROGRESS";
    else if (nextStage.order >= 4) legacyStage = "READY_FOR_TESTING";

    const updatedTask: LocalTask = {
      ...t,
      stageId: nextStage.id,
      stage: legacyStage,
      updatedAt: new Date(),
      version: (t.version || 1) + 1,
    };

    await localDb.tasks.put(updatedTask);
    setAvailableTasks((prev) => prev.map((item) => (item.id === taskId ? updatedTask : item)));

    await syncManager.queueMutation("task", taskId, "STAGE_CHANGE", {
      stageId: nextStage.id,
      stage: legacyStage,
      order: t.order,
    });
  };

  if (!page) {
    return <div className="p-8 text-xs text-zinc-400">Loading document...</div>;
  }

  const fontClass = fontFamily === "serif" ? "font-serif" : fontFamily === "mono" ? "font-mono" : "font-sans";
  const sizeClass = fontSize === "small" ? "text-xs" : "text-sm";
  const containerWidth = layout === "full" ? "max-w-6xl w-full px-4 sm:px-10" : "max-w-3xl w-full px-4 sm:px-8";

  return (
    <div
      onPaste={handleCanvasPaste}
      className={`flex-1 flex flex-col h-full bg-white dark:bg-zinc-950 overflow-y-auto ${fontClass}`}
    >
      {/* Editor Top Bar: Share, Status & Private Badge */}
      <div className="sticky top-0 z-20 px-4 sm:px-8 py-2.5 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-zinc-400 min-w-0">
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">ShNotes Document Canvas</span>
          <span>•</span>
          <span className="text-zinc-500 shrink-0">{blocks.length} blocks</span>

          {page.isPrivate && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full shrink-0">
              <Lock className="w-3 h-3" />
              <span>Private Note</span>
            </span>
          )}

          {grammarStatus && (
            <>
              <span>•</span>
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium animate-in fade-in">
                <CheckCheck className="w-3.5 h-3.5" />
                {grammarStatus}
              </span>
            </>
          )}
        </div>

        {/* Action Controls: Fix Grammar, Share & Preferences Menu (•••) */}
        <div className="flex items-center gap-2 relative">
          {/* Fix Grammar & Spelling Button */}
          <button
            onClick={handleFixDocumentGrammar}
            disabled={isFixingGrammar}
            title="Automatically detect and fix grammar, spelling, and punctuation errors"
            className="text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-200 font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
          >
            <Sparkles className={`w-3.5 h-3.5 text-amber-500 ${isFixingGrammar ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{isFixingGrammar ? "Checking..." : "Fix Grammar"}</span>
          </button>

          {/* Consolidated Share Button */}
          <button
            onClick={() => setSharePopoverOpen(true)}
            className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-200 font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
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
              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {preferencesOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-64 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl p-2.5 z-30 space-y-2.5 animate-in fade-in zoom-in-95 text-xs">
                {/* Private Note Toggle */}
                <div>
                  <div className="flex items-center justify-between px-2 py-1">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Private Note</span>
                      <span className="text-[11px] text-zinc-500">Only visible to you in Personal Space</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleTogglePrivate}
                      className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        page.isPrivate ? "bg-amber-500" : "bg-zinc-200 dark:bg-zinc-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                          page.isPrivate ? "translate-x-3.5" : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Page Layout */}
                <div className="pt-1.5 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-2">Page Layout</span>
                  <div className="grid grid-cols-2 gap-1 mt-1">
                    <button
                      onClick={() => handleUpdatePreferences("centered")}
                      className={`px-2 py-1.5 rounded-lg text-left font-medium transition-colors cursor-pointer ${
                        layout === "centered"
                          ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      Centered
                    </button>
                    <button
                      onClick={() => handleUpdatePreferences("full")}
                      className={`px-2 py-1.5 rounded-lg text-left font-medium transition-colors cursor-pointer ${
                        layout === "full"
                          ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      Full Width
                    </button>
                  </div>
                </div>

                {/* Font Family */}
                <div className="pt-1.5 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-2">Font Family</span>
                  <div className="space-y-0.5 mt-1">
                    <button
                      onClick={() => handleUpdatePreferences(undefined, "sans")}
                      className={`w-full px-2 py-1 rounded-lg text-left font-sans flex items-center justify-between cursor-pointer ${
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
                      className={`w-full px-2 py-1 rounded-lg text-left font-serif flex items-center justify-between cursor-pointer ${
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
                      className={`w-full px-2 py-1 rounded-lg text-left font-mono flex items-center justify-between cursor-pointer ${
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

                {/* Font Size */}
                <div className="pt-1.5 border-t border-zinc-100 dark:border-zinc-800">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-2">Font Size</span>
                  <div className="grid grid-cols-2 gap-1 mt-1">
                    <button
                      onClick={() => handleUpdatePreferences(undefined, undefined, "small")}
                      className={`px-2 py-1 rounded-lg text-left font-medium transition-colors cursor-pointer ${
                        fontSize === "small"
                          ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      Small
                    </button>
                    <button
                      onClick={() => handleUpdatePreferences(undefined, undefined, "normal")}
                      className={`px-2 py-1 rounded-lg text-left font-medium transition-colors cursor-pointer ${
                        fontSize === "normal"
                          ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-bold"
                          : "hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                      }`}
                    >
                      Normal
                    </button>
                  </div>
                </div>

                {/* Auto-Correct */}
                <div className="pt-1.5 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center justify-between px-2 py-1">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block">Auto-Correct</span>
                      <span className="text-[11px] text-zinc-500">Fix typos while typing</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAutoCorrectEnabled(!autoCorrectEnabled)}
                      className={`relative inline-flex h-4.5 w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        autoCorrectEnabled ? "bg-zinc-900 dark:bg-zinc-100" : "bg-zinc-200 dark:bg-zinc-700"
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white dark:bg-zinc-900 shadow-sm ring-0 transition duration-200 ease-in-out ${
                          autoCorrectEnabled ? "translate-x-3.5" : "translate-x-0"
                        }`}
                      />
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
          spellCheck={true}
          autoCorrect={autoCorrectEnabled ? "on" : "off"}
          autoCapitalize="sentences"
          lang="en-US"
          ref={(el) => registerTextarea("doc-title-input", el)}
          onInput={(e) => autoResizeTextarea(e.currentTarget)}
          onChange={(e) => {
            handleTitleChange(e.target.value);
            autoResizeTextarea(e.currentTarget);
          }}
          className="w-full text-3xl sm:text-4xl font-bold tracking-tight bg-transparent text-zinc-900 dark:text-zinc-50 border-none outline-none resize-none overflow-hidden break-words whitespace-pre-wrap mb-6 leading-tight"
        />

        {/* Blocks Rendering */}
        <div className="space-y-2">
          {blocks.map((block, idx) => (
            <div key={block.id} className="group relative flex items-start">
              {/* Block Action Handles */}
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
                    spellCheck={true}
                    autoCorrect={autoCorrectEnabled ? "on" : "off"}
                    autoCapitalize="sentences"
                    lang="en-US"
                    ref={(el) => registerTextarea(`block-input-${block.id}`, el)}
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
                    spellCheck={true}
                    autoCorrect={autoCorrectEnabled ? "on" : "off"}
                    autoCapitalize="sentences"
                    lang="en-US"
                    ref={(el) => registerTextarea(`block-input-${block.id}`, el)}
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
                    spellCheck={true}
                    autoCorrect={autoCorrectEnabled ? "on" : "off"}
                    autoCapitalize="sentences"
                    lang="en-US"
                    ref={(el) => registerTextarea(`block-input-${block.id}`, el)}
                    onInput={(e) => autoResizeTextarea(e.currentTarget)}
                    onFocus={() => setFocusedBlockId(block.id)}
                    onBlur={() => setFocusedBlockId(null)}
                    onChange={(e) => {
                      handleBlockTextChange(block.id, e.target.value);
                      autoResizeTextarea(e.currentTarget);
                    }}
                    onKeyDown={(e) => handleKeyDown(e, block, idx)}
                    className="w-full text-sm bg-transparent text-zinc-800 dark:text-zinc-200 outline-none resize-none overflow-hidden break-words whitespace-pre-wrap leading-relaxed block"
                  />
                )}

                {block.type === "bullet" && (
                  <div className="flex items-start gap-2">
                    <span className="text-zinc-400 select-none mt-0.5">•</span>
                    <textarea
                      id={`block-input-${block.id}`}
                      value={block.text || ""}
                      rows={1}
                      spellCheck={true}
                      autoCorrect={autoCorrectEnabled ? "on" : "off"}
                      autoCapitalize="sentences"
                      lang="en-US"
                      ref={(el) => registerTextarea(`block-input-${block.id}`, el)}
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
                      spellCheck={true}
                      autoCorrect={autoCorrectEnabled ? "on" : "off"}
                      autoCapitalize="sentences"
                      lang="en-US"
                      ref={(el) => registerTextarea(`block-input-${block.id}`, el)}
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
                      spellCheck={true}
                      autoCorrect={autoCorrectEnabled ? "on" : "off"}
                      autoCapitalize="sentences"
                      lang="en-US"
                      ref={(el) => registerTextarea(`block-input-${block.id}`, el)}
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
                      spellCheck={true}
                      autoCorrect={autoCorrectEnabled ? "on" : "off"}
                      autoCapitalize="sentences"
                      lang="en-US"
                      ref={(el) => registerTextarea(`block-input-${block.id}`, el)}
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
                      spellCheck={false}
                      autoCorrect="off"
                      autoCapitalize="none"
                      ref={(el) => registerTextarea(`block-input-${block.id}`, el)}
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

                {/* Interactive Task Block */}
                {block.type === "task" && (
                  <div className="w-full my-2.5">
                    {!block.taskId || activeTaskPickerBlockId === block.id ? (
                      <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-700 p-4 bg-zinc-50/70 dark:bg-zinc-900/50">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <CheckSquare className="w-4 h-4 text-blue-500" />
                            <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                              Embed Project Task Ticket
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveTaskPickerBlockId(null)}
                            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="relative mb-2.5">
                          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                          <input
                            type="text"
                            aria-label="Filter tickets by title or ID"
                            value={taskSearchQuery}
                            onChange={(e) => setTaskSearchQuery(e.target.value)}
                            className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
                          />
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-1">
                          {availableTasks
                            .filter((t) => {
                              if (!taskSearchQuery.trim()) return true;
                              const q = taskSearchQuery.toLowerCase();
                              return t.title.toLowerCase().includes(q) || t.projectTaskId.toLowerCase().includes(q);
                            })
                            .slice(0, 15)
                            .map((t) => {
                              const stg = availableStages.find((s) => s.id === t.stageId);
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => {
                                    const updated = blocks.map((b) => (b.id === block.id ? { ...b, taskId: t.id } : b));
                                    setBlocks(updated);
                                    setActiveTaskPickerBlockId(null);
                                    scheduleSave(title, updated);
                                  }}
                                  className="w-full p-2 rounded-lg text-left hover:bg-zinc-200/60 dark:hover:bg-zinc-800 flex items-center justify-between gap-2 text-xs transition-colors"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="font-mono text-[11px] font-bold text-zinc-500 shrink-0">
                                      {t.projectTaskId}
                                    </span>
                                    <span className="truncate text-zinc-800 dark:text-zinc-200 font-medium">
                                      {t.title}
                                    </span>
                                  </div>
                                  <span
                                    className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
                                    style={{
                                      backgroundColor: `${stg?.color || "#3b82f6"}20`,
                                      color: stg?.color || "#3b82f6",
                                    }}
                                  >
                                    {stg?.name || t.stage.replace(/_/g, " ")}
                                  </span>
                                </button>
                              );
                            })}
                          {availableTasks.length === 0 && (
                            <p className="text-xs text-zinc-400 p-2 text-center">No tasks found in this project.</p>
                          )}
                        </div>
                      </div>
                    ) : (() => {
                      const task = availableTasks.find((t) => t.id === block.taskId);
                      if (!task) {
                        return (
                          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-between text-xs text-zinc-400">
                            <span>Linked task ticket not found or removed.</span>
                            <button
                              type="button"
                              onClick={() => setActiveTaskPickerBlockId(block.id)}
                              className="text-blue-500 font-medium hover:underline cursor-pointer"
                            >
                              Select replacement
                            </button>
                          </div>
                        );
                      }

                      const stage = availableStages.find((s) => s.id === task.stageId) || {
                        name: task.stage.replace(/_/g, " "),
                        color: "#3b82f6",
                      };
                      const signoffs = task.signoffs || [];
                      const clearedCount = signoffs.filter((s) => s.cleared).length;
                      const isHovered = hoveredCardTaskId === task.id;

                      return (
                        <div
                          onMouseEnter={() => setHoveredCardTaskId(task.id)}
                          onMouseLeave={() => setHoveredCardTaskId(null)}
                          className="group/task relative rounded-xl border border-zinc-200/90 dark:border-zinc-800 bg-white dark:bg-zinc-900/90 p-3 shadow-2xs hover:shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all select-none"
                        >
                          {/* Header Line: Key, Priority, and Direct Status Cycle Pill */}
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-2 h-2 rounded-full shrink-0 ${
                                  task.priority === "URGENT"
                                    ? "bg-rose-500"
                                    : task.priority === "HIGH"
                                    ? "bg-amber-500"
                                    : task.priority === "MEDIUM"
                                    ? "bg-blue-500"
                                    : "bg-zinc-400"
                                }`}
                                title={`${task.priority} priority`}
                              />
                              <span className="font-mono text-xs font-bold text-zinc-600 dark:text-zinc-400">
                                {task.projectTaskId}
                              </span>
                            </div>

                            {/* Direct Status Pill (Clicking advances/cycles status directly) */}
                            <button
                              type="button"
                              onClick={(e) => cycleTaskStage(task.id, e)}
                              title="Click to advance status"
                              className="px-2 py-0.5 rounded-full text-[10px] font-bold transition-transform active:scale-95 flex items-center gap-1 cursor-pointer"
                              style={{
                                backgroundColor: `${stage.color}15`,
                                color: stage.color,
                                border: `1px solid ${stage.color}40`,
                              }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: stage.color }} />
                              <span>{stage.name}</span>
                            </button>
                          </div>

                          {/* Task Title */}
                          <h4 className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 leading-snug mb-2">
                            {task.title}
                          </h4>

                          {/* Card Footer Line */}
                          <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-zinc-100 dark:border-zinc-800/80 text-zinc-400">
                            <div className="flex items-center gap-2">
                              {signoffs.length > 0 && (
                                <span className="inline-flex items-center gap-1 font-semibold text-[10px] text-zinc-500 dark:text-zinc-400">
                                  <ShieldCheck className="w-3 h-3 text-emerald-500" />
                                  {clearedCount}/{signoffs.length} sign-offs
                                </span>
                              )}
                              {task.dueDate && (
                                <span className="text-[10px] text-zinc-400">
                                  Due {new Date(task.dueDate).toLocaleDateString([], { month: "short", day: "numeric" })}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingTask(task)}
                                className="text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center gap-0.5 cursor-pointer"
                              >
                                <span>Governance & Details</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Hover Details Popover */}
                          {isHovered && (
                            <div className="absolute right-2 top-full mt-1.5 z-30 w-64 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl space-y-1.5 animate-in fade-in zoom-in-95 pointer-events-none">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Governance Clearance</span>
                                <span className="text-[10px] font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                  {clearedCount}/{signoffs.length || 0}
                                </span>
                              </div>
                              <p className="text-[11px] text-zinc-600 dark:text-zinc-300 line-clamp-2">
                                {task.description || "No description provided for this ticket."}
                              </p>
                              <div className="text-[10px] text-zinc-400 pt-1 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                                <span>By {task.creatorName || "Workspace member"}</span>
                                <span>Click pill to advance stage</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {block.type === "image" && (
                  <div className="w-full my-3">
                    {!block.url ? (
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "copy";
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (e.dataTransfer.files?.[0]) {
                            handleImageUpload(e.dataTransfer.files[0], undefined, block.id);
                          }
                        }}
                        className="border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 bg-zinc-50/50 dark:bg-zinc-900/30 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500">
                          <ImageIcon className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col sm:flex-row items-center gap-2">
                          <label className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 cursor-pointer flex items-center gap-1.5 shadow-xs">
                            <Upload className="w-3.5 h-3.5" />
                            <span>Upload Picture</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  handleImageUpload(e.target.files[0], undefined, block.id);
                                }
                              }}
                            />
                          </label>
                          <span className="text-[11px] text-zinc-400">or paste from clipboard / enter web URL</span>
                        </div>
                        <div className="flex items-center gap-2 w-full max-w-sm mt-1">
                          <input
                            type="url"
                            value={block.text || ""}
                            onChange={(e) => handleBlockTextChange(block.id, e.target.value)}
                            className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (block.text?.trim()) {
                                applyImageUrl(block.text.trim(), undefined, block.id);
                              }
                            }}
                            disabled={!block.text?.trim()}
                            className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 disabled:opacity-40 cursor-pointer"
                          >
                            Embed
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="group/img relative rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={block.url}
                          alt={block.text || "Attached Picture"}
                          className="w-full max-h-[600px] object-contain rounded-2xl"
                          loading="lazy"
                        />
                        <div className="absolute top-2 right-2 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center gap-1.5 bg-black/75 backdrop-blur-xs p-1 rounded-lg">
                          <label className="p-1 rounded text-zinc-300 hover:text-white hover:bg-white/10 cursor-pointer" title="Replace picture">
                            <Upload className="w-3.5 h-3.5" />
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) {
                                  handleImageUpload(e.target.files[0], undefined, block.id);
                                }
                              }}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => removeBlock(block.id)}
                            className="p-1 rounded text-zinc-300 hover:text-rose-400 hover:bg-white/10 cursor-pointer"
                            title="Delete picture"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="p-2 border-t border-zinc-100 dark:border-zinc-800/60 bg-white/50 dark:bg-zinc-950/50">
                          <input
                            type="text"
                            value={block.text || ""}
                            onChange={(e) => handleBlockTextChange(block.id, e.target.value)}
                            className="w-full text-center text-xs text-zinc-500 dark:text-zinc-400 bg-transparent outline-none italic"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {block.type === "divider" && (
                  <hr className="border-t border-zinc-200 dark:border-zinc-800 my-4" />
                )}
              </div>

              {/* Slash Command Quick Popup */}
              {slashMenuIndex === idx && (
                <div className="absolute left-6 top-8 z-30 w-56 p-1.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xl space-y-0.5 animate-in fade-in duration-100">
                  <button
                    onClick={() => addBlock("paragraph", 1, idx)}
                    className="w-full px-2.5 py-1.5 text-xs text-left rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 text-zinc-700 dark:text-zinc-300"
                  >
                    <FileText className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Text Paragraph</span>
                  </button>
                  <button
                    onClick={() => addBlock("task", 1, idx)}
                    className="w-full px-2.5 py-1.5 text-xs text-left rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 text-blue-600 dark:text-blue-400 font-medium"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-blue-500" />
                    <span>Project Task Ticket (/task)</span>
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
                    onClick={() => addBlock("image", 1, idx)}
                    className="w-full px-2.5 py-1.5 text-xs text-left rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-2 text-zinc-700 dark:text-zinc-300"
                  >
                    <ImageIcon className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Picture / Image</span>
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

        {/* Bottom Add Block Triggers */}
        <div className="pt-6 flex flex-wrap items-center gap-2">
          <button
            onClick={() => addBlock("paragraph")}
            className="text-xs px-3 py-1.5 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add block</span>
          </button>
          <button
            onClick={() => addBlock("task")}
            className="text-xs px-3 py-1.5 rounded-lg border border-dashed border-blue-300 dark:border-blue-900/60 hover:border-blue-500 text-blue-600 dark:text-blue-400 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Embed task (/task)</span>
          </button>
          <button
            onClick={() => addBlock("image")}
            className="text-xs px-3 py-1.5 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ImageIcon className="w-3.5 h-3.5" />
            <span>Add picture</span>
          </button>
        </div>
      </div>

      {/* Embedded Task Governance Modal */}
      {editingTask && (
        <TaskGovernanceModal
          task={editingTask}
          stages={availableStages.filter((s) => s.projectId === editingTask.projectId)}
          comments={[]}
          currentRole="OWNER"
          currentUserId="current"
          currentUserName="Editor"
          onClose={() => {
            setEditingTask(null);
            loadProjectData();
          }}
          onTaskUpdated={() => {
            loadProjectData();
          }}
        />
      )}

      {/* Share Popover */}
      {sharePopoverOpen && page && (
        <SharePopover
          page={page}
          workspaceId={page.workspaceId || ""}
          onUpdatePage={handleUpdateFromSharePopover}
          onClose={() => setSharePopoverOpen(false)}
        />
      )}
    </div>
  );
}
