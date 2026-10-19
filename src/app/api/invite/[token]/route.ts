import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { hashPassword, createSession, getSessionUser, COOKIE_NAME, SESSION_TTL_DAYS } from "@/lib/auth";
import { WorkspaceRole, TaskStage, TaskPriority } from "@prisma/client";
import { ensureSeedData } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    await ensureSeedData();
    const { token } = await params;

    const invite = await prisma.workspaceInvite.findUnique({
      where: { token },
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
        page: { select: { id: true, title: true, secretToken: true } },
      },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found or invalid token." }, { status: 404 });
    }

    const isExpired = invite.expiresAt < new Date();
    const isAccepted = Boolean(invite.acceptedAt);

    return NextResponse.json({
      ok: true,
      invite: {
        token: invite.token,
        role: invite.role,
        allowGuest: invite.allowGuest,
        isExpired,
        isAccepted,
        workspaceName: invite.workspace.name,
        workspaceId: invite.workspace.id,
        pageId: invite.page?.id || null,
        pageTitle: invite.page?.title || null,
        pageSecretToken: invite.page?.secretToken || null,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to inspect invite" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;

    const invite = await prisma.workspaceInvite.findUnique({
      where: { token },
      include: {
        workspace: true,
        page: true,
      },
    });

    if (!invite) {
      return NextResponse.json({ error: "Invite not found." }, { status: 404 });
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json({ error: "This invite has expired." }, { status: 410 });
    }

    const body = await req.json().catch(() => ({}));
    const user = await getSessionUser();
    let targetUserId: string;

    // If not authenticated, require registration fields
    if (!user) {
      const { name, email, password } = body;
      if (!name || !email || !password) {
        return NextResponse.json(
          { error: "Name, email, and password are required to accept this invitation." },
          { status: 400 }
        );
      }

      const cleanEmail = email.toLowerCase().trim();
      const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });

      if (existingUser) {
        return NextResponse.json(
          { error: "An account with this email already exists. Please log in first to accept this invitation." },
          { status: 409 }
        );
      }

      // Create new user
      const passwordHash = hashPassword(password);
      const newUser = await prisma.user.create({
        data: {
          name: name.trim(),
          email: cleanEmail,
          passwordHash,
          role: invite.pageId ? WorkspaceRole.OWNER : invite.role,
        },
      });
      targetUserId = newUser.id;

      // When invited to a specific note, the user starts fresh in their own workspace
      if (invite.pageId) {
        const userWs = await prisma.workspace.create({
          data: {
            name: `${newUser.name.split(" ")[0]}'s Workspace`,
            slug: `ws-${newUser.id.slice(-6)}-${Math.random().toString(36).substring(2, 6)}`,
            members: {
              create: {
                userId: newUser.id,
                role: WorkspaceRole.OWNER,
              },
            },
          },
        });

        const userProj = await prisma.project.create({
          data: {
            name: "General Tasks",
            key: "GEN",
            description: "Personal tasks and to-do items",
            workspaceId: userWs.id,
            ownerName: newUser.name,
          },
        });

        await prisma.task.create({
          data: {
            projectId: userProj.id,
            projectTaskId: `${userProj.key}-101`,
            title: "Welcome to your task board",
            description: "Track tasks, set priorities, and collaborate with your team.",
            stage: TaskStage.PROPOSED,
            priority: TaskPriority.MEDIUM,
            creatorId: newUser.id,
            order: 1.0,
          },
        });
      }

      // Create session cookie
      const rawToken = await createSession(newUser.id, req.headers.get("user-agent") || undefined);
      const cookieStore = await cookies();
      cookieStore.set(COOKIE_NAME, rawToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
        path: "/",
      });
    } else {
      targetUserId = user.id;
    }

    if (invite.pageId) {
      // Note-Level Invite: Grant collaboration permission ONLY to this specific page
      await prisma.pageCollaborator.upsert({
        where: {
          pageId_userId: {
            pageId: invite.pageId,
            userId: targetUserId,
          },
        },
        create: {
          pageId: invite.pageId,
          userId: targetUserId,
          role: invite.role,
        },
        update: {
          role: invite.role,
        },
      });
    } else {
      // Workspace-Level Invite: Add user as member to workspace
      await prisma.workspaceMember.upsert({
        where: {
          workspaceId_userId: {
            workspaceId: invite.workspaceId,
            userId: targetUserId,
          },
        },
        create: {
          workspaceId: invite.workspaceId,
          userId: targetUserId,
          role: invite.role,
        },
        update: {
          role: invite.role,
        },
      });
    }

    // Mark invite accepted
    await prisma.workspaceInvite.update({
      where: { id: invite.id },
      data: { acceptedAt: new Date() },
    });

    return NextResponse.json({
      ok: true,
      redirectUrl: invite.pageId ? `/app?page=${invite.pageId}` : "/app",
      workspaceName: invite.workspace.name,
      pageTitle: invite.page?.title || null,
    });
  } catch (err: any) {
    console.error("[Accept Invite Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to accept invite" }, { status: 500 });
  }
}
