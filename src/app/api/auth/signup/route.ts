import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { hashPassword, createSession, COOKIE_NAME, SESSION_TTL_DAYS } from "@/lib/auth";
import { WorkspaceRole, TaskStage, TaskPriority } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { name, email, password, workspaceName, projectName, projectKey } = await req.json();

    if (!name || !email || !password || !workspaceName) {
      return NextResponse.json(
        { error: "Name, email, password, and workspace name are required." },
        { status: 400 }
      );
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email address already exists. Please log in." },
        { status: 409 }
      );
    }

    const passwordHash = hashPassword(password);
    const slug =
      workspaceName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "") +
      "-" +
      Math.random().toString(36).substring(2, 6);

    // Create User, Workspace, Member, and Initial Project in transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: name.trim(),
          email: cleanEmail,
          passwordHash,
          role: WorkspaceRole.OWNER,
        },
      });

      const workspace = await tx.workspace.create({
        data: {
          name: workspaceName.trim(),
          slug,
          members: {
            create: {
              userId: user.id,
              role: WorkspaceRole.OWNER,
            },
          },
        },
      });

      const pName = projectName?.trim() || "General Tasks";
      const pKey = (projectKey?.trim() || workspaceName.slice(0, 3)).toUpperCase().replace(/[^A-Z]/g, "PR");

      const project = await tx.project.create({
        data: {
          name: pName,
          key: pKey.slice(0, 4) || "GEN",
          description: "Primary workspace for tasks and to-do items",
          workspaceId: workspace.id,
          ownerName: user.name,
        },
      });

      // Create starter task
      await tx.task.create({
        data: {
          projectId: project.id,
          projectTaskId: `${project.key}-101`,
          title: "Welcome to your task board",
          description: "Organize tasks, set priorities, and track your work.",
          stage: TaskStage.PROPOSED,
          priority: TaskPriority.MEDIUM,
          creatorId: user.id,
          order: 1.0,
        },
      });

      // Create starter document
      await tx.page.create({
        data: {
          workspaceId: workspace.id,
          title: "Welcome to Notes",
          content: {
            blocks: [
              { id: "b1", type: "heading", level: 1, text: `Welcome to ${workspace.name}` },
              { id: "b2", type: "paragraph", text: "This is your clean canvas for writing notes, drafting documentation, and keeping track of thoughts." },
              { id: "b3", type: "callout", text: "Pro tip: Use the slash command '/' anywhere to insert checklists, code blocks, or headings." },
            ],
          },
        },
      });

      return { user, workspace, project };
    });

    // Create session cookie
    const rawToken = await createSession(result.user.id, req.headers.get("user-agent") || undefined);
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
      path: "/",
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        role: result.user.role,
      },
      workspace: {
        id: result.workspace.id,
        name: result.workspace.name,
        slug: result.workspace.slug,
      },
    });
  } catch (err: any) {
    console.error("[Signup Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to create account" }, { status: 500 });
  }
}
