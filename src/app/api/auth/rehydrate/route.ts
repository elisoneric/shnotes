import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { validateSessionToken, getSessionCookieOptions, COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureSeedData } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await ensureSeedData();

    const body = await req.json().catch(() => ({}));
    const { sessionToken } = body;

    if (!sessionToken || typeof sessionToken !== "string") {
      return NextResponse.json({ authenticated: false, error: "Missing session token" }, { status: 400 });
    }

    const user = await validateSessionToken(sessionToken);
    if (!user) {
      return NextResponse.json({ authenticated: false, error: "Invalid or expired session" }, { status: 401 });
    }

    // Re-set the persistent 30-day session cookie
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, sessionToken, getSessionCookieOptions());

    // Resolve user's workspace
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

    const workspace = member?.workspace || null;
    const activeRole = member?.role || user.role;

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
    console.error("[Auth Rehydrate Error]:", err);
    return NextResponse.json({ authenticated: false, error: err.message || "Failed to rehydrate session" }, { status: 500 });
  }
}
