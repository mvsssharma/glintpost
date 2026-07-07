import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { getOrgPrisma } from "@/lib/db";
import { corsHeaders, handlePreflight } from "@/lib/cors";
import { logger } from "@/lib/logger";
import { UnauthorizedError, ApiError } from "@/lib/errors";

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req);
}

export async function POST(req: NextRequest) {
  let cors: HeadersInit = {};
  try {
    const org = await validateApiKey(req);
    if (!org) {
      throw new UnauthorizedError("Invalid or missing API key");
    }

    const origin = req.headers.get("origin");
    cors = corsHeaders(origin, org.settings?.allowedDomain ?? null);

    const body = await req.json();
    const visitorId = typeof body.visitorId === "string" ? body.visitorId.slice(0, 200) : null;

    const db = getOrgPrisma(org.id);

    await db.roadmapView.create({
      data: {
        orgId: org.id,
        visitorId: visitorId || null,
      },
    });

    return NextResponse.json({ success: true }, { status: 201, headers: cors });
  } catch (error) {
    logger.error({ err: error }, "Roadmap view tracking error");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode, headers: cors });
    }
    return NextResponse.json(
      { error: "Failed to track view" },
      { status: 500, headers: cors }
    );
  }
}
