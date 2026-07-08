import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * Liveness/readiness probe for uptime monitoring. Public (no auth), returns no
 * org data — just confirms the app can serve requests and reach the database.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    logger.error({ err: error }, "Health check failed");
    return NextResponse.json({ status: "unhealthy" }, { status: 503 });
  }
}
