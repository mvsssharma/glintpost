import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { getOrgPrisma } from "@/lib/db";
import { voteSchema } from "@/lib/validations";
import { cacheUpdate } from "@/lib/cache";
import { corsHeaders, handlePreflight } from "@/lib/cors";
import type { CachedRoadmapItem } from "@/app/api/roadmap/items/route";

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req);
}

export async function POST(req: NextRequest) {
  const org = await validateApiKey(req);
  if (!org) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin, org.settings?.allowedDomain ?? null);

  try {
    const body = await req.json();
    const parsed = voteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400, headers: cors },
      );
    }

    const { itemId, visitorId, voteType } = parsed.data;
    const db = getOrgPrisma(org.id);

    // Verify item belongs to this org
    const item = await db.roadmapItem.findFirst({
      where: { id: itemId },
    });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404, headers: cors });
    }

    // Check for existing vote
    const existingVote = await db.roadmapVote.findFirst({
      where: { itemId, visitorId },
    });

    if (existingVote) {
      if (existingVote.voteType === voteType) {
        // Toggle off — remove vote
        await db.roadmapVote.delete({ where: { id: existingVote.id } });
        const field = voteType === "UP" ? "upvotes" : "downvotes";
        cacheUpdate<CachedRoadmapItem[]>(org.id, "roadmap-items", (items) =>
          items.map((i) => i.id === itemId ? { ...i, [field]: Math.max(0, i[field] - 1) } : i)
        );
        return NextResponse.json({ action: "removed", voteType: null }, { headers: cors });
      } else {
        // Switch vote type (UP→DOWN or DOWN→UP)
        await db.roadmapVote.update({
          where: { id: existingVote.id },
          data: { voteType },
        });
        const incField = voteType === "UP" ? "upvotes" : "downvotes";
        const decField = voteType === "UP" ? "downvotes" : "upvotes";
        cacheUpdate<CachedRoadmapItem[]>(org.id, "roadmap-items", (items) =>
          items.map((i) => i.id === itemId ? { ...i, [incField]: i[incField] + 1, [decField]: Math.max(0, i[decField] - 1) } : i)
        );
        return NextResponse.json({ action: "changed", voteType }, { headers: cors });
      }
    }

    // New vote
    await db.roadmapVote.create({
      data: { orgId: org.id, itemId, visitorId, voteType },
    });
    const field = voteType === "UP" ? "upvotes" : "downvotes";
    cacheUpdate<CachedRoadmapItem[]>(org.id, "roadmap-items", (items) =>
      items.map((i) => i.id === itemId ? { ...i, [field]: i[field] + 1 } : i)
    );

    return NextResponse.json({ action: "created", voteType }, { status: 201, headers: cors });
  } catch (error) {
    console.error("Vote error:", error);
    return NextResponse.json({ error: "Failed to process vote" }, { status: 500, headers: cors });
  }
}
