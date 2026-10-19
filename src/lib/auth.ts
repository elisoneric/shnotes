import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { WorkspaceRole } from "@prisma/client";

const COOKIE_NAME = "shnotes_session";
const SESSION_TTL_DAYS = 30;

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, combinedHash: string): boolean {
  try {
    const [salt, originalHash] = combinedHash.split(":");
    if (!salt || !originalHash) return false;
    const computedHash = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(originalHash, "hex"), Buffer.from(computedHash, "hex"));
  } catch {
    return false;
  }
}

export async function createSession(userId: string, userAgent?: string): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.authSession.create({
    data: {
      userId,
      tokenHash,
      userAgent: userAgent?.slice(0, 255) ?? null,
      expiresAt,
    },
  });

  return rawToken;
}

export async function getSessionUser() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const session = await prisma.authSession.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            memberships: {
              include: { workspace: true },
            },
          },
        },
      },
    });

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    return session.user;
  } catch {
    return null;
  }
}

export async function invalidateSession(): Promise<void> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (token) {
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      await prisma.authSession.deleteMany({ where: { tokenHash } });
    }
    cookieStore.delete(COOKIE_NAME);
  } catch (err) {
    console.error("Failed to invalidate session:", err);
  }
}

export { COOKIE_NAME, SESSION_TTL_DAYS };
