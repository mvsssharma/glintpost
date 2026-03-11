import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  const org = await validateApiKey(req);

  if (!org) {
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { type, postId, visitorId, datalayer } = body;

    if (!type) {
      return NextResponse.json(
        { error: "Missing required field: type" },
        { status: 400 }
      );
    }

    await prisma.engagementEvent.create({
      data: {
        orgId: org.id,
        type,
        postId: postId || null,
        visitorId: visitorId || null,
        plan: datalayer?.plan || null,
        role: datalayer?.role || null,
        region: datalayer?.region || null,
        platform: datalayer?.platform || null,
        version: datalayer?.version || null,
        company: datalayer?.company || null,
        locale: datalayer?.locale || null,
      },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error("Tracking error:", error);
    return NextResponse.json(
      { error: "Failed to track event" },
      { status: 500 }
    );
  }
}
