import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { getOrgPrisma } from "@/lib/db";
import { voteSchema } from "@/lib/validations";
import { cacheUpdate } from "@/lib/cache";
import { corsHeaders, handlePreflight } from "@/lib/cors";
import { logger } from "@/lib/logger";
import { UnauthorizedError, ValidationError, NotFoundError, ApiError } from "@/lib/errors";
import type { CachedRoadmapItem } from "@/app/api/roadmap/items/route";

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
    const parsed = voteSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { itemId, visitorId, voteType } = parsed.data;
    const db = getOrgPrisma(org.id);

    const item = await db.roadmapItem.findFirst({
      where: { id: itemId },
    });
    if (!item) {
      throw new NotFoundError("Item not found");
    }
    const existingVote = await db.roadmapVote.findFirst({
      where: { itemId, visitorId },
    });

    if (existingVote) {
      if (existingVote.voteType === voteType) {
        await db.roadmapVote.delete({ where: { id: existingVote.id } });
        const field = voteType === "UP" ? "upvotes" : "downvotes";
        cacheUpdate<CachedRoadmapItem[]>(org.id, "roadmap-items", (items) =>
          items.map((i) => i.id === itemId ? { ...i, [field]: Math.max(0, i[field] - 1) } : i)
        );
        return NextResponse.json({ action: "removed", voteType: null }, { headers: cors });
      } else {
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

    await db.roadmapVote.create({
      data: { orgId: org.id, itemId, visitorId, voteType },
    });
    const field = voteType === "UP" ? "upvotes" : "downvotes";
    cacheUpdate<CachedRoadmapItem[]>(org.id, "roadmap-items", (items) =>
      items.map((i) => i.id === itemId ? { ...i, [field]: i[field] + 1 } : i)
    );

    return NextResponse.json({ action: "created", voteType }, { status: 201, headers: cors });
  } catch (error) {
    logger.error({ err: error }, "Vote error");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode, headers: cors });
    }
    return NextResponse.json({ error: "Failed to process vote" }, { status: 500, headers: cors });
  }
}
