import { NextResponse, after } from "next/server";
import { Prisma } from "@prisma/client";
import { requireOrgApi } from "@/lib/auth-helpers";
import { getOrgPrisma } from "@/lib/db";
import { updateAnnouncementSchema } from "@/lib/validations";
import { cacheInvalidate } from "@/lib/cache";
import { refreshOrgNomenclature } from "@/lib/nomenclature";
import { htmlToText } from "@/lib/html-segments";
import { logger } from "@/lib/logger";
import { ValidationError, NotFoundError, ApiError } from "@/lib/errors";

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: Context) {
  try {
    const auth = await requireOrgApi();
    if (auth.error) return auth.error;
    const { session } = auth;

    const { id } = await context.params;
    const db = getOrgPrisma(session.orgId);

    const announcement = await db.announcement.findUnique({ where: { id } });

    if (!announcement) {
      throw new NotFoundError("Announcement not found");
    }

    // Fetch analytics
    const [viewCount, clickCount] = await Promise.all([
      db.announcementEvent.count({ where: { announcementId: id, type: "VIEW" } }),
      db.announcementEvent.count({ where: { announcementId: id, type: "CLICK" } }),
    ]);

    return NextResponse.json({ ...announcement, views: viewCount, clicks: clickCount });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch announcement");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Failed to fetch announcement" }, { status: 500 });
  }
}

export async function PUT(req: Request, context: Context) {
  try {
    const auth = await requireOrgApi();
    if (auth.error) return auth.error;
    const { session } = auth;

    const { id } = await context.params;
    const body = await req.json();
    const parsed = updateAnnouncementSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const db = getOrgPrisma(session.orgId);

    const existing = await db.announcement.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError("Announcement not found");
    }

    const { targetingRules, ...rest } = parsed.data;
    const updateData: Record<string, unknown> = { ...rest };
    if (targetingRules !== undefined) {
      updateData.targetingRules = targetingRules === null ? Prisma.DbNull : targetingRules;
    }

    const announcement = await db.announcement.update({
      where: { id },
      data: updateData,
    });

    cacheInvalidate(session.orgId, "announcements");

    // Background: learn the org's terminology from published announcements too. Never blocks/fails.
    if (announcement.status === "PUBLISHED") {
      after(() => refreshOrgNomenclature(session.orgId, htmlToText(announcement.content)));
    }

    return NextResponse.json(announcement);
  } catch (error) {
    logger.error({ err: error }, "Failed to update announcement");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Failed to update announcement" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: Context) {
  try {
    const auth = await requireOrgApi();
    if (auth.error) return auth.error;
    const { session } = auth;

    const { id } = await context.params;
    const db = getOrgPrisma(session.orgId);

    const existing = await db.announcement.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError("Announcement not found");
    }

    await db.announcement.delete({ where: { id } });

    cacheInvalidate(session.orgId, "announcements");
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to delete announcement");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Failed to delete announcement" }, { status: 500 });
  }
}
