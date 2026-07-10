import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireOrgApi } from "@/lib/auth-helpers";
import { getOrgPrisma } from "@/lib/db";
import { attributeSchema } from "@/lib/validations";
import { invalidateTargetingCaches } from "@/lib/targeting-server";
import { logger } from "@/lib/logger";
import { ValidationError, ApiError } from "@/lib/errors";

export async function GET() {
  try {
    const auth = await requireOrgApi();
    if (auth.error) return auth.error;
    const db = getOrgPrisma(auth.session.orgId);

    const attributes = await db.attribute.findMany({ orderBy: { label: "asc" } });
    return NextResponse.json(attributes);
  } catch (error) {
    logger.error({ err: error }, "Failed to list attributes");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Failed to list attributes" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireOrgApi();
    if (auth.error) return auth.error;
    const { session } = auth;

    const parsed = attributeSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { key, label, type, values } = parsed.data;
    const db = getOrgPrisma(session.orgId);

    try {
      const attribute = await db.attribute.create({
        data: {
          orgId: session.orgId,
          key,
          label,
          type,
          values: type === "enum" ? values : [],
        },
      });
      invalidateTargetingCaches(session.orgId);
      return NextResponse.json(attribute, { status: 201 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ValidationError(`An attribute with the key "${key}" already exists`);
      }
      throw e;
    }
  } catch (error) {
    logger.error({ err: error }, "Failed to create attribute");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Failed to create attribute" }, { status: 500 });
  }
}
