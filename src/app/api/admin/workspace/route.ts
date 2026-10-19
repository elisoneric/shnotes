import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { WorkspaceRole } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      include: { workspace: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "No workspace membership." }, { status: 403 });
    }

    const isOwner = membership.role === WorkspaceRole.OWNER || membership.role === WorkspaceRole.HOO;
    if (!isOwner) {
      return NextResponse.json({ error: "Admin access required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const isExport = searchParams.get("export") === "json";

    if (isExport) {
      // Export complete workspace backup
      const [workspace, projects, tasks, comments, pages] = await Promise.all([
        prisma.workspace.findUnique({ where: { id: membership.workspaceId } }),
        prisma.project.findMany({ where: { workspaceId: membership.workspaceId } }),
        prisma.task.findMany({
          where: { project: { workspaceId: membership.workspaceId } },
          include: {
            creator: { select: { id: true, name: true, email: true } },
            assignee: { select: { id: true, name: true, email: true } },
          },
        }),
        prisma.taskComment.findMany({
          where: { task: { project: { workspaceId: membership.workspaceId } } },
          include: { user: { select: { id: true, name: true, email: true } } },
        }),
        prisma.page.findMany({ where: { workspaceId: membership.workspaceId } }),
      ]);

      const backup = {
        exportedAt: new Date().toISOString(),
        version: "1.0",
        workspace,
        projects,
        tasks,
        comments,
        pages,
      };

      return new NextResponse(JSON.stringify(backup, null, 2), {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="${workspace?.slug || "workspace"}-backup-${new Date().toISOString().split("T")[0]}.json"`,
        },
      });
    }

    // Return workspace stats
    const [projectCount, taskCount, pageCount, memberCount] = await Promise.all([
      prisma.project.count({ where: { workspaceId: membership.workspaceId, deletedAt: null } }),
      prisma.task.count({ where: { project: { workspaceId: membership.workspaceId }, deletedAt: null } }),
      prisma.page.count({ where: { workspaceId: membership.workspaceId, deletedAt: null } }),
      prisma.workspaceMember.count({ where: { workspaceId: membership.workspaceId } }),
    ]);

    return NextResponse.json({
      ok: true,
      workspace: {
        id: membership.workspace.id,
        name: membership.workspace.name,
        slug: membership.workspace.slug,
        createdAt: membership.workspace.createdAt,
      },
      stats: {
        projects: projectCount,
        tasks: taskCount,
        pages: pageCount,
        members: memberCount,
      },
    });
  } catch (err: any) {
    console.error("[Admin Workspace GET Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to load workspace data" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
    });

    const isOwner = membership && (membership.role === WorkspaceRole.OWNER || membership.role === WorkspaceRole.HOO);
    if (!isOwner) {
      return NextResponse.json({ error: "Admin permission required." }, { status: 403 });
    }

    const { name } = await req.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Workspace name is required." }, { status: 400 });
    }

    const updated = await prisma.workspace.update({
      where: { id: membership.workspaceId },
      data: { name: name.trim() },
    });

    return NextResponse.json({ ok: true, workspace: updated });
  } catch (err: any) {
    console.error("[Admin Workspace PATCH Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to update workspace" }, { status: 500 });
  }
}
