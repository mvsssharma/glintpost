import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireOrgApi } from "@/lib/auth-helpers";
import { getOrgPrisma } from "@/lib/db";
import { createPostSchema } from "@/lib/validations";
import { cacheInvalidate } from "@/lib/cache";
import { refreshOrgNomenclature } from "@/lib/nomenclature";
import { htmlToText } from "@/lib/html-segments";

export async function POST(req: Request) {
  try {
    const auth = await requireOrgApi();
    if (auth.error) return auth.error;
    const { session } = auth;

    const body = await req.json();
    const parsed = createPostSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
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
      void refreshOrgNomenclature(session.orgId, htmlToText(content));
    }

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error("Failed to create post:", error);
    return NextResponse.json(
      { error: "Failed to create post" },
      { status: 500 }
    );
  }
}
