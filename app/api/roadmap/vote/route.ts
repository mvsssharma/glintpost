import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { getOrgPrisma } from "@/lib/db";
import { voteSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  const org = await validateApiKey(req);
  if (!org) {
    return NextResponse.json({ error: "Invalid or missing API key" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = voteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }

    const { itemId, visitorId, voteType } = parsed.data;
    const db = getOrgPrisma(org.id);

    // Verify item belongs to this org
    const item = await db.roadmapItem.findFirst({
      where: { id: itemId },
    });
    if (!item) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    // Check for existing vote
    const existingVote = await db.roadmapVote.findFirst({
      where: { itemId, visitorId },
    });

    if (existingVote) {
      if (existingVote.voteType === voteType) {
        await db.roadmapVote.delete({ where: { id: existingVote.id } });
        return NextResponse.json({ action: "removed", voteType: null });
      } else {
        await db.roadmapVote.update({
          where: { id: existingVote.id },
          data: { voteType },
        });
        return NextResponse.json({ action: "changed", voteType });
      }
    }

    await db.roadmapVote.create({
      data: { orgId: org.id, itemId, visitorId, voteType },
    });

    return NextResponse.json({ action: "created", voteType }, { status: 201 });
  } catch (error) {
    console.error("Vote error:", error);
    return NextResponse.json({ error: "Failed to process vote" }, { status: 500 });
  }
}
