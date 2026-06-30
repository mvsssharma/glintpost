import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { cacheGet, cacheSet } from "@/lib/cache";
import { corsHeaders, handlePreflight } from "@/lib/cors";

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
  const org = await validateApiKey(req);

  if (!org) {
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    );
  }

  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin, org.settings?.allowedDomain ?? null);

  const cached = cacheGet<WidgetConfig>(org.id, "widgetConfig");
  if (cached) {
    return NextResponse.json(cached, { headers: cors });
  }

  const config: WidgetConfig = {
    widgets: org.settings?.enabledWidgets?.length
      ? org.settings.enabledWidgets
      : ALL_WIDGETS,
    theme: org.settings?.widgetTheme ?? "light",
    primaryColor: org.settings?.primaryColor ?? "#10b981",
  };

  cacheSet(org.id, "widgetConfig", config);

  return NextResponse.json(config, { headers: cors });
}
