"use client";

import React, { useState } from "react";
import { X, Sparkles, Send, Bot, User, RefreshCw } from "lucide-react";

interface AiChatDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

function renderInlineMarkdown(text: string): React.ReactNode {
  // Replace bold **text** and inline `code`
  const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);

  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      const boldText = part.slice(2, -2);
      // Highlight priority tags
      if (boldText === "URGENT") {
        return (
          <span key={i} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-500 font-bold">
            URGENT
          </span>
        );
      }
      if (boldText === "HIGH") {
        return (
          <span key={i} className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-bold">
            HIGH
          </span>
        );
      }
      return <strong key={i} className="font-semibold text-zinc-900 dark:text-zinc-100">{boldText}</strong>;
    }

    if (part.startsWith("`") && part.endsWith("`")) {
      const codeText = part.slice(1, -1);
      return (
        <code key={i} className="font-mono text-[10px] px-1 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-800 dark:text-zinc-200">
          {codeText}
        </code>
      );
    }

    return part;
  });
}

function FormattedMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  const flushTable = (key: number) => {
    if (tableRows.length > 0) {
      const header = tableRows[0];
      const body = tableRows.slice(1).filter((r) => !r.every((c) => /^[-: ]+$/.test(c)));

      elements.push(
        <div key={`table-${key}`} className="my-2.5 overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="bg-zinc-100/80 dark:bg-zinc-800/80 border-b border-zinc-200 dark:border-zinc-800">
                {header.map((col, cIdx) => (
                  <th key={cIdx} className="p-2 font-semibold text-zinc-700 dark:text-zinc-300">
                    {renderInlineMarkdown(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/30 transition-colors"
                >
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="p-2 text-zinc-700 dark:text-zinc-300">
                      {renderInlineMarkdown(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
    }
    inTable = false;
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    // Check if table row
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      inTable = true;
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      tableRows.push(cells);
      return;
    } else if (inTable) {
      flushTable(idx);
    }

    // Headings
    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={idx} className="font-bold text-xs uppercase tracking-wider text-zinc-900 dark:text-zinc-100 mt-2 mb-1">
          {renderInlineMarkdown(trimmed.slice(4))}
        </h3>
      );
      return;
    }

    if (trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={idx} className="font-bold text-sm text-zinc-950 dark:text-zinc-50 mt-2.5 mb-1">
          {renderInlineMarkdown(trimmed.slice(3))}
        </h2>
      );
      return;
    }

    // Bullet lists
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <div key={idx} className="flex items-start gap-1.5 my-0.5 pl-1">
          <span className="text-zinc-400 select-none">•</span>
          <span className="flex-1">{renderInlineMarkdown(trimmed.slice(2))}</span>
        </div>
      );
      return;
    }

    // Numbered list
    if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+\.)\s(.*)/);
      if (match) {
        elements.push(
          <div key={idx} className="flex items-start gap-1.5 my-0.5 pl-1">
            <span className="text-zinc-400 font-mono text-[10px] select-none">{match[1]}</span>
            <span className="flex-1">{renderInlineMarkdown(match[2])}</span>
          </div>
        );
        return;
      }
    }

    // Blank line
    if (!trimmed) {
      elements.push(<div key={idx} className="h-1.5" />);
      return;
    }

    // Standard paragraph
    elements.push(
      <p key={idx} className="my-0.5 leading-relaxed">
        {renderInlineMarkdown(trimmed)}
      </p>
    );
  });

  if (inTable) {
    flushTable(lines.length);
  }

  return <div className="space-y-0.5 text-xs text-zinc-700 dark:text-zinc-300">{elements}</div>;
}

export function AiChatDrawer({ isOpen, onClose }: AiChatDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hello! I am your Indunix Assistant. I have live context over your workspace notes, project tasks, and diary logs. How can I assist you with writing, planning, or organizing today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSend = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: messages.slice(-4),
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Error communicating with the Indunix AI Gateway." },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Network error connecting to AI assistant." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="px-4 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Indunix AI Copilot</span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            indunix-1-core
          </span>
        </div>
        <button onClick={onClose} className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Suggested Quick Prompts */}
      <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 flex flex-wrap gap-1.5">
        <button
          onClick={() => handleSend("What tasks are currently open across my projects?")}
          className="text-[11px] px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-left transition-colors"
        >
          Open tasks across projects
        </button>
        <button
          onClick={() => handleSend("Summarize the latest diary entries")}
          className="text-[11px] px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-left transition-colors"
        >
          Check diary status
        </button>
      </div>

      {/* Message Stream */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`p-3.5 rounded-xl text-xs leading-relaxed ${
              m.role === "assistant"
                ? "bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60"
                : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 ml-6"
            }`}
          >
            <div className="flex items-center gap-1.5 font-semibold text-[10px] text-zinc-400 mb-1.5">
              {m.role === "assistant" ? <Bot className="w-3.5 h-3.5 text-amber-500" /> : <User className="w-3.5 h-3.5" />}
              <span>{m.role === "assistant" ? "Indunix AI" : "You"}</span>
            </div>
            {m.role === "assistant" ? (
              <FormattedMarkdown content={m.content} />
            ) : (
              <div className="whitespace-pre-wrap">{m.content}</div>
            )}
          </div>
        ))}
        {loading && (
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200/50 dark:border-zinc-700/50 text-xs text-zinc-400 flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-amber-500" />
            <span>Consulting live workspace knowledge base...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            className="flex-1 text-xs px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || loading}
            className="p-2 rounded-lg bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
