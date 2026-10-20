import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { WorkspaceRole } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { name, slug: customSlug, logoUrl } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Workspace name is required" }, { status: 400 });
    }

    const cleanName = name.trim();
    const baseSlug = (customSlug || cleanName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const slug = `${baseSlug || "workspace"}-${Math.random().toString(36).substring(2, 6)}`;

    const newWorkspace = await prisma.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: {
          name: cleanName,
          slug,
          logoUrl: logoUrl || null,
          members: {
            create: {
              userId: user.id,
              role: WorkspaceRole.OWNER,
            },
          },
          projects: {
            create: {
              name: "General Tasks",
              key: "GEN",
              description: "Primary operational tasks and project boards",
              colorAccent: "#3b82f6",
              ownerName: user.name,
            },
          },
          pages: {
            create: {
              title: `${cleanName} Workspace Notes`,
              content: {
                blocks: [
                  { id: "b1", type: "heading", level: 1, text: `${cleanName} Documentation` },
                  { id: "b2", type: "paragraph", text: `Welcome to the ${cleanName} workspace. Use this canvas to draft operational specs, paste code, and link project tasks.` },
                ],
              },
            },
          },
        },
        include: {
          projects: true,
          members: true,
          pages: true,
        },
      });

      return ws;
    });

    return NextResponse.json({
      ok: true,
      workspace: {
        id: newWorkspace.id,
        name: newWorkspace.name,
        slug: newWorkspace.slug,
        logoUrl: newWorkspace.logoUrl,
        projects: newWorkspace.projects,
      },
    });
  } catch (err: any) {
    console.error("[Workspace Create Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to create workspace" }, { status: 500 });
  }
}
