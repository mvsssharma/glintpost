import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { getOrgPrisma } from "@/lib/db";
import { updateAnnouncementSchema } from "@/lib/validations";
import { cacheInvalidate } from "@/lib/cache";

type Context = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: Context) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const db = getOrgPrisma(session.orgId);

    const announcement = await db.announcement.findUnique({ where: { id } });

    if (!announcement) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    // Fetch analytics
    const [viewCount, clickCount] = await Promise.all([
      db.announcementEvent.count({ where: { announcementId: id, type: "VIEW" } }),
      db.announcementEvent.count({ where: { announcementId: id, type: "CLICK" } }),
    ]);

    return NextResponse.json({ ...announcement, views: viewCount, clicks: clickCount });
  } catch (error) {
    console.error("Failed to fetch announcement:", error);
    return NextResponse.json({ error: "Failed to fetch announcement" }, { status: 500 });
  }
}

export async function PUT(req: Request, context: Context) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const parsed = updateAnnouncementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const db = getOrgPrisma(session.orgId);

    const existing = await db.announcement.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
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
    return NextResponse.json(announcement);
  } catch (error) {
    console.error("Failed to update announcement:", error);
    return NextResponse.json({ error: "Failed to update announcement" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: Context) {
  try {
    const session = await auth();
    if (!session?.user?.id || !session.orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const db = getOrgPrisma(session.orgId);

    const existing = await db.announcement.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    await db.announcement.delete({ where: { id } });

    cacheInvalidate(session.orgId, "announcements");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete announcement:", error);
    return NextResponse.json({ error: "Failed to delete announcement" }, { status: 500 });
  }
}
