import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import crypto from "crypto";
import { WorkspaceRole } from "@prisma/client";
import { sendDocumentInviteEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pageId, role = "CONTRIBUTOR", allowGuest = false, email } = await req.json();

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      include: { workspace: true },
    });

    if (!membership) {
      return NextResponse.json({ error: "No active workspace membership found." }, { status: 403 });
    }

    // Role check: Only OWNER, REVIEWER_GUIDE, or CONTRIBUTOR can invite
    if (membership.role === WorkspaceRole.VIEWER) {
      return NextResponse.json({ error: "Insufficient permission to invite collaborators." }, { status: 403 });
    }

    const token = "inv_" + crypto.randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days validity
    const cleanEmail = email?.trim().toLowerCase() || null;

    const invite = await prisma.workspaceInvite.create({
      data: {
        token,
        role: role as WorkspaceRole,
        allowGuest: Boolean(allowGuest),
        workspaceId: membership.workspaceId,
        pageId: pageId || null,
        email: cleanEmail,
        invitedById: user.id,
        expiresAt,
      },
    });

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const origin = `${proto}://${host}`;
    const inviteUrl = `${origin}/invite/${invite.token}`;

    let emailSent = false;
    let emailStatus = "not_requested";

    if (cleanEmail) {
      let pageTitle = "Untitled Document";
      if (pageId) {
        const page = await prisma.page.findUnique({
          where: { id: pageId },
          select: { title: true },
        });
        if (page?.title) pageTitle = page.title;

        // If user already exists in workspace, register them immediately as a document collaborator
        const existingStaff = await prisma.user.findUnique({
          where: { email: cleanEmail },
        });
        if (existingStaff) {
          await prisma.pageCollaborator.upsert({
            where: {
              pageId_userId: {
                pageId,
                userId: existingStaff.id,
              },
            },
            create: {
              pageId,
              userId: existingStaff.id,
              role: role as WorkspaceRole,
            },
            update: {
              role: role as WorkspaceRole,
            },
          });
        }
      }

      const emailResult = await sendDocumentInviteEmail({
        to: cleanEmail,
        inviterName: user.name || user.email,
        documentTitle: pageTitle,
        workspaceName: membership.workspace.name,
        inviteUrl,
        role: invite.role,
        allowGuest: invite.allowGuest,
      });

      emailSent = emailResult.ok;
      emailStatus = emailResult.ok ? "sent" : emailResult.reason || "failed";
    }

    return NextResponse.json({
      ok: true,
      invite: {
        id: invite.id,
        token: invite.token,
        email: invite.email,
        role: invite.role,
        allowGuest: invite.allowGuest,
        expiresAt: invite.expiresAt,
        inviteUrl,
        emailSent,
        emailStatus,
      },
    });
  } catch (err: any) {
    console.error("[Invite Create Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to create invite" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
    });

    if (!membership) {
      return NextResponse.json({ error: "No workspace membership" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const pageId = searchParams.get("pageId");

    const [invites, members] = await Promise.all([
      prisma.workspaceInvite.findMany({
        where: {
          workspaceId: membership.workspaceId,
          ...(pageId ? { pageId } : {}),
          expiresAt: { gte: new Date() },
          acceptedAt: null,
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.workspaceMember.findMany({
        where: { workspaceId: membership.workspaceId },
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
      }),
    ]);

    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
    const proto = req.headers.get("x-forwarded-proto") || "http";
    const origin = `${proto}://${host}`;

    const formattedInvites = invites.map((inv) => ({
      ...inv,
      inviteUrl: `${origin}/invite/${inv.token}`,
    }));

    return NextResponse.json({
      ok: true,
      invites: formattedInvites,
      members: members.map((m) => ({
        id: m.id,
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: m.role,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch invites" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { inviteId } = await req.json();
    if (!inviteId) {
      return NextResponse.json({ error: "Invite ID required" }, { status: 400 });
    }

    await prisma.workspaceInvite.delete({
      where: { id: inviteId },
    });

    return NextResponse.json({ ok: true, message: "Invitation revoked" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to revoke invitation" }, { status: 500 });
  }
}

