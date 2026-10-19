import nodemailer from "nodemailer";
import { prisma } from "@/lib/db";

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
  appUrl: string;
}

/**
 * Retrieves the effective SMTP configuration by checking database overrides
 * in system_settings first, then falling back to environment variables.
 */
export async function getSmtpConfig(): Promise<SmtpConfig> {
  const dbSettings: Record<string, string> = {};

  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: ["smtp_host", "smtp_port", "smtp_secure", "smtp_user", "smtp_pass", "smtp_from", "app_url"],
        },
      },
    });
    for (const s of settings) {
      dbSettings[s.key] = s.value;
    }
  } catch (err) {
    // If DB is offline or not migrated yet, silently fall back to env
  }

  const host = dbSettings.smtp_host || process.env.SMTP_HOST || "";
  const rawPort = dbSettings.smtp_port || process.env.SMTP_PORT || "587";
  const port = parseInt(rawPort, 10) || 587;
  const secureSetting = dbSettings.smtp_secure ?? process.env.SMTP_SECURE;
  const secure = secureSetting === "true" || port === 465;
  const user = dbSettings.smtp_user || process.env.SMTP_USER || "";
  const pass = dbSettings.smtp_pass || process.env.SMTP_PASS || process.env.SMTP_PASSWORD || "";
  const from = dbSettings.smtp_from || process.env.MAIL_FROM || "ShNotes Enterprise <noreply@esam.com.ng>";
  const appUrl = (dbSettings.app_url || process.env.APP_URL || "https://note.esam.com.ng").replace(/\/+$/, "");

  return { host, port, secure, user, pass, from, appUrl };
}

/**
 * Persists updated SMTP settings to the database.
 */
export async function saveSmtpConfig(config: Partial<SmtpConfig>): Promise<void> {
  const updates: Array<{ key: string; value: string }> = [];

  if (config.host !== undefined) updates.push({ key: "smtp_host", value: config.host.trim() });
  if (config.port !== undefined) updates.push({ key: "smtp_port", value: String(config.port) });
  if (config.secure !== undefined) updates.push({ key: "smtp_secure", value: String(config.secure) });
  if (config.user !== undefined) updates.push({ key: "smtp_user", value: config.user.trim() });
  if (config.pass !== undefined && config.pass !== "••••••••") {
    updates.push({ key: "smtp_pass", value: config.pass });
  }
  if (config.from !== undefined) updates.push({ key: "smtp_from", value: config.from.trim() });
  if (config.appUrl !== undefined) updates.push({ key: "app_url", value: config.appUrl.trim().replace(/\/+$/, "") });

  for (const item of updates) {
    await prisma.systemSetting.upsert({
      where: { key: item.key },
      create: { key: item.key, value: item.value },
      update: { value: item.value },
    });
  }
}

/**
 * Creates a Nodemailer transporter instance based on active or supplied configuration.
 */
export function createTransporter(config: SmtpConfig) {
  if (!config.host) {
    throw new Error("SMTP host is not configured");
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user
      ? {
          user: config.user,
          pass: config.pass,
        }
      : undefined,
    tls: {
      rejectUnauthorized: false, // Prevents self-signed cert blocks on internal mail servers
    },
  });
}

/**
 * Tests the SMTP server connection handshake and optionally sends a real verification email.
 */
export async function testSmtpConnection(
  recipientEmail?: string,
  overrideConfig?: Partial<SmtpConfig>
): Promise<{ ok: boolean; message: string; latencyMs: number; messageId?: string }> {
  const activeConfig = await getSmtpConfig();
  const config: SmtpConfig = { ...activeConfig, ...overrideConfig };

  if (!config.host) {
    return { ok: false, message: "SMTP Host is missing or unconfigured.", latencyMs: 0 };
  }

  const startTime = Date.now();

  try {
    const transporter = createTransporter(config);
    await transporter.verify();
    const latencyMs = Date.now() - startTime;

    if (recipientEmail && recipientEmail.includes("@")) {
      const info = await transporter.sendMail({
        from: config.from,
        to: recipientEmail.trim(),
        subject: "ShNotes SMTP Verification Handshake Successful",
        text: `This is a test notification from ShNotes Enterprise. Your SMTP connection to ${config.host}:${config.port} is operational with latency ${latencyMs}ms.`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #09090b; color: #f4f4f5; padding: 32px 16px; min-height: 100%;">
            <div style="max-width: 520px; margin: 0 auto; background-color: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 28px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
              <div style="display: flex; align-items: center; margin-bottom: 20px;">
                <span style="font-size: 16px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">ShNotes Enterprise</span>
                <span style="background-color: #064e3b; color: #34d399; font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 4px; margin-left: 12px; border: 1px solid #059669;">SMTP VERIFIED</span>
              </div>
              <h2 style="font-size: 18px; font-weight: 600; color: #ffffff; margin-top: 0; margin-bottom: 12px;">Connection Handshake Successful</h2>
              <p style="font-size: 13px; color: #a1a1aa; line-height: 1.5; margin-bottom: 20px;">
                Your outbound mail delivery subsystem is successfully connected to <strong style="color: #ffffff;">${config.host}:${config.port}</strong>.
              </p>
              <div style="background-color: #09090b; border: 1px solid #27272a; border-radius: 8px; padding: 14px; font-family: monospace; font-size: 11px; color: #71717a; margin-bottom: 20px;">
                <div>Host: <span style="color: #d4d4d8;">${config.host}</span></div>
                <div>Port: <span style="color: #d4d4d8;">${config.port} (TLS: ${config.secure ? "SSL 465" : "STARTTLS"})</span></div>
                <div>User: <span style="color: #d4d4d8;">${config.user || "(Anonymous)"}</span></div>
                <div>Latency: <span style="color: #34d399;">${latencyMs}ms</span></div>
                <div>Timestamp: <span style="color: #d4d4d8;">${new Date().toISOString()}</span></div>
              </div>
              <p style="font-size: 11px; color: #52525b; margin: 0;">
                Sent automatically by ShNotes System Administration Subsystem.
              </p>
            </div>
          </div>
        `,
      });

      return {
        ok: true,
        message: `SMTP handshake verified and test email dispatched to ${recipientEmail} (${latencyMs}ms).`,
        latencyMs,
        messageId: info.messageId,
      };
    }

    return {
      ok: true,
      message: `SMTP handshake successful! Connection to ${config.host}:${config.port} established in ${latencyMs}ms.`,
      latencyMs,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    return {
      ok: false,
      message: err.message || "Failed to establish SMTP connection",
      latencyMs,
    };
  }
}

/**
 * Dispatches a formatted document collaboration invite email to a recipient.
 */
export async function sendDocumentInviteEmail(params: {
  to: string;
  inviterName: string;
  documentTitle: string;
  workspaceName: string;
  inviteUrl: string;
  role: string;
  allowGuest: boolean;
}): Promise<{ ok: boolean; reason?: string }> {
  try {
    const config = await getSmtpConfig();

    if (!config.host) {
      console.warn("[Email Notification] SMTP host unconfigured; skipping email delivery.");
      return { ok: false, reason: "SMTP_NOT_CONFIGURED" };
    }

    const transporter = createTransporter(config);
    const roleLabel =
      params.role === "CONTRIBUTOR"
        ? "Can Edit"
        : params.role === "REVIEWER_GUIDE"
        ? "Can Comment"
        : "Can View";

    await transporter.sendMail({
      from: config.from,
      to: params.to.trim(),
      subject: `${params.inviterName} invited you to collaborate on "${params.documentTitle}"`,
      text: `${params.inviterName} has invited you to collaborate on "${params.documentTitle}" in ${params.workspaceName}.\n\nPermission: ${roleLabel}\n${params.allowGuest ? "Guest access is enabled.\n" : ""}Access URL: ${params.inviteUrl}\n\nThis invitation link expires in 14 days.`,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #09090b; color: #f4f4f5; padding: 40px 16px; min-height: 100%;">
          <div style="max-width: 540px; margin: 0 auto; background-color: #18181b; border: 1px solid #27272a; border-radius: 14px; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.6);">
            <div style="display: flex; align-items: center; margin-bottom: 24px;">
              <span style="font-size: 16px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">ShNotes</span>
              <span style="background-color: #27272a; color: #a1a1aa; font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 4px; margin-left: 10px;">${params.workspaceName}</span>
            </div>

            <h1 style="font-size: 20px; font-weight: 700; color: #ffffff; line-height: 1.3; margin-top: 0; margin-bottom: 12px;">
              Document Collaboration Invitation
            </h1>

            <p style="font-size: 14px; color: #a1a1aa; line-height: 1.6; margin-bottom: 24px;">
              <strong style="color: #ffffff;">${params.inviterName}</strong> has invited you to collaborate directly on the document <strong style="color: #ffffff;">"${params.documentTitle}"</strong>.
            </p>

            <div style="background-color: #09090b; border: 1px solid #27272a; border-radius: 10px; padding: 16px; margin-bottom: 28px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="font-size: 12px; color: #71717a;">Document</span>
                <span style="font-size: 12px; font-weight: 600; color: #f4f4f5;">${params.documentTitle}</span>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <span style="font-size: 12px; color: #71717a;">Assigned Permissions</span>
                <span style="font-size: 12px; font-weight: 600; color: #3b82f6;">${roleLabel}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="font-size: 12px; color: #71717a;">Access Mode</span>
                <span style="font-size: 12px; font-weight: 600; color: #10b981;">${params.allowGuest ? "Guest Access (Instant Entry)" : "Sign In / Workspace Account"}</span>
              </div>
            </div>

            <div style="text-align: center; margin-bottom: 28px;">
              <a href="${params.inviteUrl}" style="display: inline-block; background-color: #ffffff; color: #09090b; font-size: 13px; font-weight: 700; padding: 12px 28px; border-radius: 8px; text-decoration: none; box-shadow: 0 2px 10px rgba(255,255,255,0.15);">
                Open Document in ShNotes
              </a>
            </div>

            <p style="font-size: 11px; color: #71717a; line-height: 1.5; margin-bottom: 12px; word-break: break-all;">
              Or paste this URL directly into your browser: <br/>
              <a href="${params.inviteUrl}" style="color: #60a5fa; text-decoration: none;">${params.inviteUrl}</a>
            </p>

            <div style="border-top: 1px solid #27272a; padding-top: 16px; margin-top: 24px;">
              <p style="font-size: 11px; color: #52525b; margin: 0;">
                This invitation was sent by ${params.inviterName} via ShNotes Governed Workspace. Link valid for 14 days.
              </p>
            </div>
          </div>
        </div>
      `,
    });

    return { ok: true };
  } catch (err: any) {
    console.error("[Email Dispatch Error]:", err);
    return { ok: false, reason: err.message };
  }
}
