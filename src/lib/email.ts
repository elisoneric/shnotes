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

  const cleanHost = config.host.trim();
  const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(cleanHost);

  // If host is an IP, derive the TLS servername SNI from the user email or from domain
  let servername: string | undefined = undefined;
  if (isIp) {
    if (config.user && config.user.includes("@")) {
      servername = config.user.split("@")[1].trim();
    } else if (config.from && config.from.includes("@")) {
      const match = config.from.match(/@([a-zA-Z0-9.-]+)/);
      if (match) servername = match[1];
    }
  }

  return nodemailer.createTransport({
    host: cleanHost,
    port: config.port,
    secure: config.secure,
    connectionTimeout: 10000, // 10s connection timeout
    greetingTimeout: 10000,
    socketTimeout: 15000,
    auth: config.user
      ? {
          user: config.user.trim(),
          pass: config.pass,
        }
      : undefined,
    tls: {
      rejectUnauthorized: false, // Prevents certificate verification failures when using raw IP or self-signed certs
      servername: servername || undefined,
    },
  });
}

/**
 * Normalizes a sender address so that if only a name is given, it safely attaches the username email.
 */
export function normalizeSenderAddress(from: string, user: string): string {
  const cleanFrom = from.trim();
  if (!cleanFrom) {
    return user ? `"ShNotes Enterprise" <${user}>` : "noreply@note.esam.com.ng";
  }
  if (!cleanFrom.includes("@") && user && user.includes("@")) {
    return `"${cleanFrom}" <${user.trim()}>`;
  }
  return cleanFrom;
}


export interface CleanEmailOptions {
  title: string;
  badge?: string;
  headline: string;
  bodyHtml: string;
  details?: Array<{ label: string; value: string }>;
  ctaText?: string;
  ctaUrl?: string;
  secondaryNote?: string;
  footerText?: string;
}

/**
 * Renders a clean, minimalist, high-compatibility HTML email template
 * inspired by top design standards (Linear, Notion, Apple, Stripe).
 * Uses table-based layout without flexbox to prevent broken borders or alignment in email clients.
 */
export function renderCleanEmailTemplate(options: CleanEmailOptions): string {
  const {
    title,
    badge,
    headline,
    bodyHtml,
    details = [],
    ctaText,
    ctaUrl,
    secondaryNote,
    footerText,
  } = options;

  const detailsRows = details.length > 0
    ? `
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border: 1px solid #f3f4f6; border-radius: 8px; margin: 24px 0;">
        ${details.map((d, idx) => `
          <tr>
            <td style="padding: 10px 16px; font-size: 13px; color: #6b7280; ${idx < details.length - 1 ? 'border-bottom: 1px solid #f3f4f6;' : ''}">
              ${d.label}
            </td>
            <td align="right" style="padding: 10px 16px; font-size: 13px; font-weight: 600; color: #111827; ${idx < details.length - 1 ? 'border-bottom: 1px solid #f3f4f6;' : ''}">
              ${d.value}
            </td>
          </tr>
        `).join("")}
      </table>
    `
    : "";

  const ctaButton = ctaText && ctaUrl
    ? `
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin: 28px 0 20px 0;">
        <tr>
          <td align="center">
            <a href="${ctaUrl}" style="background-color: #111827; color: #ffffff; display: inline-block; padding: 12px 28px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none; letter-spacing: -0.1px;">
              ${ctaText}
            </a>
          </td>
        </tr>
      </table>
    `
    : "";

  const secondaryText = secondaryNote
    ? `
      <p style="margin: 16px 0 0 0; font-size: 12px; color: #9ca3af; line-height: 1.5; text-align: center; word-break: break-all;">
        ${secondaryNote}
      </p>
    `
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #fafafa; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #111827;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #fafafa; padding: 48px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 520px; background-color: #ffffff; border: 1px solid #eaeaea; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);">
          <tr>
            <td style="padding: 36px 32px;">
              <!-- Wordmark Header -->
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <td>
                    <span style="font-size: 15px; font-weight: 700; color: #111827; letter-spacing: -0.4px;">ShNotes</span>
                  </td>
                  ${badge ? `
                    <td align="right">
                      <span style="background-color: #f3f4f6; color: #4b5563; font-size: 11px; font-weight: 500; padding: 3px 8px; border-radius: 6px;">
                        ${badge}
                      </span>
                    </td>
                  ` : ''}
                </tr>
              </table>

              <!-- Main Title -->
              <h1 style="margin: 0 0 12px 0; font-size: 20px; font-weight: 600; color: #111827; line-height: 1.35; letter-spacing: -0.3px;">
                ${headline}
              </h1>

              <!-- Message Body -->
              <div style="font-size: 14px; color: #4b5563; line-height: 1.6; margin: 0 0 16px 0;">
                ${bodyHtml}
              </div>

              <!-- Metadata Summary -->
              ${detailsRows}

              <!-- Action Button -->
              ${ctaButton}

              <!-- Fallback Note -->
              ${secondaryText}

              <!-- Subtle Minimalist Footer -->
              <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #f3f4f6;">
                <p style="margin: 0; font-size: 12px; color: #9ca3af; line-height: 1.5;">
                  ${footerText || "Sent by ShNotes Enterprise Workspace."}
                </p>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
        from: normalizeSenderAddress(config.from, config.user),
        to: recipientEmail.trim(),
        subject: "ShNotes SMTP Verification Handshake Successful",
        text: `This is a test notification from ShNotes Enterprise. Your SMTP connection to ${config.host}:${config.port} is operational with latency ${latencyMs}ms.`,
        html: renderCleanEmailTemplate({
          title: "SMTP Connection Verified",
          badge: "Operational",
          headline: "SMTP handshake verified",
          bodyHtml: `Your outbound email delivery subsystem is connected to <strong>${config.host}:${config.port}</strong>. All system invites and notifications are operational.`,
          details: [
            { label: "Host", value: config.host },
            { label: "Port", value: `${config.port} (${config.secure ? "SSL 465" : "STARTTLS 587"})` },
            { label: "Account", value: config.user || "Anonymous" },
            { label: "Latency", value: `${latencyMs}ms` },
          ],
          footerText: "Automated delivery test dispatched from ShNotes Administration.",
        }),
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
      from: normalizeSenderAddress(config.from, config.user),
      to: params.to.trim(),
      subject: `${params.inviterName} invited you to collaborate on "${params.documentTitle}"`,
      text: `${params.inviterName} has invited you to collaborate on "${params.documentTitle}".\n\nPermission: ${roleLabel}\n${params.allowGuest ? "Guest access is enabled.\n" : ""}Access URL: ${params.inviteUrl}\n\nThis invitation grants access specifically to this canvas note.`,
      html: renderCleanEmailTemplate({
        title: `${params.inviterName} invited you to collaborate`,
        badge: params.workspaceName,
        headline: `Collaborate on "${params.documentTitle}"`,
        bodyHtml: `<strong>${params.inviterName}</strong> has invited you to collaborate on the canvas note <strong>"${params.documentTitle}"</strong>.<br/><br/><span style="font-size: 13px; color: #6b7280;">This invitation grants access specifically to this note.</span>`,
        details: [
          { label: "Document", value: params.documentTitle },
          { label: "Permission", value: roleLabel },
          { label: "Access Mode", value: params.allowGuest ? "Guest access enabled" : "Collaborator access" },
        ],
        ctaText: "Open Document",
        ctaUrl: params.inviteUrl,
        secondaryNote: `Or open directly: <a href="${params.inviteUrl}" style="color: #4b5563; text-decoration: underline;">${params.inviteUrl}</a>`,
        footerText: `This invitation link is valid for 14 days. Sent by ${params.inviterName} via ShNotes.`,
      }),
    });

    return { ok: true };
  } catch (err: any) {
    console.error("[Email Dispatch Error]:", err);
    return { ok: false, reason: err.message };
  }
}

/**
 * Dispatches a welcome onboarding email to a new user or team member.
 */
export async function sendWelcomeEmail(params: {
  to: string;
  name: string;
  workspaceName?: string;
  role?: string;
}): Promise<{ ok: boolean; reason?: string }> {
  try {
    const config = await getSmtpConfig();

    if (!config.host) {
      console.log("[Welcome Email] SMTP unconfigured; skipping welcome email delivery.");
      return { ok: false, reason: "SMTP_NOT_CONFIGURED" };
    }

    const transporter = createTransporter(config);
    const appUrl = config.appUrl || "https://note.esam.com.ng";
    const workspaceName = params.workspaceName || "Trust Bricks";
    const roleName = params.role ? params.role.replace(/_/g, " ") : "Member";

    await transporter.sendMail({
      from: normalizeSenderAddress(config.from, config.user),
      to: params.to.trim(),
      subject: `Welcome to ShNotes – Your Workspace for Notes & Tasks`,
      text: `Welcome to ShNotes, ${params.name}!\n\nYour account has been set up with access to ${workspaceName} as ${roleName}.\n\nAccess your workspace at: ${appUrl}/app`,
      html: renderCleanEmailTemplate({
        title: "Welcome to ShNotes",
        badge: workspaceName,
        headline: `Welcome to ShNotes, ${params.name}`,
        bodyHtml: `Your account has been provisioned. You have access to collaborate on notes, organize task boards, and share documents with your team.`,
        details: [
          { label: "Workspace", value: workspaceName },
          { label: "Assigned Role", value: roleName },
          { label: "Account Email", value: params.to },
        ],
        ctaText: "Open Workspace",
        ctaUrl: `${appUrl}/app`,
        footerText: "ShNotes — Clean notes and visual tasks for teams.",
      }),
    });

    return { ok: true };
  } catch (err: any) {
    console.error("[Welcome Email Error]:", err);
    return { ok: false, reason: err.message };
  }
}

