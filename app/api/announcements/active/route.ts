import { NextRequest, NextResponse } from "next/server";
import { sanitizeRichHtml } from "@/lib/sanitize-html";
import { validateApiKey } from "@/lib/api-key";
import { getOrgPrisma } from "@/lib/db";
import { cacheGet, cacheSet } from "@/lib/cache";
import { corsHeaders, handlePreflight } from "@/lib/cors";
import { logger } from "@/lib/logger";
import { UnauthorizedError, ApiError } from "@/lib/errors";

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
    content: sanitizeRichHtml(a.content),
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

// The cache stores every not-yet-ended announcement so future-scheduled ones
// don't require a cache invalidation to appear once their startDate arrives.
// Callers must filter to the currently-active window before returning results.
function filterActive(announcements: CachedAnnouncement[]): CachedAnnouncement[] {
  const now = Date.now();
  return announcements.filter(
    (a) => new Date(a.startDate).getTime() <= now && new Date(a.endDate).getTime() >= now
  );
}

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req);
}

export async function GET(req: NextRequest) {
  let cors: HeadersInit = {};
  try {
    const org = await validateApiKey(req);
    if (!org) {
      throw new UnauthorizedError("Invalid or missing API key");
    }

    const origin = req.headers.get("origin");
    cors = corsHeaders(origin, org.settings?.allowedDomain ?? null);

    const cached = cacheGet<CachedAnnouncement[]>(org.id, "announcements");
    const result = cached ?? (await fetchAndCacheAnnouncements(org.id));
    return NextResponse.json(filterActive(result), { headers: cors });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch active announcements");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode, headers: cors });
    }
    return NextResponse.json(
      { error: "Failed to fetch announcements" },
      { status: 500, headers: cors }
    );
  }
}
