import { prisma } from "@/lib/db";
import { getSmtpConfig, createTransporter, normalizeSenderAddress, renderCleanEmailTemplate } from "@/lib/email";

interface DocumentEditSession {
  pageId: string;
  editorId: string;
  editorName: string;
  sessionStartedAt: number;
  lastEditedAt: number;
  editCount: number;
  dispatched: boolean;
}

// In-memory debounce timers map
const activeTimers = new Map<string, NodeJS.Timeout>();

const DEFAULT_QUIET_WINDOW_MINUTES = 15;
const DEFAULT_MIN_INTERVAL_MINUTES = 60;
const DEFAULT_MAX_PER_DAY = 3;

/**
 * Gets notification rate-limit and consolidation configuration
 */
export async function getNotificationConfig() {
  const envQuiet = parseInt(process.env.NOTIFY_QUIET_WINDOW_MINUTES || "15", 10);
  const envMinInterval = parseInt(process.env.NOTIFY_MIN_INTERVAL_MINUTES || "60", 10);
  const envMaxPerDay = parseInt(process.env.NOTIFY_MAX_PER_DAY || "3", 10);

  let quietWindowMinutes = isNaN(envQuiet) ? DEFAULT_QUIET_WINDOW_MINUTES : envQuiet;
  let minIntervalMinutes = isNaN(envMinInterval) ? DEFAULT_MIN_INTERVAL_MINUTES : envMinInterval;
  let maxPerDay = isNaN(envMaxPerDay) ? DEFAULT_MAX_PER_DAY : envMaxPerDay;

  try {
    const settings = await prisma.systemSetting.findMany({
      where: {
        key: { in: ["notify_quiet_window", "notify_min_interval", "notify_max_per_day"] },
      },
    });
    for (const s of settings) {
      if (s.key === "notify_quiet_window") quietWindowMinutes = parseInt(s.value, 10) || quietWindowMinutes;
      if (s.key === "notify_min_interval") minIntervalMinutes = parseInt(s.value, 10) || minIntervalMinutes;
      if (s.key === "notify_max_per_day") maxPerDay = parseInt(s.value, 10) || maxPerDay;
    }
  } catch {
    // Silently fall back to defaults
  }

  return { quietWindowMinutes, minIntervalMinutes, maxPerDay };
}

export async function saveNotificationConfig(config: {
  maxPerDay?: number;
  minIntervalMinutes?: number;
  quietWindowMinutes?: number;
}) {
  if (config.maxPerDay !== undefined) {
    await prisma.systemSetting.upsert({
      where: { key: "notify_max_per_day" },
      create: { key: "notify_max_per_day", value: String(config.maxPerDay) },
      update: { value: String(config.maxPerDay) },
    });
  }
  if (config.minIntervalMinutes !== undefined) {
    await prisma.systemSetting.upsert({
      where: { key: "notify_min_interval" },
      create: { key: "notify_min_interval", value: String(config.minIntervalMinutes) },
      update: { value: String(config.minIntervalMinutes) },
    });
  }
  if (config.quietWindowMinutes !== undefined) {
    await prisma.systemSetting.upsert({
      where: { key: "notify_quiet_window" },
      create: { key: "notify_quiet_window", value: String(config.quietWindowMinutes) },
      update: { value: String(config.quietWindowMinutes) },
    });
  }
}

/**
 * Records an edit on a document, debouncing and packaging the editing session.
 */
export async function recordDocumentEdit(params: {
  pageId: string;
  editorId: string;
  editorName: string;
}): Promise<void> {
  const { pageId, editorId, editorName } = params;
  const now = Date.now();
  const sessionKey = `doc_session_${pageId}`;

  let session: DocumentEditSession = {
    pageId,
    editorId,
    editorName,
    sessionStartedAt: now,
    lastEditedAt: now,
    editCount: 1,
    dispatched: false,
  };

  try {
    const existingRecord = await prisma.systemSetting.findUnique({
      where: { key: sessionKey },
    });

    if (existingRecord) {
      const parsed: DocumentEditSession = JSON.parse(existingRecord.value);
      // If previous session was already dispatched, or last edit was over 2 hours ago, start new session
      if (parsed.dispatched || now - parsed.lastEditedAt > 2 * 60 * 60 * 1000) {
        session = {
          pageId,
          editorId,
          editorName,
          sessionStartedAt: now,
          lastEditedAt: now,
          editCount: 1,
          dispatched: false,
        };
      } else {
        session = {
          ...parsed,
          editorId,
          editorName,
          lastEditedAt: now,
          editCount: (parsed.editCount || 0) + 1,
          dispatched: false,
        };
      }
    }

    await prisma.systemSetting.upsert({
      where: { key: sessionKey },
      create: { key: sessionKey, value: JSON.stringify(session) },
      update: { value: JSON.stringify(session) },
    });
  } catch (err) {
    console.warn("[Notifications] Failed to record session in DB:", err);
  }

  // Clear existing in-memory timer if any
  if (activeTimers.has(pageId)) {
    clearTimeout(activeTimers.get(pageId)!);
    activeTimers.delete(pageId);
  }

  // Get configured quiet window
  const config = await getNotificationConfig();
  const quietWindowMs = config.quietWindowMinutes * 60 * 1000;

  // Schedule consolidation dispatch after quiet window of inactivity
  const timer = setTimeout(async () => {
    activeTimers.delete(pageId);
    await checkAndDispatchSession(pageId);
  }, quietWindowMs);

  activeTimers.set(pageId, timer);
}

/**
 * Checks if a document's session has been quiet long enough and dispatches notification.
 */
async function checkAndDispatchSession(pageId: string): Promise<void> {
  const sessionKey = `doc_session_${pageId}`;

  try {
    const record = await prisma.systemSetting.findUnique({ where: { key: sessionKey } });
    if (!record) return;

    const session: DocumentEditSession = JSON.parse(record.value);
    if (session.dispatched) return;

    const config = await getNotificationConfig();
    const quietWindowMs = config.quietWindowMinutes * 60 * 1000;

    // Verify quiet window has indeed passed
    if (Date.now() - session.lastEditedAt < quietWindowMs) {
      return;
    }

    await dispatchConsolidatedNotification(session);

    // Mark as dispatched
    session.dispatched = true;
    await prisma.systemSetting.update({
      where: { key: sessionKey },
      data: { value: JSON.stringify(session) },
    });
  } catch (err) {
    console.error("[Notifications] checkAndDispatchSession error:", err);
  }
}

/**
 * Flushes any pending sessions whose quiet window has elapsed.
 */
export async function processPendingDocumentNotifications(): Promise<void> {
  try {
    const records = await prisma.systemSetting.findMany({
      where: { key: { startsWith: "doc_session_" } },
    });

    const config = await getNotificationConfig();
    const quietWindowMs = config.quietWindowMinutes * 60 * 1000;
    const now = Date.now();

    for (const r of records) {
      try {
        const session: DocumentEditSession = JSON.parse(r.value);
        if (!session.dispatched && now - session.lastEditedAt >= quietWindowMs) {
          await dispatchConsolidatedNotification(session);
          session.dispatched = true;
          await prisma.systemSetting.update({
            where: { key: r.key },
            data: { value: JSON.stringify(session) },
          });
        }
      } catch {
        // Continue loop if one record fails
      }
    }
  } catch (err) {
    console.warn("[Notifications] processPendingDocumentNotifications error:", err);
  }
}

/**
 * Dispatches a consolidated notification email to all collaborators and subscribers of a document.
 */
async function dispatchConsolidatedNotification(session: DocumentEditSession): Promise<void> {
  const { pageId, editorId, editorName, editCount, sessionStartedAt, lastEditedAt } = session;

  const page = await prisma.page.findUnique({
    where: { id: pageId },
    include: {
      workspace: { select: { id: true, name: true, slug: true } },
      collaborators: {
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      },
      subscribers: { select: { email: true } },
    },
  });

  if (!page || page.deletedAt) return;

  const config = await getNotificationConfig();
  const now = Date.now();

  // 1. Minimum interval rate-limit check (e.g. 60 mins)
  const lastNotifiedKey = `doc_last_notified_${pageId}`;
  const lastNotifiedRecord = await prisma.systemSetting.findUnique({ where: { key: lastNotifiedKey } });

  if (lastNotifiedRecord) {
    const lastNotifiedTime = parseInt(lastNotifiedRecord.value, 10);
    const minIntervalMs = config.minIntervalMinutes * 60 * 1000;
    if (now - lastNotifiedTime < minIntervalMs) {
      console.log(`[Notifications] Skipping digest for ${page.title}: within minimum cooldown window.`);
      return;
    }
  }

  // 2. Daily limit check (e.g. max 3 per day)
  const todayDateStr = new Date().toISOString().slice(0, 10);
  const dailyKey = `doc_daily_count_${pageId}_${todayDateStr}`;
  const dailyRecord = await prisma.systemSetting.findUnique({ where: { key: dailyKey } });
  const currentDailyCount = dailyRecord ? parseInt(dailyRecord.value, 10) : 0;

  if (currentDailyCount >= config.maxPerDay) {
    console.log(`[Notifications] Skipping digest for ${page.title}: reached daily limit of ${config.maxPerDay}.`);
    return;
  }

  // 3. Compile unique recipient email list (strictly excluding the editor)
  const recipientEmails = new Set<string>();

  for (const c of page.collaborators) {
    if (c.userId !== editorId && c.user?.email) {
      recipientEmails.add(c.user.email.toLowerCase().trim());
    }
  }

  for (const s of page.subscribers) {
    if (s.email) {
      recipientEmails.add(s.email.toLowerCase().trim());
    }
  }

  if (recipientEmails.size === 0) {
    return;
  }

  // 4. Verify SMTP configuration
  const smtpConfig = await getSmtpConfig();
  if (!smtpConfig.host) {
    console.log("[Notifications] SMTP unconfigured; skipping digest dispatch.");
    return;
  }

  const transporter = createTransporter(smtpConfig);
  const appUrl = smtpConfig.appUrl || "https://note.esam.com.ng";
  const documentUrl = page.secretToken
    ? `${appUrl}/shared/${page.secretToken}`
    : `${appUrl}/app`;

  const durationMins = Math.max(1, Math.round((lastEditedAt - sessionStartedAt) / 60000));
  const startTimeStr = new Date(sessionStartedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const endTimeStr = new Date(lastEditedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const subject = `Updates made to "${page.title}" by ${editorName}`;
  const htmlBody = renderCleanEmailTemplate({
    title: `Updates to "${page.title}"`,
    badge: page.workspace?.name || "Workspace",
    headline: `Updates made to "${page.title}"`,
    bodyHtml: `<strong>${editorName}</strong> made revisions to the document <strong>"${page.title}"</strong>.`,
    details: [
      { label: "Document", value: page.title },
      { label: "Revisions", value: `${editCount} modifications` },
      { label: "Session Time", value: `${startTimeStr} – ${endTimeStr} (${durationMins} min)` },
    ],
    ctaText: "Review Document Changes",
    ctaUrl: documentUrl,
    footerText: `Consolidated notification limited to max ${config.maxPerDay} daily updates per user to prevent inbox flooding. Sent to document collaborators and subscribers.`,
  });

  // Send to recipients with individual daily flood limits
  for (const to of Array.from(recipientEmails)) {
    const recipientDailyKey = `recipient_daily_count_${to}_${todayDateStr}`;
    const recipientRecord = await prisma.systemSetting.findUnique({ where: { key: recipientDailyKey } });
    const recipientDailyCount = recipientRecord ? parseInt(recipientRecord.value, 10) : 0;

    if (recipientDailyCount >= config.maxPerDay) {
      console.log(`[Notifications] Skipping recipient ${to}: reached daily inbox flood limit of ${config.maxPerDay} notifications.`);
      continue;
    }

    try {
      await transporter.sendMail({
        from: normalizeSenderAddress(smtpConfig.from, smtpConfig.user),
        to,
        subject,
        text: `${editorName} updated "${page.title}" (${editCount} modifications). Review changes at: ${documentUrl}`,
        html: htmlBody,
      });

      // Increment recipient's daily count
      await prisma.systemSetting.upsert({
        where: { key: recipientDailyKey },
        create: { key: recipientDailyKey, value: String(recipientDailyCount + 1) },
        update: { value: String(recipientDailyCount + 1) },
      });
    } catch (sendErr) {
      console.warn(`[Notifications] Failed sending digest to ${to}:`, sendErr);
    }
  }

  // Record dispatch timestamp and increment daily count
  await prisma.systemSetting.upsert({
    where: { key: lastNotifiedKey },
    create: { key: lastNotifiedKey, value: String(now) },
    update: { value: String(now) },
  });

  await prisma.systemSetting.upsert({
    where: { key: dailyKey },
    create: { key: dailyKey, value: String(currentDailyCount + 1) },
    update: { value: String(currentDailyCount + 1) },
  });

  console.log(`[Notifications] Consolidated digest dispatched to ${recipientEmails.size} recipients for "${page.title}".`);
}
