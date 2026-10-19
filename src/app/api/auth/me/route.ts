import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser, COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureSeedData } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSeedData();

    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ authenticated: false, user: null });
    }

    // Get user's active workspace - prioritize owned workspace
    let member = await prisma.workspaceMember.findFirst({
      where: { userId: user.id, role: "OWNER" },
      include: {
        workspace: {
          include: {
            projects: { where: { deletedAt: null } },
          },
        },
      },
    });

    if (!member) {
      member = await prisma.workspaceMember.findFirst({
        where: { userId: user.id },
        include: {
          workspace: {
            include: {
              projects: { where: { deletedAt: null } },
            },
          },
        },
      });
    }

    let workspace = member?.workspace || null;
    let activeRole = member?.role || user.role;

    if (!workspace) {
      const personalWs = await prisma.workspace.create({
        data: {
          name: `${user.name.split(" ")[0]}'s Workspace`,
          slug: `ws-${user.id.slice(-6)}-${Math.random().toString(36).substring(2, 6)}`,
          members: {
            create: {
              userId: user.id,
              role: "OWNER",
            },
          },
          projects: {
            create: {
              name: "General Tasks",
              key: "GEN",
              description: "Personal tasks and to-do items",
              ownerName: user.name,
            },
          },
        },
        include: {
          projects: true,
        },
      });
      workspace = personalWs;
      activeRole = "OWNER";
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: activeRole,
      },
      workspace: workspace
        ? {
            id: workspace.id,
            name: workspace.name,
            slug: workspace.slug,
            projects: workspace.projects,
          }
        : null,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to get user session" }, { status: 500 });
  }
}

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
