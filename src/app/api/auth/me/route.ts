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

    // Get user's active workspace
    const member = await prisma.workspaceMember.findFirst({
      where: { userId: user.id },
      include: {
        workspace: {
          include: {
            projects: { where: { deletedAt: null } },
          },
        },
      },
    });

    const workspace = member?.workspace || null;

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: member?.role || user.role,
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
