import { NextRequest } from "next/server";
import { prisma } from "./db";

/**
 * Validate an API key from the request.
 * Checks the `x-api-key` header first, then `apiKey` query param.
 * Returns the organization if the key is valid, null otherwise.
 */
export async function validateApiKey(request: NextRequest) {
  const apiKey =
    request.headers.get("x-api-key") ||
    request.nextUrl.searchParams.get("apiKey");

  if (!apiKey) return null;

  const org = await prisma.organization.findUnique({
    where: { apiKey },
    include: { settings: true },
  });

  return org;
}
