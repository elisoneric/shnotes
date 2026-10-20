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

    const memberships = await prisma.workspaceMember.findMany({
      where: { userId: user.id },
      include: {
        workspace: {
          include: {
            projects: {
              where: { deletedAt: null },
              select: { id: true, name: true, key: true, colorAccent: true },
            },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const workspaces = memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      logoUrl: m.workspace.logoUrl,
      role: m.role,
      projects: m.workspace.projects,
    }));

    return NextResponse.json({
      workspaces,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err: any) {
    console.error("[Workspace List Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to load workspaces" }, { status: 500 });
  }
}
