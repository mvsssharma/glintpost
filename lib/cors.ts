import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "./api-key";

/**
 * Build CORS headers if the request origin matches the org's allowed domain.
 * Exact string match only — no regex, no wildcards, no subdomain inference.
 */
export function corsHeaders(
  origin: string | null,
  allowedDomain: string | null
): HeadersInit {
  if (!allowedDomain || !origin) return {};

  // Strict equality — subdomains must be added explicitly
  if (origin !== allowedDomain) return {};

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "x-api-key, content-type",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Handle CORS preflight (OPTIONS) requests.
 * Looks up the org via API key (query param) to determine allowedDomain.
 */
export async function handlePreflight(req: NextRequest): Promise<NextResponse> {
  const org = await validateApiKey(req);
  const origin = req.headers.get("origin");
  const allowed = org?.settings?.allowedDomain ?? null;
  const headers = corsHeaders(origin, allowed);

  return new NextResponse(null, { status: 204, headers });
}
