import { NextResponse } from "next/server";
import { getSessionUser, hashPin, verifyPin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { noteLockPinHash: true },
    });

    return NextResponse.json({
      ok: true,
      hasPin: Boolean(dbUser?.noteLockPinHash),
    });
  } catch (err: any) {
    console.error("[User PIN API Error]:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pin, currentPin } = await req.json();

    if (!pin || !/^\d{4}$/.test(String(pin))) {
      return NextResponse.json({ error: "PIN must be exactly 4 numeric digits." }, { status: 400 });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { noteLockPinHash: true },
    });

    if (dbUser?.noteLockPinHash && currentPin) {
      const isValid = verifyPin(String(currentPin), dbUser.noteLockPinHash);
      if (!isValid) {
        return NextResponse.json({ error: "Current PIN is incorrect." }, { status: 400 });
      }
    }

    const newHash = hashPin(String(pin));
    await prisma.user.update({
      where: { id: user.id },
      data: { noteLockPinHash: newHash },
    });

    return NextResponse.json({ ok: true, message: "4-digit PIN updated successfully." });
  } catch (err: any) {
    console.error("[User PIN POST Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to set PIN." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pin } = await req.json();

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { noteLockPinHash: true },
    });

    if (dbUser?.noteLockPinHash) {
      if (!pin || !verifyPin(String(pin), dbUser.noteLockPinHash)) {
        return NextResponse.json({ error: "PIN is required to remove lock security." }, { status: 400 });
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { noteLockPinHash: null },
    });

    return NextResponse.json({ ok: true, message: "PIN security removed." });
  } catch (err: any) {
    console.error("[User PIN DELETE Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to remove PIN." }, { status: 500 });
  }
}
