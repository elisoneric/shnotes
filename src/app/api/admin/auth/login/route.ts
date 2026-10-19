import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyPassword, createSession, COOKIE_NAME, SESSION_TTL_DAYS } from "@/lib/auth";
import { ensureSeedData } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await ensureSeedData();

    const body = await req.json();
    const identifier = (body.email || body.username || "").toLowerCase().trim();
    const password = body.password || "";

    if (!identifier || !password) {
      return NextResponse.json({ error: "Username or email and password are required." }, { status: 400 });
    }

    const envAdminEmail = (process.env.ADMIN_EMAIL || "admin@esam.com.ng").toLowerCase().trim();
    const envAdminPass = process.env.ADMIN_PASSWORD || "ShNotesAdmin123!";

    // 1. Direct environment superadmin credentials check
    if (identifier === envAdminEmail && password === envAdminPass) {
      let adminUser = await prisma.user.findUnique({ where: { email: envAdminEmail } });
      if (adminUser) {
        if (!adminUser.isSystemAdmin) {
          adminUser = await prisma.user.update({
            where: { id: adminUser.id },
            data: { isSystemAdmin: true },
          });
        }
        const rawToken = await createSession(adminUser.id, req.headers.get("user-agent") || undefined);
        const cookieStore = await cookies();
        cookieStore.set(COOKIE_NAME, rawToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
        });

        return NextResponse.json({
          ok: true,
          user: {
            id: adminUser.id,
            email: adminUser.email,
            name: adminUser.name,
            role: adminUser.role,
            isSystemAdmin: true,
          },
        });
      }
    }

    // 2. Database user authentication
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier },
          { name: { equals: identifier, mode: "insensitive" } },
        ],
      },
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Invalid administrative credentials." }, { status: 401 });
    }

    if (!user.isSystemAdmin && user.role !== "OWNER") {
      return NextResponse.json(
        { error: "Access denied. This account does not have system administrator privileges." },
        { status: 403 }
      );
    }

    const rawToken = await createSession(user.id, req.headers.get("user-agent") || undefined);
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, rawToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
    });

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isSystemAdmin: user.isSystemAdmin,
      },
    });
  } catch (err: any) {
    console.error("[Admin Auth Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to authenticate administrator" }, { status: 500 });
  }
}
