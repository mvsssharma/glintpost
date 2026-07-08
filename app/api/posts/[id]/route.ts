import { NextResponse, after } from "next/server";
import { Prisma } from "@prisma/client";
import { requireOrgApi } from "@/lib/auth-helpers";
import { getOrgPrisma } from "@/lib/db";
import { updatePostSchema } from "@/lib/validations";
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

    const post = await db.post.findUnique({
      where: { id },
      include: { translations: true },
    });

    if (!post) {
      throw new NotFoundError("Post not found");
    }

    return NextResponse.json(post);
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch post");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Failed to fetch post" }, { status: 500 });
  }
}

export async function PUT(req: Request, context: Context) {
  try {
    const auth = await requireOrgApi();
    if (auth.error) return auth.error;
    const { session } = auth;

    const { id } = await context.params;
    const body = await req.json();
    const parsed = updatePostSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { title, content, status, targetingRules } = parsed.data;
    const db = getOrgPrisma(session.orgId);

    const existing = await db.post.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError("Post not found");
    }

    const postUpdate: Record<string, unknown> = {};
    if (status) {
      postUpdate.status = status;
      if (status === "PUBLISHED" && !existing.publishedAt) {
        postUpdate.publishedAt = new Date();
      }
    }
    if (targetingRules !== undefined) {
      postUpdate.targetingRules = targetingRules === null ? Prisma.DbNull : targetingRules;
    }

    const post = await db.$transaction(async (tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]) => {
      if (title !== undefined || content !== undefined) {
        await tx.postTranslation.upsert({
          where: { postId_locale: { postId: id, locale: "en" } },
          update: {
            ...(title !== undefined && { title }),
            ...(content !== undefined && { content }),
          },
          create: {
            orgId: session.orgId,
            postId: id,
            locale: "en",
            title: title ?? "",
            content: content ?? "",
          },
        });
      }

      return tx.post.update({
        where: { id },
        data: postUpdate,
        include: { translations: true },
      });
    });

    cacheInvalidate(session.orgId, "changelog-posts");

    // Background: refresh learned terminology when a post is published. Never blocks/fails the save.
    if (post.status === "PUBLISHED") {
      const enText = post.translations.find((t) => t.locale === "en")?.content ?? "";
      if (enText) after(() => refreshOrgNomenclature(session.orgId, htmlToText(enText)));
    }

    return NextResponse.json(post);
  } catch (error) {
    logger.error({ err: error }, "Failed to update post");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Failed to update post" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: Context) {
  try {
    const auth = await requireOrgApi();
    if (auth.error) return auth.error;
    const { session } = auth;

    const { id } = await context.params;
    const db = getOrgPrisma(session.orgId);

    const existing = await db.post.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError("Post not found");
    }

    await db.post.delete({ where: { id } });

    cacheInvalidate(session.orgId, "changelog-posts");
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Failed to delete post");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    return NextResponse.json({ error: "Failed to delete post" }, { status: 500 });
  }
}
