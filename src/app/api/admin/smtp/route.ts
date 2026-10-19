import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getSmtpConfig, saveSmtpConfig, testSmtpConnection } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user || (!user.isSystemAdmin && user.role !== "OWNER")) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const config = await getSmtpConfig();

    return NextResponse.json({
      ok: true,
      config: {
        host: config.host,
        port: config.port,
        secure: config.secure,
        user: config.user,
        hasPassword: Boolean(config.pass),
        from: config.from,
        appUrl: config.appUrl,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to load SMTP settings" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getSessionUser();
    if (!user || (!user.isSystemAdmin && user.role !== "OWNER")) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    const body = await req.json();
    const { host, port, secure, user: smtpUser, pass, from, appUrl } = body;

    await saveSmtpConfig({
      host,
      port: Number(port) || 587,
      secure: Boolean(secure),
      user: smtpUser,
      pass,
      from,
      appUrl,
    });

    return NextResponse.json({ ok: true, message: "SMTP configuration saved successfully" });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to save SMTP configuration" }, { status: 500 });
  }
}
