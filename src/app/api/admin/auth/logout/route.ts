import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
    return NextResponse.json({ ok: true, message: "Logged out successfully" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to logout" }, { status: 500 });
  }
}
