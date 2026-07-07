import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { getOrgPrisma } from "@/lib/db";
import { announcementEventSchema } from "@/lib/validations";
import { corsHeaders, handlePreflight } from "@/lib/cors";
import { logger } from "@/lib/logger";
import { UnauthorizedError, ValidationError, NotFoundError, ApiError } from "@/lib/errors";

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
    const parsed = announcementEventSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { type, announcementId, visitorId, datalayer } = parsed.data;
    const db = getOrgPrisma(org.id);

    const announcement = await db.announcement.findUnique({ where: { id: announcementId } });
    if (!announcement) {
      throw new NotFoundError("Announcement not found");
    }

    const eventData = {
      orgId: org.id,
      announcementId,
      type,
      visitorId: visitorId || null,
      plan: datalayer?.plan || null,
      role: datalayer?.role || null,
      region: datalayer?.region || null,
      platform: datalayer?.platform || null,
      version: datalayer?.version || null,
      company: datalayer?.company || null,
      locale: datalayer?.locale || null,
    };

    if (visitorId) {
      await db.announcementEvent.upsert({
        where: {
          announcementId_visitorId_type: {
            announcementId,
            visitorId,
            type,
          },
        },
        update: {},
        create: eventData,
      });
    } else {
      await db.announcementEvent.create({ data: eventData });
    }

    return NextResponse.json({ action: "created", type }, { status: 201, headers: cors });
  } catch (error) {
    logger.error({ err: error }, "Announcement tracking error");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode, headers: cors });
    }
    return NextResponse.json(
      { error: "Failed to track event" },
      { status: 500, headers: cors }
    );
  }
}
