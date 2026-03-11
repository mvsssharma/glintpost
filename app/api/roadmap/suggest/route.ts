import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { prisma, getOrgPrisma } from "@/lib/db";
import { findSimilarItems } from "@/lib/llm";
import { SIMILARITY_THRESHOLD_DUPLICATE } from "@/lib/constants";

export async function POST(req: NextRequest) {
  const org = await validateApiKey(req);
  if (!org) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  try {
    const { text, visitorId } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length < 5) {
      return NextResponse.json(
        { error: "Suggestion must be at least 5 characters" },
        { status: 400 },
      );
    }

    const db = getOrgPrisma(org.id);

    // Fetch existing non-archived items for similarity comparison
    const existingItems = await db.roadmapItem.findMany({
      where: { status: { not: "ARCHIVED" } },
      select: { id: true, title: true, description: true },
    });

    // Check similarity (LLM or fallback)
    const similarItems = await findSimilarItems(
      text.trim(),
      existingItems,
      org.settings,
    );

    const topMatch = similarItems[0];
    const isDuplicate = topMatch && topMatch.score >= SIMILARITY_THRESHOLD_DUPLICATE;

    // Create the suggestion record
    const suggestion = await prisma.roadmapSuggestion.create({
      data: {
        orgId: org.id,
        rawText: text.trim(),
        visitorId: visitorId || null,
        status: isDuplicate ? "MERGED" : "PENDING",
        matchedItemId: topMatch ? topMatch.itemId : null,
        similarityScore: topMatch ? topMatch.score : null,
      },
    });

    // If duplicate, auto-upvote the matched item
    if (isDuplicate && visitorId && topMatch) {
      await prisma.roadmapVote.upsert({
        where: { itemId_visitorId: { itemId: topMatch.itemId, visitorId } },
        create: { orgId: org.id, itemId: topMatch.itemId, visitorId, voteType: "UP" },
        update: {},
      });
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
