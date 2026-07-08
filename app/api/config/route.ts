import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { DEFAULT_PRIMARY_COLOR } from "@/lib/constants";
import { corsHeaders, handlePreflight } from "@/lib/cors";
import { logger } from "@/lib/logger";
import { UnauthorizedError, ApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

/**
 * Returns public widget config (theme, etc.) for the given API key.
 * Used by the widget UI and embed script to apply onboarding/settings theme.
 */
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

    return NextResponse.json({
      primaryColor: org.settings?.primaryColor ?? DEFAULT_PRIMARY_COLOR,
      widgetTheme: org.settings?.widgetTheme ?? "light",
      allowedDomain: org.settings?.allowedDomain ?? null,
    }, { headers: cors });
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch widget config");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode, headers: cors });
    }
    return NextResponse.json({ error: "Failed to fetch config" }, { status: 500, headers: cors });
  }
}
