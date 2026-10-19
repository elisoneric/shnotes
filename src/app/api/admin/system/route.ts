import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!user.isSystemAdmin && user.role !== "OWNER") {
      return NextResponse.json({ error: "Access denied. Superadmin only." }, { status: 403 });
    }

    const startTime = Date.now();
    let dbStatus = "Connected";
    let dbLatencyMs = 0;

    try {
      await prisma.$queryRaw`SELECT 1`;
      dbLatencyMs = Date.now() - startTime;
    } catch (e) {
      dbStatus = "Unreachable";
    }

    const [workspacesCount, usersCount, projectsCount, tasksCount, pagesCount, workspaces] =
      await Promise.all([
        prisma.workspace.count().catch(() => 0),
        prisma.user.count().catch(() => 0),
        prisma.project.count().catch(() => 0),
        prisma.task.count().catch(() => 0),
        prisma.page.count().catch(() => 0),
        prisma.workspace.findMany({
          select: {
            id: true,
            name: true,
            slug: true,
            createdAt: true,
            _count: {
              select: {
                members: true,
                projects: true,
                pages: true,
              },
            },
          },
          take: 10,
        }).catch(() => []),
      ]);

    return NextResponse.json({
      ok: true,
      systemHealth: {
        database: {
          status: dbStatus,
          latencyMs: dbLatencyMs,
          engine: "PostgreSQL 16",
        },
        server: {
          nodeEnv: process.env.NODE_ENV || "production",
          appUrl: process.env.APP_URL || "https://note.esam.com.ng",
          version: "1.2.0-enterprise",
          uptimeSeconds: Math.floor(process.uptime()),
        },
        featureFlags: {
          indunixAiGateway: Boolean(process.env.INDUNIX_API_KEY || true),
          offlineSyncEngine: true,
          readerSubscriptions: true,
          ballInCourtGovernance: true,
        },
      },
      metrics: {
        totalWorkspaces: workspacesCount,
        totalUsers: usersCount,
        totalProjects: projectsCount,
        totalTasks: tasksCount,
        totalPages: pagesCount,
      },
      tenants: workspaces,
    });
  } catch (err: any) {
    console.error("[System Admin Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch system metrics" }, { status: 500 });
  }
}
