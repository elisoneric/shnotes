import { NextResponse } from "next/server";
import { getSessionUser, verifyPin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { pin, pageId } = await req.json();

    if (!pin || !/^\d{4}$/.test(String(pin))) {
      return NextResponse.json({ ok: false, valid: false, error: "PIN must be 4 digits" }, { status: 400 });
    }

    // 1. Check if page has a custom lockPinHash
    if (pageId) {
      const page = await prisma.page.findUnique({
        where: { id: pageId },
        select: { lockPinHash: true },
      });
      if (page?.lockPinHash) {
        const isValid = verifyPin(String(pin), page.lockPinHash);
        if (isValid) {
          return NextResponse.json({ ok: true, verified: true, valid: true });
        }
        return NextResponse.json(
          { ok: false, verified: false, valid: false, error: "Incorrect PIN. Try again or recover via email." },
          { status: 400 }
        );
      }
    }

    // 2. Fall back to user's master note PIN
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { noteLockPinHash: true },
    });

    if (!dbUser?.noteLockPinHash) {
      return NextResponse.json(
        {
          ok: false,
          verified: false,
          valid: false,
          error: "No lock PIN configured for this account.",
        },
        { status: 400 }
      );
    }

    const isValid = verifyPin(String(pin), dbUser.noteLockPinHash);
    if (isValid) {
      return NextResponse.json({ ok: true, verified: true, valid: true });
    }

    return NextResponse.json(
      { ok: false, verified: false, valid: false, error: "Incorrect PIN. Try again or recover via email." },
      { status: 400 }
    );
  } catch (err: any) {
    console.error("[Verify PIN Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to verify PIN" }, { status: 500 });
  }
}
