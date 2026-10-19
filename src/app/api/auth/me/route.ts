import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionUser, COOKIE_NAME } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ensureSeedData } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSeedData();

    let user = await getSessionUser();

    // If no active session cookie, fallback to default admin/HOO user so app is immediately usable out of the box
    if (!user) {
      user = await prisma.user.findFirst({
        include: {
          memberships: { include: { workspace: true } },
        },
      });
    }

    if (!user) {
      return NextResponse.json({ authenticated: false });
    }

    const workspace = await prisma.workspace.findFirst({
      include: { projects: true },
    });

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
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
    return NextResponse.json({ error: err.message || "Failed to get user" }, { status: 500 });
  }
}

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
  return NextResponse.json({ ok: true });
}
