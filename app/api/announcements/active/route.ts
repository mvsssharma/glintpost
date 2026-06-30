import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { getOrgPrisma } from "@/lib/db";
import { cacheGet, cacheSet } from "@/lib/cache";
import { corsHeaders, handlePreflight } from "@/lib/cors";

export const dynamic = "force-dynamic";

export interface CachedAnnouncement {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  videoUrl: string | null;
  ctaText: string | null;
  ctaUrl: string | null;
  displayType: string;
  priority: number;
  targetingRules: unknown;
  startDate: string;
  endDate: string;
}

async function fetchAndCacheAnnouncements(orgId: string): Promise<CachedAnnouncement[]> {
  const db = getOrgPrisma(orgId);
  const now = new Date();

  const announcements = await db.announcement.findMany({
    where: {
      status: "PUBLISHED",
      endDate: { gte: now },
    },
    orderBy: { priority: "desc" },
  });

  const result: CachedAnnouncement[] = announcements.map((a: {
    id: string;
    title: string;
    content: string;
    imageUrl: string | null;
    videoUrl: string | null;
    ctaText: string | null;
    ctaUrl: string | null;
    displayType: string;
    priority: number;
    targetingRules: unknown;
    startDate: Date;
    endDate: Date;
  }) => ({
    id: a.id,
    title: a.title,
    content: a.content,
    imageUrl: a.imageUrl,
    videoUrl: a.videoUrl,
    ctaText: a.ctaText,
    ctaUrl: a.ctaUrl,
    displayType: a.displayType,
    priority: a.priority,
    targetingRules: a.targetingRules ?? null,
    startDate: a.startDate.toISOString(),
    endDate: a.endDate.toISOString(),
  }));

  cacheSet(orgId, "announcements", result);
  return result;
}

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req);
}

export async function GET(req: NextRequest) {
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
    const cached = cacheGet<CachedAnnouncement[]>(org.id, "announcements");
    if (cached) {
      // Re-filter by date since cache may contain expired entries
      const now = Date.now();
      const active = cached.filter(
        (a) => new Date(a.startDate).getTime() <= now && new Date(a.endDate).getTime() >= now
      );
      return NextResponse.json(active, { headers: cors });
    }

    const result = await fetchAndCacheAnnouncements(org.id);
    return NextResponse.json(result, { headers: cors });
  } catch (error) {
    console.error("Failed to fetch active announcements:", error);
    return NextResponse.json(
      { error: "Failed to fetch announcements" },
      { status: 500, headers: cors }
    );
  }
}
