import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { WorkspaceRole } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET() {
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

    const [members, invites] = await Promise.all([
      prisma.workspaceMember.findMany({
        where: { workspaceId: membership.workspaceId },
        include: {
          user: {
            select: { id: true, name: true, email: true, createdAt: true },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.workspaceInvite.findMany({
        where: {
          workspaceId: membership.workspaceId,
          expiresAt: { gte: new Date() },
          acceptedAt: null,
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const formattedMembers = members.map((m) => ({
      membershipId: m.id,
      userId: m.user.id,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      joinedAt: m.createdAt,
      isCurrentUser: m.user.id === user.id,
    }));

    return NextResponse.json({
      ok: true,
      workspaceName: membership.workspace.name,
      workspaceId: membership.workspace.id,
      members: formattedMembers,
      pendingInvites: invites,
    });
  } catch (err: any) {
    console.error("[Admin Members GET Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to load members" }, { status: 500 });
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

    const { targetUserId, newRole } = await req.json();
    if (!targetUserId || !newRole) {
      return NextResponse.json({ error: "Target user and new role required." }, { status: 400 });
    }

    // Update role
    const updated = await prisma.workspaceMember.update({
      where: {
        workspaceId_userId: {
          workspaceId: membership.workspaceId,
          userId: targetUserId,
        },
      },
      data: {
        role: newRole as WorkspaceRole,
      },
    });

    return NextResponse.json({ ok: true, membership: updated });
  } catch (err: any) {
    console.error("[Admin Members PATCH Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to update role" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
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

    const { searchParams } = new URL(req.url);
    const targetUserId = searchParams.get("userId");

    if (!targetUserId) {
      return NextResponse.json({ error: "User ID required." }, { status: 400 });
    }

    if (targetUserId === user.id) {
      return NextResponse.json({ error: "Cannot remove yourself from workspace." }, { status: 400 });
    }

    await prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId: membership.workspaceId,
          userId: targetUserId,
        },
      },
    });

    return NextResponse.json({ ok: true, removedUserId: targetUserId });
  } catch (err: any) {
    console.error("[Admin Members DELETE Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to remove member" }, { status: 500 });
  }
}
