import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { getOrgPrisma } from "@/lib/db";
import { cacheGet, cacheSet } from "@/lib/cache";
import { corsHeaders, handlePreflight } from "@/lib/cors";
import { roadmapVoteTotals } from "@/lib/roadmap-votes";
import { logger } from "@/lib/logger";
import { UnauthorizedError, ApiError } from "@/lib/errors";

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

  const result: CachedRoadmapItem[] = items.map((item) => {
    const totals = roadmapVoteTotals(
      item.importedUpvotes,
      item.importedDownvotes,
      (upMap[item.id] as number) ?? 0,
      (downMap[item.id] as number) ?? 0,
    );
    return {
      id: item.id,
      title: item.title,
      description: item.description,
      status: item.status,
      upvotes: totals.upvotes,
      downvotes: totals.downvotes,
      createdAt: item.createdAt.toISOString(),
    };
  });

  cacheSet(orgId, "roadmap-items", result);
  return result;
}

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req);
}

export async function GET(req: NextRequest) {
  let cors: HeadersInit = {};
  try {
    const org = await validateApiKey(req);
    if (!org) {
      throw new UnauthorizedError("Invalid or missing API key");
    }

    const origin = req.headers.get("origin");
    cors = corsHeaders(origin, org.settings?.allowedDomain ?? null);
    const visitorId = req.nextUrl.searchParams.get("visitorId");
    let items = cacheGet<CachedRoadmapItem[]>(org.id, "roadmap-items");
    if (!items) {
      items = await fetchAndCacheItems(org.id);
    }
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

    const result = items.map((item) => ({
      ...item,
      myVote: visitorVotes[item.id] ?? null,
    }));

    return NextResponse.json(result, { headers: cors });
  } catch (error: any) {
    logger.error({ err: error }, "Failed to fetch roadmap items");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode, headers: cors });
    }
    return NextResponse.json({ error: "Failed to fetch roadmap items" }, { status: 500, headers: cors });
  }
}
