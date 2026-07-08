import { NextResponse, after } from "next/server";
import { Prisma } from "@prisma/client";
import { requireOrgApi } from "@/lib/auth-helpers";
import { getOrgPrisma } from "@/lib/db";
import { createAnnouncementSchema } from "@/lib/validations";
import { cacheInvalidate } from "@/lib/cache";
import { refreshOrgNomenclature } from "@/lib/nomenclature";
import { htmlToText } from "@/lib/html-segments";
import { logger } from "@/lib/logger";
import { ValidationError, ApiError } from "@/lib/errors";

export async function POST(req: Request) {
  try {
    const auth = await requireOrgApi();
    if (auth.error) return auth.error;
    const { session } = auth;

    const body = await req.json();
    const parsed = createAnnouncementSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { targetingRules, ...rest } = parsed.data;
    const db = getOrgPrisma(session.orgId);

    const announcement = await db.announcement.create({
      data: {
        orgId: session.orgId,
        ...rest,
        targetingRules: targetingRules ?? Prisma.DbNull,
      },
    });

    cacheInvalidate(session.orgId, "announcements");

    // Background: learn the org's terminology from published announcements too. Never blocks/fails.
    if (announcement.status === "PUBLISHED") {
      after(() => refreshOrgNomenclature(session.orgId, htmlToText(announcement.content)));
    }

    return NextResponse.json(announcement, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, "Failed to create announcement");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: "Failed to create announcement" },
      { status: 500 }
    );
  }
}
