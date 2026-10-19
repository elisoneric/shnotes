import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { testSmtpConnection } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || (!user.isSystemAdmin && user.role !== "OWNER")) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await req.json();
    const { recipientEmail, config } = body;

    const result = await testSmtpConnection(recipientEmail, config);

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, message: err.message || "Failed to execute SMTP test", latencyMs: 0 },
      { status: 500 }
    );
  }
}
