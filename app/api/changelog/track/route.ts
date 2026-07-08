import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { getOrgPrisma } from "@/lib/db";
import { changelogEventSchema } from "@/lib/validations";
import { cacheUpdate } from "@/lib/cache";
import { corsHeaders, handlePreflight } from "@/lib/cors";
import { logger } from "@/lib/logger";
import { UnauthorizedError, ValidationError, ApiError } from "@/lib/errors";
import type { CachedChangelogPost } from "@/app/api/changelog/posts/route";

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req);
}

export async function POST(req: NextRequest) {
  let cors: HeadersInit = {};
  try {
    const org = await validateApiKey(req);
    if (!org) {
      throw new UnauthorizedError("Invalid or missing API key");
    }

    const origin = req.headers.get("origin");
    cors = corsHeaders(origin, org.settings?.allowedDomain ?? null);

    const body = await req.json();
    const parsed = changelogEventSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { type, postId, visitorId, datalayer } = parsed.data;
    const db = getOrgPrisma(org.id);

    // LIKE/DISLIKE require visitorId for deduplication
    if (type !== "VIEW") {
      if (!visitorId) {
        throw new ValidationError("visitorId is required for LIKE/DISLIKE events");
      }
      if (!postId) {
        throw new ValidationError("postId is required for LIKE/DISLIKE events");
      }

      // Same-type event again = toggle off
      const existing = await db.changelogEvent.findFirst({
        where: { postId, visitorId, type },
      });

      if (existing) {
        await db.changelogEvent.delete({ where: { id: existing.id } });
        // Decrement count in cache
        const countField = type === "LIKE" ? "likes" : "dislikes";
        cacheUpdate<CachedChangelogPost[]>(org.id, "changelog-posts", (posts) =>
          posts.map((p) => p.id === postId ? { ...p, [countField]: Math.max(0, p[countField] - 1) } : p)
        );
        return NextResponse.json({ action: "removed", type: null }, { headers: cors });
      }

      // Switching reaction (LIKE↔DISLIKE) removes the opposite one
      const oppositeType = type === "LIKE" ? "DISLIKE" : "LIKE";
      const opposite = await db.changelogEvent.findFirst({
        where: { postId, visitorId, type: oppositeType },
      });
      if (opposite) {
        await db.changelogEvent.delete({ where: { id: opposite.id } });
      }

      await db.changelogEvent.create({
        data: {
          orgId: org.id,
          type,
          postId,
          visitorId,
          plan: datalayer?.plan || null,
          role: datalayer?.role || null,
          region: datalayer?.region || null,
          platform: datalayer?.platform || null,
          version: datalayer?.version || null,
          company: datalayer?.company || null,
          locale: datalayer?.locale || null,
        },
      });

      // Update cache: increment new type, decrement opposite if it was removed
      const newField = type === "LIKE" ? "likes" : "dislikes";
      const oppositeField = type === "LIKE" ? "dislikes" : "likes";
      cacheUpdate<CachedChangelogPost[]>(org.id, "changelog-posts", (posts) =>
        posts.map((p) => {
          if (p.id !== postId) return p;
          const updated = { ...p, [newField]: p[newField] + 1 };
          if (opposite) {
            updated[oppositeField] = Math.max(0, p[oppositeField] - 1);
          }
          return updated;
        })
      );

      return NextResponse.json({ action: "created", type }, { status: 201, headers: cors });
    }

    // VIEW events: no dedup, visitorId optional
    await db.changelogEvent.create({
      data: {
        orgId: org.id,
        type,
        postId: postId || null,
        visitorId: visitorId || null,
        plan: datalayer?.plan || null,
        role: datalayer?.role || null,
        region: datalayer?.region || null,
        platform: datalayer?.platform || null,
        version: datalayer?.version || null,
        company: datalayer?.company || null,
        locale: datalayer?.locale || null,
      },
    });

    return NextResponse.json({ action: "created", type }, { status: 201, headers: cors });
  } catch (error) {
    logger.error({ err: error }, "Changelog tracking error");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode, headers: cors });
    }
    return NextResponse.json(
      { error: "Failed to track event" },
      { status: 500, headers: cors }
    );
  }
}
