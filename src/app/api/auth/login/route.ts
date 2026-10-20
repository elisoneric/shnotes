import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyPassword, createSession, COOKIE_NAME, getSessionCookieOptions } from "@/lib/auth";
import { ensureSeedData } from "@/lib/seed";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    await ensureSeedData();

    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const rawToken = await createSession(user.id, req.headers.get("user-agent") || undefined);

    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, rawToken, getSessionCookieOptions());

    return NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      sessionToken: rawToken,
    });
  } catch (err: any) {
    console.error("[Login Error]:", err);
    const msg = err?.message?.includes("Can't reach database server")
      ? "Database server is currently unreachable. Please verify database connectivity."
      : err?.message || "Login failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
