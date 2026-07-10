import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireOrgApi } from "@/lib/auth-helpers";
import { getOrgPrisma } from "@/lib/db";
import { audienceSchema } from "@/lib/validations";
import {
  attributeMap,
  audienceUsageCounts,
  validateAudienceRules,
  invalidateTargetingCaches,
} from "@/lib/targeting-server";
import { logger } from "@/lib/logger";
import { ValidationError, ApiError } from "@/lib/errors";
import type { Attribute } from "@/types/targeting";

export async function GET() {
  try {
    const auth = await requireOrgApi();
    if (auth.error) return auth.error;
    const db = getOrgPrisma(auth.session.orgId);

    const [audiences, usage] = await Promise.all([
      db.audience.findMany({ orderBy: { name: "asc" } }),
      audienceUsageCounts(db),
    ]);

    return NextResponse.json(
      audiences.map((a) => ({ ...a, usageCount: usage.get(a.id) ?? 0 })),
    );
  } catch (error) {
    logger.error({ err: error }, "Failed to list audiences");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Failed to list audiences" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireOrgApi();
    if (auth.error) return auth.error;
    const { session } = auth;

    const parsed = audienceSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const { name, rules } = parsed.data;
    const db = getOrgPrisma(session.orgId);

    const attributes = (await db.attribute.findMany()) as Attribute[];
    validateAudienceRules(rules, attributeMap(attributes));

    try {
      const audience = await db.audience.create({
        data: { orgId: session.orgId, name, rules },
      });
      invalidateTargetingCaches(session.orgId);
      return NextResponse.json(audience, { status: 201 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ValidationError(`An audience named "${name}" already exists`);
      }
      throw e;
    }
  } catch (error) {
    logger.error({ err: error }, "Failed to create audience");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Failed to create audience" }, { status: 500 });
  }
}
