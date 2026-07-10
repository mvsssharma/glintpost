import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { getOrgPrisma, prisma } from "@/lib/db";
import { feedbackSubmitSchema } from "@/lib/validations";
import { legacyDatalayerColumns } from "@/lib/datalayer";
import { corsHeaders, handlePreflight } from "@/lib/cors";
import { logger } from "@/lib/logger";
import { UnauthorizedError, ValidationError, NotFoundError, ApiError } from "@/lib/errors";
import type { FeedbackQuestion } from "@/types";

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req);
}

export async function POST(req: NextRequest) {
  let cors: HeadersInit = {};
  try {
    const org = await validateApiKey(req);

    if (!org) {
      throw new UnauthorizedError("Invalid or missing API key");
    }

    const origin = req.headers.get("origin");
    cors = corsHeaders(origin, org.settings?.allowedDomain ?? null);
    const body = await req.json();
    const parsed = feedbackSubmitSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { formId, visitorId, answers, datalayer } = parsed.data;

    const form = await prisma.feedbackForm.findUnique({
      where: { id: formId, orgId: org.id },
    });

    if (!form || !form.enabled) {
      throw new NotFoundError("Feedback form not found or disabled");
    }

    const questions = form.questions as unknown as FeedbackQuestion[];
    for (const q of questions) {
      if (q.required) {
        const answer = answers.find((a) => a.questionId === q.id);
        if (!answer || (typeof answer.value === "string" && !answer.value.trim())) {
          throw new ValidationError(`Answer required for: ${q.text}`);
        }
      }
    }

    const db = getOrgPrisma(org.id);

    const existing = await db.feedbackResponse.findFirst({
      where: { formId, visitorId },
    });

    if (existing) {
      return NextResponse.json(
        { error: "You have already submitted feedback", alreadySubmitted: true },
        { status: 409, headers: cors }
      );
    }

    await db.feedbackResponse.create({
      data: {
        orgId: org.id,
        formId,
        visitorId,
        answers,
        ...legacyDatalayerColumns(datalayer),
      },
    });

    return NextResponse.json(
      { action: "created" },
      { status: 201, headers: cors }
    );
  } catch (error) {
    logger.error({ err: error }, "Feedback submit error");
    if (error instanceof ApiError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode, headers: cors });
    }
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500, headers: cors }
    );
  }
}
