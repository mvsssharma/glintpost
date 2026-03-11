import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { getOrgPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const org = await validateApiKey(req);
  if (!org) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  const status = req.nextUrl.searchParams.get("status");
  const visitorId = req.nextUrl.searchParams.get("visitorId");
  const db = getOrgPrisma(org.id);

  try {
    const where: Record<string, unknown> = {};
    if (status && status !== "ALL") {
      where.status = status;
    } else {
      where.status = { not: "ARCHIVED" };
    }

    const items = await db.roadmapItem.findMany({
      where,
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

    let visitorVotes: Record<string, string> = {};
    if (visitorId && itemIds.length > 0) {
      const votes = await db.roadmapVote.findMany({
        where: { visitorId, itemId: { in: itemIds } },
        select: { itemId: true, voteType: true },
      });
      visitorVotes = Object.fromEntries(
        votes.map((v) => [v.itemId, v.voteType]),
      );
    }

    const result = items.map((item) => ({
      id: item.id,
      title: item.title,
      description: item.description,
      status: item.status,
      upvotes: (upMap[item.id] as number) ?? 0,
      downvotes: (downMap[item.id] as number) ?? 0,
      myVote: visitorVotes[item.id] ?? null,
      createdAt: item.createdAt.toISOString(),
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to fetch roadmap items:", error);
    return NextResponse.json({ error: "Failed to fetch roadmap items" }, { status: 500 });
  }
}
