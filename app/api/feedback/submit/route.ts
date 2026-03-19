import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api-key";
import { getOrgPrisma, prisma } from "@/lib/db";
import { feedbackSubmitSchema } from "@/lib/validations";
import { corsHeaders, handlePreflight } from "@/lib/cors";
import type { FeedbackQuestion } from "@/types";

export async function OPTIONS(req: NextRequest) {
  return handlePreflight(req);
}

export async function POST(req: NextRequest) {
  const org = await validateApiKey(req);

  if (!org) {
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    );
  }

  const origin = req.headers.get("origin");
  const cors = corsHeaders(origin, org.settings?.allowedDomain ?? null);

  try {
    const body = await req.json();
    const parsed = feedbackSubmitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400, headers: cors }
      );
    }

    const { formId, visitorId, answers, datalayer } = parsed.data;

    // Verify the form exists and belongs to this org
    const form = await prisma.feedbackForm.findUnique({
      where: { id: formId, orgId: org.id },
    });

    if (!form || !form.enabled) {
      return NextResponse.json(
        { error: "Feedback form not found or disabled" },
        { status: 404, headers: cors }
      );
    }

    // Validate answers match form questions
    const questions = form.questions as unknown as FeedbackQuestion[];
    for (const q of questions) {
      if (q.required) {
        const answer = answers.find((a) => a.questionId === q.id);
        if (!answer || (typeof answer.value === "string" && !answer.value.trim())) {
          return NextResponse.json(
            { error: `Answer required for: ${q.text}` },
            { status: 400, headers: cors }
          );
        }
      }
    }

    const db = getOrgPrisma(org.id);

    // Check for existing response (dedup by visitorId)
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
        plan: datalayer?.plan || null,
        role: datalayer?.role || null,
        region: datalayer?.region || null,
        platform: datalayer?.platform || null,
        version: datalayer?.version || null,
        company: datalayer?.company || null,
        locale: datalayer?.locale || null,
      },
    });

    return NextResponse.json(
      { action: "created" },
      { status: 201, headers: cors }
    );
  } catch (error) {
    console.error("Feedback submit error:", error);
    return NextResponse.json(
      { error: "Failed to submit feedback" },
      { status: 500, headers: cors }
    );
  }
}
