import { NextResponse } from "next/server";
import { getSessionUser, hashPin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code, newPin } = await req.json();

    if (!code || typeof code !== "string" || code.trim().length !== 6) {
      return NextResponse.json({ error: "Please enter a valid 6-digit recovery code." }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { pinRecoveryCode: true, pinRecoveryExpires: true },
    });

    if (!dbUser?.pinRecoveryCode || !dbUser.pinRecoveryExpires) {
      return NextResponse.json({ error: "No active recovery code found. Please request a new one." }, { status: 400 });
    }

    if (new Date() > dbUser.pinRecoveryExpires) {
      return NextResponse.json({ error: "Recovery code has expired. Please request a new code." }, { status: 400 });
    }

    if (dbUser.pinRecoveryCode.trim() !== code.trim()) {
      return NextResponse.json({ error: "Invalid recovery code. Please check your email." }, { status: 400 });
    }

    // Code verified: clear recovery code and optionally set new PIN
    const updateData: any = {
      pinRecoveryCode: null,
      pinRecoveryExpires: null,
    };

    if (newPin && /^\d{4}$/.test(String(newPin))) {
      updateData.noteLockPinHash = hashPin(String(newPin));
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData,
    });

    return NextResponse.json({
      ok: true,
      unlocked: true,
      message: "Note unlocked successfully.",
    });
  } catch (err: any) {
    console.error("[Verify Recovery Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to verify recovery code." }, { status: 500 });
  }
}
