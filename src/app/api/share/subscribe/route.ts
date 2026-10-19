import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const { pageId, secretToken, email } = await req.json();

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();

    let targetPageId = pageId;
    if (!targetPageId && secretToken) {
      const page = await prisma.page.findUnique({
        where: { secretToken },
        select: { id: true },
      });
      targetPageId = page?.id;
    }

    if (!targetPageId) {
      return NextResponse.json({ error: "Target document not found." }, { status: 404 });
    }

    await prisma.pageSubscriber.upsert({
      where: {
        pageId_email: {
          pageId: targetPageId,
          email: cleanEmail,
        },
      },
      create: {
        pageId: targetPageId,
        email: cleanEmail,
      },
      update: {},
    });

    return NextResponse.json({ ok: true, message: "Subscribed to document updates successfully." });
  } catch (err: any) {
    console.error("[Subscribe Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to subscribe" }, { status: 500 });
  }
}
