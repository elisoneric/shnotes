import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getSessionUser, createSession, COOKIE_NAME, SESSION_TTL_DAYS } from "@/lib/auth";
import { ensureSeedData } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || (!user.isSystemAdmin && user.role !== "OWNER")) {
      return NextResponse.json({ error: "Unauthorized administrative access" }, { status: 401 });
    }

    const body = await req.json();
    if (body.confirmation !== "CONFIRM_RESET_ALL_DATA") {
      return NextResponse.json(
        { error: "Confirmation keyword mismatch. Please confirm the database reset." },
        { status: 400 }
      );
    }

    console.warn(`[System Admin] Database reset triggered by administrator ${user.email} (${user.id}).`);

    // 1. Truncate all application data tables with cascade
    await prisma.$executeRawUnsafe(`
      TRUNCATE TABLE 
        "task_comments",
        "tasks",
        "page_subscribers",
        "page_collaborators",
        "pages",
        "project_members",
        "projects",
        "workspace_invites",
        "workspace_members",
        "workspaces",
        "auth_sessions",
        "users"
      CASCADE;
    `);

    // 2. Clean up transient document notification sessions while preserving SMTP configs
    await prisma.$executeRawUnsafe(`
      DELETE FROM "system_settings" 
      WHERE "key" NOT LIKE 'smtp_%' 
        AND "key" NOT LIKE 'app_%' 
        AND "key" NOT LIKE 'notify_%';
    `);

    // 3. Re-seed default administrative baseline
    await ensureSeedData();

    // 4. Retrieve the newly seeded root admin account
    const adminEmail = (process.env.ADMIN_EMAIL || "admin@esam.com.ng").toLowerCase().trim();
    const seededAdmin = await prisma.user.findFirst({
      where: {
        OR: [
          { email: adminEmail },
          { isSystemAdmin: true },
        ],
      },
    });

    if (seededAdmin) {
      // Re-establish session cookie for the freshly seeded administrator
      const rawToken = await createSession(seededAdmin.id, req.headers.get("user-agent") || undefined);
      const cookieStore = await cookies();
      cookieStore.set(COOKIE_NAME, rawToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
      });
    }

    return NextResponse.json({
      ok: true,
      message: "Database has been cleanly purged and re-seeded with fresh initial workspace state. SMTP settings have been preserved.",
    });
  } catch (err: any) {
    console.error("[Database Reset Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to execute database purge and re-seed" },
      { status: 500 }
    );
  }
}
