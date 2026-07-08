import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { corsHeaders, handlePreflight } from "@/lib/cors";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { UnauthorizedError, NotFoundError, ApiError } from "@/lib/errors";

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

    const formId = req.nextUrl.searchParams.get("formId");

    let form;
    if (formId) {
      form = await prisma.feedbackForm.findUnique({
        where: { id: formId, orgId: org.id },
      });
    } else {
      // Fallback: return the first enabled form for this org
      form = await prisma.feedbackForm.findFirst({
        where: { orgId: org.id, enabled: true },
        orderBy: { createdAt: "asc" },
      });
    }

    if (!form || !form.enabled) {
      throw new NotFoundError("No active feedback form");
    }

    return NextResponse.json(
      {
        id: form.id,
        title: form.title,
        questions: form.questions,
      },
      { headers: cors }
    );
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch feedback form");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode, headers: cors });
    }
    return NextResponse.json({ error: "Failed to fetch feedback form" }, { status: 500, headers: cors });
  }
}
