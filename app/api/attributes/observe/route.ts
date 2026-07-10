import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { getOrgPrisma } from "@/lib/db";
import { corsHeaders, handlePreflight } from "@/lib/cors";
import { observeAttributesSchema } from "@/lib/validations";
import { logger } from "@/lib/logger";
import { UnauthorizedError, ValidationError, ApiError } from "@/lib/errors";

export const dynamic = "force-dynamic";

// Cap observed keys per org so a noisy/hostile datalayer can't grow the table.
const MAX_OBSERVED_KEYS = 100;

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req);
}

/**
 * Widgets report the datalayer keys they saw (keys + inferred primitive type
 * only — never values) so the dashboard can suggest attributes to define.
 * Fire-and-forget from the client; returns 204 on success.
 */
export async function POST(req: NextRequest) {
  let cors: HeadersInit = {};
  try {
    const org = await validateApiKey(req);
    if (!org) throw new UnauthorizedError("Invalid or missing API key");

    const origin = req.headers.get("origin");
    cors = corsHeaders(origin, org.settings?.allowedDomain ?? null);

    const parsed = observeAttributesSchema.safeParse(await req.json());
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const db = getOrgPrisma(org.id);

    // De-dupe within the payload.
    const deduped: { key: string; type: string }[] = [];
    const seen = new Set<string>();
    for (const entry of parsed.data.keys) {
      if (seen.has(entry.key)) continue;
      seen.add(entry.key);
      deduped.push(entry);
    }
    if (deduped.length === 0) {
      return new NextResponse(null, { status: 204, headers: cors });
    }

    const keys = deduped.map((e) => e.key);
    const [existingCount, known] = await Promise.all([
      db.observedAttribute.count(),
      db.observedAttribute.findMany({ where: { key: { in: keys } }, select: { key: true } }),
    ]);

    const knownKeys = new Set(known.map((k) => k.key));
    let remaining = Math.max(0, MAX_OBSERVED_KEYS - existingCount);

    const toWrite = deduped.filter(({ key }) => {
      if (knownKeys.has(key)) return true;
      if (remaining <= 0) return false;
      remaining -= 1;
      return true;
    });

    if (toWrite.length > 0) {
      await db.$transaction(
        toWrite.map(({ key, type }) =>
          db.observedAttribute.upsert({
            where: { orgId_key: { orgId: org.id, key } },
            create: { orgId: org.id, key, inferredType: type },
            update: { inferredType: type },
          }),
        ),
      );
    }

    return new NextResponse(null, { status: 204, headers: cors });
  } catch (error) {
    logger.error({ err: error }, "Failed to record observed attributes");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode, headers: cors });
    }
    return NextResponse.json({ error: "Failed to record attributes" }, { status: 500, headers: cors });
  }
}
