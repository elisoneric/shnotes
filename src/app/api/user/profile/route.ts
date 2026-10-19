import { NextResponse } from "next/server";
import { getSessionUser, hashPassword, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { name, currentPassword, newPassword } = await req.json();

    const dataToUpdate: { name?: string; passwordHash?: string } = {};

    if (name && typeof name === "string" && name.trim()) {
      dataToUpdate.name = name.trim();
    }

    if (newPassword) {
      if (!currentPassword) {
        return NextResponse.json(
          { error: "Current password is required to set a new password." },
          { status: 400 }
        );
      }

      const isValid = verifyPassword(currentPassword, user.passwordHash);
      if (!isValid) {
        return NextResponse.json({ error: "Current password is incorrect." }, { status: 400 });
      }

      if (newPassword.length < 8) {
        return NextResponse.json(
          { error: "New password must be at least 8 characters." },
          { status: 400 }
        );
      }

      dataToUpdate.passwordHash = hashPassword(newPassword);
    }

    if (Object.keys(dataToUpdate).length === 0) {
      return NextResponse.json({ ok: true, message: "No changes requested." });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: dataToUpdate,
      select: { id: true, name: true, email: true, role: true },
    });

    return NextResponse.json({
      ok: true,
      user: updatedUser,
    });
  } catch (err: any) {
    console.error("[Profile Update Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to update profile" }, { status: 500 });
  }
}
