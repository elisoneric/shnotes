import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params;
    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const page = await prisma.page.findUnique({
      where: { secretToken: token },
      select: {
        id: true,
        title: true,
        content: true,
        isDiary: true,
        diaryDate: true,
        updatedAt: true,
        workspace: { select: { name: true } },
      },
    });

    if (!page) {
      return NextResponse.json({ error: "Document not found or link expired" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, page });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch shared document" }, { status: 500 });
  }
}
