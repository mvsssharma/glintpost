import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { getOrgPrisma } from "@/lib/db";
import { cacheGet, cacheSet } from "@/lib/cache";
import { corsHeaders, handlePreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

export interface CachedChangelogPost {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  likes: number;
  dislikes: number;
  targetingRules: unknown;
}

async function fetchAndCachePosts(orgId: string): Promise<CachedChangelogPost[]> {
  const db = getOrgPrisma(orgId);

  const posts = (await db.post.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    take: 20,
    include: {
      translations: { where: { locale: "en" }, take: 1 },
      _count: {
        select: {
          changelogEvents: { where: { type: "LIKE" } },
        },
      },
    },
  })) as Array<{
    id: string;
    publishedAt: Date | null;
    createdAt: Date;
    targetingRules: unknown;
    translations: Array<{ title: string; content: string }>;
    _count: { changelogEvents: number };
  }>;

  const postIds = posts.map((p) => p.id);
  const dislikeCounts = await db.changelogEvent.groupBy({
    by: ["postId"],
    where: { postId: { in: postIds }, type: "DISLIKE" },
    _count: true,
  });
  const dislikeMap = Object.fromEntries(
    dislikeCounts.map((d: { postId: string | null; _count: number }) => [d.postId, d._count])
  );

  const result: CachedChangelogPost[] = posts.map((post) => ({
    id: post.id,
    title: post.translations[0]?.title ?? "Untitled",
    content: post.translations[0]?.content ?? "",
    createdAt: (post.publishedAt ?? post.createdAt).toISOString(),
    likes: post._count.changelogEvents,
    dislikes: (dislikeMap[post.id] as number) ?? 0,
    targetingRules: post.targetingRules ?? null,
  }));

  cacheSet(orgId, "changelog-posts", result);
  return result;
}

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req);
}

export async function GET(req: NextRequest) {
  const org = await validateApiKey(req);

  if (!org) {
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    );
  }

  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin, org.settings?.allowedDomain ?? null);

  try {
    const cached = cacheGet<CachedChangelogPost[]>(org.id, "changelog-posts");
    if (cached) {
      return NextResponse.json(cached, { headers: cors });
    }

    const result = await fetchAndCachePosts(org.id);
    return NextResponse.json(result, { headers: cors });
  } catch (error) {
    console.error("Failed to fetch widget posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch posts" },
      { status: 500, headers: cors }
    );
  }
}
