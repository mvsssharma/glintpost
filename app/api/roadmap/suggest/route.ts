import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { getOrgPrisma } from "@/lib/db";
import { findSimilarItems } from "@/lib/llm";
import { SIMILARITY_THRESHOLD_DUPLICATE } from "@/lib/constants";
import { suggestSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  const org = await validateApiKey(req);
  if (!org) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = suggestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const { text, visitorId } = parsed.data;
    const trimmed = text.trim();
    const db = getOrgPrisma(org.id);

    const existingItems = await db.roadmapItem.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: { id: true, title: true, description: true },
    });

    const similarItems = await findSimilarItems(
      trimmed,
      existingItems,
      org.settings,
    );

    const topMatch = similarItems[0];
    const isDuplicate = topMatch && topMatch.score >= SIMILARITY_THRESHOLD_DUPLICATE;

    const suggestion = await db.roadmapSuggestion.create({
      data: {
        orgId: org.id,
        rawText: trimmed,
        visitorId: visitorId || null,
        status: isDuplicate ? "MERGED" : "PENDING",
        matchedItemId: topMatch ? topMatch.itemId : null,
        similarityScore: topMatch ? topMatch.score : null,
      },
    });

    if (isDuplicate && visitorId && topMatch) {
      const existing = await db.roadmapVote.findFirst({
        where: { itemId: topMatch.itemId, visitorId },
      });
      if (!existing) {
        await db.roadmapVote.create({
          data: { orgId: org.id, itemId: topMatch.itemId, visitorId, voteType: "UP" },
        });
      }
    }

    return NextResponse.json(
      {
        action: isDuplicate ? "merged" : "pending",
        suggestion: {
          id: suggestion.id,
          rawText: suggestion.rawText,
          matchedItemId: suggestion.matchedItemId,
          similarityScore: suggestion.similarityScore,
        },
        matchedItem:
          isDuplicate && topMatch
            ? { id: topMatch.itemId, title: topMatch.title }
            : null,
        relatedItems: similarItems
          .filter((s) => s.score < SIMILARITY_THRESHOLD_DUPLICATE)
          .slice(0, 3),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Suggestion error:", error);
    return NextResponse.json({ error: "Failed to submit suggestion" }, { status: 500 });
  }
}
