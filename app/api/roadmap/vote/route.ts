import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const org = await validateApiKey(req);
  if (!org) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  try {
    const { itemId, visitorId, voteType } = await req.json();

    if (!itemId || !visitorId || !voteType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!["UP", "DOWN"].includes(voteType)) {
      return NextResponse.json({ error: "Invalid vote type" }, { status: 400 });
    }

    // Verify item belongs to this org
    const item = await prisma.roadmapItem.findFirst({
      where: { id: itemId, orgId: org.id },
    });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Check for existing vote
    const existingVote = await prisma.roadmapVote.findUnique({
      where: { itemId_visitorId: { itemId, visitorId } },
    });

    if (existingVote) {
      if (existingVote.voteType === voteType) {
        // Toggle off
        await prisma.roadmapVote.delete({ where: { id: existingVote.id } });
        return NextResponse.json({ action: "removed", voteType: null });
      } else {
        // Switch vote
        await prisma.roadmapVote.update({
          where: { id: existingVote.id },
          data: { voteType },
        });
        return NextResponse.json({ action: "changed", voteType });
      }
    }

    // Create new vote
    await prisma.roadmapVote.create({
      data: { orgId: org.id, itemId, visitorId, voteType },
    });

    return NextResponse.json({ action: "created", voteType }, { status: 201 });
  } catch (error) {
    console.error("Vote error:", error);
    return NextResponse.json({ error: "Failed to process vote" }, { status: 500 });
  }
}
