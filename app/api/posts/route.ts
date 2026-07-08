import { NextResponse, after } from "next/server";
import { Prisma } from "@prisma/client";
import { requireOrgApi } from "@/lib/auth-helpers";
import { getOrgPrisma } from "@/lib/db";
import { createPostSchema } from "@/lib/validations";
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
    const parsed = createPostSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { title, content, status, targetingRules } = parsed.data;
    const db = getOrgPrisma(session.orgId);

    const post = await db.post.create({
      data: {
        orgId: session.orgId,
        status: status ?? "DRAFT",
        publishedAt: status === "PUBLISHED" ? new Date() : null,
        targetingRules: targetingRules ?? Prisma.DbNull,
        translations: {
          create: {
            orgId: session.orgId,
            locale: "en",
            title,
            content,
          },
        },
      },
      include: { translations: true },
    });

    cacheInvalidate(session.orgId, "changelog-posts");

    // Background: learn the org's terminology from its own content — only from PUBLISHED
    // posts (draft wording shouldn't pollute the glossary or burn LLM calls before it's
    // final). Mirrors the update path. Never blocks/fails the save.
    if (status === "PUBLISHED") {
      after(() => refreshOrgNomenclature(session.orgId, htmlToText(content)));
    }

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    logger.error({ err: error }, "Failed to create post");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}
