"use client";

import React, { useState, useEffect } from "react";
import {
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Lock,
  Eye,
  EyeOff,
  Server,
  Zap,
  Globe,
} from "lucide-react";

export function SmtpAdminPanel() {
  const [config, setConfig] = useState({
    host: "",
    port: 587,
    secure: false,
    user: "",
    pass: "",
    from: "",
    appUrl: "",
    hasPassword: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Testing state
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    latencyMs?: number;
    messageId?: string;
  } | null>(null);

  const [showPassword, setShowPassword] = useState(false);

  // Fetch current SMTP config from API
  const fetchConfig = async () => {
    setLoading(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/admin/smtp");
      const data = await res.json();
      if (res.ok && data.ok) {
        setConfig({
          host: data.config.host || "",
          port: data.config.port || 587,
          secure: Boolean(data.config.secure),
          user: data.config.user || "",
          pass: data.config.hasPassword ? "••••••••" : "",
          from: data.config.from || "ShNotes Enterprise <noreply@esam.com.ng>",
          appUrl: data.config.appUrl || "https://note.esam.com.ng",
          hasPassword: Boolean(data.config.hasPassword),
        });
      } else {
        setSaveError(data.error || "Failed to load SMTP configuration");
      }
    } catch (err: any) {
      setSaveError(err.message || "Failed to connect to SMTP settings API");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(null);
    setSaveError(null);

    try {
      const res = await fetch("/api/admin/smtp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          host: config.host,
          port: Number(config.port),
          secure: config.secure,
          user: config.user,
          pass: config.pass === "••••••••" ? undefined : config.pass,
          from: config.from,
          appUrl: config.appUrl,
        }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        setSaveSuccess("SMTP configuration persisted successfully.");
        setTimeout(() => setSaveSuccess(null), 4000);
      } else {
        setSaveError(data.error || "Failed to save SMTP configuration");
      }
    } catch (err: any) {
      setSaveError(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleRunTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail || !testEmail.includes("@")) {
      setTestResult({
        ok: false,
        message: "Please specify a valid recipient email address for the test handshake.",
      });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/admin/smtp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientEmail: testEmail.trim(),
          config: {
            host: config.host,
            port: Number(config.port),
            secure: config.secure,
            user: config.user,
            pass: config.pass === "••••••••" ? undefined : config.pass,
            from: config.from,
            appUrl: config.appUrl,
          },
        }),
      });

      const data = await res.json();
      setTestResult(data);
    } catch (err: any) {
      setTestResult({
        ok: false,
        message: err.message || "Test execution request failed",
      });
    } finally {
      setTesting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-6 flex items-center justify-center gap-2 text-zinc-400 text-xs">
        <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
        <span>Loading SMTP configuration...</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-zinc-800">
        <div>
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-zinc-100 uppercase tracking-wider">
              Outbound Mail & SMTP Delivery Subsystem
            </h2>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono border ${
                config.host
                  ? "bg-emerald-950 text-emerald-400 border-emerald-800"
                  : "bg-amber-950 text-amber-400 border-amber-800"
              }`}
            >
              {config.host ? "CONFIGURED" : "PENDING HOST"}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Linked to environment variables with live database override capability for automated document invites and verification notifications.
          </p>
        </div>

        <button
          type="button"
          onClick={fetchConfig}
          className="text-xs px-3 py-1.5 rounded-lg border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reload Config</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-xl border border-emerald-800 bg-emerald-950/40 text-emerald-300 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {saveError && (
        <div className="p-3.5 rounded-xl border border-rose-800 bg-rose-950/40 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2 space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">
              SMTP Server Host
            </label>
            <input
              type="text"
              value={config.host}
              onChange={(e) => setConfig({ ...config, host: e.target.value })}
              placeholder="87.98.128.166 or mail.indunixai.com"
              className="w-full text-xs px-3 py-2.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 font-mono"
            />
            <p className="text-[10px] text-zinc-500">
              cPanel server hostname or direct server IP (such as 87.98.128.166).
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">
              SMTP Port
            </label>
            <input
              type="number"
              value={config.port}
              onChange={(e) => setConfig({ ...config, port: Number(e.target.value) })}
              placeholder="587"
              className="w-full text-xs px-3 py-2.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">
              SMTP Authentication Username
            </label>
            <input
              type="text"
              value={config.user}
              onChange={(e) => setConfig({ ...config, user: e.target.value })}
              placeholder="admin@esam.com.ng"
              className="w-full text-xs px-3 py-2.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-zinc-300">
                SMTP Authentication Password
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-zinc-400 hover:text-zinc-200 flex items-center gap-1"
              >
                {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                <span>{showPassword ? "Hide" : "Show"}</span>
              </button>
            </div>
            <input
              type={showPassword ? "text" : "password"}
              value={config.pass}
              onChange={(e) => setConfig({ ...config, pass: e.target.value })}
              placeholder={config.hasPassword ? "••••••••" : "Enter mail password"}
              className="w-full text-xs px-3 py-2.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 font-mono"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">
              Default Sender Address (MAIL_FROM)
            </label>
            <input
              type="text"
              value={config.from}
              onChange={(e) => setConfig({ ...config, from: e.target.value })}
              placeholder="ShNotes Enterprise <noreply@esam.com.ng>"
              className="w-full text-xs px-3 py-2.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 font-mono"
            />
            <p className="text-[10px] text-zinc-500">
              Format: &quot;Display Name&quot; &lt;user@domain.com&gt; or simple email.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-zinc-300">
              Base Application URL (APP_URL)
            </label>
            <input
              type="text"
              value={config.appUrl}
              onChange={(e) => setConfig({ ...config, appUrl: e.target.value })}
              placeholder="https://note.esam.com.ng"
              className="w-full text-xs px-3 py-2.5 rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 font-mono"
            />
          </div>
        </div>

        {/* Security / TLS Options */}
        <div className="flex items-center gap-3 pt-1">
          <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={config.secure}
              onChange={(e) => setConfig({ ...config, secure: e.target.checked })}
              className="w-4 h-4 rounded border-zinc-800 bg-zinc-950 text-emerald-500 focus:ring-0 focus:ring-offset-0"
            />
            <span>Use Direct SSL/TLS encryption (Port 465) instead of STARTTLS (Port 587)</span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="text-xs font-semibold px-4 py-2 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 transition-colors disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
          >
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Lock className="w-3.5 h-3.5" />}
            <span>{saving ? "Persisting..." : "Save SMTP Settings"}</span>
          </button>
        </div>
      </form>

      {/* Interactive Testing Console */}
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/80 p-4 space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
              Interactive SMTP Handshake & Delivery Test
            </h3>
          </div>
          <p className="text-[11px] text-zinc-400 mt-0.5">
            Triggers a real-time transport handshake and sends a verified diagnostic test message to confirm end-to-end delivery.
          </p>
        </div>

        <form onSubmit={handleRunTest} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <input
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="admin@esam.com.ng"
            className="flex-1 text-xs px-3 py-2 rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 font-mono"
          />
          <button
            type="submit"
            disabled={testing || !testEmail}
            className="text-xs font-semibold px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40 flex items-center justify-center gap-1.5 shrink-0 shadow-xs"
          >
            {testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>{testing ? "Testing Handshake..." : "Send Test Email"}</span>
          </button>
        </form>

        {testResult && (
          <div
            className={`p-3.5 rounded-lg border text-xs space-y-1.5 animate-in fade-in ${
              testResult.ok
                ? "border-emerald-800/80 bg-emerald-950/30 text-emerald-300"
                : "border-rose-800/80 bg-rose-950/30 text-rose-300"
            }`}
          >
            <div className="flex items-center justify-between font-semibold">
              <div className="flex items-center gap-1.5">
                {testResult.ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                )}
                <span>{testResult.ok ? "Test Passed" : "Test Failed"}</span>
              </div>
              {testResult.latencyMs !== undefined && testResult.latencyMs > 0 && (
                <span className="font-mono text-[11px] opacity-80">
                  {testResult.latencyMs}ms roundtrip
                </span>
              )}
            </div>
            <p className="text-[11px] opacity-90 leading-relaxed font-mono">
              {testResult.message}
            </p>
            {testResult.messageId && (
              <p className="text-[10px] opacity-60 font-mono truncate">
                Message ID: {testResult.messageId}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
