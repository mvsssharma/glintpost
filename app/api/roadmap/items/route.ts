import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { getOrgPrisma } from "@/lib/db";
import { cacheGet, cacheSet } from "@/lib/cache";

export const dynamic = "force-dynamic";

export interface CachedRoadmapItem {
  id: string;
  title: string;
  description: string | null;
  status: string;
  upvotes: number;
  downvotes: number;
  createdAt: string;
}

async function fetchAndCacheItems(orgId: string): Promise<CachedRoadmapItem[]> {
  const db = getOrgPrisma(orgId);

  const items = await db.roadmapItem.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });

  const itemIds = items.map((i) => i.id);

  const [upvoteCounts, downvoteCounts] = await Promise.all([
    db.roadmapVote.groupBy({
      by: ["itemId"],
      where: { itemId: { in: itemIds }, voteType: "UP" },
      _count: true,
    }),
    db.roadmapVote.groupBy({
      by: ["itemId"],
      where: { itemId: { in: itemIds }, voteType: "DOWN" },
      _count: true,
    }),
  ]);

  const upMap = Object.fromEntries(
    upvoteCounts.map((u: { itemId: string; _count: number }) => [u.itemId, u._count]),
  );
  const downMap = Object.fromEntries(
    downvoteCounts.map((d: { itemId: string; _count: number }) => [d.itemId, d._count]),
  );

  const result: CachedRoadmapItem[] = items.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    status: item.status,
    upvotes: (upMap[item.id] as number) ?? 0,
    downvotes: (downMap[item.id] as number) ?? 0,
    createdAt: item.createdAt.toISOString(),
  }));

  cacheSet(orgId, "roadmap-items", result);
  return result;
}

export async function GET(req: NextRequest) {
  const org = await validateApiKey(req);
  if (!org) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  const visitorId = req.nextUrl.searchParams.get("visitorId");

  try {
    // Get items from cache or DB
    let items = cacheGet<CachedRoadmapItem[]>(org.id, "roadmap-items");
    if (!items) {
      items = await fetchAndCacheItems(org.id);
    }

    // myVote is visitor-specific — always queried from DB (fast indexed lookup)
    let visitorVotes: Record<string, string> = {};
    if (visitorId && items.length > 0) {
      const db = getOrgPrisma(org.id);
      const itemIds = items.map((i) => i.id);
      const votes = await db.roadmapVote.findMany({
        where: { visitorId, itemId: { in: itemIds } },
        select: { itemId: true, voteType: true },
      });
      visitorVotes = Object.fromEntries(
        votes.map((v) => [v.itemId, v.voteType]),
      );
    }

    // Merge cached items with visitor-specific votes
    const result = items.map((item) => ({
      ...item,
      myVote: visitorVotes[item.id] ?? null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch roadmap items:", error);
    return NextResponse.json({ error: "Failed to fetch roadmap items" }, { status: 500 });
  }
}
