import { NextResponse } from "next/server";
import { requireOrgApi } from "@/lib/auth-helpers";
import { getOrgPrisma } from "@/lib/db";
import { createPostSchema } from "@/lib/validations";
import { cacheInvalidate } from "@/lib/cache";
import { resolveAudienceRefs } from "@/lib/targeting-server";
import { scheduleNomenclatureRefresh } from "@/lib/nomenclature";
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

    const { title, content, status, audienceIds, audienceMatch } = parsed.data;
    const db = getOrgPrisma(session.orgId);

    const validAudienceIds = await resolveAudienceRefs(db, audienceIds);

    const post = await db.post.create({
      data: {
        orgId: session.orgId,
        status: status ?? "DRAFT",
        publishedAt: status === "PUBLISHED" ? new Date() : null,
        audienceIds: validAudienceIds,
        audienceMatch: audienceMatch ?? "OR",
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

    // Learn org terminology in the background — published posts only, so draft wording
    // never pollutes the glossary or burns LLM calls.
    if (status === "PUBLISHED") {
      scheduleNomenclatureRefresh(session.orgId, content);
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
