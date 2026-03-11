import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { DEFAULT_PRIMARY_COLOR } from "@/lib/constants";

export const dynamic = "force-dynamic";

/**
 * Returns public widget config (theme, etc.) for the given API key.
 * Used by the widget UI and embed script to apply onboarding/settings theme.
 */
export async function GET(req: NextRequest) {
  const org = await validateApiKey(req);

  if (!org) {
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    );
  }

  const primaryColor = org.settings?.primaryColor ?? DEFAULT_PRIMARY_COLOR;
  const widgetTheme = org.settings?.widgetTheme ?? "light";

  return NextResponse.json({
    primaryColor,
    widgetTheme,
  });
}
