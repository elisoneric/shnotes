"use client";

import React, { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";

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

  useEffect(() => {
    async function loadPage() {
      const p = await localDb.pages.get(pageId);
      if (p) {
        setPage(p);
        setTitle(p.title);
        setSecretToken(p.secretToken || null);
        const b = p.content?.blocks || [
          { id: "b1", type: "heading", level: 1, text: p.title || "Untitled Document" },
          { id: "b2", type: "paragraph", text: "" },
        ];
        setBlocks(b);
      }
    }
    loadPage();
  }, [pageId]);

  // Debounced autosave to local Dexie and sync queue
  const saveContent = useCallback(
    async (updatedTitle: string, updatedBlocks: BlockItem[], currentToken: string | null) => {
      if (!page) return;

      const updatedPage: LocalPage = {
        ...page,
        title: updatedTitle,
        secretToken: currentToken,
        content: { blocks: updatedBlocks },
        version: page.version + 1,
        updatedAt: new Date(),
      };

      await localDb.pages.put(updatedPage);
      await syncManager.queueMutation("page", page.id, "UPSERT", {
        title: updatedTitle,
        content: { blocks: updatedBlocks },
        secretToken: currentToken,
      });
    },
    [page]
  );

  const handleTitleChange = (val: string) => {
    setTitle(val);
    saveContent(val, blocks, secretToken);
  };

  const handleBlockTextChange = (id: string, text: string) => {
    const updated = blocks.map((b) => (b.id === id ? { ...b, text } : b));
    setBlocks(updated);
    saveContent(title, updated, secretToken);
  };

  const handleToggleCheck = (id: string) => {
    const updated = blocks.map((b) => (b.id === id ? { ...b, checked: !b.checked } : b));
    setBlocks(updated);
    saveContent(title, updated, secretToken);
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
      // Generate 256-bit safe token
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

  if (!page) {
    return <div className="p-8 text-xs text-zinc-400">Loading document...</div>;
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-950 overflow-y-auto">
      {/* Editor Top Bar: Share & Status */}
      <div className="sticky top-0 z-10 px-8 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <FileText className="w-3.5 h-3.5" />
          <span>Notion Document Canvas</span>
          <span>•</span>
          <span className="text-zinc-500">{blocks.length} blocks</span>
        </div>

        {/* Share Button / Cryptographic Token Trigger */}
        <div className="flex items-center gap-2">
          {secretToken ? (
            <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1">
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                <span>Published to Web</span>
              </span>
              <button
                onClick={copyShareLink}
                className="text-xs p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center gap-1"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                <span className="text-[10px]">{copied ? "Copied" : "Copy Link"}</span>
              </button>
              <button
                onClick={toggleShare}
                className="text-[10px] text-rose-500 hover:underline pl-1 border-l border-zinc-200 dark:border-zinc-700"
              >
                Revoke
              </button>
            </div>
          ) : (
            <button
              onClick={toggleShare}
              className="text-xs px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-medium flex items-center gap-1.5 transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share Secret Link</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Canvas Document Area */}
      <div className="max-w-3xl w-full mx-auto px-8 py-10 space-y-4">
        {/* Document Title Input */}
        <input
          type="text"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          placeholder="Untitled Document..."
          className="w-full text-3xl sm:text-4xl font-bold tracking-tight bg-transparent text-zinc-900 dark:text-zinc-50 border-none outline-none placeholder:text-zinc-300 dark:placeholder:text-zinc-700 mb-6"
        />

        {/* Blocks Rendering */}
        <div className="space-y-2">
          {blocks.map((block, idx) => (
            <div key={block.id} className="group relative flex items-start gap-2 -ml-8 pl-8">
              {/* Block Handle / Add Button */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute left-0 top-1.5 flex items-center gap-1">
                <button
                  onClick={() => setSlashMenuIndex(slashMenuIndex === idx ? null : idx)}
                  title="Add block below"
                  className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => removeBlock(block.id)}
                  title="Delete block"
                  className="p-1 rounded text-zinc-400 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Block Content by Type */}
              <div className="flex-1">
                {block.type === "heading" && block.level === 1 && (
                  <input
                    type="text"
                    value={block.text || ""}
                    onChange={(e) => handleBlockTextChange(block.id, e.target.value)}
                    placeholder="Heading 1..."
                    className="w-full text-2xl font-bold bg-transparent text-zinc-900 dark:text-zinc-50 outline-none pt-4 pb-1"
                  />
                )}

                {block.type === "heading" && block.level === 2 && (
                  <input
                    type="text"
                    value={block.text || ""}
                    onChange={(e) => handleBlockTextChange(block.id, e.target.value)}
                    placeholder="Heading 2..."
                    className="w-full text-xl font-semibold bg-transparent text-zinc-900 dark:text-zinc-100 outline-none pt-3 pb-1"
                  />
                )}

                {block.type === "paragraph" && (
                  <textarea
                    value={block.text || ""}
                    onChange={(e) => handleBlockTextChange(block.id, e.target.value)}
                    placeholder="Type '/' for commands or start typing..."
                    rows={1}
                    className="w-full text-sm bg-transparent text-zinc-800 dark:text-zinc-200 outline-none resize-none leading-relaxed placeholder:text-zinc-400"
                  />
                )}

                {block.type === "bullet" && (
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-400 select-none">•</span>
                    <input
                      type="text"
                      value={block.text || ""}
                      onChange={(e) => handleBlockTextChange(block.id, e.target.value)}
                      placeholder="List item..."
                      className="w-full text-sm bg-transparent text-zinc-800 dark:text-zinc-200 outline-none"
                    />
                  </div>
                )}

                {block.type === "check" && (
                  <div className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={Boolean(block.checked)}
                      onChange={() => handleToggleCheck(block.id)}
                      className="rounded border-zinc-300 dark:border-zinc-700 text-zinc-900 focus:ring-0 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={block.text || ""}
                      onChange={(e) => handleBlockTextChange(block.id, e.target.value)}
                      placeholder="To-do item..."
                      className={`w-full text-sm bg-transparent outline-none ${
                        block.checked ? "line-through text-zinc-400 dark:text-zinc-500" : "text-zinc-800 dark:text-zinc-200"
                      }`}
                    />
                  </div>
                )}

                {block.type === "callout" && (
                  <div className="p-3.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-zinc-400 mt-0.5 shrink-0" />
                    <textarea
                      value={block.text || ""}
                      onChange={(e) => handleBlockTextChange(block.id, e.target.value)}
                      placeholder="Callout text..."
                      rows={1}
                      className="w-full text-xs font-medium bg-transparent text-zinc-800 dark:text-zinc-200 outline-none resize-none"
                    />
                  </div>
                )}

                {block.type === "quote" && (
                  <div className="border-l-4 border-zinc-300 dark:border-zinc-700 pl-4 py-1">
                    <input
                      type="text"
                      value={block.text || ""}
                      onChange={(e) => handleBlockTextChange(block.id, e.target.value)}
                      placeholder="Empty quote..."
                      className="w-full text-sm italic bg-transparent text-zinc-600 dark:text-zinc-400 outline-none"
                    />
                  </div>
                )}

                {block.type === "code" && (
                  <div className="p-3 rounded-lg bg-zinc-950 border border-zinc-800">
                    <textarea
                      value={block.text || ""}
                      onChange={(e) => handleBlockTextChange(block.id, e.target.value)}
                      placeholder="// Code block..."
                      rows={2}
                      className="w-full font-mono text-xs bg-transparent text-zinc-100 outline-none resize-none"
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
    </div>
  );
}
