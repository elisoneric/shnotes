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

export function AiChatDrawer({ isOpen, onClose }: AiChatDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hello. I am your Indunix Assistant. I have live context over your active projects, governed tasks, and diary logs. How can I assist you with architecture, QA, or task triage?",
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
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-96 bg-white dark:bg-zinc-900 border-l border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
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
          className="text-[11px] px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-left"
        >
          Open tasks across projects
        </button>
        <button
          onClick={() => handleSend("Summarize the latest diary entries")}
          className="text-[11px] px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-left"
        >
          Check diary status
        </button>
      </div>

      {/* Message Stream */}
      <div className="flex-1 p-4 space-y-3 overflow-y-auto">
        {messages.map((m, idx) => (
          <div
            key={idx}
            className={`p-3 rounded-lg text-xs leading-relaxed ${
              m.role === "assistant"
                ? "bg-zinc-100 dark:bg-zinc-800/60 text-zinc-800 dark:text-zinc-200"
                : "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 ml-6"
            }`}
          >
            <div className="flex items-center gap-1.5 font-semibold text-[10px] text-zinc-400 mb-1">
              {m.role === "assistant" ? <Bot className="w-3 h-3 text-amber-500" /> : <User className="w-3 h-3" />}
              <span>{m.role === "assistant" ? "Indunix AI" : "You"}</span>
            </div>
            <div className="whitespace-pre-wrap">{m.content}</div>
          </div>
        ))}
        {loading && (
          <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800/60 text-xs text-zinc-400 flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            <span>Thinking with live workspace context...</span>
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
            placeholder="Inquire about initiatives, deliverables, or operational records"
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
