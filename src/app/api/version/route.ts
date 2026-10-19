import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

let cachedBuildId: string | null = null;

function getBuildVersion(): string {
  if (cachedBuildId) return cachedBuildId;

  // 1. Try environment variable
  if (process.env.APP_VERSION) {
    cachedBuildId = process.env.APP_VERSION;
    return cachedBuildId;
  }
  if (process.env.NEXT_PUBLIC_APP_VERSION) {
    cachedBuildId = process.env.NEXT_PUBLIC_APP_VERSION;
    return cachedBuildId;
  }

  // 2. Try Next.js build ID generated at build-time
  try {
    const buildIdPath = path.join(process.cwd(), ".next", "BUILD_ID");
    if (fs.existsSync(buildIdPath)) {
      cachedBuildId = fs.readFileSync(buildIdPath, "utf-8").trim();
      return cachedBuildId;
    }
  } catch (err) {
    // Ignore file read error in edge environments
  }

  // 3. Fallback timestamp or semver
  return "1.0.0-prod";
}

export async function GET() {
  const version = getBuildVersion();

  return NextResponse.json(
    {
      version,
      timestamp: Date.now(),
      status: "ACTIVE",
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}
