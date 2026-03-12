import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { getOrgPrisma } from "@/lib/db";
import { changelogEventSchema } from "@/lib/validations";
import { cacheUpdate } from "@/lib/cache";
import type { CachedChangelogPost } from "@/app/api/changelog/posts/route";

export async function POST(req: NextRequest) {
  const org = await validateApiKey(req);

  if (!org) {
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const parsed = changelogEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 }
      );
    }

    const { type, postId, visitorId, datalayer } = parsed.data;
    const db = getOrgPrisma(org.id);

    // LIKE/DISLIKE require visitorId for deduplication
    if (type !== "VIEW") {
      if (!visitorId) {
        return NextResponse.json(
          { error: "visitorId is required for LIKE/DISLIKE events" },
          { status: 400 }
        );
      }
      if (!postId) {
        return NextResponse.json(
          { error: "postId is required for LIKE/DISLIKE events" },
          { status: 400 }
        );
      }

      // Check for existing event of the same type (toggle off)
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
        return NextResponse.json({ action: "removed", type: null });
      }

      // Remove opposite reaction if present (switch from LIKE→DISLIKE or vice versa)
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

      return NextResponse.json({ action: "created", type }, { status: 201 });
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

    return NextResponse.json({ action: "created", type }, { status: 201 });
  } catch (error) {
    console.error("Tracking error:", error);
    return NextResponse.json(
      { error: "Failed to track event" },
      { status: 500 }
    );
  }
}
