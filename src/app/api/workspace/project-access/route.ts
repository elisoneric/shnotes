import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { ProjectAccessLevel } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const workspaceId = searchParams.get("workspaceId");

    const memberWhere = workspaceId
      ? { workspaceId }
      : { workspace: { members: { some: { userId: user.id } } } };

    const [members, projects, projectMembers] = await Promise.all([
      prisma.workspaceMember.findMany({
        where: memberWhere,
        include: {
          user: {
            select: { id: true, name: true, email: true, role: true, avatarUrl: true },
          },
        },
      }),
      prisma.project.findMany({
        where: memberWhere,
        select: { id: true, name: true, key: true, colorAccent: true },
      }),
      prisma.projectMember.findMany({
        where: {
          project: memberWhere,
        },
        select: { id: true, projectId: true, userId: true, accessLevel: true },
      }),
    ]);

    return NextResponse.json({
      ok: true,
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      })),
      projects,
      projectMembers,
    });
  } catch (err: any) {
    console.error("[Project Access GET Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to load project access" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { userId, projectId, grant, accessLevel } = await req.json();

    if (!userId || !projectId) {
      return NextResponse.json({ error: "userId and projectId are required." }, { status: 400 });
    }

    if (grant) {
      const level = (accessLevel as ProjectAccessLevel) || ProjectAccessLevel.CONTRIBUTOR;
      await prisma.projectMember.upsert({
        where: {
          projectId_userId: { projectId, userId },
        },
        create: {
          projectId,
          userId,
          accessLevel: level,
        },
        update: {
          accessLevel: level,
        },
      });
    } else {
      await prisma.projectMember.deleteMany({
        where: { projectId, userId },
      });
    }

    return NextResponse.json({ ok: true, granted: Boolean(grant) });
  } catch (err: any) {
    console.error("[Project Access POST Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to update project access grant" }, { status: 500 });
  }
}
