import { NextResponse } from "next/server";
import { requireOrgApi } from "@/lib/auth-helpers";
import { getOrgPrisma } from "@/lib/db";
import { invalidateTargetingCaches } from "@/lib/targeting-server";
import { logger } from "@/lib/logger";
import { NotFoundError, ApiError } from "@/lib/errors";
import type { AudienceRuleSet } from "@/types/targeting";

type Context = { params: Promise<{ id: string }> };

/** Count audiences whose rules reference the given attribute key. */
async function countAudienceUsage(
  db: ReturnType<typeof getOrgPrisma>,
  key: string,
): Promise<number> {
  const audiences = await db.audience.findMany({ select: { rules: true } });
  return audiences.filter((a) => {
    const rules = a.rules as unknown as AudienceRuleSet | null;
    return rules?.rules?.some((r) => r.attributeKey === key) ?? false;
  }).length;
}

export async function GET(_req: Request, context: Context) {
  try {
    const auth = await requireOrgApi();
    if (auth.error) return auth.error;
    const { id } = await context.params;
    const db = getOrgPrisma(auth.session.orgId);

    const attribute = await db.attribute.findUnique({ where: { id } });
    if (!attribute) throw new NotFoundError("Attribute not found");
    return NextResponse.json(attribute);
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch attribute");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Failed to fetch attribute" }, { status: 500 });
  }
}

export async function DELETE(req: Request, context: Context) {
  try {
    const auth = await requireOrgApi();
    if (auth.error) return auth.error;
    const { session } = auth;
    const { id } = await context.params;
    const db = getOrgPrisma(session.orgId);

    const existing = await db.attribute.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError("Attribute not found");

    const force = new URL(req.url).searchParams.get("force") === "true";
    const usage = await countAudienceUsage(db, existing.key);
    if (usage > 0 && !force) {
      return NextResponse.json(
        {
          error: `This attribute is used by ${usage} audience${usage === 1 ? "" : "s"}.`,
          usage,
        },
        { status: 409 },
      );
    }

    await db.attribute.delete({ where: { id } });
    invalidateTargetingCaches(session.orgId);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to delete attribute");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Failed to delete attribute" }, { status: 500 });
  }
}
