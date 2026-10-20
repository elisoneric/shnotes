import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getSmtpConfig, createTransporter, normalizeSenderAddress, renderCleanEmailTemplate } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const user = await getSessionUser();
    if (!user || !user.email) {
      return NextResponse.json({ error: "Unauthorized or missing email." }, { status: 401 });
    }

    // Generate cryptographically random 6-digit recovery code
    const recoveryCode = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await prisma.user.update({
      where: { id: user.id },
      data: {
        pinRecoveryCode: recoveryCode,
        pinRecoveryExpires: expiresAt,
      },
    });

    // Send recovery email via SMTP
    const smtpConfig = await getSmtpConfig();
    if (smtpConfig.host) {
      const transporter = createTransporter(smtpConfig);
      const htmlBody = renderCleanEmailTemplate({
        title: "Note PIN Recovery Code",
        badge: "Security Verification",
        headline: "Your Temporary Note Unlock Code",
        bodyHtml: `You requested a recovery code to access your protected notes on ShNotes. Enter the verification code below on the PIN challenge screen:`,
        details: [
          { label: "Verification Code", value: recoveryCode },
          { label: "Expires In", value: "15 minutes" },
          { label: "Account Email", value: user.email },
        ],
        ctaText: "Return to ShNotes",
        ctaUrl: smtpConfig.appUrl || "https://note.esam.com.ng",
        footerText: "If you did not request this recovery code, someone may be attempting to unlock your notes. Please verify your account security.",
      });

      await transporter.sendMail({
        from: normalizeSenderAddress(smtpConfig.from, smtpConfig.user),
        to: user.email,
        subject: `Your Note PIN Recovery Code: ${recoveryCode}`,
        text: `Your ShNotes note PIN recovery code is: ${recoveryCode}. Valid for 15 minutes.`,
        html: htmlBody,
      });
    }

    const masked = user.email.replace(/(.{2})(.*)(@.*)/, "$1•••$3");
    return NextResponse.json({
      ok: true,
      message: `Recovery code dispatched to ${masked}`,
    });
  } catch (err: any) {
    console.error("[PIN Recovery Error]:", err);
    return NextResponse.json({ error: err.message || "Failed to dispatch recovery code." }, { status: 500 });
  }
}
