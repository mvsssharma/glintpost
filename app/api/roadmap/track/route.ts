import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { getOrgPrisma } from "@/lib/db";
import { corsHeaders, handlePreflight } from "@/lib/cors";

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req);
}

export async function POST(req: NextRequest) {
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
    const body = await req.json();
    const visitorId = typeof body.visitorId === "string" ? body.visitorId.slice(0, 200) : null;

    const db = getOrgPrisma(org.id);

    await db.roadmapView.create({
      data: {
        orgId: org.id,
        visitorId: visitorId || null,
      },
    });

    return NextResponse.json({ success: true }, { status: 201, headers: cors });
  } catch (error) {
    console.error("Roadmap view tracking error:", error);
    return NextResponse.json(
      { error: "Failed to track view" },
      { status: 500, headers: cors }
    );
  }
}
