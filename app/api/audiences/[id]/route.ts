import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireOrgApi } from "@/lib/auth-helpers";
import { getOrgPrisma } from "@/lib/db";
import { audienceSchema } from "@/lib/validations";
import {
  attributeMap,
  validateAudienceRules,
  invalidateTargetingCaches,
} from "@/lib/targeting-server";
import { logger } from "@/lib/logger";
import { ValidationError, NotFoundError, ApiError } from "@/lib/errors";
import type { Attribute } from "@/types/targeting";

type Context = { params: Promise<{ id: string }> };

async function countItemUsage(
  db: ReturnType<typeof getOrgPrisma>,
  id: string,
): Promise<number> {
  const [posts, announcements] = await Promise.all([
    db.post.count({ where: { audienceIds: { has: id } } }),
    db.announcement.count({ where: { audienceIds: { has: id } } }),
  ]);
  return posts + announcements;
}

export async function GET(_req: Request, context: Context) {
  try {
    const auth = await requireOrgApi();
    if (auth.error) return auth.error;
    const { id } = await context.params;
    const db = getOrgPrisma(auth.session.orgId);

    const audience = await db.audience.findUnique({ where: { id } });
    if (!audience) throw new NotFoundError("Audience not found");
    return NextResponse.json(audience);
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch audience");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Failed to fetch audience" }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: Context) {
  try {
    const auth = await requireOrgApi();
    if (auth.error) return auth.error;
    const { session } = auth;
    const { id } = await context.params;
    const db = getOrgPrisma(session.orgId);

    const parsed = audienceSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const { name, rules } = parsed.data;

    const existing = await db.audience.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Audience not found");

    const attributes = (await db.attribute.findMany()) as Attribute[];
    validateAudienceRules(rules, attributeMap(attributes));

    try {
      const audience = await db.audience.update({
        where: { id },
        data: { name, rules },
      });
      invalidateTargetingCaches(session.orgId);
      return NextResponse.json(audience);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ValidationError(`An audience named "${name}" already exists`);
      }
      throw e;
    }
  } catch (error) {
    logger.error({ err: error }, "Failed to update audience");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Failed to update audience" }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: Context) {
  try {
    const auth = await requireOrgApi();
    if (auth.error) return auth.error;
    const { session } = auth;
    const { id } = await context.params;
    const db = getOrgPrisma(session.orgId);

    const existing = await db.audience.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Audience not found");

    const force = new URL(req.url).searchParams.get("force") === "true";
    const usage = await countItemUsage(db, id);
    if (usage > 0 && !force) {
      return NextResponse.json(
        {
          error: `This audience is used by ${usage} post${usage === 1 ? "" : "s"}/announcement${usage === 1 ? "" : "s"}.`,
          usage,
        },
        { status: 409 },
      );
    }

    // Detach from any referencing items, then delete.
    await db.$transaction(async (tx) => {
      const [posts, announcements] = await Promise.all([
        tx.post.findMany({ where: { audienceIds: { has: id } }, select: { id: true, audienceIds: true } }),
        tx.announcement.findMany({ where: { audienceIds: { has: id } }, select: { id: true, audienceIds: true } }),
      ]);
      await Promise.all([
        ...posts.map((p) =>
          tx.post.update({
            where: { id: p.id },
            data: { audienceIds: p.audienceIds.filter((a) => a !== id) },
          }),
        ),
        ...announcements.map((a) =>
          tx.announcement.update({
            where: { id: a.id },
            data: { audienceIds: a.audienceIds.filter((x) => x !== id) },
          }),
        ),
      ]);
      await tx.audience.delete({ where: { id } });
    });

    invalidateTargetingCaches(session.orgId);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to delete audience");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Failed to delete audience" }, { status: 500 });
  }
}
