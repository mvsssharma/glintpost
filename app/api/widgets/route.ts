import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { cacheGet, cacheSet } from "@/lib/cache";
import { corsHeaders, handlePreflight } from "@/lib/cors";
import { logger } from "@/lib/logger";
import { UnauthorizedError, ApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

const ALL_WIDGETS = ["changelog", "roadmap", "feedback", "announcements"];

interface WidgetConfig {
  widgets: string[];
  theme: string;
  primaryColor: string;
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

    const cached = cacheGet<WidgetConfig>(org.id, "widgetConfig");
    if (cached) {
      return NextResponse.json(cached, { headers: cors });
    }

    const config: WidgetConfig = {
      // Only fall back to ALL_WIDGETS when no settings row exists yet.
      // An explicit empty array means the org disabled every widget.
      widgets: org.settings?.enabledWidgets ?? ALL_WIDGETS,
      theme: org.settings?.widgetTheme ?? "light",
      primaryColor: org.settings?.primaryColor ?? "#10b981",
    };

    cacheSet(org.id, "widgetConfig", config);

    return NextResponse.json(config, { headers: cors });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch widget config");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode, headers: cors });
    }
    return NextResponse.json({ error: "Failed to fetch widgets" }, { status: 500, headers: cors });
  }
}
