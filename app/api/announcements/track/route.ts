import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { getOrgPrisma } from "@/lib/db";
import { announcementEventSchema } from "@/lib/validations";
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
    const parsed = announcementEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400, headers: cors }
      );
    }

    const { type, announcementId, visitorId, datalayer } = parsed.data;
    const db = getOrgPrisma(org.id);

    const eventData = {
      orgId: org.id,
      announcementId,
      type,
      visitorId: visitorId || null,
      plan: datalayer?.plan || null,
      role: datalayer?.role || null,
      region: datalayer?.region || null,
      platform: datalayer?.platform || null,
      version: datalayer?.version || null,
      company: datalayer?.company || null,
      locale: datalayer?.locale || null,
    };

    if (visitorId) {
      await db.announcementEvent.upsert({
        where: {
          announcementId_visitorId_type: {
            announcementId,
            visitorId,
            type,
          },
        },
        update: {},
        create: eventData,
      });
    } else {
      await db.announcementEvent.create({ data: eventData });
    }

    return NextResponse.json({ action: "created", type }, { status: 201, headers: cors });
  } catch (error) {
    console.error("Announcement tracking error:", error);
    return NextResponse.json(
      { error: "Failed to track event" },
      { status: 500, headers: cors }
    );
  }
}
